"""Detection Event model for mobile phone detection records."""
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Float, Enum as SQLEnum, func, Index
from sqlalchemy.orm import relationship
import enum

from app.database.connection import Base


class ReviewStatus(str, enum.Enum):
    """Detection event review status."""
    PENDING = "pending"
    CONFIRMED = "confirmed"
    FALSE_POSITIVE = "false_positive"
    DISMISSED = "dismissed"


class DetectionEvent(Base):
    """Detection Event model for recording mobile phone detections."""
    __tablename__ = "detection_events"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    camera_id = Column(Integer, ForeignKey("cameras.id", ondelete="CASCADE"), nullable=False, index=True)
    zone_id = Column(Integer, ForeignKey("zones.id", ondelete="SET NULL"), nullable=True, index=True)
    detected_object = Column(String(50), nullable=False, default="cell phone")
    confidence = Column(Float, nullable=False)
    start_time = Column(DateTime(timezone=True), nullable=False, index=True)
    end_time = Column(DateTime(timezone=True), nullable=True, index=True)
    duration_seconds = Column(Float, nullable=True)
    snapshot_path = Column(String(500), nullable=True)
    review_status = Column(SQLEnum(ReviewStatus), default=ReviewStatus.PENDING, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    camera = relationship("Camera", back_populates="detection_events")
    zone = relationship("Zone", back_populates="detection_events")

    # Composite indexes for common queries
    __table_args__ = (
        Index('ix_detection_events_camera_start', 'camera_id', 'start_time'),
        Index('ix_detection_events_zone_start', 'zone_id', 'start_time'),
        Index('ix_detection_events_review_status', 'review_status'),
    )

    def __repr__(self) -> str:
        return f"<DetectionEvent(id={self.id}, camera_id={self.camera_id}, confidence={self.confidence:.2f})>"