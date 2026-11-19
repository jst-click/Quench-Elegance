import re
import secrets
from datetime import datetime, timedelta, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, File, UploadFile
from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel
from sqlalchemy import func, or_, select, update
from sqlalchemy.orm import Session

from ..config import PRODUCT_UPLOAD_DIR, settings
from ..combos import expand, products_for
from ..consultation import FORM, clean_consultant, referral_flags, summary
from ..orders import INVOICE_DEFAULTS, PAYMENT_METHODS, PAYMENT_STATUSES, build_order, invoice_settings, shipping_for
from ..database import get_db
from ..models import Admin, Category, Combo, ContactMessage, Conversation, Customer, Order, Product, RegistrationRequest, StoreSetting, customer_code_seq
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
    unread_chats = db.scalar(select(func.count()).select_from(Conversation).where(Conversation.unread_admin > 0))

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
            s = sales.setdefault(i.get("productId") or i.get("comboId"), {"name": i["name"], "qty": 0, "revenue": 0})
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
            "unreadChats": unread_chats,
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


def create_customer(db: Session, *, name, phone, email="", customer_code="", notes="", consultation=None) -> Customer:
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
    c = Customer(customer_code=code, name=clip(name, 80), phone=p, email=clip(email, 120), notes=clip(notes, 500), addresses=[], active=True, consultation=consultation)
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
    return {"customers": [
        {**to_dict(c, exclude={"consultation"}), "consultation": summary(c.consultation), **stats.get(c.id, {"orders": 0, "spent": 0})}
        for c in customers
    ]}


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
    return {"customer": to_dict(c), "orders": [to_dict(o) for o in orders], "flags": referral_flags(c.consultation)}


class ConsultantIn(BaseModel):
    consultant: dict = {}


@protected.put("/customers/{cid}/consultation")
def save_consultation(cid: str, body: ConsultantIn, admin: Admin = Depends(current_admin), db: Session = Depends(get_db)):
    """Saves the consultant-only sections (details, assessment, recommendation, follow-up)."""
    c = db.get(Customer, cid)
    if not c:
        raise ApiError(404, "Customer not found.")
    # assign a new dict so SQLAlchemy notices the JSONB change
    c.consultation = {
        **(c.consultation or {}),
        "consultant": clean_consultant(body.consultant),
        "consultantUpdatedAt": datetime.now(timezone.utc).isoformat(),
        "consultantUpdatedBy": admin.email,
    }
    db.commit()
    return {"customer": to_dict(c)}


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
    return {"requests": [
        {**to_dict(r, exclude={"consultation"}), "consultation": summary(r.consultation)}
        for r in db.scalars(stmt.order_by(RegistrationRequest.created_at.desc()))
    ]}


@protected.get("/registration-requests/{rid}")
def get_request(rid: str, db: Session = Depends(get_db)):
    r = db.get(RegistrationRequest, rid)
    if not r:
        raise ApiError(404, "Request not found.")
    return {"request": to_dict(r), "flags": referral_flags(r.consultation)}


@protected.get("/consultation-form")
def consultation_form():
    return {"sections": FORM}


class ApproveIn(BaseModel):
    name: str | None = None
    email: str | None = None
    customerCode: str | None = None
    consultant: dict | None = None  # consultant sections filled while reviewing the request


@protected.post("/registration-requests/{rid}/approve")
def approve_request(rid: str, body: ApproveIn, admin: Admin = Depends(current_admin), db: Session = Depends(get_db)):
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
        consultation={
            **(r.consultation or {}),
            "consultant": clean_consultant(body.consultant or {}),
            "approvedAt": datetime.now(timezone.utc).isoformat(),
            "approvedBy": admin.email,
        } if r.consultation else None,
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
    subcategory: str | None = None
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
    for k in ("name", "subtitle", "category", "subcategory", "size", "image", "tagline", "highlight", "signature", "closing_title"):
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
    used = db.scalar(select(func.count()).select_from(Order).where(or_(
        Order.items.contains([{"productId": pid}]), Order.items.contains([{"components": [{"productId": pid}]}]))))
    in_combo = db.scalars(select(Combo.name).where(Combo.items.contains([{"productId": pid}]))).all()
    if in_combo:
        raise ApiError(409, f"This product is part of the combo{'s' if len(in_combo) > 1 else ''} {', '.join(in_combo)}. Remove it from the combo first, or hide the product instead.")
    if used:
        p.active = False
        db.commit()
        return {"message": "Product appears in past orders, so it was hidden from the store instead of deleted.", "deactivated": True}
    db.delete(p)
    db.commit()
    return {"message": "Product deleted."}


# ---------------- Categories ----------------
class CategoryIn(BaseModel):
    name: str | None = None
    parentId: str | None = None
    description: str | None = None
    sortOrder: int | None = None
    active: bool | None = None


def category_tree(db: Session) -> list[dict]:
    cats = db.scalars(select(Category).order_by(Category.sort_order, Category.name)).all()
    main_counts = dict(db.execute(select(Product.category, func.count()).group_by(Product.category)).all())
    sub_counts = {(c, s): n for c, s, n in db.execute(select(Product.category, Product.subcategory, func.count()).group_by(Product.category, Product.subcategory))}
    out = []
    for m in (c for c in cats if not c.parent_id):
        subs = [
            {**to_dict(s), "products": sub_counts.get((m.name, s.name), 0)}
            for s in cats if s.parent_id == m.id
        ]
        out.append({**to_dict(m), "products": main_counts.get(m.name, 0), "subcategories": subs})
    return out


def check_name(db: Session, name: str, parent_id: str | None, exclude_id: str | None = None) -> str:
    name = clip(name, 80)
    if not name:
        raise ApiError(400, "Category name is required.")
    clash = db.scalar(select(Category).where(
        func.lower(Category.name) == name.lower(),
        Category.parent_id.is_(None) if parent_id is None else Category.parent_id == parent_id,
    ))
    if clash and clash.id != exclude_id:
        raise ApiError(409, f"“{name}” already exists here.")
    return name


@protected.get("/categories")
def list_categories(db: Session = Depends(get_db)):
    return {"categories": category_tree(db)}


@protected.post("/categories", status_code=201)
def create_category(body: CategoryIn, db: Session = Depends(get_db)):
    parent = None
    if body.parentId:
        parent = db.get(Category, body.parentId)
        if not parent or parent.parent_id:
            raise ApiError(400, "Subcategories can only be added under a main category.")
    name = check_name(db, body.name or "", parent.id if parent else None)
    siblings = db.scalar(select(func.count()).select_from(Category).where(
        Category.parent_id.is_(None) if parent is None else Category.parent_id == parent.id))
    c = Category(
        name=name, slug=slugify(name), parent_id=parent.id if parent else None, description=clip(body.description, 300),
        sort_order=body.sortOrder if body.sortOrder is not None else (siblings or 0) + 1,
        active=body.active if body.active is not None else True,
    )
    db.add(c)
    db.commit()
    return {"category": to_dict(c), "categories": category_tree(db)}


@protected.put("/categories/{cat_id}")
def edit_category(cat_id: str, body: CategoryIn, db: Session = Depends(get_db)):
    c = db.get(Category, cat_id)
    if not c:
        raise ApiError(404, "Category not found.")
    if body.name is not None:
        name = check_name(db, body.name, c.parent_id, exclude_id=c.id)
        if name != c.name:  # keep products pointing at the renamed category
            if c.parent_id:
                parent = db.get(Category, c.parent_id)
                db.execute(update(Product).where(Product.category == parent.name, Product.subcategory == c.name).values(subcategory=name))
            else:
                db.execute(update(Product).where(Product.category == c.name).values(category=name))
            c.name, c.slug = name, slugify(name)
    if body.description is not None:
        c.description = clip(body.description, 300)
    if body.sortOrder is not None:
        c.sort_order = max(0, body.sortOrder)
    if body.active is not None:
        c.active = body.active
    db.commit()
    return {"category": to_dict(c), "categories": category_tree(db)}


@protected.delete("/categories/{cat_id}")
def delete_category(cat_id: str, db: Session = Depends(get_db)):
    c = db.get(Category, cat_id)
    if not c:
        raise ApiError(404, "Category not found.")
    if c.parent_id:
        parent = db.get(Category, c.parent_id)
        used = db.scalar(select(func.count()).select_from(Product).where(Product.category == parent.name, Product.subcategory == c.name))
    else:
        used = db.scalar(select(func.count()).select_from(Product).where(Product.category == c.name))
        if db.scalar(select(func.count()).select_from(Category).where(Category.parent_id == c.id)):
            raise ApiError(409, "Delete or move this category's subcategories first.")
    if used:
        raise ApiError(409, f"{used} product{'s use' if used > 1 else ' uses'} this category. Move {'them' if used > 1 else 'it'} to another category first.")
    db.delete(c)
    db.commit()
    return {"message": "Category deleted.", "categories": category_tree(db)}


# ---------------- Combos ----------------
class ComboItemIn(BaseModel):
    productId: str
    qty: int = 1


class ComboStepIn(BaseModel):
    title: str = ""
    text: str = ""
    productId: str = ""  # a product in the kit this step uses (optional)
    description: str = ""  # how to use


class ComboIn(BaseModel):
    name: str | None = None
    slug: str | None = None
    tagline: str | None = None
    description: str | None = None
    banner: str | None = None
    image: str | None = None
    items: list[ComboItemIn] | None = None
    mrp: float | None = None
    price: float | None = None
    ritualTitle: str | None = None
    steps: list[ComboStepIn] | None = None
    experienceTitle: str | None = None
    highlights: list[str] | None = None
    closing: str | None = None
    sortOrder: float | None = None
    featured: bool | None = None
    active: bool | None = None


def apply_combo(c: Combo, body: ComboIn, db: Session) -> None:
    for attr, key, n in (("name", "name", 120), ("tagline", "tagline", 200), ("banner", "banner", 300), ("image", "image", 300),
                         ("ritual_title", "ritualTitle", 120), ("experience_title", "experienceTitle", 120), ("closing", "closing", 300)):
        v = getattr(body, key)
        if v is not None:
            setattr(c, attr, clip(v, n))
    if body.description is not None:
        c.description = clip(body.description, 2000)
    for attr, key in (("mrp", "mrp"), ("price", "price"), ("sort_order", "sortOrder")):
        v = getattr(body, key)
        if v is not None:
            setattr(c, attr, max(0, int(v)))
    if body.featured is not None:
        c.featured = body.featured
    if body.active is not None:
        c.active = body.active
    if body.items is not None:
        merged: dict[str, int] = {}
        for it in body.items:
            merged[it.productId] = min(50, merged.get(it.productId, 0) + max(1, it.qty))
        found = set(db.scalars(select(Product.id).where(Product.id.in_(merged.keys())))) if merged else set()
        if found != set(merged):
            raise ApiError(400, "One of the selected products no longer exists.")
        c.items = [{"productId": pid, "qty": q} for pid, q in merged.items()]
    if body.steps is not None:
        in_kit = {i["productId"] for i in c.items or []}
        c.steps = [
            {"title": clip(s.title, 120), "text": clip(s.text, 300), "productId": s.productId if s.productId in in_kit else "",
             "description": clip(s.description, 1500)}
            for s in body.steps if s.title.strip()
        ][:10]
    if body.highlights is not None:
        c.highlights = [clip(h, 200) for h in body.highlights if h.strip()][:12]
    if body.slug is not None and slugify(body.slug):
        slug = slugify(body.slug)
        other = db.scalar(select(Combo).where(Combo.slug == slug))
        if other and other.id != c.id:
            raise ApiError(409, "Another combo already uses this URL.")
        c.slug = slug
    if not c.name:
        raise ApiError(400, "Combo name is required.")
    if not c.items:
        raise ApiError(400, "Add at least one product to the combo.")
    if not c.price:
        raise ApiError(400, "Offer price is required.")


@protected.get("/combos")
def admin_combos(db: Session = Depends(get_db)):
    combos = db.scalars(select(Combo).order_by(Combo.sort_order, Combo.created_at)).all()
    products = products_for(db, combos)
    return {"combos": [expand(c, products) for c in combos]}


@protected.get("/combos/{cid}")
def admin_combo(cid: str, db: Session = Depends(get_db)):
    c = db.get(Combo, cid)
    if not c:
        raise ApiError(404, "Combo not found.")
    return {"combo": expand(c, products_for(db, [c]))}


@protected.post("/combos", status_code=201)
def create_combo(body: ComboIn, db: Session = Depends(get_db)):
    c = Combo(name="", slug="", items=[], steps=[], highlights=[], mrp=0, price=0, sort_order=99, featured=True, active=True)
    apply_combo(c, body, db)
    if not c.slug:
        c.slug = slugify(c.name)
        if db.scalar(select(Combo).where(Combo.slug == c.slug)):
            c.slug = f"{c.slug}-{secrets.token_hex(2)}"
    db.add(c)
    db.commit()
    return {"combo": expand(c, products_for(db, [c]))}


@protected.put("/combos/{cid}")
def edit_combo(cid: str, body: ComboIn, db: Session = Depends(get_db)):
    c = db.get(Combo, cid)
    if not c:
        raise ApiError(404, "Combo not found.")
    apply_combo(c, body, db)
    db.commit()
    return {"combo": expand(c, products_for(db, [c]))}


@protected.delete("/combos/{cid}")
def delete_combo(cid: str, db: Session = Depends(get_db)):
    c = db.get(Combo, cid)
    if not c:
        raise ApiError(404, "Combo not found.")
    if db.scalar(select(func.count()).select_from(Order).where(Order.items.contains([{"comboId": cid}]))):
        c.active = False
        db.commit()
        return {"message": "This combo appears in past orders, so it was hidden from the website instead of deleted.", "deactivated": True}
    db.delete(c)
    db.commit()
    return {"message": "Combo deleted."}


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


class AdminOrderItem(BaseModel):
    productId: str | None = None
    comboId: str | None = None
    qty: int = 1
    price: float | None = None  # unit price override; None = current selling price


class AdminAddressIn(BaseModel):
    name: str = ""
    phone: str = ""
    line1: str = ""
    line2: str = ""
    city: str = ""
    state: str = ""
    pincode: str = ""


class AdminOrderIn(BaseModel):
    customerId: str
    items: list[AdminOrderItem] = []
    address: AdminAddressIn = AdminAddressIn()
    saveAddress: bool = False
    notes: str = ""  # visible to the customer
    adminNotes: str = ""
    status: str = "Confirmed"
    statusNote: str = ""
    paymentMethod: str = "Cash on Delivery"
    paymentStatus: str = "Pending"
    trackingNumber: str = ""
    discount: float = 0
    shipping: float | None = None  # None = store shipping rules


@protected.get("/order-options")
def order_options(db: Session = Depends(get_db)):
    """Everything the Create order screen needs to pick from."""
    products = db.scalars(select(Product).order_by(Product.sort_order, Product.created_at)).all()
    combos = db.scalars(select(Combo).order_by(Combo.sort_order, Combo.created_at)).all()
    cp = products_for(db, combos)
    return {
        "products": [{"id": p.id, "name": p.name, "size": p.size, "image": p.image, "price": p.price, "mrp": p.mrp, "stock": p.stock, "active": p.active} for p in products],
        "combos": [{k: e[k] for k in ("id", "name", "tagline", "image", "price", "mrp", "available", "active", "unitCount")} | {"items": [{"name": i["name"], "qty": i["qty"]} for i in e["items"]]}
                   for e in (expand(c, cp) for c in combos)],
        "statuses": [s for s in ORDER_STATUSES if s != "Cancelled"],
        "paymentMethods": PAYMENT_METHODS,
        "paymentStatuses": PAYMENT_STATUSES,
        "shippingFlat": settings.shipping_flat,
        "freeShippingAbove": settings.free_shipping_above,
    }


@protected.post("/orders", status_code=201)
def admin_create_order(body: AdminOrderIn, admin: Admin = Depends(current_admin), db: Session = Depends(get_db)):
    """Create an order on a customer's behalf (phone / WhatsApp / in-store sales). It appears in their account."""
    from .auth import address_error, clean_address

    customer = db.get(Customer, body.customerId)
    if not customer:
        raise ApiError(404, "Customer not found.")
    if body.status not in ORDER_STATUSES or body.status == "Cancelled":
        raise ApiError(400, "Choose a valid order status.")
    address = clean_address(body.address.model_dump())
    err = address_error(address)
    if err:
        raise ApiError(400, f"Delivery address: {err}")

    order = build_order(
        db, customer, [i.model_dump() for i in body.items], address,
        notes=body.notes, source="admin", created_by=admin.email, allow_hidden=True, allow_price_override=True,
        discount=int(body.discount or 0), shipping=None if body.shipping is None else int(body.shipping),
        payment_method=body.paymentMethod, payment_status=body.paymentStatus,
        status=body.status, status_note=body.statusNote, tracking_number=body.trackingNumber, admin_notes=body.adminNotes,
        max_qty=99,
    )
    if body.saveAddress:
        saved = customer.addresses or []
        if not any(a.get("line1") == address["line1"] and a.get("pincode") == address["pincode"] for a in saved):
            customer.addresses = [*saved, {"id": secrets.token_hex(16), **address}][-5:]
    db.commit()
    return {"order": to_dict(order)}


# ---------------- Invoices ----------------
@protected.get("/invoices")
def list_invoices(q: str = "", db: Session = Depends(get_db)):
    stmt = select(Order).where(Order.invoice_number.is_not(None))
    if q:
        like = f"%{q}%"
        stmt = stmt.where(or_(
            Order.invoice_number.ilike(like), Order.order_number.ilike(like),
            Order.customer["name"].astext.ilike(like), Order.customer["phone"].astext.ilike(like),
            Order.customer["customerCode"].astext.ilike(like),
        ))
    orders = db.scalars(stmt.order_by(Order.invoice_date.desc(), Order.created_at.desc())).all()
    return {"invoices": [{
        "orderId": o.id, "invoiceNumber": o.invoice_number, "invoiceDate": o.invoice_date.isoformat() if o.invoice_date else None,
        "orderNumber": o.order_number, "customer": o.customer, "customerId": o.customer_id,
        "items": sum(i["qty"] for i in o.items), "total": o.total, "status": o.status,
        "paymentStatus": o.payment_status, "paymentMethod": o.payment_method, "source": o.source,
    } for o in orders]}


@protected.get("/invoices/{oid}")
def get_invoice(oid: str, db: Session = Depends(get_db)):
    o = db.get(Order, oid)
    if not o or not o.invoice_number:
        raise ApiError(404, "Invoice not found.")
    return {"order": to_dict(o), "settings": invoice_settings(db)}


@protected.get("/invoice-settings")
def get_invoice_settings(db: Session = Depends(get_db)):
    return {"settings": invoice_settings(db)}


@protected.put("/invoice-settings")
def save_invoice_settings(body: dict, db: Session = Depends(get_db)):
    clean = {}
    for k, default in INVOICE_DEFAULTS.items():
        if k not in body:
            continue
        v = body[k]
        if k == "gstRate":
            try:
                clean[k] = max(0.0, min(28.0, float(v or 0)))
            except (TypeError, ValueError):
                raise ApiError(400, "GST rate must be a number.")
        elif k == "defaultTemplate":
            clean[k] = v if v in ("classic", "modern", "compact") else "classic"
        else:
            clean[k] = clip(v, 1000 if k == "terms" else 200)
    if "gstin" in clean and clean["gstin"]:
        clean["gstin"] = re.sub(r"\s", "", clean["gstin"]).upper()[:15]
    row = db.get(StoreSetting, "invoice")
    if row:
        row.value = {**row.value, **clean}
    else:
        db.add(StoreSetting(key="invoice", value=clean))
    db.commit()
    return {"settings": invoice_settings(db)}


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
            for i in o.items:  # return stock (a kit returns each of its products)
                parts = [(c["productId"], c["qty"] * i["qty"]) for c in i.get("components", [])] if i.get("comboId") else [(i["productId"], i["qty"])]
                for pid_, units in parts:
                    db.execute(update(Product).where(Product.id == pid_).values(stock=Product.stock + units))
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
