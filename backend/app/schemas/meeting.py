from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from datetime import datetime

from app.schemas.equipment import EquipmentOut
from app.schemas.user import UserOut
from app.schemas.room import RoomOut

class MeetingParticipantOut(BaseModel):
    participant_id: int
    user_id: int
    user: Optional[UserOut] = None
    rsvp_status: str
    joined_at: Optional[datetime] = None
    checked_in_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

class MeetingCreate(BaseModel):
    room_id: int
    title: str
    description: Optional[str] = None
    start_time: datetime
    end_time: datetime
    meeting_type: Optional[str] = "IN_PERSON"
    meeting_link: Optional[str] = None
    passcode: Optional[str] = None
    participant_ids: Optional[List[int]] = []
    equipment_ids: Optional[List[int]] = []

class MeetingUpdate(BaseModel):
    room_id: Optional[int] = None
    title: Optional[str] = None
    description: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    meeting_type: Optional[str] = None
    meeting_link: Optional[str] = None
    passcode: Optional[str] = None
    status: Optional[str] = None
    equipment_ids: Optional[List[int]] = None

class MeetingRespond(BaseModel):
    status: str # ACCEPTED or DECLINED

class MeetingApprovalRequest(BaseModel):
    note: Optional[str] = None

class MeetingRejectRequest(BaseModel):
    reason: Optional[str] = None

class MeetingStatusUpdate(BaseModel):
    status: str # PENDING, SCHEDULED, APPROVED, IN_PROGRESS, COMPLETED, CANCELLED, REJECTED

class MeetingOut(BaseModel):
    meeting_id: int
    organizer_id: int
    organizer: Optional[UserOut] = None
    room_id: int
    room: Optional[RoomOut] = None
    title: str
    description: Optional[str]
    start_time: datetime
    end_time: datetime
    meeting_type: str
    meeting_link: Optional[str]
    passcode: Optional[str]
    status: str
    qr_token: Optional[str]
    created_at: datetime
    participants: List[MeetingParticipantOut] = []
    equipments: List[EquipmentOut] = []

    model_config = ConfigDict(from_attributes=True)

class RoomAvailability(BaseModel):
    meeting_id: int
    title: str
    start_time: datetime
    end_time: datetime
