"""Detection Event CRUD Service."""
import csv
import io
from typing import Optional, List
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, asc, and_, or_

from app.models.detection_event import DetectionEvent, ReviewStatus
from app.models.camera import Camera
from app.models.zone import Zone
from app.schemas.detection_event import (
    DetectionEventCreate,
    DetectionEventUpdate,
    DetectionEventResponse,
    DetectionEventWithDetails,
    DetectionStatsResponse,
    DetectionExportParams,
)
from app.schemas.common import PaginationParams, PaginatedResponse


class DetectionEventService:
    """Service for detection event operations."""

    def __init__(self, db: Session):
        self.db = db

    def create(self, event_data: DetectionEventCreate) -> DetectionEvent:
        """Create a new detection event."""
        event = DetectionEvent(**event_data.model_dump())
        self.db.add(event)
        self.db.commit()
        self.db.refresh(event)
        return event

    def get_by_id(self, event_id: int) -> Optional[DetectionEvent]:
        """Get detection event by ID."""
        return self.db.query(DetectionEvent).filter(DetectionEvent.id == event_id).one_or_none()

    def get_with_details(self, event_id: int) -> Optional[DetectionEventWithDetails]:
        """Get detection event with camera and zone details."""
        event = self.get_by_id(event_id)
        if not event:
            return None

        camera = self.db.query(Camera).filter(Camera.id == event.camera_id).first()
        zone = self.db.query(Zone).filter(Zone.id == event.zone_id).first() if event.zone_id else None

        return DetectionEventWithDetails(
            **event.__dict__,
            camera_name=camera.camera_name if camera else None,
            zone_name=zone.zone_name if zone else None,
        )

    def get_all(
        self,
        params: PaginationParams,
        camera_id: Optional[int] = None,
        zone_id: Optional[int] = None,
        review_status: Optional[ReviewStatus] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        min_confidence: Optional[float] = None,
        search: Optional[str] = None,
        sort_by: str = "start_time",
        sort_order: str = "desc",
    ) -> PaginatedResponse[DetectionEventWithDetails]:
        """Get all detection events with filters and pagination."""
        query = self.db.query(DetectionEvent)

        # Apply filters
        if camera_id:
            query = query.filter(DetectionEvent.camera_id == camera_id)
        if zone_id:
            query = query.filter(DetectionEvent.zone_id == zone_id)
        if review_status:
            query = query.filter(DetectionEvent.review_status == review_status)
        if start_date:
            query = query.filter(DetectionEvent.start_time >= start_date)
        if end_date:
            query = query.filter(DetectionEvent.start_time <= end_date)
        if min_confidence:
            query = query.filter(DetectionEvent.confidence >= min_confidence)
        if search:
            query = query.join(Camera, Camera.id == DetectionEvent.camera_id).filter(
                Camera.camera_name.ilike(f"%{search}%")
            )

        # Get total count
        total = query.count()

        # Apply pagination and ordering
        order_column = (
            DetectionEvent.duration_seconds if sort_by == "duration" else DetectionEvent.start_time
        )
        order_clause = desc(order_column) if sort_order.lower() != "asc" else asc(order_column)
        events = query.order_by(order_clause).offset(
            (params.page - 1) * params.page_size
        ).limit(params.page_size).all()

        # Build response with details
        items = []
        for event in events:
            camera = self.db.query(Camera).filter(Camera.id == event.camera_id).first()
            zone = self.db.query(Zone).filter(Zone.id == event.zone_id).first() if event.zone_id else None

            items.append(DetectionEventWithDetails(
                **event.__dict__,
                camera_name=camera.camera_name if camera else None,
                zone_name=zone.zone_name if zone else None,
            ))

        total_pages = (total + params.page_size - 1) // params.page_size

        return PaginatedResponse(
            items=items,
            total=total,
            page=params.page,
            page_size=params.page_size,
            total_pages=total_pages,
        )

    def update(self, event_id: int, event_data: DetectionEventUpdate) -> Optional[DetectionEvent]:
        """Update a detection event."""
        event = self.get_by_id(event_id)
        if not event:
            return None

        update_data = event_data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(event, field, value)

        # Calculate duration if end_time is set
        if "end_time" in update_data and event.end_time and event.start_time:
            event.duration_seconds = round(
                (event.end_time - event.start_time).total_seconds(), 2
            )

        self.db.commit()
        self.db.refresh(event)
        return event

    def update_review_status(self, event_id: int, status: ReviewStatus) -> Optional[DetectionEvent]:
        """Update review status of a detection event."""
        return self.update(event_id, DetectionEventUpdate(review_status=status))

    def delete(self, event_id: int) -> bool:
        """Delete a detection event."""
        event = self.get_by_id(event_id)
        if not event:
            return False

        self.db.delete(event)
        self.db.commit()
        return True

    def get_stats(self) -> DetectionStatsResponse:
        """Get detection statistics."""
        now = datetime.utcnow()
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        week_start = today_start - timedelta(days=now.weekday())
        month_start = today_start.replace(day=1)

        total = self.db.query(DetectionEvent).count()
        today = self.db.query(DetectionEvent).filter(DetectionEvent.start_time >= today_start).count()
        this_week = self.db.query(DetectionEvent).filter(DetectionEvent.start_time >= week_start).count()
        this_month = self.db.query(DetectionEvent).filter(DetectionEvent.start_time >= month_start).count()

        pending = self.db.query(DetectionEvent).filter(DetectionEvent.review_status == ReviewStatus.PENDING).count()
        confirmed = self.db.query(DetectionEvent).filter(DetectionEvent.review_status == ReviewStatus.CONFIRMED).count()
        false_positives = self.db.query(DetectionEvent).filter(DetectionEvent.review_status == ReviewStatus.FALSE_POSITIVE).count()

        avg_confidence = self.db.query(func.avg(DetectionEvent.confidence)).scalar() or 0.0
        avg_duration = self.db.query(func.avg(DetectionEvent.duration_seconds)).scalar() or 0.0

        # Top zones by detection count
        top_zones_query = self.db.query(
            Zone.zone_name,
            func.count(DetectionEvent.id).label('count')
        ).join(DetectionEvent, Zone.id == DetectionEvent.zone_id).group_by(Zone.id).order_by(desc('count')).limit(10).all()
        top_zones = [{"zone_name": z.zone_name, "count": z.count} for z in top_zones_query]

        # Top cameras by detection count
        top_cameras_query = self.db.query(
            Camera.camera_name,
            func.count(DetectionEvent.id).label('count')
        ).join(DetectionEvent, Camera.id == DetectionEvent.camera_id).group_by(Camera.id).order_by(desc('count')).limit(10).all()
        top_cameras = [{"camera_name": c.camera_name, "count": c.count} for c in top_cameras_query]

        # Detections by hour (last 24 hours)
        detections_by_hour = []
        for hour in range(24):
            hour_start = today_start + timedelta(hours=hour)
            hour_end = hour_start + timedelta(hours=1)
            count = self.db.query(DetectionEvent).filter(
                DetectionEvent.start_time >= hour_start,
                DetectionEvent.start_time < hour_end
            ).count()
            detections_by_hour.append({"hour": hour, "count": count})

        # Detections by day (last 30 days)
        detections_by_day = []
        for day in range(30):
            day_start = today_start - timedelta(days=day)
            day_end = day_start + timedelta(days=1)
            count = self.db.query(DetectionEvent).filter(
                DetectionEvent.start_time >= day_start,
                DetectionEvent.start_time < day_end
            ).count()
            detections_by_day.append({"date": day_start.date().isoformat(), "count": count})
        detections_by_day.reverse()

        return DetectionStatsResponse(
            total_detections=total,
            detections_today=today,
            detections_this_week=this_week,
            detections_this_month=this_month,
            pending_reviews=pending,
            confirmed_detections=confirmed,
            false_positives=false_positives,
            avg_confidence=round(float(avg_confidence), 4),
            avg_duration_seconds=round(float(avg_duration), 2),
            top_zones=top_zones,
            top_cameras=top_cameras,
            detections_by_hour=detections_by_hour,
            detections_by_day=detections_by_day,
        )

    def export_to_csv(self, params: DetectionExportParams) -> str:
        """Export detection events to CSV."""
        query = self.db.query(DetectionEvent)

        if params.camera_id:
            query = query.filter(DetectionEvent.camera_id == params.camera_id)
        if params.zone_id:
            query = query.filter(DetectionEvent.zone_id == params.zone_id)
        if params.review_status:
            query = query.filter(DetectionEvent.review_status == params.review_status)
        if params.start_date:
            query = query.filter(DetectionEvent.start_time >= params.start_date)
        if params.end_date:
            query = query.filter(DetectionEvent.start_time <= params.end_date)
        if params.min_confidence:
            query = query.filter(DetectionEvent.confidence >= params.min_confidence)

        events = query.order_by(desc(DetectionEvent.start_time)).all()

        output = io.StringIO()
        writer = csv.writer(output)

        # Header
        writer.writerow([
            'ID', 'Camera ID', 'Camera Name', 'Zone ID', 'Zone Name',
            'Detected Object', 'Confidence', 'Start Time', 'End Time',
            'Duration (seconds)', 'Snapshot Path', 'Review Status', 'Created At'
        ])

        # Data
        for event in events:
            camera = self.db.query(Camera).filter(Camera.id == event.camera_id).first()
            zone = self.db.query(Zone).filter(Zone.id == event.zone_id).first() if event.zone_id else None

            writer.writerow([
                event.id,
                event.camera_id,
                camera.camera_name if camera else '',
                event.zone_id or '',
                zone.zone_name if zone else '',
                event.detected_object,
                event.confidence,
                event.start_time.isoformat() if event.start_time else '',
                event.end_time.isoformat() if event.end_time else '',
                event.duration_seconds or '',
                event.snapshot_path or '',
                event.review_status.value,
                event.created_at.isoformat() if event.created_at else '',
            ])

        return output.getvalue()