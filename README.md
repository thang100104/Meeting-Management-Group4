# 🏢 Meeting Management System (ICTU Meeting) — Group 4

<p align="center">
  <img src="https://img.shields.io/badge/Project-ICTU_Meeting_Management-blue?style=for-the-badge&logo=googlecalendar" alt="Project Badge" />
  <img src="https://img.shields.io/badge/FastAPI-0.110+-009688?style=for-the-badge&logo=fastapi&logoColor=white" alt="FastAPI" />
  <img src="https://img.shields.io/badge/React_19-Vite_8-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React 19" />
  <img src="https://img.shields.io/badge/TypeScript-Strict_Mode-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Database-SQLite_%2F_SQLAlchemy-003B57?style=for-the-badge&logo=sqlite&logoColor=white" alt="SQLite" />
</p>

> **Hệ thống Quản lý Lịch họp, Đặt Phòng họp, Cấp phát Thiết bị thông minh & Trợ lý AI**  
> Dự án môn học: **Thực tập Cơ sở 02 (TTCS02)**  
> Đơn vị: **Khoa Công nghệ Thông tin — Trường Đại học Công nghệ Thông tin & Truyền thông (ICTU)**

---

## 👨‍🏫 Thông tin Giảng viên & Nhóm Thực hiện

* **Giảng viên hướng dẫn (Mentor):** **ThS. Nguyễn Khánh Tùng**
* **Trưởng nhóm (Scrum Master):** **Hoàng Thanh Phương**
* **Đơn vị:** Nhóm 4 — Thực tập Cơ sở 02

### 👥 Bảng Phân công Nhiệm vụ Thành viên

| STT | Thành viên | Vai trò | Nhánh Git phụ trách | Nhiệm vụ chính phụ trách |
|:---:|:---|:---|:---|:---|
| 1 | **Hoàng Thanh Phương** | **Trưởng nhóm / Scrum Master / Fullstack** | `hoangphuong`, `main` | Quản trị dự án, tích hợp hệ thống, Chatbot AI, Approval Workflow, HRM Integration, Phân quyền & Bảo mật phiên |
| 2 | **Phạm Đình Sơn** | System Architect | `feature/sprint1-auth-rbac-phamdinhhson` | Thiết kế kiến trúc 3 lớp, Coding Conventions, cấu trúc thư mục & luồng RBAC |
| 3 | **Nguyễn Ngọc Phúc** | Database Engineer (DBA) | `feature/sprint1-database-erd-nguyenngocphuc` | Thiết kế mô hình ERD, quan hệ bảng SQLAlchemy ORM, Migration & Seed Data mẫu |
| 4 | **Hoàng Văn Thoại** | Backend API Developer | `feature/sprint2-backend-api-hoangvanthoai` | Xây dựng API Quản lý cuộc họp, phòng họp, thuật toán Conflict Detection Engine |
| 5 | **Hà Văn Thắng** | DevOps & CI/CD | `feature/sprint2-devops-ci-havanxthang` | Thiết lập Git branching strategy, quy chuẩn commit, cấu hình môi trường `.env` & tự động hóa |
| 6 | **Lê Thị Minh Thư** | UI/UX Designer | `feature/sprint2-uiux-design-lethiminthu` | Thiết kế Wireframe, Design Tokens, bảng màu (Design System) & trải nghiệm người dùng |
| 7 | **Long Hoàng Tiến** | Frontend Developer | `feature/sprint3-frontend-components-longhoang` | Phát triển các UI Components chính: TimetableGrid, Quản lý thiết bị, Layout |
| 8 | **Nguyễn Văn Thái** | Integration Engineer | `feature/sprint3-api-integration-nguyenvanthai` | Tích hợp API Frontend - Backend, Axios Interceptors, Quản lý State AuthContext |
| 9 | **Vũ Hồng Nhung** | Business Analyst & QA | `feature/sprint1-ba-qa-vuhongnhung` | Phân tích 28 User Stories, viết kịch bản kiểm thử Acceptance Criteria (AC1 - AC6) |
| 10 | **Nguyễn Thị Hà Phương** | QA & Technical Writer | `feature/sprint4-qa-docs-nguyenthihaphuong` | Kiểm thử tích hợp hệ thống (UAT Testing), xây dựng tài liệu hướng dẫn người dùng & báo cáo nghiệm thu |

---

## 🌟 Giới thiệu Tổng quan & Tính năng Nổi bật

Hệ thống **ICTU Meeting Management** được xây dựng toàn diện theo mô hình Agile/Scrum qua 4 Sprint phát triển, đáp ứng trọn vẹn 28 Product Backlog Items:

1. **🔐 Xác thực & Phân quyền đa cấp (RBAC):**
   - Hỗ trợ 3 vai trò chặt chẽ: `ADMIN` (Quản trị viên), `LECTURER / ORGANIZER` (Giảng viên / Người đặt lịch), `STUDENT / PARTICIPANT` (Sinh viên / Khách mời).
   - Cơ chế bảo mật JWT, mã hóa mật khẩu bằng `bcrypt`.
   - **Tự động ngắt phiên (Session Invalidation):** Lập tức chấm dứt phiên làm việc và đăng xuất khi tài khoản bị quản trị viên tạm khóa.
2. **📅 Thuật toán Chống Trùng Lịch (Conflict Detection Engine):**
   - Kiểm tra giao thoa thời gian thực: $(startA < endB) \land (endA > startB)$.
   - Phát hiện xung đột 3 lớp: **Trùng phòng**, **Trùng người tham gia**, **Trùng thiết bị mượn kèm**.
   - Tự động gợi ý 3 khung giờ rảnh gần nhất khi xảy ra xung đột.
3. **🏢 Bảng Ma trận Lịch họp Thông minh (Timetable Grid):**
   - Theo dõi trực quan theo ma trận Ngày/Tuần, mã màu trạng thái cuộc họp rõ ràng.
   - Thao tác kéo/chọn giờ đặt phòng trực tiếp, đồng bộ tức thời giữa Admin và Giảng viên.
4. **📦 Quản lý Cấp phát & Mượn Thiết bị (Equipment Management):**
   - Phân loại thiết bị cố định tại phòng và thiết bị di động dùng chung.
   - Theo dõi tình trạng thiết bị (`AVAILABLE`, `MAINTENANCE`, `BROKEN`).
   - Tự động giải phóng tài nguyên phòng và thiết bị khi cuộc họp bị hủy.
5. **🛡️ Quy trình Phê duyệt Trực tuyến (Approval Workflow):**
   - Giảng viên gửi yêu cầu đặt phòng VIP / thiết bị đặc biệt.
   - Admin tiếp nhận, xem xét và phê duyệt / từ chối kèm lý do phản hồi thời gian thực.
6. **🤖 Trợ lý AI Đặt phòng & Trợ giúp Họp (AI Chatbot Widget):**
   - Tích hợp Bot AI thông minh hỗ trợ hỏi đáp nhanh lịch trống, quy định phòng họp và trợ giúp đặt lịch tự động.
7. **📱 Check-in Phòng họp bằng QR Code:**
   - Tự động sinh mã QR động theo từng cuộc họp để người tham gia quét xác nhận hiện diện tại cửa phòng.
8. **🔔 Hệ thống Thông báo & Nhắc lịch T-15:**
   - Thông báo thời gian thực về trạng thái phê duyệt, lời mời họp.
   - Tự động cảnh báo nhắc lịch trước 15 phút.
9. **👥 Tích hợp HRM & Quản lý Tổ chức:**
   - Đồng bộ danh mục Khoa, Phòng ban, Giảng viên, Sinh viên từ hệ thống quản lý nhân sự.
10. **📊 Dashboard Phân tích & Báo cáo Trực quan (Analytics):**
    - Biểu đồ thống kê tỷ lệ lấp đầy phòng, tần suất họp và KPI sử dụng tài nguyên.

---

## 🛠️ Công nghệ Sử dụng (Tech Stack)

### Backend
* **Ngôn ngữ:** Python 3.10+
* **Framework:** [FastAPI](https://fastapi.tiangolo.com/) (Hiệu năng cao, tự động sinh tài liệu Swagger / OpenAPI 3.1)
* **ORM & Database:** SQLAlchemy 2.0 + SQLite (hỗ trợ chuyển đổi linh hoạt sang PostgreSQL/MySQL)
* **Authentication:** PyJWT, Passlib, Bcrypt
* **Kiểm thử tự động:** TestClient với bộ kịch bản test tự động theo từng giai đoạn

### Frontend
* **Core:** [React 19](https://react.dev/) + [Vite](https://vite.dev/)
* **Ngôn ngữ:** TypeScript (Strict Type Safety)
* **Thư viện giao diện & Biểu đồ:** Lucide React Icons, Recharts, React-Hot-Toast, qrcode.react
* **Styling:** CSS Design Tokens hiện đại (Tech Navy, Royal Blue, Glassmorphism)

---

## 📂 Cấu trúc Thư mục Dự án

```text
Meeting-Management-Group4/
├── backend/
│   ├── app/
│   │   ├── api/v1/endpoints/  # APIs: auth, users, rooms, meetings, equipments, approvals, chatbot, integrations...
│   │   ├── core/              # Config, Security (JWT, bcrypt), Database session
│   │   ├── db/                # Khởi tạo schema và seed dữ liệu mẫu
│   │   ├── models/            # SQLAlchemy ORM Models (User, Role, Room, Meeting, Equipment, Approval...)
│   │   └── schemas/           # Pydantic Schemas validate dữ liệu đầu vào / đầu ra
│   ├── main.py                # Điểm khởi chạy ứng dụng FastAPI
│   ├── run.bat                # Script 1-click tự động kích hoạt venv và chạy server
│   ├── seed_data.py           # Script nạp dữ liệu mẫu ban đầu
│   ├── requirements.txt       # Danh sách thư viện Python
│   ├── test_phase1.py         # Test Suite: Auth & RBAC (9/9 passed)
│   ├── test_phase2.py         # Test Suite: Phòng họp & Giới hạn quyền (11/11 passed)
│   ├── test_phase3.py         # Test Suite: Đặt phòng & Chống trùng lịch (9/9 passed)
│   └── test_phase4.py         # Test Suite: Thiết bị & Mượn kèm (13/13 passed)
├── frontend/
│   ├── src/
│   │   ├── components/        # DashboardView, TimetableGrid, ApprovalsView, ChatbotWidget, DevicesView...
│   │   ├── context/           # AuthContext quản lý phiên đăng nhập và quyền hạn
│   │   ├── services/          # Axios API Client với interceptor tự động bắt lỗi
│   │   ├── App.tsx            # Điều hướng phân hệ Admin / Giảng viên / Sinh viên
│   │   └── index.css          # Design System và biến màu sắc
│   ├── package.json
│   └── vite.config.ts
├── docs/                      # Tài liệu phân tích yêu cầu, Acceptance Criteria & kiểm thử
├── user_story_acceptance_criteria.md  # Chi tiết 28 User Stories & tiêu chí nghiệm thu
└── TIEN_DO_XAY_DUNG.md        # Kế hoạch và nhật ký tiến độ các Sprint
```

---

## 🚀 Hướng dẫn Cài đặt & Khởi chạy

### 1. Khởi chạy Backend (FastAPI)

> **Mẹo nhanh trên Windows:** Bạn chỉ cần nhấp đúp vào file `backend/run.bat`, hệ thống sẽ tự động tạo `.venv`, cài đặt thư viện và khởi chạy server.

Hoặc chạy thủ công bằng dòng lệnh:
```bash
# 1. Di chuyển vào thư mục backend
cd backend

# 2. Tạo và kích hoạt môi trường ảo
python -m venv .venv
# Trên Windows:
.\.venv\Scripts\Activate.ps1
# Trên Linux/macOS:
source .venv/bin/activate

# 3. Cài đặt thư viện
pip install -r requirements.txt

# 4. Nạp dữ liệu mẫu (chỉ cần chạy lần đầu)
python seed_data.py

# 5. Khởi chạy server
python -m uvicorn app.main:app --reload --port 8000
```
* **Swagger API Documentation:** `http://localhost:8000/docs`
* **Health Check API:** `http://localhost:8000/health`

---

### 2. Khởi chạy Frontend (React + Vite)
Yêu cầu: Đã cài đặt **Node.js 18+**.

```bash
# 1. Di chuyển vào thư mục frontend
cd frontend

# 2. Cài đặt dependencies
npm install

# 3. Chạy server phát triển
npm run dev
```
* **Địa chỉ truy cập ứng dụng:** `http://localhost:5173`

---

## 👥 Danh sách Tài khoản Thử nghiệm (Demo Accounts)

Hệ thống đã chuẩn bị sẵn các tài khoản demo đầy đủ dữ liệu cho từng vai trò để Mentor và Hội đồng kiểm tra:

| Vai trò (Role) | Họ và tên | Email đăng nhập | Mật khẩu | Quyền hạn chính |
|:---|:---|:---|:---:|:---|
| 👑 **Quản trị viên (ADMIN)** | Hoàng Phương | `admin@ictu.edu.vn` | `123456` | Toàn quyền: Quản trị phòng họp, phê duyệt mượn thiết bị/phòng, quản lý người dùng, xem báo cáo thống kê |
| 👨‍🏫 **Giảng viên (LECTURER)** | Hoàng Thanh Phương | `hoangphuong@ictu.edu.vn` | `123456` | Đặt phòng họp, gửi yêu cầu mượn thiết bị, mời sinh viên, trao đổi chat, quản lý lịch của mình |
| 🎓 **Sinh viên (STUDENT)** | Trần Văn D | `sinhvien_d@ictu.edu.vn` | `123456` | Xem lịch họp được mời, phản hồi tham gia (RSVP), quét mã QR check-in, chat với Giảng viên |
| 🎓 **Sinh viên (STUDENT)** | Phạm Thị E | `sinhvien_e@ictu.edu.vn` | `123456` | Tài khoản sinh viên tham gia kiểm thử lời mời và kiểm tra chống trùng lịch |

---

## 🧪 Kiểm thử Tự động (Automated Test Suites)

Hệ thống tích hợp bộ kịch bản kiểm thử tự động toàn diện qua các Sprint:

```bash
cd backend
python test_phase1.py   # Kiểm thử Phân quyền & Xác thực RBAC (9/9 Passed)
python test_phase2.py   # Kiểm thử Quản lý Phòng họp & Phân quyền phòng (11/11 Passed)
python test_phase3.py   # Kiểm thử Thuật toán Chống Trùng Lịch (9/9 Passed)
python test_phase4.py   # Kiểm thử Cấp phát & Xung đột Thiết bị (13/13 Passed)
python test_approvals.py # Kiểm thử Luồng Phê duyệt Đặt phòng/Thiết bị
```

---

## 📄 Bản quyền & Đóng góp
Dự án được xây dựng và hoàn thiện bởi **Nhóm 4 — Môn Thực tập Cơ sở 02**, Khoa Công nghệ Thông tin, Trường Đại học Công nghệ Thông tin & Truyền thông (ICTU).
