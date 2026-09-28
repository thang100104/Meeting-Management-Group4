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
from app.schemas.meeting import MeetingCreate, MeetingUpdate, MeetingOut, MeetingRespond, RoomAvailability
from app.api.deps import get_current_active_user, require_roles

router = APIRouter()

@router.post("", response_model=MeetingOut, status_code=status.HTTP_201_CREATED, summary="Tạo lịch họp mới kèm thiết bị (US #1, #4, #12)")
def create_meeting(
    data: MeetingCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    if data.start_time >= data.end_time:
        raise HTTPException(status_code=400, detail="Thời gian kết thúc phải sau thời gian bắt đầu")
    
    # 1. Kiểm tra phòng tồn tại và quyền truy cập
    room = db.query(Room).filter(Room.room_id == data.room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Không tìm thấy phòng họp")
    if room.status != "AVAILABLE":
        raise HTTPException(status_code=400, detail="Phòng đang bảo trì, không thể đặt")
    
    # Kiểm tra quyền đặt phòng (Role restriction - US #21)
    if current_user.role.role_name != "ADMIN":
        restrictions = db.query(RoomRestriction).filter(RoomRestriction.room_id == data.room_id).all()
        if restrictions:
            restricted_role_ids = [r.role_id for r in restrictions]
            if current_user.role_id in restricted_role_ids:
                raise HTTPException(status_code=403, detail="Bạn không có quyền đặt phòng này")

    # 2. Thuật toán chống trùng lịch phòng (Room Conflict Detection)
    conflict = db.query(Meeting).filter(
        Meeting.room_id == data.room_id,
        Meeting.status != "CANCELLED",
        Meeting.start_time < data.end_time,
        Meeting.end_time > data.start_time
    ).first()
    
    if conflict:
        raise HTTPException(
            status_code=409,
            detail=f"Trùng lịch! Phòng đã được đặt từ {conflict.start_time} đến {conflict.end_time}"
        )

    # 3. Thuật toán kiểm tra và chống trùng lịch Thiết bị (Equipment Conflict Detection - US #12, #13)
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

            # Kiểm tra xung đột thời gian với các cuộc họp khác
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

    # 4. Tạo cuộc họp
    meeting = Meeting(
        organizer_id=current_user.user_id,
        room_id=data.room_id,
        title=data.title,
        description=data.description,
        start_time=data.start_time,
        end_time=data.end_time,
        status="SCHEDULED"
    )
    db.add(meeting)
    db.flush() # Lấy meeting_id
    
    # 5. Thêm người tham gia
    if data.participant_ids:
        for uid in set(data.participant_ids):
            u = db.query(User).filter(User.user_id == uid).first()
            if u:
                participant = MeetingParticipant(meeting_id=meeting.meeting_id, user_id=uid, status="PENDING")
                db.add(participant)

    # 6. Gán thiết bị mượn kèm
    if data.equipment_ids:
        for eq_id in set(data.equipment_ids):
            me = MeetingEquipment(meeting_id=meeting.meeting_id, equipment_id=eq_id)
            db.add(me)
            
    db.commit()
    db.refresh(meeting)
    return meeting

@router.get("", response_model=List[MeetingOut], summary="Xem danh sách lịch họp")
def list_meetings(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    room_id: Optional[int] = None,
    user_id: Optional[int] = None,
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    query = db.query(Meeting)
    
    if room_id:
        query = query.filter(Meeting.room_id == room_id)
    if user_id:
        query = query.join(MeetingParticipant, isouter=True).filter(
            or_(Meeting.organizer_id == user_id, MeetingParticipant.user_id == user_id)
        )
    if from_date:
        query = query.filter(Meeting.start_time >= datetime.combine(from_date, datetime.min.time()))
    if to_date:
        query = query.filter(Meeting.end_time <= datetime.combine(to_date, datetime.max.time()))
        
    meetings = query.order_by(Meeting.start_time.asc()).offset(skip).limit(limit).all()
    return meetings

@router.get("/{meeting_id}", response_model=MeetingOut, summary="Xem chi tiết cuộc họp")
def get_meeting_detail(
    meeting_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    meeting = db.query(Meeting).filter(Meeting.meeting_id == meeting_id).first()
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
            Meeting.status != "CANCELLED",
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
                    Meeting.status != "CANCELLED",
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
    if data.status is not None: meeting.status = data.status

    # Cập nhật danh sách thiết bị nếu có truyền
    if data.equipment_ids is not None:
        db.query(MeetingEquipment).filter(MeetingEquipment.meeting_id == meeting_id).delete()
        for eq_id in set(data.equipment_ids):
            me = MeetingEquipment(meeting_id=meeting.meeting_id, equipment_id=eq_id)
            db.add(me)
    
    db.commit()
    db.refresh(meeting)
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
        
    participant.status = data.status
    db.commit()
    return {"message": f"Bạn đã {data.status} lời mời"}
