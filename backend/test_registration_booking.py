"""Registration -> real JWT -> student booking -> approved reminder regression tests."""
import unittest
from datetime import timedelta
from fastapi import FastAPI
from fastapi.testclient import TestClient
from app.api.v1.endpoints import auth, meetings, rooms, notifications
from app.core.database import get_db
from app.models import Role, User, RoomRestriction, Meeting
from app.core.security import verify_password, create_access_token
from app.services.reminders import generate_reminders
from test_reminders import ReminderTests


class RegistrationBookingTests(unittest.TestCase):
    def setUp(self):
        ReminderTests.setUp(self)
        self.db.add(Role(role_name='PARTICIPANT'))
        self.db.commit()
        self.app = FastAPI()
        for prefix, router in [('auth', auth.router), ('meetings', meetings.router), ('rooms', rooms.router), ('notifications', notifications.router)]:
            self.app.include_router(router, prefix=f'/api/v1/{prefix}')
        def db_override():
            yield self.db
        self.app.dependency_overrides[get_db] = db_override
        self.client = TestClient(self.app)
        self.payload = dict(full_name='Student test', email='student@example.com', password='test-secret-123', role_name='PARTICIPANT')
    def tearDown(self):
        self.client.close()
        ReminderTests.tearDown(self)
    def register_and_login(self):
        response = self.client.post('/api/v1/auth/register', json=self.payload)
        self.assertEqual(response.status_code, 201, response.text)
        login = self.client.post('/api/v1/auth/login', json={'email': self.payload['email'], 'password': self.payload['password']})
        self.assertEqual(login.status_code, 200, login.text)
        return response.json(), {'Authorization': 'Bearer ' + login.json()['access_token']}
    def booking(self):
        return dict(room_id=self.room.room_id, title='Student room request', start_time=(self.now+timedelta(minutes=10)).isoformat()+'+07:00', end_time=(self.now+timedelta(minutes=70)).isoformat()+'+07:00')
    def test_real_account_hash_jwt_room_access(self):
        user, headers = self.register_and_login()
        stored = self.db.get(User, user['user_id'])
        self.assertNotEqual(stored.password_hash, self.payload['password'])
        self.assertTrue(verify_password(self.payload['password'], stored.password_hash))
        self.assertNotIn('password_hash', user)
        self.assertEqual(self.client.get('/api/v1/auth/me', headers=headers).json()['role']['role_name'], 'PARTICIPANT')
        self.assertEqual(self.client.get('/api/v1/rooms', headers=headers).status_code, 200)
        self.assertEqual(self.client.get('/api/v1/rooms', headers={'Authorization': 'Bearer mock-token-lecturer'}).status_code, 401)
    def test_duplicate_email_normalized_and_bad_password(self):
        self.register_and_login()
        duplicate = {**self.payload, 'email': ' STUDENT@EXAMPLE.COM '}
        self.assertEqual(self.client.post('/api/v1/auth/register', json=duplicate).status_code, 409)
        self.assertEqual(self.client.post('/api/v1/auth/login', json={'email': 'STUDENT@EXAMPLE.COM', 'password': self.payload['password']}).status_code, 200)
        self.assertEqual(self.client.post('/api/v1/auth/login', json={'email': self.payload['email'], 'password': 'wrong'}).status_code, 400)
    def test_public_registration_cannot_assign_privileged_role(self):
        for role in ['ADMIN', 'ORGANIZER', 'LECTURER']:
            self.assertEqual(self.client.post('/api/v1/auth/register', json={**self.payload, 'role_name': role}).status_code, 422)
        self.assertEqual(self.client.post('/api/v1/auth/register', json={**self.payload, 'password': '123'}).status_code, 422)
    def test_student_pending_admin_approve_reminder(self):
        user, headers = self.register_and_login()
        response = self.client.post('/api/v1/meetings', json=self.booking(), headers=headers)
        self.assertEqual(response.status_code, 201, response.text)
        meeting = response.json()
        self.assertEqual(meeting['status'], 'PENDING')
        self.assertEqual(generate_reminders(self.db, self.now), [])
        path = f'/api/v1/meetings/{meeting["meeting_id"]}/approve'
        self.assertEqual(self.client.patch(path, headers=headers).status_code, 403)
        admin_role = Role(role_name='ADMIN')
        self.db.add(admin_role)
        self.db.flush()
        self.users[0].role_id = admin_role.role_id
        self.db.commit()
        admin_headers = {'Authorization': 'Bearer ' + create_access_token(self.users[0].user_id)}
        approved = self.client.patch(path, headers=admin_headers)
        self.assertEqual(approved.status_code, 200, approved.text)
        self.assertEqual(len(generate_reminders(self.db, self.now)), 1)
        reminders = self.client.get('/api/v1/notifications', headers=headers).json()
        self.assertEqual(len(reminders), 1)
        self.assertEqual(reminders[0]['meetingId'], meeting['meeting_id'])
    def test_student_room_restrictions_and_conflicts(self):
        user, headers = self.register_and_login()
        self.db.add(RoomRestriction(room_id=self.room.room_id, role_id=user['role_id']))
        self.db.commit()
        self.assertEqual(self.client.get('/api/v1/rooms?only_allowed_for_me=true', headers=headers).json(), [])
        self.assertEqual(self.client.post('/api/v1/meetings', json=self.booking(), headers=headers).status_code, 403)
        self.db.query(RoomRestriction).delete()
        self.db.commit()
        self.assertEqual(self.client.post('/api/v1/meetings', json=self.booking(), headers=headers).status_code, 201)
        self.assertEqual(self.client.post('/api/v1/meetings', json=self.booking(), headers=headers).status_code, 409)

if __name__ == '__main__':
    unittest.main()
