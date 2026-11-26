#!/usr/bin/env python3
"""
Mock Data Population Script for Smart Surveillance System.

This script populates the database with realistic mock data for end-to-end testing:
- Zones (examination halls, classrooms, library, etc.)
- Cameras (webcams, RTSP streams, HTTP streams)
- Detection events (with various review statuses)
- Users (admin, operator, viewer)

Run with: python populate_mock_data.py
"""

import sys
import os
from datetime import datetime, timedelta, timezone
import random
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent))

from app.database.connection import get_db_context, init_database
from app.models.zone import Zone
from app.models.camera import Camera, CameraStatus
from app.models.detection_event import DetectionEvent, ReviewStatus
from app.models.user import User, UserRole
from app.services.detection_service import get_detection_service

# Simple password hashing (for mock data only)
import hashlib
import secrets

def hash_password(password: str) -> str:
    """Simple hash for mock data - not for production use."""
    salt = secrets.token_hex(16)
    hash_obj = hashlib.sha256((salt + password).encode())
    return f"sha256${salt}${hash_obj.hexdigest()}"


def clear_database():
    """Clear all existing data."""
    print("Clearing existing data...")
    with get_db_context() as db:
        # Delete in order of dependencies
        db.query(DetectionEvent).delete()
        db.query(Camera).delete()
        db.query(Zone).delete()
        db.query(User).delete()
        db.commit()
    print("Database cleared.")


def create_mock_users():
    """Create mock users with different roles."""
    print("Creating mock users...")
    users = [
        {
            "username": "admin",
            "email": "admin@surveillance.local",
            "password": "admin123",
            "role": UserRole.ADMIN,
        },
        {
            "username": "operator1",
            "email": "operator1@surveillance.local",
            "password": "operator123",
            "role": UserRole.OPERATOR,
        },
        {
            "username": "operator2",
            "email": "operator2@surveillance.local",
            "password": "operator123",
            "role": UserRole.OPERATOR,
        },
        {
            "username": "viewer1",
            "email": "viewer1@surveillance.local",
            "password": "viewer123",
            "role": UserRole.VIEWER,
        },
        {
            "username": "security_officer",
            "email": "security@surveillance.local",
            "password": "security123",
            "role": UserRole.OPERATOR,
        },
    ]

    with get_db_context() as db:
        for user_data in users:
            user = User(
                username=user_data["username"],
                email=user_data["email"],
                hashed_password=hash_password(user_data["password"]),
                role=user_data["role"],
            )
            db.add(user)
        db.commit()
        print(f"Created {len(users)} users.")


def create_mock_zones():
    """Create mock zones for different restricted areas."""
    print("Creating mock zones...")
    zones = [
        {
            "zone_name": "Examination Hall A",
            "zone_description": "Main examination hall for 200 students. Ground floor, Block A.",
        },
        {
            "zone_name": "Examination Hall B",
            "zone_description": "Secondary examination hall for 150 students. First floor, Block A.",
        },
        {
            "zone_name": "Examination Hall C",
            "zone_description": "Computer-based exam hall. 50 workstations. Basement, Block B.",
        },
        {
            "zone_name": "Classroom 101",
            "zone_description": "Standard classroom, capacity 60. Ground floor, Block C.",
        },
        {
            "zone_name": "Classroom 102",
            "zone_description": "Standard classroom, capacity 60. Ground floor, Block C.",
        },
        {
            "zone_name": "Classroom 201",
            "zone_description": "Lecture hall, capacity 120. First floor, Block C.",
        },
        {
            "zone_name": "Classroom 202",
            "zone_description": "Lecture hall, capacity 120. First floor, Block C.",
        },
        {
            "zone_name": "Library - Reading Room",
            "zone_description": "Main reading room, silent zone. 200 seats. Ground floor, Library Building.",
        },
        {
            "zone_name": "Library - Reference Section",
            "zone_description": "Reference books section. 50 seats. First floor, Library Building.",
        },
        {
            "zone_name": "Library - Digital Resources",
            "zone_description": "Computer terminals for digital resources. 30 workstations. Second floor, Library Building.",
        },
        {
            "zone_name": "Server Room",
            "zone_description": "Critical infrastructure. Authorized personnel only. Basement, Admin Block.",
        },
        {
            "zone_name": "Main Entrance Lobby",
            "zone_description": "Building entrance with security checkpoint. Ground floor, Main Building.",
        },
        {
            "zone_name": "Auditorium",
            "zone_description": "Large auditorium for events and exams. 300 seats. Ground floor, Block D.",
        },
        {
            "zone_name": "Laboratory - Chemistry",
            "zone_description": "Chemistry lab with hazardous materials. Restricted access. First floor, Science Block.",
        },
        {
            "zone_name": "Laboratory - Physics",
            "zone_description": "Physics lab with sensitive equipment. Restricted access. First floor, Science Block.",
        },
        {
            "zone_name": "Staff Room",
            "zone_description": "Faculty and staff only area. Second floor, Admin Block.",
        },
        {
            "zone_name": "Cafeteria",
            "zone_description": "Student cafeteria. High traffic area. Ground floor, Student Center.",
        },
        {
            "zone_name": "Parking Lot - Zone A",
            "zone_description": "Faculty parking. License plate recognition zone. Outdoor, North wing.",
        },
        {
            "zone_name": "Parking Lot - Zone B",
            "zone_description": "Student parking. High capacity. Outdoor, South wing.",
        },
    ]

    with get_db_context() as db:
        for zone_data in zones:
            zone = Zone(
                zone_name=zone_data["zone_name"],
                zone_description=zone_data["zone_description"],
            )
            db.add(zone)
        db.commit()
        print(f"Created {len(zones)} zones.")


def create_mock_cameras():
    """Create mock cameras assigned to zones."""
    print("Creating mock cameras...")

    # Camera sources: 0, 1, 2 for webcams; RTSP URLs; HTTP stream URLs
    camera_sources = [
        "0", "1", "2", "3",  # Local webcams
        "rtsp://admin:admin@192.168.1.100:554/stream1",
        "rtsp://admin:admin@192.168.1.101:554/stream1",
        "rtsp://admin:admin@192.168.1.102:554/stream1",
        "rtsp://admin:admin@192.168.1.103:554/stream1",
        "http://192.168.1.200:8080/video",
        "http://192.168.1.201:8080/video",
        "http://192.168.1.202:8080/video",
        "rtsp://admin:admin@192.168.1.104:554/stream1",
        "rtsp://admin:admin@192.168.1.105:554/stream1",
        "rtsp://admin:admin@192.168.1.106:554/stream1",
        "rtsp://admin:admin@192.168.1.107:554/stream1",
        "http://192.168.1.203:8080/video",
        "http://192.168.1.204:8080/video",
        "rtsp://admin:admin@192.168.1.108:554/stream1",
        "rtsp://admin:admin@192.168.1.109:554/stream1",
    ]

    # Camera names and assignments
    cameras_data = [
        # Examination Hall A
        {"name": "Exam Hall A - Front Entrance", "source": camera_sources[0], "zone": "Examination Hall A"},
        {"name": "Exam Hall A - Rear Exit", "source": camera_sources[1], "zone": "Examination Hall A"},
        {"name": "Exam Hall A - Left Aisle", "source": camera_sources[2], "zone": "Examination Hall A"},
        {"name": "Exam Hall A - Right Aisle", "source": camera_sources[3], "zone": "Examination Hall A"},
        # Examination Hall B
        {"name": "Exam Hall B - Front", "source": camera_sources[4], "zone": "Examination Hall B"},
        {"name": "Exam Hall B - Rear", "source": camera_sources[5], "zone": "Examination Hall B"},
        {"name": "Exam Hall B - Center", "source": camera_sources[6], "zone": "Examination Hall B"},
        # Examination Hall C
        {"name": "Exam Hall C - Row 1-5", "source": camera_sources[7], "zone": "Examination Hall C"},
        {"name": "Exam Hall C - Row 6-10", "source": camera_sources[8], "zone": "Examination Hall C"},
        # Classrooms
        {"name": "Classroom 101 - Front", "source": camera_sources[0], "zone": "Classroom 101"},
        {"name": "Classroom 101 - Rear", "source": camera_sources[1], "zone": "Classroom 101"},
        {"name": "Classroom 102 - Front", "source": camera_sources[2], "zone": "Classroom 102"},
        {"name": "Classroom 102 - Rear", "source": camera_sources[3], "zone": "Classroom 102"},
        {"name": "Classroom 201 - Center", "source": camera_sources[4], "zone": "Classroom 201"},
        {"name": "Classroom 202 - Center", "source": camera_sources[5], "zone": "Classroom 202"},
        # Library
        {"name": "Library Reading - Entrance", "source": camera_sources[6], "zone": "Library - Reading Room"},
        {"name": "Library Reading - Center", "source": camera_sources[7], "zone": "Library - Reading Room"},
        {"name": "Library Reference - Aisle 1", "source": camera_sources[8], "zone": "Library - Reference Section"},
        {"name": "Library Reference - Aisle 2", "source": camera_sources[9] if len(camera_sources) > 9 else camera_sources[0], "zone": "Library - Reference Section"},
        {"name": "Library Digital - Workstation Row", "source": camera_sources[10] if len(camera_sources) > 10 else camera_sources[1], "zone": "Library - Digital Resources"},
        # Server Room
        {"name": "Server Room - Rack Row A", "source": camera_sources[11] if len(camera_sources) > 11 else camera_sources[2], "zone": "Server Room"},
        {"name": "Server Room - Rack Row B", "source": camera_sources[12] if len(camera_sources) > 12 else camera_sources[3], "zone": "Server Room"},
        {"name": "Server Room - Cooling Unit", "source": camera_sources[0], "zone": "Server Room"},
        # Main Entrance
        {"name": "Main Entrance - Lobby Wide", "source": camera_sources[13] if len(camera_sources) > 13 else camera_sources[4], "zone": "Main Entrance Lobby"},
        {"name": "Main Entrance - Security Check", "source": camera_sources[5], "zone": "Main Entrance Lobby"},
        # Auditorium
        {"name": "Auditorium - Stage View", "source": camera_sources[14] if len(camera_sources) > 14 else camera_sources[6], "zone": "Auditorium"},
        {"name": "Auditorium - Balcony", "source": camera_sources[7], "zone": "Auditorium"},
        {"name": "Auditorium - Rear", "source": camera_sources[8], "zone": "Auditorium"},
        # Laboratories
        {"name": "Chemistry Lab - Fume Hood", "source": camera_sources[9], "zone": "Laboratory - Chemistry"},
        {"name": "Chemistry Lab - Bench Area", "source": camera_sources[10], "zone": "Laboratory - Chemistry"},
        {"name": "Physics Lab - Equipment", "source": camera_sources[11], "zone": "Laboratory - Physics"},
        {"name": "Physics Lab - Experiment Area", "source": camera_sources[12], "zone": "Laboratory - Physics"},
        # Staff Room
        {"name": "Staff Room - Main", "source": camera_sources[0], "zone": "Staff Room"},
        # Cafeteria
        {"name": "Cafeteria - Entrance", "source": camera_sources[1], "zone": "Cafeteria"},
        {"name": "Cafeteria - Serving Area", "source": camera_sources[2], "zone": "Cafeteria"},
        {"name": "Cafeteria - Seating Area", "source": camera_sources[3], "zone": "Cafeteria"},
        # Parking
        {"name": "Parking A - Entry Gate", "source": camera_sources[13], "zone": "Parking Lot - Zone A"},
        {"name": "Parking A - Row 1", "source": camera_sources[14], "zone": "Parking Lot - Zone A"},
        {"name": "Parking B - Entry", "source": camera_sources[6], "zone": "Parking Lot - Zone B"},
        {"name": "Parking B - Row 5", "source": camera_sources[7], "zone": "Parking Lot - Zone B"},
    ]

    with get_db_context() as db:
        # Get zone IDs
        zones = {zone.zone_name: zone.id for zone in db.query(Zone).all()}

        for i, cam_data in enumerate(cameras_data):
            zone_id = zones.get(cam_data["zone"])
            camera = Camera(
                camera_name=cam_data["name"],
                camera_source=cam_data["source"],
                zone_id=zone_id,
                status=random.choice([CameraStatus.ACTIVE, CameraStatus.ACTIVE, CameraStatus.ACTIVE, CameraStatus.INACTIVE]),
            )
            db.add(camera)
        db.commit()
        print(f"Created {len(cameras_data)} cameras.")


def create_mock_detection_events():
    """Create mock detection events with various statuses and time ranges."""
    print("Creating mock detection events...")

    with get_db_context() as db:
        # Get camera IDs and zone IDs
        cameras = {cam.camera_name: cam.id for cam in db.query(Camera).all()}
        zones = {zone.zone_name: zone.id for zone in db.query(Zone).all()}

        if not cameras:
            print("No cameras found. Skipping detection events.")
            return

        camera_names = list(cameras.keys())
        events = []

        # Generate events over the past 30 days
        base_time = datetime.now(timezone.utc)

        for day_offset in range(30):
            event_date = base_time - timedelta(days=day_offset)

            # Random number of events per day (0-8)
            num_events = random.randint(0, 8)

            for _ in range(num_events):
                # Random hour within the day
                event_hour = random.randint(8, 20)  # 8 AM to 8 PM
                event_minute = random.randint(0, 59)
                event_second = random.randint(0, 59)

                start_time = event_date.replace(hour=event_hour, minute=event_minute, second=event_second, microsecond=0)

                # Duration: 1-120 seconds
                duration = random.randint(1, 120)
                end_time = start_time + timedelta(seconds=duration)

                # Camera and zone
                camera_name = random.choice(camera_names)
                camera_id = cameras[camera_name]

                # Find zone for this camera
                camera = db.query(Camera).filter(Camera.id == camera_id).first()
                zone_id = camera.zone_id if camera else None

                # Confidence: 0.55-0.99 (biased towards higher)
                confidence = round(random.uniform(0.55, 0.99), 2)

                # Review status distribution
                status_roll = random.random()
                if status_roll < 0.4:
                    review_status = ReviewStatus.PENDING
                elif status_roll < 0.7:
                    review_status = ReviewStatus.CONFIRMED
                elif status_roll < 0.9:
                    review_status = ReviewStatus.FALSE_POSITIVE
                else:
                    review_status = ReviewStatus.DISMISSED

                # Snapshot path (only for some events)
                snapshot_path = None
                if random.random() < 0.7:
                    timestamp_str = start_time.strftime("%Y%m%d_%H%M%S")
                    snapshot_path = f"./snapshots/detection_{camera_id}_{timestamp_str}.jpg"

                event = DetectionEvent(
                    camera_id=camera_id,
                    zone_id=zone_id,
                    detected_object="cell phone",
                    confidence=confidence,
                    start_time=start_time,
                    end_time=end_time,
                    duration_seconds=round(duration, 2),
                    snapshot_path=snapshot_path,
                    review_status=review_status,
                )
                events.append(event)

        # Add events to database
        for event in events:
            db.add(event)
        db.commit()
        print(f"Created {len(events)} detection events.")


def print_summary():
    """Print a summary of created data."""
    with get_db_context() as db:
        zone_count = db.query(Zone).count()
        camera_count = db.query(Camera).count()
        event_count = db.query(DetectionEvent).count()
        user_count = db.query(User).count()

        # Stats by review status
        pending = db.query(DetectionEvent).filter(DetectionEvent.review_status == ReviewStatus.PENDING).count()
        confirmed = db.query(DetectionEvent).filter(DetectionEvent.review_status == ReviewStatus.CONFIRMED).count()
        false_positive = db.query(DetectionEvent).filter(DetectionEvent.review_status == ReviewStatus.FALSE_POSITIVE).count()
        dismissed = db.query(DetectionEvent).filter(DetectionEvent.review_status == ReviewStatus.DISMISSED).count()

        # Camera status
        active_cams = db.query(Camera).filter(Camera.status == CameraStatus.ACTIVE).count()
        inactive_cams = db.query(Camera).filter(Camera.status == CameraStatus.INACTIVE).count()

        print("\n" + "=" * 60)
        print("MOCK DATA SUMMARY")
        print("=" * 60)
        print(f"Users: {user_count}")
        print(f"  - Admins: {db.query(User).filter(User.role == UserRole.ADMIN).count()}")
        print(f"  - Operators: {db.query(User).filter(User.role == UserRole.OPERATOR).count()}")
        print(f"  - Viewers: {db.query(User).filter(User.role == UserRole.VIEWER).count()}")
        print(f"Zones: {zone_count}")
        print(f"Cameras: {camera_count}")
        print(f"  - Active: {active_cams}")
        print(f"  - Inactive: {inactive_cams}")
        print(f"Detection Events: {event_count}")
        print(f"  - Pending Review: {pending}")
        print(f"  - Confirmed: {confirmed}")
        print(f"  - False Positive: {false_positive}")
        print(f"  - Dismissed: {dismissed}")
        print("=" * 60)
        print("\nLogin Credentials:")
        print("  Admin: admin / admin123")
        print("  Operator: operator1 / operator123")
        print("  Operator: operator2 / operator123")
        print("  Viewer: viewer1 / viewer123")
        print("  Security: security_officer / security123")


def main():
    """Main function to populate all mock data."""
    print("=" * 60)
    print("Smart Surveillance - Mock Data Population")
    print("=" * 60)

    # Initialize database
    init_database()

    # Clear existing data
    clear_database()

    # Create all mock data
    create_mock_users()
    create_mock_zones()
    create_mock_cameras()
    create_mock_detection_events()

    # Print summary
    print_summary()

    print("\n✅ Mock data population complete!")
    print("You can now run the application and see realistic data.")


if __name__ == "__main__":
    main()