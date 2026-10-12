"""Isolated tests: never modify the real application database."""
import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import patch
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from app.core.database import Base, get_db
from app.models import Role, User, Room, Meeting, MeetingParticipant
from app.models.notification import MeetingNotification
from app.api.deps import get_current_active_user
from app.api.v1.endpoints.notifications import router
from app.schemas.meeting import MeetingCreate, MeetingUpdate
from app.services.reminders import generate_reminders, visible_notifications, deliver_pending_emails
from app.core.config import settings

class ReminderTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine('sqlite://', connect_args={'check_same_thread': False}, poolclass=StaticPool)
        Base.metadata.create_all(self.engine)
        self.db = sessionmaker(bind=self.engine)()
        role = Role(role_name='ORGANIZER')
        self.db.add(role)
        self.db.flush()
        self.users = [User(full_name=f'User {i}', email=f'u{i}@example.com', password_hash='test', role_id=role.role_id, status='ACTIVE') for i in range(4)]
        self.db.add_all(self.users)
        self.room = Room(room_name='Test room', capacity=10, location='Test floor', status='AVAILABLE')
        self.db.add(self.room)
        self.db.commit()
        self.now = datetime(2026, 10, 12, 9, 0)
    def tearDown(self):
        self.db.close()
        self.engine.dispose()
    def meeting(self, minutes=15, status='SCHEDULED'):
        m = Meeting(title='Test meeting', organizer_id=self.users[0].user_id, room_id=self.room.room_id, start_time=self.now + timedelta(minutes=minutes), end_time=self.now + timedelta(minutes=minutes+60), status=status)
        self.db.add(m)
        self.db.flush()
        self.db.add_all([MeetingParticipant(meeting_id=m.meeting_id, user_id=self.users[1].user_id, rsvp_status='ACCEPTED'), MeetingParticipant(meeting_id=m.meeting_id, user_id=self.users[2].user_id, rsvp_status='DECLINED')])
        self.db.commit()
        return m
    def test_boundary_and_recipients(self):
        self.meeting(16)
        self.assertEqual(generate_reminders(self.db, self.now), [])
        self.meeting(15)
        self.assertEqual(len(generate_reminders(self.db, self.now)), 2)
        self.assertEqual({n.recipient_user_id for n in self.db.query(MeetingNotification)}, {self.users[0].user_id, self.users[1].user_id})
        self.assertEqual(visible_notifications(self.db, self.users[3].user_id).count(), 0)
    def test_ten_minutes_and_restart_deduplication(self):
        self.meeting(10)
        self.assertEqual(len(generate_reminders(self.db, self.now)), 2)
        self.db.close()
        self.db = sessionmaker(bind=self.engine)()
        self.assertEqual(generate_reminders(self.db, self.now + timedelta(minutes=1)), [])
        self.assertEqual(self.db.query(MeetingNotification).count(), 2)
    def test_skip_invalid_status_and_started(self):
        for status in ['PENDING', 'CANCELLED', 'REJECTED', 'COMPLETED', 'IN_PROGRESS']:
            self.meeting(10, status)
        self.meeting(0)
        self.meeting(-1)
        self.assertEqual(generate_reminders(self.db, self.now), [])
    def test_reschedule_cancel_decline(self):
        m = self.meeting(10)
        generate_reminders(self.db, self.now)
        m.start_time += timedelta(hours=1)
        self.db.commit()
        self.assertEqual(visible_notifications(self.db, self.users[0].user_id).count(), 0)
        self.assertEqual(generate_reminders(self.db, self.now), [])
        self.assertEqual(len(generate_reminders(self.db, self.now+timedelta(hours=1))), 2)
        p = self.db.query(MeetingParticipant).filter_by(user_id=self.users[1].user_id).first()
        p.rsvp_status = 'DECLINED'
        self.db.commit()
        self.assertEqual(visible_notifications(self.db, self.users[1].user_id).count(), 0)
        m.status = 'CANCELLED'
        self.db.commit()
        self.assertEqual(visible_notifications(self.db, self.users[0].user_id).count(), 0)
    def test_inactive_and_organizer_deduplication(self):
        m = self.meeting(10)
        self.users[1].status = 'INACTIVE'
        self.db.add(MeetingParticipant(meeting_id=m.meeting_id, user_id=self.users[0].user_id, rsvp_status='ACCEPTED'))
        self.db.commit()
        self.assertEqual(len(generate_reminders(self.db, self.now)), 1)
    def test_api_isolation_read_persistence(self):
        self.meeting(10)
        generate_reminders(self.db, self.now)
        app = FastAPI()
        app.include_router(router, prefix='/notifications')
        def override_db():
            yield self.db
        app.dependency_overrides[get_db] = override_db
        app.dependency_overrides[get_current_active_user] = lambda: self.users[0]
        with TestClient(app) as client:
            data = client.get('/notifications').json()
            self.assertEqual(len(data), 1)
            self.assertTrue(data[0]['startTime'].endswith('+07:00'))
            other = self.db.query(MeetingNotification).filter_by(recipient_user_id=self.users[1].user_id).first()
            self.assertEqual(client.patch(f'/notifications/{other.notification_id}/read').status_code, 404)
            self.assertEqual(client.patch(f'/notifications/{data[0]["id"]}/read').status_code, 200)
            self.assertTrue(client.get('/notifications').json()[0]['isRead'])
            client.patch('/notifications/read-all')
            self.assertFalse(other.is_read)
    def test_timezone_input(self):
        data = MeetingCreate(room_id=1, title='TZ', start_time='2026-10-12T02:15:00Z', end_time='2026-10-12T03:15:00Z')
        self.assertEqual(data.start_time, datetime(2026,10,12,9,15))
        self.assertEqual(MeetingUpdate(start_time='2026-10-12T09:15:00+07:00').start_time, data.start_time)
        self.meeting(15)
        self.assertEqual(len(generate_reminders(self.db, datetime(2026,10,12,2,0,tzinfo=timezone.utc))), 2)
    def test_failed_email_isolated_no_retry(self):
        self.meeting(10)
        with patch.object(settings, 'SMTP_HOST', 'localhost'), patch('app.services.reminders.meeting_now', return_value=self.now), patch('app.services.reminders.smtplib.SMTP', side_effect=OSError('provider unavailable')) as smtp:
            generate_reminders(self.db, self.now)
            with self.assertLogs('app.services.reminders', level='ERROR'):
                deliver_pending_emails(self.db)
            self.assertEqual(smtp.call_count, 2)
            self.assertEqual(self.db.query(MeetingNotification).filter_by(email_status='FAILED').count(), 2)
            deliver_pending_emails(self.db)
            self.assertEqual(smtp.call_count, 2)
    def test_successful_email_is_sent_once(self):
        self.meeting(10)
        with patch.object(settings, 'SMTP_HOST', 'localhost'), patch('app.services.reminders.meeting_now', return_value=self.now), patch('app.services.reminders.smtplib.SMTP') as smtp:
            generate_reminders(self.db, self.now)
            deliver_pending_emails(self.db)
            self.assertEqual(smtp.return_value.__enter__.return_value.send_message.call_count, 2)
            self.assertEqual(self.db.query(MeetingNotification).filter_by(email_status='SENT').count(), 2)
            deliver_pending_emails(self.db)
            self.assertEqual(smtp.return_value.__enter__.return_value.send_message.call_count, 2)

    def test_cancel_before_email(self):
        m = self.meeting(10)
        with patch.object(settings, 'SMTP_HOST', 'localhost'), patch('app.services.reminders.smtplib.SMTP') as smtp:
            generate_reminders(self.db, self.now)
            m.status = 'CANCELLED'
            self.db.commit()
            deliver_pending_emails(self.db)
            smtp.assert_not_called()
            self.assertEqual(self.db.query(MeetingNotification).filter_by(email_status='CANCELLED').count(), 2)

if __name__ == '__main__':
    unittest.main()
