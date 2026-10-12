from datetime import datetime, timezone
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from app.core.database import Base


class MeetingNotification(Base):
    __tablename__ = "meeting_notifications"
    __table_args__ = (UniqueConstraint("meeting_id", "recipient_user_id", "meeting_start_time", name="uq_meeting_reminder"),)

    notification_id = Column(Integer, primary_key=True)
    meeting_id = Column(Integer, ForeignKey("meetings.meeting_id", ondelete="CASCADE"), nullable=False, index=True)
    recipient_user_id = Column(Integer, ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False, index=True)
    meeting_start_time = Column(DateTime, nullable=False)
    title = Column(String(255), nullable=False)
    content = Column(Text, nullable=False)
    is_read = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None), nullable=False)
    email_status = Column(String(20), default="PENDING", nullable=False)
    email_error = Column(Text, nullable=True)
