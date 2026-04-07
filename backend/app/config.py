from pydantic_settings import BaseSettings
from functools import lru_cache
from dotenv import load_dotenv
from pathlib import Path

# Load variables from backend/.env (resolve relative to this file)
_here = Path(__file__).resolve().parent
_dotenv_path = _here / "../.env"
load_dotenv(dotenv_path=str(_dotenv_path), override=True)

class Settings(BaseSettings):
    # Supabase
    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_service_role_key: str = ""
    supabase_jwt_secret: str = ""
    supabase_jwks_url: str = ""

    # Database
    database_url: str = ""
    # Redis
    redis_url: str = ""
    redis_ssl_cert_reqs: str = "required"
    redis_ssl_ca_certs: str | None = None

    # AWS S3
    aws_access_key_id: str = ""
    aws_secret_access_key: str = ""
    aws_region: str = ""
    s3_bucket_name: str = ""

    # Stripe
    stripe_secret_key: str = ""
    stripe_publishable_key: str = ""
    stripe_webhook_secret: str = ""
    stripe_platform_fee_percent: float = 5.0

    # Email SMTP
    email_enabled: bool = False
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_username: str = ""
    smtp_password: str = ""
    smtp_from_email: str = ""
    smtp_use_tls: bool = True
    smtp_timeout_seconds: int = 15

    # Gemini AI
    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.5-flash"

    # App
    backend_url: str = "http://localhost:8000"
    frontend_url: str = "http://localhost:3000"
    environment: str = "development"
    upload_cleanup_max_age_hours: int = 24
    upload_cleanup_batch_size: int = 200

    model_config = {"env_file": str(_dotenv_path), "env_file_encoding": "utf-8", "extra": "ignore"}


@lru_cache
def get_settings() -> Settings:
    return Settings()

def reload_settings() -> Settings:
    """Clear the cached Settings and reload from environment/.env.

    Useful during development when `.env` is edited and you want the
    running process to pick up changes without a full restart.
    """
    get_settings.cache_clear()
    # reload dotenv in case .env changed
    load_dotenv(dotenv_path=str(_dotenv_path), override=True)
    return get_settings()
