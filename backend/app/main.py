"""Smart Surveillance - AI Mobile Phone Detection System - Main Application."""
import asyncio
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pathlib import Path

from app.configuration.settings import settings
from app.database.connection import init_database, get_db, get_db_context
from app.models.camera import Camera as CameraModel
from app.routes import zones, cameras, detection_events, settings as settings_routes
from app.websocket.routes import router as websocket_router
from app.services.detection_service import get_detection_service
from app.camera_processing.camera_manager import get_camera_manager
from app.websocket.manager import get_connection_manager

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager."""
    # Startup
    logger.info("Starting Smart Surveillance System...")
    
    # Initialize database
    init_database()
    logger.info("Database initialized")

    # Initialize detection service (loads YOLO model)
    detection_service = get_detection_service()
    logger.info(f"Detector loaded: {detection_service.get_detector_info().get('is_loaded', False)}")

    # Register cameras persisted in the database with the in-memory camera manager
    camera_manager = get_camera_manager()
    try:
        with get_db_context() as db:
            for cam in db.query(CameraModel).all():
                camera_manager.add_camera(
                    camera_id=cam.id,
                    camera_name=cam.camera_name,
                    camera_source=cam.camera_source,
                    zone_id=cam.zone_id,
                )
        logger.info(f"Loaded {len(camera_manager.get_all_cameras())} camera(s) from database")
    except Exception as exc:  # pragma: no cover - defensive startup logging
        logger.error(f"Failed to load cameras from database: {exc}")

    # Set up WebSocket broadcast callback. Detection callbacks run in worker
    # threads, so the coroutine is scheduled onto the main event loop.
    connection_manager = get_connection_manager()
    loop = asyncio.get_running_loop()

    def broadcast_detection(message):
        asyncio.run_coroutine_threadsafe(
            connection_manager.broadcast_detection(message), loop
        )

    detection_service.set_websocket_broadcast(broadcast_detection)

    logger.info("Smart Surveillance System started successfully")

    yield

    # Shutdown
    logger.info("Shutting down Smart Surveillance System...")

    # Stop all camera monitoring
    camera_manager = get_camera_manager()
    for camera in camera_manager.get_all_cameras():
        if camera.is_monitoring:
            camera_manager.stop_monitoring(camera.camera_id)
        if camera.cap:
            camera_manager.disconnect_camera(camera.camera_id)

    # Shutdown detection service
    detection_service.shutdown()

    logger.info("Smart Surveillance System shut down complete")


# Create FastAPI app
app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="AI-powered surveillance system for mobile phone detection in restricted areas",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "message": "Internal server error",
            "error_code": "INTERNAL_ERROR",
            "details": str(exc) if settings.debug else None,
        },
    )


# Health check endpoint
@app.get("/health", tags=["Health"])
async def health_check():
    """Health check endpoint."""
    detection_service = get_detection_service()
    camera_manager = get_camera_manager()
    connection_manager = get_connection_manager()

    return {
        "status": "healthy",
        "app_name": settings.app_name,
        "version": settings.app_version,
        "detector_loaded": detection_service.get_detector_info().get("is_loaded", False),
        "active_cameras": len([c for c in camera_manager.get_all_cameras() if c.connection_state.value == "connected"]),
        "monitoring_cameras": len([c for c in camera_manager.get_all_cameras() if c.is_monitoring]),
        "websocket_connections": connection_manager.get_connection_count(),
        "active_detections": len(detection_service.get_active_detections()),
    }


# Root endpoint
@app.get("/", tags=["Root"])
async def root():
    """Root endpoint with API information."""
    return {
        "name": settings.app_name,
        "version": settings.app_version,
        "description": "AI-powered surveillance system for mobile phone detection in restricted areas",
        "docs": "/docs",
        "health": "/health",
        "websocket": "/ws",
    }


# Include routers with /api prefix
app.include_router(zones.router, prefix="/api")
app.include_router(cameras.router, prefix="/api")
app.include_router(detection_events.router, prefix="/api")
app.include_router(settings_routes.router, prefix="/api")
app.include_router(websocket_router)


# Mount static files for snapshots (if needed)
snapshots_dir = Path(settings.detection_snapshot_dir)
snapshots_dir.mkdir(parents=True, exist_ok=True)
app.mount("/snapshots", StaticFiles(directory=str(snapshots_dir)), name="snapshots")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
    )