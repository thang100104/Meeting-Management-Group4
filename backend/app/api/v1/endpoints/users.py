from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import get_password_hash
from app.models.user import User
from app.models.role import Role
from app.models.department import Department
from app.schemas.user import UserCreate, UserUpdate, UserOut
from app.api.deps import require_roles, get_current_active_user

router = APIRouter()

@router.get("", response_model=List[UserOut], summary="Danh sách người dùng (US #19 - Chỉ Admin)")
def list_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    search: Optional[str] = Query(None, description="Tìm theo tên hoặc email"),
    role_id: Optional[int] = Query(None, description="Lọc theo mã vai trò"),
    department_id: Optional[int] = Query(None, description="Lọc theo phòng ban"),
    status: Optional[str] = Query(None, description="Lọc theo trạng thái ACTIVE / INACTIVE"),
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_roles(["ADMIN"]))
):
    query = db.query(User)
    if search:
        query = query.filter(
            (User.full_name.ilike(f"%{search}%")) | (User.email.ilike(f"%{search}%"))
        )
    if role_id:
        query = query.filter(User.role_id == role_id)
    if department_id:
        query = query.filter(User.department_id == department_id)
    if status:
        query = query.filter(User.status == status)

    return query.offset(skip).limit(limit).all()

@router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED, summary="Tạo người dùng mới (US #18, #20 - Chỉ Admin)")
def create_user(
    data: UserCreate,
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_roles(["ADMIN"]))
):
    # Kiểm tra email trùng
    existing = db.query(User).filter(User.email == data.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Email '{data.email}' đã được sử dụng trong hệ thống"
        )
    
    # Kiểm tra role hợp lệ
    role = db.query(Role).filter(Role.role_id == data.role_id).first()
    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Vai trò với role_id={data.role_id} không tồn tại"
        )

    # Kiểm tra department nếu có
    if data.department_id:
        dept = db.query(Department).filter(Department.department_id == data.department_id).first()
        if not dept:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Phòng ban với department_id={data.department_id} không tồn tại"
            )

    new_user = User(
        email=data.email,
        password_hash=get_password_hash(data.password),
        full_name=data.full_name,
        phone=data.phone,
        role_id=data.role_id,
        department_id=data.department_id,
        status=data.status or "ACTIVE"
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@router.get("/{user_id}", response_model=UserOut, summary="Xem thông tin chi tiết người dùng")
def get_user_detail(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    # Chỉ Admin hoặc chính người dùng đó mới được xem
    if current_user.role.role_name != "ADMIN" and current_user.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bạn không có quyền xem thông tin tài khoản này"
        )

    user = db.query(User).filter(User.user_id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Người dùng không tồn tại")
    return user

@router.put("/{user_id}", response_model=UserOut, summary="Cập nhật thông tin người dùng")
def update_user(
    user_id: int,
    data: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    user = db.query(User).filter(User.user_id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Người dùng không tồn tại")

    is_admin = current_user.role.role_name == "ADMIN"
    if not is_admin and current_user.user_id != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Không có quyền cập nhật người dùng này")

    # Người dùng thường chỉ được sửa tên, sđt; chỉ Admin mới được đổi role_id, department_id, status
    if data.full_name is not None:
        user.full_name = data.full_name
    if data.phone is not None:
        user.phone = data.phone
    
    if is_admin:
        if data.role_id is not None:
            user.role_id = data.role_id
        if data.department_id is not None:
            user.department_id = data.department_id
        if data.status is not None:
            user.status = data.status

    if data.password:
        user.password_hash = get_password_hash(data.password)

    db.commit()
    db.refresh(user)
    return user

@router.delete("/{user_id}", summary="Vô hiệu hóa tài khoản (Chỉ Admin)")
def deactivate_user(
    user_id: int,
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_roles(["ADMIN"]))
):
    user = db.query(User).filter(User.user_id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Người dùng không tồn tại")
    
    user.status = "INACTIVE"
    db.commit()
    return {"message": f"Tài khoản {user.email} đã được chuyển sang trạng thái INACTIVE (vô hiệu hóa)"}
