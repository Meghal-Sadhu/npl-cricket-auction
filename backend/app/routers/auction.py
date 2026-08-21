from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from typing import Dict, Any, List, Optional
import random
import os
import uuid
from pydantic import BaseModel
from app.database import get_db
from app.models.user import User
from app.models.auction import AuctionSession, AuctionQueue, Bid
from app.models.player import PlayerProfile
from app.models.team import Team, TeamPlayer
from app.models.settings import ApplicationSettings
from app.models.notification import Notification
from app.core.security import get_current_user, require_roles
from app.services.auction_engine import auction_engine
from app.services.budget_service import calculate_team_budget_metrics
from app.schemas.settings import SettingsUpdate, SettingsOut
from app.config import settings

router = APIRouter(prefix="/api/auction", tags=["Auction Controls"])

UPLOAD_FOLDER = os.path.join(os.getcwd(), settings.UPLOAD_DIR)
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

class DirectSellRequest(BaseModel):
    player_id: Optional[int] = None
    team_id: int
    price_in_lakhs: float

@router.get("/state")
def get_auction_state(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    captain_team_id = None
    if current_user.role == "captain":
        c_team = db.query(Team).filter(Team.captain_id == current_user.id).first()
        if c_team:
            captain_team_id = c_team.id

    return auction_engine.get_full_state(db, user_role=current_user.role, user_team_id=captain_team_id)

@router.post("/start")
async def start_auction(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin"]))
):
    session = db.query(AuctionSession).order_by(AuctionSession.id.desc()).first()
    if not session:
        session = AuctionSession(status="live")
        db.add(session)
    else:
        session.status = "live"

    # Auto-sync queue for all non-captain players
    auction_engine.sync_auction_queue(db, session.id)

    # Pick first player if none current
    if not session.current_player_id:
        first_q = db.query(AuctionQueue).filter(
            AuctionQueue.session_id == session.id,
            AuctionQueue.status == "queued"
        ).order_by(AuctionQueue.order_index.asc()).first()
        
        if first_q:
            session.current_player_id = first_q.player_id
            first_q.status = "current"
            db.commit()

    db.add(Notification(message="🚨 Auction Session Started!", type="info"))
    db.commit()

    timer_setting = db.query(ApplicationSettings).filter(ApplicationSettings.key == "timer_seconds").first()
    timer_len = int(timer_setting.value) if timer_setting else 30
    await auction_engine.start_timer(timer_len)
    await auction_engine.broadcast_state("AUCTION_STARTED")
    return {"message": "Auction session started"}

# Requirement 3: Direct sale at open price specified in Lakhs by Admin
@router.post("/direct-sell")
async def direct_sell_player_to_team(
    req: DirectSellRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin"]))
):
    session = db.query(AuctionSession).order_by(AuctionSession.id.desc()).first()
    if not session:
        raise HTTPException(status_code=400, detail="No active auction session.")

    target_player_id = req.player_id or session.current_player_id
    if not target_player_id:
        raise HTTPException(status_code=400, detail="No active player selected or on hammer.")

    player = db.query(PlayerProfile).filter(PlayerProfile.id == target_player_id).first()
    if not player:
        raise HTTPException(status_code=404, detail="Player not found.")

    if player.user and player.user.role == "captain":
        raise HTTPException(status_code=400, detail="Captains cannot be directly sold or allocated to any team.")

    team = db.query(Team).filter(Team.id == req.team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found.")

    price_in_rupees = req.price_in_lakhs * 100000.0
    if price_in_rupees < player.base_price:
        raise HTTPException(status_code=400, detail=f"Sale price (₹{price_in_rupees:,.0f}) cannot be less than base price (₹{player.base_price:,.0f}).")

    metrics = calculate_team_budget_metrics(team, db)
    if price_in_rupees > metrics["spendable_budget"]:
        raise HTTPException(status_code=400, detail=f"Insufficient spendable budget! Available: ₹{metrics['spendable_budget']:,.0f}, requested: ₹{price_in_rupees:,.0f}")

    auction_engine.stop_timer()

    # Mark as sold
    player.is_sold = True

    # Check and replace existing team allocation if any
    existing_tp = db.query(TeamPlayer).filter(TeamPlayer.player_id == target_player_id).first()
    if existing_tp:
        db.delete(existing_tp)

    team_player = TeamPlayer(
        team_id=team.id,
        player_id=player.id,
        purchase_price=price_in_rupees
    )
    db.add(team_player)

    # Update queue entry
    queue_entry = db.query(AuctionQueue).filter(
        AuctionQueue.session_id == session.id,
        AuctionQueue.player_id == player.id
    ).first()
    if queue_entry:
        queue_entry.status = "sold"

    # Log Bid entry
    bid = Bid(
        session_id=session.id,
        player_id=player.id,
        team_id=team.id,
        amount=price_in_rupees
    )
    db.add(bid)

    db.add(Notification(
        message=f"⚡ DIRECT SALE! {player.user.name} sold to {team.name} for ₹{price_in_rupees:,.0f} ({req.price_in_lakhs} Lakh) by Admin.",
        type="success"
    ))
    db.commit()

    await auction_engine.broadcast_state("PLAYER_SOLD", extra={
        "player_name": player.user.name,
        "team_name": team.name,
        "amount": price_in_rupees
    })

    if session.current_player_id == target_player_id:
        await auction_engine.advance_to_next_player(db)

    return {"message": f"Player {player.user.name} sold to {team.name} for ₹{price_in_rupees:,.0f}"}

@router.post("/award-player")
async def award_current_player(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin"]))
):
    session = db.query(AuctionSession).order_by(AuctionSession.id.desc()).first()
    if not session or session.status != "live" or not session.current_player_id:
        raise HTTPException(status_code=400, detail="Cannot award player when auction is not live or no active player on hammer.")

    auction_engine.stop_timer()
    await auction_engine._handle_timer_expired()
    return {"message": "Player awarded / finalized successfully"}

@router.post("/pause")
async def pause_auction(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin"]))
):
    session = db.query(AuctionSession).order_by(AuctionSession.id.desc()).first()
    if session:
        session.status = "paused"
        db.add(Notification(message="⏸️ Auction Session Paused by Admin", type="warning"))
        db.commit()
    auction_engine.stop_timer()
    await auction_engine.broadcast_state("AUCTION_PAUSED")
    return {"message": "Auction session paused"}

@router.post("/resume")
async def resume_auction(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin"]))
):
    session = db.query(AuctionSession).order_by(AuctionSession.id.desc()).first()
    if session:
        session.status = "live"
        db.add(Notification(message="▶️ Auction Session Resumed!", type="info"))
        db.commit()
    await auction_engine.start_timer(auction_engine.timer_seconds)
    await auction_engine.broadcast_state("AUCTION_RESUMED")
    return {"message": "Auction session resumed"}

@router.post("/hold")
async def hold_auction(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin"]))
):
    session = db.query(AuctionSession).order_by(AuctionSession.id.desc()).first()
    if session:
        session.status = "held"
        db.add(Notification(message="🛑 Auction Session Put on Hold", type="warning"))
        db.commit()
    auction_engine.stop_timer()
    await auction_engine.broadcast_state("AUCTION_HELD")
    return {"message": "Auction session held"}

@router.post("/end")
async def end_auction(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin"]))
):
    session = db.query(AuctionSession).order_by(AuctionSession.id.desc()).first()
    if session:
        session.status = "completed"
        session.current_player_id = None
        db.add(Notification(message="🏆 NPL Auction Session Completed!", type="success"))
        db.commit()
    auction_engine.stop_timer()
    await auction_engine.broadcast_state("AUCTION_COMPLETED")
    return {"message": "Auction session ended"}

@router.post("/next-player")
async def next_player(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin"]))
):
    session = db.query(AuctionSession).order_by(AuctionSession.id.desc()).first()
    if not session or session.status != "live":
        raise HTTPException(status_code=400, detail="Cannot advance to next player when auction is not live. Please Start or Resume the auction first.")

    await auction_engine.advance_to_next_player(db)
    return {"message": "Advanced to next player"}

@router.post("/skip-player")
async def skip_player(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin"]))
):
    session = db.query(AuctionSession).order_by(AuctionSession.id.desc()).first()
    if not session or session.status != "live":
        raise HTTPException(status_code=400, detail="Cannot skip player when auction is not live. Please Start or Resume the auction first.")

    if session.current_player_id:
        queue_entry = db.query(AuctionQueue).filter(
            AuctionQueue.session_id == session.id,
            AuctionQueue.player_id == session.current_player_id
        ).first()
        if queue_entry:
            queue_entry.status = "unsold"
            db.commit()

    await auction_engine.advance_to_next_player(db)
    return {"message": "Player skipped"}

@router.post("/select-player/{player_id}")
async def select_player_for_auction(
    player_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin"]))
):
    session = db.query(AuctionSession).order_by(AuctionSession.id.desc()).first()
    if not session:
        raise HTTPException(status_code=400, detail="No active session found.")

    player = db.query(PlayerProfile).filter(PlayerProfile.id == player_id).first()
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")
    if player.user and player.user.role == "captain":
        raise HTTPException(status_code=400, detail="Captains cannot be put on the auction hammer.")
    if player.is_sold:
        raise HTTPException(status_code=400, detail="Player is already sold")

    queue_entry = db.query(AuctionQueue).filter(
        AuctionQueue.session_id == session.id,
        AuctionQueue.player_id == player_id
    ).first()

    if session.current_player_id and session.current_player_id != player_id:
        old_q = db.query(AuctionQueue).filter(
            AuctionQueue.session_id == session.id,
            AuctionQueue.player_id == session.current_player_id,
            AuctionQueue.status == "current"
        ).first()
        if old_q:
            old_q.status = "queued"

    session.current_player_id = player_id
    if queue_entry:
        queue_entry.status = "current"
    else:
        queue_entry = AuctionQueue(
            session_id=session.id,
            player_id=player_id,
            order_index=0,
            status="current"
        )
        db.add(queue_entry)

    db.query(Bid).filter(Bid.session_id == session.id, Bid.player_id == player_id).delete()
    db.commit()

    # Only start/reset timer if the auction session is actively live!
    if session.status == "live":
        timer_setting = db.query(ApplicationSettings).filter(ApplicationSettings.key == "timer_seconds").first()
        timer_len = int(timer_setting.value) if timer_setting else 30
        await auction_engine.start_timer(timer_len)

    await auction_engine.broadcast_state("PLAYER_SELECTED")
    return {"message": f"Player {player.user.name} put on auction hammer"}

@router.post("/revoke-player/{player_id}")
async def revoke_player_assignment(
    player_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin"]))
):
    player = db.query(PlayerProfile).filter(PlayerProfile.id == player_id).first()
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")

    team_name = ""
    team_player = db.query(TeamPlayer).filter(TeamPlayer.player_id == player_id).first()
    if team_player:
        team = db.query(Team).filter(Team.id == team_player.team_id).first()
        if team:
            team_name = team.name
            team.budget_used = max(0.0, team.budget_used - team_player.purchase_price)
        db.delete(team_player)

    player.is_sold = False

    session = db.query(AuctionSession).order_by(AuctionSession.id.desc()).first()
    if session:
        # Delete ALL previous bid history for this player so price resets to base price
        db.query(Bid).filter(Bid.player_id == player_id).delete()

        max_order = db.query(AuctionQueue).filter(AuctionQueue.session_id == session.id).count()
        queue_entry = db.query(AuctionQueue).filter(
            AuctionQueue.session_id == session.id,
            AuctionQueue.player_id == player_id
        ).first()

        if queue_entry:
            queue_entry.status = "queued"
            queue_entry.order_index = max_order + 1
        else:
            queue_entry = AuctionQueue(
                session_id=session.id,
                player_id=player_id,
                order_index=max_order + 1,
                status="queued"
            )
            db.add(queue_entry)

    db.add(Notification(
        message=f"🔄 REVOKED! {player.user.name} was revoked from {team_name or 'assigned team'} by Admin and re-queued for auction starting at base price ₹{player.base_price:,.0f}.",
        type="warning"
    ))
    db.commit()
    await auction_engine.broadcast_state("PLAYER_REVOKED")
    return {"message": f"Player {player.user.name} successfully revoked, bid history cleared, and returned to active queue"}

@router.post("/re-auction-player/{player_id}")
async def re_auction_player(
    player_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin"]))
):
    session = db.query(AuctionSession).order_by(AuctionSession.id.desc()).first()
    if not session:
        raise HTTPException(status_code=400, detail="No active session")

    player = db.query(PlayerProfile).filter(PlayerProfile.id == player_id).first()
    if player:
        team_player = db.query(TeamPlayer).filter(TeamPlayer.player_id == player_id).first()
        if team_player:
            team = db.query(Team).filter(Team.id == team_player.team_id).first()
            if team:
                team.budget_used = max(0.0, team.budget_used - team_player.purchase_price)
            db.delete(team_player)
        player.is_sold = False

    # Delete ALL previous bid history for this player
    db.query(Bid).filter(Bid.player_id == player_id).delete()

    max_order = db.query(AuctionQueue).filter(AuctionQueue.session_id == session.id).count()
    queue_entry = db.query(AuctionQueue).filter(
        AuctionQueue.session_id == session.id,
        AuctionQueue.player_id == player_id
    ).first()

    if queue_entry:
        queue_entry.status = "queued"
        queue_entry.order_index = max_order + 1
    else:
        queue_entry = AuctionQueue(
            session_id=session.id,
            player_id=player_id,
            order_index=max_order + 1,
            status="queued"
        )
        db.add(queue_entry)

    db.commit()
    await auction_engine.broadcast_state("QUEUE_UPDATED")
    return {"message": "Player re-queued for auction with bid history reset"}

# Requirement 5: Company Logo Upload & Fetch
@router.post("/company-logo")
async def upload_company_logo(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin"]))
):
    if file.content_type not in ["image/jpeg", "image/png", "image/webp", "image/svg+xml"]:
        raise HTTPException(status_code=400, detail="Only JPG, PNG, WEBP, and SVG images are allowed")

    contents = await file.read()
    ext = file.filename.split(".")[-1] if "." in file.filename else "png"
    filename = f"company_logo_{uuid.uuid4().hex[:8]}.{ext}"
    file_path = os.path.join(UPLOAD_FOLDER, filename)

    with open(file_path, "wb") as f:
        f.write(contents)

    relative_url = f"/static/uploads/{filename}"

    rec = db.query(ApplicationSettings).filter(ApplicationSettings.key == "company_logo").first()
    if not rec:
        rec = ApplicationSettings(key="company_logo", value=relative_url)
        db.add(rec)
    else:
        rec.value = relative_url

    db.commit()
    await auction_engine.broadcast_state("SETTINGS_UPDATED")
    return {"logo_path": relative_url}

@router.get("/company-logo")
def get_company_logo(db: Session = Depends(get_db)):
    rec = db.query(ApplicationSettings).filter(ApplicationSettings.key == "company_logo").first()
    return {"logo_path": rec.value if rec else None}

@router.get("/settings", response_model=SettingsOut)
def get_settings(db: Session = Depends(get_db)):
    settings_records = db.query(ApplicationSettings).all()
    setting_map = {s.key: s.value for s in settings_records}

    return SettingsOut(
        team_budget=50000000.0, # Enforce static 5 Crore
        base_price=500000.0,   # Enforce static 5 Lakh
        timer_seconds=int(setting_map.get("timer_seconds", 30)),
        intermission_seconds=int(setting_map.get("intermission_seconds", 15)),
        min_players=int(setting_map.get("min_squad_size", 15)),
        max_players=int(setting_map.get("max_squad_size", 18)),
        min_squad_size=int(setting_map.get("min_squad_size", 15)),
        timer_reset_on_bid=setting_map.get("timer_reset_on_bid", "true").lower() == "true",
        registration_closed_date=setting_map.get("registration_closed_date", None),
        registration_closed=setting_map.get("registration_closed", "false").lower() == "true",
        bidding_cooldown_seconds=float(setting_map.get("bidding_cooldown_seconds", 3.5))
    )

@router.put("/settings", response_model=SettingsOut)
async def update_settings(
    settings_in: SettingsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin"]))
):
    for key, value in settings_in.settings.items():
        if key in ["team_budget", "base_price"]:
            continue

        rec = db.query(ApplicationSettings).filter(ApplicationSettings.key == key).first()
        if not rec:
            rec = ApplicationSettings(key=key, value=str(value))
            db.add(rec)
        else:
            rec.value = str(value)

    if "timer_seconds" in settings_in.settings:
        try:
            auction_engine.timer_seconds = int(settings_in.settings["timer_seconds"])
        except Exception:
            pass

    db.add(Notification(message="⚙️ Auction Rules Updated by Admin", type="info"))
    db.commit()
    await auction_engine.broadcast_state("SETTINGS_UPDATED")
    return get_settings(db)
