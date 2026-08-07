from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database import get_db
from app.models.user import User
from app.schemas.user import UserOut, RoleUpdate
from app.core.security import get_current_user, require_roles

router = APIRouter(prefix="/api/users", tags=["Users"])

@router.get("", response_model=List[UserOut])
def list_users(
    role: Optional[str] = None,
    department: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin"]))
):
    query = db.query(User)
    if role:
        query = query.filter(User.role == role)
    if department:
        query = query.filter(User.department == department)
    if search:
        query = query.filter(
            (User.name.ilike(f"%{search}%")) | (User.email.ilike(f"%{search}%"))
        )
    return query.order_by(User.id.desc()).all()

@router.put("/{user_id}/role", response_model=UserOut)
def update_user_role(
    user_id: int,
    role_in: RoleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin"]))
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if role_in.role not in ["admin", "captain", "player"]:
        raise HTTPException(status_code=400, detail="Invalid role specified")

    user.role = role_in.role
    db.commit()
    db.refresh(user)
    return user

@router.put("/{user_id}/toggle-active", response_model=UserOut)
def toggle_user_active(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin"]))
):
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot deactivate your own admin account.")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    user.is_active = not user.is_active
    db.commit()
    db.refresh(user)
    return user

@router.delete("/{user_id}")
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin"]))
):
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot delete your own admin account.")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Safe cascade cleanup of user relations before account deletion
    from app.models.team import Team, TeamPlayer
    from app.models.player import PlayerProfile
    from app.models.auction import Bid, AuctionQueue
    from app.models.notification import Notification

    # 1. Unlink as captain from any team
    teams = db.query(Team).filter(Team.captain_id == user_id).all()
    for t in teams:
        t.captain_id = None

    # 2. Cleanup PlayerProfile and associated bids, team assignments, auction queue items
    profile = db.query(PlayerProfile).filter(PlayerProfile.user_id == user_id).first()
    if profile:
        db.query(TeamPlayer).filter(TeamPlayer.player_id == profile.id).delete(synchronize_session=False)
        db.query(Bid).filter(Bid.player_id == profile.id).delete(synchronize_session=False)
        db.query(AuctionQueue).filter(AuctionQueue.player_id == profile.id).delete(synchronize_session=False)
        db.delete(profile)

    # 3. Clean notifications
    db.query(Notification).filter(Notification.user_id == user_id).delete(synchronize_session=False)

    # 4. Delete user account
    db.delete(user)
    db.commit()
    return {"message": f"User {user.name} deleted successfully"}
