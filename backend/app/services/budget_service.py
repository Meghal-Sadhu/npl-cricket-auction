from sqlalchemy.orm import Session
from app.models.team import Team, TeamPlayer
from app.models.settings import ApplicationSettings

DEFAULT_BASE_PRICE = 500000.0 # ₹5 Lakh
SQUAD_TARGET = 11

def get_base_price(db: Session) -> float:
    setting = db.query(ApplicationSettings).filter(ApplicationSettings.key == "base_price").first()
    return float(setting.value) if setting and setting.value else DEFAULT_BASE_PRICE

def get_target_squad_size(db: Session) -> int:
    setting = db.query(ApplicationSettings).filter(
        ApplicationSettings.key.in_(["min_players", "min_squad_size"])
    ).first()
    if setting and setting.value:
        try:
            return int(float(setting.value))
        except ValueError:
            pass
    return 11

def calculate_team_budget_metrics(team: Team, db: Session) -> dict:
    base_price = get_base_price(db)
    squad_target = get_target_squad_size(db)
    
    # Purchased non-captain players in team_players table
    team_players = db.query(TeamPlayer).filter(TeamPlayer.team_id == team.id).all()
    actual_budget_used = sum(tp.purchase_price for tp in team_players)
    
    # Check if captain is assigned to team
    captain_assigned = 1 if team.captain_id else 0
    
    # Total assigned players count (Captain + Purchased Auction Players)
    total_assigned = len(team_players) + captain_assigned
    
    # Slots remaining to reach minimum target squad size
    remaining_slots = max(0, squad_target - total_assigned)
    
    # Reserved budget = remaining_slots * base_price
    # e.g., if target is 11, and captain is present (total_assigned = 1), 10 slots remain -> 10 * 5 Lakh = ₹50 Lakh reserved
    reserved_budget = float(remaining_slots * base_price)
    
    # Maximum spendable budget for placing bids
    max_bid_limit = float(team.budget_total - actual_budget_used - reserved_budget)
    spendable_budget = max(0.0, max_bid_limit)
    
    return {
        "budget_total": float(team.budget_total),
        "budget_used": float(actual_budget_used),
        "reserved_budget": max(0.0, reserved_budget),
        "spendable_budget": spendable_budget,
        "max_bid_limit": spendable_budget,
        "total_assigned_players": total_assigned,
        "remaining_slots": remaining_slots,
        "squad_target": squad_target,
        "is_squad_full": total_assigned >= squad_target
    }
