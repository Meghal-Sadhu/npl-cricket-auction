from pydantic import BaseModel
from typing import Dict, Any

class SettingsUpdate(BaseModel):
    settings: Dict[str, Any]

class SettingsOut(BaseModel):
    team_budget: float = 50000000.0 # ₹5 Crore
    base_price: float = 500000.0 # ₹5 Lakh
    timer_seconds: int = 30
    min_players: int = 11
    max_players: int = 11
    timer_reset_on_bid: bool = True
