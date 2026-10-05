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
        
        # ── 3. KIỂM TRA QUYỀN ĐẶT PHÒNG ──
        if current_user.role.role_name != "ADMIN":
            restrictions = db.query(RoomRestriction).filter(RoomRestriction.room_id == data.room_id).all()
            if restrictions:
                restricted_role_ids = [r.role_id for r in restrictions]
                if current_user.role_id in restricted_role_ids:
                    raise HTTPException(
                        status_code=403, 
                        detail=f"Vai trò '{current_user.role.role_name}' không có quyền đặt phòng '{room.room_name}'. Phòng này bị giới hạn quyền truy cập."
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

                conflict_eq = (
                    db.query(Meeting)
                    .join(MeetingEquipment, Meeting.meeting_id == MeetingEquipment.meeting_id)
                    .filter(
                        MeetingEquipment.equipment_id == eq_id,
                        Meeting.status != "CANCELLED",
                        Meeting.start_time < data.end_time,
                        Meeting.end_time > data.start_time
                    )
                    .first()
                )
                if conflict_eq:
                    raise HTTPException(
                        status_code=409,
                        detail=f"Trùng lịch thiết bị! Thiết bị '{eq.equipment_name}' đã được đăng ký mượn cho cuộc họp '{conflict_eq.title}' ({conflict_eq.start_time.strftime('%H:%M')} - {conflict_eq.end_time.strftime('%H:%M')})"
                    )

        # ── 5. TẠO CUỘC HỌP (Transaction) ──
        # Mặc định: ADMIN tạo thì duyệt luôn (SCHEDULED), ORGANIZER thì PENDING chờ duyệt nếu cấu hình, hoặc SCHEDULED
        meeting_status = "SCHEDULED" if current_user.role.role_name == "ADMIN" else "PENDING"
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

        # ── 6. THÊM NGƯỜI THAM GIA ──
        if data.participant_ids:
            for uid in set(data.participant_ids):
                u = db.query(User).filter(User.user_id == uid).first()
                if u:
                    participant = MeetingParticipant(meeting_id=meeting.meeting_id, user_id=uid, status="PENDING")
                    db.add(participant)

        # ── 7. GÁN THIẾT BỊ MƯỢN KÈM ──
        if data.equipment_ids:
            for eq_id in set(data.equipment_ids):
                me = MeetingEquipment(meeting_id=meeting.meeting_id, equipment_id=eq_id, quantity=1)
                db.add(me)

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

            conflict_eq = (
                db.query(Meeting)
                .join(MeetingEquipment, Meeting.meeting_id == MeetingEquipment.meeting_id)
                .filter(
                    MeetingEquipment.equipment_id == eq_id,
                    Meeting.meeting_id != meeting_id,
                    Meeting.status.in_(["PENDING", "APPROVED"]),
                    Meeting.start_time < new_et,
                    Meeting.end_time > new_st
                )
                .first()
            )
            if conflict_eq:
                raise HTTPException(
                    status_code=409,
                    detail=f"Trùng lịch thiết bị! Thiết bị '{eq.equipment_name}' đã được đăng ký mượn cho cuộc họp khác"
                )
            
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

@router.patch("/{meeting_id}/cancel", summary="Hủy lịch họp và giải phóng phòng + thiết bị (US #2, #9, #12)")
def cancel_meeting(
    meeting_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    meeting = db.query(Meeting).filter(Meeting.meeting_id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Không tìm thấy lịch họp")
    if meeting.organizer_id != current_user.user_id and current_user.role.role_name != "ADMIN":
        raise HTTPException(status_code=403, detail="Bạn không có quyền hủy cuộc họp này")
        
    meeting.status = "CANCELLED"
    log_action(db, current_user.user_id, "CANCEL_MEETING", f"Hủy cuộc họp '{meeting.title}' (ID: {meeting.meeting_id})")
    db.commit()
    return {"message": "Đã hủy cuộc họp thành công (Phòng họp và thiết bị đã được giải phóng)"}

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
            conflict_eq = (
                db.query(Meeting)
                .join(MeetingEquipment, Meeting.meeting_id == MeetingEquipment.meeting_id)
                .filter(
                    MeetingEquipment.equipment_id == eq_id,
                    Meeting.meeting_id != meeting.meeting_id,
                    Meeting.status.in_(["SCHEDULED", "APPROVED", "IN_PROGRESS"]),
                    Meeting.start_time < meeting.end_time,
                    Meeting.end_time > meeting.start_time
                )
                .first()
            )
            if conflict_eq:
                eq_name = me.equipment.equipment_name if me.equipment else f"ID {eq_id}"
                raise HTTPException(
                    status_code=409,
                    detail=f"Trùng thiết bị! Thiết bị '{eq_name}' đã được duyệt sử dụng cho cuộc họp '{conflict_eq.title}'."
                )

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

@router.post("/{meeting_id}/checkin", summary="Check-in điểm danh qua mã QR")
def checkin_meeting(
    meeting_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    from datetime import datetime, timezone
    
    participant = db.query(MeetingParticipant).filter(
        MeetingParticipant.meeting_id == meeting_id,
        MeetingParticipant.user_id == current_user.user_id
    ).first()
    
    if not participant:
        raise HTTPException(status_code=403, detail="Bạn không thuộc danh sách tham dự cuộc họp này")
        
    if participant.checked_in_at:
        return {"message": "Bạn đã check-in thành công trước đó", "checked_in_at": participant.checked_in_at}
        
    participant.checked_in_at = datetime.now(timezone.utc)
    log_action(db, current_user.user_id, "CHECKIN", f"Check-in thành công cuộc họp ID: {meeting_id}")
    db.commit()
    return {"message": "Check-in thành công!", "checked_in_at": participant.checked_in_at}


@router.delete("/{meeting_id}", summary="Xóa hoàn toàn cuộc họp (chỉ ADMIN)")
def delete_meeting(
    meeting_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    if current_user.role.role_name != "ADMIN":
        raise HTTPException(status_code=403, detail="Chỉ ADMIN mới có quyền xóa cuộc họp")

    meeting = db.query(Meeting).filter(Meeting.meeting_id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Không tìm thấy cuộc họp")

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
