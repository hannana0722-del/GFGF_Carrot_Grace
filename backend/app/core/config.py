from pydantic_settings import BaseSettings
from typing import Optional
import os


class Settings(BaseSettings):
    # App
    APP_NAME: str = "GFGF - 2026 경기 청년 사다리 프로그램 API"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True

    # Security — .env에서 설정 권장. 없으면 개발용 기본값 사용 (운영 환경에서는 반드시 변경할 것)
    SECRET_KEY: str = "dev-only-secret-key-change-before-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours

    # Database
    DATABASE_URL: str = "sqlite:///./gsdf.db"

    # Upload
    UPLOAD_DIR: str = "uploads"

    # CORS
    ALLOWED_ORIGINS: list = ["*"]

    model_config = {
        "env_file": ".env",
        "case_sensitive": True,
        "extra": "ignore",
    }


settings = Settings()

# Ensure upload directory exists
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
