from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.core.database import Base

class Equipment(Base):
    """
    Thực thể Quản lý Thiết bị (US #12, #13, #14).
    Thiết bị có thể được gắn cố định với một phòng họp hoặc là thiết bị di động dùng chung (room_id is Null).
    """
    __tablename__ = "equipments"

    equipment_id = Column(Integer, primary_key=True, index=True)
    equipment_name = Column(String(100), nullable=False, index=True)
    code = Column(String(50), unique=True, index=True, nullable=True)
    equipment_type = Column(String(50), nullable=False, index=True)  # PROJECTOR, TV, MICROPHONE, SMARTBOARD, SPEAKER, CAMERA, OTHER
    serial_number = Column(String(100), unique=True, nullable=True)
    room_id = Column(Integer, ForeignKey("rooms.room_id", ondelete="SET NULL"), nullable=True)
    status = Column(String(20), default="AVAILABLE", index=True)  # AVAILABLE, MAINTENANCE, BROKEN
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    room = relationship("Room", backref="fixed_equipments")
    meeting_links = relationship("MeetingEquipment", back_populates="equipment", cascade="all, delete-orphan")
    borrow_requests = relationship("EquipmentBorrowRequest", back_populates="equipment", cascade="all, delete-orphan")


class MeetingEquipment(Base):
    """
    Bảng liên kết Cuộc họp và Thiết bị được mượn kèm (US #12).
    Mỗi bản ghi đại diện cho một thiết bị được giữ chỗ trong khung giờ cuộc họp diễn ra.
    """
    __tablename__ = "meeting_equipments"

    id = Column(Integer, primary_key=True, index=True)
    meeting_id = Column(Integer, ForeignKey("meetings.meeting_id", ondelete="CASCADE"), nullable=False, index=True)
    equipment_id = Column(Integer, ForeignKey("equipments.equipment_id", ondelete="CASCADE"), nullable=False, index=True)
    quantity = Column(Integer, default=1)
    notes = Column(String(255), nullable=True)

    # Relationships
    meeting = relationship("Meeting", back_populates="meeting_equipments")
    equipment = relationship("Equipment", back_populates="meeting_links")


class EquipmentBorrowRequest(Base):
    __tablename__ = "equipment_borrow_requests"

    id = Column(Integer, primary_key=True, index=True)
    requester_id = Column(Integer, ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False, index=True)
    equipment_id = Column(Integer, ForeignKey("equipments.equipment_id", ondelete="CASCADE"), nullable=False, index=True)
    quantity = Column(Integer, default=1)
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime, nullable=False)
    use_location = Column(String(255), nullable=True)
    reason = Column(Text, nullable=True)
    status = Column(String(20), default="PENDING", index=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    requester = relationship("User", foreign_keys=[requester_id])
    equipment = relationship("Equipment", back_populates="borrow_requests")