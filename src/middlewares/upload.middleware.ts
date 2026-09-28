import multer from 'multer';
import { Request, Response, NextFunction } from 'express';
import { PayloadTooLargeError } from '../utils/errors';
import { MAX_ATTACHMENT_SIZE_BYTES, MAX_ATTACHMENT_COUNT } from '../storage';

const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: MAX_ATTACHMENT_SIZE_BYTES,
    files: MAX_ATTACHMENT_COUNT,
  },
});

export const meetingUploadMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const contentType = req.headers['content-type'] || '';

  // Nếu không phải multipart form, bỏ qua multer và để express.json() xử lý
  if (!contentType.includes('multipart/form-data')) {
    return next();
  }

  const uploadHandler = upload.array('attachments', MAX_ATTACHMENT_COUNT);

  uploadHandler(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return next(new PayloadTooLargeError('Tệp đính kèm vượt quá dung lượng tối đa 10 MB'));
        }
        if (err.code === 'LIMIT_FILE_COUNT') {
          return next(new PayloadTooLargeError('Vượt quá số lượng tệp tối đa (tối đa 5 tệp)'));
        }
      }
      return next(err);
    }

    // Nếu có field meeting dạng JSON string trong multipart, parse nó vào req.body
    if (req.body && typeof req.body.meeting === 'string') {
      try {
        req.body = JSON.parse(req.body.meeting);
      } catch {
        // Body giữ nguyên để Zod schema bắt lỗi invalid JSON
      }
    }

    next();
  });
};
