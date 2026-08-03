import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    SECRET_KEY: str = "npl_cricket_auction_super_secret_jwt_key_2026_x99!"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440
    DATABASE_URL: str = "sqlite:///./cricket_auction.db"
    UPLOAD_DIR: str = "uploads"

    class Config:
        env_file = ".env"
        extra = "allow"

settings = Settings()
