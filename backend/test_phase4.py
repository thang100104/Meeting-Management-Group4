"""
Script kiểm thử tự động toàn diện Giai đoạn 4 (Phase 4: Equipment Management & Booking)
Bao gồm:
- US #12: Đặt kèm thiết bị khi đặt phòng & phát hiện xung đột thiết bị
- US #13: Quản lý trạng thái thiết bị (AVAILABLE, MAINTENANCE, BROKEN) & tính khả dụng theo khung giờ
- US #14: Quản trị CRUD danh mục thiết bị (RBAC Admin, phân bổ phòng/di động)
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
from app.models.meeting import Meeting, MeetingParticipant
from app.models.equipment import Equipment, MeetingEquipment

def run_tests():
    print("=" * 70)
    print("🛠️  BẮT ĐẦU KIỂM THỬ TỰ ĐỘNG GIAI ĐOẠN 4 (EQUIPMENT MANAGEMENT & BOOKING)")
    print("=" * 70)

    # 1. Khởi tạo DB & Seed data
    db = SessionLocal()
    init_db(db)
    
    # Dọn dẹp dữ liệu họp cũ và thiết bị test tạm để test độc lập
    db.query(MeetingEquipment).delete()
    db.query(MeetingParticipant).delete()
    db.query(Meeting).delete()
    db.query(Equipment).filter(Equipment.serial_number == "LOGI-SPOT-99").delete()
    db.commit()
    db.close()
    print("✅ [1] Khởi tạo Database và nạp dữ liệu thiết bị mẫu thành công!")

    client = TestClient(app)

    # Đăng nhập lấy Token các Role
    res_admin = client.post("/api/v1/auth/login", json={"email": "admin@ictu.vn", "password": "Admin@123"})
    assert res_admin.status_code == 200
    admin_token = res_admin.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    res_org = client.post("/api/v1/auth/login", json={"email": "organizer@ictu.vn", "password": "123456"})
    assert res_org.status_code == 200
    org_token = res_org.json()["access_token"]
    org_headers = {"Authorization": f"Bearer {org_token}"}

    res_part = client.post("/api/v1/auth/login", json={"email": "student1@ictu.vn", "password": "password123"})
    assert res_part.status_code == 200
    part_headers = {"Authorization": f"Bearer {res_part.json()['access_token']}"}

    # 2. Test xem danh sách thiết bị (GET /api/v1/equipments - US #12, #13)
    res = client.get("/api/v1/equipments", headers=org_headers)
    assert res.status_code == 200, res.text
    equipments = res.json()
    assert len(equipments) >= 10
    print(f"✅ [2] Lấy danh sách thiết bị thành công: {len(equipments)} thiết bị trong hệ thống")

    # 3. Test lọc thiết bị theo Loại và Tính di động
    res_prj = client.get("/api/v1/equipments?equipment_type=PROJECTOR", headers=org_headers)
    assert res_prj.status_code == 200
    for eq in res_prj.json():
        assert eq["equipment_type"] == "PROJECTOR"
    print(f"✅ [3.1] Lọc theo loại 'PROJECTOR': {len(res_prj.json())} máy chiếu")

    res_portable = client.get("/api/v1/equipments?is_portable=true", headers=org_headers)
    assert res_portable.status_code == 200
    for eq in res_portable.json():
        assert eq["room_id"] is None
    print(f"✅ [3.2] Lọc thiết bị di động dùng chung: {len(res_portable.json())} thiết bị")

    # 4. Test API Thống kê thiết bị (GET /api/v1/equipments/stats/summary - US #13)
    res_stats = client.get("/api/v1/equipments/stats/summary", headers=org_headers)
    assert res_stats.status_code == 200
    stats = res_stats.json()
    assert stats["total"] >= 10
    assert stats["available"] >= 1
    assert stats["maintenance"] >= 1
    assert stats["broken"] >= 1
    print(f"✅ [4] Thống kê thiết bị: Tổng={stats['total']}, Sẵn sàng={stats['available']}, Bảo trì={stats['maintenance']}, Hỏng={stats['broken']}")

    # 5. Test Admin tạo thiết bị mới (POST /api/v1/equipments - US #14)
    new_eq_payload = {
        "equipment_name": "Bút trình chiếu Logitech Spotlight Gold",
        "equipment_type": "OTHER",
        "serial_number": "LOGI-SPOT-99",
        "room_id": None,
        "status": "AVAILABLE",
        "description": "Điều khiển slide từ xa 30m, con trỏ laser kỹ thuật số"
    }
    res_create = client.post("/api/v1/equipments", json=new_eq_payload, headers=admin_headers)
    assert res_create.status_code == 201, res_create.text
    created_eq = res_create.json()
    new_eq_id = created_eq["equipment_id"]
    print(f"✅ [5.1] Admin tạo thiết bị mới thành công: ID={new_eq_id}, Tên='{created_eq['equipment_name']}'")

    # Non-admin cố tạo thiết bị -> Phải bị chặn 403 Forbidden
    res_bad_create = client.post("/api/v1/equipments", json=new_eq_payload, headers=org_headers)
    assert res_bad_create.status_code == 403
    print("✅ [5.2] Kiểm tra RBAC: Giảng viên/Sinh viên cố tạo thiết bị -> Bị chặn 403 Forbidden chuẩn xác!")

    # Cố tạo với Serial trùng -> Phải bị chặn 400 Bad Request
    res_dup_serial = client.post("/api/v1/equipments", json=new_eq_payload, headers=admin_headers)
    assert res_dup_serial.status_code == 400
    print("✅ [5.3] Chặn trùng mã Serial thiết bị -> Trả về lỗi 400 chính xác!")

    # 6. Test Admin cập nhật thiết bị (PUT /api/v1/equipments/{id} - US #14)
    update_payload = {
        "description": "Nâng cấp pin sạc Type-C và bao đựng chống sốc",
        "status": "MAINTENANCE"
    }
    res_update = client.put(f"/api/v1/equipments/{new_eq_id}", json=update_payload, headers=admin_headers)
    assert res_update.status_code == 200
    assert res_update.json()["status"] == "MAINTENANCE"
    print(f"✅ [6] Admin cập nhật thiết bị thành công (Chuyển trạng thái sang MAINTENANCE)")

    # Chuyển lại về AVAILABLE để test
    client.put(f"/api/v1/equipments/{new_eq_id}", json={"status": "AVAILABLE"}, headers=admin_headers)

    # 7. Test Đặt phòng họp kèm thiết bị (POST /api/v1/meetings - US #12)
    # Lấy phòng họp và 1 thiết bị di động (Logitech Rally Bar)
    rooms = client.get("/api/v1/rooms", headers=org_headers).json()
    room1_id = rooms[0]["room_id"]
    
    rally_bar = [eq for eq in equipments if "Logitech Rally Bar" in eq["equipment_name"]][0]
    rally_id = rally_bar["equipment_id"]

    tomorrow = datetime.now() + timedelta(days=1)
    start_t1 = tomorrow.replace(hour=8, minute=0, second=0, microsecond=0).isoformat()
    end_t1 = tomorrow.replace(hour=10, minute=0, second=0, microsecond=0).isoformat()

    meeting_payload = {
        "room_id": room1_id,
        "title": "Họp Quốc tế Hội nghị Trực tuyến",
        "description": "Mượn camera họp trực tuyến Logitech Rally Bar",
        "start_time": start_t1,
        "end_time": end_t1,
        "equipment_ids": [rally_id]
    }
    res_m1 = client.post("/api/v1/meetings", json=meeting_payload, headers=org_headers)
    assert res_m1.status_code == 201, res_m1.text
    meeting1 = res_m1.json()
    meeting1_id = meeting1["meeting_id"]
    assert len(meeting1["equipments"]) == 1
    assert meeting1["equipments"][0]["equipment_id"] == rally_id
    print(f"✅ [7] Đặt phòng kèm thiết bị thành công! Cuộc họp ID={meeting1_id} đã mượn '{meeting1['equipments'][0]['equipment_name']}'")

    # 8. Test Chống mượn thiết bị đang hỏng hoặc bảo trì (US #13)
    # Tìm thiết bị đang MAINTENANCE hoặc BROKEN
    broken_eq = [eq for eq in equipments if eq["status"] in ["MAINTENANCE", "BROKEN"]][0]
    bad_booking_payload = {
        "room_id": rooms[1]["room_id"],
        "title": "Hội thảo dùng thiết bị hỏng",
        "start_time": start_t1,
        "end_time": end_t1,
        "equipment_ids": [broken_eq["equipment_id"]]
    }
    res_bad_eq = client.post("/api/v1/meetings", json=bad_booking_payload, headers=org_headers)
    assert res_bad_eq.status_code == 400
    print(f"✅ [8] Hệ thống chặn thành công khi cố mượn thiết bị đang {broken_eq['status']} (400 Bad Request)!")

    # 9. Test Thuật toán Conflict Detection Thiết bị (US #12: Trùng giờ mượn thiết bị)
    # Phòng khác (room2), nhưng cố mượn CÙNG thiết bị Logitech Rally Bar trong khung giờ giao nhau (09:00 - 11:00)
    room2_id = rooms[1]["room_id"]
    start_t2 = tomorrow.replace(hour=9, minute=0, second=0, microsecond=0).isoformat()
    end_t2 = tomorrow.replace(hour=11, minute=0, second=0, microsecond=0).isoformat()

    conflict_payload = {
        "room_id": room2_id,
        "title": "Cuộc họp khác cần Rally Bar",
        "start_time": start_t2,
        "end_time": end_t2,
        "equipment_ids": [rally_id]
    }
    res_conflict = client.post("/api/v1/meetings", json=conflict_payload, headers=org_headers)
    assert res_conflict.status_code == 409, f"Expected 409 Conflict, got {res_conflict.status_code}: {res_conflict.text}"
    assert "Trùng lịch thiết bị" in res_conflict.json()["detail"]
    print("✅ [9] Thuật toán Conflict Detection thiết bị hoạt động hoàn hảo: Đã phát hiện và chặn mượn trùng thiết bị (409 Conflict)!")

    # 10. Test Kiểm tra tính khả dụng thiết bị theo khung giờ (GET /api/v1/equipments?from_time=...&to_time=...)
    res_check_avail = client.get(
        f"/api/v1/equipments?from_time={start_t2}&to_time={end_t2}",
        headers=org_headers
    )
    assert res_check_avail.status_code == 200
    avail_list = res_check_avail.json()
    rally_status = [eq for eq in avail_list if eq["equipment_id"] == rally_id][0]
    assert rally_status["is_available_in_slot"] is False
    assert rally_status["conflict_reason"] is not None
    print(f"✅ [10] Kiểm tra lịch rảnh thiết bị theo slot: '{rally_status['equipment_name']}' hiển thị bận chính xác ({rally_status['conflict_reason']})")

    # 11. Test Cập nhật danh sách thiết bị mượn kèm của cuộc họp (PUT /api/v1/meetings/{id})
    res_update_m = client.put(
        f"/api/v1/meetings/{meeting1_id}",
        json={"equipment_ids": [new_eq_id]},
        headers=org_headers
    )
    assert res_update_m.status_code == 200
    updated_m = res_update_m.json()
    assert len(updated_m["equipments"]) == 1
    assert updated_m["equipments"][0]["equipment_id"] == new_eq_id
    print(f"✅ [11] Cập nhật đổi thiết bị mượn kèm cuộc họp thành công (Đổi sang ID={new_eq_id})")

    # 12. Test Hủy cuộc họp -> Giải phóng thiết bị (US #2, #9, #12)
    res_cancel = client.patch(f"/api/v1/meetings/{meeting1_id}/cancel", headers=org_headers)
    assert res_cancel.status_code == 200
    print("✅ [12.1] Hủy cuộc họp thành công!")

    # Đặt lại cuộc họp với thiết bị đó -> Phải thành công vì lịch cũ đã hủy
    res_reuse = client.post("/api/v1/meetings", json=conflict_payload, headers=org_headers)
    assert res_reuse.status_code == 201
    print("✅ [12.2] Đặt lại thiết bị sau khi cuộc họp trước đã hủy -> Giải phóng tài nguyên và đặt thành công!")

    # 13. Test Xóa thiết bị (DELETE /api/v1/equipments/{id} - US #14)
    res_del = client.delete(f"/api/v1/equipments/{new_eq_id}", headers=admin_headers)
    assert res_del.status_code == 200
    print(f"✅ [13.1] Admin xóa thiết bị thành công (ID={new_eq_id})")

    # Thử xóa bằng non-admin -> Phải bị chặn 403
    res_bad_del = client.delete(f"/api/v1/equipments/{rally_id}", headers=org_headers)
    assert res_bad_del.status_code == 403
    print("✅ [13.2] Non-admin cố xóa thiết bị -> Bị chặn 403 Forbidden chuẩn xác!")

    print("=" * 70)
    print("🎉 TẤT CẢ TEST CASES GIAI ĐOẠN 4 (EQUIPMENT MANAGEMENT & BOOKING) ĐỀU THÀNH CÔNG RỰC RỠ!")
    print("=" * 70)

if __name__ == "__main__":
    run_tests()
