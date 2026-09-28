import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/config/database';
import { AuthService } from '../src/services/auth.service';

vi.mock('../src/config/database', () => ({
  prisma: {
    user: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    room: {
      findMany: vi.fn(),
    },
  },
}));

describe('Master Data API — Users & Rooms Tests', () => {
  const app = createApp();

  const mockToken = AuthService.signToken({
    user_id: 2,
    email: 'organizer1@company.com',
    role: 'Organizer',
    full_name: 'Nguyễn Văn Tổ Chức',
  });

  const mockActiveUsers = [
    {
      user_id: 1,
      full_name: 'Quản trị viên Hệ thống',
      email: 'admin@company.com',
      password_hash: '$2b$10$hashed',
      phone: '0901000001',
      status: 'Active',
      role_id: 1,
      role: { role_id: 1, role_name: 'Admin' },
    },
    {
      user_id: 2,
      full_name: 'Nguyễn Văn Tổ Chức',
      email: 'organizer1@company.com',
      password_hash: '$2b$10$hashed',
      phone: '0901000002',
      status: 'Active',
      role_id: 2,
      role: { role_id: 2, role_name: 'Organizer' },
    },
    {
      user_id: 4,
      full_name: 'Lê Văn Nhân Viên',
      email: 'staff1@company.com',
      password_hash: '$2b$10$hashed',
      phone: '0901000004',
      status: 'Active',
      role_id: 3,
      role: { role_id: 3, role_name: 'Participant' },
    },
  ];

  const mockAvailableRooms = [
    {
      room_id: 2,
      room_name: 'Phòng Họp Nhóm 1',
      capacity: 8,
      location: 'Tầng 2',
      status: 'Available',
    },
    {
      room_id: 3,
      room_name: 'Phòng VIP',
      capacity: 15,
      location: 'Tầng 4',
      status: 'Available',
    },
    {
      room_id: 1,
      room_name: 'Phòng Hội nghị A',
      capacity: 30,
      location: 'Tầng 3',
      status: 'Available',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/v1/users', () => {
    it('should return list of active users without password_hash when authenticated', async () => {
      vi.mocked(prisma.user.findMany).mockResolvedValueOnce(mockActiveUsers as any);

      const res = await request(app)
        .get('/api/v1/users?limit=10')
        .set('Authorization', `Bearer ${mockToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBe(3);
      expect(res.body.data[0]).toEqual({
        user_id: 1,
        full_name: 'Quản trị viên Hệ thống',
        email: 'admin@company.com',
        phone: '0901000001',
        role: 'Admin',
      });
      expect(res.body.data[0]).not.toHaveProperty('password_hash');
    });

    it('should pass search term q and limit to prisma query', async () => {
      vi.mocked(prisma.user.findMany).mockResolvedValueOnce([mockActiveUsers[2]] as any);

      const res = await request(app)
        .get('/api/v1/users?q=staff&limit=5')
        .set('Authorization', `Bearer ${mockToken}`);

      expect(res.status).toBe(200);
      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: {
          status: 'Active',
          OR: [
            { full_name: { contains: 'staff', mode: 'insensitive' } },
            { email: { contains: 'staff', mode: 'insensitive' } },
          ],
        },
        take: 5,
        include: { role: true },
        orderBy: { full_name: 'asc' },
      });
    });

    it('should return 401 UNAUTHORIZED when no Bearer token provided', async () => {
      const res = await request(app).get('/api/v1/users');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should return 400 VALIDATION_ERROR when limit is out of range', async () => {
      const res = await request(app)
        .get('/api/v1/users?limit=999')
        .set('Authorization', `Bearer ${mockToken}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/v1/rooms', () => {
    it('should return available rooms not in maintenance or booked for valid time range', async () => {
      vi.mocked(prisma.room.findMany).mockResolvedValueOnce(mockAvailableRooms as any);

      const from = '2026-10-01T09:00:00.000Z';
      const to = '2026-10-01T10:00:00.000Z';

      const res = await request(app)
        .get(`/api/v1/rooms?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`)
        .set('Authorization', `Bearer ${mockToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBe(3);
      expect(res.body.data[0]).toEqual({
        room_id: 2,
        room_name: 'Phòng Họp Nhóm 1',
        capacity: 8,
        location: 'Tầng 2',
        status: 'Available',
      });
      expect(prisma.room.findMany).toHaveBeenCalledWith({
        where: {
          status: 'Available',
          meetings: {
            none: {
              status: { not: 'Cancelled' },
              start_time: { lt: new Date(to) },
              end_time: { gt: new Date(from) },
            },
          },
        },
        orderBy: [{ capacity: 'asc' }, { room_name: 'asc' }],
      });
    });

    it('should return 400 VALIDATION_ERROR when from or to parameters are missing', async () => {
      const res = await request(app)
        .get('/api/v1/rooms')
        .set('Authorization', `Bearer ${mockToken}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 with exact error message when to <= from', async () => {
      const from = '2026-10-01T10:00:00.000Z';
      const to = '2026-10-01T09:00:00.000Z'; // to is before from!

      const res = await request(app)
        .get(`/api/v1/rooms?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`)
        .set('Authorization', `Bearer ${mockToken}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.message).toContain('Thời gian kết thúc phải sau thời gian bắt đầu');
    });

    it('should return 401 UNAUTHORIZED when no Bearer token provided', async () => {
      const from = '2026-10-01T09:00:00.000Z';
      const to = '2026-10-01T10:00:00.000Z';

      const res = await request(app).get(
        `/api/v1/rooms?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
      );

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });
  });
});
