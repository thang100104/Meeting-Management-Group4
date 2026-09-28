import { NextFunction, Request, Response } from 'express';
import { userService } from '../services/user.service';
import { sendSuccess } from '../utils/response';
import { GetUsersQuery } from '../schemas/user.schema';

export async function getUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { q, limit } = req.query as unknown as GetUsersQuery;
    const users = await userService.searchUsers(q, limit);
    sendSuccess(res, users, 200);
  } catch (error) {
    next(error);
  }
}
