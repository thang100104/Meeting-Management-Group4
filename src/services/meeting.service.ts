import crypto from 'crypto';
import { prisma } from '../config/database';
import { ERROR_CODES, WARNING_CODES } from '../config/constants';
import { MeetingInput, GetMeetingsQuery } from '../schemas/meeting.schema';
import { conflictService } from './conflict.service';
import { notificationService } from './notification.service';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  PayloadTooLargeError,
  UnsupportedMediaTypeError,
  ValidationError,
} from '../utils/errors';
import { Warning } from '../types/api';
import {
  storage,
  ALLOWED_MIME_TYPES,
  MAX_ATTACHMENT_SIZE_BYTES,
  MAX_ATTACHMENT_COUNT,
} from '../storage';

export class MeetingService {
  /**
   * Tạo cuộc họp mới (luồng cốt lõi Giai đoạn E)
   */
  public async createMeeting(
    organizerId: number,
    input: MeetingInput,
    files: Express.Multer.File[] = []
  ) {
    const warnings: Warning[] = [];

    // 1. Kiểm tra giới hạn và định dạng các file đính kèm
    if (files.length > MAX_ATTACHMENT_COUNT) {
      throw new PayloadTooLargeError(`Số lượng tệp đính kèm vượt quá giới hạn (tối đa ${MAX_ATTACHMENT_COUNT} tệp)`);
    }

    for (const file of files) {
      if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
        throw new PayloadTooLargeError(`Tệp "${file.originalname}" vượt quá dung lượng tối đa 10 MB`);
      }
      if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
        throw new UnsupportedMediaTypeError(
          `Định dạng tệp "${file.originalname}" không được hỗ trợ. Chỉ chấp nhận PDF, DOCX, XLSX, PPTX`
        );
      }
    }

    // 2. Kiểm tra phòng họp nếu có room_id
    let roomRecord = null;
    if (input.room_id) {
      roomRecord = await prisma.room.findUnique({
        where: { room_id: input.room_id },
      });

      if (!roomRecord) {
        throw new NotFoundError('Phòng họp được chọn không tồn tại trong hệ thống', ERROR_CODES.ROOM_NOT_FOUND);
      }

      if (roomRecord.status === 'Maintenance') {
        throw new ConflictError(
          `Phòng họp "${roomRecord.room_name}" đang bảo trì và không thể đặt lịch`,
          ERROR_CODES.CONFLICT_ROOM
        );
      }
    }

    // 3. Resolve danh sách người tham gia (Participant Resolver)
    const resolvedUserIds = new Set<number>();
    const inviteesData: Array<{ user_id: number; full_name: string; email: string }> = [];

    for (const p of input.participants) {
      const user = await prisma.user.findFirst({
        where:
          'user_id' in p && p.user_id
            ? { user_id: p.user_id }
            : { email: (p as { email: string }).email.toLowerCase().trim() },
        include: { role: true },
      });

      if (!user || user.status !== 'Active') {
        throw new NotFoundError(
          'Không tìm thấy người tham dự trong hệ thống hoặc tài khoản chưa kích hoạt',
          ERROR_CODES.USER_NOT_FOUND
        );
      }

      // Loại bỏ organizer và các user_id trùng lặp
      if (user.user_id !== organizerId && !resolvedUserIds.has(user.user_id)) {
        resolvedUserIds.add(user.user_id);
        inviteesData.push({
          user_id: user.user_id,
          full_name: user.full_name,
          email: user.email,
        });
      }
    }

    if (inviteesData.length === 0) {
      throw new ValidationError('Vui lòng chọn ít nhất 1 người tham gia', [
        {
          field: 'participants',
          code: 'too_small',
          message: 'Vui lòng chọn ít nhất 1 người tham gia',
        },
      ]);
    }

    // 4. Kiểm tra xung đột lịch (Conflict Detection Engine)
    const startDate = new Date(input.start_time);
    const endDate = new Date(input.end_time);
    const allUserIdsToCheck = [organizerId, ...inviteesData.map((u) => u.user_id)];

    const conflicts = await conflictService.checkConflicts(
      input.room_id,
      allUserIdsToCheck,
      startDate,
      endDate
    );

    if (conflicts.length > 0) {
      if (!input.allow_conflicts) {
        // Đề xuất khung giờ trống gần nhất
        const suggestedSlots = await conflictService.suggestAvailableSlots(
          input.room_id,
          allUserIdsToCheck,
          startDate,
          endDate,
          3
        );

        throw new ConflictError(
          'Phát hiện xung đột lịch họp với phòng họp hoặc người tham dự',
          ERROR_CODES.SCHEDULE_CONFLICT,
          {
            details: conflicts,
            suggested_times: suggestedSlots,
            override_allowed: true,
          }
        );
      } else {
        warnings.push({
          code: WARNING_CODES.SCHEDULE_CONFLICT_OVERRIDDEN,
          message: 'Cuộc họp được tạo dù có xung đột lịch theo xác nhận của người dùng',
        });
      }
    }

    // 5. Chuẩn bị token RSVP cho từng người được mời
    const inviteesWithTokens = inviteesData.map((invitee) => {
      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      return {
        ...invitee,
        rawToken,
        tokenHash,
      };
    });

    // 6. Thực hiện Transaction lưu dữ liệu toàn vẹn
    const savedMeeting = await prisma.$transaction(async (tx) => {
      // 6.1 Tạo Meeting
      const meeting = await tx.meeting.create({
        data: {
          organizer_id: organizerId,
          room_id: input.room_id || null,
          title: input.title,
          description: input.description || null,
          meeting_link: input.meeting_link || null,
          start_time: startDate,
          end_time: endDate,
          reminder_minutes_before: 15,
          status: 'Scheduled',
        },
      });

      // 6.2 Thêm Organizer với status Accepted
      await tx.meetingParticipant.create({
        data: {
          meeting_id: meeting.meeting_id,
          user_id: organizerId,
          status: 'Accepted',
        },
      });

      // 6.3 Thêm từng người được mời với status Pending và hash RSVP token
      for (const inv of inviteesWithTokens) {
        await tx.meetingParticipant.create({
          data: {
            meeting_id: meeting.meeting_id,
            user_id: inv.user_id,
            status: 'Pending',
            rsvp_token_hash: inv.tokenHash,
            rsvp_token_expires_at: endDate,
          },
        });
      }

      // 6.4 Tạo Reminder records cho toàn bộ người tham dự trước 15 phút
      const reminderTime = new Date(startDate.getTime() - 15 * 60 * 1000);
      for (const userId of allUserIdsToCheck) {
        await tx.meetingReminder.create({
          data: {
            meeting_id: meeting.meeting_id,
            recipient_user_id: userId,
            scheduled_at: reminderTime,
            status: 'Pending',
          },
        });
      }

      // 6.5 Lưu tệp đính kèm nếu có
      for (const file of files) {
        const { storageKey } = await storage.saveFile(file);
        await tx.meetingAttachment.create({
          data: {
            meeting_id: meeting.meeting_id,
            uploaded_by: organizerId,
            file_name: file.originalname,
            mime_type: file.mimetype,
            size_bytes: BigInt(file.size),
            storage_key: storageKey,
          },
        });
      }

      return meeting;
    });

    // 7. Lấy dữ liệu đầy đủ cuộc họp vừa tạo để trả về client
    const fullMeeting = await prisma.meeting.findUnique({
      where: { meeting_id: savedMeeting.meeting_id },
      include: {
        room: true,
        organizer: { include: { role: true } },
        participants: { include: { user: true } },
        attachments: true,
      },
    });

    // 8. Kích hoạt gửi email thông báo sau commit (cô lập lỗi)
    const dispatchResult = await notificationService.sendInvitations({
      meetingId: savedMeeting.meeting_id,
      title: savedMeeting.title,
      description: savedMeeting.description,
      startTime: startDate,
      endTime: endDate,
      location: roomRecord?.room_name || input.meeting_link || 'Họp trực tuyến',
      recipients: inviteesWithTokens.map((inv) => ({
        userId: inv.user_id,
        fullName: inv.full_name,
        email: inv.email,
        rsvpToken: inv.rawToken,
      })),
    });

    if (dispatchResult.failCount > 0) {
      warnings.push({
        code: WARNING_CODES.INVITATION_EMAIL_FAILED,
        message: 'Lưu cuộc họp thành công nhưng gửi một số email mời họp gặp sự cố',
      });
    }

    // 9. Format response theo schema OpenAPI
    return {
      meeting: {
        meeting_id: fullMeeting!.meeting_id,
        title: fullMeeting!.title,
        description: fullMeeting!.description,
        start_time: fullMeeting!.start_time.toISOString(),
        end_time: fullMeeting!.end_time.toISOString(),
        room: fullMeeting!.room
          ? {
              room_id: fullMeeting!.room.room_id,
              room_name: fullMeeting!.room.room_name,
              capacity: fullMeeting!.room.capacity,
              location: fullMeeting!.room.location,
              status: fullMeeting!.room.status,
            }
          : null,
        meeting_link: fullMeeting!.meeting_link,
        organizer: {
          user_id: fullMeeting!.organizer.user_id,
          full_name: fullMeeting!.organizer.full_name,
          email: fullMeeting!.organizer.email,
          phone: fullMeeting!.organizer.phone,
          role: fullMeeting!.organizer.role.role_name,
        },
        participants: fullMeeting!.participants.map((p) => ({
          user_id: p.user.user_id,
          full_name: p.user.full_name,
          email: p.user.email,
          status: p.status,
        })),
        status: fullMeeting!.status,
        created_at: fullMeeting!.created_at.toISOString(),
        reminder_minutes_before: fullMeeting!.reminder_minutes_before,
        attachments: fullMeeting!.attachments.map((att) => ({
          attachment_id: att.attachment_id,
          file_name: att.file_name,
          mime_type: att.mime_type,
          size_bytes: Number(att.size_bytes),
        })),
      },
      warnings,
    };
  }

  /**
   * Lấy danh sách cuộc họp trong khoảng thời gian có phân quyền
   */
  public async getMeetings(
    userId: number,
    role: string,
    query: GetMeetingsQuery
  ) {
    const fromDate = new Date(query.from);
    const toDate = new Date(query.to);

    // Xây dựng điều kiện lọc theo phân quyền:
    // Admin thấy tất cả cuộc họp; Người dùng thường chỉ thấy cuộc họp do mình tổ chức hoặc được mời
    const whereClause: any = {
      start_time: { lte: toDate },
      end_time: { gte: fromDate },
      ...(query.room_id ? { room_id: query.room_id } : {}),
    };

    if (role !== 'Admin') {
      whereClause.OR = [
        { organizer_id: userId },
        { participants: { some: { user_id: userId } } },
      ];
    }

    const meetings = await prisma.meeting.findMany({
      where: whereClause,
      include: {
        room: {
          select: {
            room_id: true,
            room_name: true,
            capacity: true,
            location: true,
          },
        },
        organizer: {
          select: {
            user_id: true,
            full_name: true,
            email: true,
            department: { select: { department_name: true } },
          },
        },
        participants: {
          include: {
            user: {
              select: {
                user_id: true,
                full_name: true,
                email: true,
                department: { select: { department_name: true } },
              },
            },
          },
        },
        attachments: {
          select: {
            attachment_id: true,
            file_name: true,
            mime_type: true,
            size_bytes: true,
            created_at: true,
          },
        },
      },
      orderBy: {
        start_time: 'asc',
      },
    });

    return meetings.map((m) => ({
      meeting_id: m.meeting_id,
      title: m.title,
      description: m.description,
      start_time: m.start_time.toISOString(),
      end_time: m.end_time.toISOString(),
      room: m.room
        ? {
            room_id: m.room.room_id,
            room_name: m.room.room_name,
            capacity: m.room.capacity,
            location: m.room.location,
          }
        : null,
      meeting_link: m.meeting_link,
      organizer: {
        user_id: m.organizer.user_id,
        full_name: m.organizer.full_name,
        email: m.organizer.email,
        department: m.organizer.department?.department_name || null,
      },
      participants: m.participants.map((p) => ({
        user_id: p.user.user_id,
        full_name: p.user.full_name,
        email: p.user.email,
        department: p.user.department?.department_name || null,
        status: p.status,
      })),
      status: m.status,
      created_at: m.created_at.toISOString(),
      reminder_minutes_before: m.reminder_minutes_before,
      attachments: m.attachments.map((att) => ({
        attachment_id: att.attachment_id,
        file_name: att.file_name,
        mime_type: att.mime_type,
        size_bytes: Number(att.size_bytes),
      })),
    }));
  }

  /**
   * Lấy chi tiết cuộc họp theo ID có phân quyền
   */
  public async getMeetingById(meetingId: number, userId: number, role: string) {
    const meeting = await prisma.meeting.findUnique({
      where: { meeting_id: meetingId },
      include: {
        room: true,
        organizer: {
          select: {
            user_id: true,
            full_name: true,
            email: true,
            department: { select: { department_name: true } },
          },
        },
        participants: {
          include: {
            user: {
              select: {
                user_id: true,
                full_name: true,
                email: true,
                department: { select: { department_name: true } },
              },
            },
          },
        },
        attachments: true,
      },
    });

    if (!meeting) {
      throw new NotFoundError('Không tìm thấy cuộc họp yêu cầu', ERROR_CODES.MEETING_NOT_FOUND);
    }

    if (role !== 'Admin') {
      const isOrganizer = meeting.organizer_id === userId;
      const isParticipant = meeting.participants.some((p) => p.user_id === userId);
      if (!isOrganizer && !isParticipant) {
        throw new ForbiddenError('Bạn không có quyền xem thông tin cuộc họp này');
      }
    }

    return {
      meeting_id: meeting.meeting_id,
      title: meeting.title,
      description: meeting.description,
      start_time: meeting.start_time.toISOString(),
      end_time: meeting.end_time.toISOString(),
      room: meeting.room
        ? {
            room_id: meeting.room.room_id,
            room_name: meeting.room.room_name,
            capacity: meeting.room.capacity,
            location: meeting.room.location,
          }
        : null,
      meeting_link: meeting.meeting_link,
      organizer: {
        user_id: meeting.organizer.user_id,
        full_name: meeting.organizer.full_name,
        email: meeting.organizer.email,
        department: meeting.organizer.department?.department_name || null,
      },
      participants: meeting.participants.map((p) => ({
        user_id: p.user.user_id,
        full_name: p.user.full_name,
        email: p.user.email,
        department: p.user.department?.department_name || null,
        status: p.status,
      })),
      status: meeting.status,
      created_at: meeting.created_at.toISOString(),
      reminder_minutes_before: meeting.reminder_minutes_before,
      attachments: meeting.attachments.map((att) => ({
        attachment_id: att.attachment_id,
        file_name: att.file_name,
        mime_type: att.mime_type,
        size_bytes: Number(att.size_bytes),
      })),
    };
  }
}

export const meetingService = new MeetingService();
