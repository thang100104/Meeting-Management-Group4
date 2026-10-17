"""
QA Verification Test Suite - Meeting Management System (Group 4)
Chạy toàn bộ các test cases để kiểm tra lỗi logic, RBAC, xung đột tài nguyên và exception handling.
LƯU Ý: KHÔNG SỬA CODE ỨNG DỤNG - ĐÂY LÀ SCRIPT TEST CỦA QA AGENT ĐỂ TÌM VÀ BÁO CÁO LỖI.
"""

import sys
import os
import traceback
from datetime import datetime, timedelta, timezone

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding='utf-8')
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding='utf-8')

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi.testclient import TestClient
from app.main import app
from app.core.database import SessionLocal, Base, engine
from app.models.role import Role
from app.models.department import Department
from app.models.user import User
from app.models.room import Room, RoomRestriction
from app.models.equipment import Equipment, MeetingEquipment, EquipmentBorrowRequest
from app.models.meeting import Meeting, MeetingParticipant
from app.core.security import get_password_hash

test_results = []

def record_test(test_id, category, name, passed, status, detail=""):
    test_results.append({
        "id": test_id,
        "category": category,
        "name": name,
        "passed": passed,
        "status": status,
        "detail": detail
    })
    icon = "✅ PASS" if passed else "❌ FAIL"
    print(f"[{icon}] {test_id} - {category}: {name} (Status: {status})")
    if not passed and detail:
        print(f"       -> Lỗi/Phát hiện: {detail}")

def reset_database():
    """Làm sạch DB và nạp dữ liệu chuẩn để kiểm thử"""
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        from app.db.init_db import init_db
        init_db(db)

        # Thêm 1 tài khoản inactive để phục vụ test T-AUTH-04
        r_part = db.query(Role).filter(Role.role_name == "PARTICIPANT").first()
        dept_cntt = db.query(Department).first()
        u_inactive = User(
            email="inactive@ictu.edu.vn",
            password_hash=get_password_hash("123456"),
            full_name="Tài khoản bị khóa",
            phone="0909999999",
            role_id=r_part.role_id,
            department_id=dept_cntt.department_id if dept_cntt else None,
            status="INACTIVE"
        )
        db.add(u_inactive)
        db.commit()

        print(">> Database đã được làm sạch và nạp dữ liệu mẫu ban đầu qua init_db!")
    finally:
        db.close()

def run_all_qa_tests():
    print("=" * 75)
    print("🔬 BẮT ĐẦU CHẠY BỘ TEST QA KIỂM THỬ TỰ ĐỘNG TOÀN DIỆN")
    print("=" * 75)

    reset_database()
    client = TestClient(app)

    # ----------------------------------------------------
    # PHẦN 1: AUTHENTICATION & SECURITY
    # ----------------------------------------------------
    print("\n--- [MODULE 1: AUTHENTICATION & SECURITY] ---")

    # T-AUTH-01: Đăng nhập tài khoản Admin chuẩn
    res = client.post("/api/v1/auth/login", json={"email": "admin@ictu.edu.vn", "password": "123456"})
    admin_token = res.json().get("access_token") if res.status_code == 200 else None
    record_test("T-AUTH-01", "Auth", "Đăng nhập Admin hợp lệ", res.status_code == 200, res.status_code, "" if res.status_code == 200 else res.text)
    admin_headers = {"Authorization": f"Bearer {admin_token}"} if admin_token else {}

    # T-AUTH-02: Kiểm tra tài khoản trong README.md (admin@ictu.vn / Admin@123)
    res_readme = client.post("/api/v1/auth/login", json={"email": "admin@ictu.vn", "password": "Admin@123"})
    record_test(
        "T-AUTH-02", "Doc/Auth", "Đăng nhập tài khoản demo theo README (admin@ictu.vn / Admin@123)",
        res_readme.status_code == 200, res_readme.status_code,
        "Không thể đăng nhập bằng tài khoản README tài liệu hóa (bất đồng bộ giữa README và Database Seed)" if res_readme.status_code != 200 else ""
    )

    # T-AUTH-03: Đăng nhập sai mật khẩu -> Phải 400
    res = client.post("/api/v1/auth/login", json={"email": "admin@ictu.edu.vn", "password": "WrongPassword"})
    record_test("T-AUTH-03", "Auth", "Đăng nhập sai mật khẩu -> 400 Bad Request", res.status_code == 400, res.status_code, res.text if res.status_code != 400 else "")

    # T-AUTH-04: Đăng nhập tài khoản bị INACTIVE -> Phải 403
    res = client.post("/api/v1/auth/login", json={"email": "inactive@ictu.edu.vn", "password": "123456"})
    record_test("T-AUTH-04", "Auth", "Đăng nhập tài khoản INACTIVE -> 403 Forbidden", res.status_code == 403, res.status_code, res.text if res.status_code != 403 else "")

    # T-AUTH-05: Lấy thông tin user hiện tại qua /api/v1/auth/me
    res = client.get("/api/v1/auth/me", headers=admin_headers)
    has_pwd = "password_hash" in res.json() or "password" in res.json() if res.status_code == 200 else True
    record_test("T-AUTH-05", "Security", "Endpoint /auth/me không được để lộ password hash", res.status_code == 200 and not has_pwd, res.status_code, "Lộ hash mật khẩu trong response" if has_pwd else "")

    # T-AUTH-06: Đổi mật khẩu ngắn < 6 ký tự -> Phải 400
    res = client.post("/api/v1/auth/change-password", json={"old_password": "123456", "new_password": "123"}, headers=admin_headers)
    record_test("T-AUTH-06", "Security", "Đổi mật khẩu mới ngắn (< 6 ký tự) -> 400 Bad Request", res.status_code == 400, res.status_code, res.text if res.status_code != 400 else "")

    # Đăng nhập Giảng viên & Sinh viên để lấy token
    res_org = client.post("/api/v1/auth/login", json={"email": "giangvien@ictu.edu.vn", "password": "123456"})
    org_token = res_org.json().get("access_token")
    org_headers = {"Authorization": f"Bearer {org_token}"}
    org_user_id = res_org.json().get("user_id")

    res_part = client.post("/api/v1/auth/login", json={"email": "sinhvien@ictu.edu.vn", "password": "123456"})
    part_token = res_part.json().get("access_token")
    part_headers = {"Authorization": f"Bearer {part_token}"}
    student_id = res_part.json().get("user_id")

    # ----------------------------------------------------
    # PHẦN 2: USER MANAGEMENT & RBAC
    # ----------------------------------------------------
    print("\n--- [MODULE 2: USER MANAGEMENT & RBAC] ---")

    # T-USER-01: Non-admin xem danh sách users -> Phải 403
    res = client.get("/api/v1/users", headers=org_headers)
    record_test("T-USER-01", "RBAC", "Giảng viên (Non-admin) xem danh sách User -> 403 Forbidden", res.status_code == 403, res.status_code, res.text if res.status_code != 403 else "")

    # T-USER-02: Tạo user trùng email -> Phải 400
    new_user_payload = {
        "email": "admin@ictu.edu.vn",
        "password": "Password123",
        "full_name": "Người dùng trùng email",
        "role_id": 1
    }
    res = client.post("/api/v1/users", json=new_user_payload, headers=admin_headers)
    record_test("T-USER-02", "Users", "Tạo user trùng email đã có -> 400 Bad Request", res.status_code == 400, res.status_code, res.text if res.status_code != 400 else "")

    # T-USER-03: Tạo user với role_id không tồn tại -> Phải 404
    bad_role_payload = {
        "email": "user_bad_role@ictu.edu.vn",
        "password": "Password123",
        "full_name": "Bad Role User",
        "role_id": 9999
    }
    res = client.post("/api/v1/users", json=bad_role_payload, headers=admin_headers)
    record_test("T-USER-03", "Users", "Tạo user với role_id không tồn tại -> 404 Not Found", res.status_code == 404, res.status_code, res.text if res.status_code != 404 else "")

    # ----------------------------------------------------
    # PHẦN 3: ROOMS & RESTRICTIONS
    # ----------------------------------------------------
    print("\n--- [MODULE 3: ROOMS & RESTRICTIONS] ---")

    # Lấy ID các phòng
    rooms_list = client.get("/api/v1/rooms", headers=admin_headers).json()
    room_c1_id = next(r["room_id"] for r in rooms_list if "C1" in r["room_name"])
    room_bgh_id = next(r["room_id"] for r in rooms_list if "Ban Giám hiệu" in r["room_name"])
    room_maint_id = next(r["room_id"] for r in rooms_list if "bảo trì" in r["room_name"])

    # T-ROOM-01: Tạo phòng trùng tên -> Phải 400
    existing_room_name = rooms_list[0]["room_name"]
    res = client.post("/api/v1/rooms", json={"room_name": existing_room_name, "capacity": 100, "location": "C1"}, headers=admin_headers)
    record_test("T-ROOM-01", "Rooms", "Tạo phòng trùng tên đã tồn tại -> 400 Bad Request", res.status_code == 400, res.status_code, res.text if res.status_code != 400 else "")

    # T-ROOM-02: Giảng viên cố tạo phòng -> Phải 403
    res = client.post("/api/v1/rooms", json={"room_name": "Phòng của GV", "capacity": 50, "location": "C3"}, headers=org_headers)
    record_test("T-ROOM-02", "RBAC", "Giảng viên cố tạo phòng họp mới -> 403 Forbidden", res.status_code == 403, res.status_code, res.text if res.status_code != 403 else "")

    # T-ROOM-03: Lọc phòng với only_allowed_for_me cho Sinh viên -> Không được thấy phòng BGH
    res = client.get("/api/v1/rooms?only_allowed_for_me=true", headers=part_headers)
    room_ids_seen = [r["room_id"] for r in res.json()]
    part_cannot_see_bgh = room_bgh_id not in room_ids_seen
    record_test("T-ROOM-03", "Rooms", "Sinh viên lọc phòng được phép đặt -> Bị ẩn phòng BGH", part_cannot_see_bgh, res.status_code, "Sinh viên vẫn nhìn thấy phòng BGH bị hạn chế" if not part_cannot_see_bgh else "")

    # ----------------------------------------------------
    # PHẦN 4: MEETINGS & CONFLICT DETECTION (CORE BUG HUNTING)
    # ----------------------------------------------------
    print("\n--- [MODULE 4: MEETINGS & CONFLICT DETECTION (CORE BUG HUNTING)] ---")

    tomorrow = datetime.now() + timedelta(days=1)
    st1 = tomorrow.replace(hour=8, minute=0, second=0, microsecond=0).isoformat()
    et1 = tomorrow.replace(hour=10, minute=0, second=0, microsecond=0).isoformat()

    # T-MEET-01: Sinh viên (PARTICIPANT) cố tạo lịch họp -> Phải 403
    meet_part_payload = {
        "room_id": room_c1_id,
        "title": "Sinh viên tự đặt họp",
        "start_time": st1,
        "end_time": et1
    }
    res = client.post("/api/v1/meetings", json=meet_part_payload, headers=part_headers)
    record_test("T-MEET-01", "RBAC", "Sinh viên (PARTICIPANT) cố tạo cuộc họp -> 403 Forbidden", res.status_code == 403, res.status_code, res.text if res.status_code != 403 else "")

    # T-MEET-02: Đặt lịch có end_time <= start_time -> Phải 400
    res = client.post("/api/v1/meetings", json={
        "room_id": room_c1_id,
        "title": "Họp giờ ngược",
        "start_time": et1,
        "end_time": st1
    }, headers=org_headers)
    record_test("T-MEET-02", "Validation", "Đặt lịch có end_time <= start_time -> 400 Bad Request", res.status_code == 400, res.status_code, res.text if res.status_code != 400 else "")

    # T-MEET-03: Đặt phòng đang bảo trì -> Phải 400
    res = client.post("/api/v1/meetings", json={
        "room_id": room_maint_id,
        "title": "Họp phòng bảo trì",
        "start_time": st1,
        "end_time": et1
    }, headers=org_headers)
    record_test("T-MEET-03", "Validation", "Đặt phòng đang bảo trì (MAINTENANCE) -> 400 Bad Request", res.status_code == 400, res.status_code, res.text if res.status_code != 400 else "")

    # T-MEET-04 (CRITICAL): Tạo cuộc họp có danh sách người tham gia (participant_ids)
    # BUG IDENTIFIED: models.meeting.MeetingParticipant có rsvp_status, nhưng endpoints/meetings.py truyền status="PENDING"
    st_part = tomorrow.replace(hour=6, minute=0, second=0, microsecond=0).isoformat()
    et_part = tomorrow.replace(hour=7, minute=0, second=0, microsecond=0).isoformat()
    res_meet_part = client.post("/api/v1/meetings", json={
        "room_id": room_c1_id,
        "title": "Họp mời sinh viên tham gia",
        "start_time": st_part,
        "end_time": et_part,
        "participant_ids": [student_id]
    }, headers=org_headers)
    record_test(
        "T-MEET-04", "Meetings (Critical)", "Tạo cuộc họp kèm danh sách người tham gia (participant_ids)",
        res_meet_part.status_code == 201, res_meet_part.status_code,
        f"Server sập 500 do lỗi gán trường 'status' thay vì 'rsvp_status' cho MeetingParticipant: {res_meet_part.text}" if res_meet_part.status_code != 201 else ""
    )

    # T-MEET-05: Tạo cuộc họp hợp lệ KHÔNG truyền participant_ids để phục vụ các test tiếp theo
    res_m1 = client.post("/api/v1/meetings", json={
        "room_id": room_c1_id,
        "title": "Họp Giao ban Khoa CNTT",
        "start_time": st1,
        "end_time": et1,
        "participant_ids": []
    }, headers=admin_headers) # Admin tạo -> status = "SCHEDULED"
    m1_id = res_m1.json().get("meeting_id") if res_m1.status_code == 201 else None
    record_test("T-MEET-05", "Meetings", "Admin tạo cuộc họp hợp lệ thành công -> 201 Created", res_m1.status_code == 201, res_m1.status_code, res_m1.text if res_m1.status_code != 201 else "")

    # T-MEET-06 (CRITICAL): PHÁT HIỆN TRÙNG LỊCH PHÒNG KHI TẠO CUỘC HỌP MỚI (POST /api/v1/meetings)
    # BUG IDENTIFIED: Trong endpoints/meetings.py -> create_meeting HOÀN TOÀN KHÔNG CÓ CODE KIỂM TRA CONFLICT PHÒNG!
    st_overlap = tomorrow.replace(hour=9, minute=0, second=0, microsecond=0).isoformat()
    et_overlap = tomorrow.replace(hour=11, minute=0, second=0, microsecond=0).isoformat()
    res_conflict = client.post("/api/v1/meetings", json={
        "room_id": room_c1_id,
        "title": "Họp Trùng Giờ Cố Tình Đặt Chồng Lên",
        "start_time": st_overlap,
        "end_time": et_overlap,
        "participant_ids": []
    }, headers=admin_headers)
    is_conflict_prevented = res_conflict.status_code == 409
    record_test(
        "T-MEET-06", "Conflict Detection (Critical)", "Hệ thống phải chặn trùng lịch phòng khi tạo cuộc họp mới -> 409 Conflict",
        is_conflict_prevented, res_conflict.status_code,
        f"LỖI NGHIÊM TRỌNG: API cho phép đặt trùng phòng thành công (Status {res_conflict.status_code})! create_meeting thiếu hoàn toàn thuật toán kiểm tra xung đột phòng." if not is_conflict_prevented else ""
    )

    # T-MEET-07: Xung đột thiết bị khi đặt kèm (Equipment Conflict Detection)
    # Lấy thiết bị di động
    eqs = client.get("/api/v1/equipments", headers=admin_headers).json()
    eq_logi_id = next(e["equipment_id"] for e in eqs if "Logitech" in e["equipment_name"])

    # Tạo cuộc họp mượn Logitech Rally (13:00 - 15:00)
    st_eq = tomorrow.replace(hour=13, minute=0, second=0, microsecond=0).isoformat()
    et_eq = tomorrow.replace(hour=15, minute=0, second=0, microsecond=0).isoformat()
    res_eq_m1 = client.post("/api/v1/meetings", json={
        "room_id": room_c1_id,
        "title": "Họp mượn thiết bị 1",
        "start_time": st_eq,
        "end_time": et_eq,
        "equipment_ids": [eq_logi_id]
    }, headers=admin_headers)
    record_test("T-MEET-07a", "Meetings", "Tạo cuộc họp mượn kèm thiết bị thành công", res_eq_m1.status_code == 201, res_eq_m1.status_code, res_eq_m1.text if res_eq_m1.status_code != 201 else "")

    # Cố tình mượn cùng thiết bị trùng khung giờ (14:00 - 16:00) tại phòng khác
    st_eq_ov = tomorrow.replace(hour=14, minute=0, second=0, microsecond=0).isoformat()
    et_eq_ov = tomorrow.replace(hour=16, minute=0, second=0, microsecond=0).isoformat()
    res_eq_conflict = client.post("/api/v1/meetings", json={
        "room_id": room_bgh_id,
        "title": "Họp cố mượn trùng thiết bị",
        "start_time": st_eq_ov,
        "end_time": et_eq_ov,
        "equipment_ids": [eq_logi_id]
    }, headers=admin_headers)
    record_test("T-MEET-07b", "Conflict Detection", "Chặn mượn trùng thiết bị trong cùng khung giờ -> 409 Conflict", res_eq_conflict.status_code == 409, res_eq_conflict.status_code, res_eq_conflict.text if res_eq_conflict.status_code != 409 else "")

    # T-MEET-08 (HIGH BUG): Kiểm tra Conflict khi Sửa Cuộc Họp (PUT /api/v1/meetings/{id})
    # BUG IDENTIFIED: Trong update_meeting, conflict chỉ lọc Meeting.status.in_(["PENDING", "APPROVED"]).
    # Nhưng cuộc họp Admin tạo hoặc sau khi duyệt có status là "SCHEDULED"!
    # Do đó nếu một cuộc họp có status "SCHEDULED", update_meeting SẼ KHÔNG PHÁT HIỆN RA XUNG ĐỘT!
    # Tạo cuộc họp m3 ở khung giờ khác (17:00 - 18:00)
    st_m3 = tomorrow.replace(hour=17, minute=0, second=0, microsecond=0).isoformat()
    et_m3 = tomorrow.replace(hour=18, minute=0, second=0, microsecond=0).isoformat()
    res_m3 = client.post("/api/v1/meetings", json={
        "room_id": room_c1_id,
        "title": "Cuộc họp m3 lúc 17h",
        "start_time": st_m3,
        "end_time": et_m3
    }, headers=admin_headers)
    m3_id = res_m3.json().get("meeting_id")

    # Giờ sửa m3 đổi giờ trùng với m1 (m1 là SCHEDULED từ 8:00 - 10:00)
    res_update_conflict = client.put(f"/api/v1/meetings/{m3_id}", json={
        "start_time": st1,
        "end_time": et1
    }, headers=admin_headers)
    is_update_conflict_prevented = res_update_conflict.status_code == 409
    record_test(
        "T-MEET-08", "Conflict Detection (High)", "Cập nhật cuộc họp đổi giờ trùng vào cuộc họp 'SCHEDULED' đã có -> Phải 409 Conflict",
        is_update_conflict_prevented, res_update_conflict.status_code,
        f"LỖI: update_meeting chỉ kiểm tra status ['PENDING', 'APPROVED'] nên bỏ qua các cuộc họp 'SCHEDULED', cho phép sửa giờ đè lên cuộc họp đang có (Status: {res_update_conflict.status_code})!" if not is_update_conflict_prevented else ""
    )

    # ----------------------------------------------------
    # PHẦN 5: EQUIPMENT BORROW REQUESTS
    # ----------------------------------------------------
    print("\n--- [MODULE 5: EQUIPMENT BORROW REQUESTS] ---")

    # T-EQ-01: Giảng viên gửi yêu cầu mượn thiết bị
    res_borrow = client.post("/api/v1/equipment-requests", json={
        "equipment_id": eq_logi_id,
        "quantity": 1,
        "start_time": tomorrow.replace(hour=19, minute=0).isoformat(),
        "end_time": tomorrow.replace(hour=21, minute=0).isoformat(),
        "use_location": "Giảng đường B3",
        "reason": "Hội thảo CLB Sinh viên"
    }, headers=org_headers)
    borrow_id_1 = res_borrow.json().get("id") if res_borrow.status_code == 201 else None
    record_test("T-EQ-01", "Equipment Requests", "Giảng viên gửi yêu cầu mượn thiết bị -> 201 Created", res_borrow.status_code == 201, res_borrow.status_code, res_borrow.text if res_borrow.status_code != 201 else "")

    # T-EQ-02: Giảng viên thứ hai gửi yêu cầu mượn CÙNG thiết bị CÙNG khung giờ
    res_borrow_dup = client.post("/api/v1/equipment-requests", json={
        "equipment_id": eq_logi_id,
        "quantity": 1,
        "start_time": tomorrow.replace(hour=19, minute=0).isoformat(),
        "end_time": tomorrow.replace(hour=21, minute=0).isoformat(),
        "use_location": "Hội trường A",
        "reason": "Lớp học trực tuyến"
    }, headers=org_headers)
    borrow_id_2 = res_borrow_dup.json().get("id") if res_borrow_dup.status_code == 201 else None

    # Admin duyệt yêu cầu 1
    res_app_1 = client.patch(f"/api/v1/equipment-requests/{borrow_id_1}/approve", headers=admin_headers)
    record_test("T-EQ-02a", "Equipment Requests", "Admin duyệt yêu cầu mượn 1 thành công", res_app_1.status_code == 200, res_app_1.status_code)

    # T-EQ-03 (HIGH BUG): Admin cố duyệt yêu cầu 2 trùng giờ với yêu cầu 1 đã duyệt
    # BUG IDENTIFIED: Trong equipment_requests.py -> approve_borrow_request KHÔNG CÓ BẤT KỲ CHECK TRÙNG LỊCH NÀO!
    res_app_2 = client.patch(f"/api/v1/equipment-requests/{borrow_id_2}/approve", headers=admin_headers)
    is_borrow_conflict_prevented = res_app_2.status_code == 409
    record_test(
        "T-EQ-03", "Conflict Detection (High)", "Admin không được phê duyệt 2 đơn mượn cùng thiết bị trùng khung giờ -> Phải 409 Conflict",
        is_borrow_conflict_prevented, res_app_2.status_code,
        f"LỖI: approve_borrow_request không kiểm tra xung đột thời gian, duyệt thành công cả 2 đơn mượn đè giờ nhau (Status: {res_app_2.status_code})!" if not is_borrow_conflict_prevented else ""
    )

    # ----------------------------------------------------
    # TỔNG KẾT BỘ TEST
    # ----------------------------------------------------
    print("\n" + "=" * 75)
    print("📊 BÁO CÁO THỐNG KÊ KẾT QUẢ KIỂM THỬ QA")
    print("=" * 75)
    total = len(test_results)
    passed = sum(1 for t in test_results if t["passed"])
    failed = total - passed
    print(f"Tổng số Test Cases thực thi: {total}")
    print(f"Số Test Cases ĐẠT (PASS)     : {passed} ({passed/total*100:.1f}%)")
    print(f"Số Test Cases LỖI (FAIL)    : {failed} ({failed/total*100:.1f}%)")
    print("=" * 75)

    if failed > 0:
        print("\nDANH SÁCH CÁC TEST CASES PHÁT HIỆN LỖI:")
        for t in test_results:
            if not t["passed"]:
                print(f"- [{t['id']}] {t['category']}: {t['name']}")
                print(f"    Chi tiết: {t['detail']}")

    return test_results

if __name__ == "__main__":
    run_all_qa_tests()
