from typing import Optional
from datetime import datetime
from pydantic import BaseModel, ConfigDict


class EquipmentBorrowRequestCreate(BaseModel):
    equipment_id: int
    quantity: int = 1
    start_time: datetime
    end_time: datetime
    use_location: Optional[str] = None
    reason: Optional[str] = None


class EquipmentBorrowRequestUpdate(BaseModel):
    status: str  # APPROVED, REJECTED, RETURNED, PENDING


class EquipmentBorrowRequestOut(BaseModel):
    id: int
    requester_id: int
    equipment_id: int
    quantity: int
    start_time: datetime
    end_time: datetime
    use_location: Optional[str] = None
    reason: Optional[str] = None
    status: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    # Populated from relationships
    requester_name: Optional[str] = None
    requester_email: Optional[str] = None
    requester_role: Optional[str] = None
    requester_avatar: Optional[str] = None
    equipment_name: Optional[str] = None
    equipment_type: Optional[str] = None
    equipment_serial: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)