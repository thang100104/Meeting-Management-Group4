# 🏢 Meeting Management System (ICTU Meeting) — Group 4

> **Hệ thống Quản lý Lịch họp, Đặt Phòng họp và Cấp phát Thiết bị thông minh**  
> Dự án môn học Thực tập Cơ sở 02 — Nhóm 4.

---

## 🌟 Giới thiệu Tổng quan

Hệ thống được xây dựng nhằm giải quyết triệt để các bài toán thường gặp trong quản lý họp doanh nghiệp và cơ sở giáo dục đại học:
- **Xác thực & Phân quyền chặt chẽ (RBAC)**: Hỗ trợ 3 vai trò chính: `ADMIN` (Quản trị viên), `ORGANIZER` (Giảng viên / Người đặt lịch), `PARTICIPANT` (Sinh viên / Khách mời).
- **Quản lý & Giới hạn Phòng họp**: Quản lý sức chứa, vị trí, tiện nghi và cấu hình giới hạn quyền truy cập theo vai trò.
- **Thuật toán Chống Trùng Lịch (Conflict Detection Engine)**: Tự động phát hiện và chặn các xung đột lịch phòng và người tham gia trong cùng một khung thời gian.
- **Quản lý & Đặt Mượn Kèm Thiết bị (Equipment Management - Giai đoạn 4)**: 
  - Theo dõi tình trạng thiết bị (`AVAILABLE`, `MAINTENANCE`, `BROKEN`).
  - Hỗ trợ thiết bị cố định tại phòng và thiết bị di động dùng chung.
  - Kiểm tra rảnh/bận và phát hiện xung đột thiết bị theo thời gian thực (Conflict Detection cho thiết bị).
  - Tự động giải phóng tài nguyên phòng và thiết bị khi cuộc họp bị hủy.

---

## 🛠️ Công nghệ Sử dụng (Tech Stack)

### Backend
- **Ngôn ngữ**: Python 3.10+
- **Framework**: [FastAPI](https://fastapi.tiangolo.com/) (RESTful API, OpenAPI 3.1 / Swagger UI tự động)
- **ORM / Cơ sở dữ liệu**: SQLAlchemy kết hợp SQLite (linh hoạt, dễ triển khai)
- **Bảo mật**: JWT (JSON Web Tokens), `passlib` / `bcrypt` mã hóa mật khẩu
- **Kiểm thử tự động**: TestClient, kịch bản test tự động toàn diện qua các phase

### Frontend
- **Framework**: [React 19](https://react.dev/) + [Vite](https://vite.dev/)
- **Ngôn ngữ**: TypeScript (Strict Mode)
- **Icons & Styling**: [Lucide React](https://lucide.dev/), Vanilla CSS Design System sang trọng (Deep Navy, Tech Blue, Accent Amber)
- **Tính năng nổi bật**:
  - Bảng ma trận thời gian thực (Timetable Grid) theo dõi lịch phòng theo ngày
  - Bộ chọn thiết bị mượn kèm thông minh tự động lọc thiết bị rảnh
  - Dashboard Quản trị Thiết bị (Equipment Manager) với thẻ KPI thống kê và Card Grid trực quan
  - Bộ chuyển đổi nhanh vai trò demo (Admin / Giảng viên / Sinh viên) để kiểm thử quyền trực tiếp

---

## 📂 Cấu trúc Thư mục

```text
TTCS02/
├── backend/
│   ├── app/
│   │   ├── api/v1/          # Endpoints (auth, users, roles, departments, rooms, meetings, equipments)
│   │   ├── core/            # Config, Security (JWT, bcrypt), Database engine
│   │   ├── db/              # Database initialization & seed data mẫu
│   │   ├── models/          # SQLAlchemy ORM Models (User, Role, Room, Meeting, Equipment...)
│   │   └── schemas/         # Pydantic Schemas validate input/output DTO
│   ├── main.py              # Điểm khởi chạy ứng dụng FastAPI
│   ├── requirements.txt     # Danh sách thư viện Python
│   ├── test_phase1.py       # Test tự động Giai đoạn 1 (Auth & RBAC)
│   ├── test_phase2.py       # Test tự động Giai đoạn 2 (Rooms & Restrictions)
│   ├── test_phase3.py       # Test tự động Giai đoạn 3 (Booking & Conflict Detection)
│   └── test_phase4.py       # Test tự động Giai đoạn 4 (Equipment Management & Booking)
├── frontend/
│   ├── src/
│   │   ├── components/      # TimetableGrid.tsx, EquipmentManager.tsx
│   │   ├── App.tsx          # Ứng dụng chính kèm navigation tabs và demo role switcher
│   │   ├── App.css          # CSS Layout & Components
│   │   └── index.css        # Biến màu sắc và Design System
│   ├── package.json
│   └── vite.config.ts
└── TIEN_DO_XAY_DUNG.md      # Báo cáo tiến độ và roadmap chi tiết của dự án
```

---

## 🚀 Hướng dẫn Cài đặt & Khởi chạy

### 1. Khởi chạy Backend FastAPI
Yêu cầu: Python 3.10 trở lên.

```bash
# Di chuyển vào thư mục backend
cd backend

# Tạo và kích hoạt môi trường ảo (Virtualenv)
python -m venv .venv

# Trên Windows (PowerShell):
.\.venv\Scripts\Activate.ps1
# Trên Linux/macOS:
source .venv/bin/activate

# Cài đặt các thư viện cần thiết
pip install -r requirements.txt

# Khởi chạy server FastAPI
python -m uvicorn app.main:app --reload --port 8000
```
- Swagger API Docs: `http://localhost:8000/docs`
- Health check: `http://localhost:8000/health`

### 2. Khởi chạy Frontend React / Vite
Yêu cầu: Node.js 18 trở lên.

```bash
# Di chuyển vào thư mục frontend
cd frontend

# Cài đặt dependencies
npm install

# Chạy server phát triển
npm run dev
```
- Truy cập ứng dụng: `http://localhost:5173`

---

## 🧪 Kiểm thử Tự động (Automated Test Suites)

Hệ thống được trang bị bộ kiểm thử tự động toàn diện qua 4 giai đoạn:

```bash
cd backend
python test_phase1.py   # Kiểm thử Auth & RBAC (9/9 passed)
python test_phase2.py   # Kiểm thử Quản lý Phòng họp & Giới hạn (11/11 passed)
python test_phase3.py   # Kiểm thử Đặt phòng & Chống trùng lịch (9/9 passed)
python test_phase4.py   # Kiểm thử Quản lý Thiết bị & Mượn kèm (13/13 passed)
```

---

## 👥 Tài khoản Mẫu để Thử nghiệm (Demo Accounts)

| Vai trò | Email | Mật khẩu | Quyền hạn |
|:---|:---|:---|:---|
| **ADMIN** | `admin@ictu.vn` | `Admin@123` | Toàn quyền quản trị: thêm/sửa/xóa phòng, thiết bị, người dùng |
| **ORGANIZER** | `organizer@ictu.vn` | `123456` | Giảng viên: Đặt phòng, mượn thiết bị, hủy/sửa cuộc họp của mình |
| **PARTICIPANT** | `student1@ictu.vn` | `password123` | Sinh viên: Xem lịch, phản hồi lời mời tham gia cuộc họp |

---

## 📄 Bản quyền & Đóng góp
Dự án được phát triển bởi Nhóm 4 — Khoa Công nghệ Thông tin, Đại học CNTT & Truyền thông (ICTU).
