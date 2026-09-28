import { NextFunction, Request, Response } from 'express';
import { AuthService } from '../services/auth.service';
import { ForbiddenError, UnauthorizedError } from '../utils/errors';

export function authenticateBearer(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new UnauthorizedError('Thiếu hoặc sai định dạng Bearer token xác thực'));
  }

  const token = authHeader.substring(7).trim();
  if (!token) {
    return next(new UnauthorizedError('Token xác thực không được để trống'));
  }

  try {
    const userPayload = AuthService.verifyToken(token);
    req.user = userPayload;
    next();
  } catch (error) {
    next(error);
  }
}

export function requireRole(...allowedRoles: Array<'Admin' | 'Organizer' | 'Participant'>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new UnauthorizedError('Yêu cầu xác thực tài khoản'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new ForbiddenError(
          `Bạn không có quyền truy cập tài nguyên này. Yêu cầu vai trò: ${allowedRoles.join(', ')}`
        )
      );
    }

    next();
  };
}
