"""Detection Event REST API routes."""
import csv
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from io import StringIO

from app.database.connection import get_db
from app.services.detection_event_service import DetectionEventService
from app.schemas.detection_event import (
    DetectionEventCreate,
    DetectionEventUpdate,
    DetectionEventResponse,
    DetectionEventWithDetails,
    DetectionStatsResponse,
    DetectionExportParams,
)
from app.schemas.common import PaginationParams, PaginatedResponse, DataResponse, ListResponse
from app.models.detection_event import ReviewStatus

router = APIRouter(prefix="/detection-events", tags=["Detection Events"])


def get_detection_event_service(db: Session = Depends(get_db)) -> DetectionEventService:
    return DetectionEventService(db)


@router.post(
    "/",
    response_model=DataResponse[DetectionEventResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Create a new detection event",
)
def create_detection_event(
    event_data: DetectionEventCreate,
    service: DetectionEventService = Depends(get_detection_event_service),
):
    """Manually create a detection event (normally created automatically by detection service)."""
    event = service.create(event_data)
    return DataResponse(data=event, message="Detection event created successfully")


@router.get(
    "/",
    response_model=PaginatedResponse[DetectionEventWithDetails],
    summary="List all detection events",
)
def list_detection_events(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    camera_id: Optional[int] = Query(None, description="Filter by camera ID"),
    zone_id: Optional[int] = Query(None, description="Filter by zone ID"),
    review_status: Optional[ReviewStatus] = Query(None, description="Filter by review status"),
    start_date: Optional[datetime] = Query(None, description="Filter by start date (ISO format)"),
    end_date: Optional[datetime] = Query(None, description="Filter by end date (ISO format)"),
    min_confidence: Optional[float] = Query(None, ge=0.0, le=1.0, description="Minimum confidence threshold"),
    search: Optional[str] = Query(None, description="Search by camera name"),
    sort_by: str = Query("start_time", description="Sort field: start_time or duration"),
    sort_order: str = Query("desc", description="Sort order: asc or desc"),
    service: DetectionEventService = Depends(get_detection_event_service),
):
    """List detection events with pagination and filters."""
    params = PaginationParams(page=page, page_size=page_size)
    return service.get_all(
        params=params,
        camera_id=camera_id,
        zone_id=zone_id,
        review_status=review_status,
        start_date=start_date,
        end_date=end_date,
        min_confidence=min_confidence,
        search=search,
        sort_by=sort_by,
        sort_order=sort_order,
    )


@router.get(
    "/stats",
    response_model=DataResponse[DetectionStatsResponse],
    summary="Get detection statistics",
)
def get_detection_stats(
    service: DetectionEventService = Depends(get_detection_event_service),
):
    """Get detection statistics and analytics."""
    stats = service.get_stats()
    return DataResponse(data=stats, message="Detection statistics retrieved successfully")


@router.get(
    "/active",
    response_model=DataResponse[List[dict]],
    summary="Get currently active detections",
)
def get_active_detections(
    service: DetectionEventService = Depends(get_detection_event_service),
):
    """Get currently active detection sessions (from detection service)."""
    from app.services.detection_service import get_detection_service
    detection_service = get_detection_service()
    active = detection_service.get_active_detections()
    return DataResponse(data=active, message="Active detections retrieved successfully")


@router.get(
    "/export/csv",
    summary="Export detection events to CSV",
)
def export_detection_events_csv(
    camera_id: Optional[int] = Query(None, description="Filter by camera ID"),
    zone_id: Optional[int] = Query(None, description="Filter by zone ID"),
    review_status: Optional[ReviewStatus] = Query(None, description="Filter by review status"),
    start_date: Optional[datetime] = Query(None, description="Filter by start date (ISO format)"),
    end_date: Optional[datetime] = Query(None, description="Filter by end date (ISO format)"),
    min_confidence: Optional[float] = Query(None, ge=0.0, le=1.0, description="Minimum confidence threshold"),
    service: DetectionEventService = Depends(get_detection_event_service),
):
    """Export detection events to CSV file."""
    params = DetectionExportParams(
        camera_id=camera_id,
        zone_id=zone_id,
        review_status=review_status,
        start_date=start_date,
        end_date=end_date,
        min_confidence=min_confidence,
    )

    csv_content = service.export_to_csv(params)

    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    filename = f"detection_events_{timestamp}.csv"

    return StreamingResponse(
        StringIO(csv_content),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.get(
    "/{event_id}",
    response_model=DataResponse[DetectionEventWithDetails],
    summary="Get detection event by ID",
)
def get_detection_event(
    event_id: int,
    service: DetectionEventService = Depends(get_detection_event_service),
):
    """Get a specific detection event by ID with camera and zone details."""
    event = service.get_with_details(event_id)
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Detection event with ID {event_id} not found",
        )
    return DataResponse(data=event, message="Detection event retrieved successfully")


@router.put(
    "/{event_id}",
    response_model=DataResponse[DetectionEventResponse],
    summary="Update a detection event",
)
def update_detection_event(
    event_id: int,
    event_data: DetectionEventUpdate,
    service: DetectionEventService = Depends(get_detection_event_service),
):
    """Update a detection event (e.g., review status)."""
    event = service.update(event_id, event_data)
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Detection event with ID {event_id} not found",
        )
    return DataResponse(data=event, message="Detection event updated successfully")


@router.put(
    "/{event_id}/review",
    response_model=DataResponse[DetectionEventResponse],
    summary="Update detection event review status",
)
def update_review_status(
    event_id: int,
    review_status: ReviewStatus,
    service: DetectionEventService = Depends(get_detection_event_service),
):
    """Update the review status of a detection event."""
    event = service.update_review_status(event_id, review_status)
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Detection event with ID {event_id} not found",
        )
    return DataResponse(data=event, message=f"Review status updated to {review_status.value}")


@router.delete(
    "/{event_id}",
    response_model=DataResponse[dict],
    summary="Delete a detection event",
)
def delete_detection_event(
    event_id: int,
    service: DetectionEventService = Depends(get_detection_event_service),
):
    """Delete a detection event."""
    success = service.delete(event_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Detection event with ID {event_id} not found",
        )
    return DataResponse(data={"deleted": True}, message="Detection event deleted successfully")