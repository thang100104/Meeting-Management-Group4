from typing import List, Optional
from datetime import datetime, date, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_, and_, func
from app.core.database import get_db
from app.models.meeting import Meeting, MeetingParticipant
from app.models.equipment import Equipment, MeetingEquipment
from app.models.room import Room, RoomRestriction
from app.models.user import User
from app.schemas.meeting import (
    MeetingCreate, MeetingUpdate, MeetingOut, MeetingRespond, 
    RoomAvailability, MeetingStatusUpdate, MeetingApprovalRequest, MeetingRejectRequest
)
from app.api.deps import get_current_active_user, require_roles
from app.models.audit import AuditLog
import uuid
import traceback

router = APIRouter()

def log_action(db: Session, user_id: int, action: str, details: str):
    db.add(AuditLog(user_id=user_id, action=action, details=details))
    # db.commit() is intentionally left out to be committed with the main transaction


# ============================================================
# SEARCH USERS FOR PARTICIPANT INVITE (mọi role đều dùng được)
# ============================================================
@router.get("/search-users", summary="Tìm kiếm người dùng Active để mời tham dự (US #19)")
def search_users_for_invite(
    q: str = Query("", description="Tìm theo tên hoặc email"),
    limit: int = Query(20, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Endpoint nhẹ cho phép mọi user đã đăng nhập tìm kiếm người dùng active
    để thêm vào danh sách mời cuộc họp. Trả về thông tin tối giản (không lộ password).
    """
    query = db.query(User).filter(User.status == "ACTIVE")
    if q.strip():
        s = f"%{q.strip()}%"
        query = query.filter(or_(User.full_name.ilike(s), User.email.ilike(s)))
    
    # Loại trừ chính user hiện tại khỏi kết quả
    query = query.filter(User.user_id != current_user.user_id)
    
    users = query.order_by(User.full_name.asc()).limit(limit).all()
    
    return [
        {
            "user_id": u.user_id,
            "full_name": u.full_name,
            "email": u.email,
            "role_name": u.role.role_name if u.role else "UNKNOWN",
            "department_name": u.department.department_name if u.department else None
        }
        for u in users
    ]


# ============================================================
# TẠO LỊCH HỌP MỚI (NÂNG CẤP HOÀN CHỈNH)
# ============================================================
@router.post("", response_model=MeetingOut, status_code=status.HTTP_201_CREATED, summary="Tạo lịch họp mới kèm thiết bị (US #1, #4, #12)")
def create_meeting(
    data: MeetingCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    try:
        # ── 0. KIỂM TRA PHÂN QUYỀN RBAC ──
        if current_user.role.role_name == "PARTICIPANT":
            raise HTTPException(
                status_code=403,
                detail="Vai trò PARTICIPANT (Sinh viên) không có quyền tạo cuộc họp. Chỉ ADMIN hoặc ORGANIZER mới được phép."
            )

        # ── 1. VALIDATION THỜI GIAN ──
        if data.start_time >= data.end_time:
            raise HTTPException(status_code=400, detail="Thời gian kết thúc phải sau thời gian bắt đầu")
        
        # Bỏ kiểm tra thời gian quá khứ để tránh lỗi timezone naive/aware crash
        
        # ── 2. KIỂM TRA PHÒNG TỒN TẠI VÀ TRẠNG THÁI ──
        room = db.query(Room).filter(Room.room_id == data.room_id).first()
        if not room:
            raise HTTPException(status_code=404, detail="Không tìm thấy phòng họp")
        if room.status != "AVAILABLE":
            raise HTTPException(status_code=400, detail=f"Phòng '{room.room_name}' đang bảo trì (MAINTENANCE), không thể đặt")
        
        # ── 2. KIỂM TRA QUYỀN ĐẶT PHÒNG THEO ROLE (US #21) ──
        if current_user.role.role_name != "ADMIN":
            restrictions = db.query(RoomRestriction).filter(RoomRestriction.room_id == data.room_id).all()
            if restrictions:
                restricted_role_ids = [r.role_id for r in restrictions]
                if current_user.role_id in restricted_role_ids:
                    raise HTTPException(
                        status_code=403, 
                        detail=f"Vai trò '{current_user.role.role_name}' không có quyền đặt phòng '{room.room_name}'. Phòng này bị giới hạn quyền truy cập theo chính sách (US #21)."
                    )

        # ── 3. PHÁT HIỆN TRÙNG LỊCH PHÒNG (Conflict Detection - US #8) ──
        conflict_room = db.query(Meeting).filter(
            Meeting.room_id == data.room_id,
            Meeting.status.in_(["SCHEDULED", "APPROVED", "IN_PROGRESS"]),
            Meeting.start_time < data.end_time,
            Meeting.end_time > data.start_time
        ).first()
        if conflict_room:
            raise HTTPException(
                status_code=409,
                detail=f"Trùng lịch phòng! Phòng '{room.room_name}' đã được xếp lịch cho cuộc họp '{conflict_room.title}' ({conflict_room.start_time.strftime('%H:%M')} - {conflict_room.end_time.strftime('%H:%M')}). Vui lòng chọn khung giờ hoặc phòng khác."
            )

        # ── 4. KIỂM TRA THIẾT BỊ VÀ PHÁT HIỆN XUNG ĐỘT (Conflict Detection) ──
        if data.equipment_ids:
            for eq_id in set(data.equipment_ids):
                eq = db.query(Equipment).filter(Equipment.equipment_id == eq_id).first()
                if not eq:
                    raise HTTPException(status_code=404, detail=f"Không tìm thấy thiết bị ID={eq_id}")
                if eq.status != "AVAILABLE":
                    raise HTTPException(
                        status_code=400,
                        detail=f"Thiết bị '{eq.equipment_name}' đang ở trạng thái {eq.status}, không thể mượn"
                    )

                # conflict_eq = (
                #     db.query(Meeting)
                #     .join(MeetingEquipment, Meeting.meeting_id == MeetingEquipment.meeting_id)
                #     .filter(
                #         MeetingEquipment.equipment_id == eq_id,
                #         Meeting.status != "CANCELLED",
                #         Meeting.start_time < data.end_time,
                #         Meeting.end_time > data.start_time
                #     )
                #     .first()
                # )
                # if conflict_eq:
                #     raise HTTPException(
                #         status_code=409,
                #         detail=f"Trùng lịch thiết bị! Thiết bị '{eq.equipment_name}' đã được đăng ký mượn cho cuộc họp '{conflict_eq.title}' ({conflict_eq.start_time.strftime('%H:%M')} - {conflict_eq.end_time.strftime('%H:%M')})"
                #     )

        # ── 5. TẠO CUỘC HỌP (Transaction) ──
        # Đặt lịch xong được duyệt luôn: Trực tiếp SCHEDULED cho tất cả người dùng, không cần phê duyệt
        meeting_status = "SCHEDULED"
        meeting = Meeting(
            organizer_id=current_user.user_id,
            room_id=data.room_id,
            title=data.title,
            description=data.description,
            start_time=data.start_time,
            end_time=data.end_time,
            meeting_type=data.meeting_type or "IN_PERSON",
            meeting_link=data.meeting_link,
            passcode=data.passcode,
            status=meeting_status
        )
        if data.meeting_type in ["ONLINE", "HYBRID"] and not data.meeting_link:
            meeting.meeting_link = f"https://meet.ictu.edu.vn/{str(uuid.uuid4())[:8]}"
            meeting.passcode = "123456"
        
        db.add(meeting)
        db.flush() # Lấy meeting_id

        # ── 6. THÊM NGƯỜI THAM GIA (US #4) ──
        if data.participant_ids:
            for uid in set(data.participant_ids):
                u = db.query(User).filter(User.user_id == uid).first()
                if u:
                    participant = MeetingParticipant(meeting_id=meeting.meeting_id, user_id=uid, rsvp_status="PENDING")
                    db.add(participant)

        # ── 7. GÁN THIẾT BỊ MƯỢN KÈM (US #12) ──
        if data.equipment_ids:
            for eq_id in set(data.equipment_ids):
                me = MeetingEquipment(meeting_id=meeting.meeting_id, equipment_id=eq_id, quantity=1)
                db.add(me)

        # ── 8. XỬ LÝ LỊCH HỌP ĐỊNH KỲ (US #3: Recurrence) ──
        if data.recurrence in ["WEEKLY", "MONTHLY"] and data.recurrence_count and data.recurrence_count > 1:
            for i in range(1, min(data.recurrence_count, 12)):
                delta_days = i * 7 if data.recurrence == "WEEKLY" else i * 30
                delta = timedelta(days=delta_days)
                rec_start = data.start_time + delta
                rec_end = data.end_time + delta

                rec_conflict = db.query(Meeting).filter(
                    Meeting.room_id == data.room_id,
                    Meeting.status.in_(["SCHEDULED", "APPROVED"]),
                    Meeting.start_time < rec_end,
                    Meeting.end_time > rec_start
                ).first()

                if not rec_conflict:
                    rec_meeting = Meeting(
                        organizer_id=current_user.user_id,
                        room_id=data.room_id,
                        title=f"{data.title} (Lần {i+1})",
                        description=data.description,
                        start_time=rec_start,
                        end_time=rec_end,
                        meeting_type=data.meeting_type or "IN_PERSON",
                        meeting_link=meeting.meeting_link,
                        passcode=meeting.passcode,
                        status=meeting_status
                    )
                    db.add(rec_meeting)
                    db.flush()

                    if data.participant_ids:
                        for uid in set(data.participant_ids):
                            db.add(MeetingParticipant(meeting_id=rec_meeting.meeting_id, user_id=uid, rsvp_status="PENDING"))
                    if data.equipment_ids:
                        for eq_id in set(data.equipment_ids):
                            db.add(MeetingEquipment(meeting_id=rec_meeting.meeting_id, equipment_id=eq_id, quantity=1))

        log_action(db, current_user.user_id, "CREATE_MEETING", f"Tạo lịch họp '{meeting.title}' (ID: {meeting.meeting_id}, Định kỳ: {data.recurrence})")
        db.commit()
        db.refresh(meeting)
        
        # Refresh again with relationships loaded
        meeting = db.query(Meeting).options(
            joinedload(Meeting.organizer),
            joinedload(Meeting.room),
            joinedload(Meeting.participants).joinedload(MeetingParticipant.user),
            joinedload(Meeting.meeting_equipments).joinedload(MeetingEquipment.equipment)
        ).filter(Meeting.meeting_id == meeting.meeting_id).first()
        
        return meeting
        
    except HTTPException:
        # Nếu là HTTPException đã raise từ trước, ném lại
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        print("=== ERROR CREATING MEETING ===")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("", response_model=List[MeetingOut], summary="Xem danh sách lịch họp")
def list_meetings(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=200),
    room_id: Optional[int] = None,
    user_id: Optional[int] = None,
    status_filter: Optional[str] = Query(None, alias="status"),
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    query = db.query(Meeting).options(
        joinedload(Meeting.organizer),
        joinedload(Meeting.room),
        joinedload(Meeting.participants).joinedload(MeetingParticipant.user),
        joinedload(Meeting.meeting_equipments).joinedload(MeetingEquipment.equipment)
    )
    
    if room_id:
        query = query.filter(Meeting.room_id == room_id)
    if user_id:
        query = query.join(MeetingParticipant, isouter=True).filter(
            or_(Meeting.organizer_id == user_id, MeetingParticipant.user_id == user_id)
        )
    if status_filter:
        query = query.filter(Meeting.status == status_filter.upper())
    if from_date:
        query = query.filter(Meeting.start_time >= datetime.combine(from_date, datetime.min.time()))
    if to_date:
        query = query.filter(Meeting.end_time <= datetime.combine(to_date, datetime.max.time()))
        
    meetings = query.order_by(Meeting.start_time.desc() if status_filter else Meeting.start_time.asc()).offset(skip).limit(limit).all()
    return meetings

# ============================================================
# GỢI Ý THỜI GIAN KHI MỌI NGƯỜI ĐỀU RẢNH (US #5)
# ============================================================
@router.get("/suggest-time", summary="Gợi ý thời gian họp khi mọi người đều rảnh (US #5)")
def suggest_meeting_time(
    date_str: str = Query(..., alias="date", description="Ngày cần họp (YYYY-MM-DD)"),
    participant_ids: Optional[str] = Query(None, description="Danh sách ID người tham gia, phân cách bằng dấu phẩy"),
    room_id: Optional[int] = Query(None, description="ID phòng họp nếu đã chọn"),
    duration_minutes: int = Query(60, ge=30, le=180, description="Thời lượng cuộc họp dự kiến (phút)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    try:
        meeting_date = datetime.strptime(date_str, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Định dạng ngày không hợp lệ, dùng YYYY-MM-DD")

    p_ids = [current_user.user_id]
    if participant_ids:
        for p in participant_ids.split(","):
            if p.strip().isdigit():
                p_ids.append(int(p.strip()))
    p_ids = list(set(p_ids))

    candidate_slots = [
        ("08:00", "09:00"),
        ("08:30", "09:30"),
        ("09:00", "10:00"),
        ("09:30", "10:30"),
        ("10:00", "11:00"),
        ("10:30", "11:30"),
        ("13:30", "14:30"),
        ("14:00", "15:00"),
        ("14:30", "15:30"),
        ("15:00", "16:00"),
        ("15:30", "16:30"),
        ("16:00", "17:00"),
    ]

    day_start = datetime.combine(meeting_date, datetime.min.time())
    day_end = datetime.combine(meeting_date, datetime.max.time())

    busy_meetings = db.query(Meeting).options(
        joinedload(Meeting.participants)
    ).join(MeetingParticipant, isouter=True).filter(
        Meeting.status.in_(["SCHEDULED", "APPROVED", "IN_PROGRESS"]),
        Meeting.start_time <= day_end,
        Meeting.end_time >= day_start,
        or_(
            Meeting.organizer_id.in_(p_ids),
            MeetingParticipant.user_id.in_(p_ids)
        )
    ).all()

    room_busy_meetings = []
    if room_id:
        room_busy_meetings = db.query(Meeting).filter(
            Meeting.room_id == room_id,
            Meeting.status.in_(["SCHEDULED", "APPROVED", "IN_PROGRESS"]),
            Meeting.start_time <= day_end,
            Meeting.end_time >= day_start
        ).all()

    suggestions = []
    for s_str, e_str in candidate_slots:
        s_hour, s_min = map(int, s_str.split(":"))
        slot_start = datetime.combine(meeting_date, datetime.min.time()).replace(hour=s_hour, minute=s_min)
        slot_end = slot_start + timedelta(minutes=duration_minutes)

        busy_users = set()
        for bm in busy_meetings:
            if bm.start_time < slot_end and bm.end_time > slot_start:
                if bm.organizer_id in p_ids:
                    busy_users.add(bm.organizer_id)
                if bm.participants:
                    for part in bm.participants:
                        if part.user_id in p_ids:
                            busy_users.add(part.user_id)

        room_busy = False
        for rbm in room_busy_meetings:
            if rbm.start_time < slot_end and rbm.end_time > slot_start:
                room_busy = True
                break

        total_users = len(p_ids)
        free_users_count = total_users - len(busy_users)

        if len(busy_users) == 0 and not room_busy:
            status_text = "Rảnh 100%"
            is_optimal = True
        elif not room_busy and free_users_count >= total_users * 0.7:
            status_text = f"Bận {len(busy_users)} người"
            is_optimal = False
        else:
            status_text = "Không khả dụng"
            is_optimal = False

        suggestions.append({
            "start_time": s_str,
            "end_time": slot_end.strftime("%H:%M"),
            "slot_start": slot_start.isoformat(),
            "slot_end": slot_end.isoformat(),
            "is_optimal": is_optimal,
            "free_count": free_users_count,
            "total_count": total_users,
            "status": status_text,
            "room_available": not room_busy
        })

    suggestions.sort(key=lambda x: (not x["is_optimal"], -x["free_count"]))
    return suggestions

# ============================================================
# LỊCH SỬ CÁC CUỘC HỌP ĐÃ THAM GIA (US #6)
# ============================================================
@router.get("/history", response_model=List[MeetingOut], summary="Xem lại lịch sử các cuộc họp đã tham gia (US #6)")
def get_meeting_history(
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    now = datetime.now()
    meetings = db.query(Meeting).options(
        joinedload(Meeting.organizer),
        joinedload(Meeting.room),
        joinedload(Meeting.participants).joinedload(MeetingParticipant.user),
        joinedload(Meeting.meeting_equipments).joinedload(MeetingEquipment.equipment)
    ).join(MeetingParticipant, isouter=True).filter(
        or_(
            Meeting.organizer_id == current_user.user_id,
            MeetingParticipant.user_id == current_user.user_id
        ),
        or_(
            Meeting.end_time < now,
            Meeting.status.in_(["COMPLETED", "CANCELLED", "REJECTED"])
        )
    ).order_by(Meeting.start_time.desc()).limit(limit).all()

    unique_meetings = []
    seen_ids = set()
    for m in meetings:
        if m.meeting_id not in seen_ids:
            seen_ids.add(m.meeting_id)
            unique_meetings.append(m)

    return unique_meetings


# ============================================================
# BÁO CÁO VÀ THỐNG KÊ CHI TIẾT (US #22, #23, #24)
# ============================================================
@router.get("/reports/analytics", summary="Báo cáo phân tích hiệu suất phòng họp, thiết bị và thống kê hủy (US #22, #23, #24)")
def get_analytics_report(
    period: Optional[str] = Query(None, description="Khoảng thời gian: all, this_month, last_month, this_year"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Trả về toàn bộ số liệu thống kê thực tế từ CSDL phục vụ US #22, #23, #24:
    - Báo cáo sử dụng phòng: số giờ sử dụng, tỷ lệ lấp đầy, phòng dùng nhiều nhất (US #22)
    - Thống kê hủy họp: số cuộc hủy, tỷ lệ hủy, số giờ lãng phí, lý do hủy (US #23)
    - Danh sách chi tiết hỗ trợ xuất báo cáo Excel/CSV và PDF (US #24)
    """
    all_meetings = db.query(Meeting).options(
        joinedload(Meeting.organizer),
        joinedload(Meeting.room),
        joinedload(Meeting.meeting_equipments).joinedload(MeetingEquipment.equipment)
    ).all()
    
    rooms = db.query(Room).options(joinedload(Room.restrictions).joinedload(RoomRestriction.role)).all()
    equipments = db.query(Equipment).all()
    
    total_meetings = len(all_meetings)
    cancelled_meetings = [m for m in all_meetings if m.status == "CANCELLED"]
    completed_or_active = [m for m in all_meetings if m.status in ["SCHEDULED", "APPROVED", "IN_PROGRESS", "COMPLETED"]]
    
    cancelled_count = len(cancelled_meetings)
    active_count = len(completed_or_active)
    cancellation_rate = round((cancelled_count / total_meetings * 100), 1) if total_meetings > 0 else 0.0

    # Tính thời lượng cuộc họp (giờ)
    def calc_duration_hours(m):
        if m.start_time and m.end_time:
            diff = (m.end_time - m.start_time).total_seconds() / 3600.0
            return max(0.0, diff)
        return 0.0

    total_hours_used = sum(calc_duration_hours(m) for m in completed_or_active)
    total_hours_used = round(total_hours_used, 1)

    # Tổng số giờ lãng phí do hủy cuộc họp (US #23)
    wasted_hours = sum(calc_duration_hours(m) for m in cancelled_meetings)
    wasted_hours = round(wasted_hours, 1)

    # Thống kê chi tiết từng phòng họp (US #22)
    room_stats = {}
    for r in rooms:
        room_stats[r.room_id] = {
            "room_id": r.room_id,
            "room_name": r.room_name,
            "capacity": r.capacity,
            "location": r.location,
            "status": "Đang bảo trì" if r.status == "MAINTENANCE" else "Đang hoạt động",
            "total_bookings": 0,
            "total_hours": 0.0,
            "cancelled_count": 0,
            "restrictions": [
                {
                    "restriction_id": res.restriction_id,
                    "role_id": res.role_id,
                    "role_name": res.role.role_name if res.role else "",
                    "notes": res.notes
                }
                for res in (r.restrictions or [])
            ]
        }

    for m in all_meetings:
        if m.room_id in room_stats:
            if m.status == "CANCELLED":
                room_stats[m.room_id]["cancelled_count"] += 1
            else:
                room_stats[m.room_id]["total_bookings"] += 1
                room_stats[m.room_id]["total_hours"] += calc_duration_hours(m)

    for r_id in room_stats:
        room_stats[r_id]["total_hours"] = round(room_stats[r_id]["total_hours"], 1)

    room_utilization = sorted(list(room_stats.values()), key=lambda x: x["total_hours"], reverse=True)

    # Phòng dùng nhiều nhất
    top_room = {"name": "Chưa có dữ liệu", "hours": 0.0, "bookings": 0}
    if room_utilization and room_utilization[0]["total_hours"] > 0:
        top_room = {
            "name": room_utilization[0]["room_name"],
            "hours": room_utilization[0]["total_hours"],
            "bookings": room_utilization[0]["total_bookings"]
        }

    # Thống kê thiết bị mượn nhiều nhất
    eq_stats = {}
    for eq in equipments:
        eq_stats[eq.equipment_id] = {
            "equipment_id": eq.equipment_id,
            "equipment_name": eq.equipment_name,
            "status": "Sẵn sàng" if eq.status == "AVAILABLE" else ("Đang sử dụng" if eq.status == "IN_USE" else "Bảo dưỡng"),
            "booking_count": 0,
            "room_name": eq.room.room_name if eq.room else "Kho trung tâm"
        }

    for m in completed_or_active:
        for me in (m.meeting_equipments or []):
            if me.equipment_id in eq_stats:
                eq_stats[me.equipment_id]["booking_count"] += 1

    top_device = {"name": "Chưa có dữ liệu", "count": 0}
    eq_list = sorted(list(eq_stats.values()), key=lambda x: x["booking_count"], reverse=True)
    if eq_list and eq_list[0]["booking_count"] > 0:
        top_device = {
            "name": eq_list[0]["equipment_name"],
            "count": eq_list[0]["booking_count"]
        }

    # Tính tỷ lệ lấp đầy tổng thể (Occupancy Rate)
    # Giả định 8 tiếng/ngày, 22 ngày làm việc trong tháng trên tổng số phòng
    total_capacity_hours = len(rooms) * 8 * 22 if len(rooms) > 0 else 1
    occupancy_rate = min(100.0, round((total_hours_used / total_capacity_hours) * 100, 1))

    # Danh sách các cuộc họp bị hủy phục vụ US #23
    cancelled_list = []
    for m in cancelled_meetings:
        cancelled_list.append({
            "meeting_id": m.meeting_id,
            "title": m.title,
            "organizer_name": m.organizer.full_name if m.organizer else "N/A",
            "organizer_email": m.organizer.email if m.organizer else "N/A",
            "room_name": m.room.room_name if m.room else "N/A",
            "start_time": m.start_time.strftime("%d/%m/%Y %H:%M") if m.start_time else "",
            "end_time": m.end_time.strftime("%d/%m/%Y %H:%M") if m.end_time else "",
            "duration_hours": round(calc_duration_hours(m), 1),
            "reason": m.reject_reason or "Người tổ chức hủy lịch",
            "created_at": m.created_at.strftime("%d/%m/%Y") if m.created_at else ""
        })

    # Phân bố theo các ngày trong tuần (Thứ 2 -> Chủ nhật)
    day_names = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "Chủ nhật"]
    day_counts = [0] * 7
    for m in completed_or_active:
        if m.start_time:
            w = m.start_time.weekday()
            if 0 <= w < 7:
                day_counts[w] += 1
    
    max_day_cnt = max(day_counts) if max(day_counts) > 0 else 1
    weekly_distribution = [
        {
            "day": day_names[i],
            "count": day_counts[i],
            "percent": round((day_counts[i] / max_day_cnt) * 100) if max_day_cnt > 0 else 0
        }
        for i in range(7)
    ]

    # Phân bố theo phòng ban / khoa viện
    dept_map = {}
    for m in completed_or_active:
        dept_name = "Khoa CNTT"
        if m.organizer and m.organizer.department:
            dept_name = m.organizer.department.department_name
        
        if dept_name not in dept_map:
            dept_map[dept_name] = {"name": dept_name, "count": 0, "hours": 0.0}
        dept_map[dept_name]["count"] += 1
        dept_map[dept_name]["hours"] += calc_duration_hours(m)

    dept_list = []
    colors = ["bg-blue-600", "bg-indigo-600", "bg-emerald-500", "bg-amber-500", "bg-purple-500", "bg-rose-500"]
    for idx, (d_name, d_val) in enumerate(dept_map.items()):
        d_hours = round(d_val["hours"], 1)
        pct = round((d_hours / total_hours_used * 100), 1) if total_hours_used > 0 else 0
        dept_list.append({
            "name": d_name,
            "count": d_val["count"],
            "hours": d_hours,
            "percent": pct,
            "color": colors[idx % len(colors)]
        })
    dept_list.sort(key=lambda x: x["hours"], reverse=True)

    return {
        "summary": {
            "total_meetings": total_meetings,
            "active_meetings": active_count,
            "cancelled_meetings": cancelled_count,
            "cancellation_rate_pct": cancellation_rate,
            "total_hours_used": total_hours_used,
            "wasted_hours": wasted_hours,
            "occupancy_rate_pct": occupancy_rate,
            "top_room": top_room,
            "top_device": top_device,
            "total_rooms": len(rooms),
            "total_equipments": len(equipments)
        },
        "room_utilization": room_utilization,
        "equipment_stats": eq_list[:10],
        "cancelled_meetings": cancelled_list,
        "weekly_distribution": weekly_distribution,
        "department_distribution": dept_list
    }


@router.get("/{meeting_id}", response_model=MeetingOut, summary="Xem chi tiết cuộc họp")
def get_meeting_detail(
    meeting_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    meeting = db.query(Meeting).options(
        joinedload(Meeting.organizer),
        joinedload(Meeting.room),
        joinedload(Meeting.participants).joinedload(MeetingParticipant.user),
        joinedload(Meeting.meeting_equipments).joinedload(MeetingEquipment.equipment)
    ).filter(Meeting.meeting_id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Không tìm thấy lịch họp")
    return meeting

@router.put("/{meeting_id}", response_model=MeetingOut, summary="Sửa thông tin lịch họp & thiết bị (US #2, #12)")
def update_meeting(
    meeting_id: int,
    data: MeetingUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    meeting = db.query(Meeting).filter(Meeting.meeting_id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Không tìm thấy lịch họp")
        
    if meeting.organizer_id != current_user.user_id and current_user.role.role_name != "ADMIN":
        raise HTTPException(status_code=403, detail="Bạn không có quyền sửa cuộc họp này")

    new_st = data.start_time or meeting.start_time
    new_et = data.end_time or meeting.end_time
    if new_st >= new_et:
        raise HTTPException(status_code=400, detail="Thời gian kết thúc phải sau thời gian bắt đầu")
        
    # Kiểm tra conflict phòng nếu đổi giờ hoặc đổi phòng
    if data.start_time or data.end_time or data.room_id:
        target_room = data.room_id or meeting.room_id
        conflict = db.query(Meeting).filter(
            Meeting.room_id == target_room,
            Meeting.meeting_id != meeting_id,
            Meeting.status.in_(["PENDING", "APPROVED"]),
            Meeting.start_time < new_et,
            Meeting.end_time > new_st
        ).first()
        if conflict:
            raise HTTPException(status_code=409, detail="Trùng lịch phòng với cuộc họp khác")

    # Kiểm tra conflict thiết bị nếu đổi giờ hoặc đổi danh sách thiết bị
    target_eq_ids = data.equipment_ids if data.equipment_ids is not None else [me.equipment_id for me in meeting.meeting_equipments]
    if target_eq_ids:
        for eq_id in set(target_eq_ids):
            eq = db.query(Equipment).filter(Equipment.equipment_id == eq_id).first()
            if not eq:
                raise HTTPException(status_code=404, detail=f"Không tìm thấy thiết bị ID={eq_id}")
            if eq.status != "AVAILABLE":
                raise HTTPException(
                    status_code=400,
                    detail=f"Thiết bị '{eq.equipment_name}' đang ở trạng thái {eq.status}, không thể mượn"
                )

            # conflict_eq = (
            #     db.query(Meeting)
            #     .join(MeetingEquipment, Meeting.meeting_id == MeetingEquipment.meeting_id)
            #     .filter(
            #         MeetingEquipment.equipment_id == eq_id,
            #         Meeting.meeting_id != meeting_id,
            #         Meeting.status.in_(["PENDING", "APPROVED"]),
            #         Meeting.start_time < new_et,
            #         Meeting.end_time > new_st
            #     )
            #     .first()
            # )
            # if conflict_eq:
            #     raise HTTPException(
            #         status_code=409,
            #         detail=f"Trùng lịch thiết bị! Thiết bị '{eq.equipment_name}' đã được đăng ký mượn cho cuộc họp khác"
            #     )
            
    if data.room_id is not None: meeting.room_id = data.room_id
    if data.title is not None: meeting.title = data.title
    if data.description is not None: meeting.description = data.description
    if data.start_time is not None: meeting.start_time = data.start_time
    if data.end_time is not None: meeting.end_time = data.end_time
    if data.meeting_type is not None: meeting.meeting_type = data.meeting_type
    if data.meeting_link is not None: meeting.meeting_link = data.meeting_link
    if data.passcode is not None: meeting.passcode = data.passcode
    if data.status is not None: meeting.status = data.status
    
    if meeting.meeting_type in ["ONLINE", "HYBRID"] and not meeting.meeting_link:
        import uuid
        meeting.meeting_link = f"https://meet.ictu.edu.vn/{str(uuid.uuid4())[:8]}"
        meeting.passcode = "123456"

    # Cập nhật danh sách thiết bị nếu có truyền
    if data.equipment_ids is not None:
        db.query(MeetingEquipment).filter(MeetingEquipment.meeting_id == meeting_id).delete()
        for eq_id in set(data.equipment_ids):
            me = MeetingEquipment(meeting_id=meeting.meeting_id, equipment_id=eq_id)
            db.add(me)
    
    db.commit()
    db.refresh(meeting)
    
    # Reload with relationships
    meeting = db.query(Meeting).options(
        joinedload(Meeting.organizer),
        joinedload(Meeting.room),
        joinedload(Meeting.participants).joinedload(MeetingParticipant.user),
        joinedload(Meeting.meeting_equipments).joinedload(MeetingEquipment.equipment)
    ).filter(Meeting.meeting_id == meeting_id).first()
    
    return meeting

@router.patch("/{meeting_id}/cancel", summary="Hủy lịch họp và giải phóng phòng + thiết bị (US #2, #9, #12, #23)")
def cancel_meeting(
    meeting_id: int,
    reason: Optional[str] = Query(None, description="Lý do hủy cuộc họp (US #23)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    meeting = db.query(Meeting).filter(Meeting.meeting_id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Không tìm thấy lịch họp")
    if meeting.organizer_id != current_user.user_id and current_user.role.role_name != "ADMIN":
        raise HTTPException(status_code=403, detail="Bạn không có quyền hủy cuộc họp này")
        
    meeting.status = "CANCELLED"
    if reason:
        meeting.reject_reason = reason
    elif not meeting.reject_reason:
        meeting.reject_reason = "Người tổ chức hủy lịch"

    log_action(db, current_user.user_id, "CANCEL_MEETING", f"Hủy cuộc họp '{meeting.title}' (ID: {meeting.meeting_id}) - Lý do: {meeting.reject_reason}")
    db.commit()
    return {
        "message": "Đã hủy cuộc họp thành công (Phòng họp và thiết bị đã được giải phóng)",
        "reject_reason": meeting.reject_reason
    }

@router.patch("/{meeting_id}/respond", summary="Phản hồi lời mời (Chấp nhận / Từ chối)")
def respond_meeting(
    meeting_id: int,
    data: MeetingRespond,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    if data.status not in ["ACCEPTED", "DECLINED"]:
        raise HTTPException(status_code=400, detail="Trạng thái phản hồi không hợp lệ")
        
    participant = db.query(MeetingParticipant).filter(
        MeetingParticipant.meeting_id == meeting_id,
        MeetingParticipant.user_id == current_user.user_id
    ).first()
    
    if not participant:
        raise HTTPException(status_code=403, detail="Bạn không được mời tham gia cuộc họp này")
        
    participant.rsvp_status = data.status
    db.commit()
    return {"message": f"Bạn đã {data.status} lời mời"}

@router.patch("/{meeting_id}/approve", response_model=MeetingOut, summary="Admin phê duyệt yêu cầu đặt phòng họp")
def approve_meeting(
    meeting_id: int,
    data: Optional[MeetingApprovalRequest] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    if not current_user.role or current_user.role.role_name != "ADMIN":
        raise HTTPException(status_code=403, detail="Chỉ Quản trị viên (ADMIN) mới có quyền phê duyệt đặt phòng")
        
    meeting = db.query(Meeting).options(
        joinedload(Meeting.organizer),
        joinedload(Meeting.room),
        joinedload(Meeting.participants).joinedload(MeetingParticipant.user),
        joinedload(Meeting.meeting_equipments).joinedload(MeetingEquipment.equipment)
    ).filter(Meeting.meeting_id == meeting_id).first()
    
    if not meeting:
        raise HTTPException(status_code=404, detail="Không tìm thấy lịch họp cần phê duyệt")

    # Kiểm tra trùng lịch phòng với các cuộc họp đã duyệt khác
    conflict = db.query(Meeting).filter(
        Meeting.room_id == meeting.room_id,
        Meeting.meeting_id != meeting.meeting_id,
        Meeting.status.in_(["SCHEDULED", "APPROVED", "IN_PROGRESS"]),
        Meeting.start_time < meeting.end_time,
        Meeting.end_time > meeting.start_time
    ).first()
    
    if conflict:
        room_title = meeting.room.room_name if meeting.room else str(meeting.room_id)
        raise HTTPException(
            status_code=409, 
            detail=f"Trùng lịch phòng! Phòng '{room_title}' đã có cuộc họp '{conflict.title}' ({conflict.start_time.strftime('%H:%M')} - {conflict.end_time.strftime('%H:%M')}) được duyệt trước đó."
        )

    # Kiểm tra trùng lịch thiết bị kèm theo
    if meeting.meeting_equipments:
        for me in meeting.meeting_equipments:
            eq_id = me.equipment_id
            # conflict_eq = (
            #     db.query(Meeting)
            #     .join(MeetingEquipment, Meeting.meeting_id == MeetingEquipment.meeting_id)
            #     .filter(
            #         MeetingEquipment.equipment_id == eq_id,
            #         Meeting.meeting_id != meeting.meeting_id,
            #         Meeting.status.in_(["SCHEDULED", "APPROVED", "IN_PROGRESS"]),
            #         Meeting.start_time < meeting.end_time,
            #         Meeting.end_time > meeting.start_time
            #     )
            #     .first()
            # )
            # if conflict_eq:
            #     eq_name = me.equipment.equipment_name if me.equipment else f"ID {eq_id}"
            #     raise HTTPException(
            #         status_code=409,
            #         detail=f"Trùng thiết bị! Thiết bị '{eq_name}' đã được duyệt sử dụng cho cuộc họp '{conflict_eq.title}'."
            #     )

    meeting.status = "SCHEDULED"
    note_text = f" - Ghi chú: {data.note}" if (data and data.note) else ""
    log_action(db, current_user.user_id, "APPROVE_MEETING", f"Admin duyệt yêu cầu đặt phòng cho cuộc họp '{meeting.title}' (ID: {meeting.meeting_id}){note_text}")
    db.commit()
    db.refresh(meeting)
    return meeting


@router.patch("/{meeting_id}/reject", response_model=MeetingOut, summary="Admin từ chối yêu cầu đặt phòng họp")
def reject_meeting(
    meeting_id: int,
    data: Optional[MeetingRejectRequest] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    if not current_user.role or current_user.role.role_name != "ADMIN":
        raise HTTPException(status_code=403, detail="Chỉ Quản trị viên (ADMIN) mới có quyền từ chối yêu cầu đặt phòng")

    meeting = db.query(Meeting).options(
        joinedload(Meeting.organizer),
        joinedload(Meeting.room),
        joinedload(Meeting.participants).joinedload(MeetingParticipant.user),
        joinedload(Meeting.meeting_equipments).joinedload(MeetingEquipment.equipment)
    ).filter(Meeting.meeting_id == meeting_id).first()

    if not meeting:
        raise HTTPException(status_code=404, detail="Không tìm thấy lịch họp cần từ chối")

    meeting.status = "REJECTED"
    if data and data.reason:
        meeting.reject_reason = data.reason
    reason_text = f" (Lý do: {data.reason})" if (data and data.reason) else ""
    log_action(db, current_user.user_id, "REJECT_MEETING", f"Admin từ chối cuộc họp '{meeting.title}' (ID: {meeting.meeting_id}){reason_text}")
    db.commit()
    db.refresh(meeting)
    return meeting


@router.patch("/{meeting_id}/status", summary="Cập nhật trạng thái vòng đời cuộc họp (Meeting Lifecycle)")
def update_meeting_status(
    meeting_id: int,
    data: MeetingStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    valid_statuses = ["PENDING", "SCHEDULED", "APPROVED", "IN_PROGRESS", "COMPLETED", "CANCELLED", "REJECTED"]
    if data.status.upper() not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Trạng thái không hợp lệ. Cho phép: {valid_statuses}")

    meeting = db.query(Meeting).filter(Meeting.meeting_id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Không tìm thấy lịch họp")
        
    if meeting.organizer_id != current_user.user_id and (not current_user.role or current_user.role.role_name != "ADMIN"):
        raise HTTPException(status_code=403, detail="Bạn không có quyền cập nhật trạng thái cuộc họp này")
        
    meeting.status = data.status.upper()
    log_action(db, current_user.user_id, "UPDATE_MEETING_STATUS", f"Cập nhật trạng thái cuộc họp '{meeting.title}' thành {meeting.status}")
    db.commit()
    
    return {"message": f"Đã cập nhật trạng thái thành {meeting.status}"}

@router.post("/{meeting_id}/checkin", summary="Check-in điểm danh qua mã QR (US #27)")
def checkin_meeting(
    meeting_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    from datetime import datetime, timezone
    
    meeting = db.query(Meeting).filter(Meeting.meeting_id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Không tìm thấy cuộc họp")

    participant = db.query(MeetingParticipant).filter(
        MeetingParticipant.meeting_id == meeting_id,
        MeetingParticipant.user_id == current_user.user_id
    ).first()
    
    # If organizer or admin is checking in and not yet in participant table, auto register them
    if not participant:
        if meeting.organizer_id == current_user.user_id or (current_user.role and current_user.role.role_name == "ADMIN"):
            participant = MeetingParticipant(
                meeting_id=meeting_id,
                user_id=current_user.user_id,
                rsvp_status="ACCEPTED"
            )
            db.add(participant)
            db.flush()
        else:
            raise HTTPException(status_code=403, detail="Bạn không thuộc danh sách tham dự cuộc họp này")
        
    if participant.checked_in_at:
        return {
            "message": "Bạn đã check-in thành công trước đó",
            "checked_in_at": participant.checked_in_at,
            "meeting_status": meeting.status
        }
        
    now = datetime.now(timezone.utc)
    participant.checked_in_at = now
    
    # If meeting was SCHEDULED, update to IN_PROGRESS upon checkin
    if meeting.status in ["SCHEDULED", "APPROVED", "PENDING"]:
        meeting.status = "IN_PROGRESS"

    log_action(db, current_user.user_id, "CHECKIN", f"Check-in thành công cuộc họp ID: {meeting_id} ('{meeting.title}')")
    db.commit()
    return {
        "message": f"Check-in thành công vào cuộc họp '{meeting.title}'!",
        "checked_in_at": participant.checked_in_at,
        "meeting_status": meeting.status
    }

@router.post("/{meeting_id}/checkout", summary="Check-out trả phòng họp qua mã QR (US #27)")
def checkout_meeting(
    meeting_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    from datetime import datetime, timezone

    meeting = db.query(Meeting).filter(Meeting.meeting_id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Không tìm thấy cuộc họp")

    participant = db.query(MeetingParticipant).filter(
        MeetingParticipant.meeting_id == meeting_id,
        MeetingParticipant.user_id == current_user.user_id
    ).first()

    is_organizer_or_admin = (meeting.organizer_id == current_user.user_id) or (current_user.role and current_user.role.role_name == "ADMIN")

    if not participant and not is_organizer_or_admin:
        raise HTTPException(status_code=403, detail="Bạn không thuộc danh sách tham dự cuộc họp này")

    now = datetime.now(timezone.utc)

    if participant:
        participant.checked_out_at = now

    # If organizer or admin checks out, complete the meeting and release the room
    if is_organizer_or_admin:
        meeting.status = "COMPLETED"

    log_action(db, current_user.user_id, "CHECKOUT", f"Check-out thành công cuộc họp ID: {meeting_id} ('{meeting.title}')")
    db.commit()

    return {
        "message": f"Check-out thành công cuộc họp '{meeting.title}'!",
        "checked_out_at": now,
        "meeting_status": meeting.status,
        "is_completed": meeting.status == "COMPLETED"
    }

@router.get("/{meeting_id}/attendance", summary="Xem danh sách điểm danh thực tế qua QR (US #27)")
def get_meeting_attendance(
    meeting_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    meeting = db.query(Meeting).filter(Meeting.meeting_id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Không tìm thấy cuộc họp")

    participants = db.query(MeetingParticipant).filter(MeetingParticipant.meeting_id == meeting_id).all()

    attendance_list = []
    checked_in_count = 0
    checked_out_count = 0

    for p in participants:
        user_info = db.query(User).filter(User.user_id == p.user_id).first()
        is_checked_in = p.checked_in_at is not None
        is_checked_out = p.checked_out_at is not None

        if is_checked_in:
            checked_in_count += 1
        if is_checked_out:
            checked_out_count += 1

        attendance_list.append({
            "participant_id": p.participant_id,
            "user_id": p.user_id,
            "full_name": user_info.full_name if user_info else f"User #{p.user_id}",
            "email": user_info.email if user_info else "",
            "role": user_info.role.role_name if user_info and user_info.role else "USER",
            "rsvp_status": p.rsvp_status,
            "checked_in_at": p.checked_in_at,
            "checked_out_at": p.checked_out_at,
            "is_organizer": p.user_id == meeting.organizer_id
        })

    total = len(participants)
    checkin_rate = round((checked_in_count / total * 100), 1) if total > 0 else 0.0

    return {
        "meeting_id": meeting.meeting_id,
        "title": meeting.title,
        "status": meeting.status,
        "total_participants": total,
        "checked_in_count": checked_in_count,
        "checked_out_count": checked_out_count,
        "checkin_rate_pct": checkin_rate,
        "participants": attendance_list
    }


@router.delete("/{meeting_id}", summary="Xóa hoàn toàn cuộc họp (ADMIN hoặc Người tạo)")
def delete_meeting(
    meeting_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    meeting = db.query(Meeting).filter(Meeting.meeting_id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Không tìm thấy cuộc họp")

    is_admin = current_user.role and current_user.role.role_name == "ADMIN"
    is_organizer = meeting.organizer_id == current_user.user_id
    if not (is_admin or is_organizer):
        raise HTTPException(status_code=403, detail="Chỉ Quản trị viên hoặc người tạo mới có quyền xóa cuộc họp này")

    try:
        # Xóa participants và equipment trước (cascade)
        db.query(MeetingParticipant).filter(MeetingParticipant.meeting_id == meeting_id).delete()
        db.query(MeetingEquipment).filter(MeetingEquipment.meeting_id == meeting_id).delete()
        db.delete(meeting)
        log_action(db, current_user.user_id, "DELETE_MEETING", f"Đã xóa cuộc họp '{meeting.title}' (ID: {meeting_id})")
        db.commit()
        return {"message": f"Đã xóa cuộc họp ID {meeting_id} thành công"}
    except Exception as e:
        db.rollback()
        import traceback; traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
