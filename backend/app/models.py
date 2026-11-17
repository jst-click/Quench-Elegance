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


class Product(TimestampMixin, Base):
    __tablename__ = "products"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    slug: Mapped[str] = mapped_column(String(160), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(160))
    subtitle: Mapped[str] = mapped_column(String(300), default="")
    category: Mapped[str] = mapped_column(String(80), default="Hair Care", index=True)
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


class ContactMessage(TimestampMixin, Base):
    __tablename__ = "messages"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    name: Mapped[str] = mapped_column(String(80))
    phone: Mapped[str] = mapped_column(String(20), default="")
    email: Mapped[str] = mapped_column(String(120), default="")
    subject: Mapped[str] = mapped_column(String(120), default="")
    message: Mapped[str] = mapped_column(Text)
    read: Mapped[bool] = mapped_column(Boolean, default=False)
