@echo off
chcp 65001 > nul
echo ========================================================
echo   KHỞI CHẠY BACKEND FASTAPI - HỆ THỐNG QUẢN LÝ LỊCH HỌP
echo ========================================================
echo.

cd /d "%~dp0"

:: 1. Kiểm tra file .env
if not exist ".env" (
    echo [1/3] Chưa có file .env! Đang tự động sao chép từ .env.example...
    copy ".env.example" ".env" > nul
    echo       -> Đã tạo file .env thành công!
) else (
    echo [1/3] File cấu hình .env: Đã sẵn sàng.
)

:: 2. Kiểm tra thư mục .venv
if not exist ".venv\Scripts\python.exe" (
    echo [2/3] Chưa có môi trường ảo .venv! Đang tự động khởi tạo...
    python -m venv .venv
    if errorlevel 1 (
        echo [LỖI] Máy tính chưa cài đặt Python hoặc chưa thêm Python vào PATH!
        echo Vui lòng cài Python từ python.org và tích chọn "Add python.exe to PATH".
        pause
        exit /b 1
    )
    echo       -> Đang cài đặt các thư viện cần thiết từ requirements.txt...
    .\.venv\Scripts\python.exe -m pip install --upgrade pip
    .\.venv\Scripts\pip.exe install -r requirements.txt
    echo       -> Cài đặt thư viện hoàn tất!
) else (
    echo [2/3] Môi trường ảo .venv: Đã sẵn sàng.
)

:: 3. Khởi chạy Server Uvicorn
echo.
echo [3/3] Đang khởi động Server FastAPI tại http://localhost:8000 ...
echo       Swagger UI tài liệu API: http://localhost:8000/docs
echo       Nhấn Ctrl+C để dừng server.
echo.
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
pause
