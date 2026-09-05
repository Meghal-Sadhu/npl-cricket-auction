from sqlalchemy.orm import Session
from app.models.team import Team, TeamPlayer
from app.models.player import PlayerProfile
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
    
    # Check if team captain's player profile is already present in team_players table
    captain_user_id = team.captain_id
    captain_already_in_team_players = False
    if captain_user_id:
        captain_profile = db.query(PlayerProfile).filter(PlayerProfile.user_id == captain_user_id).first()
        if captain_profile:
            captain_already_in_team_players = any(tp.player_id == captain_profile.id for tp in team_players)

    # Count total unique assigned players (Captain + Purchased Auction Players)
    if captain_user_id and not captain_already_in_team_players:
        total_assigned = len(team_players) + 1
    else:
        total_assigned = len(team_players)
    
    # Slots remaining to reach minimum target squad size
    remaining_slots = max(0, squad_target - total_assigned)
    
    # Reserved budget for display (all remaining slots * base_price)
    reserved_budget = float(remaining_slots * base_price)
    
    # For active player bidding, reserve base price ONLY for SUBSEQUENT remaining slots (excluding the active player)
    # e.g., if target is 11 and total_assigned is 1 (captain), 10 slots remain. The current active player fills 1 slot,
    # so we only reserve base price for the remaining 9 future slots (9 * 5 Lakh = ₹45 Lakh).
    future_reserved_slots = max(0, remaining_slots - 1)
    future_reserved_budget = float(future_reserved_slots * base_price)
    
    # Maximum spendable budget for placing bids on the active player
    max_bid_limit = float(team.budget_total - actual_budget_used - future_reserved_budget)
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
