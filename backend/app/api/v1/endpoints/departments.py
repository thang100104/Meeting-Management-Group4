from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.department import Department
from app.schemas.department import DepartmentCreate, DepartmentUpdate, DepartmentOut
from app.api.deps import get_current_active_user, require_roles

router = APIRouter()

@router.get("", response_model=List[DepartmentOut], summary="Danh sách phòng ban")
def list_departments(db: Session = Depends(get_db), _user = Depends(get_current_active_user)):
    return db.query(Department).all()

@router.post("", response_model=DepartmentOut, status_code=status.HTTP_201_CREATED, summary="Tạo phòng ban mới (Chỉ Admin)")
def create_department(
    data: DepartmentCreate,
    db: Session = Depends(get_db),
    _admin = Depends(require_roles(["ADMIN"]))
):
    existing = db.query(Department).filter(Department.department_name == data.department_name).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Tên phòng ban đã tồn tại")
    
    dept = Department(
        department_name=data.department_name,
        hrm_code=data.hrm_code
    )
    db.add(dept)
    db.commit()
    db.refresh(dept)
    return dept

@router.put("/{department_id}", response_model=DepartmentOut, summary="Cập nhật phòng ban (Chỉ Admin)")
def update_department(
    department_id: int,
    data: DepartmentUpdate,
    db: Session = Depends(get_db),
    _admin = Depends(require_roles(["ADMIN"]))
):
    dept = db.query(Department).filter(Department.department_id == department_id).first()
    if not dept:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Phòng ban không tồn tại")
    
    if data.department_name is not None:
        dept.department_name = data.department_name
    if data.hrm_code is not None:
        dept.hrm_code = data.hrm_code
        
    db.commit()
    db.refresh(dept)
    return dept
