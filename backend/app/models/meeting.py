from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.core.database import Base

class Meeting(Base):
    __tablename__ = "meetings"

    meeting_id = Column(Integer, primary_key=True, index=True)
    organizer_id = Column(Integer, ForeignKey("users.user_id"), nullable=False)
    room_id = Column(Integer, ForeignKey("rooms.room_id"), nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    start_time = Column(DateTime, nullable=False, index=True)
    end_time = Column(DateTime, nullable=False, index=True)
    status = Column(String(50), default="SCHEDULED") # SCHEDULED, IN_PROGRESS, COMPLETED, CANCELLED
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    organizer = relationship("User", foreign_keys=[organizer_id])
    room = relationship("Room")
    participants = relationship("MeetingParticipant", back_populates="meeting", cascade="all, delete-orphan")
    meeting_equipments = relationship("MeetingEquipment", back_populates="meeting", cascade="all, delete-orphan")

    @property
    def equipments(self):
        return [me.equipment for me in self.meeting_equipments if me.equipment]


class MeetingParticipant(Base):
    __tablename__ = "meeting_participants"

    participant_id = Column(Integer, primary_key=True, index=True)
    meeting_id = Column(Integer, ForeignKey("meetings.meeting_id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.user_id"), nullable=False)
    status = Column(String(50), default="PENDING") # PENDING, ACCEPTED, DECLINED

    meeting = relationship("Meeting", back_populates="participants")
    user = relationship("User")
