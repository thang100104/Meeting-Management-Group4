import { z } from 'zod';

export const participantInputSchema = z.union([
  z.object({
    user_id: z.number().int().min(1, 'ID người dùng không hợp lệ'),
  }),
  z.object({
    email: z.string().email('Email người dùng không hợp lệ'),
  }),
]);

export type ParticipantInput = z.infer<typeof participantInputSchema>;

export const meetingInputSchema = z
  .object({
    title: z
      .string({ required_error: 'Vui lòng nhập tên cuộc họp' })
      .trim()
      .min(1, 'Vui lòng nhập tên cuộc họp')
      .max(200, 'Tên cuộc họp tối đa 200 ký tự'),
    description: z.string().nullable().optional(),
    start_time: z
      .string({ required_error: 'Vui lòng chọn thời gian bắt đầu' })
      .datetime({ message: 'Thời gian bắt đầu phải có định dạng ISO 8601 hợp lệ' }),
    end_time: z
      .string({ required_error: 'Vui lòng chọn thời gian kết thúc' })
      .datetime({ message: 'Thời gian kết thúc phải có định dạng ISO 8601 hợp lệ' }),
    room_id: z.number().int().positive().nullable().optional(),
    meeting_link: z.string().url('Đường dẫn cuộc họp trực tuyến không hợp lệ').nullable().optional(),
    participants: z
      .array(participantInputSchema, {
        required_error: 'Vui lòng chọn ít nhất 1 người tham gia',
      })
      .min(1, 'Vui lòng chọn ít nhất 1 người tham gia'),
    allow_conflicts: z.boolean().optional().default(false),
  })
  .refine(
    (data) => {
      const startTime = new Date(data.start_time).getTime();
      const endTime = new Date(data.end_time).getTime();
      return endTime > startTime;
    },
    {
      message: 'Thời gian kết thúc phải sau thời gian bắt đầu',
      path: ['end_time'],
    }
  )
  .refine(
    (data) => {
      const startTime = new Date(data.start_time).getTime();
      // Cho phép buffer 2 phút để bù độ trễ mạng khi gửi request
      const nowBuffer = Date.now() - 2 * 60 * 1000;
      return startTime >= nowBuffer;
    },
    {
      message: 'Thời gian bắt đầu không được ở quá khứ',
      path: ['start_time'],
    }
  );

export type MeetingInput = z.infer<typeof meetingInputSchema>;

export const getMeetingsQuerySchema = z
  .object({
    from: z
      .string({ required_error: 'Vui lòng cung cấp tham số thời gian bắt đầu (from)' })
      .datetime({ message: 'Thời gian bắt đầu (from) phải có định dạng ISO 8601 hợp lệ' }),
    to: z
      .string({ required_error: 'Vui lòng cung cấp tham số thời gian kết thúc (to)' })
      .datetime({ message: 'Thời gian kết thúc (to) phải có định dạng ISO 8601 hợp lệ' }),
    room_id: z.coerce.number().int().positive().optional(),
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
  )
  .refine(
    (data) => {
      const fromTime = new Date(data.from).getTime();
      const toTime = new Date(data.to).getTime();
      const maxRangeMs = 31 * 24 * 60 * 60 * 1000;
      return toTime - fromTime <= maxRangeMs;
    },
    {
      message: 'Khoảng thời gian tra cứu không được vượt quá 31 ngày',
      path: ['to'],
    }
  );

export type GetMeetingsQuery = z.infer<typeof getMeetingsQuerySchema>;
