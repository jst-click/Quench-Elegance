"""Customer ↔ admin chat.

Every customer has one conversation. Customers reach it from their account page (or the
"Buy now" button on a product, which attaches a product enquiry card). Admins see every
conversation under Admin → Chats. Clients poll GET .../messages?after=<last id> for new messages.
"""
import mimetypes
import secrets
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, Form, UploadFile
from pydantic import BaseModel
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from ..config import CHAT_UPLOAD_DIR
from ..database import get_db
from ..combos import expand, kit_label, products_for
from ..models import Admin, ChatMessage, Combo, Conversation, Customer, Order, Product
from ..security import current_admin, current_customer
from ..utils import ApiError, clip, iso, to_dict

router = APIRouter(prefix="/api/chat", tags=["chat"])
admin_router = APIRouter(prefix="/api/admin/chats", tags=["admin chat"], dependencies=[Depends(current_admin)])

MAX_TEXT = 4000
PAGE = 200  # messages returned per request

# content type -> (kind, extension, max bytes)
MEDIA_TYPES: dict[str, tuple[str, str, int]] = {
    "image/jpeg": ("image", ".jpg", 10 * 1024 * 1024),
    "image/png": ("image", ".png", 10 * 1024 * 1024),
    "image/webp": ("image", ".webp", 10 * 1024 * 1024),
    "image/gif": ("image", ".gif", 10 * 1024 * 1024),
    "video/mp4": ("video", ".mp4", 50 * 1024 * 1024),
    "video/webm": ("video", ".webm", 50 * 1024 * 1024),
    "video/quicktime": ("video", ".mov", 50 * 1024 * 1024),
    "audio/mpeg": ("audio", ".mp3", 15 * 1024 * 1024),
    "audio/mp3": ("audio", ".mp3", 15 * 1024 * 1024),
    "audio/mp4": ("audio", ".m4a", 15 * 1024 * 1024),
    "audio/x-m4a": ("audio", ".m4a", 15 * 1024 * 1024),
    "audio/aac": ("audio", ".aac", 15 * 1024 * 1024),
    "audio/ogg": ("audio", ".ogg", 15 * 1024 * 1024),
    "audio/wav": ("audio", ".wav", 15 * 1024 * 1024),
    "audio/x-wav": ("audio", ".wav", 15 * 1024 * 1024),
    "audio/webm": ("audio", ".weba", 15 * 1024 * 1024),  # voice notes recorded in Chrome / Firefox
}
# so StaticFiles serves chat media with the right Content-Type (Windows' registry is often incomplete)
for _ctype, (_kind, _ext, _limit) in MEDIA_TYPES.items():
    if not mimetypes.guess_type(f"x{_ext}")[0]:
        mimetypes.add_type(_ctype, _ext)

PREVIEW = {"image": "📷 Photo", "video": "🎥 Video", "audio": "🎤 Voice message"}


# ---------------- helpers ----------------
def message_dict(m: ChatMessage) -> dict:
    return {
        "id": m.id,
        "sender": m.sender,
        "senderName": m.sender_name,
        "kind": m.kind,
        "text": m.text,
        "mediaUrl": m.media_url,
        "mediaName": m.media_name,
        "product": m.product,
        "createdAt": iso(m.created_at),
    }


def conversation_dict(c: Conversation | None) -> dict | None:
    if not c:
        return None
    return {
        "id": c.id,
        "customerId": c.customer_id,
        "lastMessageAt": iso(c.last_message_at),
        "lastMessagePreview": c.last_message_preview,
        "lastSender": c.last_sender,
        "unreadAdmin": c.unread_admin,
        "unreadCustomer": c.unread_customer,
    }


def get_conversation(db: Session, customer_id: str, create: bool = False) -> Conversation | None:
    conv = db.scalar(select(Conversation).where(Conversation.customer_id == customer_id))
    if not conv and create:
        conv = Conversation(customer_id=customer_id)
        db.add(conv)
        db.flush()
    return conv


def list_messages(db: Session, conv: Conversation | None, after: int) -> list[dict]:
    if not conv:
        return []
    if after > 0:
        rows = db.scalars(
            select(ChatMessage).where(ChatMessage.conversation_id == conv.id, ChatMessage.id > after).order_by(ChatMessage.id).limit(PAGE)
        ).all()
    else:  # first load: the latest PAGE messages, oldest first
        rows = list(reversed(db.scalars(
            select(ChatMessage).where(ChatMessage.conversation_id == conv.id).order_by(ChatMessage.id.desc()).limit(PAGE)
        ).all()))
    return [message_dict(m) for m in rows]


def add_message(db: Session, conv: Conversation, *, sender: str, sender_name: str, kind: str = "text", text: str = "",
                media_url: str = "", media_name: str = "", product: dict | None = None) -> ChatMessage:
    msg = ChatMessage(
        conversation_id=conv.id, sender=sender, sender_name=sender_name, kind=kind,
        text=text, media_url=media_url, media_name=media_name, product=product,
    )
    db.add(msg)
    if kind == "product" and product:
        preview = f"🛍️ Product enquiry: {product.get('name', '')}"
    elif kind in PREVIEW:
        preview = PREVIEW[kind] + (f" · {text}" if text else "")
    else:
        preview = text
    conv.last_message_at = datetime.now(timezone.utc)
    conv.last_message_preview = clip(preview.replace("\n", " "), 200)
    conv.last_sender = sender
    if sender == "customer":
        conv.unread_admin = (conv.unread_admin or 0) + 1
    else:
        conv.unread_customer = (conv.unread_customer or 0) + 1
    db.flush()
    return msg


async def save_upload(file: UploadFile) -> tuple[str, str, str]:
    """Stores an uploaded chat file. Returns (kind, public url, original name)."""
    content_type = (file.content_type or "").split(";")[0].strip().lower()
    spec = MEDIA_TYPES.get(content_type)
    if not spec:
        raise ApiError(400, "Only photos (JPG, PNG, WEBP, GIF), videos (MP4, WEBM, MOV) and audio files can be sent.")
    kind, ext, limit = spec
    CHAT_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    name = f"{int(datetime.now().timestamp() * 1000)}-{secrets.token_hex(8)}{ext}"
    path = CHAT_UPLOAD_DIR / name
    size = 0
    try:
        with path.open("wb") as out:
            while chunk := await file.read(1024 * 1024):
                size += len(chunk)
                if size > limit:
                    raise ApiError(400, f"{kind.title()} must be under {limit // (1024 * 1024)} MB.")
                out.write(chunk)
    except ApiError:
        path.unlink(missing_ok=True)
        raise
    if size == 0:
        path.unlink(missing_ok=True)
        raise ApiError(400, "The file is empty.")
    return kind, f"/uploads/chat/{name}", clip(file.filename or "", 200)


def product_snapshot(p: Product) -> dict:
    return {
        "id": p.id, "slug": p.slug, "name": p.name, "subtitle": p.subtitle, "image": p.image,
        "size": p.size or "", "price": p.price, "mrp": p.mrp, "category": p.category, "inStock": p.stock > 0,
    }


def combo_snapshot(db: Session, c: Combo) -> dict:
    """A combo kit sent as an enquiry card — same shape as a product snapshot, plus type/contents."""
    d = expand(c, products_for(db, [c]), public=True)
    return {
        "type": "combo", "id": c.id, "slug": c.slug, "name": c.name, "subtitle": c.tagline, "image": c.image or c.banner,
        "size": kit_label(d["items"]), "price": c.price, "mrp": d["mrp"], "category": "Combo kit", "inStock": d["available"] > 0,
        "components": [{"name": i["name"], "qty": i["qty"]} for i in d["items"]],
    }


class TextIn(BaseModel):
    text: str = ""
    productId: str | None = None
    comboId: str | None = None


# ---------------- Customer ----------------
@router.get("/messages")
def customer_messages(after: int = 0, customer: Customer = Depends(current_customer), db: Session = Depends(get_db)):
    conv = get_conversation(db, customer.id)
    messages = list_messages(db, conv, after)
    if conv and conv.unread_customer:
        conv.unread_customer = 0
        db.commit()
    return {"conversation": conversation_dict(conv), "messages": messages}


@router.get("/unread")
def customer_unread(customer: Customer = Depends(current_customer), db: Session = Depends(get_db)):
    conv = get_conversation(db, customer.id)
    return {"unread": conv.unread_customer if conv else 0}


@router.post("/messages", status_code=201)
def customer_send(body: TextIn, customer: Customer = Depends(current_customer), db: Session = Depends(get_db)):
    text = clip(body.text, MAX_TEXT)
    product = None
    if body.productId:
        p = db.scalar(select(Product).where(Product.id == body.productId, Product.active.is_(True)))
        if not p:
            raise ApiError(404, "This product is no longer available.")
        product = product_snapshot(p)
    elif body.comboId:
        c = db.scalar(select(Combo).where(Combo.id == body.comboId, Combo.active.is_(True)))
        if not c:
            raise ApiError(404, "This combo is no longer available.")
        product = combo_snapshot(db, c)
    if not text and not product:
        raise ApiError(400, "Type a message first.")
    conv = get_conversation(db, customer.id, create=True)
    msg = add_message(db, conv, sender="customer", sender_name=customer.name, kind="product" if product else "text", text=text, product=product)
    db.commit()
    return {"message": message_dict(msg)}


@router.post("/upload", status_code=201)
async def customer_upload(file: UploadFile = File(...), caption: str = Form(""), customer: Customer = Depends(current_customer),
                          db: Session = Depends(get_db)):
    kind, url, original = await save_upload(file)
    conv = get_conversation(db, customer.id, create=True)
    msg = add_message(db, conv, sender="customer", sender_name=customer.name, kind=kind, text=clip(caption, 500), media_url=url, media_name=original)
    db.commit()
    return {"message": message_dict(msg)}


# ---------------- Admin ----------------
def chat_customer(c: Customer) -> dict:
    return {
        "id": c.id, "name": c.name, "phone": c.phone, "email": c.email or "", "customerCode": c.customer_code,
        "active": c.active, "addresses": c.addresses or [], "createdAt": iso(c.created_at), "lastLoginAt": iso(c.last_login_at),
    }


@admin_router.get("")
def admin_chat_list(q: str = "", db: Session = Depends(get_db)):
    stmt = select(Conversation, Customer).join(Customer, Customer.id == Conversation.customer_id).where(Conversation.last_message_at.is_not(None))
    s = q.strip()
    if s:
        like = f"%{s}%"
        stmt = stmt.where(or_(Customer.name.ilike(like), Customer.phone.ilike(like), Customer.customer_code.ilike(like)))
    rows = db.execute(stmt.order_by(Conversation.last_message_at.desc()).limit(500)).all()
    return {"chats": [{**conversation_dict(conv), "customer": chat_customer(cust)} for conv, cust in rows]}


@admin_router.get("/unread")
def admin_unread(db: Session = Depends(get_db)):
    total = db.scalar(select(func.coalesce(func.sum(Conversation.unread_admin), 0)))
    chats = db.scalar(select(func.count()).select_from(Conversation).where(Conversation.unread_admin > 0))
    return {"unread": int(total or 0), "chats": int(chats or 0)}


def load_customer(db: Session, customer_id: str) -> Customer:
    c = db.get(Customer, customer_id)
    if not c:
        raise ApiError(404, "Customer not found.")
    return c


@admin_router.get("/{customer_id}/messages")
def admin_messages(customer_id: str, after: int = 0, db: Session = Depends(get_db)):
    customer = load_customer(db, customer_id)
    conv = get_conversation(db, customer.id)
    messages = list_messages(db, conv, after)
    if conv and conv.unread_admin:
        conv.unread_admin = 0
        db.commit()
    res = {"conversation": conversation_dict(conv), "messages": messages}
    if after <= 0:  # customer panel only on first load
        orders = db.scalars(select(Order).where(Order.customer_id == customer.id).order_by(Order.created_at.desc()).limit(5)).all()
        res["customer"] = chat_customer(customer)
        res["orders"] = [to_dict(o) for o in orders]
        res["orderCount"] = db.scalar(select(func.count()).select_from(Order).where(Order.customer_id == customer.id))
    return res


@admin_router.post("/{customer_id}/messages", status_code=201)
def admin_send(customer_id: str, body: TextIn, admin: Admin = Depends(current_admin), db: Session = Depends(get_db)):
    customer = load_customer(db, customer_id)
    text = clip(body.text, MAX_TEXT)
    product = None
    if body.productId:  # admins can recommend a product too
        p = db.get(Product, body.productId)
        if not p:
            raise ApiError(404, "Product not found.")
        product = product_snapshot(p)
    if not text and not product:
        raise ApiError(400, "Type a message first.")
    conv = get_conversation(db, customer.id, create=True)
    msg = add_message(db, conv, sender="admin", sender_name=admin.name, kind="product" if product else "text", text=text, product=product)
    db.commit()
    return {"message": message_dict(msg)}


@admin_router.post("/{customer_id}/upload", status_code=201)
async def admin_upload(customer_id: str, file: UploadFile = File(...), caption: str = Form(""), admin: Admin = Depends(current_admin),
                       db: Session = Depends(get_db)):
    customer = load_customer(db, customer_id)
    kind, url, original = await save_upload(file)
    conv = get_conversation(db, customer.id, create=True)
    msg = add_message(db, conv, sender="admin", sender_name=admin.name, kind=kind, text=clip(caption, 500), media_url=url, media_name=original)
    db.commit()
    return {"message": message_dict(msg)}
