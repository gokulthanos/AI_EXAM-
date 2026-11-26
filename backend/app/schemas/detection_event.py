"""Detection Event schemas for request/response validation."""
from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime
from typing import Optional, List
from enum import Enum

from app.models.detection_event import ReviewStatus


class DetectionEventBase(BaseModel):
    """Base detection event schema."""
    camera_id: int = Field(..., description="Camera ID")
    zone_id: Optional[int] = Field(None, description="Zone ID")
    detected_object: str = Field(default="cell phone", description="Detected object class")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Detection confidence")
    start_time: datetime = Field(..., description="Detection start time")
    end_time: Optional[datetime] = Field(None, description="Detection end time")
    duration_seconds: Optional[float] = Field(None, ge=0, description="Detection duration in seconds")
    snapshot_path: Optional[str] = Field(None, description="Path to snapshot image")


class DetectionEventCreate(DetectionEventBase):
    """Schema for creating a detection event."""
    pass


class DetectionEventUpdate(BaseModel):
    """Schema for updating a detection event."""
    review_status: Optional[ReviewStatus] = None
    end_time: Optional[datetime] = None
    duration_seconds: Optional[float] = None


class DetectionEventResponse(DetectionEventBase):
    """Schema for detection event response."""
    id: int
    review_status: ReviewStatus
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DetectionEventWithDetails(DetectionEventResponse):
    """Detection event with camera and zone details."""
    camera_name: Optional[str] = None
    zone_name: Optional[str] = None


class DetectionStatsResponse(BaseModel):
    """Schema for detection statistics."""
    total_detections: int
    detections_today: int
    detections_this_week: int
    detections_this_month: int
    pending_reviews: int
    confirmed_detections: int
    false_positives: int
    avg_confidence: float
    avg_duration_seconds: float
    top_zones: List[dict]
    top_cameras: List[dict]
    detections_by_hour: List[dict]
    detections_by_day: List[dict]


class DetectionExportParams(BaseModel):
    """Parameters for exporting detection events."""
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    camera_id: Optional[int] = None
    zone_id: Optional[int] = None
    review_status: Optional[ReviewStatus] = None
    min_confidence: Optional[float] = Field(None, ge=0.0, le=1.0)