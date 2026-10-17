import { z } from 'zod';

export const loginSchema = z.object({
  email: z
    .string({ required_error: 'Vui lòng nhập email' })
    .email('Email không đúng định dạng'),
  password: z
    .string({ required_error: 'Vui lòng nhập mật khẩu' })
    .min(8, 'Mật khẩu phải có ít nhất 8 ký tự'),
});

export type LoginInput = z.infer<typeof loginSchema>;
