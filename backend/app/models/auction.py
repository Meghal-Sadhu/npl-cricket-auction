from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base

class AuctionSession(Base):
    __tablename__ = "auction_sessions"

    id = Column(Integer, primary_key=True, index=True)
    status = Column(String(20), default="not_started", nullable=False) # not_started, live, paused, held, completed
    current_player_id = Column(Integer, ForeignKey("player_profiles.id"), nullable=True)
    timer_seconds = Column(Integer, default=30)
    started_at = Column(DateTime, nullable=True)
    ended_at = Column(DateTime, nullable=True)

    # Relationships
    queue_entries = relationship("AuctionQueue", back_populates="session", cascade="all, delete-orphan")
    bids = relationship("Bid", back_populates="session", cascade="all, delete-orphan")


class AuctionQueue(Base):
    __tablename__ = "auction_queue"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("auction_sessions.id"), nullable=False)
    player_id = Column(Integer, ForeignKey("player_profiles.id"), nullable=False)
    order_index = Column(Integer, nullable=False, default=0)
    status = Column(String(20), default="queued", nullable=False) # queued, current, sold, unsold

    # Relationships
    session = relationship("AuctionSession", back_populates="queue_entries")
    player = relationship("PlayerProfile", back_populates="queue_entries")


class Bid(Base):
    __tablename__ = "bids"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("auction_sessions.id"), nullable=False)
    player_id = Column(Integer, ForeignKey("player_profiles.id"), nullable=False)
    team_id = Column(Integer, ForeignKey("teams.id"), nullable=False)
    amount = Column(Float, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    session = relationship("AuctionSession", back_populates="bids")
    player = relationship("PlayerProfile", back_populates="bids")
    team = relationship("Team", back_populates="bids")
