"""Order building shared by the website checkout and the admin "Create order" screen, plus invoice numbering.

build_order() validates the lines (products and combo kits), locks and deducts stock, snapshots
prices into the order and assigns an invoice number. The caller commits.
"""
from datetime import datetime, timezone

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from .combos import kit_label
from .config import settings
from .models import Combo, Customer, Order, Product, StoreSetting, invoice_number_seq, order_number_seq
from .utils import ApiError, clip

PAYMENT_METHODS = ["Cash on Delivery", "UPI", "Bank transfer", "Card", "Cash"]
PAYMENT_STATUSES = ["Pending", "Paid", "Refunded"]

# Business details printed on invoices (editable in Admin → Invoices → Settings)
INVOICE_DEFAULTS = {
    "businessName": "Quench Elegance",
    "tagline": "Luxury Hair Care. Affordable for Everyone.",
    "address": "No. 58/1, 12th Main Road, Shakambari Nagar, J.P. Nagar 1st Phase, Bengaluru, Karnataka – 560078",
    "state": "Karnataka",
    "phone": "+91 81235 67808",
    "email": "info@quenchelegance.com",
    "website": "www.quenchelegance.com",
    "gstin": "",
    "gstRate": 0,  # % included in prices; 0 = no GST breakdown on the invoice
    "terms": "Goods once sold can be returned only as per our returns policy. "
             "Quench Elegance products are cosmetic, non-medicated external hair and scalp care.",
    "footer": "Thank you for choosing Quench Elegance.",
    "signatory": "Authorised Signatory",
    "defaultTemplate": "classic",  # classic | modern | compact
}


def shipping_for(subtotal: int) -> int:
    if not settings.shipping_flat:
        return 0
    if settings.free_shipping_above and subtotal >= settings.free_shipping_above:
        return 0
    return settings.shipping_flat


def invoice_settings(db: Session) -> dict:
    row = db.get(StoreSetting, "invoice")
    return {**INVOICE_DEFAULTS, **(row.value if row else {})}


def assign_invoice(db: Session, order: Order) -> None:
    if order.invoice_number:
        return
    seq = db.scalar(invoice_number_seq.next_value())
    when = order.created_at or datetime.now(timezone.utc)
    order.invoice_number = f"INV-{when.year}-{seq:05d}"
    order.invoice_date = when


def backfill_invoices(db: Session) -> int:
    """Gives every existing order without one an invoice number, oldest first."""
    orders = db.scalars(select(Order).where(Order.invoice_number.is_(None)).order_by(Order.created_at)).all()
    for o in orders:
        assign_invoice(db, o)
    db.commit()
    return len(orders)


def build_order(
    db: Session,
    customer: Customer,
    items: list[dict],  # [{productId|comboId, qty, price?}]
    address: dict,
    *,
    notes: str = "",
    source: str = "website",
    created_by: str = "",
    allow_hidden: bool = False,
    allow_price_override: bool = False,
    discount: int = 0,
    shipping: int | None = None,
    payment_method: str = "Cash on Delivery",
    payment_status: str = "Pending",
    status: str = "Placed",
    status_note: str = "",
    tracking_number: str = "",
    admin_notes: str = "",
    max_qty: int = 20,
) -> Order:
    if not items:
        raise ApiError(400, "Your cart is empty." if source == "website" else "Add at least one product.")

    # merge duplicate lines, cap quantities; keep any admin price override
    qtys: dict[str, int] = {}
    combo_qtys: dict[str, int] = {}
    prices: dict[str, int] = {}
    for it in items[:40]:
        key = it.get("comboId") or it.get("productId")
        if not key:
            continue
        bucket = combo_qtys if it.get("comboId") else qtys
        bucket[key] = min(max_qty, bucket.get(key, 0) + max(1, int(it.get("qty") or 1)))
        if allow_price_override and it.get("price") is not None:
            prices[key] = max(0, int(it["price"]))
    if not qtys and not combo_qtys:
        raise ApiError(400, "Add at least one product.")

    combos = {c.id: c for c in db.scalars(select(Combo).where(Combo.id.in_(combo_qtys.keys())))} if combo_qtys else {}
    for cid in combo_qtys:
        if cid not in combos or (not combos[cid].active and not allow_hidden):
            raise ApiError(400, "A combo in your cart is no longer available.")

    # units needed per product = loose products + every kit's contents
    need: dict[str, int] = dict(qtys)
    for cid, kits in combo_qtys.items():
        for it in combos[cid].items:
            need[it["productId"]] = need.get(it["productId"], 0) + kits * max(1, int(it.get("qty") or 1))

    # Lock the product rows so two simultaneous orders can't oversell stock
    products = {p.id: p for p in db.scalars(select(Product).where(Product.id.in_(need.keys())).with_for_update())} if need else {}
    for pid, units in need.items():
        p = products.get(pid)
        if not p or (not p.active and not allow_hidden):
            raise ApiError(400, "A product in your cart is no longer available.")
        if p.stock < units:
            raise ApiError(400, f"Only {p.stock} left of {p.name}" + (" (including the kits in this order)." if pid not in qtys or units > qtys[pid] else "."))

    lines = []
    for pid, qty in qtys.items():
        p = products[pid]
        price = prices.get(pid, p.price)
        lines.append({
            "productId": p.id, "name": p.name, "slug": p.slug, "image": p.image, "size": p.size or "",
            "price": price, "mrp": p.mrp, "qty": qty, "lineTotal": price * qty,
        })
    for cid, kits in combo_qtys.items():
        c = combos[cid]
        components = [{"productId": it["productId"], "name": products[it["productId"]].name, "qty": max(1, int(it.get("qty") or 1))} for it in c.items]
        mrp = c.mrp or sum(products[x["productId"]].mrp * x["qty"] for x in components)
        price = prices.get(cid, c.price)
        lines.append({
            "type": "combo", "comboId": c.id, "name": c.name, "slug": c.slug, "image": c.image or c.banner,
            "size": kit_label(components), "price": price, "mrp": mrp, "qty": kits, "lineTotal": price * kits,
            "components": components,
        })

    for pid, units in need.items():
        db.execute(update(Product).where(Product.id == pid).values(stock=Product.stock - units))

    subtotal = sum(line["lineTotal"] for line in lines)
    discount = max(0, min(int(discount or 0), subtotal))
    ship = shipping_for(subtotal - discount) if shipping is None else max(0, int(shipping))
    now = datetime.now(timezone.utc).isoformat()
    by = "customer" if source == "website" else created_by
    history = [{"status": "Placed", "at": now, "note": "Order placed by customer" if source == "website" else "Order created by the Quench Elegance team", "by": by}]
    if status != "Placed":  # admin created it straight into a later stage
        history.append({"status": status, "at": now, "note": clip(status_note, 300), "by": by})

    order = Order(
        order_number=f"QE{db.scalar(order_number_seq.next_value())}",
        customer_id=customer.id,
        customer={"name": customer.name, "phone": customer.phone, "customerCode": customer.customer_code, "email": customer.email or ""},
        items=lines,
        subtotal=subtotal,
        discount=discount,
        shipping=ship,
        total=subtotal - discount + ship,
        address=address,
        notes=clip(notes, 500),
        payment_method=payment_method if payment_method in PAYMENT_METHODS else "Cash on Delivery",
        payment_status=payment_status if payment_status in PAYMENT_STATUSES else "Pending",
        status=status,
        history=history,
        tracking_number=clip(tracking_number, 80),
        admin_notes=clip(admin_notes, 1000),
        source=source,
        created_by=clip(created_by, 160),
        created_at=datetime.now(timezone.utc),
    )
    db.add(order)
    assign_invoice(db, order)
    return order
