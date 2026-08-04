from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import List, Optional
import os
import uuid
from app.database import get_db
from app.models.user import User
from app.models.team import Team, TeamPlayer
from app.models.player import PlayerProfile
from app.models.auction import AuctionQueue, AuctionSession
from app.models.notification import Notification
from app.models.settings import ApplicationSettings
from app.schemas.team import TeamCreate, TeamUpdate, TeamOut, TeamPlayerOut, TeamAllocatePlayer
from app.schemas.player import PlayerProfileOut
from app.core.security import get_current_user, require_roles
from app.services.budget_service import calculate_team_budget_metrics
from app.services.auction_engine import auction_engine
from app.config import settings

router = APIRouter(prefix="/api/teams", tags=["Teams"])

UPLOAD_FOLDER = os.path.join(os.getcwd(), settings.UPLOAD_DIR)
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

def enrich_team_out(
    team: Team,
    db: Session,
    current_user: Optional[User] = None,
    force_show_details: bool = False
) -> TeamOut:
    metrics = calculate_team_budget_metrics(team, db)
    
    # Requirement 3: Both Admin AND Captains can view full budget & purchase price details for all teams!
    is_admin = current_user and current_user.role == "admin"
    is_captain = current_user and current_user.role == "captain"
    show_details = force_show_details or is_admin or is_captain

    players_out = []
    for tp in team.team_players:
        p_out = PlayerProfileOut.model_validate(tp.player)
        if tp.player.user:
            p_out.user_name = tp.player.user.name
            p_out.user_email = tp.player.user.email
            p_out.department = tp.player.user.department
        p_out.team_name = team.name
        
        players_out.append(TeamPlayerOut(
            id=tp.id,
            player_id=tp.player_id,
            purchase_price=tp.purchase_price if show_details else 0.0,
            purchased_at=tp.purchased_at,
            player=p_out
        ))

    return TeamOut(
        id=team.id,
        name=team.name,
        logo_path=team.logo_path,
        captain_id=team.captain_id,
        captain_name=team.captain.name if team.captain else None,
        budget_total=metrics["budget_total"] if show_details else 0.0,
        budget_used=metrics["budget_used"] if show_details else 0.0,
        reserved_budget=metrics["reserved_budget"] if show_details else 0.0,
        spendable_budget=metrics["spendable_budget"] if show_details else 0.0,
        players_count=metrics["total_assigned_players"],
        created_at=team.created_at,
        players=players_out
    )

@router.get("", response_model=List[TeamOut])
def list_teams(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    teams = db.query(Team).all()
    return [enrich_team_out(t, db, current_user=current_user) for t in teams]

@router.get("/my-team", response_model=TeamOut)
def get_my_captain_team(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["captain"]))
):
    team = db.query(Team).filter(
        (Team.captain_id == current_user.id) | 
        (Team.captain.has(User.email == current_user.email))
    ).first()

    if not team:
        raise HTTPException(
            status_code=404,
            detail=f"No team assigned to your captain account '{current_user.name}'. Contact Admin."
        )

    return enrich_team_out(team, db, current_user=current_user, force_show_details=True)

@router.post("", response_model=TeamOut)
def create_team(
    name: str = Form(...),
    captain_id: Optional[int] = Form(None),
    logo: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin"]))
):
    existing = db.query(Team).filter(Team.name == name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Team with this name already exists")

    # Static budget of ₹5 Crore (50,000,000)
    fixed_budget = 50000000.0

    logo_url = None
    if logo and logo.filename:
        if logo.content_type not in ["image/jpeg", "image/png", "image/webp"]:
            raise HTTPException(status_code=400, detail="Only JPG, PNG, and WEBP images are allowed")
        
        contents = logo.file.read()
        if len(contents) > 5 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="Logo file size exceeds 5 MB maximum limit")

        ext = logo.filename.split(".")[-1] if "." in logo.filename else "jpg"
        filename = f"team_logo_{uuid.uuid4().hex[:8]}.{ext}"
        file_path = os.path.join(UPLOAD_FOLDER, filename)

        with open(file_path, "wb") as f:
            f.write(contents)

        logo_url = f"/static/uploads/{filename}"

    team = Team(
        name=name,
        budget_total=fixed_budget,
        budget_used=0.0,
        captain_id=captain_id,
        logo_path=logo_url
    )
    db.add(team)
    db.commit()
    db.refresh(team)

    if captain_id:
        c_user = db.query(User).filter(User.id == captain_id).first()
        if c_user and c_user.role != "admin":
            c_user.role = "captain"
            db.commit()

    return enrich_team_out(team, db, current_user=current_user, force_show_details=True)

@router.get("/{team_id}", response_model=TeamOut)
def get_team_detail(
    team_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    return enrich_team_out(team, db, current_user=current_user)

@router.put("/{team_id}", response_model=TeamOut)
def update_team(
    team_id: int,
    team_in: TeamUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin"]))
):
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    if team_in.name:
        team.name = team_in.name
    if team_in.captain_id is not None:
        team.captain_id = team_in.captain_id
        if team_in.captain_id:
            c_user = db.query(User).filter(User.id == team_in.captain_id).first()
            if c_user and c_user.role != "admin":
                c_user.role = "captain"

    db.commit()
    db.refresh(team)
    return enrich_team_out(team, db, current_user=current_user, force_show_details=True)

@router.post("/allocate/{player_id}")
async def direct_allocate_player(
    player_id: int,
    alloc_in: TeamAllocatePlayer,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin"]))
):
    player = db.query(PlayerProfile).filter(PlayerProfile.id == player_id).first()
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")

    team = db.query(Team).filter(Team.id == alloc_in.team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    metrics = calculate_team_budget_metrics(team, db)
    if alloc_in.purchase_price > metrics["spendable_budget"]:
        raise HTTPException(status_code=400, detail="Insufficient team spendable budget for this allocation")

    existing_tp = db.query(TeamPlayer).filter(TeamPlayer.player_id == player_id).first()
    if existing_tp:
        existing_tp.team_id = team.id
        existing_tp.purchase_price = alloc_in.purchase_price
    else:
        tp = TeamPlayer(
            team_id=team.id,
            player_id=player_id,
            purchase_price=alloc_in.purchase_price
        )
        db.add(tp)

    player.is_sold = True
    team.budget_used += alloc_in.purchase_price

    session = db.query(AuctionSession).order_by(AuctionSession.id.desc()).first()
    if session:
        queue_entry = db.query(AuctionQueue).filter(
            AuctionQueue.session_id == session.id,
            AuctionQueue.player_id == player_id
        ).first()

        if queue_entry:
            queue_entry.status = "sold"
        else:
            queue_entry = AuctionQueue(
                session_id=session.id,
                player_id=player_id,
                order_index=0,
                status="sold"
            )
            db.add(queue_entry)

    db.add(Notification(
        message=f"⚡ DIRECT ALLOCATION! {player.user.name} allocated to {team.name} for ₹{alloc_in.purchase_price:,.0f} by Admin.",
        type="success"
    ))

    db.commit()
    await auction_engine.broadcast_state("PLAYER_ALLOCATED")

    return {"message": f"Player {player.user.name} directly allocated to {team.name}"}

@router.delete("/{team_id}")
async def delete_team(
    team_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin"]))
):
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    session = db.query(AuctionSession).order_by(AuctionSession.id.desc()).first()

    assigned_players = db.query(TeamPlayer).filter(TeamPlayer.team_id == team_id).all()
    for tp in assigned_players:
        if tp.player:
            tp.player.is_sold = False
            if session:
                q_entry = db.query(AuctionQueue).filter(
                    AuctionQueue.session_id == session.id,
                    AuctionQueue.player_id == tp.player_id
                ).first()
                if q_entry:
                    q_entry.status = "unsold"

    db.delete(team)
    db.commit()
    await auction_engine.broadcast_state("TEAM_DELETED")

    return {"message": f"Franchise team '{team.name}' deleted successfully by Admin."}
