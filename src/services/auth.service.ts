import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/database';
import { env } from '../config/env';
import { UnauthorizedError } from '../utils/errors';
import { LoginInput } from '../schemas/auth.schema';
import { AuthUser } from '../types/express';

export interface UserResponseDto {
  user_id: number;
  full_name: string;
  email: string;
  phone: string | null;
  role: 'Admin' | 'Organizer' | 'Participant';
}

export interface LoginResultDto {
  access_token: string;
  token_type: 'Bearer';
  expires_in: number;
  user: UserResponseDto;
}

export class AuthService {
  public static signToken(payload: AuthUser): string {
    return jwt.sign(payload, env.JWT_SECRET, {
      expiresIn: env.JWT_EXPIRES_IN,
    });
  }

  public static verifyToken(token: string): AuthUser {
    try {
      return jwt.verify(token, env.JWT_SECRET) as AuthUser;
    } catch {
      throw new UnauthorizedError('Token không hợp lệ hoặc đã hết hạn');
    }
  }

  public async login(input: LoginInput): Promise<LoginResultDto> {
    const user = await prisma.user.findUnique({
      where: { email: input.email.toLowerCase().trim() },
      include: { role: true },
    });

    if (!user || user.status !== 'Active') {
      throw new UnauthorizedError('Email hoặc mật khẩu không chính xác');
    }

    if (!user.password_hash) {
      throw new UnauthorizedError('Tài khoản chưa được kích hoạt mật khẩu đăng nhập');
    }

    const isPasswordValid = await bcrypt.compare(input.password, user.password_hash);
    if (!isPasswordValid) {
      throw new UnauthorizedError('Email hoặc mật khẩu không chính xác');
    }

    const userPayload: AuthUser = {
      user_id: user.user_id,
      email: user.email,
      role: user.role.role_name as 'Admin' | 'Organizer' | 'Participant',
      full_name: user.full_name,
    };

    const token = AuthService.signToken(userPayload);

    return {
      access_token: token,
      token_type: 'Bearer',
      expires_in: env.JWT_EXPIRES_IN,
      user: {
        user_id: user.user_id,
        full_name: user.full_name,
        email: user.email,
        phone: user.phone,
        role: user.role.role_name as 'Admin' | 'Organizer' | 'Participant',
      },
    };
  }

  public async getCurrentUser(userId: number): Promise<UserResponseDto> {
    const user = await prisma.user.findUnique({
      where: { user_id: userId },
      include: { role: true },
    });

    if (!user || user.status !== 'Active') {
      throw new UnauthorizedError('Tài khoản người dùng không tồn tại hoặc đã bị vô hiệu hóa');
    }

    return {
      user_id: user.user_id,
      full_name: user.full_name,
      email: user.email,
      phone: user.phone,
      role: user.role.role_name as 'Admin' | 'Organizer' | 'Participant',
    };
  }
}

export const authService = new AuthService();
