from pydantic import BaseModel
from typing import Dict, Any, Optional

class SettingsUpdate(BaseModel):
    settings: Dict[str, Any]

class SettingsOut(BaseModel):
    team_budget: float = 50000000.0 # ₹5 Crore
    base_price: float = 500000.0 # ₹5 Lakh
    timer_seconds: int = 30
    intermission_seconds: int = 15
    min_players: int = 15
    max_players: int = 18
    min_squad_size: int = 15
    timer_reset_on_bid: bool = True
    registration_closed_date: Optional[str] = None
    registration_closed: bool = False
