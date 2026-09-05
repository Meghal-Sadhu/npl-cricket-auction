import asyncio
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models.user import User
from app.models.auction import AuctionSession, AuctionQueue, Bid
from app.models.player import PlayerProfile
from app.models.team import Team, TeamPlayer
from app.models.settings import ApplicationSettings
from app.models.notification import Notification
from app.core.websocket_manager import manager
from app.services.budget_service import calculate_team_budget_metrics
from sqlalchemy import func
import logging

logger = logging.getLogger(__name__)

class AuctionEngine:
    def __init__(self):
        self.timer_task: Optional[asyncio.Task] = None
        self.timer_seconds: int = 30
        self.is_running: bool = False
        self.intermission_seconds: Optional[int] = None
        self.last_sold_info: Optional[Dict[str, Any]] = None

    def sync_auction_queue(self, db: Session, session_id: int):
        # 1. Identify all exempt User IDs (Only Captains are exempt; Admins and Players enter auction pool!)
        exempt_user_ids = set()
        for t in db.query(Team).all():
            if t.captain_id:
                exempt_user_ids.add(t.captain_id)
        for u in db.query(User).filter(User.role == "captain").all():
            exempt_user_ids.add(u.id)

        # 2. Remove any captain exempt users from the queue if present
        if exempt_user_ids:
            exempt_profiles = db.query(PlayerProfile).filter(PlayerProfile.user_id.in_(exempt_user_ids)).all()
            exempt_profile_ids = [p.id for p in exempt_profiles]
            if exempt_profile_ids:
                db.query(AuctionQueue).filter(
                    AuctionQueue.session_id == session_id,
                    AuctionQueue.player_id.in_(exempt_profile_ids)
                ).delete(synchronize_session=False)
                db.commit()

        # 3. Ensure all users with role 'player' or 'admin' have a PlayerProfile record
        existing_profile_user_ids = set(r[0] for r in db.query(PlayerProfile.user_id).all())
        players_without_profile = db.query(User).filter(
            User.role.in_(["player", "admin"]),
            ~User.id.in_(existing_profile_user_ids) if existing_profile_user_ids else True
        ).all()
        for p_user in players_without_profile:
            db.add(PlayerProfile(
                user_id=p_user.id,
                category="Batsman",
                batting_style="Right Hand",
                bowling_style="Regular Bowler",
                base_price=500000.0,
                is_sold=False,
                is_submitted=False
            ))
        if players_without_profile:
            db.commit()

        # 4. Find all unsold non-exempt players not yet queued in this session
        existing_queued_player_ids = set(
            r[0] for r in db.query(AuctionQueue.player_id).filter(AuctionQueue.session_id == session_id).all()
        )

        query = db.query(PlayerProfile).join(User).filter(PlayerProfile.is_sold == False)
        if exempt_user_ids:
            query = query.filter(~User.id.in_(exempt_user_ids))

        all_eligible_players = query.all()
        unqueued_players = [p for p in all_eligible_players if p.id not in existing_queued_player_ids]

        if unqueued_players:
            max_order = db.query(AuctionQueue).filter(AuctionQueue.session_id == session_id).count()
            for idx, p in enumerate(unqueued_players):
                db.add(AuctionQueue(
                    session_id=session_id,
                    player_id=p.id,
                    order_index=max_order + idx + 1,
                    status="queued"
                ))
            db.commit()

        # 5. Clean up any orphaned 'current' statuses so only session.current_player_id is marked 'current'
        session = db.query(AuctionSession).filter(AuctionSession.id == session_id).first()
        if session:
            if session.current_player_id:
                db.query(AuctionQueue).filter(
                    AuctionQueue.session_id == session_id,
                    AuctionQueue.status == "current",
                    AuctionQueue.player_id != session.current_player_id
                ).update({"status": "queued"}, synchronize_session=False)
            else:
                db.query(AuctionQueue).filter(
                    AuctionQueue.session_id == session_id,
                    AuctionQueue.status == "current"
                ).update({"status": "queued"}, synchronize_session=False)
            db.commit()

    def get_full_state(self, db: Session, user_role: str = "admin", user_team_id: Optional[int] = None, sync_queue: bool = False) -> Dict[str, Any]:
        session = db.query(AuctionSession).order_by(AuctionSession.id.desc()).first()
        if not session:
            session = AuctionSession(status="not_started", timer_seconds=30)
            db.add(session)
            db.commit()
            db.refresh(session)

        # Sync queue only on explicit demand or if queue is completely uninitialized
        queue_count = db.query(AuctionQueue).filter(AuctionQueue.session_id == session.id).count()
        if sync_queue or queue_count == 0:
            self.sync_auction_queue(db, session.id)

        # Dynamic Default Timer setting lookup
        timer_setting = db.query(ApplicationSettings).filter(ApplicationSettings.key == "timer_seconds").first()
        configured_timer = int(timer_setting.value) if timer_setting else 30
        
        display_timer = self.intermission_seconds if session.status == "intermission" and self.intermission_seconds is not None else (self.timer_seconds if self.is_running else configured_timer)

        current_player = None
        highest_bid = None
        highest_bidder_team = None

        if session.current_player_id:
            player = db.query(PlayerProfile).filter(PlayerProfile.id == session.current_player_id).first()
            if player:
                current_player = {
                    "id": player.id,
                    "name": player.user.name if player.user else "Unknown Player",
                    "employee_id": player.employee_id or f"EMP-{player.id:03d}",
                    "department": player.user.department if player.user else "General",
                    "category": player.category or "Batsman",
                    "batting_style": player.batting_style or "Right Hand",
                    "bowling_style": player.bowling_style or "Regular Bowler",
                    "experience_level": player.experience_level or "Intermediate",
                    "base_price": player.base_price or 500000.0,
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

        # Fetch recent bids with Captain Name and Increment Amount
        recent_bids = []
        if session.current_player_id and current_player:
            bids_list = db.query(Bid).filter(
                Bid.session_id == session.id,
                Bid.player_id == session.current_player_id
            ).order_by(Bid.created_at.asc()).all()

            prev_amount = current_player["base_price"]
            temp_bids = []
            for b in bids_list:
                inc = max(0.0, b.amount - prev_amount)
                capt_name = b.team.captain.name if b.team and b.team.captain else "Captain"
                temp_bids.append({
                    "id": b.id,
                    "team_id": b.team_id,
                    "team_name": b.team.name,
                    "team_logo": b.team.logo_path,
                    "captain_name": capt_name,
                    "amount": b.amount,
                    "increment": inc,
                    "created_at": b.created_at.isoformat()
                })
                prev_amount = b.amount

            recent_bids = list(reversed(temp_bids))[:15]

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

        # Fetch Teams with Budget metrics visible for Franchise Overview
        teams_list = []
        teams = db.query(Team).all()
        for t in teams:
            metrics = calculate_team_budget_metrics(t, db)
            
            teams_list.append({
                "id": t.id,
                "name": t.name,
                "logo_path": t.logo_path,
                "captain_id": t.captain_id,
                "captain_name": t.captain.name if t.captain else "None",
                "budget_total": metrics["budget_total"],
                "budget_used": metrics["budget_used"],
                "reserved_budget": metrics["reserved_budget"],
                "spendable_budget": metrics["spendable_budget"],
                "players_count": metrics["total_assigned_players"],
                "total_assigned_players": metrics["total_assigned_players"],
                "is_squad_full": metrics["is_squad_full"]
            })

        cooldown_setting = db.query(ApplicationSettings).filter(ApplicationSettings.key == "bidding_cooldown_seconds").first()
        bidding_cooldown = float(cooldown_setting.value) if cooldown_setting else 3.5

        return {
            "session_id": session.id,
            "status": session.status,
            "timer_seconds": display_timer,
            "bidding_cooldown_seconds": bidding_cooldown,
            "intermission_seconds": self.intermission_seconds if session.status == "intermission" else None,
            "last_sold_info": self.last_sold_info if session.status == "intermission" else None,
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
            await manager.broadcast({
                "event": "TIMER_TICK",
                "timer_seconds": self.timer_seconds,
                "extra": {"timer_seconds": self.timer_seconds}
            })

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
                team = db.query(Team).filter(Team.id == last_bid.team_id).first()
                if team:
                    metrics = calculate_team_budget_metrics(team, db)
                    if last_bid.amount > metrics["spendable_budget"]:
                        if queue_entry:
                            queue_entry.status = "unsold"
                        notif = Notification(
                            message=f"⚠️ SALE CANCELLED! Bid of ₹{last_bid.amount:,.0f} by {team.name} exceeds available spendable budget (₹{metrics['spendable_budget']:,.0f}). Player {player.user.name} marked unsold.",
                            type="warning"
                        )
                        db.add(notif)
                        db.commit()
                        return

                # Player Sold!
                player.is_sold = True
                if queue_entry:
                    queue_entry.status = "sold"

                # Assign or update team assignment
                existing_tp = db.query(TeamPlayer).filter(TeamPlayer.player_id == player.id).first()
                if existing_tp:
                    existing_tp.team_id = last_bid.team_id
                    existing_tp.purchase_price = last_bid.amount
                else:
                    team_player = TeamPlayer(
                        team_id=last_bid.team_id,
                        player_id=player.id,
                        purchase_price=last_bid.amount
                    )
                    db.add(team_player)

                db.flush()
                # Recalculate and sync budget_used on team
                if team:
                    team_used = db.query(func.coalesce(func.sum(TeamPlayer.purchase_price), 0.0)).filter(TeamPlayer.team_id == team.id).scalar()
                    team.budget_used = float(team_used)

                # Notification
                notif = Notification(
                    message=f"🎉 SOLD! {player.user.name} sold to {last_bid.team.name} for ₹{last_bid.amount:,.0f}!",
                    type="success"
                )
                db.add(notif)
                db.commit()

                self.last_sold_info = {
                    "player_name": player.user.name,
                    "team_name": last_bid.team.name,
                    "amount": last_bid.amount,
                    "image_path": player.image_path,
                    "is_unsold": False
                }

                await self.broadcast_state(event_type="PLAYER_SOLD", extra=self.last_sold_info)

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

                self.last_sold_info = {
                    "player_name": player.user.name,
                    "team_name": "UNSOLD",
                    "amount": player.base_price,
                    "image_path": player.image_path,
                    "is_unsold": True
                }

                await self.broadcast_state(event_type="PLAYER_UNSOLD", extra=self.last_sold_info)

            # Customizable Intermission Break (default 15 seconds)
            break_setting = db.query(ApplicationSettings).filter(ApplicationSettings.key == "intermission_seconds").first()
            break_len = int(break_setting.value) if break_setting and break_setting.value else 15

            # Set status to "intermission" during break so no bids can be placed
            session.status = "intermission"
            db.commit()

            for remaining in range(break_len, 0, -1):
                self.intermission_seconds = remaining
                await manager.broadcast({
                    "event": "INTERMISSION_TICK",
                    "timer_seconds": remaining,
                    "intermission_seconds": remaining,
                    "extra": {
                        "timer_seconds": remaining,
                        "intermission_seconds": remaining,
                        "last_sold_info": self.last_sold_info
                    }
                })
                await asyncio.sleep(1)

            # Auto-resume auction to next player!
            session.status = "live"
            db.commit()
            await self.advance_to_next_player(db)

        except Exception as e:
            logger.error(f"Error handling timer expired: {e}")
            db.rollback()
        finally:
            db.close()

    async def advance_to_next_player(self, db: Session):
        session = db.query(AuctionSession).order_by(AuctionSession.id.desc()).first()
        if not session:
            return

        # Clear last sold info and intermission state for new player
        self.last_sold_info = None
        self.intermission_seconds = None

        # Find next queued player
        next_queue = db.query(AuctionQueue).filter(
            AuctionQueue.session_id == session.id,
            AuctionQueue.status == "queued"
        ).order_by(AuctionQueue.order_index.asc()).first()

        if next_queue:
            session.current_player_id = next_queue.player_id
            session.status = "live"
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
