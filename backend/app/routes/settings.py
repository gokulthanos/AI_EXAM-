"""Application settings API routes."""
from typing import Any, Dict

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.configuration.settings import settings
from app.schemas.common import DataResponse
from app.services.detection_service import get_detection_service
from app.ai_detection.session_tracker import get_tracker

router = APIRouter(prefix="/settings", tags=["Settings"])


class DetectionConfigUpdate(BaseModel):
    """Runtime detection configuration."""

    confidence_threshold: float = Field(..., ge=0.05, le=0.99)
    iou_threshold: float = Field(..., ge=0.05, le=0.99)
    interruption_tolerance: float = Field(..., ge=0.5, le=30.0)
    min_duration: float = Field(..., ge=0.5, le=60.0)
    snapshot_enabled: bool


def _current_state() -> Dict[str, Any]:
    """Build the current runtime configuration payload."""
    detection_service = get_detection_service()
    detector_info = detection_service.get_detector_info()
    tracker = get_tracker()

    return {
        "detection": {
            "confidence_threshold": detector_info.get("confidence_threshold", 0.5),
            "iou_threshold": detector_info.get("iou_threshold", 0.45),
            "interruption_tolerance": tracker.interruption_tolerance,
            "min_duration": tracker.min_duration,
            "snapshot_enabled": settings.detection_snapshot_enabled,
            "snapshot_dir": settings.detection_snapshot_dir,
            "detector_loaded": detector_info.get("is_loaded", False),
            "target_class_name": detector_info.get("target_class_name", "cell phone"),
            "target_class_id": detector_info.get("target_class_id", 67),
            "model_path": detector_info.get("model_path", ""),
            "device": detector_info.get("device", "cpu"),
        },
        "camera": {
            "frame_width": settings.camera_frame_width,
            "frame_height": settings.camera_frame_height,
            "fps": settings.camera_fps,
            "buffer_size": settings.camera_buffer_size,
        },
        "application": {
            "app_name": settings.app_name,
            "app_version": settings.app_version,
            "debug": settings.debug,
            "database_url": settings.database_url,
            "snapshot_dir": settings.detection_snapshot_dir,
            "export_dir": settings.export_dir,
        },
    }


@router.get("/", response_model=DataResponse[dict], summary="Get application settings")
def get_application_settings():
    """Return the current runtime detection, camera and application settings."""
    return DataResponse(data=_current_state(), message="Settings retrieved successfully")


@router.put("/", response_model=DataResponse[dict], summary="Update detection settings")
def update_application_settings(config: DetectionConfigUpdate):
    """Apply detection settings at runtime (no restart required)."""
    detection_service = get_detection_service()

    detection_service.update_detector_confidence(config.confidence_threshold)
    detection_service.update_detector_iou(config.iou_threshold)
    detection_service.update_tracker_tolerance(config.interruption_tolerance)
    detection_service.update_tracker_min_duration(config.min_duration)

    settings.detection_snapshot_enabled = config.snapshot_enabled

    return DataResponse(data=_current_state(), message="Settings updated successfully")
