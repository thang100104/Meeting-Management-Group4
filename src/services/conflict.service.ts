import { prisma } from '../config/database';
import { ERROR_CODES } from '../config/constants';
import { ErrorDetail, SuggestedTime } from '../types/api';

export class ConflictService {
  /**
   * Kiểm tra xung đột lịch cho phòng họp và danh sách người tham gia
   */
  public async checkConflicts(
    roomId: number | null | undefined,
    userIds: number[],
    startTime: Date,
    endTime: Date,
    excludeMeetingId?: number
  ): Promise<ErrorDetail[]> {
    const details: ErrorDetail[] = [];

    // 1. Kiểm tra trùng phòng họp nếu có room_id
    if (roomId) {
      const conflictingRoomMeetings = await prisma.meeting.findMany({
        where: {
          room_id: roomId,
          status: { not: 'Cancelled' },
          start_time: { lt: endTime },
          end_time: { gt: startTime },
          ...(excludeMeetingId ? { meeting_id: { not: excludeMeetingId } } : {}),
        },
        include: { room: true },
      });

      for (const meeting of conflictingRoomMeetings) {
        details.push({
          field: 'room_id',
          code: ERROR_CODES.CONFLICT_ROOM,
          message: `Phòng họp "${meeting.room?.room_name || roomId}" đã có lịch họp khác trong khoảng thời gian này`,
          entity_id: roomId,
          entity_name: meeting.room?.room_name,
          meeting_id: meeting.meeting_id,
        });
      }
    }

    // 2. Kiểm tra trùng lịch của từng người tham gia (bao gồm organizer)
    if (userIds.length > 0) {
      const conflictingParticipants = await prisma.meetingParticipant.findMany({
        where: {
          user_id: { in: userIds },
          status: { not: 'Declined' },
          meeting: {
            status: { not: 'Cancelled' },
            start_time: { lt: endTime },
            end_time: { gt: startTime },
            ...(excludeMeetingId ? { meeting_id: { not: excludeMeetingId } } : {}),
          },
        },
        include: {
          user: true,
          meeting: true,
        },
      });

      for (const p of conflictingParticipants) {
        details.push({
          field: 'participants',
          code: ERROR_CODES.CONFLICT_PARTICIPANT,
          message: `Người dùng ${p.user.full_name} đã có lịch họp khác trong khoảng thời gian này`,
          entity_id: p.user_id,
          entity_name: p.user.full_name,
          meeting_id: p.meeting_id,
        });
      }
    }

    return details;
  }

  /**
   * Đề xuất tối đa maxSlots (mặc định 3) khung giờ trống gần nhất:
   * - Cùng ngày với requestedStartTime theo múi giờ Asia/Ho_Chi_Minh (UTC+7)
   * - Bắt đầu sau requestedStartTime
   * - Nằm trong giờ làm việc 08:00 - 18:00 (Asia/Ho_Chi_Minh)
   * - Giữ nguyên thời lượng cuộc họp
   * - Bước nhảy 15 phút
   */
  public async suggestAvailableSlots(
    roomId: number | null | undefined,
    userIds: number[],
    requestedStartTime: Date,
    requestedEndTime: Date,
    maxSlots = 3
  ): Promise<SuggestedTime[]> {
    const durationMs = requestedEndTime.getTime() - requestedStartTime.getTime();
    if (durationMs <= 0) return [];

    const suggestedSlots: SuggestedTime[] = [];

    // Chuyển sang múi giờ Asia/Ho_Chi_Minh (+7 giờ = +420 phút)
    const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
    const vnStartTime = new Date(requestedStartTime.getTime() + VN_OFFSET_MS);

    // Xác định mốc 18:00 cùng ngày theo giờ VN
    const vnWorkDayEnd = new Date(vnStartTime);
    vnWorkDayEnd.setUTCHours(18, 0, 0, 0);

    // Mốc bắt đầu duyệt: làm tròn lên bội số 15 phút kế tiếp của requestedStartTime
    const stepMs = 15 * 60 * 1000;
    let candidateStartMs = Math.ceil((requestedStartTime.getTime() + stepMs) / stepMs) * stepMs;

    while (suggestedSlots.length < maxSlots) {
      const candidateEndMs = candidateStartMs + durationMs;
      const candidateStartVN = new Date(candidateStartMs + VN_OFFSET_MS);
      const candidateEndVN = new Date(candidateEndMs + VN_OFFSET_MS);

      // Nếu slot kết thúc vượt quá 18:00 hoặc sang ngày khác, dừng tìm kiếm
      if (
        candidateStartVN.getUTCDate() !== vnStartTime.getUTCDate() ||
        candidateEndVN.getTime() > vnWorkDayEnd.getTime()
      ) {
        break;
      }

      const candidateStartDate = new Date(candidateStartMs);
      const candidateEndDate = new Date(candidateEndMs);

      // Kiểm tra xem slot này có bị xung đột không
      const conflicts = await this.checkConflicts(
        roomId,
        userIds,
        candidateStartDate,
        candidateEndDate
      );

      if (conflicts.length === 0) {
        suggestedSlots.push({
          start_time: candidateStartDate.toISOString(),
          end_time: candidateEndDate.toISOString(),
        });
      }

      candidateStartMs += stepMs;
    }

    return suggestedSlots;
  }
}

export const conflictService = new ConflictService();
