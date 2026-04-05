from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
from typing import Dict, List
import json
import os

from app.core.config import settings
from app.database import create_tables, SessionLocal
from app.routers import (
    auth, announcements, health_check, assignments,
    attendance, daily_reports, risk, dashboard
)


# ─── WebSocket Connection Manager ─────────────────────────────────────────────

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[int, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, user_id: int):
        await websocket.accept()
        if user_id not in self.active_connections:
            self.active_connections[user_id] = []
        self.active_connections[user_id].append(websocket)

    def disconnect(self, websocket: WebSocket, user_id: int):
        if user_id in self.active_connections:
            try:
                self.active_connections[user_id].remove(websocket)
            except ValueError:
                pass
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]

    async def send_personal_message(self, message: dict, user_id: int):
        if user_id in self.active_connections:
            dead = []
            for ws in self.active_connections[user_id]:
                try:
                    await ws.send_text(json.dumps(message))
                except Exception:
                    dead.append(ws)
            for ws in dead:
                self.disconnect(ws, user_id)

    async def broadcast(self, message: dict):
        for user_id, connections in list(self.active_connections.items()):
            for ws in connections:
                try:
                    await ws.send_text(json.dumps(message))
                except Exception:
                    pass

    @property
    def connected_user_count(self) -> int:
        return len(self.active_connections)


manager = ConnectionManager()


# ─── Startup / Shutdown ────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Create DB tables and seed default admin user on startup."""
    create_tables()
    _create_default_admin()
    yield


def _create_default_admin():
    """Create default admin user if not exists."""
    from app.models.models import User
    from app.core.security import get_password_hash

    db = SessionLocal()
    try:
        existing = db.query(User).filter(User.username == "admin").first()
        if not existing:
            admin = User(
                username="admin",
                email="admin@gsdf.kr",
                hashed_password=get_password_hash("admin123"),
                role="admin",
                full_name="시스템 관리자",
                is_active=True
            )
            db.add(admin)
            db.commit()
            print("✓ Default admin user created: admin / admin123")
        else:
            print("✓ Admin user already exists")
    except Exception as e:
        print(f"Warning: Could not create default admin: {e}")
        db.rollback()
    finally:
        db.close()


# ─── App Instance ──────────────────────────────────────────────────────────────

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="경기 사다리 청년 재단 (GSDF) Management Dashboard API",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json"
)


# ─── CORS ──────────────────────────────────────────────────────────────────────

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify exact origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Static Files ──────────────────────────────────────────────────────────────

os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")


# ─── Routers ───────────────────────────────────────────────────────────────────

app.include_router(auth.router)
app.include_router(announcements.router)
app.include_router(health_check.router)
app.include_router(assignments.router)
app.include_router(attendance.router)
app.include_router(daily_reports.router)
app.include_router(risk.router)
app.include_router(dashboard.router)


# ─── WebSocket ─────────────────────────────────────────────────────────────────

@app.websocket("/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: int):
    """WebSocket endpoint for real-time notifications."""
    await manager.connect(websocket, user_id)
    try:
        # Send connection confirmation
        await websocket.send_text(json.dumps({
            "type": "connected",
            "message": f"Connected as user {user_id}",
            "connected_users": manager.connected_user_count
        }))

        while True:
            # Receive messages from client (keep-alive pings, etc.)
            data = await websocket.receive_text()
            try:
                msg = json.loads(data)
                if msg.get("type") == "ping":
                    await websocket.send_text(json.dumps({"type": "pong"}))
            except json.JSONDecodeError:
                pass

    except WebSocketDisconnect:
        manager.disconnect(websocket, user_id)


# ─── Root & Health Endpoints ───────────────────────────────────────────────────

@app.get("/", tags=["Root"])
async def root():
    return {
        "name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "status": "running",
        "docs": "/docs",
        "redoc": "/redoc"
    }


@app.get("/health", tags=["Health"])
async def health_check_endpoint():
    """Basic health check."""
    return {
        "status": "healthy",
        "service": settings.APP_NAME,
        "version": settings.APP_VERSION
    }


@app.get("/ws-stats", tags=["WebSocket"])
async def ws_stats():
    """Get WebSocket connection statistics."""
    return {
        "connected_users": manager.connected_user_count,
        "user_ids": list(manager.active_connections.keys())
    }


# ─── Expose manager for use in other modules ─────────────────────────────────

def get_ws_manager() -> ConnectionManager:
    return manager
