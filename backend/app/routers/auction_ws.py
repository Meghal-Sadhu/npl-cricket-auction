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

    current_user_id = None
    current_user_email = None
    current_user_name = None
    current_user_role = None

    if token:
        payload = decode_access_token(token)
        if payload and "sub" in payload:
            user_id = int(payload.get("sub"))
            db = SessionLocal()
            try:
                user = db.query(User).filter(User.id == user_id).first()
                if user:
                    current_user_id = user.id
                    current_user_email = user.email
                    current_user_name = user.name
                    current_user_role = user.role
            finally:
                db.close()

    try:
        # Send initial state dump on connection using short-lived DB session
        db = SessionLocal()
        try:
            state = auction_engine.get_full_state(db)
        finally:
            db.close()

        await websocket.send_json({"event": "INIT_STATE", "data": state})

        while True:
            data_text = await websocket.receive_text()
            try:
                msg = json.loads(data_text)
                action = msg.get("action")

                if action == "PLACE_BID":
                    bid_amount = float(msg.get("amount", 0))

                    if not current_user_id:
                        await websocket.send_json({
                            "event": "BID_ERROR",
                            "message": "Unauthorized. Valid JWT token required to bid."
                        })
                        continue

                    if current_user_role not in ["captain", "admin"]:
                        await websocket.send_json({
                            "event": "BID_ERROR",
                            "message": "Only Captains and Admins can place auction bids."
                        })
                        continue

                    # Process bid with isolated short-lived DB session
                    db = SessionLocal()
                    try:
                        # Fetch Captain's team by captain_id or email match
                        captain_team = db.query(Team).filter(
                            (Team.captain_id == current_user_id) |
                            (Team.captain.has(User.email == current_user_email))
                        ).first()

                        if not captain_team and current_user_role == "admin":
                            team_id = msg.get("team_id")
                            if team_id:
                                captain_team = db.query(Team).filter(Team.id == team_id).first()

                        if not captain_team:
                            await websocket.send_json({
                                "event": "BID_ERROR",
                                "message": f"Account '{current_user_name}' is not assigned as captain to any franchise team."
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

                        active_player = db.query(PlayerProfile).filter(PlayerProfile.id == session.current_player_id).first()
                        if not active_player:
                            await websocket.send_json({
                                "event": "BID_ERROR",
                                "message": "No active player found for bidding."
                            })
                            continue

                        highest_bid = db.query(Bid).filter(
                            Bid.session_id == session.id,
                            Bid.player_id == session.current_player_id
                        ).order_by(Bid.amount.desc()).first()

                        current_price = highest_bid.amount if highest_bid else active_player.base_price

                        is_valid, err_msg = validate_bid(captain_team, bid_amount, current_price, session, db)
                        if not is_valid:
                            await websocket.send_json({
                                "event": "BID_ERROR",
                                "message": err_msg
                            })
                            continue

                        new_bid = Bid(
                            session_id=session.id,
                            player_id=session.current_player_id,
                            team_id=captain_team.id,
                            amount=bid_amount
                        )
                        db.add(new_bid)
                        db.commit()

                        timer_setting = db.query(ApplicationSettings).filter(ApplicationSettings.key == "timer_seconds").first()
                        timer_len = int(timer_setting.value) if timer_setting else 30
                        reset_setting = db.query(ApplicationSettings).filter(ApplicationSettings.key == "timer_reset_on_bid").first()
                        should_reset = reset_setting.value.lower() == "true" if reset_setting else True

                        if should_reset:
                            await auction_engine.start_timer(timer_len)

                        await auction_engine.broadcast_state(event_type="NEW_BID", extra={
                            "bidder_team": captain_team.name,
                            "amount": bid_amount
                        })
                    except Exception as bid_err:
                        db.rollback()
                        logger.error(f"Error saving bid: {bid_err}")
                        await websocket.send_json({
                            "event": "BID_ERROR",
                            "message": f"Database error placing bid: {str(bid_err)}"
                        })
                    finally:
                        db.close()

                elif action == "PING":
                    await websocket.send_json({"event": "PONG"})

            except json.JSONDecodeError:
                await websocket.send_json({"event": "BID_ERROR", "message": "Invalid JSON message format"})

    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        manager.disconnect(websocket)
