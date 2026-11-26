"""Detection Service - Core business logic for phone detection."""
import cv2
import time
import threading
import logging
import base64
import numpy as np
from typing import Optional, List, Dict, Any, Callable
from datetime import datetime
from pathlib import Path
import uuid

from sqlalchemy.orm import Session

from app.configuration.settings import settings
from app.database.connection import get_db_context
from app.ai_detection.yolo_detector import get_detector, YOLOPhoneDetector, Detection
from app.ai_detection.session_tracker import get_tracker, DetectionSessionTracker, ActiveDetectionSession
from app.camera_processing.camera_manager import get_camera_manager, CameraManager, CameraInfo
from app.models.detection_event import DetectionEvent, ReviewStatus
from app.models.camera import Camera, CameraStatus
from app.models.zone import Zone

logger = logging.getLogger(__name__)


class DetectionService:
    """Main service coordinating detection pipeline."""

    def __init__(
        self,
        detector: Optional[YOLOPhoneDetector] = None,
        tracker: Optional[DetectionSessionTracker] = None,
        camera_manager: Optional[CameraManager] = None,
    ):
        self.detector = detector or get_detector()
        self.tracker = tracker or get_tracker()
        self.camera_manager = camera_manager or get_camera_manager()

        # Set up tracker callbacks
        self.tracker.on_session_start = self._on_session_start
        self.tracker.on_session_update = self._on_session_update
        self.tracker.on_session_end = self._on_session_end

        # WebSocket broadcast callback
        self.websocket_broadcast: Optional[Callable[[Dict[str, Any]], None]] = None

        # Snapshot saving
        self._snapshot_dir = Path(settings.detection_snapshot_dir)
        self._snapshot_dir.mkdir(parents=True, exist_ok=True)

    def set_websocket_broadcast(self, callback: Callable[[Dict[str, Any]], None]) -> None:
        """Set WebSocket broadcast callback."""
        self.websocket_broadcast = callback

    def _on_session_start(self, session: ActiveDetectionSession) -> None:
        """Callback when a new detection session starts."""
        logger.info(f"Detection session started: {session.session_id} on camera {session.camera_id}")
        self._broadcast_detection_alert(session, "started")

    def _on_session_update(self, session: ActiveDetectionSession) -> None:
        """Callback when a detection session updates."""
        self._broadcast_detection_alert(session, "updated")

    def _on_session_end(self, session: ActiveDetectionSession) -> None:
        """Callback when a detection session ends - save to database."""
        logger.info(f"Detection session ended: {session.session_id}, duration: {session.duration_seconds:.1f}s")
        self._save_detection_event(session)
        self._broadcast_detection_alert(session, "ended")

    def _broadcast_detection_alert(self, session: ActiveDetectionSession, event_type: str) -> None:
        """Broadcast detection alert via WebSocket."""
        if self.websocket_broadcast:
            try:
                alert_data = {
                    "type": "detection_alert",
                    "event_type": event_type,
                    "session_id": session.session_id,
                    "camera_id": session.camera_id,
                    "zone_id": session.zone_id,
                    "confidence": session.max_confidence,
                    "duration_seconds": round(session.duration_seconds, 1),
                    "detection_count": session.detection_count,
                    "last_bbox": session.last_bbox,
                    "timestamp": datetime.now().isoformat(),
                }
                self.websocket_broadcast(alert_data)
            except Exception as e:
                logger.error(f"WebSocket broadcast error: {e}")

    def _save_detection_event(self, session: ActiveDetectionSession) -> Optional[DetectionEvent]:
        """Save completed detection session to database."""
        try:
            with get_db_context() as db:
                # Get camera and zone info
                camera = db.query(Camera).filter(Camera.id == session.camera_id).first()
                zone = db.query(Zone).filter(Zone.id == session.zone_id).first() if session.zone_id else None

                # Save snapshot if available
                snapshot_path = None
                if settings.detection_snapshot_enabled and session.snapshots:
                    snapshot_path = session.snapshots[-1]  # Use last snapshot

                event = DetectionEvent(
                    camera_id=session.camera_id,
                    zone_id=session.zone_id,
                    detected_object=settings.detection_target_class_name,
                    confidence=session.max_confidence,
                    start_time=session.start_datetime,
                    end_time=session.end_datetime,
                    duration_seconds=round(session.duration_seconds, 2),
                    snapshot_path=snapshot_path,
                    review_status=ReviewStatus.PENDING,
                )

                db.add(event)
                db.commit()
                db.refresh(event)

                logger.info(f"Saved detection event ID: {event.id}")
                return event

        except Exception as e:
            logger.error(f"Failed to save detection event: {e}")
            return None

    def process_frame(self, camera_id: int, frame: np.ndarray) -> List[Detection]:
        """
        Process a single frame for detection.

        Args:
            camera_id: Camera ID
            frame: Input frame (BGR numpy array)

        Returns:
            List of phone detections
        """
        # Get camera info for zone_id
        camera_info = self.camera_manager.get_camera(camera_id)
        zone_id = camera_info.zone_id if camera_info else None

        # Run detection
        detections = self.detector.detect(frame)

        # Process through session tracker
        ended_sessions = self.tracker.process_detections(
            camera_id=camera_id,
            zone_id=zone_id,
            detections=detections,
            timestamp=time.time(),
        )

        # Save snapshots for active session
        if detections and settings.detection_snapshot_enabled:
            active_session = self.tracker.get_active_session(camera_id)
            if active_session:
                self._save_snapshot(frame, detections[0], active_session)

        return detections

    def _save_snapshot(self, frame: np.ndarray, detection: Detection, session: ActiveDetectionSession) -> None:
        """Save detection snapshot with bounding box."""
        try:
            # Draw detection on frame
            annotated_frame = self.detector.draw_detections(frame, [detection])

            # Generate filename
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
            filename = f"detection_{session.session_id}_{timestamp}.jpg"
            filepath = self._snapshot_dir / filename

            # Save image
            cv2.imwrite(str(filepath), annotated_frame)

            # Add to session snapshots (keep last 5)
            session.snapshots.append(str(filepath))
            if len(session.snapshots) > 5:
                # Remove old snapshot file
                old_path = session.snapshots.pop(0)
                try:
                    Path(old_path).unlink(missing_ok=True)
                except Exception:
                    pass

        except Exception as e:
            logger.error(f"Failed to save snapshot: {e}")

    def get_active_detections(self) -> List[Dict[str, Any]]:
        """Get all currently active detection sessions."""
        sessions = self.tracker.get_all_active_sessions()
        return [
            {
                "session_id": s.session_id,
                "camera_id": s.camera_id,
                "zone_id": s.zone_id,
                "start_time": s.start_datetime.isoformat(),
                "duration_seconds": round(s.duration_seconds, 1),
                "max_confidence": round(s.max_confidence, 4),
                "detection_count": s.detection_count,
                "last_bbox": s.last_bbox,
            }
            for s in sessions
        ]

    def get_camera_detection_status(self, camera_id: int) -> Optional[Dict[str, Any]]:
        """Get detection status for a specific camera."""
        session = self.tracker.get_active_session(camera_id)
        if not session:
            return {
                "camera_id": camera_id,
                "has_active_detection": False,
                "session": None,
            }

        return {
            "camera_id": camera_id,
            "has_active_detection": True,
            "session": {
                "session_id": session.session_id,
                "start_time": session.start_datetime.isoformat(),
                "duration_seconds": round(session.duration_seconds, 1),
                "max_confidence": round(session.max_confidence, 4),
                "detection_count": session.detection_count,
                "last_bbox": session.last_bbox,
            },
        }

    def draw_detections_on_frame(
        self,
        frame: np.ndarray,
        detections: List[Detection],
    ) -> np.ndarray:
        """Draw detection boxes on frame for preview."""
        return self.detector.draw_detections(frame, detections)

    def encode_frame_base64(self, frame: np.ndarray, quality: int = 80) -> str:
        """Encode frame as base64 JPEG."""
        try:
            _, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, quality])
            return base64.b64encode(buffer).decode('utf-8')
        except Exception as e:
            logger.error(f"Frame encoding error: {e}")
            return ""

    def update_detector_confidence(self, threshold: float) -> None:
        """Update detector confidence threshold."""
        self.detector.update_confidence_threshold(threshold)

    def update_detector_iou(self, threshold: float) -> None:
        """Update detector IoU threshold."""
        self.detector.update_iou_threshold(threshold)

    def update_tracker_tolerance(self, tolerance: float) -> None:
        """Update tracker interruption tolerance."""
        self.tracker.interruption_tolerance = tolerance

    def update_tracker_min_duration(self, duration: float) -> None:
        """Update tracker minimum duration."""
        self.tracker.min_duration = duration

    def get_detector_info(self) -> Dict[str, Any]:
        """Get detector information."""
        return self.detector.get_model_info()

    def shutdown(self) -> None:
        """Shutdown detection service."""
        # End all active sessions
        sessions = self.tracker.clear_all_sessions()
        for session in sessions:
            if session.duration_seconds >= self.tracker.min_duration:
                self._save_detection_event(session)

        logger.info("Detection service shutdown complete")


# Global detection service instance
_detection_service_instance: Optional[DetectionService] = None


def get_detection_service() -> DetectionService:
    """Get or create global detection service instance."""
    global _detection_service_instance
    if _detection_service_instance is None:
        _detection_service_instance = DetectionService()
    return _detection_service_instance