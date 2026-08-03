from sqlalchemy import Column, Integer, ForeignKey, DateTime, UniqueConstraint
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base

class Wishlist(Base):
    __tablename__ = "wishlists"

    id = Column(Integer, primary_key=True, index=True)
    captain_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    player_id = Column(Integer, ForeignKey("player_profiles.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (UniqueConstraint('captain_id', 'player_id', name='_captain_player_uc'),)

    # Relationships
    captain = relationship("User", back_populates="wishlists")
    player = relationship("PlayerProfile", back_populates="wishlisted_by")
