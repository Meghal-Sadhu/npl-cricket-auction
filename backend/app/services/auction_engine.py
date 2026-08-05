import asyncio
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models.auction import AuctionSession, AuctionQueue, Bid
from app.models.player import PlayerProfile
from app.models.team import Team, TeamPlayer
from app.models.settings import ApplicationSettings
from app.models.notification import Notification
from app.core.websocket_manager import manager
from app.services.budget_service import calculate_team_budget_metrics
import logging

logger = logging.getLogger(__name__)

class AuctionEngine:
    def __init__(self):
        self.timer_task: Optional[asyncio.Task] = None
        self.timer_seconds: int = 30
        self.is_running: bool = False

    def sync_auction_queue(self, db: Session, session_id: int):
        # 1. Identify all captain User IDs across Team records and User roles
        captain_user_ids = set()
        for t in db.query(Team).all():
            if t.captain_id:
                captain_user_ids.add(t.captain_id)
        for u in db.query(User).filter(User.role == "captain").all():
            captain_user_ids.add(u.id)

        # 2. Remove any captains from the queue if present
        if captain_user_ids:
            captain_profiles = db.query(PlayerProfile).filter(PlayerProfile.user_id.in_(captain_user_ids)).all()
            captain_profile_ids = [p.id for p in captain_profiles]
            if captain_profile_ids:
                db.query(AuctionQueue).filter(
                    AuctionQueue.session_id == session_id,
                    AuctionQueue.player_id.in_(captain_profile_ids)
                ).delete(synchronize_session=False)
                db.commit()

        # 3. Find all unsold non-captain players not yet queued in this session
        existing_queued_player_ids = set(
            r[0] for r in db.query(AuctionQueue.player_id).filter(AuctionQueue.session_id == session_id).all()
        )

        query = db.query(PlayerProfile).join(User).filter(PlayerProfile.is_sold == False)
        if captain_user_ids:
            query = query.filter(~User.id.in_(captain_user_ids))

        all_eligible_players = query.all()
        unqueued_players = [p for p in all_eligible_players if p.id not in existing_queued_player_ids]

        if unqueued_players:
            max_order = db.query(AuctionQueue).filter(AuctionQueue.session_id == session_id).count()
            for idx, p in enumerate(unqueued_players):
                db.add(AuctionQueue(
                    session_id=session_id,
                    player_id=p.id,
                    order_index=max_order + idx,
                    status="queued"
                ))
            db.commit()

    def get_full_state(self, db: Session, user_role: str = "admin", user_team_id: Optional[int] = None) -> Dict[str, Any]:
        session = db.query(AuctionSession).order_by(AuctionSession.id.desc()).first()
        if not session:
            session = AuctionSession(status="not_started", timer_seconds=30)
            db.add(session)
            db.commit()
            db.refresh(session)

        # Auto-sync queue to ensure all non-captain players are queued
        self.sync_auction_queue(db, session.id)

        # Dynamic Default Timer setting lookup
        timer_setting = db.query(ApplicationSettings).filter(ApplicationSettings.key == "timer_seconds").first()
        configured_timer = int(timer_setting.value) if timer_setting else 30
        display_timer = self.timer_seconds if self.is_running else configured_timer

        current_player = None
        highest_bid = None
        highest_bidder_team = None

        if session.current_player_id:
            player = db.query(PlayerProfile).filter(PlayerProfile.id == session.current_player_id).first()
            if player:
                current_player = {
                    "id": player.id,
                    "name": player.user.name if player.user else "Unknown Player",
                    "employee_id": player.employee_id,
                    "department": player.user.department if player.user else "",
                    "category": player.category,
                    "batting_style": player.batting_style,
                    "bowling_style": player.bowling_style,
                    "experience_level": player.experience_level,
                    "base_price": player.base_price,
                    "image_path": player.image_path,
                    "bio": player.bio,
                    "achievements": player.achievements
                }
                
                # Fetch highest bid for current player
                last_bid = db.query(Bid).filter(
                    Bid.session_id == session.id,
                    Bid.player_id == player.id
                ).order_by(Bid.amount.desc()).first()

                if last_bid:
                    highest_bid = last_bid.amount
                    highest_bidder_team = {
                        "id": last_bid.team.id,
                        "name": last_bid.team.name,
                        "logo_path": last_bid.team.logo_path
                    }

        # Fetch recent bids
        recent_bids = []
        if session.current_player_id:
            bids_list = db.query(Bid).filter(
                Bid.session_id == session.id,
                Bid.player_id == session.current_player_id
            ).order_by(Bid.created_at.desc()).limit(15).all()

            for b in bids_list:
                recent_bids.append({
                    "id": b.id,
                    "team_id": b.team_id,
                    "team_name": b.team.name,
                    "team_logo": b.team.logo_path,
                    "amount": b.amount,
                    "created_at": b.created_at.isoformat()
                })

        # Fetch Queue
        queue_items = []
        queue = db.query(AuctionQueue).filter(
            AuctionQueue.session_id == session.id
        ).order_by(AuctionQueue.order_index.asc()).all()

        for q in queue:
            p = q.player
            if not p:
                continue

            computed_status = q.status
            if p.is_sold:
                computed_status = "sold"

            queue_items.append({
                "id": q.id,
                "player_id": p.id,
                "order_index": q.order_index,
                "status": computed_status,
                "is_sold": p.is_sold,
                "player_name": p.user.name if p.user else "",
                "category": p.category,
                "base_price": p.base_price,
                "image_path": p.image_path
            })

        # Fetch Teams with Budget privacy for Captains/Players
        teams_list = []
        teams = db.query(Team).all()
        for t in teams:
            metrics = calculate_team_budget_metrics(t, db)
            
            # Privacy rule: Only Admin or the Team's own Captain can see budget numbers!
            show_budget = (user_role == "admin") or (user_team_id and user_team_id == t.id)
            
            teams_list.append({
                "id": t.id,
                "name": t.name,
                "logo_path": t.logo_path,
                "captain_id": t.captain_id,
                "captain_name": t.captain.name if t.captain else "None",
                "budget_total": metrics["budget_total"] if show_budget else None,
                "budget_used": metrics["budget_used"] if show_budget else None,
                "reserved_budget": metrics["reserved_budget"] if show_budget else None,
                "spendable_budget": metrics["spendable_budget"] if show_budget else None,
                "players_count": metrics["total_assigned_players"],
                "total_assigned_players": metrics["total_assigned_players"],
                "is_squad_full": metrics["is_squad_full"]
            })

        return {
            "session_id": session.id,
            "status": session.status,
            "timer_seconds": display_timer,
            "current_player": current_player,
            "highest_bid": highest_bid,
            "highest_bidder_team": highest_bidder_team,
            "bids": recent_bids,
            "queue": queue_items,
            "teams": teams_list
        }

    async def broadcast_state(self, event_type: str = "STATE_UPDATE", extra: Optional[Dict[str, Any]] = None):
        db = SessionLocal()
        try:
            state = self.get_full_state(db)
            payload = {
                "event": event_type,
                "data": state
            }
            if extra:
                payload["extra"] = extra
            await manager.broadcast(payload)
        finally:
            db.close()

    async def start_timer(self, initial_seconds: int = 30):
        self.timer_seconds = initial_seconds
        self.is_running = True

        if self.timer_task and not self.timer_task.done():
            self.timer_task.cancel()

        self.timer_task = asyncio.create_task(self._timer_loop())

    def stop_timer(self):
        self.is_running = False
        if self.timer_task and not self.timer_task.done():
            self.timer_task.cancel()

    async def _timer_loop(self):
        while self.timer_seconds > 0 and self.is_running:
            await asyncio.sleep(1)
            self.timer_seconds -= 1
            await self.broadcast_state(event_type="TIMER_TICK", extra={"timer_seconds": self.timer_seconds})

        if self.timer_seconds == 0 and self.is_running:
            await self._handle_timer_expired()

    async def _handle_timer_expired(self):
        self.is_running = False
        db = SessionLocal()
        try:
            session = db.query(AuctionSession).order_by(AuctionSession.id.desc()).first()
            if not session or not session.current_player_id:
                return

            player = db.query(PlayerProfile).filter(PlayerProfile.id == session.current_player_id).first()
            if not player:
                return

            last_bid = db.query(Bid).filter(
                Bid.session_id == session.id,
                Bid.player_id == player.id
            ).order_by(Bid.amount.desc()).first()

            queue_entry = db.query(AuctionQueue).filter(
                AuctionQueue.session_id == session.id,
                AuctionQueue.player_id == player.id
            ).first()

            if last_bid:
                # Player Sold!
                player.is_sold = True
                if queue_entry:
                    queue_entry.status = "sold"

                # Assign to team
                team_player = TeamPlayer(
                    team_id=last_bid.team_id,
                    player_id=player.id,
                    purchase_price=last_bid.amount
                )
                db.add(team_player)

                # Deduct budget from team
                team = db.query(Team).filter(Team.id == last_bid.team_id).first()
                if team:
                    team.budget_used += last_bid.amount

                # Notification
                notif = Notification(
                    message=f"🎉 SOLD! {player.user.name} sold to {last_bid.team.name} for ₹{last_bid.amount:,.0f}!",
                    type="success"
                )
                db.add(notif)
                db.commit()

                await self.broadcast_state(event_type="PLAYER_SOLD", extra={
                    "player_name": player.user.name,
                    "team_name": last_bid.team.name,
                    "amount": last_bid.amount
                })

            else:
                # Player Unsold!
                if queue_entry:
                    queue_entry.status = "unsold"
                
                notif = Notification(
                    message=f"⚠️ UNSOLD! {player.user.name} went unsold at base price ₹{player.base_price:,.0f}.",
                    type="warning"
                )
                db.add(notif)
                db.commit()

                await self.broadcast_state(event_type="PLAYER_UNSOLD", extra={
                    "player_name": player.user.name,
                    "base_price": player.base_price
                })

            # Auto advance to next player after 3 seconds pause if session is live
            await asyncio.sleep(3)
            if session.status == "live":
                await self.advance_to_next_player(db)

        except Exception as e:
            logger.error(f"Error handling timer expired: {e}")
            db.rollback()
        finally:
            db.close()

    async def advance_to_next_player(self, db: Session):
        session = db.query(AuctionSession).order_by(AuctionSession.id.desc()).first()
        if not session or session.status != "live":
            return

        # Find next queued player
        next_queue = db.query(AuctionQueue).filter(
            AuctionQueue.session_id == session.id,
            AuctionQueue.status == "queued"
        ).order_by(AuctionQueue.order_index.asc()).first()

        if next_queue:
            session.current_player_id = next_queue.player_id
            next_queue.status = "current"
            db.commit()
            
            # Reset timer settings
            timer_setting = db.query(ApplicationSettings).filter(ApplicationSettings.key == "timer_seconds").first()
            timer_len = int(timer_setting.value) if timer_setting else 30
            await self.start_timer(timer_len)
            await self.broadcast_state(event_type="NEXT_PLAYER")
        else:
            session.current_player_id = None
            session.status = "completed"
            db.commit()
            self.stop_timer()
            await self.broadcast_state(event_type="AUCTION_COMPLETED")

auction_engine = AuctionEngine()
