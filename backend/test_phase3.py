"""
Script kiểm thử tự động toàn diện Giai đoạn 3 (Phase 3: Core Booking & Conflict Detection)
"""
import sys
import os
import io
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding='utf-8')
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding='utf-8')

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from datetime import datetime, timedelta
from fastapi.testclient import TestClient
from app.main import app
from app.core.database import SessionLocal
from app.db.init_db import init_db

def run_tests():
    print("=" * 65)
    print("📅 BẮT ĐẦU KIỂM THỬ TỰ ĐỘNG GIAI ĐOẠN 3 (CORE BOOKING & CONFLICT DETECTION)")
    print("=" * 65)

    db = SessionLocal()
    init_db(db)
    
    # Clean up previous test data
    from app.models.meeting import Meeting, MeetingParticipant
    db.query(MeetingParticipant).delete()
    db.query(Meeting).delete()
    db.commit()
    
    db.close()
    print("✅ [1] Khởi tạo Database và dữ liệu mẫu thành công!")

    client = TestClient(app)

    res_admin = client.post("/api/v1/auth/login", json={"email": "admin@ictu.vn", "password": "Admin@123"})
    admin_headers = {"Authorization": f"Bearer {res_admin.json()['access_token']}"}

    res_org = client.post("/api/v1/auth/login", json={"email": "organizer@ictu.vn", "password": "123456"})
    org_headers = {"Authorization": f"Bearer {res_org.json()['access_token']}"}

    res_part = client.post("/api/v1/auth/login", json={"email": "student1@ictu.vn", "password": "password123"})
    part_headers = {"Authorization": f"Bearer {res_part.json()['access_token']}"}
    student_id = client.get("/api/v1/auth/me", headers=part_headers).json()["user_id"]

    # Lay danh sach phong
    rooms = client.get("/api/v1/rooms", headers=org_headers).json()
    room_id = rooms[0]["room_id"]

    # 1. Tao meeting (US #1, #4)
    tomorrow = datetime.now() + timedelta(days=1)
    start_t1 = tomorrow.replace(hour=8, minute=0, second=0, microsecond=0).isoformat()
    end_t1 = tomorrow.replace(hour=10, minute=0, second=0, microsecond=0).isoformat()
    
    payload1 = {
        "room_id": room_id,
        "title": "Họp Giao ban KHMT",
        "description": "Bàn về kế hoạch thực tập",
        "start_time": start_t1,
        "end_time": end_t1,
        "participant_ids": [student_id]
    }
    
    res = client.post("/api/v1/meetings", json=payload1, headers=org_headers)
    assert res.status_code == 201, res.text
    meeting1 = res.json()
    meeting1_id = meeting1["meeting_id"]
    print(f"✅ [2] Tạo cuộc họp thành công: '{meeting1['title']}' tại phòng ID={room_id}")

    # 2. Test Conflict Detection (Trung lich)
    start_t2 = tomorrow.replace(hour=9, minute=0, second=0, microsecond=0).isoformat()
    end_t2 = tomorrow.replace(hour=11, minute=0, second=0, microsecond=0).isoformat()
    payload2 = {
        "room_id": room_id,
        "title": "Hội thảo AI",
        "start_time": start_t2,
        "end_time": end_t2
    }
    res_conflict = client.post("/api/v1/meetings", json=payload2, headers=org_headers)
    assert res_conflict.status_code == 409
    print("✅ [3] Thuật toán Conflict Detection hoạt động đúng: Đã chặn thành công đặt phòng trùng giờ (409 Conflict)!")

    # 3. Test nguoi tham gia phan hoi (US #4)
    res_respond = client.patch(f"/api/v1/meetings/{meeting1_id}/respond", json={"status": "ACCEPTED"}, headers=part_headers)
    assert res_respond.status_code == 200
    print("✅ [4] Khách mời phản hồi 'ACCEPTED' thành công!")

    # 4. Xem lich hop
    res_list = client.get(f"/api/v1/meetings?user_id={student_id}", headers=part_headers)
    assert res_list.status_code == 200
    assert len(res_list.json()) >= 1
    print("✅ [5] Xem danh sách lịch họp thành công!")

    # 5. Room availability
    date_str = tomorrow.strftime("%Y-%m-%d")
    res_avail = client.get(f"/api/v1/rooms/{room_id}/availability?target_date={date_str}", headers=org_headers)
    assert res_avail.status_code == 200, res_avail.text
    assert len(res_avail.json()) >= 1
    print(f"✅ [6] Lấy timeline sử dụng của phòng thành công ({len(res_avail.json())} slot bị chiếm)")

    # 6. Update meeting
    start_t3 = tomorrow.replace(hour=8, minute=30, second=0, microsecond=0).isoformat()
    res_update = client.put(f"/api/v1/meetings/{meeting1_id}", json={"start_time": start_t3}, headers=org_headers)
    assert res_update.status_code == 200
    print("✅ [7] Cập nhật thời gian cuộc họp thành công!")

    # 7. Cancel meeting
    res_cancel = client.patch(f"/api/v1/meetings/{meeting1_id}/cancel", headers=org_headers)
    assert res_cancel.status_code == 200
    print("✅ [8] Hủy cuộc họp thành công!")

    # Verify conflict disappears after cancellation
    res_no_conflict = client.post("/api/v1/meetings", json=payload2, headers=org_headers)
    assert res_no_conflict.status_code == 201
    print("✅ [9] Đặt lại phòng vào giờ bị trùng (sau khi lịch kia đã hủy) -> Thành công!")

    print("=" * 65)
    print("🎉 TẤT CẢ TEST CASES GIAI ĐOẠN 3 (BOOKING) ĐỀU THÀNH CÔNG RỰC RỠ!")
    print("=" * 65)

if __name__ == "__main__":
    run_tests()
