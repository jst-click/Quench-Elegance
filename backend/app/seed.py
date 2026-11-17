"""Creates tables, the first admin and the initial catalogue. Safe to run repeatedly.

    python -m app.seed            # create missing data
    python -m app.seed --reset    # re-import products (keeps customers & orders)
"""
import json
import sys
from pathlib import Path

from sqlalchemy import func, select

from .config import settings
from .database import Base, SessionLocal, engine, ensure_database
from .models import Admin, Order, Product
from .security import hash_secret

SNAKE = {
    "shortDescription": "short_description",
    "closingTitle": "closing_title",
    "closingBody": "closing_body",
    "sortOrder": "sort_order",
}


def init_db(reset_products: bool = False, log: bool = True) -> None:
    ensure_database()
    Base.metadata.create_all(engine)
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


if __name__ == "__main__":
    init_db(reset_products="--reset" in sys.argv)
    print("[seed] done")
