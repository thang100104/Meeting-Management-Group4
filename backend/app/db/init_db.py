from sqlalchemy.orm import Session
from app.core.database import Base, engine
from app.models import Role, Department, User, Room, RoomRestriction, Equipment, MeetingEquipment
from app.core.security import get_password_hash

def init_db(db: Session) -> None:
    # 1. Tạo tất cả bảng nếu chưa có (bao gồm rooms, room_restrictions)
    Base.metadata.create_all(bind=engine)

    # 2. Khởi tạo các vai trò (Roles) mặc định nếu chưa tồn tại
    default_roles = ["ADMIN", "ORGANIZER", "PARTICIPANT"]
    roles_map = {}
    for r_name in default_roles:
        role = db.query(Role).filter(Role.role_name == r_name).first()
        if not role:
            role = Role(role_name=r_name)
            db.add(role)
            db.commit()
            db.refresh(role)
        roles_map[r_name] = role.role_id

    # 3. Khởi tạo một số phòng ban (Departments) mẫu
    departments_data = [
        {"name": "Khoa Công nghệ thông tin", "hrm": "DEPT_CNTT"},
        {"name": "Phòng Đào tạo & Quản lý sinh viên", "hrm": "DEPT_DT"},
        {"name": "Phòng Hành chính & Tổng hợp", "hrm": "DEPT_HC"},
    ]
    dept_map = {}
    for d_data in departments_data:
        dept = db.query(Department).filter(Department.department_name == d_data["name"]).first()
        if not dept:
            dept = Department(department_name=d_data["name"], hrm_code=d_data["hrm"])
            db.add(dept)
            db.commit()
            db.refresh(dept)
        dept_map[d_data["name"]] = dept.department_id

    # 4. Tạo tài khoản Admin mặc định nếu chưa có
    admin_email = "admin@ictu.vn"
    admin_user = db.query(User).filter(User.email == admin_email).first()
    if not admin_user:
        admin_user = User(
            email=admin_email,
            password_hash=get_password_hash("Admin@123"),
            full_name="Quản trị viên Hệ thống",
            phone="0987654321",
            role_id=roles_map["ADMIN"],
            department_id=dept_map.get("Phòng Hành chính & Tổng hợp"),
            status="ACTIVE"
        )
        db.add(admin_user)
        db.commit()
        print(">> Đã khởi tạo tài khoản Admin mặc định: admin@ictu.vn / Admin@123")

    # 5. Tạo tài khoản Giảng viên / Người đặt lịch mẫu
    organizer_email = "organizer@ictu.vn"
    organizer_user = db.query(User).filter(User.email == organizer_email).first()
    if not organizer_user:
        organizer_user = User(
            email=organizer_email,
            password_hash=get_password_hash("123456"),
            full_name="Nguyễn Văn A (Giảng viên)",
            phone="0912345678",
            role_id=roles_map["ORGANIZER"],
            department_id=dept_map.get("Khoa Công nghệ thông tin"),
            status="ACTIVE"
        )
        db.add(organizer_user)
        db.commit()
        print(">> Đã khởi tạo tài khoản Organizer mẫu: organizer@ictu.vn / 123456")

    # 6. Khởi tạo một số phòng họp mẫu (Rooms - US #7, #10)
    sample_rooms = [
        {
            "name": "Hội trường lớn C1",
            "capacity": 150,
            "location": "Tầng 1, Tòa nhà C1",
            "description": "Màn hình LED lớn, hệ thống âm thanh hội thảo, điều hòa trung tâm",
            "status": "AVAILABLE"
        },
        {
            "name": "Phòng họp Ban Giám hiệu (A1-201)",
            "capacity": 30,
            "location": "Tầng 2, Tòa nhà Điều hành A1",
            "description": "Bàn tròn VIP, micro từng vị trí, màn hình TV 85 inch",
            "status": "AVAILABLE"
        },
        {
            "name": "Phòng hội thảo Khoa CNTT (C1-402)",
            "capacity": 60,
            "location": "Tầng 4, Tòa nhà C1",
            "description": "Máy chiếu 4K, 2 micro không dây, wifi tốc độ cao",
            "status": "AVAILABLE"
        },
        {
            "name": "Phòng họp chuyên đề (C1-305)",
            "capacity": 25,
            "location": "Tầng 3, Tòa nhà C1",
            "description": "Bảng thông minh Smartboard, bàn ghế di động linh hoạt",
            "status": "AVAILABLE"
        },
        {
            "name": "Phòng họp nhóm sinh viên (B-102)",
            "capacity": 15,
            "location": "Tầng 1, Tòa nhà B",
            "description": "TV 65 inch, cổng kết nối HDMI/Type-C",
            "status": "AVAILABLE"
        },
        {
            "name": "Phòng đa năng C2 (Đang bảo trì)",
            "capacity": 50,
            "location": "Tầng 2, Tòa nhà C2",
            "description": "Đang bảo trì hệ thống điều hòa và ánh sáng",
            "status": "MAINTENANCE"
        }
    ]

    for r_data in sample_rooms:
        room = db.query(Room).filter(Room.room_name == r_data["name"]).first()
        if not room:
            room = Room(
                room_name=r_data["name"],
                capacity=r_data["capacity"],
                location=r_data["location"],
                description=r_data["description"],
                status=r_data["status"]
            )
            db.add(room)
            db.commit()
            db.refresh(room)

            # Cấu hình giới hạn mẫu (US #21):
            # Phòng Ban Giám hiệu (A1-201) chỉ dành cho Admin và Giảng viên, cấm PARTICIPANT (sinh viên) đặt
            if "Ban Giám hiệu" in room.room_name and "PARTICIPANT" in roles_map:
                restriction = RoomRestriction(
                    room_id=room.room_id,
                    role_id=roles_map["PARTICIPANT"],
                    notes="Chỉ cán bộ giảng viên và ban giám hiệu mới được đặt phòng này"
                )
                db.add(restriction)
                db.commit()
    print(">> Đã khởi tạo danh sách phòng họp mẫu thành công!")

    # 7. Khởi tạo danh mục thiết bị mẫu (Equipments - US #12, #13, #14)
    # Lấy ID các phòng để gán thiết bị cố định
    c1_room = db.query(Room).filter(Room.room_name == "Hội trường lớn C1").first()
    bgh_room = db.query(Room).filter(Room.room_name == "Phòng họp Ban Giám hiệu (A1-201)").first()
    cntt_room = db.query(Room).filter(Room.room_name == "Phòng hội thảo Khoa CNTT (C1-402)").first()
    c1_305_room = db.query(Room).filter(Room.room_name == "Phòng họp chuyên đề (C1-305)").first()

    sample_equipments = [
        {
            "name": "Máy chiếu Sony 4K Laser VPL-FHZ85",
            "type": "PROJECTOR",
            "serial": "PRJ-SNY-01",
            "room_id": c1_room.room_id if c1_room else None,
            "status": "AVAILABLE",
            "description": "Độ sáng 7,300 lumens, độ phân giải WUXGA 4K upscaling"
        },
        {
            "name": "Hệ thống Màn hình LED P2.5 Indoor",
            "type": "TV",
            "serial": "LED-C1-01",
            "room_id": c1_room.room_id if c1_room else None,
            "status": "AVAILABLE",
            "description": "Kích thước 200 inch, phục vụ hội thảo quy mô lớn"
        },
        {
            "name": "TV Hội nghị Samsung Neo QLED 85 inch",
            "type": "TV",
            "serial": "TV-BGH-01",
            "room_id": bgh_room.room_id if bgh_room else None,
            "status": "AVAILABLE",
            "description": "Độ phân giải 8K, tích hợp cổng kết nối không dây Smart View"
        },
        {
            "name": "Hệ thống Micro cổ ngỗng Bosch CCS 900 (10 mic)",
            "type": "MICROPHONE",
            "serial": "MIC-BGH-01",
            "room_id": bgh_room.room_id if bgh_room else None,
            "status": "AVAILABLE",
            "description": "Hệ thống âm thanh hội thảo chuyên dụng cho Ban Giám hiệu"
        },
        {
            "name": "Bảng tương tác thông minh Maxhub 75 inch",
            "type": "SMARTBOARD",
            "serial": "SB-C1-305",
            "room_id": c1_305_room.room_id if c1_305_room else None,
            "status": "AVAILABLE",
            "description": "Cảm ứng 20 điểm, tích hợp camera và microphone họp trực tuyến"
        },
        {
            "name": "Bộ Micro không dây Shure BLX288/PG58 (2 mic)",
            "type": "MICROPHONE",
            "serial": "MIC-SHR-02",
            "room_id": cntt_room.room_id if cntt_room else None,
            "status": "AVAILABLE",
            "description": "Âm thanh trong trẻo, phạm vi bắt sóng 100m"
        },
        {
            "name": "Bộ thiết bị họp trực tuyến Logitech Rally Bar",
            "type": "CAMERA",
            "serial": "CAM-LOGI-01",
            "room_id": None, # Thiết bị di động dùng chung
            "status": "AVAILABLE",
            "description": "All-in-one video bar 4K, AI framing tự động bắt hình người nói"
        },
        {
            "name": "Loa di động Marshall Woburn III & 2 Micro",
            "type": "SPEAKER",
            "serial": "SPK-MAR-01",
            "room_id": None, # Thiết bị di động dùng chung
            "status": "AVAILABLE",
            "description": "Công suất 150W, thích hợp cho sự kiện vừa và nhỏ ngoài trời/trong nhà"
        },
        {
            "name": "Máy chiếu di động Epson EB-2250U Full HD",
            "type": "PROJECTOR",
            "serial": "PRJ-EPS-02",
            "room_id": None, # Thiết bị di động dùng chung
            "status": "AVAILABLE",
            "description": "Độ sáng 5,000 lumens, cổng HDMI, VGA, Wireless LAN"
        },
        {
            "name": "Bộ chuyển đổi không dây Barco ClickShare CX-30",
            "type": "OTHER",
            "serial": "BAR-CX30-01",
            "room_id": None, # Thiết bị di động dùng chung
            "status": "MAINTENANCE",
            "description": "Đang gửi hãng bảo hành bộ phát USB-C Button"
        },
        {
            "name": "Camera hội nghị 360 độ Kandao Meeting Pro",
            "type": "CAMERA",
            "serial": "CAM-360-01",
            "room_id": None, # Thiết bị di động dùng chung
            "status": "BROKEN",
            "description": "Hỏng cáp nguồn USB-C, chờ thay thế linh kiện"
        }
    ]

    for eq_data in sample_equipments:
        eq = db.query(Equipment).filter(Equipment.serial_number == eq_data["serial"]).first()
        if not eq:
            eq = Equipment(
                equipment_name=eq_data["name"],
                equipment_type=eq_data["type"],
                serial_number=eq_data["serial"],
                room_id=eq_data["room_id"],
                status=eq_data["status"],
                description=eq_data["description"]
            )
            db.add(eq)
            db.commit()
    print(">> Đã khởi tạo danh mục thiết bị mẫu thành công!")
