"""Creates tables, the first admin and the initial catalogue. Safe to run repeatedly.

    python -m app.seed            # create missing data
    python -m app.seed --reset    # re-import products (keeps customers & orders)
"""
import json
import sys
from pathlib import Path

from sqlalchemy import func, select, text

from .config import settings
from .database import Base, SessionLocal, engine, ensure_database
from .models import Admin, Category, Order, Product
from .combos import backfill_steps, seed_combos
from .orders import backfill_invoices
from .security import hash_secret
from .utils import slugify

SNAKE = {
    "shortDescription": "short_description",
    "closingTitle": "closing_title",
    "closingBody": "closing_body",
    "sortOrder": "sort_order",
}


def init_db(reset_products: bool = False, log: bool = True) -> None:
    ensure_database()
    Base.metadata.create_all(engine)
    # create_all() doesn't add columns to existing tables — add newer ones here (idempotent)
    with engine.begin() as conn:
        for table in ("customers", "registration_requests"):
            conn.execute(text(f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS consultation JSONB"))
        conn.execute(text("ALTER TABLE products ADD COLUMN IF NOT EXISTS subcategory VARCHAR(80) NOT NULL DEFAULT ''"))
        for ddl in (
            "ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount INTEGER NOT NULL DEFAULT 0",
            "ALTER TABLE orders ADD COLUMN IF NOT EXISTS source VARCHAR(20) NOT NULL DEFAULT 'website'",
            "ALTER TABLE orders ADD COLUMN IF NOT EXISTS created_by VARCHAR(160) NOT NULL DEFAULT ''",
            "ALTER TABLE orders ADD COLUMN IF NOT EXISTS invoice_number VARCHAR(30)",
            "ALTER TABLE orders ADD COLUMN IF NOT EXISTS invoice_date TIMESTAMPTZ",
            "CREATE UNIQUE INDEX IF NOT EXISTS ix_orders_invoice_number ON orders (invoice_number)",
            "CREATE SEQUENCE IF NOT EXISTS invoice_number_seq START 1",
        ):
            conn.execute(text(ddl))
    with SessionLocal() as db:
        if not db.scalar(select(func.count()).select_from(Admin)):
            db.add(Admin(email=settings.admin_email.lower(), name=settings.admin_name, password_hash=hash_secret(settings.admin_password)))
            db.commit()
            if log:
                print(f"[seed] Admin created: {settings.admin_email}")

        if reset_products:
            used = {i["productId"] for o in db.scalars(select(Order)) for i in o.items}
            for p in db.scalars(select(Product)):
                if p.id not in used:
                    db.delete(p)
            db.commit()

        existing = set(db.scalars(select(Product.slug)))
        data = json.loads((Path(__file__).parent / "seed_products.json").read_text(encoding="utf-8"))
        added = 0
        for item in data:
            if item["slug"] in existing:
                continue
            fields = {SNAKE.get(k, k): v for k, v in item.items()}
            db.add(Product(**fields, gallery=[], active=True))
            added += 1
        db.commit()
        if log and added:
            print(f"[seed] {added} products added")

        # First run of the categories feature: create main categories from the names products already use
        if not db.scalar(select(func.count()).select_from(Category)):
            default_order = ["Hair Oil", "Hair Serum", "Scalp Care", "Shampoo", "Conditioner"]
            used = [c for c in db.scalars(select(Product.category).distinct()) if c]
            names = [c for c in default_order if c in used] + sorted(c for c in used if c not in default_order)
            for i, name in enumerate(names or default_order):
                db.add(Category(name=name, slug=slugify(name), sort_order=i + 1))
            db.commit()
            if log:
                print(f"[seed] {len(names or default_order)} categories created")

        combos = seed_combos(db)
        if log and combos:
            print(f"[seed] {combos} combo kits created")
        invoiced = backfill_invoices(db)
        if log and invoiced:
            print(f"[seed] invoice numbers assigned to {invoiced} existing orders")
        upgraded = backfill_steps(db)
        if log and upgraded:
            print(f"[seed] ritual steps upgraded on {upgraded} combo kits")


if __name__ == "__main__":
    init_db(reset_products="--reset" in sys.argv)
    print("[seed] done")
