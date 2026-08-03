import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database import SessionLocal, engine, Base
from app.models import User, PlayerProfile, Team, ApplicationSettings, AuctionSession
from app.services.auth_service import get_password_hash

def seed_data():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        print("[SEED] Seeding NPL Cricket Auction Database...")

        # 1. Admin User
        admin = db.query(User).filter(User.email == "admin@npl.com").first()
        if not admin:
            admin = User(
                name="Admin Manager",
                email="admin@npl.com",
                password_hash=get_password_hash("admin123"),
                role="admin",
                department="Tournament Management"
            )
            db.add(admin)
            db.commit()
            db.refresh(admin)

        # 2. Captain Users & Teams
        teams_data = [
            {"name": "Royal Strikers", "captain_name": "Rohit Sharma", "captain_email": "rohit@npl.com", "dept": "Engineering"},
            {"name": "Mumbai Titans", "captain_name": "Hardik Pandya", "captain_email": "hardik@npl.com", "dept": "Operations"},
            {"name": "Chennai Kings", "captain_name": "MS Dhoni", "captain_email": "msd@npl.com", "dept": "Finance"},
            {"name": "Delhi Chargers", "captain_name": "Rishabh Pant", "captain_email": "pant@npl.com", "dept": "Marketing"}
        ]

        for t_info in teams_data:
            captain_user = db.query(User).filter(User.email == t_info["captain_email"]).first()
            if not captain_user:
                captain_user = User(
                    name=t_info["captain_name"],
                    email=t_info["captain_email"],
                    password_hash=get_password_hash("captain123"),
                    role="captain",
                    department=t_info["dept"]
                )
                db.add(captain_user)
                db.commit()
                db.refresh(captain_user)

            team = db.query(Team).filter(Team.name == t_info["name"]).first()
            if not team:
                team = Team(
                    name=t_info["name"],
                    captain_id=captain_user.id,
                    budget_total=50000000.0, # ₹5 Crore
                    budget_used=0.0
                )
                db.add(team)

        # 3. Players Seed Data
        players_list = [
            # Batsmen
            {"name": "Virat Kohli", "email": "virat@npl.com", "category": "Batsman", "dept": "Engineering", "style": "Right Hand", "exp": "Expert", "price": 500000.0},
            {"name": "Shubman Gill", "email": "shubman@npl.com", "category": "Batsman", "dept": "Product", "style": "Right Hand", "exp": "Advanced", "price": 500000.0},
            {"name": "Suryakumar Yadav", "email": "sky@npl.com", "category": "Batsman", "dept": "Engineering", "style": "Right Hand", "exp": "Expert", "price": 500000.0},
            {"name": "Yashasvi Jaiswal", "email": "yashasvi@npl.com", "category": "Batsman", "dept": "Marketing", "style": "Left Hand", "exp": "Intermediate", "price": 500000.0},

            # Bowlers
            {"name": "Jasprit Bumrah", "email": "bumrah@npl.com", "category": "Bowler", "dept": "QA", "style": "Right Hand", "exp": "Expert", "price": 500000.0},
            {"name": "Mohammed Shami", "email": "shami@npl.com", "category": "Bowler", "dept": "Operations", "style": "Right Hand", "exp": "Expert", "price": 500000.0},
            {"name": "Kuldeep Yadav", "email": "kuldeep@npl.com", "category": "Bowler", "dept": "Finance", "style": "Left Hand", "exp": "Advanced", "price": 500000.0},
            {"name": "Yuzvendra Chahal", "email": "chahal@npl.com", "category": "Bowler", "dept": "HR", "style": "Right Hand", "exp": "Advanced", "price": 500000.0},

            # All Rounders
            {"name": "Ravindra Jadeja", "email": "jadeja@npl.com", "category": "All Rounder", "dept": "Engineering", "style": "Left Hand", "exp": "Expert", "price": 500000.0},
            {"name": "Axar Patel", "email": "axar@npl.com", "category": "All Rounder", "dept": "Operations", "style": "Left Hand", "exp": "Advanced", "price": 500000.0},
            {"name": "Washington Sundar", "email": "sundar@npl.com", "category": "All Rounder", "dept": "Product", "style": "Left Hand", "exp": "Intermediate", "price": 500000.0},

            # Wicket Keepers
            {"name": "KL Rahul", "email": "klrahul@npl.com", "category": "Wicket Keeper", "dept": "Engineering", "style": "Right Hand", "exp": "Expert", "price": 500000.0},
            {"name": "Sanju Samson", "email": "sanju@npl.com", "category": "Wicket Keeper", "dept": "Marketing", "style": "Right Hand", "exp": "Advanced", "price": 500000.0},
            {"name": "Ishan Kishan", "email": "ishan@npl.com", "category": "Wicket Keeper", "dept": "Sales", "style": "Left Hand", "exp": "Intermediate", "price": 500000.0}
        ]

        for p_info in players_list:
            p_user = db.query(User).filter(User.email == p_info["email"]).first()
            if not p_user:
                p_user = User(
                    name=p_info["name"],
                    email=p_info["email"],
                    password_hash=get_password_hash("player123"),
                    role="player",
                    department=p_info["dept"]
                )
                db.add(p_user)
                db.commit()
                db.refresh(p_user)

            profile = db.query(PlayerProfile).filter(PlayerProfile.user_id == p_user.id).first()
            if not profile:
                profile = PlayerProfile(
                    user_id=p_user.id,
                    employee_id=f"EMP-{p_user.id:03d}",
                    age=27,
                    mobile="9876543210",
                    jersey_name=p_info["name"].split()[0].upper(),
                    jersey_number=p_user.id,
                    tshirt_size="L",
                    category=p_info["category"],
                    batting_style=p_info["style"],
                    bowling_style="Spin Regular" if "Spin" in p_info["category"] else "Regular Bowler",
                    experience_level=p_info["exp"],
                    base_price=p_info["price"],
                    bio=f"Professional corporate cricket player representing {p_info['dept']}.",
                    achievements="Winner of Corporate Cup 2025."
                )
                db.add(profile)

        db.commit()
        print("[SEED] Database seeding completed successfully!")

    except Exception as e:
        print(f"[SEED ERROR] Seeding error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_data()
