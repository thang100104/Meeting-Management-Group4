from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from app.schemas.role import RoleOut

# --- Schemas cho Giới hạn đặt phòng (US #21) ---
class RoomRestrictionBase(BaseModel):
    role_id: int
    notes: Optional[str] = None

class RoomRestrictionCreate(RoomRestrictionBase):
    pass

class RoomRestrictionOut(RoomRestrictionBase):
    restriction_id: int
    room_id: int
    role: Optional[RoleOut] = None

    class Config:
        from_attributes = True

# --- Schemas cho Phòng họp (US #7, #10, #11) ---
class RoomBase(BaseModel):
    room_name: str = Field(..., example="Phòng Hội thảo C1 - 101")
    capacity: int = Field(..., gt=0, example=50, description="Sức chứa số lượng người")
    location: str = Field(..., example="Tầng 1, Tòa nhà C1")
    status: Optional[str] = Field("AVAILABLE", example="AVAILABLE", description="AVAILABLE hoặc MAINTENANCE")
    description: Optional[str] = Field(None, example="Trang bị máy chiếu, điều hòa, hệ thống âm thanh")
    image_url: Optional[str] = Field(None, description="URL ảnh đại diện của phòng")
    equipments: Optional[str] = Field(None, description="Danh sách thiết bị, phân tách bời dấu phẩy")

class RoomCreate(RoomBase):
    pass

class RoomUpdate(BaseModel):
    room_name: Optional[str] = None
    capacity: Optional[int] = Field(None, gt=0)
    location: Optional[str] = None
    status: Optional[str] = None
    description: Optional[str] = None
    image_url: Optional[str] = None
    equipments: Optional[str] = None

class RoomOut(RoomBase):
    room_id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    restrictions: List[RoomRestrictionOut] = []

    class Config:
        from_attributes = True
