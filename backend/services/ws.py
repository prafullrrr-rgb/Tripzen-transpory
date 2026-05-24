"""WebSocket connection manager for live trip tracking."""
from typing import Dict, List
from fastapi import WebSocket


class TripWSManager:
    def __init__(self):
        self.connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, trip_id: str, ws: WebSocket):
        await ws.accept()
        self.connections.setdefault(trip_id, []).append(ws)

    def disconnect(self, trip_id: str, ws: WebSocket):
        conns = self.connections.get(trip_id, [])
        if ws in conns:
            conns.remove(ws)
        if not conns and trip_id in self.connections:
            self.connections.pop(trip_id, None)

    async def broadcast(self, trip_id: str, payload: dict):
        dead: List[WebSocket] = []
        for ws in list(self.connections.get(trip_id, [])):
            try:
                await ws.send_json(payload)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(trip_id, ws)


ws_manager = TripWSManager()
