"""WebSocket route handlers."""
import json
import logging
from typing import Dict, Any
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query, Depends
from sqlalchemy.orm import Session

from app.websocket.manager import get_connection_manager, ConnectionManager
from app.database.connection import get_db
from app.services.detection_service import get_detection_service
from app.camera_processing.camera_manager import get_camera_manager

logger = logging.getLogger(__name__)

router = APIRouter()


@router.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    client_id: str = Query(None),
    token: str = Query(None),
):
    """
    WebSocket endpoint for real-time communication.

    Query Parameters:
    - client_id: Optional client identifier (auto-generated if not provided)
    - token: Optional authentication token
    """
    manager = get_connection_manager()
    detection_service = get_detection_service()
    camera_manager = get_camera_manager()

    # Generate client ID if not provided
    if not client_id:
        import uuid
        client_id = str(uuid.uuid4())[:8]

    await manager.connect(websocket, client_id)

    try:
        # Send welcome message
        await manager.send_personal_message(client_id, {
            "type": "connected",
            "client_id": client_id,
            "timestamp": datetime.utcnow().isoformat(),
            "message": "Connected to Smart Surveillance WebSocket",
        })

        # Send initial state
        await _send_initial_state(client_id, manager, detection_service, camera_manager)

        # Message handling loop
        while True:
            data = await websocket.receive_text()
            try:
                message = json.loads(data)
                await _handle_message(
                    client_id, message, manager, detection_service, camera_manager
                )
            except json.JSONDecodeError:
                await manager.send_personal_message(client_id, {
                    "type": "error",
                    "message": "Invalid JSON format",
                })
            except Exception as e:
                logger.error(f"Message handling error for {client_id}: {e}")
                await manager.send_personal_message(client_id, {
                    "type": "error",
                    "message": str(e),
                })

    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected: {client_id}")
    except Exception as e:
        logger.error(f"WebSocket error for {client_id}: {e}")
    finally:
        await manager.disconnect(client_id)


async def _send_initial_state(
    client_id: str,
    manager: ConnectionManager,
    detection_service,
    camera_manager,
) -> None:
    """Send initial state to newly connected client."""
    # Active detections
    active_detections = detection_service.get_active_detections()
    await manager.send_personal_message(client_id, {
        "type": "active_detections",
        "data": active_detections,
    })

    # Camera statuses
    cameras = camera_manager.get_all_cameras()
    camera_statuses = []
    for cam in cameras:
        status = camera_manager.get_camera_status(cam.camera_id)
        if status:
            camera_statuses.append(status)
    await manager.send_personal_message(client_id, {
        "type": "camera_statuses",
        "data": camera_statuses,
    })


async def _handle_message(
    client_id: str,
    message: Dict[str, Any],
    manager: ConnectionManager,
    detection_service,
    camera_manager,
) -> None:
    """Handle incoming WebSocket message."""
    msg_type = message.get("type")

    if msg_type == "ping":
        await manager.send_personal_message(client_id, {
            "type": "pong",
            "timestamp": datetime.utcnow().isoformat(),
        })

    elif msg_type == "subscribe":
        topic = message.get("topic")
        if topic:
            success = await manager.subscribe(client_id, topic)
            await manager.send_personal_message(client_id, {
                "type": "subscribed",
                "topic": topic,
                "success": success,
            })

    elif msg_type == "unsubscribe":
        topic = message.get("topic")
        if topic:
            success = await manager.unsubscribe(client_id, topic)
            await manager.send_personal_message(client_id, {
                "type": "unsubscribed",
                "topic": topic,
                "success": success,
            })

    elif msg_type == "get_active_detections":
        active_detections = detection_service.get_active_detections()
        await manager.send_personal_message(client_id, {
            "type": "active_detections",
            "data": active_detections,
        })

    elif msg_type == "get_camera_status":
        camera_id = message.get("camera_id")
        if camera_id:
            status = camera_manager.get_camera_status(camera_id)
            await manager.send_personal_message(client_id, {
                "type": "camera_status",
                "data": status,
            })
        else:
            cameras = camera_manager.get_all_cameras()
            statuses = []
            for cam in cameras:
                s = camera_manager.get_camera_status(cam.camera_id)
                if s:
                    statuses.append(s)
            await manager.send_personal_message(client_id, {
                "type": "camera_statuses",
                "data": statuses,
            })

    elif msg_type == "start_monitoring":
        camera_id = message.get("camera_id")
        if camera_id:
            success = camera_manager.start_monitoring(camera_id)
            await manager.send_personal_message(client_id, {
                "type": "monitoring_started",
                "camera_id": camera_id,
                "success": success,
            })

    elif msg_type == "stop_monitoring":
        camera_id = message.get("camera_id")
        if camera_id:
            success = camera_manager.stop_monitoring(camera_id)
            await manager.send_personal_message(client_id, {
                "type": "monitoring_stopped",
                "camera_id": camera_id,
                "success": success,
            })

    elif msg_type == "update_detection_config":
        # Update detection configuration
        confidence = message.get("confidence_threshold")
        iou = message.get("iou_threshold")
        tolerance = message.get("interruption_tolerance")
        min_duration = message.get("min_duration")

        if confidence is not None:
            detection_service.update_detector_confidence(confidence)
        if iou is not None:
            detection_service.update_detector_iou(iou)
        if tolerance is not None:
            detection_service.update_tracker_tolerance(tolerance)
        if min_duration is not None:
            detection_service.update_tracker_min_duration(min_duration)

        await manager.send_personal_message(client_id, {
            "type": "config_updated",
            "config": detection_service.get_detector_info(),
        })

    elif msg_type == "get_detector_info":
        info = detection_service.get_detector_info()
        await manager.send_personal_message(client_id, {
            "type": "detector_info",
            "data": info,
        })

    else:
        await manager.send_personal_message(client_id, {
            "type": "error",
            "message": f"Unknown message type: {msg_type}",
        })


# Import datetime for use in functions
from datetime import datetime