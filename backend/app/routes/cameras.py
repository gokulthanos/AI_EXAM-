"""Camera REST API routes."""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.services.camera_service import CameraService
from app.schemas.camera import (
    CameraCreate,
    CameraUpdate,
    CameraResponse,
    CameraStatusResponse,
    CameraPreviewResponse,
)
from app.schemas.common import PaginationParams, ListResponse, DataResponse
from app.models.camera import CameraStatus

router = APIRouter(prefix="/cameras", tags=["Cameras"])


def get_camera_service(db: Session = Depends(get_db)) -> CameraService:
    return CameraService(db)


@router.post(
    "/",
    response_model=DataResponse[CameraResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Create a new camera",
)
def create_camera(
    camera_data: CameraCreate,
    service: CameraService = Depends(get_camera_service),
):
    """Create a new camera."""
    try:
        camera = service.create(camera_data)
        return DataResponse(data=camera, message="Camera created successfully")
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get(
    "/",
    response_model=ListResponse[CameraResponse],
    summary="List all cameras",
)
def list_cameras(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    zone_id: Optional[int] = Query(None, description="Filter by zone ID"),
    status_filter: Optional[CameraStatus] = Query(None, alias="status", description="Filter by camera status"),
    search: Optional[str] = Query(None, description="Search by camera name"),
    service: CameraService = Depends(get_camera_service),
):
    """List all cameras with pagination and filters."""
    cameras = service.get_all(
        skip=(page - 1) * page_size,
        limit=page_size,
        zone_id=zone_id,
        status=status_filter,
        search=search,
    )
    total = service.get_count(zone_id=zone_id, status=status_filter, search=search)

    return ListResponse(
        data=cameras,
        total=total,
        page=page,
        page_size=page_size,
        message="Cameras retrieved successfully",
    )


@router.get(
    "/available-devices",
    response_model=ListResponse[dict],
    summary="List locally available webcam devices",
)
def list_available_devices():
    """Probe local device indices and report webcams that OpenCV can open."""
    import sys
    import cv2

    # Prefer DirectShow on Windows for faster device probing
    backend = cv2.CAP_DSHOW if sys.platform == "win32" else cv2.CAP_ANY

    devices = []
    for index in range(5):
        cap = cv2.VideoCapture(index, backend) if backend != cv2.CAP_ANY else cv2.VideoCapture(index)
        try:
            if cap.isOpened():
                ret, _ = cap.read()
                if ret:
                    devices.append({
                        "index": index,
                        "label": f"Webcam {index}",
                        "source": str(index),
                    })
        except Exception:
            pass
        finally:
            cap.release()

    return ListResponse(
        data=devices,
        total=len(devices),
        message=f"Detected {len(devices)} available webcam device(s)",
    )


@router.get(
    "/with-status",
    response_model=ListResponse[dict],
    summary="List all cameras with real-time status",
)
def list_cameras_with_status(
    service: CameraService = Depends(get_camera_service),
):
    """List all cameras with their current real-time status."""
    cameras = service.get_all_with_status()
    return ListResponse(data=cameras, total=len(cameras), message="Cameras with status retrieved successfully")


@router.get(
    "/{camera_id}",
    response_model=DataResponse[CameraResponse],
    summary="Get camera by ID",
)
def get_camera(
    camera_id: int,
    service: CameraService = Depends(get_camera_service),
):
    """Get a specific camera by ID."""
    camera = service.get_by_id(camera_id)
    if not camera:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Camera with ID {camera_id} not found",
        )
    return DataResponse(data=camera, message="Camera retrieved successfully")


@router.get(
    "/{camera_id}/status",
    response_model=DataResponse[CameraStatusResponse],
    summary="Get camera real-time status",
)
def get_camera_status(
    camera_id: int,
    service: CameraService = Depends(get_camera_service),
):
    """Get real-time status of a camera."""
    status = service.get_status(camera_id)
    if not status:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Camera with ID {camera_id} not found",
        )
    return DataResponse(data=status, message="Camera status retrieved successfully")


@router.get(
    "/{camera_id}/preview",
    response_model=DataResponse[CameraPreviewResponse],
    summary="Get camera preview frame with detections",
)
def get_camera_preview(
    camera_id: int,
    service: CameraService = Depends(get_camera_service),
):
    """Get a preview frame from the camera with detection overlays."""
    preview = service.get_preview_frame(camera_id)
    if not preview:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Camera with ID {camera_id} not found or no frame available",
        )
    return DataResponse(data=preview, message="Camera preview retrieved successfully")


@router.put(
    "/{camera_id}",
    response_model=DataResponse[CameraResponse],
    summary="Update a camera",
)
def update_camera(
    camera_id: int,
    camera_data: CameraUpdate,
    service: CameraService = Depends(get_camera_service),
):
    """Update a camera."""
    try:
        camera = service.update(camera_id, camera_data)
        if not camera:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Camera with ID {camera_id} not found",
            )
        return DataResponse(data=camera, message="Camera updated successfully")
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete(
    "/{camera_id}",
    response_model=DataResponse[dict],
    summary="Delete a camera",
)
def delete_camera(
    camera_id: int,
    service: CameraService = Depends(get_camera_service),
):
    """Delete a camera."""
    success = service.delete(camera_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Camera with ID {camera_id} not found",
        )
    return DataResponse(data={"deleted": True}, message="Camera deleted successfully")


@router.post(
    "/{camera_id}/connect",
    response_model=DataResponse[dict],
    summary="Connect to a camera",
)
def connect_camera(
    camera_id: int,
    service: CameraService = Depends(get_camera_service),
):
    """Connect to a camera."""
    camera = service.get_by_id(camera_id)
    if not camera:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Camera with ID {camera_id} not found",
        )

    success = service.connect_camera(camera_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to connect to camera",
        )

    return DataResponse(data={"connected": True}, message="Camera connected successfully")


@router.post(
    "/{camera_id}/disconnect",
    response_model=DataResponse[dict],
    summary="Disconnect a camera",
)
def disconnect_camera(
    camera_id: int,
    service: CameraService = Depends(get_camera_service),
):
    """Disconnect a camera."""
    camera = service.get_by_id(camera_id)
    if not camera:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Camera with ID {camera_id} not found",
        )

    success = service.disconnect_camera(camera_id)
    return DataResponse(data={"disconnected": True}, message="Camera disconnected successfully")


@router.post(
    "/{camera_id}/start-monitoring",
    response_model=DataResponse[dict],
    summary="Start monitoring a camera",
)
def start_monitoring(
    camera_id: int,
    service: CameraService = Depends(get_camera_service),
):
    """Start monitoring a camera for detections."""
    camera = service.get_by_id(camera_id)
    if not camera:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Camera with ID {camera_id} not found",
        )

    success = service.start_monitoring(camera_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to start monitoring",
        )

    return DataResponse(data={"monitoring": True}, message="Camera monitoring started")


@router.post(
    "/{camera_id}/stop-monitoring",
    response_model=DataResponse[dict],
    summary="Stop monitoring a camera",
)
def stop_monitoring(
    camera_id: int,
    service: CameraService = Depends(get_camera_service),
):
    """Stop monitoring a camera."""
    success = service.stop_monitoring(camera_id)
    return DataResponse(data={"monitoring": False}, message="Camera monitoring stopped")