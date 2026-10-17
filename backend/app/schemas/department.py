from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class DepartmentBase(BaseModel):
    department_name: str
    hrm_code: Optional[str] = None

class DepartmentCreate(DepartmentBase):
    pass

class DepartmentUpdate(BaseModel):
    department_name: Optional[str] = None
    hrm_code: Optional[str] = None

class DepartmentOut(DepartmentBase):
    department_id: int
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True
