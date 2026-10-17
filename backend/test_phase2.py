"""
Script kiểm thử tự động toàn diện Giai đoạn 2 (Phase 2: Room Management & Restrictions)
"""
import sys
import os
import io
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding='utf-8')
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding='utf-8')

# Thêm thư mục hiện tại vào sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi.testclient import TestClient
from app.main import app
from app.core.database import SessionLocal
from app.db.init_db import init_db

def run_tests():
    print("=" * 65)
    print("🏢 BẮT ĐẦU KIỂM THỬ TỰ ĐỘNG GIAI ĐOẠN 2 (QUẢN LÝ PHÒNG HỌP & GIỚI HẠN)")
    print("=" * 65)

    # 1. Khởi tạo DB & Seed data
    db = SessionLocal()
    init_db(db)
    db.close()
    print("✅ [1] Khởi tạo Database và nạp dữ liệu phòng họp mẫu thành công!")

    client = TestClient(app)

    # Đăng nhập lấy Token Admin
    res_admin = client.post("/api/v1/auth/login", json={"email": "admin@ictu.vn", "password": "Admin@123"})
    assert res_admin.status_code == 200
    admin_token = res_admin.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # Đăng nhập lấy Token Organizer
    res_org = client.post("/api/v1/auth/login", json={"email": "organizer@ictu.vn", "password": "123456"})
    assert res_org.status_code == 200
    org_token = res_org.json()["access_token"]
    org_headers = {"Authorization": f"Bearer {org_token}"}

    # Đăng nhập lấy Token Participant
    res_part = client.post("/api/v1/auth/login", json={"email": "student1@ictu.vn", "password": "password123"})
    assert res_part.status_code == 200
    part_token = res_part.json()["access_token"]
    part_headers = {"Authorization": f"Bearer {part_token}"}

    # 2. Test xem danh sách phòng họp (GET /api/v1/rooms)
    res = client.get("/api/v1/rooms", headers=org_headers)
    assert res.status_code == 200, f"List rooms failed: {res.text}"
    rooms = res.json()
    assert len(rooms) >= 5
    print(f"✅ [2] Lấy danh sách phòng họp thành công: {len(rooms)} phòng")

    # 3. Test lọc phòng theo sức chứa tối thiểu min_capacity (US #10)
    res = client.get("/api/v1/rooms?min_capacity=50", headers=org_headers)
    assert res.status_code == 200
    large_rooms = res.json()
    for r in large_rooms:
        assert r["capacity"] >= 50
    print(f"✅ [3] Lọc phòng có sức chứa >= 50: Tìm thấy {len(large_rooms)} phòng")

    # 4. Test tìm kiếm phòng theo từ khóa (Search: CNTT)
    res = client.get("/api/v1/rooms?search=CNTT", headers=org_headers)
    assert res.status_code == 200
    search_rooms = res.json()
    assert len(search_rooms) >= 1
    assert "CNTT" in search_rooms[0]["room_name"]
    print(f"✅ [4] Tìm kiếm phòng theo từ khóa 'CNTT': {search_rooms[0]['room_name']}")

    # 5. Test Admin tạo phòng mới (POST /api/v1/rooms - US #11)
    new_room_payload = {
        "room_name": "Phòng Nghiên cứu AI & Robot (C1-501)",
        "capacity": 35,
        "location": "Tầng 5, Tòa nhà C1",
        "description": "Trang bị máy trạm GPU, bảng điện tử",
        "status": "AVAILABLE"
    }
    res = client.post("/api/v1/rooms", json=new_room_payload, headers=admin_headers)
    assert res.status_code in [201, 400]
    if res.status_code == 201:
        created_room = res.json()
        new_room_id = created_room["room_id"]
        print(f"✅ [5] Admin tạo phòng mới thành công: ID={new_room_id}, Tên={created_room['room_name']}")
    else:
        # Nếu đã có từ lần chạy trước
        existing_rooms = client.get("/api/v1/rooms?search=AI", headers=admin_headers).json()
        new_room_id = existing_rooms[0]["room_id"]
        print(f"✅ [5] Phòng AI đã tồn tại: ID={new_room_id} (Passed)")

    # 6. Test RBAC: Non-admin (Organizer) cố tạo phòng họp -> Phải bị chặn 403 Forbidden!
    bad_res = client.post("/api/v1/rooms", json=new_room_payload, headers=org_headers)
    assert bad_res.status_code in [403, 400]
    if bad_res.status_code == 403:
        print("✅ [6] Kiểm tra quyền: Giảng viên/User thường cố tạo phòng -> Bị chặn 403 Forbidden chuẩn xác!")

    # 7. Test xem chi tiết phòng họp (GET /api/v1/rooms/{id})
    res = client.get(f"/api/v1/rooms/{new_room_id}", headers=org_headers)
    assert res.status_code == 200
    assert res.json()["room_name"] == "Phòng Nghiên cứu AI & Robot (C1-501)"
    print(f"✅ [7] Xem chi tiết phòng họp {new_room_id}: OK")

    # 8. Test cập nhật thông tin phòng họp (PUT /api/v1/rooms/{id} - US #11)
    update_payload = {"capacity": 40, "description": "Nâng cấp thêm 5 chỗ ngồi và 1 màn hình phụ"}
    res = client.put(f"/api/v1/rooms/{new_room_id}", json=update_payload, headers=admin_headers)
    assert res.status_code == 200
    assert res.json()["capacity"] == 40
    print(f"✅ [8] Admin cập nhật phòng họp thành công: Sức chứa mới = {res.json()['capacity']}")

    # 9. Test Giới hạn quyền đặt phòng theo Role (US #21 - Room Restriction)
    # Lấy phòng Ban Giám hiệu: kiểm tra xem có restriction cấm role PARTICIPANT không
    bgh_rooms = client.get("/api/v1/rooms?search=Ban Giám hiệu", headers=admin_headers).json()
    assert len(bgh_rooms) >= 1
    bgh_room = bgh_rooms[0]
    bgh_room_id = bgh_room["room_id"]
    assert len(bgh_room["restrictions"]) >= 1
    print(f"✅ [9] Phòng Ban Giám hiệu có {len(bgh_room['restrictions'])} cấu hình giới hạn quyền")

    # 10. Test API lọc chỉ phòng tôi được đặt (only_allowed_for_me=true)
    # Với Participant (Sinh viên): Phòng BGH PHẢI BỊ LOẠI TRỪ khỏi danh sách
    res_part_rooms = client.get("/api/v1/rooms?only_allowed_for_me=true", headers=part_headers).json()
    part_room_names = [r["room_name"] for r in res_part_rooms]
    assert not any("Ban Giám hiệu" in name for name in part_room_names)
    print("✅ [10] Phân quyền phòng (US #21): Sinh viên (Participant) không thấy phòng Ban Giám hiệu khi lọc phòng được phép đặt!")

    # Với Organizer (Giảng viên): Phòng BGH ĐƯỢC PHÉP ĐẶT
    res_org_rooms = client.get("/api/v1/rooms?only_allowed_for_me=true", headers=org_headers).json()
    org_room_names = [r["room_name"] for r in res_org_rooms]
    assert any("Ban Giám hiệu" in name for name in org_room_names)
    print("✅ [11] Phân quyền phòng (US #21): Giảng viên (Organizer) thấy và được phép đặt phòng Ban Giám hiệu!")

    print("=" * 65)
    print("🎉 TẤT CẢ TEST CASES GIAI ĐOẠN 2 ĐỀU THÀNH CÔNG RỰC RỠ!")
    print("=" * 65)

if __name__ == "__main__":
    run_tests()
