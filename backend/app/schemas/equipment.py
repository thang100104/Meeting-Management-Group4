from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, ConfigDict

class EquipmentBase(BaseModel):
    equipment_name: str
    code: Optional[str] = None
    equipment_type: str  # PROJECTOR, TV, MICROPHONE, SMARTBOARD, SPEAKER, CAMERA, OTHER
    serial_number: Optional[str] = None
    room_id: Optional[int] = None
    status: Optional[str] = "AVAILABLE"  # AVAILABLE, MAINTENANCE, BROKEN
    description: Optional[str] = None

class EquipmentCreate(EquipmentBase):
    pass

class EquipmentUpdate(BaseModel):
    equipment_name: Optional[str] = None
    code: Optional[str] = None
    equipment_type: Optional[str] = None
    serial_number: Optional[str] = None
    room_id: Optional[int] = None
    status: Optional[str] = None
    description: Optional[str] = None

class EquipmentOut(EquipmentBase):
    equipment_id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    room_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

class EquipmentAvailability(EquipmentOut):
    is_available_in_slot: bool = True
    conflict_reason: Optional[str] = None

class EquipmentStatsSummary(BaseModel):
    total: int
    available: int
    maintenance: int
    broken: int
    portable_count: int
    in_rooms_count: int
