import { Router } from 'express';
import {
  createMeeting,
  getMeetings,
  getMeetingById,
  downloadAttachment,
} from '../controllers/meeting.controller';
import { authenticateBearer, requireRole } from '../middlewares/auth.middleware';
import { meetingUploadMiddleware } from '../middlewares/upload.middleware';
import { validate } from '../middlewares/validate.middleware';
import { meetingInputSchema, getMeetingsQuerySchema } from '../schemas/meeting.schema';

const router = Router();

router.get(
  '/',
  authenticateBearer,
  validate({ query: getMeetingsQuerySchema }),
  getMeetings
);

router.get(
  '/:id',
  authenticateBearer,
  getMeetingById
);

router.get(
  '/:id/attachments/:attachmentId',
  authenticateBearer,
  downloadAttachment
);

router.post(
  '/',
  authenticateBearer,
  requireRole('Admin', 'Organizer'),
  meetingUploadMiddleware,
  validate({ body: meetingInputSchema }),
  createMeeting
);

export default router;

