from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import Depends, Header
from sqlalchemy.orm import Session

from .config import settings
from .database import get_db
from .models import Admin, Customer
from .utils import ApiError


def hash_secret(value: str, rounds: int = 10) -> str:
    return bcrypt.hashpw(value.encode(), bcrypt.gensalt(rounds)).decode()


def verify_secret(value: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(value.encode(), hashed.encode())
    except ValueError:
        return False


def create_token(sub: str, role: str, hours: int) -> str:
    payload = {"sub": sub, "role": role, "exp": datetime.now(timezone.utc) + timedelta(hours=hours)}
    return jwt.encode(payload, settings.jwt_secret, algorithm="HS256")


def _decode(authorization: str | None, role: str) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise ApiError(401, "Please log in to continue." if role == "customer" else "Admin login required.")
    try:
        payload = jwt.decode(authorization[7:], settings.jwt_secret, algorithms=["HS256"])
    except jwt.PyJWTError:
        raise ApiError(401, "Session expired. Please log in again.")
    if payload.get("role") != role:
        raise ApiError(403, "Not allowed.")
    return payload["sub"]


def current_customer(authorization: str | None = Header(default=None), db: Session = Depends(get_db)) -> Customer:
    cid = _decode(authorization, "customer")
    customer = db.get(Customer, cid)
    if not customer or not customer.active:
        raise ApiError(401, "Your account is inactive. Please contact Quench Elegance.")
    return customer


def current_admin(authorization: str | None = Header(default=None), db: Session = Depends(get_db)) -> Admin:
    aid = _decode(authorization, "admin")
    admin = db.get(Admin, aid)
    if not admin:
        raise ApiError(401, "Admin not found.")
    return admin
