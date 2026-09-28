from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.core.database import Base

class Room(Base):
    __tablename__ = "rooms"

    room_id = Column(Integer, primary_key=True, index=True)
    room_name = Column(String(100), unique=True, nullable=False, index=True)
    capacity = Column(Integer, nullable=False)  # Sức chứa (US #10)
    location = Column(String(150), nullable=False)  # Ví dụ: "Tầng 3, Nhà C1"
    status = Column(String(20), default="AVAILABLE", index=True)  # AVAILABLE, MAINTENANCE
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Quan hệ với các hạn chế quyền (US #21)
    restrictions = relationship("RoomRestriction", back_populates="room", cascade="all, delete-orphan")

class RoomRestriction(Base):
    """
    Giới hạn quyền đặt phòng theo vai trò (Role-Based Restriction - US #21).
    Nếu 1 phòng có restriction cho role_id, thì người có role đó sẽ bị cấm đặt phòng này.
    """
    __tablename__ = "room_restrictions"

    restriction_id = Column(Integer, primary_key=True, index=True)
    room_id = Column(Integer, ForeignKey("rooms.room_id", ondelete="CASCADE"), nullable=False)
    role_id = Column(Integer, ForeignKey("roles.role_id", ondelete="CASCADE"), nullable=False)
    notes = Column(String(255), nullable=True)  # Lý do giới hạn

    room = relationship("Room", back_populates="restrictions")
    role = relationship("Role")
