"""Camera schemas for request/response validation."""
from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime
from typing import Optional, List
from enum import Enum

from app.models.camera import CameraStatus


class CameraBase(BaseModel):
    """Base camera schema."""
    camera_name: str = Field(..., min_length=1, max_length=100, description="Name of the camera")
    camera_source: str = Field(..., min_length=1, max_length=500, description="Camera source (device index, RTSP URL, HTTP stream URL)")
    zone_id: Optional[int] = Field(None, description="Associated zone ID")


class CameraCreate(CameraBase):
    """Schema for creating a camera."""
    pass


class CameraUpdate(BaseModel):
    """Schema for updating a camera."""
    camera_name: Optional[str] = Field(None, min_length=1, max_length=100)
    camera_source: Optional[str] = Field(None, min_length=1, max_length=500)
    zone_id: Optional[int] = None
    status: Optional[CameraStatus] = None


class CameraResponse(CameraBase):
    """Schema for camera response."""
    id: int
    status: CameraStatus
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class CameraStatusResponse(BaseModel):
    """Schema for camera status response."""
    camera_id: int
    camera_name: str
    status: CameraStatus
    is_monitoring: bool
    current_fps: Optional[float] = None
    last_frame_time: Optional[datetime] = None
    error_message: Optional[str] = None


class CameraPreviewResponse(BaseModel):
    """Schema for camera preview frame."""
    camera_id: int
    frame_base64: str
    timestamp: datetime
    detections: List[dict] = []