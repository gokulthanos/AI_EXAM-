"""WebSocket Connection Manager for real-time communication."""
import json
import asyncio
import logging
from typing import Dict, List, Set, Any, Optional
from datetime import datetime
from fastapi import WebSocket, WebSocketDisconnect
from collections import defaultdict

logger = logging.getLogger(__name__)


class ConnectionManager:
    """Manages WebSocket connections and message broadcasting."""

    def __init__(self):
        # Active connections: {client_id: WebSocket}
        self.active_connections: Dict[str, WebSocket] = {}
        # Subscriptions: {topic: Set[client_id]}
        self.subscriptions: Dict[str, Set[str]] = defaultdict(set)
        # Client metadata: {client_id: dict}
        self.client_metadata: Dict[str, Dict[str, Any]] = {}
        self._lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket, client_id: str) -> None:
        """Accept a new WebSocket connection."""
        await websocket.accept()
        async with self._lock:
            self.active_connections[client_id] = websocket
            self.client_metadata[client_id] = {
                "connected_at": datetime.utcnow().isoformat(),
                "subscriptions": set(),
            }
        logger.info(f"WebSocket client connected: {client_id} (total: {len(self.active_connections)})")

    async def disconnect(self, client_id: str) -> None:
        """Disconnect a WebSocket client."""
        async with self._lock:
            # Remove from all subscriptions
            for topic in list(self.subscriptions.keys()):
                self.subscriptions[topic].discard(client_id)
                if not self.subscriptions[topic]:
                    del self.subscriptions[topic]

            # Remove connection
            self.active_connections.pop(client_id, None)
            self.client_metadata.pop(client_id, None)

        logger.info(f"WebSocket client disconnected: {client_id} (total: {len(self.active_connections)})")

    async def subscribe(self, client_id: str, topic: str) -> bool:
        """Subscribe a client to a topic."""
        async with self._lock:
            if client_id not in self.active_connections:
                return False

            self.subscriptions[topic].add(client_id)
            if client_id in self.client_metadata:
                self.client_metadata[client_id]["subscriptions"].add(topic)

        logger.debug(f"Client {client_id} subscribed to {topic}")
        return True

    async def unsubscribe(self, client_id: str, topic: str) -> bool:
        """Unsubscribe a client from a topic."""
        async with self._lock:
            self.subscriptions[topic].discard(client_id)
            if not self.subscriptions[topic]:
                del self.subscriptions[topic]

            if client_id in self.client_metadata:
                self.client_metadata[client_id]["subscriptions"].discard(topic)

        logger.debug(f"Client {client_id} unsubscribed from {topic}")
        return True

    async def send_personal_message(self, client_id: str, message: Dict[str, Any]) -> bool:
        """Send a message to a specific client."""
        async with self._lock:
            websocket = self.active_connections.get(client_id)
            if not websocket:
                return False

        try:
            await websocket.send_json(message)
            return True
        except Exception as e:
            logger.error(f"Failed to send message to {client_id}: {e}")
            await self.disconnect(client_id)
            return False

    async def broadcast(self, message: Dict[str, Any], topic: Optional[str] = None) -> int:
        """
        Broadcast a message to all connected clients or subscribers of a topic.

        Args:
            message: Message to broadcast
            topic: Optional topic to filter recipients

        Returns:
            Number of clients the message was sent to
        """
        async with self._lock:
            if topic:
                client_ids = self.subscriptions.get(topic, set()).copy()
            else:
                client_ids = set(self.active_connections.keys())

        sent_count = 0
        disconnected = []

        for client_id in client_ids:
            websocket = self.active_connections.get(client_id)
            if not websocket:
                disconnected.append(client_id)
                continue

            try:
                await websocket.send_json(message)
                sent_count += 1
            except Exception as e:
                logger.error(f"Failed to broadcast to {client_id}: {e}")
                disconnected.append(client_id)

        # Clean up disconnected clients
        for client_id in disconnected:
            await self.disconnect(client_id)

        return sent_count

    async def broadcast_to_camera(self, camera_id: int, message: Dict[str, Any]) -> int:
        """Broadcast to clients subscribed to a specific camera."""
        return await self.broadcast(message, topic=f"camera:{camera_id}")

    async def broadcast_to_zone(self, zone_id: int, message: Dict[str, Any]) -> int:
        """Broadcast to clients subscribed to a specific zone."""
        return await self.broadcast(message, topic=f"zone:{zone_id}")

    async def broadcast_detection(self, message: Dict[str, Any]) -> int:
        """Broadcast detection-related message to all interested clients."""
        # Send to global detection topic
        sent = await self.broadcast(message, topic="detections")

        # Also send to camera-specific topic
        camera_id = message.get("camera_id")
        if camera_id:
            sent += await self.broadcast_to_camera(camera_id, message)

        return sent

    def get_connection_count(self) -> int:
        """Get total number of active connections."""
        return len(self.active_connections)

    def get_subscription_count(self, topic: str) -> int:
        """Get number of subscribers for a topic."""
        return len(self.subscriptions.get(topic, set()))

    def get_all_topics(self) -> List[str]:
        """Get list of all active topics."""
        return list(self.subscriptions.keys())

    def get_client_info(self, client_id: str) -> Optional[Dict[str, Any]]:
        """Get info about a specific client."""
        return self.client_metadata.get(client_id)

    async def ping_all(self) -> int:
        """Send ping to all connections to check health."""
        message = {"type": "ping", "timestamp": datetime.utcnow().isoformat()}
        return await self.broadcast(message)


# Global connection manager instance
_manager_instance: Optional[ConnectionManager] = None


def get_connection_manager() -> ConnectionManager:
    """Get or create global connection manager instance."""
    global _manager_instance
    if _manager_instance is None:
        _manager_instance = ConnectionManager()
    return _manager_instance