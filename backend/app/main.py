from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text
import os

from app.database import engine, Base, SessionLocal
from app.config import settings
from app.models import User, PlayerProfile, Team, ApplicationSettings, AuctionSession
from app.services.auth_service import get_password_hash

# Import Routers
from app.routers import (
    auth,
    users,
    players,
    teams,
    player_pool,
    auction,
    auction_ws,
    analytics,
    notifications
)

# Create Database Tables automatically
Base.metadata.create_all(bind=engine)

_is_production = settings.ENVIRONMENT == "production"

app = FastAPI(
    title="NPL Cricket Auction Platform API",
    version="1.0.0",
    description="Real-time web application for managing cricket player auctions with FastAPI, WebSockets & SQLAlchemy.",
    # Disable interactive docs in production — they expose full API structure
    docs_url=None if _is_production else "/docs",
    redoc_url=None if _is_production else "/redoc",
    openapi_url=None if _is_production else "/openapi.json",
)


# ─────────────────────────────────────────────────────────────────────────────
# CORS Configuration
#
# allow_origin_regex covers ALL Vercel preview & production URLs automatically
# (e.g. npl-cricket-auction-xyz-meghal.vercel.app) so no manual updates needed.
#
# To add extra origins at runtime set the CORS_ORIGINS env var (comma-separated):
#   CORS_ORIGINS=https://your-custom-domain.com
# ─────────────────────────────────────────────────────────────────────────────
_env_origins = os.getenv("CORS_ORIGINS", "")
_extra_origins = [o.strip() for o in _env_origins.split(",") if o.strip()]

ALLOWED_ORIGINS = [
    # Local development
    "http://localhost:3000",
    "http://localhost:5173",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5173",
    # Vercel production deployment (explicit)
    "https://npl-cricket-auction.vercel.app",
    # sslip.io HTTPS backend domain (for API docs)
    "https://92-4-76-201.sslip.io",
] + _extra_origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    # Regex covers ALL *.vercel.app subdomains — production + every preview URL
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept", "Origin", "X-Requested-With"],
    expose_headers=["Content-Range", "X-Total-Count"],
    max_age=600,
)

# Mount Static Uploads Folder
upload_path = os.path.join(os.getcwd(), settings.UPLOAD_DIR)
os.makedirs(upload_path, exist_ok=True)
app.mount("/static/uploads", StaticFiles(directory=upload_path), name="static")

# Include Routers
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(players.router)
app.include_router(teams.router)
app.include_router(player_pool.router)
app.include_router(player_pool.wishlist_router)
app.include_router(auction.router)
app.include_router(auction_ws.router)
app.include_router(analytics.router)
app.include_router(notifications.router)

def run_db_column_migrations():
    db = SessionLocal()
    try:
        # Check SQLite / DB table info for missing columns
        conn = db.connection()
        cursor = conn.connection.cursor()
        cursor.execute("PRAGMA table_info(player_profiles)")
        columns = [row[1] for row in cursor.fetchall()]

        if "is_submitted" not in columns:
            db.execute(text("ALTER TABLE player_profiles ADD COLUMN is_submitted BOOLEAN DEFAULT 0"))
        if "is_shopfloor" not in columns:
            db.execute(text("ALTER TABLE player_profiles ADD COLUMN is_shopfloor BOOLEAN DEFAULT 0"))

        db.commit()
    except Exception as e:
        print(f"DB Migration Notice: {e}")
        db.rollback()
    finally:
        db.close()

@app.on_event("startup")
def startup_db_seed():
    run_db_column_migrations()
    
    db = SessionLocal()
    try:
        # Default Settings Seed
        default_settings = {
            "team_budget": "50000000",
            "base_price": "500000",
            "timer_seconds": "30",
            "min_players": "11",
            "max_players": "11",
            "timer_reset_on_bid": "true"
        }
        for key, val in default_settings.items():
            existing = db.query(ApplicationSettings).filter(ApplicationSettings.key == key).first()
            if not existing:
                db.add(ApplicationSettings(key=key, value=val))

        # Admin Seed User if none exists
        admin = db.query(User).filter(User.role == "admin").first()
        if not admin:
            admin_user = User(
                name="System Administrator",
                email="admin@nikkisoceig.com",
                password_hash=get_password_hash("NPL@Admin2026!"),
                role="admin",
                department="Management"
            )
            db.add(admin_user)

        # Active Auction Session Seed
        session = db.query(AuctionSession).first()
        if not session:
            db.add(AuctionSession(status="not_started", timer_seconds=30))

        db.commit()
    finally:
        db.close()

@app.get("/")
def root_check():
    return {
        "status": "online",
        "app": "NPL Cricket Auction Platform Backend API",
        "docs_url": "/docs"
    }
