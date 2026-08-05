from fastapi import APIRouter, Depends, HTTPException, status, Request
from pydantic import BaseModel
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

from app.models.player import PlayerProfile

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

    # Auto-create PlayerProfile so player is immediately present in Player Pool & Auction Queue
    profile = PlayerProfile(
        user_id=user.id,
        category="Batsman",
        base_price=500000.0,
        is_sold=False,
        is_submitted=False
    )
    db.add(profile)
    db.commit()

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
    if not user:
        _record_failed_attempt(client_ip)
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No registered account found with this email address. Please check your email or register."
        )
    if not verify_password(credentials.password, user.password_hash):
        _record_failed_attempt(client_ip)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect password. Please check your credentials and try again."
        )
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Account is deactivated")

    # Clear failed attempts on successful login
    _login_attempts.pop(client_ip, None)

    access_token = create_access_token(data={"sub": str(user.id), "role": user.role})
    return Token(access_token=access_token, user=UserOut.model_validate(user))


import random

_otp_store: dict = {}  # clean_email -> {"otp": str, "expires_at": float, "verified": bool}

class SendOtpRequest(BaseModel):
    email: str

class VerifyOtpRequest(BaseModel):
    email: str
    otp: str

class ResetPasswordWithOtpRequest(BaseModel):
    email: str
    otp: str
    new_password: str

from app.services.email_service import send_otp_email

@router.post("/send-reset-otp")
def send_reset_otp(req: SendOtpRequest, db: Session = Depends(get_db)):
    clean_email = req.email.strip().lower()
    if not clean_email.endswith("@nikkisoceig.com"):
        raise HTTPException(
            status_code=400,
            detail="OTP request is restricted to @nikkisoceig.com corporate email addresses."
        )

    user = db.query(User).filter(func.lower(User.email) == clean_email).first()
    if not user:
        raise HTTPException(status_code=404, detail="No registered account found with this corporate email address.")

    otp_code = str(random.randint(100000, 999999))
    _otp_store[clean_email] = {
        "otp": otp_code,
        "expires_at": time() + 600,  # 10 minutes validity
        "verified": False
    }

    # Dispatch email via Outlook SMTP service
    sent, err_msg = send_otp_email(clean_email, otp_code)
    if not sent:
        raise HTTPException(
            status_code=500,
            detail=err_msg
        )

    return {
        "message": f"Verification OTP code sent to {clean_email}."
    }

@router.post("/verify-reset-otp")
def verify_reset_otp(req: VerifyOtpRequest):
    clean_email = req.email.strip().lower()
    clean_otp = req.otp.strip()

    entry = _otp_store.get(clean_email)
    if not entry:
        raise HTTPException(status_code=400, detail="No OTP requested for this email address. Please request a new OTP.")

    if time() > entry["expires_at"]:
        _otp_store.pop(clean_email, None)
        raise HTTPException(status_code=400, detail="OTP has expired. Please request a new OTP.")

    if entry["otp"] != clean_otp:
        raise HTTPException(status_code=400, detail="Invalid OTP verification code. Please check and try again.")

    entry["verified"] = True
    return {"message": "OTP verified successfully. You may now create your new password.", "verified": True}

@router.post("/reset-password")
def reset_password(reset_in: ResetPasswordWithOtpRequest, db: Session = Depends(get_db)):
    clean_email = reset_in.email.strip().lower()
    clean_otp = reset_in.otp.strip()

    if not clean_email.endswith("@nikkisoceig.com"):
        raise HTTPException(
            status_code=400,
            detail="Password reset is restricted to @nikkisoceig.com corporate email addresses."
        )

    entry = _otp_store.get(clean_email)
    if not entry or not entry.get("verified") or entry.get("otp") != clean_otp:
        raise HTTPException(
            status_code=400,
            detail="OTP verification required before updating password. Please verify OTP first."
        )

    if len(reset_in.new_password) < 6:
        raise HTTPException(status_code=400, detail="New password must be at least 6 characters long.")

    user = db.query(User).filter(func.lower(User.email) == clean_email).first()
    if not user:
        raise HTTPException(status_code=404, detail="No registered account found with this corporate email address.")

    user.password_hash = get_password_hash(reset_in.new_password)
    db.commit()

    _otp_store.pop(clean_email, None)

    return {"message": f"Password updated successfully for {user.email}. You can now sign in with your new password."}

@router.get("/me", response_model=UserOut)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user
