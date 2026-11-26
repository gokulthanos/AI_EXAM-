"""Test script to verify backend components."""
import sys
import os

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

def test_imports():
    """Test all imports work correctly."""
    print("Testing imports...")

    # Configuration
    from app.configuration.settings import settings, get_settings
    print(f"[OK] Settings loaded: {settings.app_name}")

    # Database
    from app.database.connection import Base, engine, SessionLocal, init_database, get_db
    print("[OK] Database connection module loaded")

    # Models
    from app.models.zone import Zone
    from app.models.camera import Camera, CameraStatus
    from app.models.detection_event import DetectionEvent, ReviewStatus
    from app.models.user import User, UserRole
    print("[OK] All models loaded")

    # Schemas
    from app.schemas.zone import ZoneCreate, ZoneResponse
    from app.schemas.camera import CameraCreate, CameraResponse
    from app.schemas.detection_event import DetectionEventCreate, DetectionEventResponse
    from app.schemas.user import UserCreate, UserResponse
    print("[OK] All schemas loaded")

    # Services
    from app.services.zone_service import ZoneService
    from app.services.camera_service import CameraService
    from app.services.detection_event_service import DetectionEventService
    from app.services.detection_service import DetectionService, get_detection_service
    print("[OK] All services loaded")

    # AI Detection
    from app.ai_detection.yolo_detector import YOLOPhoneDetector, get_detector, Detection
    from app.ai_detection.session_tracker import DetectionSessionTracker, get_tracker, ActiveDetectionSession
    print("[OK] AI detection modules loaded")

    # Camera Processing
    from app.camera_processing.camera_manager import CameraManager, get_camera_manager, CameraInfo
    print("[OK] Camera processing modules loaded")

    # WebSocket
    from app.websocket.manager import ConnectionManager, get_connection_manager
    print("[OK] WebSocket modules loaded")

    # Routes
    from app.routes import zones, cameras, detection_events
    from app.websocket.routes import router as websocket_router
    print("[OK] All routes loaded")

    print("\n[OK] All imports successful!")
    return True


def test_database():
    """Test database initialization."""
    print("\nTesting database...")
    from app.database.connection import init_database, engine
    from app.models import zone, camera, detection_event, user  # noqa: F401

    try:
        init_database()
        print("[OK] Database tables created successfully")

        # Check tables
        from sqlalchemy import inspect
        inspector = inspect(engine)
        tables = inspector.get_table_names()
        print(f"[OK] Tables created: {tables}")

    except Exception as e:
        print(f"[FAIL] Database error: {e}")
        return False

    return True


def test_yolo_model():
    """Test YOLO model loading."""
    print("\nTesting YOLO model loading...")
    from app.ai_detection.yolo_detector import get_detector

    try:
        detector = get_detector()
        info = detector.get_model_info()
        print(f"[OK] Model loaded: {info['is_loaded']}")
        print(f"  Model path: {info['model_path']}")
        print(f"  Device: {info['device']}")
        print(f"  Target class: {info['target_class_id']} ({info['target_class_name']})")
        print(f"  Confidence threshold: {info['confidence_threshold']}")
        return info['is_loaded']
    except Exception as e:
        print(f"[FAIL] YOLO model error: {e}")
        return False


def test_camera_manager():
    """Test camera manager."""
    print("\nTesting camera manager...")
    from app.camera_processing.camera_manager import get_camera_manager

    try:
        manager = get_camera_manager()
        print("[OK] Camera manager initialized")
        return True
    except Exception as e:
        print(f"[FAIL] Camera manager error: {e}")
        return False


def test_detection_service():
    """Test detection service."""
    print("\nTesting detection service...")
    from app.services.detection_service import get_detection_service

    try:
        service = get_detection_service()
        print("[OK] Detection service initialized")
        info = service.get_detector_info()
        print(f"  Detector loaded: {info['is_loaded']}")
        return True
    except Exception as e:
        print(f"[FAIL] Detection service error: {e}")
        return False


def test_session_tracker():
    """Test session tracker."""
    print("\nTesting session tracker...")
    from app.ai_detection.session_tracker import get_tracker
    from app.ai_detection.yolo_detector import Detection

    try:
        tracker = get_tracker()
        print("[OK] Session tracker initialized")

        # Test session creation
        import time
        detections = [Detection(67, "cell phone", 0.85, (100, 100, 200, 200))]
        ended = tracker.process_detections(1, 1, detections, time.time())
        print(f"  Session created, ended sessions: {len(ended)}")

        active = tracker.get_active_session(1)
        print(f"  Active session: {active.session_id if active else None}")

        # Simulate phone disappearing
        time.sleep(0.1)
        ended = tracker.process_detections(1, 1, [], time.time() + 3)  # Beyond tolerance
        print(f"  After timeout, ended sessions: {len(ended)}")

        return True
    except Exception as e:
        print(f"[FAIL] Session tracker error: {e}")
        return False


def main():
    """Run all tests."""
    print("=" * 60)
    print("Smart Surveillance Backend - Component Tests")
    print("=" * 60)

    tests = [
        ("Imports", test_imports),
        ("Database", test_database),
        ("YOLO Model", test_yolo_model),
        ("Camera Manager", test_camera_manager),
        ("Detection Service", test_detection_service),
        ("Session Tracker", test_session_tracker),
    ]

    results = {}
    for name, test_func in tests:
        try:
            result = test_func()
            results[name] = result
        except Exception as e:
            print(f"[FAIL] {name} test failed with exception: {e}")
            results[name] = False

    print("\n" + "=" * 60)
    print("Test Results Summary:")
    print("=" * 60)
    all_passed = True
    for name, passed in results.items():
        status = "PASS" if passed else "FAIL"
        print(f"  {name}: {status}")
        if not passed:
            all_passed = False

    print("=" * 60)
    if all_passed:
        print("[OK] All tests passed!")
        return 0
    else:
        print("[FAIL] Some tests failed!")
        return 1


if __name__ == "__main__":
    sys.exit(main())