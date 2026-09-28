import { z } from 'zod';

export const getUsersQuerySchema = z.object({
  q: z.string().max(100, 'Từ khóa tìm kiếm tối đa 100 ký tự').optional(),
  limit: z.coerce.number().int().min(1, 'Limit tối thiểu là 1').max(100, 'Limit tối đa là 100').default(20),
});

export type GetUsersQuery = z.infer<typeof getUsersQuerySchema>;
