from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=BASE_DIR / ".env", env_file_encoding="utf-8", extra="ignore")

    environment: str = "development"
    client_origins: str = "http://localhost:5173"

    database_url: str = "postgresql+psycopg://postgres:postgres@localhost:5432/quench_elegance"
    jwt_secret: str = "dev-only-secret-change-me"

    admin_email: str = "admin@quenchelegance.com"
    admin_password: str = "Admin@123"
    admin_name: str = "Quench Admin"

    otp_provider: str = "console"  # console | fast2sms
    otp_dev_mode: bool = True
    otp_expiry_minutes: int = 5
    otp_max_attempts: int = 5
    otp_resend_seconds: int = 30

    fast2sms_api_key: str = ""
    fast2sms_route: str = "otp"  # otp | dlt
    fast2sms_sender_id: str = ""
    fast2sms_template_id: str = ""

    shipping_flat: int = 0
    free_shipping_above: int = 0

    @property
    def is_prod(self) -> bool:
        return self.environment.lower() == "production"

    @property
    def origins(self) -> list[str]:
        return [o.strip() for o in self.client_origins.split(",") if o.strip()]


settings = Settings()

UPLOAD_DIR = BASE_DIR / "uploads"
PRODUCT_UPLOAD_DIR = UPLOAD_DIR / "products"
CLIENT_DIST = BASE_DIR.parent / "client" / "dist"

if settings.is_prod and settings.jwt_secret == "dev-only-secret-change-me":
    raise RuntimeError("Set JWT_SECRET in backend/.env before running in production.")
