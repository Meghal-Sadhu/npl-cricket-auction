from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from collections import defaultdict
from time import time
from app.database import get_db
from app.models.user import User
from app.schemas.user import UserCreate, UserLogin, UserOut, Token
from app.services.auth_service import get_password_hash, verify_password, create_access_token
from app.core.security import get_current_user

router = APIRouter(prefix="/api/auth", tags=["Auth"])

# ─────────────────────────────────────────────────────────────────────────────
# Simple in-memory rate limiter for login endpoint
# Tracks failed attempts per IP. Resets after WINDOW_SECONDS.
# ─────────────────────────────────────────────────────────────────────────────
_login_attempts: dict = defaultdict(list)
MAX_ATTEMPTS = 10       # Max failed attempts per IP
WINDOW_SECONDS = 60     # Rolling window in seconds
LOCKOUT_SECONDS = 300   # 5-minute lockout after exceeding limit

def _check_rate_limit(ip: str) -> None:
    now = time()
    attempts = _login_attempts[ip]
    # Remove attempts outside the rolling window
    _login_attempts[ip] = [t for t in attempts if now - t < WINDOW_SECONDS]

    if len(_login_attempts[ip]) >= MAX_ATTEMPTS:
        oldest = _login_attempts[ip][0]
        wait = int(LOCKOUT_SECONDS - (now - oldest))
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Too many login attempts. Try again in {max(wait, 1)} seconds.",
            headers={"Retry-After": str(max(wait, 1))},
        )

def _record_failed_attempt(ip: str) -> None:
    _login_attempts[ip].append(time())


from sqlalchemy import func

@router.post("/register", response_model=Token)
def register(user_in: UserCreate, db: Session = Depends(get_db)):
    clean_email = user_in.email.strip().lower()

    # Enforce corporate domain restriction
    if not clean_email.endswith("@nikkisoceig.com"):
        raise HTTPException(
            status_code=400,
            detail="Registration is restricted to @nikkisoceig.com corporate email addresses."
        )

    # Case-insensitive duplicacy check
    existing = db.query(User).filter(func.lower(User.email) == clean_email).first()
    if existing:
        raise HTTPException(status_code=400, detail="An account with this email address already exists.")

    user = User(
        name=user_in.name.strip(),
        email=clean_email,
        password_hash=get_password_hash(user_in.password),
        department=user_in.department.strip() if user_in.department else "General",
        role="player"  # Default role is always Player
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    access_token = create_access_token(data={"sub": str(user.id), "role": user.role})
    return Token(access_token=access_token, user=UserOut.model_validate(user))


from sqlalchemy import func

@router.post("/login", response_model=Token)
def login(request: Request, credentials: UserLogin, db: Session = Depends(get_db)):
    # Get real client IP (respects X-Forwarded-For from nginx)
    client_ip = request.headers.get("X-Forwarded-For", request.client.host).split(",")[0].strip()

    # Rate limit check — blocks brute-force attacks
    _check_rate_limit(client_ip)

    clean_email = credentials.email.strip().lower()
    user = db.query(User).filter(func.lower(User.email) == clean_email).first()
    if not user or not verify_password(credentials.password, user.password_hash):
        _record_failed_attempt(client_ip)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Account is deactivated")

    # Clear failed attempts on successful login
    _login_attempts.pop(client_ip, None)

    access_token = create_access_token(data={"sub": str(user.id), "role": user.role})
    return Token(access_token=access_token, user=UserOut.model_validate(user))


from pydantic import BaseModel

class ResetPasswordRequest(BaseModel):
    email: str
    new_password: str

@router.post("/reset-password")
def reset_password(reset_in: ResetPasswordRequest, db: Session = Depends(get_db)):
    clean_email = reset_in.email.strip().lower()
    if not clean_email.endswith("@nikkisoceig.com"):
        raise HTTPException(
            status_code=400,
            detail="Password reset is restricted to @nikkisoceig.com corporate email addresses."
        )

    if len(reset_in.new_password) < 6:
        raise HTTPException(status_code=400, detail="New password must be at least 6 characters long.")

    user = db.query(User).filter(func.lower(User.email) == clean_email).first()
    if not user:
        raise HTTPException(status_code=404, detail="No registered account found with this corporate email address.")

    user.password_hash = get_password_hash(reset_in.new_password)
    db.commit()

    return {"message": f"Password reset successfully for {user.email}. You can now sign in with your new password."}

@router.get("/me", response_model=UserOut)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user
