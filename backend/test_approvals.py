import sys
import os
import io

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding='utf-8')
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding='utf-8')

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from fastapi.testclient import TestClient
from app.main import app
from app.core.database import SessionLocal
from app.core.security import create_access_token
from app.models.user import User
from app.models.meeting import Meeting
from app.models.equipment import EquipmentBorrowRequest
from seed_data import seed_db

def run_tests():
    print("======================================================================")
    print("🚀 BẮT ĐẦU KIỂM THỬ TÍNH NĂNG PHÊ DUYỆT (ADMIN APPROVAL WORKFLOW)")
    print("======================================================================")

    # 1. Reset and Seed Database
    seed_db()
    client = TestClient(app)
    db = SessionLocal()

    admin = db.query(User).filter(User.email == "admin@ictu.edu.vn").first()
    lecturer = db.query(User).filter(User.email == "hoangphuong@ictu.edu.vn").first()
    student = db.query(User).filter(User.email == "sinhvien_d@ictu.edu.vn").first()

    admin_token = create_access_token(str(admin.user_id))
    lecturer_token = create_access_token(str(lecturer.user_id))
    student_token = create_access_token(str(student.user_id))

    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    lecturer_headers = {"Authorization": f"Bearer {lecturer_token}"}
    student_headers = {"Authorization": f"Bearer {student_token}"}

    # 2. Test get pending meetings
    res = client.get("/api/v1/meetings?status=PENDING", headers=admin_headers)
    assert res.status_code == 200, f"Expected 200, got {res.status_code}"
    pending_meetings = res.json()
    assert len(pending_meetings) >= 1, "Expected at least 1 pending meeting"
    pending_meeting_id = pending_meetings[0]["meeting_id"]
    print(f"✅ [1] Admin lấy danh sách cuộc họp chờ duyệt thành công: ID={pending_meeting_id}, Title='{pending_meetings[0]['title']}'")

    # 3. Test non-admin cannot approve room booking
    res = client.patch(f"/api/v1/meetings/{pending_meeting_id}/approve", headers=lecturer_headers)
    assert res.status_code == 403, f"Expected 403 for lecturer, got {res.status_code}"
    res = client.patch(f"/api/v1/meetings/{pending_meeting_id}/approve", headers=student_headers)
    assert res.status_code == 403, f"Expected 403 for student, got {res.status_code}"
    print("✅ [2] Chặn Non-admin (Giảng viên, Sinh viên) cố tình duyệt đặt phòng -> 403 Forbidden chuẩn xác!")

    # 4. Test admin approves meeting
    res = client.patch(
        f"/api/v1/meetings/{pending_meeting_id}/approve",
        headers=admin_headers,
        json={"note": "Đã kiểm tra lịch Ban Giám hiệu, phê duyệt cho phép sử dụng phòng."}
    )
    assert res.status_code == 200, f"Expected 200, got {res.status_code}"
    approved_meeting = res.json()
    assert approved_meeting["status"] == "SCHEDULED", f"Expected SCHEDULED, got {approved_meeting['status']}"
    print(f"✅ [3] Admin phê duyệt cuộc họp ID={pending_meeting_id} thành công! Status chuyển sang: {approved_meeting['status']}")

    # 5. Test admin rejects meeting
    res = client.patch(
        f"/api/v1/meetings/{pending_meeting_id}/reject",
        headers=admin_headers,
        json={"reason": "Trùng lịch bảo trì thiết bị hội thảo âm thanh"}
    )
    assert res.status_code == 200, f"Expected 200, got {res.status_code}"
    rejected_meeting = res.json()
    assert rejected_meeting["status"] == "REJECTED", f"Expected REJECTED, got {rejected_meeting['status']}"
    print(f"✅ [4] Admin từ chối cuộc họp ID={pending_meeting_id} kèm lý do thành công! Status: {rejected_meeting['status']}")

    # 6. Test Equipment Borrow Request approvals
    res = client.get("/api/v1/equipment-requests?status=PENDING", headers=admin_headers)
    assert res.status_code == 200, f"Expected 200, got {res.status_code}"
    pending_eqs = res.json()
    assert len(pending_eqs) >= 1, "Expected at least 1 pending equipment request"
    eq_req_id = pending_eqs[0]["id"]
    print(f"✅ [5] Admin lấy danh sách đơn mượn thiết bị chờ duyệt: ID={eq_req_id}, Thiết bị='{pending_eqs[0]['equipment_name']}'")

    # 7. Non-admin cannot approve equipment request
    res = client.patch(f"/api/v1/equipment-requests/{eq_req_id}/approve", headers=lecturer_headers)
    assert res.status_code == 403, f"Expected 403, got {res.status_code}"
    print("✅ [6] Chặn Giảng viên tự duyệt đơn mượn thiết bị -> 403 Forbidden chính xác!")

    # 8. Admin approves equipment request
    res = client.patch(f"/api/v1/equipment-requests/{eq_req_id}/approve", headers=admin_headers)
    assert res.status_code == 200, f"Expected 200, got {res.status_code}"
    approved_eq = res.json()
    assert approved_eq["status"] == "APPROVED", f"Expected APPROVED, got {approved_eq['status']}"
    print(f"✅ [7] Admin phê duyệt mượn thiết bị ID={eq_req_id} thành công! Status: {approved_eq['status']}")

    # 9. Admin marks equipment returned
    res = client.patch(
        f"/api/v1/equipment-requests/{eq_req_id}/status",
        headers=admin_headers,
        json={"status": "RETURNED"}
    )
    assert res.status_code == 200, f"Expected 200, got {res.status_code}"
    returned_eq = res.json()
    assert returned_eq["status"] == "RETURNED", f"Expected RETURNED, got {returned_eq['status']}"
    print(f"✅ [8] Admin xác nhận thu hồi / trả thiết bị vào kho thành công! Status: {returned_eq['status']}")

    # Reset meeting back to PENDING for interactive UI testing
    m = db.query(Meeting).filter(Meeting.meeting_id == pending_meeting_id).first()
    m.status = "PENDING"
    eq_r = db.query(EquipmentBorrowRequest).filter(EquipmentBorrowRequest.id == eq_req_id).first()
    eq_r.status = "PENDING"
    db.commit()
    db.close()

    print("======================================================================")
    print("🎉 TẤT CẢ TEST CASES PHÊ DUYỆT ADMIN ĐỀU PASS 100% HOÀN HẢO!")
    print("======================================================================")

if __name__ == "__main__":
    run_tests()
