import re
import secrets
from datetime import datetime, timedelta, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, File, UploadFile
from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel
from sqlalchemy import func, or_, select, update
from sqlalchemy.orm import Session

from ..config import PRODUCT_UPLOAD_DIR
from ..database import get_db
from ..models import Admin, ContactMessage, Customer, Order, Product, RegistrationRequest, customer_code_seq
from ..security import create_token, current_admin, hash_secret, verify_secret
from ..utils import ORDER_STATUSES, ApiError, RateLimiter, clip, normalize_phone, slugify, to_dict

router = APIRouter(prefix="/api/admin", tags=["admin"])
protected = APIRouter(prefix="/api/admin", tags=["admin"], dependencies=[Depends(current_admin)])
login_limiter = RateLimiter(limit=15, window_seconds=15 * 60)


def admin_dict(a: Admin) -> dict:
    return {"id": a.id, "email": a.email, "name": a.name}


# ---------------- Auth ----------------
class LoginIn(BaseModel):
    email: str = ""
    password: str = ""


@router.post("/login", dependencies=[Depends(login_limiter)])
def login(body: LoginIn, db: Session = Depends(get_db)):
    admin = db.scalar(select(Admin).where(Admin.email == body.email.strip().lower()))
    if not admin or not verify_secret(body.password, admin.password_hash):
        raise ApiError(401, "Invalid email or password.")
    return {"token": create_token(admin.id, "admin", hours=12), "admin": admin_dict(admin)}


@protected.get("/me")
def me(admin: Admin = Depends(current_admin)):
    return {"admin": admin_dict(admin)}


class PasswordIn(BaseModel):
    currentPassword: str = ""
    newPassword: str = ""


@protected.put("/password")
def change_password(body: PasswordIn, admin: Admin = Depends(current_admin), db: Session = Depends(get_db)):
    if not verify_secret(body.currentPassword, admin.password_hash):
        raise ApiError(400, "Current password is incorrect.")
    if len(body.newPassword) < 8:
        raise ApiError(400, "New password must be at least 8 characters.")
    admin.password_hash = hash_secret(body.newPassword)
    db.add(admin)
    db.commit()
    return {"message": "Password updated."}


# ---------------- Dashboard ----------------
@protected.get("/dashboard")
def dashboard(db: Session = Depends(get_db)):
    orders = db.scalars(select(Order).order_by(Order.created_at.desc())).all()
    products = db.scalars(select(Product)).all()
    customers = db.scalar(select(func.count()).select_from(Customer))
    pending = db.scalar(select(func.count()).select_from(RegistrationRequest).where(RegistrationRequest.status == "pending"))
    unread = db.scalar(select(func.count()).select_from(ContactMessage).where(ContactMessage.read.is_(False)))

    valid = [o for o in orders if o.status != "Cancelled"]
    revenue = sum(o.total for o in valid)
    by_status = {s: sum(1 for o in orders if o.status == s) for s in ORDER_STATUSES}

    # last 14 days, bucketed in India time
    ist = timezone(timedelta(hours=5, minutes=30))
    today = datetime.now(ist).date()
    days = []
    for i in range(13, -1, -1):
        d = today - timedelta(days=i)
        day_orders = [o for o in valid if o.created_at.astimezone(ist).date() == d]
        days.append({"date": d.isoformat(), "revenue": sum(o.total for o in day_orders), "orders": len(day_orders)})

    sales: dict[str, dict] = {}
    for o in valid:
        for i in o.items:
            s = sales.setdefault(i["productId"], {"name": i["name"], "qty": 0, "revenue": 0})
            s["qty"] += i["qty"]
            s["revenue"] += i["lineTotal"]

    return {
        "stats": {
            "revenue": revenue,
            "orders": len(orders),
            "customers": customers,
            "products": len(products),
            "avgOrder": round(revenue / len(valid)) if valid else 0,
            "pendingRequests": pending,
            "unreadMessages": unread,
        },
        "byStatus": by_status,
        "days": days,
        "topProducts": sorted(sales.values(), key=lambda s: -s["revenue"])[:5],
        "lowStock": [{"id": p.id, "name": p.name, "stock": p.stock} for p in products if p.active and p.stock <= 10],
        "recentOrders": [to_dict(o) for o in orders[:6]],
    }


# ---------------- Customers ----------------
class CustomerIn(BaseModel):
    name: str | None = None
    phone: str | None = None
    email: str | None = None
    customerCode: str | None = None
    notes: str | None = None
    active: bool | None = None


def clean_code(code: str | None) -> str:
    return re.sub(r"[^A-Z0-9-]", "", (code or "").strip().upper())[:30]


def create_customer(db: Session, *, name, phone, email="", customer_code="", notes="") -> Customer:
    p = normalize_phone(phone)
    if not (name or "").strip():
        raise ApiError(400, "Customer name is required.")
    if not p:
        raise ApiError(400, "Enter a valid 10-digit Indian mobile number.")
    if db.scalar(select(Customer).where(Customer.phone == p)):
        raise ApiError(409, "A customer with this mobile number already exists.")
    code = clean_code(customer_code)
    if code:
        if db.scalar(select(Customer).where(Customer.customer_code == code)):
            raise ApiError(409, "This User ID is already taken.")
    else:
        code = f"QE{db.scalar(customer_code_seq.next_value())}"
    c = Customer(customer_code=code, name=clip(name, 80), phone=p, email=clip(email, 120), notes=clip(notes, 500), addresses=[], active=True)
    db.add(c)
    db.flush()
    return c


@protected.get("/customers")
def list_customers(q: str = "", status: str = "", db: Session = Depends(get_db)):
    stmt = select(Customer)
    if q:
        like = f"%{q}%"
        stmt = stmt.where(or_(Customer.name.ilike(like), Customer.phone.ilike(like), Customer.customer_code.ilike(like), Customer.email.ilike(like)))
    if status == "active":
        stmt = stmt.where(Customer.active.is_(True))
    elif status == "inactive":
        stmt = stmt.where(Customer.active.is_(False))
    customers = db.scalars(stmt.order_by(Customer.created_at.desc())).all()

    stats = {
        cid: {"orders": n, "spent": int(spent or 0)}
        for cid, n, spent in db.execute(
            select(Order.customer_id, func.count(), func.sum(Order.total).filter(Order.status != "Cancelled")).group_by(Order.customer_id)
        )
    }
    return {"customers": [{**to_dict(c), **stats.get(c.id, {"orders": 0, "spent": 0})} for c in customers]}


@protected.post("/customers", status_code=201)
def add_customer(body: CustomerIn, db: Session = Depends(get_db)):
    c = create_customer(db, name=body.name, phone=body.phone, email=body.email or "", customer_code=body.customerCode or "", notes=body.notes or "")
    db.commit()
    return {"customer": to_dict(c)}


@protected.get("/customers/{cid}")
def get_customer(cid: str, db: Session = Depends(get_db)):
    c = db.get(Customer, cid)
    if not c:
        raise ApiError(404, "Customer not found.")
    orders = db.scalars(select(Order).where(Order.customer_id == cid).order_by(Order.created_at.desc())).all()
    return {"customer": to_dict(c), "orders": [to_dict(o) for o in orders]}


@protected.put("/customers/{cid}")
def edit_customer(cid: str, body: CustomerIn, db: Session = Depends(get_db)):
    c = db.get(Customer, cid)
    if not c:
        raise ApiError(404, "Customer not found.")
    if body.name is not None:
        if not body.name.strip():
            raise ApiError(400, "Name is required.")
        c.name = clip(body.name, 80)
    if body.email is not None:
        c.email = clip(body.email, 120)
    if body.notes is not None:
        c.notes = clip(body.notes, 500)
    if body.active is not None:
        c.active = body.active
    if body.phone is not None:
        p = normalize_phone(body.phone)
        if not p:
            raise ApiError(400, "Enter a valid 10-digit Indian mobile number.")
        other = db.scalar(select(Customer).where(Customer.phone == p))
        if other and other.id != c.id:
            raise ApiError(409, "Another customer already uses this number.")
        c.phone = p
    if body.customerCode is not None:
        code = clean_code(body.customerCode)
        if not code:
            raise ApiError(400, "User ID cannot be empty.")
        other = db.scalar(select(Customer).where(Customer.customer_code == code))
        if other and other.id != c.id:
            raise ApiError(409, "This User ID is already taken.")
        c.customer_code = code
    db.commit()
    return {"customer": to_dict(c)}


@protected.delete("/customers/{cid}")
def remove_customer(cid: str, db: Session = Depends(get_db)):
    c = db.get(Customer, cid)
    if not c:
        raise ApiError(404, "Customer not found.")
    if db.scalar(select(func.count()).select_from(Order).where(Order.customer_id == cid)):
        c.active = False
        db.commit()
        return {"message": "Customer has orders, so the account was deactivated instead of deleted.", "deactivated": True}
    db.delete(c)
    db.commit()
    return {"message": "Customer deleted."}


# ---------------- Registration requests ----------------
@protected.get("/registration-requests")
def list_requests(status: str = "", db: Session = Depends(get_db)):
    stmt = select(RegistrationRequest)
    if status:
        stmt = stmt.where(RegistrationRequest.status == status)
    return {"requests": [to_dict(r) for r in db.scalars(stmt.order_by(RegistrationRequest.created_at.desc()))]}


class ApproveIn(BaseModel):
    name: str | None = None
    email: str | None = None
    customerCode: str | None = None


@protected.post("/registration-requests/{rid}/approve")
def approve_request(rid: str, body: ApproveIn, db: Session = Depends(get_db)):
    r = db.get(RegistrationRequest, rid)
    if not r or r.status != "pending":
        raise ApiError(404, "Request not found.")
    c = create_customer(
        db,
        name=body.name or r.name,
        phone=r.phone,
        email=body.email if body.email is not None else r.email,
        customer_code=body.customerCode or "",
        notes=f"City: {r.city}" if r.city else "",
    )
    r.status, r.customer_id = "approved", c.id
    db.commit()
    return {"customer": to_dict(c)}


@protected.post("/registration-requests/{rid}/reject")
def reject_request(rid: str, db: Session = Depends(get_db)):
    r = db.get(RegistrationRequest, rid)
    if r:
        r.status = "rejected"
        db.commit()
    return {"message": "Request rejected."}


# ---------------- Products ----------------
ALLOWED_IMAGE_TYPES = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "image/avif": ".avif"}
MAX_IMAGE_BYTES = 5 * 1024 * 1024


@protected.post("/upload")
async def upload_image(image: UploadFile = File(...)):
    ext = ALLOWED_IMAGE_TYPES.get(image.content_type or "")
    if not ext:
        raise ApiError(400, "Please upload a JPG, PNG or WEBP image under 5 MB.")
    data = await image.read(MAX_IMAGE_BYTES + 1)
    if len(data) > MAX_IMAGE_BYTES:
        raise ApiError(400, "Image must be under 5 MB.")
    PRODUCT_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    name = f"{int(datetime.now().timestamp() * 1000)}-{secrets.token_hex(4)}{ext}"
    (PRODUCT_UPLOAD_DIR / name).write_bytes(data)
    return {"url": f"/uploads/products/{name}"}


class Benefit(BaseModel):
    title: str = ""
    body: str = ""


class ProductIn(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    name: str | None = None
    subtitle: str | None = None
    category: str | None = None
    size: str | None = None
    image: str | None = None
    tagline: str | None = None
    highlight: str | None = None
    short_description: str | None = None
    intro: str | None = None
    closing_title: str | None = None
    closing_body: str | None = None
    signature: str | None = None
    mrp: float | None = None
    price: float | None = None
    stock: float | None = None
    sort_order: float | None = None
    featured: bool | None = None
    active: bool | None = None
    ingredients: list[str] | str | None = None
    tags: list[str] | str | None = None
    gallery: list[str] | None = None
    benefits: list[Benefit] | None = None
    slug: str | None = None


def to_list(v) -> list[str]:
    items = v if isinstance(v, list) else re.split(r"\n|,", v or "")
    return [str(s).strip() for s in items if str(s).strip()]


def product_fields(body: ProductIn) -> dict:
    raw = body.model_dump(exclude_unset=True)
    out = {}
    for k in ("name", "subtitle", "category", "size", "image", "tagline", "highlight", "signature", "closing_title"):
        if k in raw and raw[k] is not None:
            out[k] = clip(raw[k], 300)
    for k in ("short_description", "intro", "closing_body"):
        if k in raw and raw[k] is not None:
            out[k] = clip(raw[k], 3000)
    for k in ("mrp", "price", "stock", "sort_order"):
        if k in raw and raw[k] is not None:
            out[k] = max(0, int(raw[k]))
    for k in ("featured", "active"):
        if k in raw and raw[k] is not None:
            out[k] = bool(raw[k])
    for k in ("ingredients", "tags", "gallery"):
        if k in raw and raw[k] is not None:
            out[k] = to_list(raw[k])
    if body.benefits is not None:
        out["benefits"] = [{"title": clip(b.title, 200), "body": clip(b.body, 2000)} for b in body.benefits if b.title.strip()]
    if raw.get("slug") is not None:
        out["slug"] = slugify(raw["slug"])
    return out


@protected.get("/products")
def admin_products(db: Session = Depends(get_db)):
    return {"products": [to_dict(p) for p in db.scalars(select(Product).order_by(Product.sort_order, Product.created_at))]}


@protected.get("/products/{pid}")
def admin_product(pid: str, db: Session = Depends(get_db)):
    p = db.get(Product, pid)
    if not p:
        raise ApiError(404, "Product not found.")
    return {"product": to_dict(p)}


@protected.post("/products", status_code=201)
def create_product(body: ProductIn, db: Session = Depends(get_db)):
    data = product_fields(body)
    if not data.get("name"):
        raise ApiError(400, "Product name is required.")
    if not data.get("price"):
        raise ApiError(400, "Selling price is required.")
    slug = data.pop("slug", "") or slugify(data["name"])
    if db.scalar(select(Product).where(Product.slug == slug)):
        slug = f"{slug}-{secrets.token_hex(2)}"
    data.setdefault("mrp", data["price"])
    p = Product(slug=slug, **data)
    db.add(p)
    db.commit()
    return {"product": to_dict(p)}


@protected.put("/products/{pid}")
def edit_product(pid: str, body: ProductIn, db: Session = Depends(get_db)):
    p = db.get(Product, pid)
    if not p:
        raise ApiError(404, "Product not found.")
    data = product_fields(body)
    if "name" in data and not data["name"]:
        raise ApiError(400, "Product name is required.")
    if "slug" in data:
        if not data["slug"]:
            data.pop("slug")
        else:
            other = db.scalar(select(Product).where(Product.slug == data["slug"]))
            if other and other.id != p.id:
                raise ApiError(409, "Another product already uses this URL slug.")
    for k, v in data.items():
        setattr(p, k, v)
    db.commit()
    return {"product": to_dict(p)}


@protected.delete("/products/{pid}")
def remove_product(pid: str, db: Session = Depends(get_db)):
    p = db.get(Product, pid)
    if not p:
        raise ApiError(404, "Product not found.")
    used = db.scalar(select(func.count()).select_from(Order).where(Order.items.contains([{"productId": pid}])))
    if used:
        p.active = False
        db.commit()
        return {"message": "Product appears in past orders, so it was hidden from the store instead of deleted.", "deactivated": True}
    db.delete(p)
    db.commit()
    return {"message": "Product deleted."}


# ---------------- Orders ----------------
@protected.get("/orders")
def admin_orders(q: str = "", status: str = "", customerId: str = "", db: Session = Depends(get_db)):
    stmt = select(Order)
    if status:
        stmt = stmt.where(Order.status == status)
    if customerId:
        stmt = stmt.where(Order.customer_id == customerId)
    if q:
        like = f"%{q}%"
        stmt = stmt.where(or_(
            Order.order_number.ilike(like),
            Order.customer["name"].astext.ilike(like),
            Order.customer["phone"].astext.ilike(like),
            Order.customer["customerCode"].astext.ilike(like),
        ))
    orders = db.scalars(stmt.order_by(Order.created_at.desc())).all()
    return {"orders": [to_dict(o) for o in orders], "statuses": ORDER_STATUSES}


@protected.get("/orders/{oid}")
def admin_order(oid: str, db: Session = Depends(get_db)):
    o = db.get(Order, oid)
    if not o:
        raise ApiError(404, "Order not found.")
    return {"order": to_dict(o), "statuses": ORDER_STATUSES}


class OrderUpdateIn(BaseModel):
    status: str | None = None
    note: str = ""
    paymentStatus: str | None = None
    trackingNumber: str | None = None
    adminNotes: str | None = None


@protected.put("/orders/{oid}")
def update_order(oid: str, body: OrderUpdateIn, admin: Admin = Depends(current_admin), db: Session = Depends(get_db)):
    o = db.scalar(select(Order).where(Order.id == oid).with_for_update())
    if not o:
        raise ApiError(404, "Order not found.")
    if body.status and body.status != o.status:
        if body.status not in ORDER_STATUSES:
            raise ApiError(400, "Invalid status.")
        if o.status == "Cancelled":
            raise ApiError(400, "A cancelled order cannot be reopened.")
        if body.status == "Cancelled":
            for i in o.items:  # return stock
                db.execute(update(Product).where(Product.id == i["productId"]).values(stock=Product.stock + i["qty"]))
        if body.status == "Delivered" and o.payment_method == "Cash on Delivery":
            o.payment_status = "Paid"
        o.status = body.status
        o.history = [*o.history, {"status": body.status, "at": datetime.now(timezone.utc).isoformat(), "note": clip(body.note, 300), "by": admin.email}]
    if body.paymentStatus:
        o.payment_status = clip(body.paymentStatus, 30)
    if body.trackingNumber is not None:
        o.tracking_number = clip(body.trackingNumber, 80)
    if body.adminNotes is not None:
        o.admin_notes = clip(body.adminNotes, 1000)
    db.commit()
    return {"order": to_dict(o)}


# ---------------- Contact messages ----------------
@protected.get("/messages")
def messages(db: Session = Depends(get_db)):
    return {"messages": [to_dict(m) for m in db.scalars(select(ContactMessage).order_by(ContactMessage.created_at.desc()))]}


class ReadIn(BaseModel):
    read: bool = True


@protected.put("/messages/{mid}")
def mark_message(mid: str, body: ReadIn, db: Session = Depends(get_db)):
    m = db.get(ContactMessage, mid)
    if m:
        m.read = body.read
        db.commit()
    return {"ok": True}


@protected.delete("/messages/{mid}")
def delete_message(mid: str, db: Session = Depends(get_db)):
    m = db.get(ContactMessage, mid)
    if m:
        db.delete(m)
        db.commit()
    return {"ok": True}
