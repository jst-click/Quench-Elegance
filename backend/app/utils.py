import re
import time
import unicodedata
from collections import defaultdict, deque
from datetime import datetime
from typing import Any

from fastapi import Request

ORDER_STATUSES = ["Placed", "Confirmed", "Packed", "Shipped", "Delivered", "Cancelled"]


class ApiError(Exception):
    """Raised anywhere in the app; rendered as {"message": ..., **extra} with the given status."""

    def __init__(self, status: int, message: str, **extra: Any):
        self.status = status
        self.message = message
        self.extra = extra


def normalize_phone(value: Any) -> str | None:
    """Normalises Indian mobile numbers to 10 digits; returns None if invalid."""
    if not value:
        return None
    d = re.sub(r"\D", "", str(value))
    if len(d) == 12 and d.startswith("91"):
        d = d[2:]
    if len(d) == 11 and d.startswith("0"):
        d = d[1:]
    return d if re.fullmatch(r"[6-9]\d{9}", d) else None


def slugify(value: str) -> str:
    s = unicodedata.normalize("NFKD", str(value or "")).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def clip(value: Any, n: int) -> str:
    return str(value if value is not None else "").strip()[:n]


def iso(dt: datetime | None) -> str | None:
    return dt.isoformat() if dt else None


def camel(snake: str) -> str:
    head, *rest = snake.split("_")
    return head + "".join(w.title() for w in rest)


def to_dict(obj, exclude: set[str] | None = None) -> dict:
    """Serialises a SQLAlchemy model to a camelCase dict (ISO dates)."""
    out = {}
    for col in obj.__table__.columns:
        if exclude and col.name in exclude:
            continue
        v = getattr(obj, col.name)
        out[camel(col.name)] = iso(v) if isinstance(v, datetime) else v
    return out


class RateLimiter:
    """Small in-memory sliding-window limiter, keyed by client IP. Fine for a single server process."""

    def __init__(self, limit: int, window_seconds: int):
        self.limit = limit
        self.window = window_seconds
        self.hits: dict[str, deque] = defaultdict(deque)

    def __call__(self, request: Request):
        key = request.client.host if request.client else "unknown"
        now = time.monotonic()
        q = self.hits[key]
        while q and now - q[0] > self.window:
            q.popleft()
        if len(q) >= self.limit:
            raise ApiError(429, "Too many requests. Please wait a few minutes and try again.")
        q.append(now)
