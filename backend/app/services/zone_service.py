"""Zone CRUD Service."""
from typing import Optional, List
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import func, desc

from app.models.zone import Zone
from app.models.camera import Camera
from app.models.detection_event import DetectionEvent
from app.schemas.zone import ZoneCreate, ZoneUpdate, ZoneResponse, ZoneWithStats


class ZoneService:
    """Service for zone operations."""

    def __init__(self, db: Session):
        self.db = db

    def create(self, zone_data: ZoneCreate) -> Zone:
        """Create a new zone."""
        zone = Zone(
            zone_name=zone_data.zone_name,
            zone_description=zone_data.zone_description,
        )
        self.db.add(zone)
        self.db.commit()
        self.db.refresh(zone)
        return zone

    def get_by_id(self, zone_id: int) -> Optional[Zone]:
        """Get zone by ID."""
        return self.db.query(Zone).filter(Zone.id == zone_id).one_or_none()

    def get_by_name(self, zone_name: str) -> Optional[Zone]:
        """Get zone by name."""
        return self.db.query(Zone).filter(Zone.zone_name == zone_name).first()

    def get_all(
        self,
        skip: int = 0,
        limit: int = 100,
        search: Optional[str] = None,
    ) -> List[Zone]:
        """Get all zones with optional search."""
        query = self.db.query(Zone)
        if search:
            query = query.filter(Zone.zone_name.ilike(f"%{search}%"))
        return query.order_by(Zone.created_at.desc()).offset(skip).limit(limit).all()

    def get_count(self, search: Optional[str] = None) -> int:
        """Get total zone count."""
        query = self.db.query(Zone)
        if search:
            query = query.filter(Zone.zone_name.ilike(f"%{search}%"))
        return query.count()

    def update(self, zone_id: int, zone_data: ZoneUpdate) -> Optional[Zone]:
        """Update a zone."""
        zone = self.get_by_id(zone_id)
        if not zone:
            return None

        update_data = zone_data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(zone, field, value)

        self.db.commit()
        self.db.refresh(zone)
        return zone

    def delete(self, zone_id: int) -> bool:
        """Delete a zone."""
        zone = self.get_by_id(zone_id)
        if not zone:
            return False

        self.db.delete(zone)
        self.db.commit()
        return True

    def get_with_stats(self, zone_id: int) -> Optional[ZoneWithStats]:
        """Get zone with camera and detection statistics."""
        zone = self.get_by_id(zone_id)
        if not zone:
            return None

        camera_count = self.db.query(Camera).filter(Camera.zone_id == zone_id).count()
        active_camera_count = self.db.query(Camera).filter(
            Camera.zone_id == zone_id,
            Camera.status == "active"
        ).count()
        total_detections = self.db.query(DetectionEvent).filter(
            DetectionEvent.zone_id == zone_id
        ).count()
        pending_reviews = self.db.query(DetectionEvent).filter(
            DetectionEvent.zone_id == zone_id,
            DetectionEvent.review_status == "pending"
        ).count()

        return ZoneWithStats(
            id=zone.id,
            zone_name=zone.zone_name,
            zone_description=zone.zone_description,
            created_at=zone.created_at,
            camera_count=camera_count,
            active_camera_count=active_camera_count,
            total_detections=total_detections,
            pending_reviews=pending_reviews,
        )

    def get_all_with_stats(self) -> List[ZoneWithStats]:
        """Get all zones with statistics."""
        zones = self.get_all()
        result = []
        for zone in zones:
            stats = self.get_with_stats(zone.id)
            if stats:
                result.append(stats)
        return result