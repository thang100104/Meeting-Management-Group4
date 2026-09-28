import { prisma } from '../config/database';

export interface RoomResponseDto {
  room_id: number;
  room_name: string;
  capacity: number;
  location: string | null;
  status: 'Available' | 'Maintenance';
}

export class RoomService {
  public async getAvailableRooms(from: Date, to: Date): Promise<RoomResponseDto[]> {
    const rooms = await prisma.room.findMany({
      where: {
        status: 'Available',
        meetings: {
          none: {
            status: {
              not: 'Cancelled',
            },
            start_time: {
              lt: to,
            },
            end_time: {
              gt: from,
            },
          },
        },
      },
      orderBy: [
        { capacity: 'asc' },
        { room_name: 'asc' },
      ],
    });

    return rooms.map((room) => ({
      room_id: room.room_id,
      room_name: room.room_name,
      capacity: room.capacity,
      location: room.location,
      status: room.status as 'Available' | 'Maintenance',
    }));
  }
}

export const roomService = new RoomService();
