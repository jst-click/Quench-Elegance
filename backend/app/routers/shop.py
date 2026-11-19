import uuid
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import settings
from ..database import get_db
from ..combos import expand, products_for
from ..orders import build_order, shipping_for
from ..models import Category, Combo, ContactMessage, Customer, Order, Product
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
def list_products(category: str | None = None, subcategory: str | None = None, featured: bool | None = None, q: str | None = None, db: Session = Depends(get_db)):
    stmt = select(Product).where(Product.active.is_(True))
    if category:
        stmt = stmt.where(Product.category == category)
    if subcategory:
        stmt = stmt.where(Product.subcategory == subcategory)
    if featured:
        stmt = stmt.where(Product.featured.is_(True))
    if q:
        stmt = stmt.where(Product.name.ilike(f"%{q}%"))
    products = db.scalars(stmt.order_by(Product.sort_order, Product.created_at)).all()
    return {"products": [public_product(p) for p in products]}


@router.get("/combos")
def list_combos(featured: bool | None = None, db: Session = Depends(get_db)):
    stmt = select(Combo).where(Combo.active.is_(True))
    if featured:
        stmt = stmt.where(Combo.featured.is_(True))
    combos = db.scalars(stmt.order_by(Combo.sort_order, Combo.created_at)).all()
    products = products_for(db, combos)
    return {"combos": [expand(c, products, public=True) for c in combos]}


@router.get("/combos/{slug}")
def get_combo(slug: str, db: Session = Depends(get_db)):
    c = db.scalar(select(Combo).where(Combo.slug == slug, Combo.active.is_(True)))
    if not c:
        raise ApiError(404, "Combo not found.")
    return {"combo": expand(c, products_for(db, [c]), public=True)}


@router.get("/categories")
def list_categories(db: Session = Depends(get_db)):
    """Active main categories with their active subcategories, in admin-defined order."""
    cats = db.scalars(select(Category).where(Category.active.is_(True)).order_by(Category.sort_order, Category.name)).all()
    return {"categories": [
        {"id": m.id, "name": m.name, "slug": m.slug, "description": m.description,
         "subcategories": [{"id": s.id, "name": s.name, "slug": s.slug} for s in cats if s.parent_id == m.id]}
        for m in cats if not m.parent_id
    ]}


@router.get("/products/{slug}")
def get_product(slug: str, db: Session = Depends(get_db)):
    p = db.scalar(select(Product).where(Product.slug == slug, Product.active.is_(True)))
    if not p:
        raise ApiError(404, "Product not found.")
    return {"product": public_product(p)}


@router.get("/store-config")
def store_config():
    return {"shippingFlat": settings.shipping_flat, "freeShippingAbove": settings.free_shipping_above}


# ---------------- Orders (registered customers only) ----------------
class CartItem(BaseModel):
    productId: str | None = None
    comboId: str | None = None  # a combo kit line
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

    order = build_order(db, customer, [i.model_dump() for i in body.items], address, notes=body.notes, source="website")

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
