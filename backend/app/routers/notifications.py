from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models.user import User
from app.models.notification import Notification
from app.core.security import get_current_user

router = APIRouter(prefix="/api/notifications", tags=["Notifications"])

@router.get("")
def list_notifications(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    notifications = db.query(Notification).filter(
        (Notification.user_id == current_user.id) | (Notification.user_id == None)
    ).order_by(Notification.created_at.desc()).limit(20).all()

    return [{
        "id": n.id,
        "type": n.type,
        "message": n.message,
        "is_read": n.is_read,
        "created_at": n.created_at.isoformat()
    } for n in notifications]

@router.put("/{notification_id}/read")
def mark_notification_read(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    notif = db.query(Notification).filter(Notification.id == notification_id).first()
    if notif:
        notif.is_read = True
        db.commit()
    return {"message": "Notification marked as read"}
