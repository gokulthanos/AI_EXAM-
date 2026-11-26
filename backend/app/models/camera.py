"""Camera model for surveillance cameras."""
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Enum as SQLEnum, func
from sqlalchemy.orm import relationship
import enum

from app.database.connection import Base


class CameraStatus(str, enum.Enum):
    """Camera status enumeration."""
    ACTIVE = "active"
    INACTIVE = "inactive"
    ERROR = "error"
    DISCONNECTED = "disconnected"


class Camera(Base):
    """Camera model representing surveillance cameras."""
    __tablename__ = "cameras"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    camera_name = Column(String(100), nullable=False, index=True)
    camera_source = Column(String(500), nullable=False)  # Device index, RTSP URL, HTTP stream URL, etc.
    zone_id = Column(Integer, ForeignKey("zones.id", ondelete="SET NULL"), nullable=True, index=True)
    status = Column(SQLEnum(CameraStatus), default=CameraStatus.INACTIVE, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    zone = relationship("Zone", back_populates="cameras")
    detection_events = relationship("DetectionEvent", back_populates="camera", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<Camera(id={self.id}, name='{self.camera_name}', status='{self.status.value}')>"