from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import List, Optional
import os
import uuid
from pydantic import BaseModel
from app.database import get_db
from app.models.user import User
from app.models.player import PlayerProfile
from app.models.settings import ApplicationSettings
from app.schemas.player import PlayerProfileCreate, PlayerProfileUpdate, PlayerProfileOut, AdminPlayerCreate
from app.core.security import get_current_user, require_roles
from app.services.auth_service import get_password_hash
from app.config import settings

router = APIRouter(prefix="/api/players", tags=["Players"])

UPLOAD_FOLDER = os.path.join(os.getcwd(), settings.UPLOAD_DIR)
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    department: Optional[str] = None
    employee_id: Optional[str] = None
    age: Optional[int] = None
    mobile: Optional[str] = None
    jersey_name: Optional[str] = None
    jersey_number: Optional[str] = None
    tshirt_size: Optional[str] = None
    category: Optional[str] = None
    batting_style: Optional[str] = None
    bowling_style: Optional[str] = None
    experience_level: Optional[str] = None
    emergency_contact: Optional[str] = None
    bio: Optional[str] = None
    achievements: Optional[str] = None
    preferred_batting_order: Optional[str] = None

def enrich_player_out(player: PlayerProfile) -> PlayerProfileOut:
    out = PlayerProfileOut.model_validate(player)
    if player.user:
        out.user_name = player.user.name
        out.user_email = player.user.email
        out.department = player.user.department
    if player.team_player and player.team_player.team:
        out.team_name = player.team_player.team.name
    return out

@router.get("", response_model=List[PlayerProfileOut])
def list_players(
    category: Optional[str] = None,
    experience: Optional[str] = None,
    is_sold: Optional[bool] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(PlayerProfile).join(User)
    if category:
        query = query.filter(PlayerProfile.category == category)
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

@router.get("/me", response_model=PlayerProfileOut)
def get_my_player_profile(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    profile = db.query(PlayerProfile).filter(PlayerProfile.user_id == current_user.id).first()
    if not profile:
        profile = PlayerProfile(user_id=current_user.id, category="Batsman", base_price=500000.0)
        db.add(profile)
        db.commit()
        db.refresh(profile)
    return enrich_player_out(profile)

@router.put("/profile/me")
def update_my_user_and_player_profile(
    profile_in: ProfileUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    profile = db.query(PlayerProfile).filter(PlayerProfile.user_id == current_user.id).first()
    if not profile:
        profile = PlayerProfile(user_id=current_user.id)
        db.add(profile)

    # Check if profile was already submitted by non-admin
    is_already_submitted = profile.is_submitted and current_user.role != "admin"

    if not is_already_submitted:
        if profile_in.name:
            current_user.name = profile_in.name
        if profile_in.department:
            current_user.department = profile_in.department

        for field, value in profile_in.model_dump(exclude_unset=True).items():
            if field not in ["name", "department"] and hasattr(profile, field) and value is not None:
                setattr(profile, field, value)
    else:
        # Once submitted, ONLY Jersey Specifications are allowed to be modified by non-admin!
        if profile_in.jersey_name is not None:
            profile.jersey_name = profile_in.jersey_name
        if profile_in.jersey_number is not None:
            profile.jersey_number = str(profile_in.jersey_number)[:2]
        if profile_in.tshirt_size is not None:
            profile.tshirt_size = profile_in.tshirt_size

    # Mark profile as submitted
    profile.is_submitted = True

    db.commit()
    db.refresh(profile)
    return enrich_player_out(profile)

@router.post("/admin-create", response_model=PlayerProfileOut)
def admin_create_player(
    p_in: AdminPlayerCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin"]))
):
    # Handle Shopfloor Employee vs Normal Account Creation
    if p_in.is_shopfloor:
        emp_code = p_in.employee_id or uuid.uuid4().hex[:6]
        user_email = f"shopfloor_{emp_code}@npl.local"
        user_password = uuid.uuid4().hex[:10]
    else:
        if not p_in.email:
            raise HTTPException(status_code=400, detail="Email address is required for regular users.")
        if not p_in.password:
            raise HTTPException(status_code=400, detail="Password is required for regular users.")
        
        user_email = p_in.email
        user_password = p_in.password

        existing_user = db.query(User).filter(User.email == user_email).first()
        if existing_user:
            raise HTTPException(status_code=400, detail="User with this email already exists")

    # Fixed base price of ₹5 Lakh
    default_base = 500000.0

    # Create User account
    user = User(
        name=p_in.name,
        email=user_email,
        password_hash=get_password_hash(user_password),
        role="player",
        department=p_in.department or ("Shopfloor" if p_in.is_shopfloor else "General")
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # Create Full PlayerProfile
    profile = PlayerProfile(
        user_id=user.id,
        employee_id=p_in.employee_id or f"EMP-{user.id:03d}",
        age=p_in.age,
        mobile=p_in.mobile,
        jersey_name=p_in.jersey_name,
        jersey_number=p_in.jersey_number,
        tshirt_size=p_in.tshirt_size,
        category=p_in.category,
        batting_style=p_in.batting_style,
        bowling_style=p_in.bowling_style,
        experience_level=p_in.experience_level,
        emergency_contact=p_in.emergency_contact,
        bio=p_in.bio,
        achievements=p_in.achievements,
        preferred_batting_order=p_in.preferred_batting_order,
        base_price=default_base,
        is_submitted=True,
        is_shopfloor=p_in.is_shopfloor
    )
    db.add(profile)
    db.commit()
    db.refresh(profile)

    return enrich_player_out(profile)

@router.post("/register-profile", response_model=PlayerProfileOut)
def register_or_update_profile(
    profile_in: PlayerProfileCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    profile = db.query(PlayerProfile).filter(PlayerProfile.user_id == current_user.id).first()
    if not profile:
        profile = PlayerProfile(user_id=current_user.id, **profile_in.model_dump())
        profile.is_submitted = True
        db.add(profile)
    else:
        is_already_submitted = profile.is_submitted and current_user.role != "admin"
        if not is_already_submitted:
            for field, value in profile_in.model_dump().items():
                setattr(profile, field, value)
        else:
            profile.jersey_name = profile_in.jersey_name
            profile.jersey_number = str(profile_in.jersey_number)[:2] if profile_in.jersey_number else None
            profile.tshirt_size = profile_in.tshirt_size

        profile.is_submitted = True

    db.commit()
    db.refresh(profile)
    return enrich_player_out(profile)

@router.post("/upload-photo")
async def upload_player_photo(
    player_id: Optional[int] = None,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if player_id and current_user.role == "admin":
        profile = db.query(PlayerProfile).filter(PlayerProfile.id == player_id).first()
    else:
        profile = db.query(PlayerProfile).filter(PlayerProfile.user_id == current_user.id).first()

    if profile and profile.is_submitted and current_user.role != "admin" and not player_id:
        raise HTTPException(status_code=400, detail="Profile photo cannot be modified after initial submission.")

    if file.content_type not in ["image/jpeg", "image/png", "image/webp"]:
        raise HTTPException(status_code=400, detail="Only JPG, PNG, and WEBP images are allowed")

    contents = await file.read()
    if len(contents) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Image size exceeds 5 MB maximum limit")

    ext = file.filename.split(".")[-1] if "." in file.filename else "jpg"
    target_id = profile.id if profile else current_user.id
    filename = f"player_{target_id}_{uuid.uuid4().hex[:8]}.{ext}"
    file_path = os.path.join(UPLOAD_FOLDER, filename)

    with open(file_path, "wb") as f:
        f.write(contents)

    relative_url = f"/static/uploads/{filename}"

    if profile:
        profile.image_path = relative_url
        db.commit()

    return {"image_path": relative_url}

@router.get("/{player_id}", response_model=PlayerProfileOut)
def get_player_profile(player_id: int, db: Session = Depends(get_db)):
    profile = db.query(PlayerProfile).filter(PlayerProfile.id == player_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Player not found")
    return enrich_player_out(profile)

@router.put("/{player_id}", response_model=PlayerProfileOut)
def admin_update_player_profile(
    player_id: int,
    profile_in: PlayerProfileUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin"]))
):
    profile = db.query(PlayerProfile).filter(PlayerProfile.id == player_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Player not found")
    for field, value in profile_in.model_dump(exclude_unset=True).items():
        setattr(profile, field, value)
    db.commit()
    db.refresh(profile)
    return enrich_player_out(profile)

@router.delete("/{player_id}")
def admin_delete_player_profile(
    player_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin"]))
):
    profile = db.query(PlayerProfile).filter(PlayerProfile.id == player_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Player not found")
    db.delete(profile)
    db.commit()
    return {"message": "Player deleted successfully"}
