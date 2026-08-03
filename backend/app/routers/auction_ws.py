from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from sqlalchemy.orm import Session
import json
import logging
from app.database import SessionLocal
from app.core.websocket_manager import manager
from app.services.auth_service import decode_access_token
from app.models.user import User
from app.models.team import Team
from app.models.player import PlayerProfile
from app.models.auction import AuctionSession, Bid
from app.models.settings import ApplicationSettings
from app.services.bid_service import validate_bid
from app.services.auction_engine import auction_engine

logger = logging.getLogger(__name__)
router = APIRouter(tags=["WebSockets"])

@router.websocket("/ws/auction")
async def auction_websocket(websocket: WebSocket, token: str = None):
    await manager.connect(websocket)
    db = SessionLocal()

    current_user = None
    if token:
        payload = decode_access_token(token)
        if payload and "sub" in payload:
            user_id = int(payload.get("sub"))
            current_user = db.query(User).filter(User.id == user_id).first()

    try:
        # Send initial state dump on connection
        state = auction_engine.get_full_state(db)
        await websocket.send_json({"event": "INIT_STATE", "data": state})

        while True:
            data_text = await websocket.receive_text()
            try:
                msg = json.loads(data_text)
                action = msg.get("action")

                if action == "PLACE_BID":
                    bid_amount = float(msg.get("amount", 0))

                    if not current_user:
                        await websocket.send_json({
                            "event": "BID_ERROR",
                            "message": "Unauthorized. Valid JWT token required to bid."
                        })
                        continue

                    if current_user.role not in ["captain", "admin"]:
                        await websocket.send_json({
                            "event": "BID_ERROR",
                            "message": "Only Captains and Admins can place auction bids."
                        })
                        continue

                    # Fetch Captain's team
                    captain_team = db.query(Team).filter(Team.captain_id == current_user.id).first()
                    if not captain_team and current_user.role == "admin":
                        # If admin is bidding directly, check if team_id passed in msg
                        team_id = msg.get("team_id")
                        if team_id:
                            captain_team = db.query(Team).filter(Team.id == team_id).first()

                    if not captain_team:
                        await websocket.send_json({
                            "event": "BID_ERROR",
                            "message": "You are not assigned as captain to any team."
                        })
                        continue

                    session = db.query(AuctionSession).order_by(AuctionSession.id.desc()).first()
                    if not session or session.status != "live" or not session.current_player_id:
                        status_str = session.status.upper() if session else "NOT STARTED"
                        await websocket.send_json({
                            "event": "BID_ERROR",
                            "message": f"Auction is currently {status_str}. Admin must start/resume auction to place bids."
                        })
                        continue

                    # Current player lookup
                    active_player = db.query(PlayerProfile).filter(PlayerProfile.id == session.current_player_id).first()
                    if not active_player:
                        await websocket.send_json({
                            "event": "BID_ERROR",
                            "message": "No active player found for bidding."
                        })
                        continue

                    # Current price calculation
                    highest_bid = db.query(Bid).filter(
                        Bid.session_id == session.id,
                        Bid.player_id == session.current_player_id
                    ).order_by(Bid.amount.desc()).first()

                    current_price = highest_bid.amount if highest_bid else active_player.base_price

                    # Validate Bid using bid_service rules
                    is_valid, err_msg = validate_bid(captain_team, bid_amount, current_price, db)
                    if not is_valid:
                        await websocket.send_json({
                            "event": "BID_ERROR",
                            "message": err_msg
                        })
                        continue

                    # Place Bid!
                    new_bid = Bid(
                        session_id=session.id,
                        player_id=session.current_player_id,
                        team_id=captain_team.id,
                        amount=bid_amount
                    )
                    db.add(new_bid)
                    db.commit()

                    # Timer reset if configured
                    timer_setting = db.query(ApplicationSettings).filter(ApplicationSettings.key == "timer_seconds").first()
                    timer_len = int(timer_setting.value) if timer_setting else 30
                    reset_setting = db.query(ApplicationSettings).filter(ApplicationSettings.key == "timer_reset_on_bid").first()
                    should_reset = reset_setting.value.lower() == "true" if reset_setting else True

                    if should_reset:
                        await auction_engine.start_timer(timer_len)

                    # Broadcast new bid update
                    await auction_engine.broadcast_state(event_type="NEW_BID", extra={
                        "bidder_team": captain_team.name,
                        "amount": bid_amount
                    })

                elif action == "PING":
                    await websocket.send_json({"event": "PONG"})

            except json.JSONDecodeError:
                await websocket.send_json({"event": "BID_ERROR", "message": "Invalid JSON message format"})

    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        manager.disconnect(websocket)
    finally:
        db.close()
