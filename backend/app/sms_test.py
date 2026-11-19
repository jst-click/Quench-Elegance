"""Sends a test OTP SMS using the settings in backend/.env.

    .venv/Scripts/python -m app.sms_test 9876543210
"""
import secrets
import sys

from .config import settings
from .sms import SmsError, send_otp
from .utils import normalize_phone


def main() -> None:
    phone = normalize_phone(sys.argv[1] if len(sys.argv) > 1 else "")
    if not phone:
        sys.exit("Usage: python -m app.sms_test <10-digit mobile number>")
    otp = f"{secrets.randbelow(900000) + 100000}"
    print(f"provider={settings.otp_provider} route={settings.fast2sms_route} sender={settings.fast2sms_sender_id or '-'} "
          f"message_id={settings.fast2sms_template_id or '-'} api_key={'set' if settings.fast2sms_api_key else 'MISSING'}")
    try:
        send_otp(phone, otp)
    except SmsError as e:
        sys.exit(f"FAILED: {e}")
    print(f"OK - OTP {otp} sent to +91 {phone}")


if __name__ == "__main__":
    main()
