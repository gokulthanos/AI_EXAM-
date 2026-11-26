"""Camera CRUD Service."""
from datetime import datetime
from typing import Optional, List
from fastapi.encoders import jsonable_encoder
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.camera import Camera, CameraStatus
from app.models.zone import Zone
from app.models.detection_event import DetectionEvent
from app.schemas.camera import CameraCreate, CameraUpdate, CameraResponse, CameraStatusResponse
from app.camera_processing.camera_manager import get_camera_manager


class CameraService:
    """Service for camera operations."""

    def __init__(self, db: Session):
        self.db = db
        self.camera_manager = get_camera_manager()

    def create(self, camera_data: CameraCreate) -> Camera:
        """Create a new camera."""
        # Verify zone exists if provided
        if camera_data.zone_id:
            zone = self.db.query(Zone).filter(Zone.id == camera_data.zone_id).first()
            if not zone:
                raise ValueError(f"Zone with ID {camera_data.zone_id} not found")

        camera = Camera(
            camera_name=camera_data.camera_name,
            camera_source=camera_data.camera_source,
            zone_id=camera_data.zone_id,
            status=CameraStatus.INACTIVE,
        )
        self.db.add(camera)
        self.db.commit()
        self.db.refresh(camera)

        # Add to camera manager
        self.camera_manager.add_camera(
            camera_id=camera.id,
            camera_name=camera.camera_name,
            camera_source=camera.camera_source,
            zone_id=camera.zone_id,
        )

        return camera

    def get_by_id(self, camera_id: int) -> Optional[Camera]:
        """Get camera by ID."""
        return self.db.query(Camera).filter(Camera.id == camera_id).one_or_none()

    def get_all(
        self,
        skip: int = 0,
        limit: int = 100,
        zone_id: Optional[int] = None,
        status: Optional[CameraStatus] = None,
        search: Optional[str] = None,
    ) -> List[Camera]:
        """Get all cameras with optional filters."""
        query = self.db.query(Camera)
        if zone_id:
            query = query.filter(Camera.zone_id == zone_id)
        if status:
            query = query.filter(Camera.status == status)
        if search:
            query = query.filter(Camera.camera_name.ilike(f"%{search}%"))
        return query.order_by(Camera.created_at.desc()).offset(skip).limit(limit).all()

    def get_count(
        self,
        zone_id: Optional[int] = None,
        status: Optional[CameraStatus] = None,
        search: Optional[str] = None,
    ) -> int:
        """Get total camera count."""
        query = self.db.query(Camera)
        if zone_id:
            query = query.filter(Camera.zone_id == zone_id)
        if status:
            query = query.filter(Camera.status == status)
        if search:
            query = query.filter(Camera.camera_name.ilike(f"%{search}%"))
        return query.count()

    def update(self, camera_id: int, camera_data: CameraUpdate) -> Optional[Camera]:
        """Update a camera."""
        camera = self.get_by_id(camera_id)
        if not camera:
            return None

        update_data = camera_data.model_dump(exclude_unset=True)

        # Verify zone if being updated
        if "zone_id" in update_data and update_data["zone_id"]:
            zone = self.db.query(Zone).filter(Zone.id == update_data["zone_id"]).first()
            if not zone:
                raise ValueError(f"Zone with ID {update_data['zone_id']} not found")

        for field, value in update_data.items():
            setattr(camera, field, value)

        self.db.commit()
        self.db.refresh(camera)

        # Update camera manager
        cam_info = self.camera_manager.get_camera(camera_id)
        if cam_info:
            if "camera_name" in update_data:
                cam_info.camera_name = update_data["camera_name"]
            if "camera_source" in update_data:
                cam_info.camera_source = update_data["camera_source"]
            if "zone_id" in update_data:
                cam_info.zone_id = update_data["zone_id"]
            if "status" in update_data:
                cam_info.status = update_data["status"]

        return camera

    def delete(self, camera_id: int) -> bool:
        """Delete a camera."""
        camera = self.get_by_id(camera_id)
        if not camera:
            return False

        # Remove from camera manager
        self.camera_manager.remove_camera(camera_id)

        self.db.delete(camera)
        self.db.commit()
        return True

    def get_status(self, camera_id: int) -> Optional[CameraStatusResponse]:
        """Get camera status including real-time info."""
        camera = self.get_by_id(camera_id)
        if not camera:
            return None

        # Ensure camera has all required fields loaded
        camera_name = getattr(camera, 'camera_name', None) or f"Camera #{camera_id}"
        camera_status = getattr(camera, 'status', None) or CameraStatus.INACTIVE

        manager_status = self.camera_manager.get_camera_status(camera_id)

        return CameraStatusResponse(
            camera_id=camera.id,
            camera_name=camera_name,
            status=camera_status,
            is_monitoring=manager_status.get("is_monitoring", False) if manager_status else False,
            current_fps=manager_status.get("current_fps") if manager_status else None,
            last_frame_time=manager_status.get("last_frame_time") if manager_status else None,
            error_message=manager_status.get("error_message") if manager_status else None,
        )

    def connect_camera(self, camera_id: int) -> bool:
        """Connect to a camera."""
        camera = self.get_by_id(camera_id)
        if not camera:
            return False

        success = self.camera_manager.connect_camera(camera_id)
        if success:
            camera.status = CameraStatus.ACTIVE
            self.db.commit()
        else:
            camera.status = CameraStatus.ERROR
            self.db.commit()

        return success

    def disconnect_camera(self, camera_id: int) -> bool:
        """Disconnect a camera."""
        camera = self.get_by_id(camera_id)
        if not camera:
            return False

        success = self.camera_manager.disconnect_camera(camera_id)
        if success:
            camera.status = CameraStatus.INACTIVE
            self.db.commit()

        return success

    def start_monitoring(self, camera_id: int) -> bool:
        """Start monitoring a camera."""
        camera = self.get_by_id(camera_id)
        if not camera:
            return False

        # Ensure camera is connected
        cam_info = self.camera_manager.get_camera(camera_id)
        if not cam_info or cam_info.connection_state.value != "connected":
            if not self.connect_camera(camera_id):
                return False

        success = self.camera_manager.start_monitoring(camera_id)
        return success

    def stop_monitoring(self, camera_id: int) -> bool:
        """Stop monitoring a camera."""
        return self.camera_manager.stop_monitoring(camera_id)

    def get_preview_frame(self, camera_id: int) -> Optional[dict]:
        """Get a preview frame from camera with detections."""
        from app.services.detection_service import get_detection_service
        import cv2

        detection_service = get_detection_service()
        frame = self.camera_manager.get_latest_frame(camera_id)

        if frame is None:
            return None

        # Run detection
        detections = detection_service.process_frame(camera_id, frame)

        # Draw detections
        annotated_frame = detection_service.draw_detections_on_frame(frame, detections)

        # Encode as base64
        frame_base64 = detection_service.encode_frame_base64(annotated_frame)

        return {
            "camera_id": camera_id,
            "frame_base64": frame_base64,
            "timestamp": datetime.utcnow().isoformat(),
            "detections": [d.to_dict() for d in detections],
        }

    def get_all_with_status(self) -> List[dict]:
        """Get all cameras with their current status."""
        cameras = self.get_all()
        result = []
        for camera in cameras:
            status = self.get_status(camera.id)
            result.append({
                "camera": jsonable_encoder(CameraResponse.model_validate(camera)),
                "status": jsonable_encoder(status) if status else None,
            })
        return result