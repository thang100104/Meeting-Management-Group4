from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.role import Role
from app.schemas.role import RoleOut
from app.api.deps import get_current_active_user

router = APIRouter()

@router.get("", response_model=List[RoleOut], summary="Danh sách vai trò (Admin, Organizer, Participant)")
def list_roles(db: Session = Depends(get_db), _user = Depends(get_current_active_user)):
    return db.query(Role).all()
