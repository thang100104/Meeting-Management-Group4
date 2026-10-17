from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, func

from app.core.database import get_db
from app.models.equipment import Equipment, MeetingEquipment
from app.models.meeting import Meeting
from app.models.room import Room
from app.models.user import User
from app.schemas.equipment import (
    EquipmentCreate,
    EquipmentUpdate,
    EquipmentOut,
    EquipmentAvailability,
    EquipmentStatsSummary
)
from app.api.deps import get_current_active_user, require_roles

router = APIRouter()

@router.get("/stats/summary", response_model=EquipmentStatsSummary, summary="Thống kê tổng quan thiết bị (US #13)")
def get_equipment_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    total = db.query(Equipment).count()
    available = db.query(Equipment).filter(Equipment.status == "AVAILABLE").count()
    maintenance = db.query(Equipment).filter(Equipment.status == "MAINTENANCE").count()
    broken = db.query(Equipment).filter(Equipment.status == "BROKEN").count()
    portable_count = db.query(Equipment).filter(Equipment.room_id.is_(None)).count()
    in_rooms_count = db.query(Equipment).filter(Equipment.room_id.isnot(None)).count()

    return EquipmentStatsSummary(
        total=total,
        available=available,
        maintenance=maintenance,
        broken=broken,
        portable_count=portable_count,
        in_rooms_count=in_rooms_count
    )

@router.get("", response_model=List[EquipmentAvailability], summary="Lấy danh sách thiết bị (US #12, #13)")
def list_equipments(
    search: Optional[str] = Query(None, description="Tìm theo tên hoặc số serial"),
    equipment_type: Optional[str] = Query(None, description="Loại thiết bị: PROJECTOR, TV, MICROPHONE..."),
    status: Optional[str] = Query(None, description="Trạng thái: AVAILABLE, MAINTENANCE, BROKEN"),
    room_id: Optional[int] = Query(None, description="Lọc theo phòng gắn cố định"),
    is_portable: Optional[bool] = Query(None, description="True nếu chỉ lấy thiết bị di động dùng chung"),
    from_time: Optional[datetime] = Query(None, description="Thời gian bắt đầu cần kiểm tra rảnh"),
    to_time: Optional[datetime] = Query(None, description="Thời gian kết thúc cần kiểm tra rảnh"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    query = db.query(Equipment)

    if search:
        s = f"%{search.strip()}%"
        query = query.filter(or_(Equipment.equipment_name.ilike(s), Equipment.serial_number.ilike(s)))
    if equipment_type:
        query = query.filter(Equipment.equipment_type == equipment_type.upper())
    if status:
        query = query.filter(Equipment.status == status.upper())
    if room_id is not None:
        query = query.filter(Equipment.room_id == room_id)
    if is_portable is not None:
        if is_portable:
            query = query.filter(Equipment.room_id.is_(None))
        else:
            query = query.filter(Equipment.room_id.isnot(None))

    equipments = query.order_by(Equipment.equipment_id.asc()).all()

    # Nếu có from_time và to_time, tính toán tình trạng rảnh của từng thiết bị trong khung giờ
    occupied_equipment_ids = set()
    occupied_reasons = {}
    if from_time and to_time:
        if from_time >= to_time:
            raise HTTPException(status_code=400, detail="Thời gian kết thúc phải sau thời gian bắt đầu")
        
        conflicts = (
            db.query(MeetingEquipment.equipment_id, Meeting.title, Meeting.start_time, Meeting.end_time)
            .join(Meeting, MeetingEquipment.meeting_id == Meeting.meeting_id)
            .filter(
                Meeting.status != "CANCELLED",
                Meeting.start_time < to_time,
                Meeting.end_time > from_time
            )
            .all()
        )
        for eq_id, title, st, et in conflicts:
            occupied_equipment_ids.add(eq_id)
            occupied_reasons[eq_id] = f"Đã được đăng ký cho cuộc họp '{title}' ({st.strftime('%H:%M')} - {et.strftime('%H:%M')})"

    result = []
    for eq in equipments:
        is_avail = True
        conflict_reason = None

        if eq.status != "AVAILABLE":
            is_avail = False
            conflict_reason = f"Thiết bị đang ở trạng thái {eq.status}"
        elif eq.equipment_id in occupied_equipment_ids:
            is_avail = False
            conflict_reason = occupied_reasons.get(eq.equipment_id, "Trùng lịch cuộc họp khác")

        room_name = eq.room.room_name if eq.room else "Thiết bị di động"

        item = EquipmentAvailability(
            equipment_id=eq.equipment_id,
            equipment_name=eq.equipment_name,
            equipment_type=eq.equipment_type,
            serial_number=eq.serial_number,
            room_id=eq.room_id,
            status=eq.status,
            description=eq.description,
            created_at=eq.created_at,
            updated_at=eq.updated_at,
            room_name=room_name,
            is_available_in_slot=is_avail,
            conflict_reason=conflict_reason
        )
        result.append(item)

    return result

@router.post("", response_model=EquipmentOut, status_code=status.HTTP_201_CREATED, summary="Tạo thiết bị mới (Admin - US #14)")
def create_equipment(
    data: EquipmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["ADMIN"]))
):
    if data.serial_number:
        existing = db.query(Equipment).filter(Equipment.serial_number == data.serial_number.strip()).first()
        if existing:
            raise HTTPException(status_code=400, detail="Mã số Serial đã tồn tại trong hệ thống")

    if data.room_id is not None:
        room = db.query(Room).filter(Room.room_id == data.room_id).first()
        if not room:
            raise HTTPException(status_code=404, detail="Phòng họp được gán không tồn tại")

    equipment = Equipment(
        equipment_name=data.equipment_name.strip(),
        equipment_type=data.equipment_type.upper(),
        serial_number=data.serial_number.strip() if data.serial_number else None,
        room_id=data.room_id,
        status=data.status.upper() if data.status else "AVAILABLE",
        description=data.description
    )
    db.add(equipment)
    db.commit()
    db.refresh(equipment)
    
    room_name = equipment.room.room_name if equipment.room else "Thiết bị di động"
    out = EquipmentOut.model_validate(equipment)
    out.room_name = room_name
    return out

@router.get("/{equipment_id}", response_model=EquipmentOut, summary="Xem chi tiết thiết bị (US #13)")
def get_equipment_detail(
    equipment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    eq = db.query(Equipment).filter(Equipment.equipment_id == equipment_id).first()
    if not eq:
        raise HTTPException(status_code=404, detail="Không tìm thấy thiết bị")
    
    room_name = eq.room.room_name if eq.room else "Thiết bị di động"
    out = EquipmentOut.model_validate(eq)
    out.room_name = room_name
    return out

@router.put("/{equipment_id}", response_model=EquipmentOut, summary="Cập nhật thông tin/trạng thái thiết bị (Admin - US #14)")
def update_equipment(
    equipment_id: int,
    data: EquipmentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["ADMIN"]))
):
    eq = db.query(Equipment).filter(Equipment.equipment_id == equipment_id).first()
    if not eq:
        raise HTTPException(status_code=404, detail="Không tìm thấy thiết bị")

    if data.serial_number and data.serial_number.strip() != eq.serial_number:
        existing = db.query(Equipment).filter(
            Equipment.serial_number == data.serial_number.strip(),
            Equipment.equipment_id != equipment_id
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="Mã số Serial đã tồn tại ở thiết bị khác")
        eq.serial_number = data.serial_number.strip()

    if data.room_id is not None:
        if data.room_id == 0:  # Cho phép hủy gán phòng chuyển thành di động
            eq.room_id = None
        else:
            room = db.query(Room).filter(Room.room_id == data.room_id).first()
            if not room:
                raise HTTPException(status_code=404, detail="Phòng họp được gán không tồn tại")
            eq.room_id = data.room_id

    if data.equipment_name is not None:
        eq.equipment_name = data.equipment_name.strip()
    if data.equipment_type is not None:
        eq.equipment_type = data.equipment_type.upper()
    if data.status is not None:
        eq.status = data.status.upper()
    if data.description is not None:
        eq.description = data.description

    db.commit()
    db.refresh(eq)
    
    room_name = eq.room.room_name if eq.room else "Thiết bị di động"
    out = EquipmentOut.model_validate(eq)
    out.room_name = room_name
    return out

@router.delete("/{equipment_id}", summary="Xóa thiết bị (Admin - US #14)")
def delete_equipment(
    equipment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["ADMIN"]))
):
    eq = db.query(Equipment).filter(Equipment.equipment_id == equipment_id).first()
    if not eq:
        raise HTTPException(status_code=404, detail="Không tìm thấy thiết bị")

    # Kiểm tra xem có cuộc họp nào sắp tới chưa hủy đang đặt mượn thiết bị này không
    active_booking = (
        db.query(MeetingEquipment)
        .join(Meeting, MeetingEquipment.meeting_id == Meeting.meeting_id)
        .filter(
            MeetingEquipment.equipment_id == equipment_id,
            Meeting.status != "CANCELLED",
            Meeting.end_time > datetime.now()
        )
        .first()
    )
    if active_booking:
        raise HTTPException(
            status_code=400,
            detail="Không thể xóa thiết bị đang được đặt mượn cho các cuộc họp sắp tới"
        )

    db.delete(eq)
    db.commit()
    return {"message": f"Đã xóa thành công thiết bị '{eq.equipment_name}' (ID={equipment_id})"}

@router.get("/{equipment_id}/history", summary="Xem lịch sử mượn trả thiết bị")
def get_equipment_history(
    equipment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    from sqlalchemy.orm import joinedload
    history = (
        db.query(Meeting)
        .join(MeetingEquipment, Meeting.meeting_id == MeetingEquipment.meeting_id)
        .filter(MeetingEquipment.equipment_id == equipment_id)
        .options(joinedload(Meeting.organizer), joinedload(Meeting.room))
        .order_by(Meeting.start_time.desc())
        .limit(20)
        .all()
    )
    
    result = []
    for m in history:
        result.append({
            "meeting_id": m.meeting_id,
            "title": m.title,
            "start_time": m.start_time,
            "end_time": m.end_time,
            "status": m.status,
            "organizer_name": m.organizer.full_name if m.organizer else "Unknown",
            "room_name": m.room.room_name if m.room else "N/A"
        })
    return result
