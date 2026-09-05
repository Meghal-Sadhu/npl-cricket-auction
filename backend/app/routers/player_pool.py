from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from app.database import get_db
from app.models.user import User
from app.models.player import PlayerProfile
from app.models.team import TeamPlayer
from app.models.wishlist import Wishlist
from app.schemas.player import PlayerProfileOut
from app.core.security import get_current_user, require_roles
from app.routers.players import enrich_player_out

router = APIRouter(prefix="/api/player-pool", tags=["Player Pool & Wishlist"])
wishlist_router = APIRouter(prefix="/api/wishlist", tags=["Wishlist Direct Alias"])

@router.get("", response_model=List[PlayerProfileOut])
def get_player_pool(
    category: Optional[str] = None,
    department: Optional[str] = None,
    experience: Optional[str] = None,
    is_sold: Optional[bool] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(PlayerProfile).options(
        joinedload(PlayerProfile.user),
        joinedload(PlayerProfile.team_player).joinedload(TeamPlayer.team)
    ).outerjoin(User)
    if category:
        query = query.filter(PlayerProfile.category == category)
    if department:
        query = query.filter(User.department == department)
    if experience:
        query = query.filter(PlayerProfile.experience_level == experience)
    if is_sold is not None:
        query = query.filter(PlayerProfile.is_sold == is_sold)
    if search:
        query = query.filter(
            (User.name.ilike(f"%{search}%")) |
            (PlayerProfile.employee_id.ilike(f"%{search}%")) |
            (PlayerProfile.category.ilike(f"%{search}%"))
        )

    players = query.all()
    return [enrich_player_out(p) for p in players]

@router.get("/wishlist", response_model=List[PlayerProfileOut])
def get_captain_wishlist(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["captain"]))
):
    wishlist_entries = db.query(Wishlist).filter(Wishlist.captain_id == current_user.id).all()
    players = [w.player for w in wishlist_entries if w.player]
    return [enrich_player_out(p) for p in players]

@router.post("/wishlist/{player_id}")
def add_to_wishlist(
    player_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["captain"]))
):
    player = db.query(PlayerProfile).filter(PlayerProfile.id == player_id).first()
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")

    if player.is_sold:
        raise HTTPException(status_code=400, detail="Cannot add an already sold player to wishlist")

    existing = db.query(Wishlist).filter(
        Wishlist.captain_id == current_user.id,
        Wishlist.player_id == player_id
    ).first()

    if existing:
        return {"message": "Player already in wishlist"}

    item = Wishlist(captain_id=current_user.id, player_id=player_id)
    db.add(item)
    db.commit()
    return {"message": "Player added to wishlist"}

@router.delete("/wishlist/{player_id}")
def remove_from_wishlist(
    player_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["captain"]))
):
    item = db.query(Wishlist).filter(
        Wishlist.captain_id == current_user.id,
        Wishlist.player_id == player_id
    ).first()

    if not item:
        raise HTTPException(status_code=404, detail="Wishlist item not found")

    db.delete(item)
    db.commit()
    return {"message": "Player removed from wishlist"}


# Direct /api/wishlist alias routes for extra resilience
@wishlist_router.get("", response_model=List[PlayerProfileOut])
def get_wishlist_direct(db: Session = Depends(get_db), current_user: User = Depends(require_roles(["captain"]))):
    return get_captain_wishlist(db, current_user)

@wishlist_router.post("/{player_id}")
def add_wishlist_direct(player_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_roles(["captain"]))):
    return add_to_wishlist(player_id, db, current_user)

@wishlist_router.delete("/{player_id}")
def remove_wishlist_direct(player_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_roles(["captain"]))):
    return remove_from_wishlist(player_id, db, current_user)
