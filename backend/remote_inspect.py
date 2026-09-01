import sqlite3
import glob

db_path = glob.glob('/home/ubuntu/npl-cricket-auction/**/*.db', recursive=True)[0]
print(f"Opening DB: {db_path}")

conn = sqlite3.connect(db_path)
c = conn.cursor()

total_users = c.execute("SELECT count(*) FROM users").fetchone()[0]
captains = c.execute("SELECT id, name, email, role FROM users WHERE role='captain'").fetchall()
team_captains = c.execute("SELECT DISTINCT captain_id FROM teams WHERE captain_id IS NOT NULL").fetchall()
total_profiles = c.execute("SELECT count(*) FROM player_profiles").fetchone()[0]
sold_profiles = c.execute("SELECT count(*) FROM player_profiles WHERE is_sold = 1").fetchone()[0]
queue_count = c.execute("SELECT count(*) FROM auction_queue").fetchone()[0]
session_id = c.execute("SELECT id, current_player_id FROM auction_sessions ORDER BY id DESC LIMIT 1").fetchone()

print(f"Total Users: {total_users}")
print(f"Captains by Role ({len(captains)}): {captains}")
print(f"Captains in Teams ({len(team_captains)}): {team_captains}")
print(f"Total Profiles: {total_profiles}")
print(f"Sold Profiles: {sold_profiles}")
print(f"Queue Count: {queue_count}")
print(f"Session Info: {session_id}")

# Check users without profile
users_without_profile = c.execute("SELECT id, name, email, role FROM users WHERE id NOT IN (SELECT user_id FROM player_profiles)").fetchall()
print(f"Users without Profile ({len(users_without_profile)}): {users_without_profile}")

conn.close()
