from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.equipment import Equipment, EquipmentBorrowRequest
from app.models.user import User
from app.schemas.equipment_borrow import (
    EquipmentBorrowRequestCreate,
    EquipmentBorrowRequestUpdate,
    EquipmentBorrowRequestOut,
)
from app.api.deps import get_current_active_user, require_roles

router = APIRouter()


def _to_out(req: EquipmentBorrowRequest) -> EquipmentBorrowRequestOut:
    out = EquipmentBorrowRequestOut(
        id=req.id,
        requester_id=req.requester_id,
        equipment_id=req.equipment_id,
        quantity=req.quantity,
        start_time=req.start_time,
        end_time=req.end_time,
        use_location=req.use_location,
        reason=req.reason,
        status=req.status,
        created_at=req.created_at,
        updated_at=req.updated_at,
    )
    if req.requester:
        out.requester_name = req.requester.full_name
        out.requester_email = req.requester.email
        out.requester_role = req.requester.role.role_name if req.requester.role else None
        out.requester_avatar = getattr(req.requester, "avatar_url", None)
    if req.equipment:
        out.equipment_name = req.equipment.equipment_name
        out.equipment_type = req.equipment.equipment_type
        out.equipment_serial = req.equipment.serial_number
    return out


@router.post("", response_model=EquipmentBorrowRequestOut, status_code=status.HTTP_201_CREATED,
             summary="Giang vien gui yeu cau muon thiet bi")
def create_borrow_request(
    data: EquipmentBorrowRequestCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    if current_user.role and current_user.role.role_name == "PARTICIPANT":
        raise HTTPException(status_code=403, detail="Sinh vien khong co quyen gui yeu cau muon thiet bi")

    if data.start_time >= data.end_time:
        raise HTTPException(status_code=400, detail="Thoi gian ket thuc phai sau thoi gian bat dau")

    eq = db.query(Equipment).filter(Equipment.equipment_id == data.equipment_id).first()
    if not eq:
        raise HTTPException(status_code=404, detail="Khong tim thay thiet bi")
    if eq.status != "AVAILABLE":
        raise HTTPException(status_code=400, detail=f"Thiet bi dang o trang thai {eq.status}")

    req = EquipmentBorrowRequest(
        requester_id=current_user.user_id,
        equipment_id=data.equipment_id,
        quantity=data.quantity,
        start_time=data.start_time,
        end_time=data.end_time,
        use_location=data.use_location,
        reason=data.reason,
        status="PENDING",
    )
    db.add(req)
    db.commit()
    db.refresh(req)
    return _to_out(req)


@router.get("", response_model=List[EquipmentBorrowRequestOut],
            summary="Lay danh sach yeu cau muon (Admin: tat ca; Giang vien: cua minh)")
def list_borrow_requests(
    status_filter: Optional[str] = Query(None, alias="status"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    query = db.query(EquipmentBorrowRequest)
    if current_user.role and current_user.role.role_name != "ADMIN":
        query = query.filter(EquipmentBorrowRequest.requester_id == current_user.user_id)
    if status_filter:
        query = query.filter(EquipmentBorrowRequest.status == status_filter.upper())
    requests = query.order_by(EquipmentBorrowRequest.created_at.desc()).all()
    return [_to_out(r) for r in requests]


@router.get("/my", response_model=List[EquipmentBorrowRequestOut],
            summary="Giang vien lay danh sach yeu cau cua chinh minh")
def my_borrow_requests(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    requests = (
        db.query(EquipmentBorrowRequest)
        .filter(EquipmentBorrowRequest.requester_id == current_user.user_id)
        .order_by(EquipmentBorrowRequest.created_at.desc())
        .all()
    )
    return [_to_out(r) for r in requests]


@router.get("/approved", response_model=List[EquipmentBorrowRequestOut],
            summary="Lay danh sach thiet bi da duoc duyet (dang muon)")
def approved_borrow_requests(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    query = db.query(EquipmentBorrowRequest).filter(
        EquipmentBorrowRequest.status.in_(["APPROVED"])
    )
    if current_user.role and current_user.role.role_name != "ADMIN":
        query = query.filter(EquipmentBorrowRequest.requester_id == current_user.user_id)
    requests = query.order_by(EquipmentBorrowRequest.start_time.asc()).all()
    return [_to_out(r) for r in requests]


@router.patch("/{req_id}/status", response_model=EquipmentBorrowRequestOut,
              summary="Admin duyet / tu choi yeu cau muon thiet bi")
def update_borrow_status(
    req_id: int,
    data: EquipmentBorrowRequestUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    allowed = ["APPROVED", "REJECTED", "RETURNED", "PENDING"]
    if data.status.upper() not in allowed:
        raise HTTPException(status_code=400, detail=f"Trang thai khong hop le. Cho phep: {allowed}")

    req = db.query(EquipmentBorrowRequest).filter(EquipmentBorrowRequest.id == req_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Khong tim thay yeu cau")

    # Chi Admin moi duoc Approve/Reject; Lecturer chi duoc bao tra (RETURNED)
    if current_user.role and current_user.role.role_name != "ADMIN":
        if data.status.upper() not in ["RETURNED"]:
            raise HTTPException(status_code=403, detail="Chi Admin moi co quyen duyet / tu choi yeu cau")
        if req.requester_id != current_user.user_id:
            raise HTTPException(status_code=403, detail="Ban khong co quyen cap nhat yeu cau nay")

    req.status = data.status.upper()
    db.commit()
    db.refresh(req)
    return _to_out(req)


@router.delete("/{req_id}", summary="Xoa yeu cau muon thiet bi (Admin hoac chinh chu)")
def delete_borrow_request(
    req_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    req = db.query(EquipmentBorrowRequest).filter(EquipmentBorrowRequest.id == req_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Khong tim thay yeu cau")

    is_admin = current_user.role and current_user.role.role_name == "ADMIN"
    is_owner = req.requester_id == current_user.user_id

    if not is_admin and not is_owner:
        raise HTTPException(status_code=403, detail="Ban khong co quyen xoa yeu cau nay")

    db.delete(req)
    db.commit()
    return {"message": f"Da xoa yeu cau muon thiet bi ID={req_id}"}