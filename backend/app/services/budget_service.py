from sqlalchemy.orm import Session
from app.models.team import Team, TeamPlayer
from app.models.settings import ApplicationSettings

DEFAULT_BASE_PRICE = 500000.0 # ₹5 Lakh
SQUAD_TARGET = 11

def get_base_price(db: Session) -> float:
    setting = db.query(ApplicationSettings).filter(ApplicationSettings.key == "base_price").first()
    return float(setting.value) if setting else DEFAULT_BASE_PRICE

def calculate_team_budget_metrics(team: Team, db: Session) -> dict:
    base_price = get_base_price(db)
    
    # Purchased non-captain players in team_players table
    team_players = db.query(TeamPlayer).filter(TeamPlayer.team_id == team.id).all()
    actual_budget_used = sum(tp.purchase_price for tp in team_players)
    
    # Check if captain is assigned to team
    captain_assigned = 1 if team.captain_id else 0
    
    # Total assigned players count
    total_assigned = len(team_players) + captain_assigned
    
    # Slots remaining to reach target squad of 11
    remaining_slots = max(0, SQUAD_TARGET - total_assigned)
    
    # Reserved amount for remaining slots
    reserved_budget = float(remaining_slots * base_price)
    
    # Maximum spendable budget
    spendable_budget = float(team.budget_total - actual_budget_used - reserved_budget)
    
    return {
        "budget_total": float(team.budget_total),
        "budget_used": float(actual_budget_used),
        "reserved_budget": max(0.0, reserved_budget),
        "spendable_budget": max(0.0, spendable_budget),
        "total_assigned_players": total_assigned,
        "remaining_slots": remaining_slots,
        "is_squad_full": total_assigned >= SQUAD_TARGET
    }
