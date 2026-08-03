from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base

class Team(Base):
    __tablename__ = "teams"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False)
    logo_path = Column(String(255), nullable=True)
    captain_id = Column(Integer, ForeignKey("users.id"), nullable=True, unique=True)
    budget_total = Column(Float, default=50000000.0) # Default ₹5 Crore
    budget_used = Column(Float, default=0.0)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    captain = relationship("User", back_populates="captain_team")
    team_players = relationship("TeamPlayer", back_populates="team", cascade="all, delete-orphan")
    bids = relationship("Bid", back_populates="team")


class TeamPlayer(Base):
    __tablename__ = "team_players"

    id = Column(Integer, primary_key=True, index=True)
    team_id = Column(Integer, ForeignKey("teams.id"), nullable=False)
    player_id = Column(Integer, ForeignKey("player_profiles.id"), nullable=False, unique=True)
    purchase_price = Column(Float, nullable=False)
    purchased_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    team = relationship("Team", back_populates="team_players")
    player = relationship("PlayerProfile", back_populates="team_player")
