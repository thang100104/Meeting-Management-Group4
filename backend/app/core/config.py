from pydantic_settings import BaseSettings
from typing import List

class Settings(BaseSettings):
    PROJECT_NAME: str = "Hệ thống Quản lý Lịch họp ICTU"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    
    # JWT Auth
    SECRET_KEY: str = "ictu-meeting-management-super-secret-key-change-in-prod-2026"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 1 ngày
    
    # Database (Mặc định dùng SQLite cục bộ, dễ dàng chuyển sang PostgreSQL qua biến môi trường)
    DATABASE_URL: str = "sqlite:///./meetings.db"
    
    # Optional reminder email provider; in-app reminders always run.
    SMTP_HOST: str = ""
    SMTP_PORT: int = 1025
    SMTP_FROM: str = "MeetingHub <noreply@meetinghub.local>"
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_STARTTLS: bool = False
    SMTP_SSL: bool = False

    # CORS
    BACKEND_CORS_ORIGINS: List[str] = ["*"]
    
    class Config:
        case_sensitive = True
        env_file = ".env"

settings = Settings()
