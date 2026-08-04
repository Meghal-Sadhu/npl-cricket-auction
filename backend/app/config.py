import os
import secrets
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # ── Security ──────────────────────────────────────────────────────────────
    # SECRET_KEY must be set in the environment (no hardcoded default in prod).
    # Generate a strong key with: python3 -c "import secrets; print(secrets.token_hex(64))"
    SECRET_KEY: str = os.getenv("SECRET_KEY", "")

    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24 hours

    # ── Environment ───────────────────────────────────────────────────────────
    # Set ENVIRONMENT=production on Oracle VM to disable /docs and /redoc
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")

    # ── Database ──────────────────────────────────────────────────────────────
    DATABASE_URL: str = os.getenv("DATABASE_URL") or "sqlite:///./cricket_auction.db"
    UPLOAD_DIR: str = "uploads"

    # ── Rate Limiting ─────────────────────────────────────────────────────────
    LOGIN_RATE_LIMIT_PER_MINUTE: int = 10  # Max login attempts per IP per minute

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "allow"

    def validate_secret_key(self) -> None:
        if not self.SECRET_KEY:
            raise RuntimeError(
                "SECRET_KEY environment variable is not set! "
                "Generate one with: python3 -c \"import secrets; print(secrets.token_hex(64))\""
            )
        if len(self.SECRET_KEY) < 32:
            raise RuntimeError("SECRET_KEY must be at least 32 characters long.")

settings = Settings()
settings.validate_secret_key()
