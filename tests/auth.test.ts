import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcrypt';
import { createApp } from '../src/app';
import { prisma } from '../src/config/database';
import { AuthService } from '../src/services/auth.service';

vi.mock('../src/config/database', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
  },
}));

describe('Auth Module & Authorization Tests', () => {
  const app = createApp();

  const mockAdminUser = {
    user_id: 1,
    full_name: 'Quản trị viên Hệ thống',
    email: 'admin@company.com',
    password_hash: bcrypt.hashSync('Password@123', 10),
    phone: '0901000001',
    status: 'Active',
    role_id: 1,
    role: {
      role_id: 1,
      role_name: 'Admin',
    },
  };

  const mockOrganizerUser = {
    user_id: 2,
    full_name: 'Nguyễn Văn Tổ Chức',
    email: 'organizer1@company.com',
    password_hash: bcrypt.hashSync('Password@123', 10),
    phone: '0901000002',
    status: 'Active',
    role_id: 2,
    role: {
      role_id: 2,
      role_name: 'Organizer',
    },
  };

  const mockInactiveUser = {
    user_id: 3,
    full_name: 'Nhân viên Đã Nghỉ',
    email: 'inactive@company.com',
    password_hash: bcrypt.hashSync('Password@123', 10),
    phone: null,
    status: 'Inactive',
    role_id: 3,
    role: {
      role_id: 3,
      role_name: 'Participant',
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/v1/auth/login', () => {
    it('should authenticate successfully with correct credentials and return JWT', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(mockAdminUser as any);

      const res = await request(app).post('/api/v1/auth/login').send({
        email: 'admin@company.com',
        password: 'Password@123',
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('access_token');
      expect(res.body.data.token_type).toBe('Bearer');
      expect(res.body.data.expires_in).toBe(1800);
      expect(res.body.data.user).toEqual({
        user_id: 1,
        full_name: 'Quản trị viên Hệ thống',
        email: 'admin@company.com',
        phone: '0901000001',
        role: 'Admin',
      });
      expect(res.body.data.user).not.toHaveProperty('password_hash');
    });

    it('should return 400 VALIDATION_ERROR when email format is invalid', async () => {
      const res = await request(app).post('/api/v1/auth/login').send({
        email: 'invalid-email-format',
        password: 'Password@123',
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.details).toBeDefined();
    });

    it('should return 400 VALIDATION_ERROR when password is shorter than 8 characters', async () => {
      const res = await request(app).post('/api/v1/auth/login').send({
        email: 'admin@company.com',
        password: '123',
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 401 UNAUTHORIZED when password is wrong', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(mockAdminUser as any);

      const res = await request(app).post('/api/v1/auth/login').send({
        email: 'admin@company.com',
        password: 'WrongPassword@999',
      });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
      expect(res.body.error.message).toContain('Email hoặc mật khẩu không chính xác');
    });

    it('should return 401 UNAUTHORIZED when user is not found', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null);

      const res = await request(app).post('/api/v1/auth/login').send({
        email: 'nonexistent@company.com',
        password: 'Password@123',
      });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should return 401 UNAUTHORIZED when user is Inactive', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(mockInactiveUser as any);

      const res = await request(app).post('/api/v1/auth/login').send({
        email: 'inactive@company.com',
        password: 'Password@123',
      });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('GET /api/v1/auth/me', () => {
    it('should return current user when valid Bearer token is provided', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(mockOrganizerUser as any);

      const token = AuthService.signToken({
        user_id: 2,
        email: 'organizer1@company.com',
        role: 'Organizer',
        full_name: 'Nguyễn Văn Tổ Chức',
      });

      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual({
        user_id: 2,
        full_name: 'Nguyễn Văn Tổ Chức',
        email: 'organizer1@company.com',
        phone: '0901000002',
        role: 'Organizer',
      });
    });

    it('should return 401 UNAUTHORIZED when Authorization header is missing', async () => {
      const res = await request(app).get('/api/v1/auth/me');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should return 401 UNAUTHORIZED when Bearer token is invalid or corrupted', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer invalid.corrupted.token');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });
  });
});
