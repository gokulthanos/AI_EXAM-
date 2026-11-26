"""Camera Manager for handling camera connections and frame capture."""
import cv2
import threading
import time
import logging
from typing import Optional, Dict, Any, Callable, List
from dataclasses import dataclass
from datetime import datetime
from enum import Enum
import queue
import numpy as np

from app.configuration.settings import settings
from app.models.camera import CameraStatus

logger = logging.getLogger(__name__)


class CameraConnectionState(Enum):
    """Camera connection state."""
    DISCONNECTED = "disconnected"
    CONNECTING = "connecting"
    CONNECTED = "connected"
    ERROR = "error"


@dataclass
class CameraInfo:
    """Camera information and state."""
    camera_id: int
    camera_name: str
    camera_source: str
    zone_id: Optional[int]
    status: CameraStatus
    connection_state: CameraConnectionState = CameraConnectionState.DISCONNECTED
    cap: Optional[cv2.VideoCapture] = None
    frame_queue: queue.Queue = None
    capture_thread: Optional[threading.Thread] = None
    processing_thread: Optional[threading.Thread] = None
    is_monitoring: bool = False
    current_fps: float = 0.0
    last_frame_time: Optional[datetime] = None
    last_frame: Optional[np.ndarray] = None
    error_message: Optional[str] = None
    frame_count: int = 0
    dropped_frames: int = 0

    def __post_init__(self):
        if self.frame_queue is None:
            self.frame_queue = queue.Queue(maxsize=settings.camera_buffer_size)


class CameraManager:
    """Manages camera connections, frame capture, and processing."""

    def __init__(self):
        self._cameras: Dict[int, CameraInfo] = {}
        self._lock = threading.RLock()
        self._frame_callbacks: Dict[int, List[Callable[[int, np.ndarray], None]]] = {}
        self._stop_events: Dict[int, threading.Event] = {}

    def add_camera(
        self,
        camera_id: int,
        camera_name: str,
        camera_source: str,
        zone_id: Optional[int] = None,
    ) -> CameraInfo:
        """Add a camera to the manager."""
        with self._lock:
            if camera_id in self._cameras:
                logger.warning(f"Camera {camera_id} already exists, updating...")
                self.remove_camera(camera_id)

            camera_info = CameraInfo(
                camera_id=camera_id,
                camera_name=camera_name,
                camera_source=camera_source,
                zone_id=zone_id,
                status=CameraStatus.INACTIVE,
            )
            self._cameras[camera_id] = camera_info
            self._frame_callbacks[camera_id] = []
            self._stop_events[camera_id] = threading.Event()

            logger.info(f"Added camera: {camera_name} (ID: {camera_id}, Source: {camera_source})")
            return camera_info

    def remove_camera(self, camera_id: int) -> bool:
        """Remove a camera from the manager."""
        with self._lock:
            if camera_id not in self._cameras:
                return False

            # Stop monitoring if active
            self.stop_monitoring(camera_id)

            # Disconnect
            self.disconnect_camera(camera_id)

            # Clean up
            del self._cameras[camera_id]
            del self._frame_callbacks[camera_id]
            del self._stop_events[camera_id]

            logger.info(f"Removed camera ID: {camera_id}")
            return True

    def get_camera(self, camera_id: int) -> Optional[CameraInfo]:
        """Get camera info by ID."""
        with self._lock:
            return self._cameras.get(camera_id)

    def get_all_cameras(self) -> List[CameraInfo]:
        """Get all cameras."""
        with self._lock:
            return list(self._cameras.values())

    def _parse_source(self, source: str) -> Any:
        """Parse camera source string to appropriate OpenCV input."""
        # Try as integer (device index)
        try:
            return int(source)
        except ValueError:
            pass

        # Return as string (RTSP, HTTP, file path)
        return source

    def connect_camera(self, camera_id: int) -> bool:
        """Connect to a camera."""
        with self._lock:
            camera = self._cameras.get(camera_id)
            if not camera:
                logger.error(f"Camera {camera_id} not found")
                return False

            if camera.connection_state == CameraConnectionState.CONNECTED:
                logger.warning(f"Camera {camera_id} already connected")
                return True

            camera.connection_state = CameraConnectionState.CONNECTING
            camera.error_message = None

            try:
                source = self._parse_source(camera.camera_source)
                cap = cv2.VideoCapture(source)

                if not cap.isOpened():
                    raise RuntimeError(f"Failed to open camera source: {camera.camera_source}")

                # Set camera properties
                cap.set(cv2.CAP_PROP_FRAME_WIDTH, settings.camera_frame_width)
                cap.set(cv2.CAP_PROP_FRAME_HEIGHT, settings.camera_frame_height)
                cap.set(cv2.CAP_PROP_FPS, settings.camera_fps)
                cap.set(cv2.CAP_PROP_BUFFERSIZE, settings.camera_buffer_size)

                # Test read
                ret, frame = cap.read()
                if not ret:
                    cap.release()
                    raise RuntimeError("Failed to read initial frame")

                camera.cap = cap
                camera.connection_state = CameraConnectionState.CONNECTED
                camera.status = CameraStatus.ACTIVE
                camera.error_message = None

                logger.info(f"Camera {camera_id} connected successfully")
                return True

            except Exception as e:
                camera.connection_state = CameraConnectionState.ERROR
                camera.status = CameraStatus.ERROR
                camera.error_message = str(e)
                logger.error(f"Failed to connect camera {camera_id}: {e}")
                return False

    def disconnect_camera(self, camera_id: int) -> bool:
        """Disconnect a camera."""
        with self._lock:
            camera = self._cameras.get(camera_id)
            if not camera:
                return False

            # Stop monitoring first
            if camera.is_monitoring:
                self.stop_monitoring(camera_id)

            # Release capture
            if camera.cap:
                camera.cap.release()
                camera.cap = None

            camera.connection_state = CameraConnectionState.DISCONNECTED
            camera.status = CameraStatus.INACTIVE
            camera.last_frame = None
            camera.current_fps = 0.0

            logger.info(f"Camera {camera_id} disconnected")
            return True

    def start_monitoring(
        self,
        camera_id: int,
        frame_callback: Optional[Callable[[int, np.ndarray], None]] = None,
    ) -> bool:
        """Start monitoring a camera (capture frames continuously)."""
        with self._lock:
            camera = self._cameras.get(camera_id)
            if not camera:
                logger.error(f"Camera {camera_id} not found")
                return False

            if not camera.cap or camera.connection_state != CameraConnectionState.CONNECTED:
                logger.error(f"Camera {camera_id} not connected")
                return False

            if camera.is_monitoring:
                logger.warning(f"Camera {camera_id} already monitoring")
                return True

            # Register callback if provided
            if frame_callback:
                self._frame_callbacks[camera_id].append(frame_callback)

            # Reset stop event
            self._stop_events[camera_id].clear()

            # Start capture thread
            camera.is_monitoring = True
            camera.capture_thread = threading.Thread(
                target=self._capture_loop,
                args=(camera_id,),
                daemon=True,
                name=f"CameraCapture-{camera_id}",
            )
            camera.capture_thread.start()

            logger.info(f"Started monitoring camera {camera_id}")
            return True

    def stop_monitoring(self, camera_id: int) -> bool:
        """Stop monitoring a camera."""
        with self._lock:
            camera = self._cameras.get(camera_id)
            if not camera:
                return False

            if not camera.is_monitoring:
                return True

            # Signal stop
            self._stop_events[camera_id].set()

            # Wait for threads to finish
            if camera.capture_thread and camera.capture_thread.is_alive():
                camera.capture_thread.join(timeout=2.0)

            if camera.processing_thread and camera.processing_thread.is_alive():
                camera.processing_thread.join(timeout=2.0)

            camera.is_monitoring = False
            camera.capture_thread = None
            camera.processing_thread = None
            camera.current_fps = 0.0

            logger.info(f"Stopped monitoring camera {camera_id}")
            return True

    def _capture_loop(self, camera_id: int) -> None:
        """Main capture loop running in separate thread."""
        camera = self._cameras.get(camera_id)
        if not camera or not camera.cap:
            return

        stop_event = self._stop_events[camera_id]
        frame_times = []

        while not stop_event.is_set():
            try:
                ret, frame = camera.cap.read()

                if not ret:
                    logger.warning(f"Camera {camera_id}: Failed to read frame")
                    camera.dropped_frames += 1
                    time.sleep(0.01)
                    continue

                current_time = time.time()
                camera.last_frame = frame.copy()
                camera.last_frame_time = datetime.now()
                camera.frame_count += 1

                # Calculate FPS
                frame_times.append(current_time)
                frame_times = [t for t in frame_times if current_time - t < 1.0]
                camera.current_fps = len(frame_times)

                # Put frame in queue (non-blocking, drop if full)
                try:
                    camera.frame_queue.put_nowait((frame.copy(), current_time))
                except queue.Full:
                    try:
                        camera.frame_queue.get_nowait()  # Drop oldest
                        camera.frame_queue.put_nowait((frame.copy(), current_time))
                    except queue.Empty:
                        pass
                    camera.dropped_frames += 1

                # Call frame callbacks
                for callback in self._frame_callbacks.get(camera_id, []):
                    try:
                        callback(camera_id, frame)
                    except Exception as e:
                        logger.error(f"Frame callback error for camera {camera_id}: {e}")

            except Exception as e:
                logger.error(f"Capture loop error for camera {camera_id}: {e}")
                camera.error_message = str(e)
                camera.connection_state = CameraConnectionState.ERROR
                camera.status = CameraStatus.ERROR
                break

    def get_latest_frame(self, camera_id: int) -> Optional[np.ndarray]:
        """Get the latest frame from a camera."""
        with self._lock:
            camera = self._cameras.get(camera_id)
            if camera and camera.last_frame is not None:
                return camera.last_frame.copy()
            return None

    def get_frame_from_queue(self, camera_id: int, timeout: float = 0.1) -> Optional[tuple]:
        """Get a frame from the camera's frame queue."""
        with self._lock:
            camera = self._cameras.get(camera_id)
            if not camera:
                return None

            try:
                return camera.frame_queue.get(timeout=timeout)
            except queue.Empty:
                return None

    def register_frame_callback(
        self,
        camera_id: int,
        callback: Callable[[int, np.ndarray], None],
    ) -> bool:
        """Register a callback for frame processing."""
        with self._lock:
            if camera_id not in self._cameras:
                return False
            self._frame_callbacks[camera_id].append(callback)
            return True

    def unregister_frame_callback(
        self,
        camera_id: int,
        callback: Callable[[int, np.ndarray], None],
    ) -> bool:
        """Unregister a frame callback."""
        with self._lock:
            if camera_id not in self._frame_callbacks:
                return False
            try:
                self._frame_callbacks[camera_id].remove(callback)
                return True
            except ValueError:
                return False

    def get_camera_status(self, camera_id: int) -> Optional[Dict[str, Any]]:
        """Get camera status information."""
        with self._lock:
            camera = self._cameras.get(camera_id)
            if not camera:
                return None

            return {
                "camera_id": camera.camera_id,
                "camera_name": camera.camera_name,
                "camera_source": camera.camera_source,
                "zone_id": camera.zone_id,
                "status": camera.status.value,
                "connection_state": camera.connection_state.value,
                "is_monitoring": camera.is_monitoring,
                "current_fps": round(camera.current_fps, 1),
                "last_frame_time": camera.last_frame_time.isoformat() if camera.last_frame_time else None,
                "frame_count": camera.frame_count,
                "dropped_frames": camera.dropped_frames,
                "error_message": camera.error_message,
            }

    def update_camera_status(self, camera_id: int, status: CameraStatus) -> bool:
        """Update camera status in database (placeholder for DB update)."""
        with self._lock:
            camera = self._cameras.get(camera_id)
            if not camera:
                return False
            camera.status = status
            return True


# Global camera manager instance
_camera_manager_instance: Optional[CameraManager] = None


def get_camera_manager() -> CameraManager:
    """Get or create global camera manager instance."""
    global _camera_manager_instance
    if _camera_manager_instance is None:
        _camera_manager_instance = CameraManager()
    return _camera_manager_instance