from typing import List, Tuple
from sqlalchemy.orm import Session
from app.models.team import Team
from app.services.budget_service import calculate_team_budget_metrics

ONE_CRORE = 10000000.0 # 100 Lakhs = 1 Crore

def get_allowed_increments(current_price: float) -> List[float]:
    """
    Tiered Bid Rules:
    Current Price below ₹1 Crore: +₹5 Lakh (500,000) & +₹10 Lakh (1,000,000)
    Current Price ₹1 Crore or above: +₹15 Lakh (1,500,000) & +₹20 Lakh (2,000,000)
    """
    if current_price < ONE_CRORE:
        return [500000.0, 1000000.0]
    else:
        return [1500000.0, 2000000.0]

from app.models.auction import AuctionSession, Bid

def validate_bid(team: Team, bid_amount: float, current_price: float, session: AuctionSession, db: Session) -> Tuple[bool, str]:
    metrics = calculate_team_budget_metrics(team, db)
    
    if metrics["is_squad_full"]:
        return False, f"Team '{team.name}' has already completed its squad limit of {metrics.get('squad_target', 15)} players."
        
    # Prevent consecutive bids from the same team
    highest_bid = db.query(Bid).filter(
        Bid.session_id == session.id,
        Bid.player_id == session.current_player_id
    ).order_by(Bid.amount.desc()).first()

    if highest_bid and highest_bid.team_id == team.id:
        return False, f"Your team '{team.name}' is already the highest bidder! Wait for another team to place a bid."

    if bid_amount <= current_price:
        return False, f"Bid amount (₹{bid_amount:,.0f}) must be higher than current price (₹{current_price:,.0f})."
        
    price_difference = bid_amount - current_price
    allowed_increments = get_allowed_increments(current_price)
    
    if price_difference not in allowed_increments and bid_amount != current_price + allowed_increments[0] and bid_amount != current_price + allowed_increments[1]:
        # Allow exact increment match
        valid = any(abs(bid_amount - (current_price + inc)) < 0.01 for inc in allowed_increments)
        if not valid:
            return False, f"Invalid bid increment. Allowed increments for current price are: {', '.join([f'₹{inc:,.0f}' for inc in allowed_increments])}"
            
    if bid_amount > (metrics["budget_used"] + metrics["spendable_budget"]):
        # Check if bid amount exceeds team spendable budget
        if bid_amount > metrics["spendable_budget"]:
            return False, f"Bid of ₹{bid_amount:,.0f} exceeds maximum spendable budget (₹{metrics['spendable_budget']:,.0f}) after reserving base price for remaining slots."

    return True, "Bid valid"
