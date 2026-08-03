from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional, Any
from datetime import datetime

class PlayerProfileBase(BaseModel):
    employee_id: Optional[str] = None
    age: Optional[int] = None
    mobile: Optional[str] = None
    jersey_name: Optional[str] = None
    jersey_number: Optional[str] = None
    tshirt_size: Optional[str] = "M"
    category: str = "Batsman"
    batting_style: Optional[str] = "Right Hand"
    bowling_style: Optional[str] = "Regular Bowler"
    experience_level: Optional[str] = "Intermediate"
    emergency_contact: Optional[str] = None
    bio: Optional[str] = None
    availability: bool = True
    fitness_declaration: bool = True
    achievements: Optional[str] = None
    preferred_batting_order: Optional[str] = "Middle Order"
    base_price: float = 500000.0

    @field_validator('jersey_number', mode='before')
    @classmethod
    def convert_jersey_number(cls, v: Any) -> Optional[str]:
        if v is None:
            return None
        return str(v)

class PlayerProfileCreate(PlayerProfileBase):
    pass

class PlayerProfileUpdate(PlayerProfileBase):
    pass

class AdminPlayerCreate(BaseModel):
    name: str
    email: Optional[str] = None
    password: Optional[str] = None
    is_shopfloor: bool = False
    department: Optional[str] = None
    employee_id: Optional[str] = None
    age: Optional[int] = None
    mobile: Optional[str] = None
    jersey_name: Optional[str] = None
    jersey_number: Optional[str] = None
    tshirt_size: Optional[str] = "M"
    category: str = "Batsman"
    batting_style: Optional[str] = "Right Hand"
    bowling_style: Optional[str] = "Regular Bowler"
    experience_level: Optional[str] = "Intermediate"
    emergency_contact: Optional[str] = None
    bio: Optional[str] = None
    achievements: Optional[str] = None
    preferred_batting_order: Optional[str] = "Middle Order"

    @field_validator('jersey_number', mode='before')
    @classmethod
    def convert_jersey_number(cls, v: Any) -> Optional[str]:
        if v is None:
            return None
        return str(v)

class PlayerProfileOut(PlayerProfileBase):
    id: int
    user_id: int
    image_path: Optional[str] = None
    is_sold: bool
    is_submitted: bool = False
    is_shopfloor: bool = False
    created_at: datetime
    # Nested user details
    user_name: Optional[str] = None
    user_email: Optional[str] = None
    department: Optional[str] = None
    team_name: Optional[str] = None

    class Config:
        from_attributes = True
