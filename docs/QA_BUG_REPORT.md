# 📋 BÁO CÁO KIỂM THỬ CHẤT LƯỢNG PHẦN MỀM (QA BUG REPORT)
**Dự án**: Meeting Management System (Quản lý Lịch họp MVP) — Group 4  
**Vai trò**: QA Agent (Kiểm thử, Đọc code, Viết test, Bắt lỗi — Giữ nguyên mã nguồn ứng dụng)  
**Thời gian thực hiện**: 17/10/2026  
**Môi trường kiểm thử**: Python 3.15, FastAPI TestClient, SQLite / In-Memory DB  

---

## Executive Summary (Tổng quan Kết quả Kiểm thử)

Đội ngũ QA đã tiến hành rà soát mã nguồn tĩnh (Static Code Review), thiết kế kịch bản kiểm thử tự động toàn diện qua file `backend/qa_verification_suite.py`, và thực thi kiểm thử 24 test cases trải dài trên tất cả các phân hệ: **Xác thực & RBAC**, **Quản trị người dùng**, **Quản lý phòng họp & giới hạn**, **Đặt lịch & Chống trùng lịch**, **Quản lý & Mượn thiết bị**.

* **Tổng số Test Cases**: 24
* **Số Test Cases ĐẠT (PASS)**: 19 (79.2%)
* **Số Test Cases PHÁT HIỆN LỖI (FAIL)**: 5 (20.8%)
* **Tổng số lỗi được phân tích & định danh**: 9 lỗi (2 Critical, 2 High, 3 Medium, 2 Low)

> [!CAUTION]
> **2 LỖI NGHIÊM TRỌNG (CRITICAL)** phát hiện được ảnh hưởng trực tiếp đến nghiệp vụ cốt lõi của hệ thống:
> 1. Tính năng **mời người tham gia cuộc họp** bị sập với mã lỗi `500 Internal Server Error` do sai tên trường trong ORM model.
> 2. Endpoint **tạo cuộc họp mới hoàn toàn thiếu thuật toán kiểm tra trùng phòng**, cho phép đặt chồng chéo vô số cuộc họp lên cùng một phòng trong cùng một khung giờ.

---

## 🎯 Bảng Tổng hợp Lỗi (Bug Tracking Matrix)

| ID | Module / Phân hệ | Mức độ nghiêm trọng | Tóm tắt lỗi | Trạng thái |
| :--- | :--- | :--- | :--- | :--- |
| **BUG-01** | Meeting Management | 🔴 **CRITICAL** | Crash 500 khi tạo cuộc họp có người tham gia (`status` vs `rsvp_status`) | Đã tái hiện |
| **BUG-02** | Conflict Detection | 🔴 **CRITICAL** | Thiếu hoàn toàn kiểm tra trùng phòng trong `POST /api/v1/meetings` | Đã tái hiện |
| **BUG-03** | Meeting Management | 🟠 **HIGH** | `PUT /api/v1/meetings/{id}` bỏ qua kiểm tra xung đột với lịch `SCHEDULED` | Đã tái hiện |
| **BUG-04** | Equipment Requests | 🟠 **HIGH** | Admin có thể duyệt 2 đơn mượn cùng thiết bị trùng khung giờ | Đã tái hiện |
| **BUG-05** | Docs & Test Suite | 🟡 **MEDIUM** | Bất đồng bộ tài khoản mẫu giữa `README.md`, `init_db.py`, và test cũ | Đã xác nhận |
| **BUG-06** | Test Compatibility | 🟡 **MEDIUM** | Lỗi cú pháp f-string trong `qa_full_test.py` trên Python 3.12+ | Đã xác nhận |
| **BUG-07** | Room Management | 🟡 **MEDIUM** | Xóa phòng họp không kiểm tra ràng buộc toàn vẹn dữ liệu cuộc họp | Đã xác nhận |
| **BUG-08** | User Management | 🔵 **LOW** | Endpoint vô hiệu hóa tài khoản cho phép Admin tự khóa chính mình | Đã xác nhận |
| **BUG-09** | Frontend Architecture| 🔵 **LOW** | Một số component frontend (`UserManagement`, `AuditLog`) dùng mock data | Đã xác nhận |

---

## 🔍 Chi tiết Từng Lỗi (Defect Details)

### 🔴 BUG-01: Crash 500 khi Tạo Cuộc Họp Có Danh Sách Người Tham Gia (`participant_ids`)

* **Mức độ**: 🔴 **CRITICAL** (Chặn hoàn toàn tính năng cơ bản của hệ thống)
* **Vị trí code**: [backend/app/api/v1/endpoints/meetings.py:L160](file:///d:/Antigravity%20IDE/Meeting-Management-Group4-main/backend/app/api/v1/endpoints/meetings.py#L160)
* **Model liên quan**: [backend/app/models/meeting.py:L39](file:///d:/Antigravity%20IDE/Meeting-Management-Group4-main/backend/app/models/meeting.py#L39)
* **Test Case minh chứng**: `T-MEET-04` trong `backend/qa_verification_suite.py`

#### Mô tả:
Trong model `MeetingParticipant`, cột trạng thái được đặt tên là `rsvp_status`:
```python
# app/models/meeting.py (Dòng 39)
rsvp_status = Column(String(50), default="PENDING")
```
Tuy nhiên, trong logic xử lý tạo cuộc họp tại `create_meeting`, code lại khởi tạo:
```python
# app/api/v1/endpoints/meetings.py (Dòng 160)
participant = MeetingParticipant(meeting_id=meeting.meeting_id, user_id=uid, status="PENDING")
```

#### Các bước tái hiện (Steps to Reproduce):
1. Đăng nhập tài khoản Organizer hoặc Admin để nhận JWT token.
2. Gửi request `POST /api/v1/meetings` với payload có danh sách người tham gia:
   ```json
   {
     "room_id": 1,
     "title": "Họp triển khai",
     "start_time": "2026-10-18T08:00:00",
     "end_time": "2026-10-18T10:00:00",
     "participant_ids": [3]
   }
   ```
3. Quan sát kết quả trả về.

#### Kết quả thực tế (Actual Behavior):
Server bắt lỗi ngoại lệ không mong muốn và trả về mã lỗi **`500 Internal Server Error`**:
```json
{
  "detail": "'status' is an invalid keyword argument for MeetingParticipant"
}
```

#### Kết quả mong muốn (Expected Behavior):
Tạo cuộc họp thành công với mã `201 Created`, lưu thông tin participant với `rsvp_status = "PENDING"`.

---

### 🔴 BUG-02: Thiếu Hoàn Toàn Kiểm Tra Trùng Phòng Khi Tạo Cuộc Họp Mới (`POST /api/v1/meetings`)

* **Mức độ**: 🔴 **CRITICAL** (Vi phạm trực tiếp yêu cầu cốt lõi US #4 và AC 4)
* **Vị trí code**: [backend/app/api/v1/endpoints/meetings.py:L80-L133](file:///d:/Antigravity%20IDE/Meeting-Management-Group4-main/backend/app/api/v1/endpoints/meetings.py#L80-L133)
* **Test Case minh chứng**: `T-MEET-06` trong `backend/qa_verification_suite.py`

#### Mô tả:
Tài liệu `README.md` và `TIEN_DO_XAY_DUNG.md` khẳng định: *"Thuật toán Chống Trùng Lịch (Conflict Detection Engine): Tự động phát hiện và chặn các xung đột lịch phòng và người tham gia trong cùng một khung thời gian."*
Tuy nhiên, khi kiểm tra mã nguồn tại hàm `create_meeting`:
- Bước 1: Kiểm tra `start_time >= end_time`
- Bước 2: Kiểm tra phòng tồn tại và không phải `MAINTENANCE`
- Bước 3: Kiểm tra quyền đặt phòng theo vai trò (`RoomRestriction`)
- Bước 4: Kiểm tra xung đột thiết bị (`equipment_ids`)
- Bước 5: **TẠO CUỘC HỌP LUÔN VÀO CƠ SỞ DỮ LIỆU!**
Hoàn toàn **không có bất kỳ dòng code nào truy vấn kiểm tra xem phòng đó đã có cuộc họp nào diễn ra trong khoảng `(start_time, end_time)` hay chưa!**

#### Các bước tái hiện (Steps to Reproduce):
1. Admin tạo Cuộc họp A tại Phòng 1 từ `08:00` đến `10:00` ngày mai -> Tạo thành công (Status: `SCHEDULED`).
2. Admin (hoặc Giảng viên) tạo tiếp Cuộc họp B tại cùng Phòng 1 từ `09:00` đến `11:00` (bị đè 1 tiếng từ 9h đến 10h).
3. Quan sát response của Cuộc họp B.

#### Kết quả thực tế (Actual Behavior):
Hệ thống trả về **`201 Created`** và lưu cả 2 cuộc họp trùng giờ vào Database mà không đưa ra bất kỳ cảnh báo nào.

#### Kết quả mong muốn (Expected Behavior):
Hệ thống phải trả về **`409 Conflict`** và thông báo chi tiết: *"Trùng lịch phòng! Phòng 'Hội trường C1' đã có cuộc họp khác trong khoảng thời gian này"*.

---

### 🟠 BUG-03: Bỏ Qua Kiểm Tra Xung Đột với Cuộc Họp `SCHEDULED` Khi Cập Nhật Giờ (`PUT /api/v1/meetings/{id}`)

* **Mức độ**: 🟠 **HIGH**
* **Vị trí code**: [backend/app/api/v1/endpoints/meetings.py:L268](file:///d:/Antigravity%20IDE/Meeting-Management-Group4-main/backend/app/api/v1/endpoints/meetings.py#L268), [L294](file:///d:/Antigravity%20IDE/Meeting-Management-Group4-main/backend/app/api/v1/endpoints/meetings.py#L294)
* **Test Case minh chứng**: `T-MEET-08` trong `backend/qa_verification_suite.py`

#### Mô tả:
Trong hàm `update_meeting`, khi kiểm tra conflict phòng và conflict thiết bị:
```python
# meetings.py dòng 268:
conflict = db.query(Meeting).filter(
    Meeting.room_id == target_room,
    Meeting.meeting_id != meeting_id,
    Meeting.status.in_(["PENDING", "APPROVED"]),  # <--- THIẾU "SCHEDULED"
    Meeting.start_time < new_et,
    Meeting.end_time > new_st
).first()
```
Tất cả các cuộc họp do Admin tạo ra trực tiếp hoặc sau khi được Admin phê duyệt (`approve_meeting`) đều có trạng thái là **`SCHEDULED`**. Do mảng kiểm tra chỉ có `["PENDING", "APPROVED"]`, thuật toán bỏ qua toàn bộ các cuộc họp đang hoạt động có trạng thái `SCHEDULED`!

#### Các bước tái hiện:
1. Có cuộc họp X đang `SCHEDULED` từ 08:00 - 10:00 tại Phòng 1.
2. Có cuộc họp Y đang ở khung giờ 17:00 - 18:00.
3. Người dùng sửa cuộc họp Y chuyển giờ sang 08:30 - 09:30 tại Phòng 1.

#### Kết quả thực tế:
Cập nhật thành công (`200 OK`), đè trực tiếp lên cuộc họp X.

#### Kết quả mong muốn:
Trả về `409 Conflict` do trùng khung giờ với cuộc họp `SCHEDULED`.

---

### 🟠 BUG-04: Admin Có Thể Duyệt Trùng Lịch Thiết Bị Cho 2 Đơn Mượn Khác Nhau (`PATCH /equipment-requests/{id}/approve`)

* **Mức độ**: 🟠 **HIGH**
* **Vị trí code**: [backend/app/api/v1/endpoints/equipment_requests.py:L129-L146](file:///d:/Antigravity%20IDE/Meeting-Management-Group4-main/backend/app/api/v1/endpoints/equipment_requests.py#L129-L146)
* **Test Case minh chứng**: `T-EQ-03` trong `backend/qa_verification_suite.py`

#### Mô tả:
Khi Admin phê duyệt đơn mượn thiết bị ngoài cuộc họp (`EquipmentBorrowRequest`), hàm `approve_borrow_request` chỉ cập nhật:
```python
req.status = "APPROVED"
```
Không kiểm tra xem thiết bị đó đã được duyệt cho một đơn mượn khác hoặc đang được gán cho một cuộc họp nào khác trong cùng khung giờ `[start_time, end_time]` hay chưa.

#### Kết quả thực tế:
Cả 2 đơn mượn cùng 1 chiếc máy chiếu tại 2 giảng đường khác nhau đều được duyệt thành công `APPROVED`.

#### Kết quả mong muốn:
Đơn thứ hai phải bị từ chối phê duyệt với mã `409 Conflict` do thiết bị đã được phân bổ cho đơn mượn khác cùng giờ.

---

### 🟡 BUG-05: Bất Đồng Bộ Thông Tin Tài Khoản Mẫu (Demo Credentials) Giữa Tài Liệu và Mã Nguồn

* **Mức độ**: 🟡 **MEDIUM**
* **Vị trí**:
  - `README.md` (Dòng 132-136) & `test_phase1.py`, `test_phase2.py`, `test_phase3.py`
  - `backend/app/db/init_db.py` (Dòng 40, 57, 74)
  - `backend/seed_data.py` (Dòng 36, 53)

#### Mô tả chi tiết:
Có 3 nguồn tài khoản demo hoàn toàn khác nhau trong dự án:
1. **Trong README.md & các test phase 1-3**:
   - Admin: `admin@ictu.vn` / `Admin@123`
   - Giảng viên: `organizer@ictu.vn` / `123456`
   - Sinh viên: `student1@ictu.vn` / `password123`
2. **Trong init_db.py**:
   - Admin: `admin@ictu.edu.vn` / `123456`
   - Giảng viên: `giangvien@ictu.edu.vn` / `123456`
   - Sinh viên: `sinhvien@ictu.edu.vn` / `123456`
3. **Trong seed_data.py**:
   - Role Giảng viên đặt tên là `LECTURER` (trong khi hệ thống dùng `ORGANIZER`).
   - Email: `hoangphuong@ictu.edu.vn`, `tranthib@ictu.edu.vn`.

#### Hậu quả:
- Người dùng làm theo hướng dẫn trong `README.md` sẽ không thể đăng nhập được.
- Chạy các script test gốc `python test_phase1.py`, `test_phase2.py`, `test_phase3.py` bị FAIL ngay tại bước đăng nhập đầu tiên.

---

### 🟡 BUG-06: Lỗi Cú Pháp Backslash Trong F-String Tại `qa_full_test.py`

* **Mức độ**: 🟡 **MEDIUM**
* **Vị trí code**: [backend/qa_full_test.py:L60](file:///d:/Antigravity%20IDE/Meeting-Management-Group4-main/backend/qa_full_test.py#L60)

#### Mô tả:
Tại dòng 60:
```python
h = {'Authorization': f'Bearer {tokens[\"admin\"]}'}
```
Trên Python 3.12 trở lên, việc escape dấu ngoặc kép bên trong biểu thức f-string gây ra lỗi biên dịch:
`SyntaxError: unexpected character after line continuation character`. Khiến file không thể thực thi.

---

### 🟡 BUG-07: Xóa Phòng Họp Thiếu Kiểm Tra Ràng Buộc Với Cuộc Họp và Thiết Bị

* **Mức độ**: 🟡 **MEDIUM**
* **Vị trí code**: [backend/app/api/v1/endpoints/rooms.py:L135-L147](file:///d:/Antigravity%20IDE/Meeting-Management-Group4-main/backend/app/api/v1/endpoints/rooms.py#L135-L147)

#### Mô tả:
Khi Admin gọi `DELETE /api/v1/rooms/{room_id}`, API lập tức xóa phòng khỏi cơ sở dữ liệu mà không kiểm tra xem phòng này có đang chứa các cuộc họp sắp diễn ra hoặc thiết bị cố định hay không.
Nếu hệ thống có bật Foreign Key Constraint (ví dụ PostgreSQL hoặc SQLite kích hoạt foreign keys), thao tác sẽ sập với lỗi `IntegrityError` (500). Nếu không bật, các cuộc họp sẽ bị mồ côi (`room = None`), gây crash giao diện khi render lịch phòng.

---

### 🔵 BUG-08: Admin Có Thể Tự Vô Hiệu Hóa Tài Khoản Của Chính Mình

* **Mức độ**: 🔵 **LOW** (Lỗ hổng nghiệp vụ / Usability)
* **Vị trí code**: [backend/app/api/v1/endpoints/users.py:L140-L153](file:///d:/Antigravity%20IDE/Meeting-Management-Group4-main/backend/app/api/v1/endpoints/users.py#L140-L153)

#### Mô tả:
Endpoint `DELETE /api/v1/users/{user_id}` (vô hiệu hóa user) không có điều kiện kiểm tra `if user_id == current_user.user_id`. Nếu Admin vô tình gửi request với chính ID của mình, tài khoản sẽ chuyển thành `INACTIVE` và Admin bị lockout vĩnh viễn khỏi hệ thống.

---

### 🔵 BUG-09: Component `UserManagement` và `AuditLogViewer` Dùng Mock Data

* **Mức độ**: 🔵 **LOW**
* **Vị trí code**: [frontend/src/components/UserManagement.tsx:L20](file:///d:/Antigravity%20IDE/Meeting-Management-Group4-main/frontend/src/components/UserManagement.tsx#L20), [frontend/src/components/AuditLogViewer.tsx](file:///d:/Antigravity%20IDE/Meeting-Management-Group4-main/frontend/src/components/AuditLogViewer.tsx)

#### Mô tả:
- Màn hình Quản trị Người dùng trên Frontend không gọi endpoint `GET /api/v1/users` mà dùng mảng dữ liệu giả lập `MOCK_USERS`.
- Màn hình `AuditLogViewer.tsx` thực chất là trang cấu hình hệ thống lưu trong LocalStorage, chưa kết nối đến bảng `audit_logs` của backend.

---

## 🛠️ Khuyến nghị Khắc phục Dành Cho Đội Dev (Developer Recommendations)

1. **Khắc phục BUG-01 (Participant field mismatch)**:
   - Trong [backend/app/api/v1/endpoints/meetings.py:L160](file:///d:/Antigravity%20IDE/Meeting-Management-Group4-main/backend/app/api/v1/endpoints/meetings.py#L160), đổi `status="PENDING"` thành `rsvp_status="PENDING"`.
2. **Khắc phục BUG-02 (Missing Room Conflict Detection)**:
   - Bổ sung đoạn mã kiểm tra xung đột phòng trước khi tạo cuộc họp trong `create_meeting`:
     ```python
     conflict_room = db.query(Meeting).filter(
         Meeting.room_id == data.room_id,
         Meeting.status.in_(["SCHEDULED", "PENDING", "APPROVED", "IN_PROGRESS"]),
         Meeting.start_time < data.end_time,
         Meeting.end_time > data.start_time
     ).first()
     if conflict_room:
         raise HTTPException(
             status_code=409,
             detail=f"Trùng lịch phòng! Phòng '{room.room_name}' đã có cuộc họp '{conflict_room.title}' ({conflict_room.start_time.strftime('%H:%M')} - {conflict_room.end_time.strftime('%H:%M')})"
         )
     ```
3. **Khắc phục BUG-03 (Update Meeting Status Check)**:
   - Trong `update_meeting`, đổi `Meeting.status.in_(["PENDING", "APPROVED"])` thành `Meeting.status.in_(["SCHEDULED", "PENDING", "APPROVED", "IN_PROGRESS"])`.
4. **Khắc phục BUG-04 (Equipment Borrow Approval Conflict Check)**:
   - Trong `approve_borrow_request`, bổ sung truy vấn kiểm tra các đơn mượn hoặc cuộc họp khác đang sử dụng thiết bị trong cùng khung giờ trước khi chuyển trạng thái sang `APPROVED`.
5. **Đồng bộ hóa tài khoản mẫu**:
   - Cập nhật `init_db.py` và `README.md` thống nhất một bộ tài khoản mẫu chuẩn duy nhất.
