"""OTP delivery. OTP_PROVIDER=console prints to the log; OTP_PROVIDER=fast2sms sends a real SMS."""
import logging

import httpx

from .config import settings

log = logging.getLogger("quench.sms")

FAST2SMS_URL = "https://www.fast2sms.com/dev/bulkV2"


class SmsError(Exception):
    pass


def send_otp(phone: str, otp: str) -> None:
    if settings.otp_provider == "fast2sms":
        _send_fast2sms(phone, otp)
        return
    print(f"\n[OTP] {phone} -> {otp}  (valid {settings.otp_expiry_minutes} min)\n", flush=True)


def _send_fast2sms(phone: str, otp: str) -> None:
    if not settings.fast2sms_api_key:
        raise SmsError("FAST2SMS_API_KEY is not set in backend/.env")

    if settings.fast2sms_route == "dlt":
        # DLT route: your own approved template; the OTP fills the template's variable
        if not (settings.fast2sms_sender_id and settings.fast2sms_template_id):
            raise SmsError("FAST2SMS_SENDER_ID and FAST2SMS_TEMPLATE_ID are required for the DLT route")
        body = {
            "route": "dlt",
            "sender_id": settings.fast2sms_sender_id,
            "message": settings.fast2sms_template_id,
            "variables_values": otp,
            "numbers": phone,
            "flash": "0",
        }
    else:
        # Quick OTP route: Fast2SMS sends "Your OTP: XXXXXX"
        body = {"route": "otp", "variables_values": otp, "numbers": phone, "flash": "0"}

    try:
        res = httpx.post(
            FAST2SMS_URL,
            json=body,
            headers={"authorization": settings.fast2sms_api_key, "cache-control": "no-cache"},
            timeout=15,
        )
        data = res.json() if res.content else {}
    except (httpx.HTTPError, ValueError) as e:
        raise SmsError(f"Fast2SMS request failed: {e}") from e

    if res.status_code != 200 or not data.get("return"):
        raise SmsError(f"Fast2SMS error ({res.status_code}): {data.get('message') or res.text[:200]}")
    log.info("OTP sent to %s via Fast2SMS (request %s)", phone[-4:].rjust(10, "X"), data.get("request_id"))
