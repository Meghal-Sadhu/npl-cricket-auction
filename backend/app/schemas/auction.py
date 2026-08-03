from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class BidCreate(BaseModel):
    amount: float

class BidOut(BaseModel):
    id: int
    session_id: int
    player_id: int
    team_id: int
    team_name: str
    team_logo: Optional[str] = None
    amount: float
    created_at: datetime

    class Config:
        from_attributes = True

class AuctionQueueOut(BaseModel):
    id: int
    session_id: int
    player_id: int
    order_index: int
    status: str
    player_name: str
    category: str
    base_price: float
    image_path: Optional[str] = None

    class Config:
        from_attributes = True

class AuctionStateOut(BaseModel):
    session_id: int
    status: str # not_started, live, paused, held, completed
    timer_seconds: int
    current_player: Optional[dict] = None
    highest_bid: Optional[float] = None
    highest_bidder_team: Optional[dict] = None
    bids: List[dict] = []
    queue: List[AuctionQueueOut] = []
