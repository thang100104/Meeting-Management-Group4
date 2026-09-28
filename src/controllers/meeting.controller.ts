import { Request, Response, NextFunction } from 'express';
import { meetingService } from '../services/meeting.service';
import { sendSuccess } from '../utils/response';
import { GetMeetingsQuery } from '../schemas/meeting.schema';
import { prisma } from '../config/database';
import { storage } from '../storage';
import { NotFoundError, ForbiddenError } from '../utils/errors';

export async function createMeeting(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const organizerId = req.user!.user_id;
    const files = (req.files as Express.Multer.File[]) || [];
    const result = await meetingService.createMeeting(organizerId, req.body, files);

    sendSuccess(res, result.meeting, 201, result.warnings);
  } catch (error) {
    next(error);
  }
}

export async function getMeetings(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user!.user_id;
    const role = req.user!.role;
    const query = req.query as unknown as GetMeetingsQuery;

    const meetings = await meetingService.getMeetings(userId, role, query);
    sendSuccess(res, meetings, 200);
  } catch (error) {
    next(error);
  }
}

export async function getMeetingById(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user!.user_id;
    const role = req.user!.role;
    const meetingId = parseInt(req.params.id, 10);

    const meeting = await meetingService.getMeetingById(meetingId, userId, role);
    sendSuccess(res, meeting, 200);
  } catch (error) {
    next(error);
  }
}

export async function downloadAttachment(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const meetingId = parseInt(req.params.id, 10);
    const attachmentId = parseInt(req.params.attachmentId, 10);
    const userId = req.user!.user_id;
    const role = req.user!.role;

    const meeting = await prisma.meeting.findUnique({
      where: { meeting_id: meetingId },
      include: { participants: true },
    });
    if (!meeting) {
      throw new NotFoundError('Không tìm thấy cuộc họp');
    }
    if (role !== 'Admin') {
      const isOrganizer = meeting.organizer_id === userId;
      const isParticipant = meeting.participants.some((p) => p.user_id === userId);
      if (!isOrganizer && !isParticipant) {
        throw new ForbiddenError('Bạn không có quyền tải tệp đính kèm này');
      }
    }

    const attachment = await prisma.meetingAttachment.findUnique({
      where: { attachment_id: attachmentId },
    });
    if (!attachment || attachment.meeting_id !== meetingId) {
      throw new NotFoundError('Không tìm thấy tệp đính kèm');
    }

    const filePath = storage.getFilePath(attachment.storage_key);
    res.download(filePath, attachment.file_name);
  } catch (error) {
    next(error);
  }
}


