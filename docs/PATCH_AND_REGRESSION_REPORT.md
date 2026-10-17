# 🛠️ BÁO CÁO SỬA LỖI & KIỂM THỬ HỒI QUY (PATCH & REGRESSION REPORT)
**Dự án**: Meeting Management System (Quản lý Lịch họp MVP) — Group 4  
**Vai trò**: Coding Agent (Tiếp nhận báo cáo QA, Sửa lỗi mã nguồn, Chạy lại kiểm thử, Báo cáo thay đổi)  
**Thời gian thực hiện**: 17/10/2026  
**Trạng thái kiểm thử sau sửa lỗi**: **100% PASS trên tất cả các test suites**  

---

## 📌 Tổng quan Kết quả Thực hiện

Toàn bộ các lỗi nghiêm trọng (Critical), mức độ cao (High), và bất đồng bộ hệ thống (Medium/Low) đã được khắc phục chính xác, triệt để trong phạm vi mã nguồn backend và script kiểm thử:

1. **Khắc phục lỗi sập Server 500 khi mời người tham gia cuộc họp**: Đồng bộ hóa trường `rsvp_status` của `MeetingParticipant`.
2. **Hiện thực hóa Thuật toán Chống Trùng Lịch Phòng (Room Conflict Detection)**: Bổ sung logic kiểm tra xung đột phòng trong `POST /api/v1/meetings`.
3. **Mở rộng kiểm tra trạng thái cuộc họp trong `update_meeting`**: Đưa thêm trạng thái `SCHEDULED` và `IN_PROGRESS` vào danh sách kiểm tra xung đột khi sửa giờ/phòng/thiết bị.
4. **Chống phê duyệt trùng thiết bị trong Đơn mượn thiết bị**: Bổ sung kiểm tra trùng lặp khung giờ trước khi Admin duyệt `approve_borrow_request`.
5. **Đồng bộ hóa tài khoản demo trong `init_db.py`**: Khởi tạo đầy đủ cả tài khoản theo `README.md` (`admin@ictu.vn / Admin@123`) và tài khoản `admin@ictu.edu.vn`.
6. **Bảo vệ toàn vẹn dữ liệu khi xóa phòng & khóa user**: Chặn xóa phòng có lịch họp sắp tới, chặn Admin tự khóa tài khoản của mình.
7. **Sửa lỗi cú pháp f-string trong `qa_full_test.py`** để tương thích hoàn toàn với Python 3.12+.

---

## 📊 Bảng Thống kê Kết quả Chạy Lại Kiểm thử (Regression Testing)

| Bộ Test Suite | Mục tiêu kiểm thử | Trước khi sửa | Sau khi sửa | Trạng thái |
| :--- | :--- | :---: | :---: | :---: |
| **`qa_verification_suite.py`** | 24 test cases toàn diện của QA Agent | 19 / 24 (79.2%) | **24 / 24 (100%)** | 🟢 **PASS** |
| **`qa_full_test.py`** | 81 test cases toàn diện hệ thống | Syntax Error (0%) | **81 / 81 (100%)** | 🟢 **PASS** |
| **`test_phase1.py`** | Auth & RBAC (9 test cases) | Fail bước Login | **9 / 9 (100%)** | 🟢 **PASS** |
| **`test_phase2.py`** | Quản lý Phòng & Giới hạn (11 test cases) | Fail bước Login | **11 / 11 (100%)** | 🟢 **PASS** |
| **`test_phase3.py`** | Đặt phòng & Chống trùng lịch (9 test cases) | Fail bước Login | **9 / 9 (100%)** | 🟢 **PASS** |
| **`test_phase4.py`** | Quản lý Thiết bị & Mượn kèm (13 test cases) | PASS | **13 / 13 (100%)** | 🟢 **PASS** |
| **`test_approvals.py`** | Quy trình Phê duyệt Admin (8 test cases) | PASS | **8 / 8 (100%)** | 🟢 **PASS** |

---

## 📝 Chi tiết Mã Nguồn Chỉnh Sửa (Code Diffs)

### 1. File `backend/app/api/v1/endpoints/meetings.py`

#### A. Bổ sung kiểm tra trùng lịch phòng (Room Conflict) trong `create_meeting`:
```diff
@@ -101,6 +101,19 @@
                         detail=f"Vai trò '{current_user.role.role_name}' không có quyền đặt phòng '{room.room_name}'. Phòng này bị giới hạn quyền truy cập."
                     )
 
+        # ── 3.1. KIỂM TRA XUNG ĐỘT PHÒNG HỌP (Room Conflict Detection) ──
+        conflict_room = db.query(Meeting).filter(
+            Meeting.room_id == data.room_id,
+            Meeting.status.in_(["SCHEDULED", "PENDING", "APPROVED", "IN_PROGRESS"]),
+            Meeting.start_time < data.end_time,
+            Meeting.end_time > data.start_time
+        ).first()
+        if conflict_room:
+            raise HTTPException(
+                status_code=409,
+                detail=f"Trùng lịch phòng! Phòng '{room.room_name}' đã có cuộc họp '{conflict_room.title}' ({conflict_room.start_time.strftime('%H:%M')} - {conflict_room.end_time.strftime('%H:%M')}) trong khoảng thời gian này."
+            )
+
         # ── 4. KIỂM TRA THIẾT BỊ VÀ PHÁT HIỆN XUNG ĐỘT (Conflict Detection) ──
```

#### B. Sửa lỗi `status` sang `rsvp_status` của `MeetingParticipant`:
```diff
@@ -156,7 +169,7 @@
             for uid in set(data.participant_ids):
                 u = db.query(User).filter(User.user_id == uid).first()
                 if u:
-                    participant = MeetingParticipant(meeting_id=meeting.meeting_id, user_id=uid, status="PENDING")
+                    participant = MeetingParticipant(meeting_id=meeting.meeting_id, user_id=uid, rsvp_status="PENDING")
                     db.add(participant)
```

#### C. Bổ sung trạng thái `SCHEDULED` và `IN_PROGRESS` vào `update_meeting`:
```diff
@@ -263,7 +276,7 @@
         conflict = db.query(Meeting).filter(
             Meeting.room_id == target_room,
             Meeting.meeting_id != meeting_id,
-            Meeting.status.in_(["PENDING", "APPROVED"]),
+            Meeting.status.in_(["SCHEDULED", "PENDING", "APPROVED", "IN_PROGRESS"]),
             Meeting.start_time < new_et,
             Meeting.end_time > new_st
         ).first()
@@ -288,7 +301,7 @@
                 .filter(
                     MeetingEquipment.equipment_id == eq_id,
                     Meeting.meeting_id != meeting_id,
-                    Meeting.status.in_(["PENDING", "APPROVED"]),
+                    Meeting.status.in_(["SCHEDULED", "PENDING", "APPROVED", "IN_PROGRESS"]),
                     Meeting.start_time < new_et,
                     Meeting.end_time > new_st
                 )
```

---

### 2. File `backend/app/api/v1/endpoints/equipment_requests.py`

#### Chặn phê duyệt trùng thiết bị trong cùng khung giờ:
```diff
@@ -138,6 +138,21 @@
     if not req:
         raise HTTPException(status_code=404, detail="Không tìm thấy yêu cầu mượn thiết bị")
 
+    # Kiểm tra xung đột với đơn mượn khác đã duyệt
+    conflict_borrow = db.query(EquipmentBorrowRequest).filter(
+        EquipmentBorrowRequest.equipment_id == req.equipment_id,
+        EquipmentBorrowRequest.id != req.id,
+        EquipmentBorrowRequest.status == "APPROVED",
+        EquipmentBorrowRequest.start_time < req.end_time,
+        EquipmentBorrowRequest.end_time > req.start_time
+    ).first()
+    if conflict_borrow:
+        eq_title = req.equipment.equipment_name if req.equipment else f"ID {req.equipment_id}"
+        raise HTTPException(
+            status_code=409,
+            detail=f"Trùng lịch thiết bị! Thiết bị '{eq_title}' đã được duyệt cho đơn mượn khác ({conflict_borrow.start_time.strftime('%H:%M')} - {conflict_borrow.end_time.strftime('%H:%M')})."
+        )
+
     req.status = "APPROVED"
```

---

### 3. File `backend/app/api/v1/endpoints/rooms.py`

#### Chặn xóa phòng họp đang có cuộc họp lên lịch:
```diff
@@ -142,6 +142,16 @@
     if not room:
         raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy phòng họp")
 
+    active_meeting = db.query(Meeting).filter(
+        Meeting.room_id == room_id,
+        Meeting.status.in_(["SCHEDULED", "PENDING", "APPROVED", "IN_PROGRESS"])
+    ).first()
+    if active_meeting:
+        raise HTTPException(
+            status_code=status.HTTP_400_BAD_REQUEST,
+            detail=f"Không thể xóa phòng '{room.room_name}' vì đang có cuộc họp '{active_meeting.title}' được lên lịch"
+        )
+
     db.delete(room)
     db.commit()
```

---

### 4. File `backend/app/api/v1/endpoints/users.py`

#### Chặn Admin tự vô hiệu hóa tài khoản của chính mình:
```diff
@@ -143,6 +143,12 @@
     db: Session = Depends(get_db),
     _current_user: User = Depends(require_roles(["ADMIN"]))
 ):
+    if _current_user.user_id == user_id:
+        raise HTTPException(
+            status_code=status.HTTP_400_BAD_REQUEST,
+            detail="Bạn không thể tự vô hiệu hóa tài khoản của chính mình"
+        )
+
     user = db.query(User).filter(User.user_id == user_id).first()
```

---

### 5. File `backend/app/db/init_db.py`

#### Đồng bộ hóa tài khoản mẫu theo tài liệu `README.md`:
Bổ sung các tài khoản demo:
* Admin: `admin@ictu.vn` / `Admin@123`
* Giảng viên: `organizer@ictu.vn` / `123456`
* Sinh viên: `student1@ictu.vn` / `password123`
Bên cạnh các tài khoản `.edu.vn` sẵn có, đảm bảo khả năng tương thích 100% với tài liệu và tất cả các giai đoạn kiểm thử.

---

### 6. File `backend/qa_full_test.py`

#### Khắc phục lỗi cú pháp f-string escape trên Python 3.12+:
Thay thế `f'Bearer {tokens[\"admin\"]}'` bằng `f"Bearer {tokens['admin']}"` tại các dòng 60, 71, 78, 82, 87, 88, 89 và 303.
