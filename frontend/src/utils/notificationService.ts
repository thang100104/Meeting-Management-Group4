import { getStorage, setStorage } from './syncHelper';

export type UserRole = 'admin' | 'lecturer' | 'student';

export interface SystemNotification {
  id: string | number;
  title: string;
  content: string;
  createdAt: string;
  isRead: boolean;
  targetRole: 'admin' | 'lecturer' | 'student' | 'all';
  targetEmail?: string;
  senderRole?: 'admin' | 'lecturer' | 'student';
  senderName?: string;
  type?: 'booking' | 'approval' | 'rejection' | 'schedule' | 'message' | 'system';
}

// Dữ liệu mẫu chuẩn hóa riêng biệt cho 3 vai trò theo đúng quy định:
// 1. Quản trị viên: Nhận thông báo khi Giảng viên đặt phòng / mượn thiết bị và tin nhắn từ Giảng viên.
// 2. Giảng viên: Nhận thông báo từ Quản trị viên (duyệt/từ chối đặt phòng, thiết bị) + tin nhắn từ Quản trị viên và Sinh viên.
// 3. Sinh viên: Nhận thông báo lịch họp/buổi họp + tin nhắn từ Thầy cô.
export const DEFAULT_NOTIFICATIONS: SystemNotification[] = [
  // ── ADMIN NOTIFICATIONS ──
  {
    id: 'adm_1',
    title: 'Yêu cầu đặt phòng mới từ GV Nguyễn Phương',
    content: "Phòng 'Hội trường lớn' cho cuộc họp 'Họp khoa CNTT & Đồ án K19' đang chờ bạn phê duyệt.",
    createdAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    isRead: false,
    targetRole: 'admin',
    senderRole: 'lecturer',
    senderName: 'GV Nguyễn Phương',
    type: 'booking'
  },
  {
    id: 'adm_2',
    title: 'Yêu cầu mượn thiết bị mới từ GV Hoàng Thanh',
    content: "Mượn 02 Micro không dây và 01 Máy chiếu Sony 4K cho Hội thảo nghiên cứu khoa học.",
    createdAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    isRead: false,
    targetRole: 'admin',
    senderRole: 'lecturer',
    senderName: 'GV Hoàng Thanh',
    type: 'booking'
  },
  {
    id: 'adm_3',
    title: 'Tin nhắn mới từ GV Nguyễn Phương',
    content: "Thầy Phương: 'Nhờ Ban quản trị kiểm tra lại điều hòa phòng C102 trước 14:00 chiều nay giúp tôi.'",
    createdAt: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
    isRead: true,
    targetRole: 'admin',
    senderRole: 'lecturer',
    senderName: 'GV Nguyễn Phương',
    type: 'message'
  },
  {
    id: 'adm_4',
    title: 'Báo cáo sự cố từ GV Trần Văn Nam',
    content: "Báo cáo: 'Máy chiếu phòng B201 hiển thị hình ảnh chập chờn, nhờ kỹ thuật viên hỗ trợ.'",
    createdAt: new Date(Date.now() - 1000 * 60 * 360).toISOString(),
    isRead: true,
    targetRole: 'admin',
    senderRole: 'lecturer',
    senderName: 'GV Trần Văn Nam',
    type: 'message'
  },

  // ── LECTURER NOTIFICATIONS ──
  {
    id: 'lec_1',
    title: 'Đã duyệt yêu cầu đặt phòng',
    content: "Phòng 'Hội trường lớn' cho cuộc họp 'Họp đồng hương' (10/10/2026 08:00 - 10:00) đã được Quản trị viên phê duyệt.",
    createdAt: new Date(Date.now() - 1000 * 60 * 20).toISOString(),
    isRead: false,
    targetRole: 'lecturer',
    senderRole: 'admin',
    senderName: 'Quản trị viên',
    type: 'approval'
  },
  {
    id: 'lec_2',
    title: 'Đã duyệt yêu cầu mượn thiết bị',
    content: "Yêu cầu mượn 'Máy chiếu Sony 4K' đã được Quản trị viên phê duyệt thành công.",
    createdAt: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
    isRead: false,
    targetRole: 'lecturer',
    senderRole: 'admin',
    senderName: 'Quản trị viên',
    type: 'approval'
  },
  {
    id: 'lec_3',
    title: 'Từ chối yêu cầu đặt phòng',
    content: "Yêu cầu đặt phòng Lab 3 vào ngày 12/10 bị từ chối do trùng lịch thi học kỳ tập trung.",
    createdAt: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
    isRead: true,
    targetRole: 'lecturer',
    senderRole: 'admin',
    senderName: 'Quản trị viên',
    type: 'rejection'
  },
  {
    id: 'lec_4',
    title: 'Tin nhắn từ Quản trị viên',
    content: "Admin: 'Phòng Hội thảo B1 đã được kỹ thuật viên chuẩn bị đầy đủ thiết bị âm thanh theo yêu cầu.'",
    createdAt: new Date(Date.now() - 1000 * 60 * 240).toISOString(),
    isRead: true,
    targetRole: 'lecturer',
    senderRole: 'admin',
    senderName: 'Quản trị viên',
    type: 'message'
  },
  {
    id: 'lec_5',
    title: 'Tin nhắn từ Sinh viên Trần Linh',
    content: "Sinh viên Trần Linh: 'Em xin phép thầy cho nhóm em thuyết trình đầu tiên trong buổi họp ngày mai ạ.'",
    createdAt: new Date(Date.now() - 1000 * 60 * 300).toISOString(),
    isRead: false,
    targetRole: 'lecturer',
    senderRole: 'student',
    senderName: 'Sinh viên Trần Linh',
    type: 'message'
  },

  // ── STUDENT NOTIFICATIONS ──
  {
    id: 'stu_1',
    title: 'Lịch họp mới được công bố',
    content: "Cuộc họp 'Họp đồng hương sinh viên' tại Phòng Hội trường lớn lúc 08:00 - 10:00 ngày 10/10/2026.",
    createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    isRead: false,
    targetRole: 'student',
    senderRole: 'lecturer',
    senderName: 'Ban tổ chức',
    type: 'schedule'
  },
  {
    id: 'stu_2',
    title: 'Nhắc nhở lịch họp lớp sắp diễn ra',
    content: "Buổi sinh hoạt lớp 'Đồ án tốt nghiệp K19' tại Phòng Thư viện lúc 14:00 - 16:00 ngày 15/10/2026.",
    createdAt: new Date(Date.now() - 1000 * 60 * 80).toISOString(),
    isRead: false,
    targetRole: 'student',
    senderRole: 'lecturer',
    senderName: 'GV Cố vấn',
    type: 'schedule'
  },
  {
    id: 'stu_3',
    title: 'Lịch họp chuyên đề nghiên cứu khoa học',
    content: "Chuyên đề 'Ứng dụng AI trong quản lý' tại Hội trường C lúc 09:00 ngày 18/10/2026.",
    createdAt: new Date(Date.now() - 1000 * 60 * 150).toISOString(),
    isRead: true,
    targetRole: 'student',
    senderRole: 'lecturer',
    senderName: 'Khoa CNTT',
    type: 'schedule'
  },
  {
    id: 'stu_4',
    title: 'Tin nhắn từ GV Nguyễn Phương',
    content: "Thầy Phương: 'Các em nhóm 4 chú ý hoàn thiện slide và tài liệu trước buổi báo cáo ngày mai nhé.'",
    createdAt: new Date(Date.now() - 1000 * 60 * 210).toISOString(),
    isRead: false,
    targetRole: 'student',
    senderRole: 'lecturer',
    senderName: 'GV Nguyễn Phương',
    type: 'message'
  },
  {
    id: 'stu_5',
    title: 'Tin nhắn từ GV Hoàng Thanh',
    content: "Thầy Thanh: 'Thầy đã gửi tài liệu hướng dẫn tham gia cuộc họp vào email của các em, vui lòng kiểm tra.'",
    createdAt: new Date(Date.now() - 1000 * 60 * 360).toISOString(),
    isRead: true,
    targetRole: 'student',
    senderRole: 'lecturer',
    senderName: 'GV Hoàng Thanh',
    type: 'message'
  }
];

export const getAllNotifications = (): SystemNotification[] => {
  const stored = getStorage<SystemNotification[]>('system_notifications', []);
  // Nếu chưa có hoặc tất cả chưa có targetRole (dữ liệu cũ bị trùng lặp) -> tự động chuyển đổi sang bộ mẫu chuẩn
  const hasValidRoles = Array.isArray(stored) && stored.length > 0 && stored.some(n => !!n.targetRole);
  if (!hasValidRoles) {
    setStorage('system_notifications', DEFAULT_NOTIFICATIONS);
    return DEFAULT_NOTIFICATIONS;
  }
  return stored;
};

export const getNotificationsForRole = (role: UserRole | string): SystemNotification[] => {
  const normalizedRole: UserRole = 
    role === 'admin' || role === 'ADMIN' || role === 'quản trị viên' ? 'admin' :
    role === 'lecturer' || role === 'LECTURER' || role === 'giảng viên' ? 'lecturer' : 'student';

  const all = getAllNotifications();
  return all.filter(n => n.targetRole === normalizedRole || n.targetRole === 'all');
};

export const addNotification = (notif: {
  title: string;
  content: string;
  targetRole: 'admin' | 'lecturer' | 'student' | 'all';
  senderRole?: 'admin' | 'lecturer' | 'student';
  senderName?: string;
  type?: 'booking' | 'approval' | 'rejection' | 'schedule' | 'message' | 'system';
}): SystemNotification => {
  const current = getAllNotifications();
  const newNotif: SystemNotification = {
    id: 'notif_' + Date.now(),
    title: notif.title,
    content: notif.content,
    createdAt: new Date().toISOString(),
    isRead: false,
    targetRole: notif.targetRole,
    senderRole: notif.senderRole,
    senderName: notif.senderName,
    type: notif.type || 'system'
  };

  const updated = [newNotif, ...current];
  setStorage('system_notifications', updated);
  window.dispatchEvent(new Event('system-notification-updated'));
  return newNotif;
};

export const getMeetingNotificationsForUser = (meetings: any[], userProfile: any): SystemNotification[] => {
  if (!Array.isArray(meetings) || !userProfile) return [];
  const uid = userProfile.id || userProfile.user_id;
  const email = (userProfile.email || '').toLowerCase();
  const readIds = getStorage<string[]>('read_meeting_notif_ids', []);
  const now = (() => {
    try {
      const d = new Date();
      return new Date(d.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
    } catch {
      return new Date();
    }
  })();
  const notifs: SystemNotification[] = [];

  meetings.forEach((m: any) => {
    if (['CANCELLED', 'REJECTED', 'COMPLETED'].includes(m.status)) return;
    const st = new Date(m.start_time);
    const et = new Date(m.end_time);
    const isInProgress = now >= st && now <= et;
    const diffMin = Math.round((st.getTime() - now.getTime()) / (1000 * 60));
    const isUpcoming = diffMin > 0 && diffMin <= 120;

    const isOrganizer = m.organizer_id === uid || (m.organizer?.email && m.organizer.email.toLowerCase() === email);
    const participantRecord = Array.isArray(m.participants) && m.participants.find((p: any) =>
      p.user_id === uid || (p.user?.email && p.user.email.toLowerCase() === email)
    );

    // 1. Lời mời tham gia cuộc họp (dành cho khách mời chưa xác nhận)
    if (participantRecord && participantRecord.rsvp_status === 'PENDING') {
      const id = `invitation_${m.meeting_id}`;
      notifs.push({
        id,
        title: `Lời mời tham gia: "${m.title}"`,
        content: `Bạn được mời tham gia cuộc họp "${m.title}" tại ${m.room?.room_name || 'Phòng họp'} (${st.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${et.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}, ${st.toLocaleDateString('vi-VN')}). Người mời: ${m.organizer?.full_name || 'Chủ trì'}.`,
        createdAt: m.created_at || m.start_time,
        isRead: readIds.includes(id),
        targetRole: 'all',
        targetEmail: email,
        senderName: m.organizer?.full_name || 'Chủ trì',
        senderRole: 'lecturer',
        type: 'schedule'
      });
    }

    // 2. Cuộc họp đang diễn ra (cho cả người tổ chức và người tham gia)
    if ((isOrganizer || participantRecord) && isInProgress) {
      const id = `inprogress_${m.meeting_id}`;
      notifs.push({
        id,
        title: `🟢 Cuộc họp đang diễn ra: "${m.title}"`,
        content: `Phòng ${m.room?.room_name || 'họp'} đang diễn ra cuộc họp "${m.title}" (${st.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${et.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}).`,
        createdAt: m.start_time,
        isRead: readIds.includes(id),
        targetRole: 'all',
        targetEmail: email,
        senderName: m.organizer?.full_name || 'Hệ thống',
        senderRole: 'lecturer',
        type: 'booking'
      });
    }

    // 3. Cuộc họp sắp diễn ra trong 2 giờ
    if ((isOrganizer || participantRecord) && isUpcoming) {
      const id = `upcoming_${m.meeting_id}`;
      notifs.push({
        id,
        title: `🔔 Sắp diễn ra sau ${diffMin} phút: "${m.title}"`,
        content: `Cuộc họp "${m.title}" sẽ bắt đầu lúc ${st.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} tại ${m.room?.room_name || 'Google Meet'}.`,
        createdAt: m.start_time,
        isRead: readIds.includes(id),
        targetRole: 'all',
        targetEmail: email,
        senderName: m.organizer?.full_name || 'Hệ thống',
        senderRole: 'lecturer',
        type: 'schedule'
      });
    }
  });

  return notifs;
};

export const markAllAsReadForRole = (role: UserRole | string, additionalIds: (string | number)[] = []): void => {
  const normalizedRole: UserRole = 
    role === 'admin' || role === 'ADMIN' || role === 'quản trị viên' ? 'admin' :
    role === 'lecturer' || role === 'LECTURER' || role === 'giảng viên' ? 'lecturer' : 'student';

  const all = getAllNotifications();
  const updated = all.map(n => {
    if (n.targetRole === normalizedRole || n.targetRole === 'all') {
      return { ...n, isRead: true };
    }
    return n;
  });

  setStorage('system_notifications', updated);

  if (additionalIds && additionalIds.length > 0) {
    const readIds = getStorage<string[]>('read_meeting_notif_ids', []);
    const merged = Array.from(new Set([...readIds, ...additionalIds.map(String)]));
    setStorage('read_meeting_notif_ids', merged);
  }

  window.dispatchEvent(new Event('system-notification-updated'));
};

export const markSingleAsRead = (id: string | number): void => {
  const strId = String(id);
  if (strId.startsWith('invitation_') || strId.startsWith('inprogress_') || strId.startsWith('upcoming_')) {
    const readIds = getStorage<string[]>('read_meeting_notif_ids', []);
    if (!readIds.includes(strId)) {
      setStorage('read_meeting_notif_ids', [...readIds, strId]);
    }
  } else {
    const all = getAllNotifications();
    const updated = all.map(n => n.id === id ? { ...n, isRead: true } : n);
    setStorage('system_notifications', updated);
  }
  window.dispatchEvent(new Event('system-notification-updated'));
};
