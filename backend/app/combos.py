"""Combo kits (e.g. VITALORA) — bundles of catalogue products sold at one offer price.

A combo stores its contents as [{productId, qty}] (qty = units of that product per kit).
Stock is not kept on the combo: availability is derived from the component products' stock,
and buying a kit deducts each component (see routers/shop.py create_order).
"""
from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import Combo, Product
from .utils import to_dict

DEFAULT_RITUAL_TITLE = "Your hair-care ritual"
DEFAULT_EXPERIENCE_TITLE = "A complete hair-care experience"


def products_for(db: Session, combos: list[Combo]) -> dict[str, Product]:
    ids = {i["productId"] for c in combos for i in (c.items or [])}
    return {p.id: p for p in db.scalars(select(Product).where(Product.id.in_(ids)))} if ids else {}


def expand(c: Combo, products: dict[str, Product], public: bool = False) -> dict:
    """Combo + its component products (name, image, size, prices), totals and availability."""
    items, item_mrp, available, missing = [], 0, None, False
    for it in c.items or []:
        p = products.get(it["productId"])
        if not p or (public and not p.active):
            missing = True
            continue
        qty = max(1, int(it.get("qty") or 1))
        items.append({
            "productId": p.id, "name": p.name, "slug": p.slug, "subtitle": p.subtitle, "image": p.image,
            "size": p.size, "category": p.category, "mrp": p.mrp, "price": p.price, "qty": qty, "active": p.active,
            "shortDescription": p.short_description, "tagline": p.tagline,
            "benefits": [b.get("title", "") for b in (p.benefits or []) if b.get("title")][:3],
        })
        item_mrp += p.mrp * qty
        # the website can't sell a kit with a hidden product; the admin sees real stock plus a warning
        kits = p.stock // qty if (p.active or not public) else 0
        available = kits if available is None else min(available, kits)
    mrp = c.mrp or item_mrp
    by_id = {i["productId"]: i for i in items}
    steps = []
    for s in c.steps or []:
        linked = by_id.get(s.get("productId") or "")
        steps.append({
            "title": s.get("title", ""), "text": s.get("text", ""), "description": s.get("description", ""),
            "productId": linked["productId"] if linked else "",
            "product": {k: linked[k] for k in ("name", "slug", "image", "size")} if linked else None,
        })
    data = to_dict(c, exclude={"updated_at"} if public else None)
    data["steps"] = steps
    data.update({
        "items": items,
        "itemsMrp": item_mrp,  # sum of component MRPs — shown as a hint in the admin
        "mrp": mrp,
        "savings": max(0, mrp - c.price),
        "savingsPercent": round((mrp - c.price) / mrp * 100) if mrp > c.price else 0,
        "available": 0 if missing or available is None else available,
        "hiddenItems": [i["name"] for i in items if not i["active"]],
        "unitCount": sum(i["qty"] for i in items),
        "ritualTitle": c.ritual_title or DEFAULT_RITUAL_TITLE,
        "experienceTitle": c.experience_title or DEFAULT_EXPERIENCE_TITLE,
    })
    return data


def kit_label(items: list[dict]) -> str:
    units = sum(i["qty"] for i in items)
    return f"Kit · {units} item{'s' if units != 1 else ''}"


# Starter "how to use" text for the launch kits' ritual steps — general usage guidance, editable in Admin → Combos.
USE = {
    "Velvera Shampoo": "Wet your hair thoroughly. Take a small amount, work it into a gentle lather over the scalp and lengths, "
                       "massage with your fingertips for 1–2 minutes, then rinse well. Repeat if needed.",
    "Hair Renaissance": "On dry or towel-dried hair, part your hair in sections and apply a few drops to the scalp. "
                        "Massage in gently with your fingertips — no need to rinse.",
    "Aurelia Hair Elixir": "Warm a small amount between your palms and apply to the scalp and along the lengths, massaging gently. "
                           "Leave it on for at least an hour (or overnight), then wash with your shampoo.",
    "Scalp Elixir": "Apply a few drops directly to a clean, dry scalp, parting the hair section by section. "
                    "Massage in gently with your fingertips and leave on — no need to rinse.",
    "Lumière": "Before washing, apply to the scalp in sections and massage gently. Leave on for 15–20 minutes, "
               "then wash with Lumière Purify Shampoo.",
    "Lumière Purify Shampoo": "Apply to wet hair, focusing on the scalp. Massage gently to lift build-up and visible flakes, "
                              "then rinse thoroughly.",
    "ELIXORA routine": "Repeat the ritual consistently — Scalp Elixir on the scalp and Velvera Shampoo on wash days — "
                       "for a routine that supports healthier, stronger-looking hair over time.",
}


# The three launch kits from the Quench Elegance posters. Created once, on first start, if the
# products exist (matched by name). MRPs and offer prices are as printed on the posters.
SEED_COMBOS = [
    {
        "slug": "vitalora", "name": "VITALORA", "tagline": "The Hair Vitality Ritual", "banner": "/uploads/products/combo-vitalora.jpg",
        "description": "A complete daily hair-care kit for healthy, nourished and stronger-looking hair.",
        "items": [("Velvera Shampoo", 2), ("Hair Renaissance", 2), ("Aurelia Hair Elixir", 2)],
        "mrp": 11994, "price": 5999, "sort_order": 1,
        "ritual_title": "Your hair-care ritual",
        "steps": [("Cleanse", "with Velvera Shampoo", "Velvera Shampoo", USE["Velvera Shampoo"]),
                  ("Nourish", "with Hair Renaissance", "Hair Renaissance", USE["Hair Renaissance"]),
                  ("Care & Protect", "with Aurelia Hair Elixir", "Aurelia Hair Elixir", USE["Aurelia Hair Elixir"])],
        "experience_title": "A complete hair-care experience",
        "highlights": [
            "A well-designed 3-step hair-care routine",
            "Cleansing, nourishment and daily care in one complete kit",
            "Formulated with botanical and active-based hair-care ingredients",
            "Created to support your overall hair-care journey",
        ],
        "closing": "VITALORA – A complete ritual for your daily hair vitality.",
    },
    {
        "slug": "elixora", "name": "ELIXORA", "tagline": "The Hair Revitalisation Collection", "banner": "/uploads/products/combo-elixora.jpg",
        "description": "A complete hair revitalisation kit for scalp care, cleansing and hair renewal.",
        "items": [("Scalp Elixir", 2), ("Velvera Shampoo", 2)],
        "mrp": 3996, "price": 1999, "sort_order": 2,
        "ritual_title": "Your hair-care ritual",
        "steps": [("Revitalise the Scalp", "with Scalp Elixir", "Scalp Elixir", USE["Scalp Elixir"]),
                  ("Cleanse", "with Velvera Shampoo", "Velvera Shampoo", USE["Velvera Shampoo"]),
                  ("Nourish & Renew", "for healthier, stronger hair", None, USE["ELIXORA routine"])],
        "experience_title": "A complete hair-care experience",
        "highlights": [
            "Targets scalp health & hair root renewal",
            "Deep-cleansing with gentle, nourishing care",
            "Supports healthier, stronger & more resilient hair",
            "Designed for a complete hair revitalisation routine",
        ],
        "closing": "ELIXORA – The complete hair revitalisation collection.",
    },
    {
        "slug": "scalpora", "name": "SCALPORA", "tagline": "The Advanced Scalp Care Collection", "banner": "/uploads/products/combo-scalpora.jpg",
        "description": "A complete scalp care kit for deep purification, nourishment and healthier hair.",
        "items": [("Lumière", 2), ("Lumière Purify Shampoo", 2), ("Aurelia Hair Elixir", 2)],
        "mrp": 13994, "price": 5999, "sort_order": 3,
        "ritual_title": "Your scalp-care ritual",
        "steps": [("Detox & Purify", "with Lumière Scalp Mask", "Lumière", USE["Lumière"]),
                  ("Cleanse & Refresh", "with Lumière Purify Shampoo", "Lumière Purify Shampoo", USE["Lumière Purify Shampoo"]),
                  ("Nourish & Strengthen", "with Aurelia Hair Elixir", "Aurelia Hair Elixir", USE["Aurelia Hair Elixir"])],
        "experience_title": "A complete scalp & hair-care experience",
        "highlights": [
            "Deep-cleanses & detoxifies the scalp",
            "Helps remove build-up & excess oil",
            "Nourishes scalp and strengthens hair roots",
            "Supports healthier, thicker & more resilient hair",
        ],
        "closing": "SCALPORA – The advanced scalp care collection.",
    },
]


def seed_steps(s: dict, by_name: dict) -> list[dict]:
    return [{"title": t, "text": x, "productId": by_name[n].id if n and n in by_name else "", "description": d}
            for t, x, n, d in s["steps"]]


def backfill_steps(db: Session) -> int:
    """One-time upgrade for kits created before steps had a product link and how-to-use text:
    fills in only steps that have neither, for the three launch kits."""
    by_name = {p.name: p for p in db.scalars(select(Product))}
    seeds = {s["slug"]: s for s in SEED_COMBOS}
    changed = 0
    for c in db.scalars(select(Combo).where(Combo.slug.in_(seeds.keys()))):
        defaults = {st["title"]: st for st in seed_steps(seeds[c.slug], by_name)}
        new, touched = [], False
        for st in c.steps or []:
            d = defaults.get(st.get("title"))
            if d and not st.get("productId") and not st.get("description"):
                st = {**st, "productId": d["productId"], "description": d["description"]}
                touched = True
            new.append(st)
        if touched:
            c.steps = new
            changed += 1
    db.commit()
    return changed


def seed_combos(db: Session) -> int:
    if db.scalar(select(Combo.id).limit(1)):
        return 0
    by_name = {p.name: p for p in db.scalars(select(Product))}
    added = 0
    for s in SEED_COMBOS:
        if not all(name in by_name for name, _ in s["items"]):
            continue
        db.add(Combo(
            slug=s["slug"], name=s["name"], tagline=s["tagline"], description=s["description"],
            banner=s["banner"], image=s["banner"],
            items=[{"productId": by_name[n].id, "qty": q} for n, q in s["items"]],
            mrp=s["mrp"], price=s["price"], sort_order=s["sort_order"], featured=True, active=True,
            ritual_title=s["ritual_title"], steps=seed_steps(s, by_name),
            experience_title=s["experience_title"], highlights=s["highlights"], closing=s["closing"],
        ))
        added += 1
    db.commit()
    return added
