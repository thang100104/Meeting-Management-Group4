import sys
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.database import SessionLocal
from app.db.init_db import init_db
from app.api.v1.api import api_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Tự động tạo bảng và nạp dữ liệu mẫu ban đầu (Roles, Departments, Admin)
    print(">> Đang khởi tạo Database và nạp dữ liệu mặc định...")
    db = SessionLocal()
    try:
        init_db(db)
    finally:
        db.close()
    print(">> Khởi động ứng dụng thành công!")
    yield

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="API Quản lý Lịch họp và Phòng họp — Phân hệ Giai đoạn 1 (Auth & RBAC)",
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan
)

# Cấu hình CORS cho phép Frontend truy cập
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Gắn các router API V1
app.include_router(api_router, prefix=settings.API_V1_STR)

@app.get("/health", tags=["Health Check"])
def health_check():
    return {
        "status": "healthy",
        "project": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "docs_url": "/docs"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
