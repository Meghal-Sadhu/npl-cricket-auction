import sqlite3
import glob

db_path = glob.glob('/home/ubuntu/npl-cricket-auction/**/*.db', recursive=True)[0]
conn = sqlite3.connect(db_path)
c = conn.cursor()

session_id = c.execute("SELECT id, current_player_id FROM auction_sessions ORDER BY id DESC LIMIT 1").fetchone()
print(f"Session: {session_id}")

queue_statuses = c.execute("SELECT status, count(*) FROM auction_queue WHERE session_id = ? GROUP BY status", (session_id[0],)).fetchall()
print(f"Queue Status Breakdown: {queue_statuses}")

sold_players = c.execute("SELECT id, user_id, is_sold FROM player_profiles WHERE is_sold = 1").fetchall()
print(f"Sold Profiles ({len(sold_players)}): {sold_players}")

assigned_players = c.execute("SELECT * FROM team_players").fetchall()
print(f"Assigned Team Players ({len(assigned_players)}): {assigned_players}")

# Check any queued players where user_id in exempt captains
exempt_user_ids = [r[0] for r in c.execute("SELECT id FROM users WHERE role='captain'").fetchall()]
queued_captains = c.execute("SELECT q.id, q.player_id, u.name, u.role FROM auction_queue q JOIN player_profiles p ON q.player_id = p.id JOIN users u ON p.user_id = u.id WHERE u.id IN ({})".format(','.join(map(str, exempt_user_ids)))).fetchall()
print(f"Queued Captains ({len(queued_captains)}): {queued_captains}")

conn.close()
