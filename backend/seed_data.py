import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy.orm import Session
from app.core.database import engine, Base, SessionLocal
from app.models.role import Role
from app.models.department import Department
from app.models.user import User
from app.models.room import Room
from app.models.equipment import Equipment, MeetingEquipment
from app.models.meeting import Meeting, MeetingParticipant
from app.models.audit import AuditLog
from app.core.security import get_password_hash
from datetime import datetime, timedelta
import uuid

def seed_db():
    print("🚀 Đang làm sạch và nạp dữ liệu mới vào DB...")
    # Recreate tables to clear old data
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        # 1. Tạo Roles
        print("Tạo Roles...")
        role_admin = Role(role_name="ADMIN")
        role_lecturer = Role(role_name="LECTURER")
        role_participant = Role(role_name="PARTICIPANT")
        db.add_all([role_admin, role_lecturer, role_participant])
        db.commit()

        # 2. Tạo Departments
        print("Tạo Departments...")
        dept_cntt = Department(department_name="Khoa CNTT")
        dept_dt = Department(department_name="Phòng Đào Tạo")
        dept_qt = Department(department_name="Phòng Quản trị Thiết bị")
        dept_k16 = Department(department_name="Lớp K16-CNTT")
        db.add_all([dept_cntt, dept_dt, dept_qt, dept_k16])
        db.commit()

        # 3. Tạo Users
        print("Tạo Users...")
        users_data = [
            User(full_name="Hoàng Phương", email="admin@ictu.edu.vn", password_hash=get_password_hash("123456"), role_id=role_admin.role_id, department_id=dept_qt.department_id, avatar_url="https://ui-avatars.com/api/?name=Admin&background=random"),
            User(full_name="Hoàng Thanh Phương", email="hoangphuong@ictu.edu.vn", password_hash=get_password_hash("123456"), role_id=role_lecturer.role_id, department_id=dept_cntt.department_id, avatar_url="https://ui-avatars.com/api/?name=Phuong&background=random"),
            User(full_name="ThS. Trần Thị B", email="tranthib@ictu.edu.vn", password_hash=get_password_hash("123456"), role_id=role_lecturer.role_id, department_id=dept_dt.department_id, avatar_url="https://ui-avatars.com/api/?name=B&background=random"),
            User(full_name="Trần Văn D", email="sinhvien_d@ictu.edu.vn", password_hash=get_password_hash("123456"), role_id=role_participant.role_id, department_id=dept_k16.department_id, avatar_url="https://ui-avatars.com/api/?name=D&background=random"),
            User(full_name="Phạm Thị E", email="sinhvien_e@ictu.edu.vn", password_hash=get_password_hash("123456"), role_id=role_participant.role_id, department_id=dept_k16.department_id, avatar_url="https://ui-avatars.com/api/?name=E&background=random")
        ]
        db.add_all(users_data)
        db.commit()
        
        user_Admin, user_Phuong, user_B, user_D, user_E = users_data

        # 4. Tạo Rooms
        print("Tạo Rooms...")
        rooms_data = [
            Room(
                room_name="Hội trường lớn C1 (C1-101)",
                capacity=150,
                location="Tầng 1 Tòa C1",
                status="AVAILABLE",
                description="Hội trường lớn dành cho các hội nghị, lễ tốt nghiệp và sự kiện quy mô toàn trường.",
                image_url="https://images.unsplash.com/photo-1505373877841-8d25f7d46678?auto=format&fit=crop&q=80&w=800",
                equipments="Máy chiếu 4K Sony,Loa hội trường JBL,Micro không dây Shure,Điều hòa trung tâm,Wifi 6 High-Speed"
            ),
            Room(
                room_name="Phòng họp Ban Giám hiệu (A1-201)",
                capacity=30,
                location="Tầng 2 Tòa A1",
                status="AVAILABLE",
                description="Phòng họp cao cấp dành cho Ban Giám hiệu và các cuộc họp quan trọng cấp trường.",
                image_url="https://images.unsplash.com/photo-1571624436279-b272aff752b5?auto=format&fit=crop&q=80&w=800",
                equipments="Máy chiếu 4K Sony,Bộ camera họp trực tuyến Logitech,Điều hòa trung tâm,Wifi 6 High-Speed"
            ),
            Room(
                room_name="Phòng hội thảo Khoa CNTT (C1-402)",
                capacity=60,
                location="Tầng 4 Tòa C1",
                status="AVAILABLE",
                description="Phòng hội thảo chuyên biệt cho Khoa CNTT, phù hợp cho các seminar và bảo vệ đồ án.",
                image_url="https://images.unsplash.com/photo-1542744173-8e7e53415bb0?auto=format&fit=crop&q=80&w=800",
                equipments="Máy chiếu 4K Sony,Bảng tương tác thông minh,Bộ camera họp trực tuyến Logitech,Micro không dây Shure,Wifi 6 High-Speed"
            ),
            Room(
                room_name="Phòng họp chuyên đề (C1-305)",
                capacity=25,
                location="Tầng 3 Tòa C1",
                status="AVAILABLE",
                description="Phòng họp nhỏ phù hợp cho các buổi họp bộ môn và thảo luận chuyên đề.",
                image_url="https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&q=80&w=800",
                equipments="Laptop trình chiếu,Điều hòa trung tâm,Wifi 6 High-Speed"
            ),
            Room(
                room_name="Phòng Lab Máy tính (B1-301)",
                capacity=50,
                location="Tầng 3 Tòa B1",
                status="AVAILABLE",
                description="Phòng máy tính với 50 máy tính cá nhân, phục vụ thực hành lập trình và thi trực tuyến.",
                image_url="https://images.unsplash.com/photo-1516321497487-e288fb19713f?auto=format&fit=crop&q=80&w=800",
                equipments="Laptop trình chiếu,Bảng tương tác thông minh,Điều hòa trung tâm,Wifi 6 High-Speed"
            ),
            Room(
                room_name="Phòng Đào tạo A4 (A1-401)",
                capacity=40,
                location="Tầng 4 Tòa A1",
                status="MAINTENANCE",
                description="Phòng đào tạo đang được bảo trì, nâng cấp thiết bị. Dự kiến hoàn thành trong tuần tới.",
                image_url="https://images.unsplash.com/photo-1524178232363-1fb2b075b655?auto=format&fit=crop&q=80&w=800",
                equipments="Máy chiếu 4K Sony,Bảng tương tác thông minh,Điều hòa trung tâm"
            ),
        ]
        db.add_all(rooms_data)
        db.commit()
        
        room_1, room_2, room_3, room_4, room_5, room_6 = rooms_data

        # 5. Tạo Equipment
        print("Tạo Equipment...")
        equipments_data = [
            Equipment(equipment_name="Máy chiếu Sony 4K Laser", code="PRJ-SNY-01", equipment_type="PROJECTOR", room_id=room_1.room_id),
            Equipment(equipment_name="Hệ thống Màn hình LED P2.5 Indoor", code="TV-LED-C1-01", equipment_type="SCREEN", room_id=room_1.room_id),
            Equipment(equipment_name="Bộ thiết bị họp trực tuyến Logitech Rally Bar", code="CAM-LOGI-01", equipment_type="CAMERA", room_id=None),
            Equipment(equipment_name="Micro không dây Shure ULXD4D", code="MIC-SHURE-01", equipment_type="AUDIO", room_id=None)
        ]
        db.add_all(equipments_data)
        db.commit()
        
        eq_prj, eq_led, eq_cam, eq_mic = equipments_data

        # 6. Tạo Meetings & Participants
        print("Tạo Meetings...")
        now = datetime.now()
        tomorrow = now + timedelta(days=1)
        day_after = now + timedelta(days=2)

        # Sample booking m1 removed
        m2 = Meeting(
            title="Bảo vệ Đồ án Tốt nghiệp K16",
            description="Hội đồng đánh giá luận văn tốt nghiệp.",
            room_id=room_1.room_id,
            organizer_id=user_Phuong.user_id,
            start_time=day_after.replace(hour=14, minute=0, second=0, microsecond=0),
            end_time=day_after.replace(hour=17, minute=0, second=0, microsecond=0),
            meeting_type="HYBRID",
            meeting_link="https://meet.google.com/abc-xyz",
            passcode="123456",
            status="SCHEDULED",
            qr_token=str(uuid.uuid4())
        )
        # db.add_all([m1, m2])  # Sample booking removed
        # db.commit()  # Sample booking removed

        # Participants cho m1
        # db.add(MeetingParticipant(meeting_id=m1.meeting_id, user_id=user_Phuong.user_id, rsvp_status="ACCEPTED"))  # removed
        # db.add(MeetingParticipant(meeting_id=m1.meeting_id, user_id=user_B.user_id, rsvp_status="PENDING"))  # removed
        
        # Participants cho m2
        db.add(MeetingParticipant(meeting_id=m2.meeting_id, user_id=user_Phuong.user_id, rsvp_status="ACCEPTED"))
        db.add(MeetingParticipant(meeting_id=m2.meeting_id, user_id=user_D.user_id, rsvp_status="ACCEPTED"))
        db.add(MeetingParticipant(meeting_id=m2.meeting_id, user_id=user_E.user_id, rsvp_status="PENDING"))

        # Thiết bị mượn cho m1
        # db.add(MeetingEquipment(meeting_id=m1.meeting_id, equipment_id=eq_cam.equipment_id, quantity=1))  # removed

        # Thiết bị mượn cho m2
        db.add(MeetingEquipment(meeting_id=m2.meeting_id, equipment_id=eq_prj.equipment_id, quantity=1))
        db.add(MeetingEquipment(meeting_id=m2.meeting_id, equipment_id=eq_mic.equipment_id, quantity=2))
        db.add(MeetingEquipment(meeting_id=m2.meeting_id, equipment_id=eq_led.equipment_id, quantity=1))

        db.commit()
        print("✅ Thành công: Dữ liệu đã được nạp vào Database!")

    except Exception as e:
        print(f"❌ Lỗi: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_db()
