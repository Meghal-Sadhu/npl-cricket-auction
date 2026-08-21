from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Dict, Any, List
import csv
import io

from app.database import get_db
from app.models.user import User
from app.models.player import PlayerProfile
from app.models.team import Team, TeamPlayer
from app.models.auction import AuctionQueue
from app.core.security import get_current_user, require_roles
from app.services.budget_service import calculate_team_budget_metrics

router = APIRouter(prefix="/api/analytics", tags=["Analytics"])

@router.get("/dashboard")
def get_admin_dashboard_metrics(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    total_users = db.query(User).count()
    total_captains = db.query(User).filter(User.role == "captain").count()
    total_players = db.query(PlayerProfile).count()
    total_teams = db.query(Team).count()

    sold_players_count = db.query(PlayerProfile).filter(PlayerProfile.is_sold == True).count()
    unsold_players_count = db.query(AuctionQueue).filter(AuctionQueue.status == "unsold").count()
    remaining_players_count = max(0, total_players - sold_players_count)

    # Price stats
    price_stats = db.query(
        func.max(TeamPlayer.purchase_price).label("highest"),
        func.min(TeamPlayer.purchase_price).label("lowest"),
        func.avg(TeamPlayer.purchase_price).label("average")
    ).first()

    highest_price = price_stats.highest if price_stats and price_stats.highest else 0.0
    lowest_price = price_stats.lowest if price_stats and price_stats.lowest else 0.0
    avg_price = price_stats.average if price_stats and price_stats.average else 0.0

    # Highest sold player details
    highest_sold_player = None
    if highest_price > 0:
        top_tp = db.query(TeamPlayer).order_by(TeamPlayer.purchase_price.desc()).first()
        if top_tp and top_tp.player:
            highest_sold_player = {
                "name": top_tp.player.user.name if top_tp.player.user else "Unknown",
                "team": top_tp.team.name if top_tp.team else "Unknown",
                "price": top_tp.purchase_price,
                "category": top_tp.player.category,
                "image_path": top_tp.player.image_path
            }

    # Category distribution
    categories_query = db.query(
        PlayerProfile.category,
        func.count(PlayerProfile.id)
    ).group_by(PlayerProfile.category).all()
    category_distribution = {cat: count for cat, count in categories_query}

    # Department distribution
    depts_query = db.query(
        User.department,
        func.count(User.id)
    ).filter(User.department != None).group_by(User.department).all()
    department_distribution = {dept: count for dept, count in depts_query if dept}

    # Team spend breakdown
    team_breakdown = []
    most_expensive_team = None
    cheapest_team = None
    max_spend = -1.0
    min_spend = 9999999999.0

    teams = db.query(Team).all()
    for t in teams:
        metrics = calculate_team_budget_metrics(t, db)
        item = {
            "team_id": t.id,
            "team_name": t.name,
            "logo_path": t.logo_path,
            "captain_name": t.captain.name if t.captain else "None",
            "budget_total": metrics["budget_total"],
            "budget_used": metrics["budget_used"],
            "spendable_budget": metrics["spendable_budget"],
            "player_count": metrics["total_assigned_players"]
        }
        team_breakdown.append(item)

        if metrics["budget_used"] > max_spend:
            max_spend = metrics["budget_used"]
            most_expensive_team = t.name
        if metrics["budget_used"] < min_spend:
            min_spend = metrics["budget_used"]
            cheapest_team = t.name

    completion_percentage = round((sold_players_count / total_players * 100), 1) if total_players > 0 else 0.0

    return {
        "kpis": {
            "total_users": total_users,
            "total_players": total_players,
            "total_captains": total_captains,
            "total_teams": total_teams,
            "sold_players": sold_players_count,
            "unsold_players": unsold_players_count,
            "remaining_players": remaining_players_count,
            "completion_percentage": completion_percentage,
            "highest_price": highest_price,
            "lowest_price": lowest_price,
            "avg_price": round(avg_price, 2),
            "most_expensive_team": most_expensive_team or "N/A",
            "cheapest_team": cheapest_team or "N/A"
        },
        "highest_sold_player": highest_sold_player,
        "category_distribution": category_distribution,
        "department_distribution": department_distribution,
        "team_spend_breakdown": team_breakdown
    }

@router.get("/export-jersey-specs-csv")
def export_jersey_specs_csv(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin"]))
):
    players = db.query(PlayerProfile).join(User).all()

    output = io.StringIO()
    writer = csv.writer(output)

    # Header
    writer.writerow([
        "Player ID", "Full Name", "Email Address", "Department", 
        "Employee ID", "Category", "Jersey Name", "Jersey Number", 
        "T-Shirt Size", "Batting Style", "Bowling Style", 
        "Shopfloor Employee", "Franchise Team", "Status", "Acquisition Price (INR)"
    ])

    for p in players:
        team_name = p.team_player.team.name if (p.team_player and p.team_player.team) else "Unassigned"
        price = p.team_player.purchase_price if p.team_player else 0.0
        status = "Sold" if p.is_sold else "Available"
        writer.writerow([
            p.id,
            p.user.name if p.user else "",
            p.user.email if p.user else "",
            p.user.department if p.user else "",
            p.employee_id or "",
            p.category or "",
            p.jersey_name or "",
            p.jersey_number or "",
            p.tshirt_size or "",
            p.batting_style or "",
            p.bowling_style or "",
            "Yes" if p.is_shopfloor else "No",
            team_name,
            status,
            f"{price:.2f}"
        ])

    output.seek(0)
    headers = {
        'Content-Disposition': 'attachment; filename=npl_jersey_specifications.csv'
    }
    return StreamingResponse(output, media_type="text/csv", headers=headers)

@router.get("/export-player-pool-csv")
def export_player_pool_csv(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin", "captain"]))
):
    players = db.query(PlayerProfile).join(User).all()

    output = io.StringIO()
    writer = csv.writer(output)

    # Header (Excludes player image as requested)
    writer.writerow([
        "Player ID", "Full Name", "Department", "Employee ID", 
        "Category", "Batting Style", "Bowling Style", "Experience Level", 
        "Base Price (INR)", "Age", "Mobile Number", "Jersey Name", 
        "Jersey Number", "T-Shirt Size", "Bio", "Achievements", 
        "Status", "Franchise Team", "Acquisition Price (INR)"
    ])

    for p in players:
        team_name = p.team_player.team.name if (p.team_player and p.team_player.team) else "Unassigned"
        price = p.team_player.purchase_price if p.team_player else 0.0
        status = "Sold" if p.is_sold else "Available"
        writer.writerow([
            p.id,
            p.user.name if p.user else "",
            p.user.department if p.user else "",
            p.employee_id or "",
            p.category or "Batsman",
            p.batting_style or "Right Hand",
            p.bowling_style or "Regular Bowler",
            p.experience_level or "Intermediate",
            f"{p.base_price:.2f}",
            p.age or "",
            p.mobile or "",
            p.jersey_name or "",
            p.jersey_number or "",
            p.tshirt_size or "",
            p.bio or "",
            p.achievements or "",
            status,
            team_name,
            f"{price:.2f}"
        ])

    output.seek(0)
    headers = {
        'Content-Disposition': 'attachment; filename=npl_player_pool_analysis.csv'
    }
    return StreamingResponse(output, media_type="text/csv", headers=headers)
