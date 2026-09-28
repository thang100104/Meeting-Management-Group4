from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.core.database import Base

class User(Base):
    __tablename__ = "users"

    user_id = Column(Integer, primary_key=True, index=True)
    role_id = Column(Integer, ForeignKey("roles.role_id"), nullable=False)
    department_id = Column(Integer, ForeignKey("departments.department_id"), nullable=True)
    full_name = Column(String(100), nullable=False)
    email = Column(String(100), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    phone = Column(String(20), nullable=True)
    status = Column(String(20), default="ACTIVE")  # ACTIVE, INACTIVE
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    role = relationship("Role", back_populates="users")
    department = relationship("Department", back_populates="users")
