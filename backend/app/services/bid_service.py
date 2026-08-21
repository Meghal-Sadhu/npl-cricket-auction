from typing import List, Tuple
from sqlalchemy.orm import Session
from app.models.team import Team
from app.services.budget_service import calculate_team_budget_metrics

ONE_CRORE = 10000000.0 # 100 Lakhs = 1 Crore

def get_allowed_increments(current_price: float) -> List[float]:
    """
    Tiered Bid Rules matching frontend options:
    Current Price <= ₹20 Lakh: +25k, +50k, +1 Lakh, +5 Lakh
    Current Price <= ₹50 Lakh: +50k, +1 Lakh, +2.5 Lakh, +5 Lakh
    Current Price <= ₹1 Crore: +1 Lakh, +2.5 Lakh, +5 Lakh, +10 Lakh
    Current Price > ₹1 Crore: +2.5 Lakh, +5 Lakh, +10 Lakh, +25 Lakh
    """
    if current_price <= 2000000.0:
        return [25000.0, 50000.0, 100000.0, 500000.0]
    elif current_price <= 5000000.0:
        return [50000.0, 100000.0, 250000.0, 500000.0]
    elif current_price <= 10000000.0:
        return [100000.0, 250000.0, 500000.0, 1000000.0]
    elif current_price <= 20000000.0:
        return [250000.0, 500000.0, 1000000.0, 2500000.0]
    else:
        return [500000.0, 1000000.0, 2500000.0, 5000000.0]

from app.models.auction import AuctionSession, Bid

def validate_bid(team: Team, bid_amount: float, current_price: float, session: AuctionSession, db: Session) -> Tuple[bool, str]:
    metrics = calculate_team_budget_metrics(team, db)
    
    if metrics["is_squad_full"]:
        return False, f"Team '{team.name}' has already completed its squad limit of {metrics.get('squad_target', 15)} players."
        
    # Prevent consecutive bids from the same team for the CURRENT active player only
    highest_bid = db.query(Bid).filter(
        Bid.session_id == session.id,
        Bid.player_id == session.current_player_id
    ).order_by(Bid.amount.desc()).first()

    if highest_bid and highest_bid.team_id == team.id:
        return False, f"Your team '{team.name}' is already the highest bidder for this player! Wait for another team to bid."

    # Bidding Cooldown Buffer Rule (Default 3.5 seconds)
    from app.models.settings import ApplicationSettings
    from datetime import datetime
    cooldown_setting = db.query(ApplicationSettings).filter(ApplicationSettings.key == "bidding_cooldown_seconds").first()
    cooldown_seconds = float(cooldown_setting.value) if cooldown_setting else 3.5

    if highest_bid and highest_bid.created_at:
        elapsed = (datetime.utcnow() - highest_bid.created_at).total_seconds()
        if elapsed < cooldown_seconds:
            remaining = cooldown_seconds - elapsed
            return False, f"⏱️ Bidding cooldown active! Please wait {remaining:.1f}s before placing next bid."

    if bid_amount <= current_price:
        return False, f"Bid amount (₹{bid_amount:,.0f}) must be higher than current price (₹{current_price:,.0f})."
        
    price_difference = round(bid_amount - current_price, 2)
    allowed_increments = get_allowed_increments(current_price)
    
    valid = any(abs(price_difference - inc) < 1.0 for inc in allowed_increments)
    if not valid:
        return False, f"Invalid bid increment. Allowed increments for current price are: {', '.join([f'₹{inc:,.0f}' for inc in allowed_increments])}"
            
    if bid_amount > (metrics["budget_used"] + metrics["spendable_budget"]):
        # Check if bid amount exceeds team spendable budget
        if bid_amount > metrics["spendable_budget"]:
            return False, f"Bid of ₹{bid_amount:,.0f} exceeds maximum spendable budget (₹{metrics['spendable_budget']:,.0f}) after reserving base price for remaining slots."

    return True, "Bid valid"
