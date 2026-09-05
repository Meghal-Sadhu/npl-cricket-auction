import asyncio
from typing import List, Dict, Any
from fastapi import WebSocket, WebSocketDisconnect
import json
import logging

logger = logging.getLogger(__name__)

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"WebSocket client connected. Total clients: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            logger.info(f"WebSocket client disconnected. Total clients: {len(self.active_connections)}")

    async def _send_safe(self, connection: WebSocket, message_json: str) -> bool:
        try:
            await asyncio.wait_for(connection.send_text(message_json), timeout=1.0)
            return True
        except Exception:
            return False

    async def broadcast(self, message: Dict[str, Any]):
        if not self.active_connections:
            return
        message_json = json.dumps(message)
        current_clients = list(self.active_connections)
        
        # Parallel non-blocking send to all connected clients
        results = await asyncio.gather(
            *[self._send_safe(conn, message_json) for conn in current_clients],
            return_exceptions=True
        )

        for conn, success in zip(current_clients, results):
            if success is not True:
                self.disconnect(conn)

manager = ConnectionManager()
