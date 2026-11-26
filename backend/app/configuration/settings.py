"""Application configuration settings."""
import os
from pathlib import Path
from typing import Optional
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Application
    app_name: str = "Smart Surveillance - AI Mobile Phone Detection System"
    app_version: str = "1.0.0"
    debug: bool = True
    host: str = "0.0.0.0"
    port: int = 8000

    # Database
    database_url: str = "sqlite:///./smart_surveillance.db"
    database_echo: bool = False

    # YOLO Model Configuration
    yolo_model_path: str = "yolov8n.pt"  # Will auto-download if not present
    yolo_confidence_threshold: float = 0.5
    yolo_iou_threshold: float = 0.45
    yolo_device: str = "cpu"  # "cpu" or "cuda"
    detection_target_class: str = "cell phone"  # COCO class name
    detection_target_class_name: str = "cell phone"  # Alias for backward compatibility
    detection_target_class_id: int = 67  # COCO class ID for cell phone

    # Camera Configuration
    default_camera_index: int = 0
    camera_frame_width: int = 640
    camera_frame_height: int = 480
    camera_fps: int = 30
    camera_buffer_size: int = 1

    # Detection Logic
    detection_interruption_tolerance_seconds: float = 2.0  # Max gap before ending session
    detection_min_duration_seconds: float = 1.0  # Minimum duration to save event
    detection_snapshot_enabled: bool = True
    detection_snapshot_dir: str = "./snapshots"

    # WebSocket
    websocket_ping_interval: int = 30
    websocket_ping_timeout: int = 10

    # Security
    secret_key: str = "your-secret-key-change-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30

    # CORS
    cors_origins: list[str] = ["http://localhost:3000", "http://localhost:5173", "http://127.0.0.1:3000", "http://127.0.0.1:5173"]

    # Export
    export_dir: str = "./exports"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()


settings = get_settings()

# Ensure directories exist
Path(settings.detection_snapshot_dir).mkdir(parents=True, exist_ok=True)
Path(settings.export_dir).mkdir(parents=True, exist_ok=True)