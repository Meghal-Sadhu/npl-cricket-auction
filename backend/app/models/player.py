from sqlalchemy import Column, Integer, String, Float, Text, Boolean, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base

class PlayerProfile(Base):
    __tablename__ = "player_profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    employee_id = Column(String(50), nullable=True)
    age = Column(Integer, nullable=True)
    mobile = Column(String(20), nullable=True)
    jersey_name = Column(String(50), nullable=True)
    jersey_number = Column(String(20), nullable=True)
    tshirt_size = Column(String(10), nullable=True) # XS, S, M, L, XL, XXL, XXXL
    category = Column(String(50), nullable=False, default="Batsman") # Batsman, Bowler, All Rounder, Wicket Keeper
    batting_style = Column(String(50), nullable=True) # Right Hand, Left Hand
    bowling_style = Column(String(50), nullable=True) # Throw, Regular Bowler, Spin Regular, Spin Throw
    experience_level = Column(String(50), nullable=True) # Beginner, Intermediate, Advanced, Expert
    emergency_contact = Column(String(50), nullable=True)
    bio = Column(Text, nullable=True)
    availability = Column(Boolean, default=True)
    fitness_declaration = Column(Boolean, default=True)
    achievements = Column(Text, nullable=True)
    preferred_batting_order = Column(String(50), nullable=True)
    base_price = Column(Float, default=500000.0) # Default ₹5 Lakh
    image_path = Column(String(255), nullable=True)
    is_sold = Column(Boolean, default=False)
    is_submitted = Column(Boolean, default=False) # True if profile info submitted
    is_shopfloor = Column(Boolean, default=False) # True for Shopfloor employees created without email/pwd
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="player_profile")
    team_player = relationship("TeamPlayer", back_populates="player", uselist=False, cascade="all, delete-orphan")
    queue_entries = relationship("AuctionQueue", back_populates="player", cascade="all, delete-orphan")
    bids = relationship("Bid", back_populates="player")
    wishlisted_by = relationship("Wishlist", back_populates="player", cascade="all, delete-orphan")
