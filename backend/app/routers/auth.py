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


@router.post("/register", response_model=Token)
def register(user_in: UserCreate, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == user_in.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        name=user_in.name,
        email=user_in.email,
        password_hash=get_password_hash(user_in.password),
        department=user_in.department,
        role="player"  # Default role is always Player
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    access_token = create_access_token(data={"sub": str(user.id), "role": user.role})
    return Token(access_token=access_token, user=UserOut.model_validate(user))


@router.post("/login", response_model=Token)
def login(request: Request, credentials: UserLogin, db: Session = Depends(get_db)):
    # Get real client IP (respects X-Forwarded-For from nginx)
    client_ip = request.headers.get("X-Forwarded-For", request.client.host).split(",")[0].strip()

    # Rate limit check — blocks brute-force attacks
    _check_rate_limit(client_ip)

    user = db.query(User).filter(User.email == credentials.email).first()
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


@router.get("/me", response_model=UserOut)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user
