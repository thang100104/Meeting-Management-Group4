import { prisma } from '../config/database';
import { UserResponseDto } from './auth.service';

export class UserService {
  public async searchUsers(q?: string, limit = 20): Promise<UserResponseDto[]> {
    const keyword = q?.trim();

    const users = await prisma.user.findMany({
      where: {
        status: 'Active',
        ...(keyword
          ? {
              OR: [
                { full_name: { contains: keyword, mode: 'insensitive' } },
                { email: { contains: keyword, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      take: limit,
      include: {
        role: true,
      },
      orderBy: {
        full_name: 'asc',
      },
    });

    return users.map((user) => ({
      user_id: user.user_id,
      full_name: user.full_name,
      email: user.email,
      phone: user.phone,
      role: user.role.role_name as 'Admin' | 'Organizer' | 'Participant',
    }));
  }
}

export const userService = new UserService();
