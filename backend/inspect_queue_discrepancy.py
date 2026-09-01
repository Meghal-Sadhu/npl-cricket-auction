import sys
import os

# Add backend directory to sys.path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from app.database import SessionLocal
from app.models.user import User
from app.models.player import PlayerProfile
from app.models.team import Team
from app.models.auction import AuctionSession, AuctionQueue

db = SessionLocal()

total_users = db.query(User).count()
total_players = db.query(PlayerProfile).count()

captains_by_role = db.query(User).filter(User.role == "captain").all()
captains_in_teams = db.query(Team).filter(Team.captain_id.isnot(None)).all()

print(f"Total Users: {total_users}")
print(f"Total PlayerProfiles: {total_players}")
print(f"Users with role=='captain': {len(captains_by_role)} -> {[c.email for c in captains_by_role]}")
print(f"Teams with captain_id: {len(captains_in_teams)} -> {[t.captain.email for t in captains_in_teams if t.captain]}")

session = db.query(AuctionSession).order_by(AuctionSession.id.desc()).first()
if session:
    queue_count = db.query(AuctionQueue).filter(AuctionQueue.session_id == session.id).count()
    print(f"Session {session.id} status={session.status} current_player_id={session.current_player_id}")
    print(f"AuctionQueue count: {queue_count}")

db.close()
