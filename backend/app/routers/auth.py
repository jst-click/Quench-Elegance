import re
import secrets
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from ..config import settings
from ..consultation import FORM, clean_client_submission
from ..database import get_db
from ..models import Customer, Otp, RegistrationRequest
from ..security import create_token, current_customer, hash_secret, verify_secret
from ..sms import SmsError, send_otp
from ..utils import ApiError, RateLimiter, clip, iso, normalize_phone

router = APIRouter(prefix="/api/auth", tags=["customer auth"])
otp_limiter = RateLimiter(limit=20, window_seconds=15 * 60)


def public_customer(c: Customer) -> dict:
    return {
        "id": c.id,
        "customerCode": c.customer_code,
        "name": c.name,
        "phone": c.phone,
        "email": c.email or "",
        "addresses": c.addresses or [],
        "createdAt": iso(c.created_at),
    }


class PhoneIn(BaseModel):
    phone: str = ""


class VerifyIn(BaseModel):
    phone: str = ""
    otp: str = ""


class RegisterIn(BaseModel):
    consultation: dict = {}  # {answers: {sectionId: {fieldId: value}}, skipped: [sectionId]}
    message: str = ""


class ProfileIn(BaseModel):
    name: str | None = None
    email: str | None = None


class AddressIn(BaseModel):
    name: str = ""
    phone: str = ""
    line1: str = ""
    line2: str = ""
    city: str = ""
    state: str = ""
    pincode: str = ""


def clean_address(a: AddressIn | dict) -> dict:
    a = a if isinstance(a, dict) else a.model_dump()
    return {
        "name": clip(a.get("name"), 80),
        "phone": normalize_phone(a.get("phone")) or "",
        "line1": clip(a.get("line1"), 160),
        "line2": clip(a.get("line2"), 160),
        "city": clip(a.get("city"), 60),
        "state": clip(a.get("state"), 60),
        "pincode": re.sub(r"\D", "", str(a.get("pincode") or ""))[:6],
    }


def address_error(a: dict) -> str | None:
    if not a["name"]:
        return "Name is required."
    if not a["phone"]:
        return "Valid phone is required."
    if not a["line1"]:
        return "Address is required."
    if not a["city"]:
        return "City is required."
    if not a["state"]:
        return "State is required."
    if len(a["pincode"]) != 6:
        return "Valid 6-digit PIN code is required."
    return None


@router.post("/otp/request", dependencies=[Depends(otp_limiter)])
def request_otp(body: PhoneIn, db: Session = Depends(get_db)):
    """Step 1 — only numbers registered by an admin receive an OTP."""
    phone = normalize_phone(body.phone)
    if not phone:
        raise ApiError(400, "Please enter a valid 10-digit mobile number.")

    customer = db.scalar(select(Customer).where(Customer.phone == phone))
    if not customer:
        if db.scalar(select(RegistrationRequest).where(RegistrationRequest.phone == phone, RegistrationRequest.status == "pending")):
            raise ApiError(403, "Your registration is being reviewed by our consultant. You can log in once it is approved.", code="PENDING_APPROVAL")
        raise ApiError(404, "This mobile number is not registered with Quench Elegance yet.", code="NOT_REGISTERED")
    if not customer.active:
        raise ApiError(403, "Your account is inactive. Please contact Quench Elegance.", code="INACTIVE")

    now = datetime.now(timezone.utc)
    last = db.scalar(select(Otp).where(Otp.phone == phone).order_by(Otp.created_at.desc()))
    if last:
        elapsed = (now - last.created_at).total_seconds()
        if elapsed < settings.otp_resend_seconds:
            wait = int(settings.otp_resend_seconds - elapsed) + 1
            raise ApiError(429, f"Please wait {wait}s before requesting another OTP.", retryAfter=wait)

    otp = f"{secrets.randbelow(900000) + 100000}"
    db.execute(delete(Otp).where(Otp.phone == phone))
    db.add(Otp(phone=phone, otp_hash=hash_secret(otp, rounds=6), expires_at=now + timedelta(minutes=settings.otp_expiry_minutes)))
    db.commit()

    sms_error = None
    try:
        send_otp(phone, otp)
    except SmsError as e:
        print(f"[otp] send failed: {e}", flush=True)
        if not settings.otp_dev_mode:
            db.execute(delete(Otp).where(Otp.phone == phone))
            db.commit()
            raise ApiError(502, "We could not send the OTP right now. Please try again shortly.")
        # testing only: keep the OTP usable (it is shown on screen) so login still works while SMS is being set up
        sms_error = str(e)
        print(f"[OTP] {phone} -> {otp}  (dev mode fallback)", flush=True)

    res = {
        "message": f"OTP sent to +91 {phone[:2]}XXXXXX{phone[-2:]}" if not sms_error else "SMS could not be sent (test mode).",
        "expiresInSeconds": settings.otp_expiry_minutes * 60,
        "resendInSeconds": settings.otp_resend_seconds,
    }
    if settings.otp_dev_mode:
        res["devOtp"] = otp
        if sms_error:
            res["smsError"] = sms_error
    return res


@router.post("/otp/verify", dependencies=[Depends(otp_limiter)])
def verify_otp(body: VerifyIn, db: Session = Depends(get_db)):
    """Step 2 — verify the OTP and issue a 30-day session token."""
    phone = normalize_phone(body.phone)
    code = (body.otp or "").strip()
    if not phone or not re.fullmatch(r"\d{6}", code):
        raise ApiError(400, "Enter the 6-digit OTP.")

    record = db.scalar(select(Otp).where(Otp.phone == phone))
    master = settings.otp_master_code.strip()
    if master and re.fullmatch(r"\d{6}", master) and secrets.compare_digest(code, master):
        # default OTP (OTP_MASTER_CODE): works alongside the real SMS OTP, for registered active customers only
        if record:
            db.delete(record)
        customer = db.scalar(select(Customer).where(Customer.phone == phone))
        if not customer:
            db.commit()
            raise ApiError(404, "This mobile number is not registered with Quench Elegance yet.", code="NOT_REGISTERED")
        if not customer.active:
            db.commit()
            raise ApiError(403, "Account unavailable. Please contact us.")
        customer.last_login_at = datetime.now(timezone.utc)
        db.commit()
        print(f"[otp] {phone[:2]}XXXXXX{phone[-2:]} logged in with the default OTP", flush=True)
        return {"token": create_token(customer.id, "customer", hours=24 * 30), "customer": public_customer(customer)}

    if not record:
        raise ApiError(400, "OTP not found or expired. Please request a new one.")
    if record.expires_at < datetime.now(timezone.utc):
        db.delete(record)
        db.commit()
        raise ApiError(400, "OTP expired. Please request a new one.")
    if record.attempts >= settings.otp_max_attempts:
        db.delete(record)
        db.commit()
        raise ApiError(429, "Too many wrong attempts. Please request a new OTP.")
    if not verify_secret(code, record.otp_hash):
        record.attempts += 1
        db.commit()
        raise ApiError(400, "Incorrect OTP. Please try again.")

    db.delete(record)
    customer = db.scalar(select(Customer).where(Customer.phone == phone))
    if not customer or not customer.active:
        db.commit()
        raise ApiError(403, "Account unavailable. Please contact us.")
    customer.last_login_at = datetime.now(timezone.utc)
    db.commit()
    return {"token": create_token(customer.id, "customer", hours=24 * 30), "customer": public_customer(customer)}


@router.get("/consultation-form")
def consultation_form():
    """The Hair & Scalp consultation the registration wizard renders (client sections only)."""
    return {"sections": [sec for sec in FORM if sec["audience"] == "client"]}


@router.post("/register-request", dependencies=[Depends(otp_limiter)])
def register_request(body: RegisterIn, db: Session = Depends(get_db)):
    """New customers register by completing the consultation; an admin reviews and approves it."""
    consultation = clean_client_submission(body.consultation)
    personal = consultation["answers"]["personal"]
    phone = personal["mobile"]
    if db.scalar(select(Customer).where(Customer.phone == phone)):
        raise ApiError(409, "This number is already registered. Please log in with OTP.", code="ALREADY_REGISTERED")
    pending = db.scalar(select(RegistrationRequest).where(RegistrationRequest.phone == phone, RegistrationRequest.status == "pending"))
    fields = dict(
        name=clip(personal["fullName"], 80), email=clip(personal.get("email"), 120), city=clip(personal.get("city"), 80),
        message=clip(body.message, 500), consultation=consultation,
    )
    if pending:  # resubmitting replaces the earlier answers instead of creating a duplicate request
        for k, v in fields.items():
            setattr(pending, k, v)
    else:
        db.add(RegistrationRequest(phone=phone, **fields))
    db.commit()
    return {"message": "Thank you! Our consultant will review your consultation and activate your account shortly."}


@router.get("/me")
def me(customer: Customer = Depends(current_customer)):
    return {"customer": public_customer(customer)}


@router.put("/me")
def update_me(body: ProfileIn, customer: Customer = Depends(current_customer), db: Session = Depends(get_db)):
    name = clip(body.name if body.name is not None else customer.name, 80)
    if not name:
        raise ApiError(400, "Name is required.")
    customer.name = name
    if body.email is not None:
        customer.email = clip(body.email, 120)
    db.add(customer)
    db.commit()
    return {"customer": public_customer(customer)}


@router.post("/addresses")
def add_address(body: AddressIn, customer: Customer = Depends(current_customer), db: Session = Depends(get_db)):
    a = clean_address(body)
    err = address_error(a)
    if err:
        raise ApiError(400, err)
    customer.addresses = [*(customer.addresses or []), {"id": uuid.uuid4().hex, **a}][-5:]
    db.add(customer)
    db.commit()
    return {"addresses": customer.addresses}


@router.delete("/addresses/{address_id}")
def delete_address(address_id: str, customer: Customer = Depends(current_customer), db: Session = Depends(get_db)):
    customer.addresses = [a for a in (customer.addresses or []) if a.get("id") != address_id]
    db.add(customer)
    db.commit()
    return {"addresses": customer.addresses}
