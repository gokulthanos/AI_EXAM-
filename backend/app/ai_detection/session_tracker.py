"""Detection Session Tracker for continuous detection logic."""
import time
import uuid
from typing import Optional, List, Dict, Any
from dataclasses import dataclass, field
from datetime import datetime
import threading
import logging

from app.configuration.settings import settings
from app.ai_detection.yolo_detector import Detection

logger = logging.getLogger(__name__)


@dataclass
class ActiveDetectionSession:
    """Represents an active detection session for a continuous phone detection."""
    session_id: str
    camera_id: int
    zone_id: Optional[int]
    first_detection_time: float  # Unix timestamp
    last_detection_time: float
    max_confidence: float
    detection_count: int
    last_bbox: Optional[tuple] = None
    snapshots: List[str] = field(default_factory=list)
    is_active: bool = True

    @property
    def duration_seconds(self) -> float:
        return self.last_detection_time - self.first_detection_time

    @property
    def start_datetime(self) -> datetime:
        return datetime.fromtimestamp(self.first_detection_time)

    @property
    def end_datetime(self) -> datetime:
        return datetime.fromtimestamp(self.last_detection_time)


class DetectionSessionTracker:
    """
    Tracks continuous mobile phone detections to avoid duplicate events.

    When a phone is detected continuously, it maintains a single session.
    When the phone disappears for longer than the interruption tolerance,
    the session ends and a detection event is created.
    """

    def __init__(
        self,
        interruption_tolerance: Optional[float] = None,
        min_duration: Optional[float] = None,
    ):
        """
        Initialize the session tracker.

        Args:
            interruption_tolerance: Max seconds of no detection before ending session
            min_duration: Minimum session duration to save as event
        """
        self.interruption_tolerance = interruption_tolerance or settings.detection_interruption_tolerance_seconds
        self.min_duration = min_duration or settings.detection_min_duration_seconds

        # Active sessions per camera
        self._sessions: Dict[int, ActiveDetectionSession] = {}
        self._lock = threading.RLock()

        # Callbacks
        self.on_session_start: Optional[callable] = None
        self.on_session_update: Optional[callable] = None
        self.on_session_end: Optional[callable] = None

    def process_detections(
        self,
        camera_id: int,
        zone_id: Optional[int],
        detections: List[Detection],
        timestamp: Optional[float] = None,
    ) -> List[ActiveDetectionSession]:
        """
        Process new detections and update sessions.

        Args:
            camera_id: Camera ID
            zone_id: Zone ID
            detections: List of current frame detections
            timestamp: Current timestamp (defaults to now)

        Returns:
            List of ended sessions (ready to be saved as events)
        """
        if timestamp is None:
            timestamp = time.time()

        ended_sessions = []

        with self._lock:
            # Filter only phone detections (should already be filtered by detector)
            phone_detections = [d for d in detections if d.class_id == settings.detection_target_class_id]

            if phone_detections:
                # Phone detected - update or create session
                best_detection = max(phone_detections, key=lambda d: d.confidence)
                session = self._update_or_create_session(
                    camera_id, zone_id, best_detection, timestamp
                )
                if session:
                    if self.on_session_update:
                        self.on_session_update(session)
            else:
                # No phone detected - check for session timeout
                if camera_id in self._sessions:
                    session = self._sessions[camera_id]
                    time_since_last = timestamp - session.last_detection_time

                    if time_since_last > self.interruption_tolerance:
                        # Session ended
                        ended_session = self._end_session(camera_id, timestamp)
                        if ended_session and ended_session.duration_seconds >= self.min_duration:
                            ended_sessions.append(ended_session)
                            if self.on_session_end:
                                self.on_session_end(ended_session)

        return ended_sessions

    def _update_or_create_session(
        self,
        camera_id: int,
        zone_id: Optional[int],
        detection: Detection,
        timestamp: float,
    ) -> Optional[ActiveDetectionSession]:
        """Update existing session or create new one."""
        with self._lock:
            if camera_id in self._sessions:
                # Update existing session
                session = self._sessions[camera_id]
                session.last_detection_time = timestamp
                session.max_confidence = max(session.max_confidence, detection.confidence)
                session.detection_count += 1
                session.last_bbox = detection.bbox
                return session
            else:
                # Create new session
                session = ActiveDetectionSession(
                    session_id=str(uuid.uuid4())[:8],
                    camera_id=camera_id,
                    zone_id=zone_id,
                    first_detection_time=timestamp,
                    last_detection_time=timestamp,
                    max_confidence=detection.confidence,
                    detection_count=1,
                    last_bbox=detection.bbox,
                )
                self._sessions[camera_id] = session

                if self.on_session_start:
                    self.on_session_start(session)

                return session

    def _end_session(self, camera_id: int, timestamp: float) -> Optional[ActiveDetectionSession]:
        """End a session and remove from active sessions."""
        with self._lock:
            session = self._sessions.pop(camera_id, None)
            if session:
                session.is_active = False
                session.last_detection_time = timestamp
            return session

    def get_active_session(self, camera_id: int) -> Optional[ActiveDetectionSession]:
        """Get active session for a camera."""
        with self._lock:
            return self._sessions.get(camera_id)

    def get_all_active_sessions(self) -> List[ActiveDetectionSession]:
        """Get all active sessions."""
        with self._lock:
            return list(self._sessions.values())

    def force_end_session(self, camera_id: int) -> Optional[ActiveDetectionSession]:
        """Force end a session (e.g., when camera stops)."""
        with self._lock:
            session = self._sessions.pop(camera_id, None)
            if session:
                session.is_active = False
                session.last_detection_time = time.time()
                if session.duration_seconds >= self.min_duration:
                    if self.on_session_end:
                        self.on_session_end(session)
                    return session
            return None

    def clear_all_sessions(self) -> List[ActiveDetectionSession]:
        """Clear all sessions (e.g., on shutdown)."""
        with self._lock:
            sessions = list(self._sessions.values())
            for session in sessions:
                session.is_active = False
                session.last_detection_time = time.time()
            self._sessions.clear()
            return sessions


# Global tracker instance
_tracker_instance: Optional[DetectionSessionTracker] = None


def get_tracker() -> DetectionSessionTracker:
    """Get or create global tracker instance."""
    global _tracker_instance
    if _tracker_instance is None:
        _tracker_instance = DetectionSessionTracker()
    return _tracker_instance