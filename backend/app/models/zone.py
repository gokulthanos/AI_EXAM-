"""Zone model for restricted areas."""
from sqlalchemy import Column, Integer, String, Text, DateTime, func
from sqlalchemy.orm import relationship

from app.database.connection import Base


class Zone(Base):
    """Zone model representing restricted areas like exam halls, libraries, etc."""
    __tablename__ = "zones"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    zone_name = Column(String(100), unique=True, nullable=False, index=True)
    zone_description = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    cameras = relationship("Camera", back_populates="zone", cascade="all, delete-orphan")
    detection_events = relationship("DetectionEvent", back_populates="zone", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<Zone(id={self.id}, name='{self.zone_name}')>"