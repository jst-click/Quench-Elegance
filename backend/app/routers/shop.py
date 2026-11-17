import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from ..config import settings
from ..database import get_db
from ..models import ContactMessage, Customer, Order, Product, order_number_seq
from ..security import current_customer
from ..utils import ApiError, clip, normalize_phone, to_dict
from .auth import AddressIn, address_error, clean_address

router = APIRouter(prefix="/api", tags=["store"])


def public_product(p: Product) -> dict:
    return to_dict(p, exclude={"updated_at"})


def order_dict(o: Order) -> dict:
    return to_dict(o)


# ---------------- Catalogue ----------------
@router.get("/products")
def list_products(category: str | None = None, featured: bool | None = None, q: str | None = None, db: Session = Depends(get_db)):
    stmt = select(Product).where(Product.active.is_(True))
    if category:
        stmt = stmt.where(Product.category == category)
    if featured:
        stmt = stmt.where(Product.featured.is_(True))
    if q:
        stmt = stmt.where(Product.name.ilike(f"%{q}%"))
    products = db.scalars(stmt.order_by(Product.sort_order, Product.created_at)).all()
    return {"products": [public_product(p) for p in products]}


@router.get("/products/{slug}")
def get_product(slug: str, db: Session = Depends(get_db)):
    p = db.scalar(select(Product).where(Product.slug == slug, Product.active.is_(True)))
    if not p:
        raise ApiError(404, "Product not found.")
    return {"product": public_product(p)}


@router.get("/store-config")
def store_config():
    return {"shippingFlat": settings.shipping_flat, "freeShippingAbove": settings.free_shipping_above}


def shipping_for(subtotal: int) -> int:
    if not settings.shipping_flat:
        return 0
    if settings.free_shipping_above and subtotal >= settings.free_shipping_above:
        return 0
    return settings.shipping_flat


# ---------------- Orders (registered customers only) ----------------
class CartItem(BaseModel):
    productId: str
    qty: int = 1


class OrderIn(BaseModel):
    items: list[CartItem] = []
    address: AddressIn = AddressIn()
    notes: str = ""
    saveAddress: bool = False


@router.post("/orders", status_code=201)
def create_order(body: OrderIn, customer: Customer = Depends(current_customer), db: Session = Depends(get_db)):
    if not body.items:
        raise ApiError(400, "Your cart is empty.")
    address = clean_address(body.address)
    err = address_error(address)
    if err:
        raise ApiError(400, err)

    # merge duplicate lines, cap quantities
    qtys: dict[str, int] = {}
    for it in body.items[:30]:
        qtys[it.productId] = min(20, qtys.get(it.productId, 0) + max(1, it.qty))

    lines = []
    # Lock the product rows so two simultaneous orders can't oversell stock
    products = {p.id: p for p in db.scalars(select(Product).where(Product.id.in_(qtys.keys())).with_for_update())}
    for pid, qty in qtys.items():
        p = products.get(pid)
        if not p or not p.active:
            raise ApiError(400, "A product in your cart is no longer available.")
        if p.stock < qty:
            raise ApiError(400, f"Only {p.stock} left of {p.name}.")
        lines.append({
            "productId": p.id, "name": p.name, "slug": p.slug, "image": p.image, "size": p.size or "",
            "price": p.price, "mrp": p.mrp, "qty": qty, "lineTotal": p.price * qty,
        })

    for line in lines:
        db.execute(update(Product).where(Product.id == line["productId"]).values(stock=Product.stock - line["qty"]))

    subtotal = sum(line["lineTotal"] for line in lines)
    shipping = shipping_for(subtotal)
    seq = db.scalar(order_number_seq.next_value())
    order = Order(
        order_number=f"QE{seq}",
        customer_id=customer.id,
        customer={"name": customer.name, "phone": customer.phone, "customerCode": customer.customer_code, "email": customer.email or ""},
        items=lines,
        subtotal=subtotal,
        shipping=shipping,
        total=subtotal + shipping,
        address=address,
        notes=clip(body.notes, 500),
        history=[{"status": "Placed", "at": datetime.now(timezone.utc).isoformat(), "note": "Order placed by customer"}],
    )
    db.add(order)

    if body.saveAddress:
        saved = customer.addresses or []
        if not any(a.get("line1") == address["line1"] and a.get("pincode") == address["pincode"] for a in saved):
            customer.addresses = [*saved, {"id": uuid.uuid4().hex, **address}][-5:]
            db.add(customer)

    db.commit()
    return {"order": order_dict(order)}


@router.get("/orders")
def my_orders(customer: Customer = Depends(current_customer), db: Session = Depends(get_db)):
    orders = db.scalars(select(Order).where(Order.customer_id == customer.id).order_by(Order.created_at.desc())).all()
    return {"orders": [order_dict(o) for o in orders]}


@router.get("/orders/{order_id}")
def my_order(order_id: str, customer: Customer = Depends(current_customer), db: Session = Depends(get_db)):
    o = db.scalar(select(Order).where(Order.id == order_id, Order.customer_id == customer.id))
    if not o:
        raise ApiError(404, "Order not found.")
    return {"order": order_dict(o)}


# ---------------- Contact form ----------------
class ContactIn(BaseModel):
    name: str = ""
    phone: str = ""
    email: str = ""
    subject: str = ""
    message: str = ""


@router.post("/contact")
def contact(body: ContactIn, db: Session = Depends(get_db)):
    name, message = clip(body.name, 80), clip(body.message, 2000)
    if not name or not message:
        raise ApiError(400, "Name and message are required.")
    db.add(ContactMessage(
        name=name,
        phone=normalize_phone(body.phone) or clip(body.phone, 20),
        email=clip(body.email, 120),
        subject=clip(body.subject, 120),
        message=message,
    ))
    db.commit()
    return {"message": "Thank you for reaching out. Our team will get back to you soon."}
