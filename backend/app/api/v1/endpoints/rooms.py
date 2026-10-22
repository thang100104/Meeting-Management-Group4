from typing import List, Optional
from datetime import datetime, timedelta, date
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.room import Room, RoomRestriction
from app.models.role import Role
from app.models.user import User
from app.models.meeting import Meeting
from app.models.equipment import Equipment
from app.schemas.room import RoomCreate, RoomUpdate, RoomOut, RoomRestrictionCreate, RoomRestrictionOut
from app.schemas.meeting import RoomAvailability
from app.api.deps import get_current_active_user, require_roles

router = APIRouter()

@router.get("", response_model=List[RoomOut], summary="Danh sách phòng họp (US #7, #10)")
def list_rooms(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    search: Optional[str] = Query(None, description="Tìm theo tên phòng hoặc vị trí"),
    min_capacity: Optional[int] = Query(None, ge=1, description="Lọc theo sức chứa tối thiểu (US #10)"),
    max_capacity: Optional[int] = Query(None, ge=1, description="Lọc theo sức chứa tối đa"),
    status: Optional[str] = Query(None, description="AVAILABLE hoặc MAINTENANCE"),
    only_allowed_for_me: bool = Query(False, description="Chỉ hiển thị các phòng vai trò của tôi được phép đặt (US #21)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    query = db.query(Room)
    
    if search:
        query = query.filter(
            (Room.room_name.ilike(f"%{search}%")) | (Room.location.ilike(f"%{search}%"))
        )
    if min_capacity is not None:
        query = query.filter(Room.capacity >= min_capacity)
    if max_capacity is not None:
        query = query.filter(Room.capacity <= max_capacity)
    if status:
        query = query.filter(Room.status == status)

    rooms = query.offset(skip).limit(limit).all()

    # Nếu người dùng muốn lọc những phòng mà vai trò của họ KHÔNG bị cấm đặt (US #21)
    if only_allowed_for_me:
        user_role_id = current_user.role_id
        # Nếu là Admin thì luôn được phép đặt mọi phòng
        if current_user.role and current_user.role.role_name == "ADMIN":
            return rooms
        
        filtered_rooms = []
        for r in rooms:
            restricted_role_ids = [rest.role_id for rest in r.restrictions]
            if user_role_id not in restricted_role_ids:
                filtered_rooms.append(r)
        return filtered_rooms

    return rooms

@router.post("", response_model=RoomOut, status_code=status.HTTP_201_CREATED, summary="Tạo phòng họp mới (US #11 - Chỉ Admin)")
def create_room(
    data: RoomCreate,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_roles(["ADMIN"]))
):
    # Kiểm tra trùng tên phòng
    existing = db.query(Room).filter(Room.room_name == data.room_name).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Phòng họp có tên '{data.room_name}' đã tồn tại"
        )

    room = Room(
        room_name=data.room_name,
        capacity=data.capacity,
        location=data.location,
        status=data.status or "AVAILABLE",
        description=data.description,
        image_url=data.image_url,
        equipments=data.equipments
    )
    db.add(room)
    db.flush()
    
    if data.equipments:
        eq_names = [e.strip() for e in data.equipments.split(",") if e.strip()]
        for eq_name in eq_names:
            eq = db.query(Equipment).filter(Equipment.equipment_name == eq_name, Equipment.room_id == None).first()
            if eq:
                eq.room_id = room.room_id

    db.commit()
    db.refresh(room)
    return room

@router.get("/suggest", summary="Tự động gợi ý phòng họp tối ưu theo số lượng người tham dự (US #26)")
def suggest_rooms(
    attendees: int = Query(..., ge=1, description="Số lượng người tham dự"),
    start_time: Optional[datetime] = Query(None, description="Thời gian bắt đầu (ISO format)"),
    end_time: Optional[datetime] = Query(None, description="Thời gian kết thúc (ISO format)"),
    equipments: Optional[str] = Query(None, description="Thiết bị yêu cầu (phân cách bằng dấu phẩy)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    # 1. Base rooms with capacity >= attendees and status AVAILABLE
    rooms = db.query(Room).filter(Room.status == "AVAILABLE", Room.capacity >= attendees).all()

    # If no room fits capacity >= attendees, fallback to all available rooms to find closest
    if not rooms:
        rooms = db.query(Room).filter(Room.status == "AVAILABLE").all()

    # Parse required equipments
    req_eq_list = [e.strip().lower() for e in equipments.split(",") if e.strip()] if equipments else []

    # Get user role for restrictions check
    user_role_name = current_user.role.role_name if current_user.role else ""
    user_role_id = current_user.role_id

    suggestions = []
    for r in rooms:
        # Check restriction for non-admin
        if user_role_name != "ADMIN" and user_role_id:
            restr = db.query(RoomRestriction).filter(
                RoomRestriction.room_id == r.room_id,
                RoomRestriction.role_id == user_role_id
            ).first()
            if restr and not restr.is_allowed:
                continue # Blocked for this role

        # Check time conflict if start_time and end_time provided
        has_conflict = False
        if start_time and end_time:
            st = start_time.replace(tzinfo=None) if start_time.tzinfo else start_time
            et = end_time.replace(tzinfo=None) if end_time.tzinfo else end_time
            
            conflict = db.query(Meeting).filter(
                Meeting.room_id == r.room_id,
                Meeting.status.in_(["SCHEDULED", "IN_PROGRESS", "APPROVED"]),
                Meeting.start_time < et,
                Meeting.end_time > st
            ).first()
            if conflict:
                has_conflict = True

        # Calculate capacity score
        extra_seats = r.capacity - attendees
        if extra_seats < 0:
            capacity_score = max(20, 100 + extra_seats * 10)
        elif extra_seats == 0:
            capacity_score = 100
        elif extra_seats <= 5:
            capacity_score = 95 - (extra_seats * 2)
        elif extra_seats <= 15:
            capacity_score = 85 - (extra_seats - 5)
        elif extra_seats <= 30:
            capacity_score = 75 - (extra_seats - 15) // 2
        else:
            capacity_score = max(40, 65 - (extra_seats - 30) // 3)

        # Equipment score
        eq_score = 100
        room_eq_text = (r.equipments or "").lower()
        if req_eq_list:
            matched_count = sum(1 for eq in req_eq_list if eq in room_eq_text)
            eq_score = int((matched_count / len(req_eq_list)) * 100)

        # Conflict penalty
        if has_conflict:
            match_score = max(10, int((capacity_score * 0.7 + eq_score * 0.3) * 0.3))
        else:
            match_score = int(capacity_score * 0.75 + eq_score * 0.25)

        # Generate reason explanation
        if has_conflict:
            reason = "Phòng đang có lịch bận trong khung giờ này"
        elif extra_seats == 0:
            reason = "Hoàn hảo: Sức chứa chính xác số lượng người tham dự"
        elif 0 < extra_seats <= 5:
            reason = f"Tối ưu nhất: Dư {extra_seats} chỗ dự phòng, vừa vặn không lãng phí diện tích"
        elif 5 < extra_seats <= 15:
            reason = f"Rất phù hợp: Dư {extra_seats} chỗ ngồi thoáng đãng"
        elif extra_seats > 15:
            reason = f"Phòng rộng: Sức chứa {r.capacity} chỗ (dư {extra_seats} chỗ)"
        else:
            reason = f"Thiếu {abs(extra_seats)} chỗ so với số người tham gia"

        if req_eq_list and eq_score == 100:
            reason += " • Đầy đủ thiết bị yêu cầu"

        suggestions.append({
            "room_id": r.room_id,
            "room_name": r.room_name,
            "capacity": r.capacity,
            "location": r.location,
            "status": r.status,
            "description": r.description,
            "image_url": r.image_url,
            "equipments": r.equipments,
            "match_score_pct": match_score,
            "extra_seats": extra_seats,
            "has_conflict": has_conflict,
            "reason": reason
        })

    suggestions.sort(key=lambda s: (not s["has_conflict"], s["match_score_pct"]), reverse=True)
    return suggestions

@router.get("/{room_id}", response_model=RoomOut, summary="Xem chi tiết thông tin phòng họp (US #10)")
def get_room_detail(
    room_id: int,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_active_user)
):
    room = db.query(Room).filter(Room.room_id == room_id).first()
    if not room:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy phòng họp")
    return room

@router.put("/{room_id}", response_model=RoomOut, summary="Cập nhật thông tin phòng họp (US #11 - Chỉ Admin)")
def update_room(
    room_id: int,
    data: RoomUpdate,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_roles(["ADMIN"]))
):
    room = db.query(Room).filter(Room.room_id == room_id).first()
    if not room:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy phòng họp")

    if data.room_name is not None and data.room_name != room.room_name:
        existing = db.query(Room).filter(Room.room_name == data.room_name).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Tên phòng '{data.room_name}' đã được dùng cho phòng khác"
            )
        room.room_name = data.room_name

    if data.capacity is not None:
        room.capacity = data.capacity
    if data.location is not None:
        room.location = data.location
    if data.status is not None:
        room.status = data.status
    if data.description is not None:
        room.description = data.description
    if data.image_url is not None:
        room.image_url = data.image_url
    if data.equipments is not None:
        room.equipments = data.equipments
        
        # Clear old equipments assigned to this room
        old_eqs = db.query(Equipment).filter(Equipment.room_id == room.room_id).all()
        for old_eq in old_eqs:
            old_eq.room_id = None
            
        # Assign new equipments
        if data.equipments:
            eq_names = [e.strip() for e in data.equipments.split(",") if e.strip()]
            for eq_name in eq_names:
                eq = db.query(Equipment).filter(Equipment.equipment_name == eq_name).first()
                if eq:
                    eq.room_id = room.room_id

    db.commit()
    db.refresh(room)
    return room

@router.delete("/{room_id}", summary="Xóa phòng họp (US #11 - Chỉ Admin)")
def delete_room(
    room_id: int,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_roles(["ADMIN"]))
):
    room = db.query(Room).filter(Room.room_id == room_id).first()
    if not room:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy phòng họp")

    # Kiểm tra xem có cuộc họp đang hoạt động tại phòng này không
    active_meeting = db.query(Meeting).filter(
        Meeting.room_id == room_id,
        Meeting.status.in_(["SCHEDULED", "APPROVED", "PENDING"])
    ).first()
    if active_meeting:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Không thể xóa phòng '{room.room_name}' vì đang có cuộc họp '{active_meeting.title}' xếp lịch tại đây. Vui lòng chuyển hoặc hủy cuộc họp trước."
        )

    # Gỡ liên kết các thiết bị gắn cố định với phòng này
    db.query(Equipment).filter(Equipment.room_id == room_id).update({Equipment.room_id: None})

    # Xóa các giới hạn quyền đặt phòng nếu có
    db.query(RoomRestriction).filter(RoomRestriction.room_id == room_id).delete()

    # Xóa phòng
    db.delete(room)
    db.commit()
    return {"message": f"Đã xóa thành công phòng họp '{room.room_name}'"}

# --- Quản lý giới hạn đặt phòng theo vai trò (US #21) ---

@router.get("/{room_id}/availability", response_model=List[RoomAvailability], summary="Lấy timeline các khung giờ đã đặt của phòng")
def get_room_availability(
    room_id: int,
    target_date: date = Query(..., description="Ngày cần xem lịch (YYYY-MM-DD)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    start_of_day = datetime.combine(target_date, datetime.min.time())
    end_of_day = start_of_day + timedelta(days=1)
    
    meetings = db.query(Meeting).filter(
        Meeting.room_id == room_id,
        Meeting.status != "CANCELLED",
        Meeting.start_time >= start_of_day,
        Meeting.start_time < end_of_day
    ).order_by(Meeting.start_time).all()
    
    return [{"meeting_id": m.meeting_id, "title": m.title, "start_time": m.start_time, "end_time": m.end_time} for m in meetings]


@router.get("/{room_id}/restrictions", response_model=List[RoomRestrictionOut], summary="Danh sách giới hạn quyền đặt phòng theo Role (US #21)")
def get_room_restrictions(
    room_id: int,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_active_user)
):
    room = db.query(Room).filter(Room.room_id == room_id).first()
    if not room:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy phòng họp")
    return room.restrictions


@router.post("/{room_id}/restrictions", response_model=RoomRestrictionOut, status_code=status.HTTP_201_CREATED, summary="Thêm giới hạn quyền đặt phòng theo Role (US #21 - Chỉ Admin)")
def add_room_restriction(
    room_id: int,
    data: RoomRestrictionCreate,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_roles(["ADMIN"]))
):
    room = db.query(Room).filter(Room.room_id == room_id).first()
    if not room:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy phòng họp")

    role = db.query(Role).filter(Role.role_id == data.role_id).first()
    if not role:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vai trò không tồn tại")

    # Kiểm tra xem đã có giới hạn này chưa
    existing = db.query(RoomRestriction).filter(
        RoomRestriction.room_id == room_id,
        RoomRestriction.role_id == data.role_id
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Phòng này đã có cấu hình giới hạn cho vai trò '{role.role_name}' rồi"
        )

    restriction = RoomRestriction(
        room_id=room_id,
        role_id=data.role_id,
        notes=data.notes
    )
    db.add(restriction)
    db.commit()
    db.refresh(restriction)
    return restriction

@router.delete("/{room_id}/restrictions/{restriction_id}", summary="Xóa giới hạn quyền đặt phòng (US #21 - Chỉ Admin)")
def remove_room_restriction(
    room_id: int,
    restriction_id: int,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_roles(["ADMIN"]))
):
    restriction = db.query(RoomRestriction).filter(
        RoomRestriction.room_id == room_id,
        RoomRestriction.restriction_id == restriction_id
    ).first()
    if not restriction:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy cấu hình giới hạn quyền này")

    db.delete(restriction)
    db.commit()
    return {"message": "Đã gỡ bỏ giới hạn quyền đặt phòng thành công"}
