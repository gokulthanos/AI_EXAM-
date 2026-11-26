"""Zone schemas for request/response validation."""
from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime
from typing import Optional, List


class ZoneBase(BaseModel):
    """Base zone schema."""
    zone_name: str = Field(..., min_length=1, max_length=100, description="Name of the restricted zone")
    zone_description: Optional[str] = Field(None, description="Description of the zone")


class ZoneCreate(ZoneBase):
    """Schema for creating a zone."""
    pass


class ZoneUpdate(BaseModel):
    """Schema for updating a zone."""
    zone_name: Optional[str] = Field(None, min_length=1, max_length=100)
    zone_description: Optional[str] = None


class ZoneResponse(ZoneBase):
    """Schema for zone response."""
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ZoneWithStats(ZoneResponse):
    """Zone response with camera and detection statistics."""
    camera_count: int = 0
    active_camera_count: int = 0
    total_detections: int = 0
    pending_reviews: int = 0