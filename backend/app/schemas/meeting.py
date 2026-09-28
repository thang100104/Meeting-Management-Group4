from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from datetime import datetime

from app.schemas.equipment import EquipmentOut

class MeetingParticipantOut(BaseModel):
    participant_id: int
    user_id: int
    status: str

    model_config = ConfigDict(from_attributes=True)

class MeetingCreate(BaseModel):
    room_id: int
    title: str
    description: Optional[str] = None
    start_time: datetime
    end_time: datetime
    participant_ids: Optional[List[int]] = []
    equipment_ids: Optional[List[int]] = []

class MeetingUpdate(BaseModel):
    room_id: Optional[int] = None
    title: Optional[str] = None
    description: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    status: Optional[str] = None
    equipment_ids: Optional[List[int]] = None

class MeetingRespond(BaseModel):
    status: str # ACCEPTED or DECLINED

class MeetingOut(BaseModel):
    meeting_id: int
    organizer_id: int
    room_id: int
    title: str
    description: Optional[str]
    start_time: datetime
    end_time: datetime
    status: str
    created_at: datetime
    participants: List[MeetingParticipantOut] = []
    equipments: List[EquipmentOut] = []

    model_config = ConfigDict(from_attributes=True)

class RoomAvailability(BaseModel):
    meeting_id: int
    title: str
    start_time: datetime
    end_time: datetime
