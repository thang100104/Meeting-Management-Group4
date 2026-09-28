import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/config/database';
import { AuthService } from '../src/services/auth.service';
import { notificationService } from '../src/services/notification.service';

vi.mock('../src/config/database', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
    room: {
      findUnique: vi.fn(),
    },
    meeting: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    meetingParticipant: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    meetingReminder: {
      create: vi.fn(),
    },
    meetingAttachment: {
      create: vi.fn(),
    },
    notificationLog: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

describe('Meeting Creation Core API — Phase E (AC1 -> AC6)', () => {
  const app = createApp();

  const organizerToken = AuthService.signToken({
    user_id: 2,
    email: 'organizer1@company.com',
    role: 'Organizer',
    full_name: 'Nguyễn Văn Tổ Chức',
  });

  const participantToken = AuthService.signToken({
    user_id: 4,
    email: 'staff1@company.com',
    role: 'Participant',
    full_name: 'Lê Văn Nhân Viên',
  });

  const futureStart = new Date(Date.now() + 24 * 60 * 60 * 1000); // Ngày mai
  futureStart.setUTCHours(9, 0, 0, 0);
  const futureEnd = new Date(futureStart.getTime() + 60 * 60 * 1000); // 1 giờ sau

  const mockRoom = {
    room_id: 1,
    room_name: 'Phòng Hội nghị A',
    capacity: 30,
    location: 'Tầng 3',
    status: 'Available',
  };

  const mockInvitee = {
    user_id: 4,
    full_name: 'Lê Văn Nhân Viên',
    email: 'staff1@company.com',
    status: 'Active',
    role_id: 3,
    role: { role_id: 3, role_name: 'Participant' },
  };

  const mockCreatedMeeting = {
    meeting_id: 101,
    organizer_id: 2,
    room_id: 1,
    title: 'Họp Chiến lược Quý 4',
    description: 'Bàn kế hoạch triển khai Q4',
    meeting_link: null,
    start_time: futureStart,
    end_time: futureEnd,
    reminder_minutes_before: 15,
    status: 'Scheduled',
    created_at: new Date(),
    updated_at: new Date(),
    room: mockRoom,
    organizer: {
      user_id: 2,
      full_name: 'Nguyễn Văn Tổ Chức',
      email: 'organizer1@company.com',
      phone: '0901000002',
      role: { role_name: 'Organizer' },
    },
    participants: [
      {
        user_id: 2,
        status: 'Accepted',
        user: { user_id: 2, full_name: 'Nguyễn Văn Tổ Chức', email: 'organizer1@company.com' },
      },
      {
        user_id: 4,
        status: 'Pending',
        user: { user_id: 4, full_name: 'Lê Văn Nhân Viên', email: 'staff1@company.com' },
      },
    ],
    attachments: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('AC 1 & AC 5: should create meeting successfully with valid inputs (Happy Path)', async () => {
    vi.mocked(prisma.room.findUnique).mockResolvedValueOnce(mockRoom as any);
    vi.mocked(prisma.user.findFirst).mockResolvedValueOnce(mockInvitee as any);
    vi.mocked(prisma.meeting.findMany).mockResolvedValue([]); // Không trùng phòng
    vi.mocked(prisma.meetingParticipant.findMany).mockResolvedValue([]); // Không trùng người

    vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
      const mockTx = {
        meeting: { create: vi.fn().mockResolvedValue({ meeting_id: 101 }) },
        meetingParticipant: { create: vi.fn().mockResolvedValue({}) },
        meetingReminder: { create: vi.fn().mockResolvedValue({}) },
        meetingAttachment: { create: vi.fn().mockResolvedValue({}) },
      };
      return callback(mockTx);
    });

    vi.mocked(prisma.meeting.findUnique).mockResolvedValueOnce(mockCreatedMeeting as any);
    vi.spyOn(notificationService, 'sendInvitations').mockResolvedValueOnce({ successCount: 1, failCount: 0 });

    const res = await request(app)
      .post('/api/v1/meetings')
      .set('Authorization', `Bearer ${organizerToken}`)
      .send({
        title: 'Họp Chiến lược Quý 4',
        start_time: futureStart.toISOString(),
        end_time: futureEnd.toISOString(),
        room_id: 1,
        participants: [{ user_id: 4 }],
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.meeting_id).toBe(101);
    expect(res.body.data.title).toBe('Họp Chiến lược Quý 4');
    expect(res.body.data.reminder_minutes_before).toBe(15);
    expect(res.body.data.participants.length).toBe(2);
  });

  it('AC 2 & AC 3: should return 400 with exact error message when title is empty', async () => {
    const res = await request(app)
      .post('/api/v1/meetings')
      .set('Authorization', `Bearer ${organizerToken}`)
      .send({
        title: '',
        start_time: futureStart.toISOString(),
        end_time: futureEnd.toISOString(),
        participants: [{ user_id: 4 }],
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.message).toContain('Vui lòng nhập tên cuộc họp');
  });

  it('AC 2 & AC 3: should return 400 when end_time <= start_time', async () => {
    const res = await request(app)
      .post('/api/v1/meetings')
      .set('Authorization', `Bearer ${organizerToken}`)
      .send({
        title: 'Họp Giao Ban',
        start_time: futureEnd.toISOString(),
        end_time: futureStart.toISOString(), // end_time trước start_time
        participants: [{ user_id: 4 }],
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.message).toContain('Thời gian kết thúc phải sau thời gian bắt đầu');
  });

  it('AC 2 & AC 3: should return 400 when participants list is empty or only organizer', async () => {
    const res = await request(app)
      .post('/api/v1/meetings')
      .set('Authorization', `Bearer ${organizerToken}`)
      .send({
        title: 'Họp Một Mình',
        start_time: futureStart.toISOString(),
        end_time: futureEnd.toISOString(),
        participants: [],
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.message).toContain('Vui lòng chọn ít nhất 1 người tham gia');
  });

  it('AC 2: should return 404 USER_NOT_FOUND when participant email does not exist', async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValueOnce(null);

    const res = await request(app)
      .post('/api/v1/meetings')
      .set('Authorization', `Bearer ${organizerToken}`)
      .send({
        title: 'Họp Khách Mời',
        start_time: futureStart.toISOString(),
        end_time: futureEnd.toISOString(),
        participants: [{ email: 'notfound@company.com' }],
      });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('USER_NOT_FOUND');
  });

  it('AC 4: should return 409 SCHEDULE_CONFLICT with suggestions when room is already booked', async () => {
    vi.mocked(prisma.room.findUnique).mockResolvedValueOnce(mockRoom as any);
    vi.mocked(prisma.user.findFirst).mockResolvedValueOnce(mockInvitee as any);

    // Giả lập phòng đã có cuộc họp trùng
    vi.mocked(prisma.meeting.findMany).mockResolvedValueOnce([
      {
        meeting_id: 99,
        room_id: 1,
        title: 'Cuộc họp đang diễn ra',
        room: mockRoom,
      } as any,
    ]);
    vi.mocked(prisma.meetingParticipant.findMany).mockResolvedValue([]);

    const res = await request(app)
      .post('/api/v1/meetings')
      .set('Authorization', `Bearer ${organizerToken}`)
      .send({
        title: 'Họp Trùng Phòng',
        start_time: futureStart.toISOString(),
        end_time: futureEnd.toISOString(),
        room_id: 1,
        participants: [{ user_id: 4 }],
      });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('SCHEDULE_CONFLICT');
    expect(res.body.error.details.length).toBeGreaterThan(0);
    expect(res.body.error.override_allowed).toBe(true);
    expect(res.body.error.suggested_times).toBeDefined();
  });

  it('AC 4: should allow creating meeting when allow_conflicts is true after confirmation', async () => {
    vi.mocked(prisma.room.findUnique).mockResolvedValueOnce(mockRoom as any);
    vi.mocked(prisma.user.findFirst).mockResolvedValueOnce(mockInvitee as any);

    // Có xung đột phòng nhưng người dùng đã xác nhận allow_conflicts = true
    vi.mocked(prisma.meeting.findMany).mockResolvedValueOnce([
      {
        meeting_id: 99,
        room_id: 1,
        title: 'Cuộc họp đang diễn ra',
        room: mockRoom,
      } as any,
    ]);
    vi.mocked(prisma.meetingParticipant.findMany).mockResolvedValue([]);

    vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
      const mockTx = {
        meeting: { create: vi.fn().mockResolvedValue({ meeting_id: 102 }) },
        meetingParticipant: { create: vi.fn().mockResolvedValue({}) },
        meetingReminder: { create: vi.fn().mockResolvedValue({}) },
        meetingAttachment: { create: vi.fn().mockResolvedValue({}) },
      };
      return callback(mockTx);
    });

    vi.mocked(prisma.meeting.findUnique).mockResolvedValueOnce(mockCreatedMeeting as any);
    vi.spyOn(notificationService, 'sendInvitations').mockResolvedValueOnce({ successCount: 1, failCount: 0 });

    const res = await request(app)
      .post('/api/v1/meetings')
      .set('Authorization', `Bearer ${organizerToken}`)
      .send({
        title: 'Họp Tạo Dù Trùng',
        start_time: futureStart.toISOString(),
        end_time: futureEnd.toISOString(),
        room_id: 1,
        participants: [{ user_id: 4 }],
        allow_conflicts: true,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.meta.warnings).toBeDefined();
    expect(res.body.meta.warnings[0].code).toBe('SCHEDULE_CONFLICT_OVERRIDDEN');
  });

  it('AC 5: should return 201 with warning when invitation email delivery fails (Error Isolation)', async () => {
    vi.mocked(prisma.room.findUnique).mockResolvedValueOnce(mockRoom as any);
    vi.mocked(prisma.user.findFirst).mockResolvedValueOnce(mockInvitee as any);
    vi.mocked(prisma.meeting.findMany).mockResolvedValue([]);
    vi.mocked(prisma.meetingParticipant.findMany).mockResolvedValue([]);

    vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
      const mockTx = {
        meeting: { create: vi.fn().mockResolvedValue({ meeting_id: 103 }) },
        meetingParticipant: { create: vi.fn().mockResolvedValue({}) },
        meetingReminder: { create: vi.fn().mockResolvedValue({}) },
        meetingAttachment: { create: vi.fn().mockResolvedValue({}) },
      };
      return callback(mockTx);
    });

    vi.mocked(prisma.meeting.findUnique).mockResolvedValueOnce(mockCreatedMeeting as any);
    // Giả lập email gửi thất bại
    vi.spyOn(notificationService, 'sendInvitations').mockResolvedValueOnce({ successCount: 0, failCount: 1 });

    const res = await request(app)
      .post('/api/v1/meetings')
      .set('Authorization', `Bearer ${organizerToken}`)
      .send({
        title: 'Họp Lỗi Email',
        start_time: futureStart.toISOString(),
        end_time: futureEnd.toISOString(),
        room_id: 1,
        participants: [{ user_id: 4 }],
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.meta.warnings).toBeDefined();
    expect(res.body.meta.warnings[0].code).toBe('INVITATION_EMAIL_FAILED');
  });

  it('RBAC: should return 403 FORBIDDEN when user has Participant role', async () => {
    const res = await request(app)
      .post('/api/v1/meetings')
      .set('Authorization', `Bearer ${participantToken}`)
      .send({
        title: 'Họp Không Quyền',
        start_time: futureStart.toISOString(),
        end_time: futureEnd.toISOString(),
        participants: [{ user_id: 2 }],
      });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  describe('GET /api/v1/meetings', () => {
    it('should return list of meetings within date range for authenticated user', async () => {
      vi.mocked(prisma.meeting.findMany).mockResolvedValueOnce([
        {
          ...mockCreatedMeeting,
          organizer: {
            user_id: 2,
            full_name: 'Organizer User',
            email: 'organizer@company.com',
            department: { department_name: 'IT' },
          },
          room: mockRoom,
          participants: [
            {
              user: {
                user_id: 4,
                full_name: 'Staff Member',
                email: 'staff@company.com',
                department: { department_name: 'Sales' },
              },
              status: 'Pending',
            },
          ],
          attachments: [],
        } as any,
      ]);

      const res = await request(app)
        .get('/api/v1/meetings')
        .set('Authorization', `Bearer ${organizerToken}`)
        .query({
          from: futureStart.toISOString(),
          to: futureEnd.toISOString(),
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].title).toBe('Họp Chiến lược Quý 4');
    });

    it('should return 400 when date range exceeds 31 days', async () => {
      const farFuture = new Date(futureStart.getTime() + 40 * 24 * 60 * 60 * 1000);
      const res = await request(app)
        .get('/api/v1/meetings')
        .set('Authorization', `Bearer ${organizerToken}`)
        .query({
          from: futureStart.toISOString(),
          to: farFuture.toISOString(),
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('Khoảng thời gian tra cứu không được vượt quá 31 ngày');
    });
  });

  describe('GET /api/v1/meetings/:id', () => {
    it('should return meeting details when user has access', async () => {
      vi.mocked(prisma.meeting.findUnique).mockResolvedValueOnce({
        ...mockCreatedMeeting,
        organizer: {
          user_id: 2,
          full_name: 'Organizer User',
          email: 'organizer@company.com',
          department: { department_name: 'IT' },
        },
        room: mockRoom,
        participants: [
          {
            user: {
              user_id: 4,
              full_name: 'Staff Member',
              email: 'staff@company.com',
              department: { department_name: 'Sales' },
            },
            status: 'Pending',
          },
        ],
        attachments: [],
      } as any);

      const res = await request(app)
        .get('/api/v1/meetings/101')
        .set('Authorization', `Bearer ${organizerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.meeting_id).toBe(101);
      expect(res.body.data.title).toBe('Họp Chiến lược Quý 4');
    });
  });
});
