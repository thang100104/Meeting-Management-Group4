import { prisma } from '../config/database';
import { logger } from '../utils/logger';

export interface SendInvitationParams {
  meetingId: number;
  title: string;
  description?: string | null;
  startTime: Date;
  endTime: Date;
  location?: string | null;
  recipients: Array<{
    userId: number;
    fullName: string;
    email: string;
    rsvpToken?: string; // Token riêng biệt cho người được mời
  }>;
}

export class NotificationService {
  /**
   * Tạo nội dung file lịch .ics vCalendar
   */
  public generateICS(title: string, description: string | null | undefined, start: Date, end: Date, location?: string | null): string {
    const formatDate = (d: Date) =>
      d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

    return [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Meeting Management System//VN',
      'CALSCALE:GREGORIAN',
      'METHOD:REQUEST',
      'BEGIN:VEVENT',
      `UID:meeting-${Date.now()}-${Math.random().toString(36).substring(2, 9)}@company.com`,
      `DTSTAMP:${formatDate(new Date())}`,
      `DTSTART:${formatDate(start)}`,
      `DTEND:${formatDate(end)}`,
      `SUMMARY:${title}`,
      `DESCRIPTION:${(description || '').replace(/\n/g, '\\n')}`,
      location ? `LOCATION:${location}` : '',
      'STATUS:CONFIRMED',
      'END:VEVENT',
      'END:VCALENDAR',
    ]
      .filter(Boolean)
      .join('\r\n');
  }

  /**
   * Gửi email mời họp và ghi nhật ký NOTIFICATION_LOG.
   * Không ném ngoại lệ làm gián đoạn transaction meeting.
   */
  public async sendInvitations(params: SendInvitationParams): Promise<{ successCount: number; failCount: number }> {
    let successCount = 0;
    let failCount = 0;

    for (const recipient of params.recipients) {
      try {
        // Trong môi trường development / staging, ghi log thông tin email gửi đi
        logger.info(
          `📧 [Email Dispatch] Gửi thư mời họp tới ${recipient.fullName} <${recipient.email}> cho cuộc họp "${params.title}" (RSVP Token: ${recipient.rsvpToken || 'N/A'})`
        );

        // Giả lập gửi SMTP provider thành công (hoặc tích hợp nodemailer nếu có config)
        await prisma.notificationLog.create({
          data: {
            meeting_id: params.meetingId,
            recipient_user_id: recipient.userId,
            type: 'Invite',
            channel: 'Email',
            status: 'Sent',
            sent_at: new Date(),
          },
        });

        successCount++;
      } catch (error) {
        failCount++;
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(`❌ Gửi email mời họp thất bại tới user ${recipient.userId}: ${errorMessage}`);

        // Ghi log trạng thái Failed
        try {
          await prisma.notificationLog.create({
            data: {
              meeting_id: params.meetingId,
              recipient_user_id: recipient.userId,
              type: 'Invite',
              channel: 'Email',
              status: 'Failed',
              sent_at: null,
              error_message: errorMessage,
            },
          });
        } catch (logDbErr) {
          logger.error('Không thể ghi NOTIFICATION_LOG thất bại:', { logDbErr });
        }
      }
    }

    return { successCount, failCount };
  }
}

export const notificationService = new NotificationService();
