from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import relationship
from app.core.database import Base

class Role(Base):
    __tablename__ = "roles"

    role_id = Column(Integer, primary_key=True, index=True)
    role_name = Column(String(50), unique=True, nullable=False, index=True)  # ADMIN, ORGANIZER, PARTICIPANT

    users = relationship("User", back_populates="role")
