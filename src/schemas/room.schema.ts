import { z } from 'zod';

export const getRoomsQuerySchema = z
  .object({
    from: z
      .string({ required_error: 'Vui lòng cung cấp tham số thời gian bắt đầu (from)' })
      .datetime({ message: 'Thời gian bắt đầu (from) phải có định dạng ISO 8601 hợp lệ' }),
    to: z
      .string({ required_error: 'Vui lòng cung cấp tham số thời gian kết thúc (to)' })
      .datetime({ message: 'Thời gian kết thúc (to) phải có định dạng ISO 8601 hợp lệ' }),
  })
  .refine(
    (data) => {
      const fromTime = new Date(data.from).getTime();
      const toTime = new Date(data.to).getTime();
      return toTime > fromTime;
    },
    {
      message: 'Thời gian kết thúc phải sau thời gian bắt đầu',
      path: ['to'],
    }
  );

export type GetRoomsQuery = z.infer<typeof getRoomsQuerySchema>;
