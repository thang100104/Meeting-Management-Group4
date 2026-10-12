from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.api.deps import get_current_active_user
from app.models.user import User
from app.models.notification import MeetingNotification
from app.services.reminders import visible_notifications

router = APIRouter()


@router.get("")
def list_notifications(db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    rows = visible_notifications(db, current_user.user_id).order_by(MeetingNotification.created_at.desc()).limit(100).all()
    return [{
        "id": str(n.notification_id), "title": n.title, "description": n.content,
        "createdAt": n.created_at.isoformat() + "Z", "type": "meeting_reminder",
        "isRead": n.is_read, "meetingId": n.meeting_id,
        "startTime": n.meeting_start_time.isoformat() + "+07:00",
        "link": "/schedules",
    } for n in rows]


@router.patch("/read-all")
def read_all(db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    db.query(MeetingNotification).filter_by(recipient_user_id=current_user.user_id, is_read=False).update({"is_read": True})
    db.commit()
    return {"message": "Đã đánh dấu tất cả thông báo là đã đọc"}


@router.patch("/{notification_id}/read")
def read_notification(notification_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    row = db.query(MeetingNotification).filter_by(notification_id=notification_id, recipient_user_id=current_user.user_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Không tìm thấy thông báo")
    row.is_read = True
    db.commit()
    return {"message": "Đã đọc thông báo"}
