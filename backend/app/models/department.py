from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.core.database import Base

class Department(Base):
    __tablename__ = "departments"

    department_id = Column(Integer, primary_key=True, index=True)
    department_name = Column(String(100), nullable=False)
    hrm_code = Column(String(50), nullable=True, index=True)  # Mã đồng bộ HRM/ERP (US #28)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    users = relationship("User", back_populates="department")
