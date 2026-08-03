from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from app.schemas.player import PlayerProfileOut

class TeamBase(BaseModel):
    name: str
    budget_total: float = 50000000.0 # ₹5 Crore

class TeamCreate(TeamBase):
    captain_id: Optional[int] = None

class TeamUpdate(BaseModel):
    name: Optional[str] = None
    captain_id: Optional[int] = None
    budget_total: Optional[float] = None

class TeamAllocatePlayer(BaseModel):
    team_id: int
    purchase_price: float = 500000.0

class TeamPlayerOut(BaseModel):
    id: int
    player_id: int
    purchase_price: float
    purchased_at: datetime
    player: PlayerProfileOut

    class Config:
        from_attributes = True

class TeamOut(TeamBase):
    id: int
    logo_path: Optional[str] = None
    captain_id: Optional[int] = None
    captain_name: Optional[str] = None
    budget_used: float
    reserved_budget: float = 0.0
    spendable_budget: float = 0.0
    players_count: int = 0
    created_at: datetime
    players: List[TeamPlayerOut] = []

    class Config:
        from_attributes = True
