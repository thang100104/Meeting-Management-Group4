@echo off
chcp 65001 > nul
echo ========================================================
echo   KHỞI CHẠY FRONTEND REACT / VITE - HỆ THỐNG QUẢN LÝ LỊCH HỌP
echo ========================================================
echo.

cd /d "%~dp0"

:: 1. Kiểm tra node_modules
if not exist "node_modules\" (
    echo [1/2] Chưa có thư mục node_modules! Đang tự động chạy npm install...
    npm install
    if errorlevel 1 (
        echo [LỖI] Máy tính chưa cài đặt Node.js!
        echo Vui lòng cài đặt Node.js từ https://nodejs.org
        pause
        exit /b 1
    )
    echo       -> Đã cài đặt dependencies thành công!
) else (
    echo [1/2] Thư mục node_modules: Đã sẵn sàng.
)

:: 2. Khởi chạy Vite Dev Server
echo.
echo [2/2] Đang khởi động Frontend Vite Server...
echo       Truy cập trình duyệt: http://localhost:5173
echo       Nhấn Ctrl+C để dừng server.
echo.
npm run dev
pause
