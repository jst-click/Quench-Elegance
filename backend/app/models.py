import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Sequence, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from .database import Base


def now() -> datetime:
    return datetime.now(timezone.utc)


def new_id() -> str:
    return uuid.uuid4().hex


# Sequences give gap-safe, concurrency-safe human-readable numbers
order_number_seq = Sequence("order_number_seq", start=10001, metadata=Base.metadata)
customer_code_seq = Sequence("customer_code_seq", start=1001, metadata=Base.metadata)
invoice_number_seq = Sequence("invoice_number_seq", start=1, metadata=Base.metadata)


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, onupdate=now)


class Admin(TimestampMixin, Base):
    __tablename__ = "admins"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    email: Mapped[str] = mapped_column(String(160), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(80))
    password_hash: Mapped[str] = mapped_column(String(100))


class Customer(TimestampMixin, Base):
    __tablename__ = "customers"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    customer_code: Mapped[str] = mapped_column(String(30), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(80))
    phone: Mapped[str] = mapped_column(String(10), unique=True, index=True)
    email: Mapped[str] = mapped_column(String(120), default="")
    notes: Mapped[str] = mapped_column(Text, default="")
    addresses: Mapped[list] = mapped_column(JSONB, default=list)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # hair & scalp consultation: {answers, skipped, submittedAt, consultant} — see app/consultation.py
    consultation: Mapped[dict | None] = mapped_column(JSONB, nullable=True)


class Product(TimestampMixin, Base):
    __tablename__ = "products"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    slug: Mapped[str] = mapped_column(String(160), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(160))
    subtitle: Mapped[str] = mapped_column(String(300), default="")
    category: Mapped[str] = mapped_column(String(80), default="Hair Care", index=True)
    subcategory: Mapped[str] = mapped_column(String(80), default="", index=True)
    size: Mapped[str] = mapped_column(String(40), default="")
    mrp: Mapped[int] = mapped_column(Integer, default=0)
    price: Mapped[int] = mapped_column(Integer, default=0)
    stock: Mapped[int] = mapped_column(Integer, default=0)
    sort_order: Mapped[int] = mapped_column(Integer, default=99)
    featured: Mapped[bool] = mapped_column(Boolean, default=False)
    active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    image: Mapped[str] = mapped_column(String(300), default="")
    gallery: Mapped[list] = mapped_column(JSONB, default=list)
    tagline: Mapped[str] = mapped_column(String(300), default="")
    highlight: Mapped[str] = mapped_column(String(160), default="")
    short_description: Mapped[str] = mapped_column(Text, default="")
    intro: Mapped[str] = mapped_column(Text, default="")
    benefits: Mapped[list] = mapped_column(JSONB, default=list)
    ingredients: Mapped[list] = mapped_column(JSONB, default=list)
    tags: Mapped[list] = mapped_column(JSONB, default=list)
    closing_title: Mapped[str] = mapped_column(String(300), default="")
    closing_body: Mapped[str] = mapped_column(Text, default="")
    signature: Mapped[str] = mapped_column(String(300), default="")


class Combo(TimestampMixin, Base):
    """A kit of catalogue products sold at one offer price (see app/combos.py)."""
    __tablename__ = "combos"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    slug: Mapped[str] = mapped_column(String(160), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(120))
    tagline: Mapped[str] = mapped_column(String(200), default="")
    description: Mapped[str] = mapped_column(Text, default="")
    banner: Mapped[str] = mapped_column(String(300), default="")  # wide poster used on the combo page
    image: Mapped[str] = mapped_column(String(300), default="")  # card / cart image
    items: Mapped[list] = mapped_column(JSONB, default=list)  # [{productId, qty}]
    mrp: Mapped[int] = mapped_column(Integer, default=0)  # 0 = sum of the products' MRPs
    price: Mapped[int] = mapped_column(Integer, default=0)
    ritual_title: Mapped[str] = mapped_column(String(120), default="")
    steps: Mapped[list] = mapped_column(JSONB, default=list)  # [{title, text}]
    experience_title: Mapped[str] = mapped_column(String(120), default="")
    highlights: Mapped[list] = mapped_column(JSONB, default=list)  # [str]
    closing: Mapped[str] = mapped_column(String(300), default="")
    sort_order: Mapped[int] = mapped_column(Integer, default=99)
    featured: Mapped[bool] = mapped_column(Boolean, default=True)
    active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)


class Category(TimestampMixin, Base):
    """Main categories (parent_id is NULL) and their subcategories.
    Products store the category / subcategory *names* (Product.category, Product.subcategory);
    renaming a category here updates those products."""
    __tablename__ = "categories"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    parent_id: Mapped[str | None] = mapped_column(ForeignKey("categories.id", ondelete="CASCADE"), nullable=True, index=True)
    name: Mapped[str] = mapped_column(String(80))
    slug: Mapped[str] = mapped_column(String(100), index=True)
    description: Mapped[str] = mapped_column(String(300), default="")
    sort_order: Mapped[int] = mapped_column(Integer, default=99)
    active: Mapped[bool] = mapped_column(Boolean, default=True)


class Order(TimestampMixin, Base):
    __tablename__ = "orders"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    order_number: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    customer_id: Mapped[str] = mapped_column(ForeignKey("customers.id", ondelete="RESTRICT"), index=True)
    customer: Mapped[dict] = mapped_column(JSONB)  # snapshot at order time
    items: Mapped[list] = mapped_column(JSONB)
    subtotal: Mapped[int] = mapped_column(Integer)
    shipping: Mapped[int] = mapped_column(Integer, default=0)
    total: Mapped[int] = mapped_column(Integer)
    address: Mapped[dict] = mapped_column(JSONB)
    notes: Mapped[str] = mapped_column(Text, default="")
    payment_method: Mapped[str] = mapped_column(String(40), default="Cash on Delivery")
    payment_status: Mapped[str] = mapped_column(String(30), default="Pending")
    status: Mapped[str] = mapped_column(String(20), default="Placed", index=True)
    history: Mapped[list] = mapped_column(JSONB, default=list)
    tracking_number: Mapped[str] = mapped_column(String(80), default="")
    admin_notes: Mapped[str] = mapped_column(Text, default="")
    discount: Mapped[int] = mapped_column(Integer, default=0)
    source: Mapped[str] = mapped_column(String(20), default="website")  # website | admin
    created_by: Mapped[str] = mapped_column(String(160), default="")  # admin email for admin-created orders
    invoice_number: Mapped[str | None] = mapped_column(String(30), unique=True, index=True, nullable=True)
    invoice_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class StoreSetting(Base):
    """Small key/value store for admin-editable settings (e.g. "invoice" business details)."""
    __tablename__ = "store_settings"
    key: Mapped[str] = mapped_column(String(60), primary_key=True)
    value: Mapped[dict] = mapped_column(JSONB, default=dict)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, onupdate=now)


class Otp(Base):
    __tablename__ = "otps"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    phone: Mapped[str] = mapped_column(String(10), index=True)
    otp_hash: Mapped[str] = mapped_column(String(100))
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class RegistrationRequest(TimestampMixin, Base):
    __tablename__ = "registration_requests"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    name: Mapped[str] = mapped_column(String(80))
    phone: Mapped[str] = mapped_column(String(10), index=True)
    email: Mapped[str] = mapped_column(String(120), default="")
    city: Mapped[str] = mapped_column(String(80), default="")
    message: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(20), default="pending", index=True)
    customer_id: Mapped[str | None] = mapped_column(String(32), nullable=True)
    consultation: Mapped[dict | None] = mapped_column(JSONB, nullable=True)  # submitted with the registration


class ContactMessage(TimestampMixin, Base):
    __tablename__ = "messages"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    name: Mapped[str] = mapped_column(String(80))
    phone: Mapped[str] = mapped_column(String(20), default="")
    email: Mapped[str] = mapped_column(String(120), default="")
    subject: Mapped[str] = mapped_column(String(120), default="")
    message: Mapped[str] = mapped_column(Text)
    read: Mapped[bool] = mapped_column(Boolean, default=False)


class Conversation(TimestampMixin, Base):
    """One chat thread per customer, shared between the customer and the admin team."""
    __tablename__ = "conversations"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    customer_id: Mapped[str] = mapped_column(ForeignKey("customers.id", ondelete="CASCADE"), unique=True, index=True)
    last_message_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, index=True)
    last_message_preview: Mapped[str] = mapped_column(String(200), default="")
    last_sender: Mapped[str] = mapped_column(String(10), default="")
    unread_admin: Mapped[int] = mapped_column(Integer, default=0)  # customer messages the admin hasn't opened
    unread_customer: Mapped[int] = mapped_column(Integer, default=0)  # admin replies the customer hasn't opened


class ChatMessage(Base):
    __tablename__ = "chat_messages"
    # integer id so clients can poll with ?after=<last id>
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    conversation_id: Mapped[str] = mapped_column(ForeignKey("conversations.id", ondelete="CASCADE"), index=True)
    sender: Mapped[str] = mapped_column(String(10))  # customer | admin
    sender_name: Mapped[str] = mapped_column(String(80), default="")
    kind: Mapped[str] = mapped_column(String(10), default="text")  # text | image | video | audio | product
    text: Mapped[str] = mapped_column(Text, default="")
    media_url: Mapped[str] = mapped_column(String(300), default="")
    media_name: Mapped[str] = mapped_column(String(200), default="")
    product: Mapped[dict | None] = mapped_column(JSONB, nullable=True)  # snapshot for product enquiries
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, index=True)
