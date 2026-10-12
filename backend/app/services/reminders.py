"""Persist T-15 reminders, independent of whether a browser is open."""
import asyncio
import logging
import smtplib
from datetime import datetime, timedelta
from email.message import EmailMessage
from sqlalchemy import or_, exists
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload
from app.core.config import settings
from app.core.database import SessionLocal
from app.models.meeting import Meeting, MeetingParticipant
from app.models.notification import MeetingNotification
from app.models.user import User
from app.services.meeting_time import local_meeting_time, meeting_now

logger = logging.getLogger(__name__)
REMINDER_MINUTES = 15


def visible_notifications(db: Session, user_id: int):
    """Hide reminders superseded by cancellation, rescheduling or declined RSVP."""
    invited = exists().where(
        MeetingParticipant.meeting_id == Meeting.meeting_id,
        MeetingParticipant.user_id == user_id,
        MeetingParticipant.rsvp_status != "DECLINED",
    )
    return db.query(MeetingNotification).join(Meeting, Meeting.meeting_id == MeetingNotification.meeting_id).filter(
        MeetingNotification.recipient_user_id == user_id,
        MeetingNotification.meeting_start_time == Meeting.start_time,
        Meeting.status.in_(["SCHEDULED", "APPROVED", "IN_PROGRESS", "COMPLETED"]),
        or_(Meeting.organizer_id == user_id, invited),
    )


def generate_reminders(db: Session, now: datetime | None = None) -> list[int]:
    now = local_meeting_time(now) if now else meeting_now()
    meetings = db.query(Meeting).options(
        joinedload(Meeting.room), joinedload(Meeting.participants)
    ).filter(
        Meeting.status.in_(["SCHEDULED", "APPROVED"]),
        Meeting.start_time > now,
        Meeting.start_time <= now + timedelta(minutes=REMINDER_MINUTES),
    ).all()
    created = []
    for meeting in meetings:
        recipients = {meeting.organizer_id} | {
            p.user_id for p in meeting.participants if p.rsvp_status != "DECLINED"
        }
        active_ids = {uid for (uid,) in db.query(User.user_id).filter(
            User.user_id.in_(recipients), User.status == "ACTIVE"
        ).all()}
        for uid in active_ids:
            existing = db.query(MeetingNotification.notification_id).filter_by(
                meeting_id=meeting.meeting_id, recipient_user_id=uid,
                meeting_start_time=meeting.start_time,
            ).first()
            if existing:
                continue
            location = meeting.room.room_name if meeting.room else "Trực tuyến"
            notification = MeetingNotification(
                meeting_id=meeting.meeting_id, recipient_user_id=uid,
                meeting_start_time=meeting.start_time,
                title="Nhắc lịch họp sắp bắt đầu",
                content=f'Cuộc họp "{meeting.title}" bắt đầu lúc {meeting.start_time:%H:%M %d/%m/%Y} (giờ Việt Nam), tại {location}.',
                email_status="PENDING" if settings.SMTP_HOST else "DISABLED",
            )
            try:
                # Unique constraint protects multiple workers and restarts.
                with db.begin_nested():
                    db.add(notification)
                    db.flush()
                created.append(notification.notification_id)
            except IntegrityError:
                pass
    db.commit()
    return created


def deliver_pending_emails(db: Session):
    if not settings.SMTP_HOST:
        return
    ids = [nid for (nid,) in db.query(MeetingNotification.notification_id).filter_by(email_status="PENDING").all()]
    for nid in ids:
        notification = db.get(MeetingNotification, nid)
        meeting = db.get(Meeting, notification.meeting_id)
        user = db.get(User, notification.recipient_user_id)
        valid = (meeting and user and user.status == "ACTIVE"
                 and meeting.status in ["SCHEDULED", "APPROVED"]
                 and meeting.start_time == notification.meeting_start_time
                 and meeting.start_time > meeting_now()
                 and visible_notifications(db, user.user_id).filter(MeetingNotification.notification_id == nid).first())
        if not valid:
            notification.email_status = "CANCELLED"
            db.commit()
            continue
        # Atomic claim: no automatic retries, including interrupted deliveries.
        claimed = db.query(MeetingNotification).filter_by(notification_id=nid, email_status="PENDING").update(
            {"email_status": "SENDING"}, synchronize_session=False)
        db.commit()
        if not claimed:
            continue
        try:
            message = EmailMessage()
            message["Subject"] = f"Nhắc lịch họp: {meeting.title}"
            message["From"] = settings.SMTP_FROM
            message["To"] = user.email
            message.set_content(notification.content + (f"\nLink họp: {meeting.meeting_link}" if meeting.meeting_link else ""))
            smtp_class = smtplib.SMTP_SSL if settings.SMTP_SSL else smtplib.SMTP
            with smtp_class(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as smtp:
                if settings.SMTP_STARTTLS and not settings.SMTP_SSL:
                    smtp.starttls()
                if settings.SMTP_USER:
                    smtp.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                smtp.send_message(message)
            notification.email_status = "SENT"
        except Exception as exc:
            logger.exception("Meeting reminder email failed (notification %s)", nid)
            notification.email_status = "FAILED"
            notification.email_error = str(exc)[:1000]
        db.commit()


def run_reminder_cycle():
    with SessionLocal() as db:
        generate_reminders(db)
        deliver_pending_emails(db)


async def reminder_worker(stop: asyncio.Event):
    while not stop.is_set():
        try:
            await asyncio.to_thread(run_reminder_cycle)
        except Exception:
            logger.exception("Meeting reminder worker failed; next cycle will continue")
        try:
            await asyncio.wait_for(stop.wait(), timeout=60)
        except asyncio.TimeoutError:
            pass
