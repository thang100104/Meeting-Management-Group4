from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime
from app.schemas.role import RoleOut
from app.schemas.department import DepartmentOut

class UserBase(BaseModel):
    email: EmailStr
    full_name: str
    phone: Optional[str] = None
    role_id: int
    department_id: Optional[int] = None
    status: Optional[str] = "ACTIVE"

class UserCreate(UserBase):
    password: str

class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    role_id: Optional[int] = None
    department_id: Optional[int] = None
    status: Optional[str] = None
    password: Optional[str] = None

class UserChangePassword(BaseModel):
    old_password: str
    new_password: str

class UserOut(BaseModel):
    user_id: int
    email: str
    full_name: str
    phone: Optional[str] = None
    status: str
    role_id: int
    department_id: Optional[int] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    
    role: Optional[RoleOut] = None
    department: Optional[DepartmentOut] = None

    class Config:
        from_attributes = True
