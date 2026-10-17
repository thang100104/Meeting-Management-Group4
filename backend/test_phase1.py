"""
Script kiểm thử tự động toàn diện Giai đoạn 1 (Phase 1: Auth & RBAC)
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
from app.core.database import SessionLocal, Base, engine
from app.db.init_db import init_db

def run_tests():
    print("=" * 60)
    print("🚀 BẮT ĐẦU KIỂM THỬ TỰ ĐỘNG GIAI ĐOẠN 1 (AUTH & RBAC)")
    print("=" * 60)

    # 1. Khởi tạo DB & Seed data
    db = SessionLocal()
    init_db(db)
    db.close()
    print("✅ [1] Khởi tạo Database và nạp dữ liệu mẫu thành công!")

    client = TestClient(app)

    # 2. Test Health check
    res = client.get("/health")
    assert res.status_code == 200, f"Health check failed: {res.text}"
    print("✅ [2] Health check endpoint: OK (200)")

    # 3. Test Đăng nhập Admin đúng mật khẩu
    login_payload = {
        "email": "admin@ictu.vn",
        "password": "Admin@123"
    }
    res = client.post("/api/v1/auth/login", json=login_payload)
    assert res.status_code == 200, f"Admin login failed: {res.text}"
    admin_token_data = res.json()
    assert "access_token" in admin_token_data
    assert admin_token_data["role"] == "ADMIN"
    admin_token = admin_token_data["access_token"]
    print("✅ [3] Đăng nhập Admin thành công -> Nhận JWT Token (Role: ADMIN)")

    # 4. Test Đăng nhập sai mật khẩu -> Phải trả về 400
    bad_login = {
        "email": "admin@ictu.vn",
        "password": "WrongPassword"
    }
    res = client.post("/api/v1/auth/login", json=bad_login)
    assert res.status_code == 400, f"Expected 400 for bad password, got {res.status_code}"
    print("✅ [4] Đăng nhập sai mật khẩu -> Trả về lỗi 400 chính xác")

    # 5. Test Lấy thông tin tài khoản hiện tại (GET /api/v1/auth/me)
    headers = {"Authorization": f"Bearer {admin_token}"}
    res = client.get("/api/v1/auth/me", headers=headers)
    assert res.status_code == 200, f"Get /auth/me failed: {res.text}"
    user_me = res.json()
    assert user_me["email"] == "admin@ictu.vn"
    assert user_me["role"]["role_name"] == "ADMIN"
    print(f"✅ [5] Lấy thông tin tài khoản hiện tại: {user_me['full_name']} ({user_me['email']})")

    # 6. Test Admin xem danh sách người dùng (GET /api/v1/users)
    res = client.get("/api/v1/users", headers=headers)
    assert res.status_code == 200, f"List users failed: {res.text}"
    users_list = res.json()
    assert len(users_list) >= 2
    print(f"✅ [6] Admin lấy danh sách người dùng: {len(users_list)} tài khoản")

    # 7. Test Admin tạo người dùng mới (POST /api/v1/users)
    new_user_data = {
        "email": "student1@ictu.vn",
        "password": "password123",
        "full_name": "Trần Thị B (Sinh viên)",
        "phone": "0988776655",
        "role_id": 3,  # PARTICIPANT
        "department_id": 1,
        "status": "ACTIVE"
    }
    res = client.post("/api/v1/users", json=new_user_data, headers=headers)
    assert res.status_code in [201, 400]  # 201 nếu mới, 400 nếu đã tồn tại từ lần chạy trước
    if res.status_code == 201:
        created_user = res.json()
        assert created_user["email"] == "student1@ictu.vn"
        print(f"✅ [7] Admin tạo thành công người dùng mới: {created_user['full_name']} (Role ID: {created_user['role_id']})")
    else:
        print("✅ [7] Người dùng 'student1@ictu.vn' đã tồn tại từ trước (Passed)")

    # 8. Test Đăng nhập bằng tài khoản Organizer
    res = client.post("/api/v1/auth/login", json={"email": "organizer@ictu.vn", "password": "123456"})
    assert res.status_code == 200, f"Organizer login failed: {res.text}"
    org_token = res.json()["access_token"]
    org_headers = {"Authorization": f"Bearer {org_token}"}
    print("✅ [8] Đăng nhập bằng tài khoản Organizer: OK")

    # 9. Test RBAC: Organizer cố tình gọi API chỉ dành cho Admin (GET /api/v1/users) -> Phải bị chặn 403 Forbidden!
    res = client.get("/api/v1/users", headers=org_headers)
    assert res.status_code == 403, f"Expected 403 Forbidden for non-admin, got {res.status_code}"
    print("✅ [9] Kiểm tra RBAC: Organizer gọi API Admin -> Bị chặn 403 Forbidden chuẩn xác!")

    print("=" * 60)
    print("🎉 TẤT CẢ 9/9 TEST CASE GIAI ĐOẠN 1 ĐỀU THÀNH CÔNG RỰC RỠ!")
    print("=" * 60)

if __name__ == "__main__":
    run_tests()
