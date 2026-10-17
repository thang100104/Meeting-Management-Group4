import { NextFunction, Request, Response } from 'express';
import { roomService } from '../services/room.service';
import { sendSuccess } from '../utils/response';
import { GetRoomsQuery } from '../schemas/room.schema';

export async function getRooms(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { from, to } = req.query as unknown as GetRoomsQuery;
    const rooms = await roomService.getAvailableRooms(new Date(from), new Date(to));
    sendSuccess(res, rooms, 200);
  } catch (error) {
    next(error);
  }
}
