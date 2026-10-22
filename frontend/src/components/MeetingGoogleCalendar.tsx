import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  ChevronLeft, ChevronRight, Search, Plus, Calendar as CalendarIcon,
  Clock, MapPin, Users, Video, Monitor, X, Check, CheckCircle2,
  AlertCircle, Trash2, Edit3, Copy, QrCode, RefreshCw,
  ExternalLink, ChevronDown, Filter, Info, UserCheck, MessageSquare,
  Globe, Laptop, ShieldCheck, Sparkles, HelpCircle, Settings,
  CheckSquare, CalendarDays, Bookmark, Briefcase, Coffee,
  ArrowLeft, Star, MoreVertical, Printer, Download, BookOpen, Send,
  Palette, Trash, ChevronUp, Bell, Layers, ListFilter,
  Edit2, LogOut, DoorClosed, UserPlus, Building2, User, Mail, XCircle
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import api from '../services/api';
import { setStorage } from '../utils/syncHelper';

// Lấy thời gian chuẩn theo múi giờ Việt Nam (Asia/Ho_Chi_Minh - GMT+7)
export const getVietnamNow = (): Date => {
  try {
    const now = new Date();
    const vnString = now.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' });
    return new Date(vnString);
  } catch {
    return new Date();
  }
};

export interface GoogleTaskItem {
  id: string;
  title: string;
  notes?: string;
  dueDate?: string; // '2026-10-16'
  dueTime?: string;
  completed: boolean;
  starred: boolean;
  listId: string; // 'my-tasks'
  createdAt: string;
}

export interface TrashItem {
  id: string;
  title: string;
  type: 'meeting' | 'task';
  deletedAt: string;
  meta?: string;
  originalData?: any;
}

export interface UserItem {
  user_id: number;
  full_name: string;
  email: string;
  role_name?: string;
  department_name?: string;
  avatar_url?: string;
}

export interface MeetingItem {
  meeting_id: number;
  organizer_id: number;
  organizer?: {
    user_id: number;
    full_name: string;
    email: string;
    avatar_url?: string;
  };
  room_id: number;
  room?: {
    room_id: number;
    room_name: string;
    location: string;
    capacity: number;
  };
  title: string;
  description?: string;
  start_time: string;
  end_time: string;
  meeting_type: 'IN_PERSON' | 'ONLINE' | 'HYBRID' | string;
  meeting_link?: string;
  passcode?: string;
  status: string; // SCHEDULED, APPROVED, PENDING, CANCELLED, COMPLETED
  qr_token?: string;
  participants?: Array<{
    participant_id?: number;
    user_id: number;
    rsvp_status: string;
    user?: {
      user_id: number;
      full_name: string;
      email: string;
      avatar_url?: string;
    };
  }>;
  equipments?: Array<{
    equipment_id: number;
    equipment_name: string;
    equipment_serial?: string;
  }>;
}

export interface RoomItem {
  room_id: number;
  room_name: string;
  location: string;
  capacity: number;
  status: string;
  equipments?: string;
  restrictions?: any[];
}

export interface EquipmentItem {
  equipment_id: number;
  equipment_name: string;
  code?: string;
  equipment_serial?: string;
  status: string;
}

interface MeetingGoogleCalendarProps {
  userProfile?: any;
  userRole?: string;
  onNavigateToTab?: (tab: string) => void;
}

// 24 Giờ trong ngày (theo giao diện chuẩn Google Calendar: 1 AM -> 11 PM)
const HOURS = Array.from({ length: 24 }, (_, i) => i);

const formatHourLabel = (h: number): string => {
  if (h === 0) return '12 AM';
  if (h < 12) return `${h} AM`;
  if (h === 12) return '12 PM';
  return `${h - 12} PM`;
};

const formatTime = (timeStr?: string): string => {
  if (!timeStr) return '';
  const d = new Date(timeStr);
  if (isNaN(d.getTime())) return timeStr;
  const hours = d.getHours();
  const minutes = d.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const h12 = hours % 12 || 12;
  const minStr = minutes > 0 ? `:${minutes.toString().padStart(2, '0')}` : '';
  return `${h12}${minStr}${ampm}`;
};

// Màu thẻ sự kiện Google Calendar
const getEventColorStyle = (type: string, status: string) => {
  if (status === 'PENDING') {
    return {
      bg: '#fef3c7',
      border: '#f59e0b',
      text: '#92400e',
      badge: 'Chờ duyệt',
      badgeBg: '#fde68a',
      badgeColor: '#b45309'
    };
  }
  if (status === 'CANCELLED') {
    return {
      bg: '#fee2e2',
      border: '#ef4444',
      text: '#991b1b',
      badge: 'Đã hủy',
      badgeBg: '#fecaca',
      badgeColor: '#b91c1c'
    };
  }
  if (type === 'ONLINE') {
    return {
      bg: '#e0f2fe',
      border: '#0284c7',
      text: '#0369a1',
      badge: 'Google Meet',
      badgeBg: '#bae6fd',
      badgeColor: '#0284c7'
    };
  }
  if (type === 'HYBRID') {
    return {
      bg: '#f3e8ff',
      border: '#9333ea',
      text: '#6b21a8',
      badge: 'Kết hợp',
      badgeBg: '#e9d5ff',
      badgeColor: '#7e22ce'
    };
  }
  // Mặc định: Trực tiếp / In-person (Google Calendar Blue)
  return {
    bg: '#e8f0fe',
    border: '#1a73e8',
    text: '#1967d2',
    badge: 'Phòng họp',
    badgeBg: '#d2e3fc',
    badgeColor: '#174ea6'
  };
};

// ── DỮ LIỆU MẪU BAN ĐẦU CHO GOOGLE TASKS (VIỆC CẦN LÀM - SCREENSHOT 5) ──
const DEFAULT_TASKS: GoogleTaskItem[] = [
  {
    id: 'task-1',
    title: 'Chuẩn bị slide thuyết trình bảo vệ đồ án tốt nghiệp nhóm 4',
    notes: 'Tổng hợp 15 slides: kiến trúc hệ thống, Google Calendar view, phân quyền người dùng và kiểm thử',
    dueDate: '2026-10-17',
    dueTime: '09:00',
    completed: false,
    starred: true,
    listId: 'my-tasks',
    createdAt: '2026-10-15T08:00:00'
  },
  {
    id: 'task-2',
    title: 'Kiểm tra phòng họp B1-205 và thiết bị máy chiếu trước 9:00',
    notes: 'Liên hệ phòng Quản trị thiết bị để nhận chìa khóa và kiểm tra cáp HDMI / micro',
    dueDate: '2026-10-16',
    dueTime: '08:30',
    completed: false,
    starred: true,
    listId: 'my-tasks',
    createdAt: '2026-10-15T09:30:00'
  },
  {
    id: 'task-3',
    title: 'Gửi link Google Meet và tài liệu cho các thành viên nhóm',
    notes: 'Link họp: meet.google.com/ictu-grp4-demo - Kiểm tra danh sách khách mời phòng CTHSSV',
    dueDate: '2026-10-16',
    dueTime: '10:00',
    completed: false,
    starred: false,
    listId: 'my-tasks',
    createdAt: '2026-10-16T07:15:00'
  },
  {
    id: 'task-4',
    title: 'Cập nhật danh sách giảng viên & sinh viên tham gia dự án',
    notes: 'Đồng bộ dữ liệu tài khoản từ cổng thông tin đào tạo ICTU',
    dueDate: '2026-10-18',
    dueTime: '17:00',
    completed: false,
    starred: false,
    listId: 'my-tasks',
    createdAt: '2026-10-14T14:20:00'
  },
  {
    id: 'task-5',
    title: 'Điểm danh thành viên qua mã QR phiên họp sáng',
    notes: 'Đã hoàn tất điểm danh 100% người tham dự cuộc họp chuẩn bị đồ án',
    dueDate: '2026-10-16',
    dueTime: '11:30',
    completed: true,
    starred: false,
    listId: 'my-tasks',
    createdAt: '2026-10-16T10:00:00'
  }
];

// ── DỮ LIỆU MẪU BAN ĐẦU CHO THÙNG RÁC (SCREENSHOT 4 MENU CÀI ĐẶT) ──
const DEFAULT_TRASH: TrashItem[] = [
  {
    id: 'trash-1',
    title: 'Họp trù bị tuần trước (Hội trường C)',
    type: 'meeting',
    deletedAt: '15/10/2026 14:30',
    meta: 'Phòng C101 • 15 thành viên'
  },
  {
    id: 'trash-2',
    title: 'Gửi bản nháp kế hoạch cho mentor kiểm duyệt đợt 1',
    type: 'task',
    deletedAt: '14/10/2026 18:20',
    meta: 'Việc cần làm • Đã hoàn thành sớm'
  }
];

export default function MeetingGoogleCalendar({ userProfile, userRole, onNavigateToTab }: MeetingGoogleCalendarProps) {
  // ── 1. STATE QUẢN LÝ THỜI GIAN & VIEW ──
  // Đồng bộ ngày thực tế theo giờ Việt Nam
  const [currentDate, setCurrentDate] = useState<Date>(() => {
    return getVietnamNow();
  });

  const [viewMode, setViewMode] = useState<'Ngày' | 'Tuần' | 'Tháng' | '4 ngày'>('Tuần');
  const [showViewDropdown, setShowViewDropdown] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);

  // Dropdown "+ Tạo"
  const [showCreateDropdown, setShowCreateDropdown] = useState(false);
  const [createType, setCreateType] = useState<string>('Sự kiện');

  // Checkboxes trong View Switcher
  const [showWeekends, setShowWeekends] = useState(true);
  const [showDeclined, setShowDeclined] = useState(true);
  const [showCompletedTasks, setShowCompletedTasks] = useState(true);

  // ── 2. STATE DỮ LIỆU CUỘC HỌP & TÀI NGUYÊN ──
  const [meetings, setMeetings] = useState<MeetingItem[]>([]);
  const [rooms, setRooms] = useState<RoomItem[]>([]);
  const [equipments, setEquipments] = useState<EquipmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRoomFilter, setSelectedRoomFilter] = useState<string>('ALL');
  const [filterMyMeetingsOnly, setFilterMyMeetingsOnly] = useState<boolean>(false);
  const [filterPendingOnly, setFilterPendingOnly] = useState<boolean>(false);

  // ── 3. STATE CHO TÌM KIẾM NGƯỜI DÙNG ("Gặp gỡ với...") ──
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [userSearchResults, setUserSearchResults] = useState<UserItem[]>([]);
  const [showUserSearchDropdown, setShowUserSearchDropdown] = useState(false);
  const [selectedUserFilter, setSelectedUserFilter] = useState<UserItem | null>(null);

  // ── 4. STATE MODAL CHI TIẾT & ĐẶT LỊCH ──
  const [selectedMeeting, setSelectedMeeting] = useState<MeetingItem | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  // ── 5. FORM ĐẶT LỊCH HỌP MỚI (GOOGLE STYLE QUICK CREATE) ──
  const [formTitle, setFormTitle] = useState('');
  const [formDate, setFormDate] = useState('2026-10-16');
  const [formStartTime, setFormStartTime] = useState('10:00');
  const [formEndTime, setFormEndTime] = useState('11:30');
  const [formRoomId, setFormRoomId] = useState<number | ''>('');
  const [formMeetingType, setFormMeetingType] = useState<'IN_PERSON' | 'ONLINE' | 'HYBRID'>('ONLINE');
  const [formMeetingLink, setFormMeetingLink] = useState('https://meet.google.com/ictu-grp4-demo');
  const [formDescription, setFormDescription] = useState('');
  const [formSelectedParticipants, setFormSelectedParticipants] = useState<UserItem[]>([]);
  const [formSelectedEquipments, setFormSelectedEquipments] = useState<number[]>([]);
  const [formParticipantSearch, setFormParticipantSearch] = useState('');
  const [formParticipantResults, setFormParticipantResults] = useState<UserItem[]>([]);
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [editingMeetingId, setEditingMeetingId] = useState<number | null>(null);

  // ── THÊM STATE CHO 6 TÍNH NĂNG ĐỢT 1 (STT 1 - STT 6) ──
  // STT 3: Đặt lịch họp định kỳ (tuần / tháng)
  const [formRecurrence, setFormRecurrence] = useState<'NONE' | 'WEEKLY' | 'MONTHLY'>('NONE');
  const [formRecurrenceCount, setFormRecurrenceCount] = useState<number>(4);

  // STT 5: Gợi ý thời gian họp khi mọi người đều rảnh
  const [suggestingTime, setSuggestingTime] = useState<boolean>(false);
  const [suggestedSlots, setSuggestedSlots] = useState<Array<{
    start_time: string;
    end_time: string;
    slot_start: string;
    slot_end: string;
    is_optimal: boolean;
    free_count: number;
    total_count: number;
    status: string;
    room_available: boolean;
  }>>([]);
  const [showTimeSuggestions, setShowTimeSuggestions] = useState<boolean>(false);
  const [suggestTimeError, setSuggestTimeError] = useState<string | null>(null);

  // STT 6: Xem lại lịch sử các cuộc họp đã tham gia
  const [showHistoryModal, setShowHistoryModal] = useState<boolean>(false);
  const [historyMeetings, setHistoryMeetings] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);
  const [historySearchTerm, setHistorySearchTerm] = useState<string>('');

  // ── THÊM STATE CHO ĐỢT 3 (STT 15, 16, 17) ──
  // STT 16: Thông báo nhắc nhở trước khi họp
  const [showNotificationsModal, setShowNotificationsModal] = useState<boolean>(false);
  const [showUpcomingBanner, setShowUpcomingBanner] = useState<boolean>(true);
  const [formReminderMinutes, setFormReminderMinutes] = useState<number>(15);

  // STT 17: Kiểm tra kích thước thiết bị di động (Responsive Mobile)
  const [isMobile, setIsMobile] = useState<boolean>(() => typeof window !== 'undefined' ? window.innerWidth < 768 : false);

  // ── THÊM STATE CHO ĐỢT 5 (STT 26, STT 27) ──
  // STT 26: Gợi ý phòng họp tối ưu theo số lượng người
  const [showRoomSuggestions, setShowRoomSuggestions] = useState<boolean>(false);
  const [suggestedRooms, setSuggestedRooms] = useState<any[]>([]);
  const [loadingRoomSuggestions, setLoadingRoomSuggestions] = useState<boolean>(false);

  // STT 27: Điểm danh và Trả phòng qua QR Code
  const [attendanceData, setAttendanceData] = useState<any>(null);
  const [loadingAttendance, setLoadingAttendance] = useState<boolean>(false);
  const [qrActionLoading, setQrActionLoading] = useState<boolean>(false);
  const [qrFeedback, setQrFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) setShowSidebar(false);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const [clockTick, setClockTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setClockTick(t => t + 1), 20000);
    return () => clearInterval(timer);
  }, []);

  // STT 16: Quét danh sách các cuộc họp đang diễn ra hoặc sắp diễn ra trong 120 phút tới
  const upcomingMeetings = useMemo(() => {
    const now = getVietnamNow();
    return meetings.filter(m => {
      if (m.status === 'CANCELLED' || m.status === 'REJECTED' || m.status === 'COMPLETED') return false;
      const st = new Date(m.start_time);
      const et = new Date(m.end_time);
      // Đang diễn ra (từ lúc bắt đầu đến lúc kết thúc)
      const isInProgress = now >= st && now <= et;
      // Sắp bắt đầu trong 120 phút tới
      const diffMinutes = Math.round((st.getTime() - now.getTime()) / (1000 * 60));
      const isUpcoming = diffMinutes > 0 && diffMinutes <= 120;
      return isInProgress || isUpcoming;
    }).sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
  }, [meetings, clockTick]);

  // Role detection
  const normalizedRole = (userRole || userProfile?.role?.role_name || userProfile?.role || '').toLowerCase();
  const isAdmin = normalizedRole === 'admin' || normalizedRole.includes('quản trị');

  // Refs
  const viewDropdownRef = useRef<HTMLDivElement>(null);
  const createDropdownRef = useRef<HTMLDivElement>(null);
  const userSearchRef = useRef<HTMLDivElement>(null);
  const helpDropdownRef = useRef<HTMLDivElement>(null);
  const settingsDropdownRef = useRef<HTMLDivElement>(null);
  const profileDropdownRef = useRef<HTMLDivElement>(null);
  const appsDropdownRef = useRef<HTMLDivElement>(null);

  // ── 7. STATE GOOGLE ACCOUNT POPOVER & APPS LAUNCHER (SCREENSHOT 2) ──
  const [showProfileDropdown, setShowProfileDropdown] = useState<boolean>(false);
  const [showAppsDropdown, setShowAppsDropdown] = useState<boolean>(false);
  const [showAccountManagerModal, setShowAccountManagerModal] = useState<boolean>(false);
  const [showAddAccountModal, setShowAddAccountModal] = useState<boolean>(false);
  const [isProfileAccountsExpanded, setIsProfileAccountsExpanded] = useState<boolean>(true);

  // Active Profile Data derived from current session and database
  const [activeAccount, setActiveAccount] = useState(() => {
    let storedUser: any = null;
    try {
      const saved = localStorage.getItem('user') || localStorage.getItem('currentUser') || sessionStorage.getItem('user');
      if (saved) storedUser = JSON.parse(saved);
    } catch (e) { }

    const email = storedUser?.email || userProfile?.email || 'hoangphuong@ictu.edu.vn';
    const isCurrentUserAdmin = email.includes('admin') || (storedUser?.role || userProfile?.role || '').toLowerCase().includes('admin');

    if (isCurrentUserAdmin) {
      return {
        fullName: storedUser?.fullName || userProfile?.fullName || 'Hoàng Phương',
        displayName: 'Hoàng Phương',
        email: 'admin@ictu.edu.vn',
        avatar: storedUser?.avatar || '/phuong_account_avatar.png',
        studentId: 'ICTU-ADMIN',
        department: 'Phòng Quản trị Thiết bị & CNTT',
        phone: storedUser?.phone || '0912 345 678',
        role: 'Quản trị viên'
      };
    }

    return {
      fullName: storedUser?.fullName || userProfile?.fullName || 'Hoàng Thanh Phương',
      displayName: 'Hoàng Thanh Phương',
      email: email,
      avatar: storedUser?.avatar || userProfile?.avatar || '/hoang_phuong_avatar.png',
      studentId: 'DTC245180008',
      department: 'Khoa Công nghệ thông tin - ICTU',
      phone: storedUser?.phone || '0987 654 321',
      role: 'Người dùng'
    };
  });

  const [switchingAccount, setSwitchingAccount] = useState<boolean>(false);

  // Thông tin user hiện tại đang đăng nhập
  const currentUserId = userProfile?.id || userProfile?.user_id || (activeAccount as any)?.id || (() => {
    try {
      const u = localStorage.getItem('user') || localStorage.getItem('currentUser') || sessionStorage.getItem('user');
      return u ? (JSON.parse(u).id || JSON.parse(u).user_id) : null;
    } catch { return null; }
  })();

  const currentUserEmail = (
    userProfile?.email ||
    activeAccount?.email ||
    (() => {
      try {
        const u = localStorage.getItem('user') || localStorage.getItem('currentUser') || sessionStorage.getItem('user');
        return u ? JSON.parse(u).email : '';
      } catch { return ''; }
    })()
  ).toLowerCase();

  // Quét danh sách các cuộc họp mà user được mời và đang chờ phản hồi (RSVP PENDING)
  const pendingInvitations = useMemo(() => {
    return meetings.filter(m => {
      if (m.status === 'CANCELLED' || m.status === 'REJECTED') return false;
      return m.participants?.some(p => {
        const isMe = (currentUserId && (p.user_id === currentUserId || p.user?.user_id === currentUserId)) ||
          (currentUserEmail && p.user?.email && p.user.email.toLowerCase() === currentUserEmail);
        return isMe && p.rsvp_status === 'PENDING';
      });
    }).sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
  }, [meetings, currentUserId, currentUserEmail, clockTick]);

  // Edit Profile Form State
  const [editFullName, setEditFullName] = useState(activeAccount.fullName);
  const [editPhone, setEditPhone] = useState(activeAccount.phone);
  const [editDepartment, setEditDepartment] = useState(activeAccount.department);
  const [editStudentId, setEditStudentId] = useState(activeAccount.studentId);
  const [editAvatar, setEditAvatar] = useState(activeAccount.avatar);
  const [profileSuccessMsg, setProfileSuccessMsg] = useState('');

  // ── 6. STATE GOOGLE TASKS, TÌM KIẾM TOÀN CẢNH, HỖ TRỢ, CÀI ĐẶT & THÙNG RÁC ──
  const [activeAppMode, setActiveAppMode] = useState<'calendar' | 'tasks'>('calendar');
  const [isSearchExpanded, setIsSearchExpanded] = useState<boolean>(false);
  const [searchGlobalQuery, setSearchGlobalQuery] = useState<string>('');
  const [showHelpDropdown, setShowHelpDropdown] = useState<boolean>(false);
  const [showSettingsDropdown, setShowSettingsDropdown] = useState<boolean>(false);

  // Modals
  const [showHelpModal, setShowHelpModal] = useState<boolean>(false);
  const [showTrainingModal, setShowTrainingModal] = useState<boolean>(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState<boolean>(false);
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  const [showTrashModal, setShowTrashModal] = useState<boolean>(false);
  const [showAppearanceModal, setShowAppearanceModal] = useState<boolean>(false);
  const [showAddonsModal, setShowAddonsModal] = useState<boolean>(false);

  // Cài đặt
  const [settingTimezone, setSettingTimezone] = useState('GMT+07:00 (Hà Nội, Băng Cốc)');
  const [settingDefaultDuration, setSettingDefaultDuration] = useState('30');
  const [settingDefaultReminder, setSettingDefaultReminder] = useState('10');
  const [settingAutoMeet, setSettingAutoMeet] = useState(true);
  const [settingDensity, setSettingDensity] = useState<'comfortable' | 'compact'>('comfortable');

  // Góp ý phản hồi
  const [feedbackCategory, setFeedbackCategory] = useState('Góp ý tính năng');
  const [feedbackContent, setFeedbackContent] = useState('');
  const [feedbackSuccess, setFeedbackSuccess] = useState(false);

  // Tasks Management
  const [tasks, setTasks] = useState<GoogleTaskItem[]>(() => {
    const saved = localStorage.getItem('meetinghub_google_tasks');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) { }
    }
    return DEFAULT_TASKS;
  });

  const [trashItems, setTrashItems] = useState<TrashItem[]>(() => {
    const saved = localStorage.getItem('meetinghub_trash_items');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) { }
    }
    return DEFAULT_TRASH;
  });

  const [taskFilter, setTaskFilter] = useState<'all' | 'starred' | 'my-tasks'>('my-tasks');
  const [isAddingTask, setIsAddingTask] = useState<boolean>(false);
  const [newTaskTitle, setNewTaskTitle] = useState<string>('');
  const [newTaskNotes, setNewTaskNotes] = useState<string>('');
  const [newTaskDueDate, setNewTaskDueDate] = useState<string>('2026-10-16');
  const [showCompletedTasksSection, setShowCompletedTasksSection] = useState<boolean>(true);

  // Lưu tasks và trash vào localStorage
  useEffect(() => {
    localStorage.setItem('meetinghub_google_tasks', JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    localStorage.setItem('meetinghub_trash_items', JSON.stringify(trashItems));
  }, [trashItems]);

  // Tasks handlers
  const handleToggleTaskComplete = (taskId: string) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, completed: !t.completed } : t));
  };

  const handleToggleTaskStar = (taskId: string) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, starred: !t.starred } : t));
  };

  const handleDeleteTask = (taskId: string) => {
    const target = tasks.find(t => t.id === taskId);
    if (target) {
      setTrashItems(prev => [
        {
          id: 'trash_' + Date.now(),
          title: target.title,
          type: 'task',
          deletedAt: new Date().toLocaleString('vi-VN'),
          meta: 'Việc cần làm • ' + (target.dueDate ? `Hạn: ${target.dueDate}` : 'Không có hạn'),
          originalData: target
        },
        ...prev
      ]);
      setTasks(prev => prev.filter(t => t.id !== taskId));
    }
  };

  const handleAddNewTask = () => {
    if (!newTaskTitle.trim()) return;
    const item: GoogleTaskItem = {
      id: 'task_' + Date.now(),
      title: newTaskTitle.trim(),
      notes: newTaskNotes.trim() || undefined,
      dueDate: newTaskDueDate || undefined,
      completed: false,
      starred: taskFilter === 'starred',
      listId: 'my-tasks',
      createdAt: new Date().toISOString()
    };
    setTasks(prev => [item, ...prev]);
    setNewTaskTitle('');
    setNewTaskNotes('');
    setIsAddingTask(false);
  };

  // Trash handlers
  const handleRestoreTrash = (trashId: string) => {
    const item = trashItems.find(t => t.id === trashId);
    if (!item) return;
    if (item.type === 'task' && item.originalData) {
      setTasks(prev => [item.originalData, ...prev]);
    } else if (item.type === 'meeting' && item.originalData) {
      setMeetings(prev => [item.originalData, ...prev]);
    }
    setTrashItems(prev => prev.filter(t => t.id !== trashId));
  };

  const handlePermanentDeleteTrash = (trashId: string) => {
    setTrashItems(prev => prev.filter(t => t.id !== trashId));
  };

  const handleEmptyTrash = () => {
    setTrashItems([]);
  };

  // Danh sách người dùng gợi ý mặc định (khớp chính xác ảnh Screenshot 3)
  const defaultSuggestedUsers: UserItem[] = [
    { user_id: 101, full_name: 'NGUYEN MINH QUAN', email: 'dtc245180080@ictu.edu.vn' },
    { user_id: 102, full_name: 'P. CTHSSV - Vũ Thị Thu Thủy', email: 'vttthuy@ictu.edu.vn' },
    { user_id: 103, full_name: 'Phòng CTHSSV - Hoàng Như Yến', email: 'hnyen@ictu.edu.vn' },
    { user_id: 104, full_name: 'Vũ Văn Diện Mạng và An Ninh', email: 'vvdien@ictu.edu.vn' },
    { user_id: 2, full_name: 'Hoàng Thanh Phương', email: 'hoangphuong@ictu.edu.vn' },
    { user_id: 4, full_name: 'Trần Linh', email: 'tranlinh@ictu.edu.vn' }
  ];

  // ── 7. LẮNG NGHE CLICK RA NGOÀI ĐỂ ĐÓNG DROPDOWNS ──
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (viewDropdownRef.current && !viewDropdownRef.current.contains(e.target as Node)) {
        setShowViewDropdown(false);
      }
      if (createDropdownRef.current && !createDropdownRef.current.contains(e.target as Node)) {
        setShowCreateDropdown(false);
      }
      if (userSearchRef.current && !userSearchRef.current.contains(e.target as Node)) {
        setShowUserSearchDropdown(false);
      }
      if (helpDropdownRef.current && !helpDropdownRef.current.contains(e.target as Node)) {
        setShowHelpDropdown(false);
      }
      if (settingsDropdownRef.current && !settingsDropdownRef.current.contains(e.target as Node)) {
        setShowSettingsDropdown(false);
      }
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(e.target as Node)) {
        setShowProfileDropdown(false);
      }
      if (appsDropdownRef.current && !appsDropdownRef.current.contains(e.target as Node)) {
        setShowAppsDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ── KEYBOARD SHORTCUTS (D: Ngày, W: Tuần, M: Tháng) ──
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) {
        return;
      }
      if (e.key === 'd' || e.key === 'D') setViewMode('Ngày');
      if (e.key === 'w' || e.key === 'W') setViewMode('Tuần');
      if (e.key === 'm' || e.key === 'M') setViewMode('Tháng');
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // ── 7. LOAD CUỘC HỌP, PHÒNG, THIẾT BỊ TỪ API ──
  const loadCalendarData = async () => {
    setLoading(true);
    try {
      const [meetingsRes, roomsRes, eqRes] = await Promise.allSettled([
        api.get('/meetings'),
        api.get('/rooms'),
        api.get('/equipments')
      ]);

      if (meetingsRes.status === 'fulfilled' && Array.isArray(meetingsRes.value.data)) {
        setMeetings(meetingsRes.value.data);
      }
      if (roomsRes.status === 'fulfilled' && Array.isArray(roomsRes.value.data)) {
        setRooms(roomsRes.value.data);
      }
      if (eqRes.status === 'fulfilled' && Array.isArray(eqRes.value.data)) {
        setEquipments(eqRes.value.data);
      }
    } catch (e) {
      console.error('Lỗi khi tải dữ liệu lịch họp:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCalendarData();
    window.addEventListener('storage', loadCalendarData);
    window.addEventListener('meeting-updated', loadCalendarData);
    window.addEventListener('appDataSync', loadCalendarData);
    return () => {
      window.removeEventListener('storage', loadCalendarData);
      window.removeEventListener('meeting-updated', loadCalendarData);
      window.removeEventListener('appDataSync', loadCalendarData);
    };
  }, []);

  // ── LẮNG NGHE YÊU CẦU ĐẶT PHÒNG TỪ DANH MỤC PHÒNG (US #7, #8) ──
  useEffect(() => {
    const prefill = localStorage.getItem('meetinghub_prefill_room_id');
    if (prefill && rooms.length > 0) {
      localStorage.removeItem('meetinghub_prefill_room_id');
      const rId = Number(prefill);
      if (rId && rooms.some(r => r.room_id === rId)) {
        handleOpenCreateModal();
        setFormRoomId(rId);
      }
    }
  }, [rooms]);

  // ── 8. TÌM KIẾM NGƯỜI DÙNG CHO SIDEBAR ("Gặp gỡ với...") ──
  useEffect(() => {
    if (!userSearchTerm.trim()) {
      setUserSearchResults(defaultSuggestedUsers);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await api.get(`/meetings/search-users?q=${encodeURIComponent(userSearchTerm)}`);
        if (Array.isArray(res.data) && res.data.length > 0) {
          setUserSearchResults(res.data);
        } else {
          // Fallback lọc danh sách gợi ý
          const term = userSearchTerm.toLowerCase();
          setUserSearchResults(defaultSuggestedUsers.filter(u =>
            u.full_name.toLowerCase().includes(term) || u.email.toLowerCase().includes(term)
          ));
        }
      } catch (err) {
        const term = userSearchTerm.toLowerCase();
        setUserSearchResults(defaultSuggestedUsers.filter(u =>
          u.full_name.toLowerCase().includes(term) || u.email.toLowerCase().includes(term)
        ));
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [userSearchTerm]);

  // ── 9. TÌM KIẾM NGƯỜI THAM GIA TRONG FORM ĐẶT LỊCH ──
  useEffect(() => {
    if (!formParticipantSearch.trim()) {
      setFormParticipantResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await api.get(`/meetings/search-users?q=${encodeURIComponent(formParticipantSearch)}`);
        if (Array.isArray(res.data)) {
          const selectedIds = new Set(formSelectedParticipants.map(u => u.user_id));
          setFormParticipantResults(res.data.filter((u: any) => !selectedIds.has(u.user_id)));
        }
      } catch (err) {
        const term = formParticipantSearch.toLowerCase();
        const selectedIds = new Set(formSelectedParticipants.map(u => u.user_id));
        setFormParticipantResults(defaultSuggestedUsers.filter(u =>
          !selectedIds.has(u.user_id) && (u.full_name.toLowerCase().includes(term) || u.email.toLowerCase().includes(term))
        ));
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [formParticipantSearch, formSelectedParticipants]);

  // ── 10. TÍNH TOÁN NGÀY TRONG TUẦN HIỆN TẠI (CN -> THỨ 7 như Google Calendar) ──
  const getStartOfWeek = (d: Date) => {
    const date = new Date(d);
    const day = date.getDay(); // 0 is Sunday
    date.setDate(date.getDate() - day);
    date.setHours(0, 0, 0, 0);
    return date;
  };

  const startOfWeek = getStartOfWeek(currentDate);

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(startOfWeek);
    d.setDate(d.getDate() + i);
    return d;
  });

  const dayNamesVN = ['CN', 'THỨ 2', 'THỨ 3', 'THỨ 4', 'THỨ 5', 'THỨ 6', 'THỨ 7'];

  // Kiểm tra ngày hôm nay theo giờ Việt Nam (GMT+7)
  const isDateToday = (d: Date) => {
    const today = getVietnamNow();
    return (
      d.getDate() === today.getDate() &&
      d.getMonth() === today.getMonth() &&
      d.getFullYear() === today.getFullYear()
    );
  };

  // Điều hướng thời gian
  const handlePrev = () => {
    const d = new Date(currentDate);
    if (viewMode === 'Tuần') {
      d.setDate(d.getDate() - 7);
    } else if (viewMode === 'Ngày') {
      d.setDate(d.getDate() - 1);
    } else if (viewMode === '4 ngày') {
      d.setDate(d.getDate() - 4);
    } else {
      d.setMonth(d.getMonth() - 1);
    }
    setCurrentDate(d);
  };

  const handleNext = () => {
    const d = new Date(currentDate);
    if (viewMode === 'Tuần') {
      d.setDate(d.getDate() + 7);
    } else if (viewMode === 'Ngày') {
      d.setDate(d.getDate() + 1);
    } else if (viewMode === '4 ngày') {
      d.setDate(d.getDate() + 4);
    } else {
      d.setMonth(d.getMonth() + 1);
    }
    setCurrentDate(d);
  };

  const handleToday = () => {
    setCurrentDate(getVietnamNow());
  };

  // Tiêu đề tháng hiển thị trên thanh công cụ (Screenshot 1 & Screenshot 5)
  const getHeaderTitle = () => {
    const d = currentDate.getDate();
    const m = currentDate.getMonth() + 1;
    const y = currentDate.getFullYear();
    if (viewMode === 'Ngày') {
      return `${d} tháng ${m}, ${y}`;
    }
    return `Tháng ${m}, ${y}`;
  };

  // ── 11. BỘ LỌC CUỘC HỌP ──
  const filteredMeetings = meetings.filter(m => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = m.title.toLowerCase().includes(q);
      const matchRoom = (m.room?.room_name || '').toLowerCase().includes(q);
      const matchOrg = (m.organizer?.full_name || '').toLowerCase().includes(q);
      if (!matchTitle && !matchRoom && !matchOrg) return false;
    }
    if (selectedRoomFilter !== 'ALL') {
      if (m.room_id !== Number(selectedRoomFilter)) return false;
    }
    if (filterMyMeetingsOnly && userProfile?.id) {
      const isOrg = m.organizer_id === userProfile.id;
      const isPart = m.participants?.some(p => p.user_id === userProfile.id);
      if (!isOrg && !isPart) return false;
    }
    if (filterPendingOnly && m.status !== 'PENDING') {
      return false;
    }
    if (selectedUserFilter) {
      const isOrg = m.organizer_id === selectedUserFilter.user_id || m.organizer?.email === selectedUserFilter.email;
      const isPart = m.participants?.some(p => p.user_id === selectedUserFilter.user_id || p.user?.email === selectedUserFilter.email);
      if (!isOrg && !isPart) return false;
    }
    return true;
  });

  // Lấy cuộc họp theo ngày
  const getMeetingsForDate = (date: Date) => {
    const y = date.getFullYear();
    const m = date.getMonth();
    const d = date.getDate();

    return filteredMeetings.filter(item => {
      if (!item.start_time) return false;
      const st = new Date(item.start_time);
      return st.getFullYear() === y && st.getMonth() === m && st.getDate() === d;
    });
  };

  // Thống kê thời gian trong tuần
  const weekMeetings = weekDays.flatMap(d => getMeetingsForDate(d));
  const totalMeetingHours = weekMeetings.reduce((acc, m) => {
    const st = new Date(m.start_time).getTime();
    const et = new Date(m.end_time).getTime();
    const hours = Math.max(0, (et - st) / (1000 * 60 * 60));
    return acc + hours;
  }, 0);

  // ── 12. MỞ MODAL TẠO CUỘC HỌP VỚI THÔNG TIN PREFILL ──
  const handleOpenCreateModal = (prefillDate?: Date, prefillHour?: number) => {
    setEditingMeetingId(null);
    const targetDate = prefillDate || currentDate;
    const yyyy = targetDate.getFullYear();
    const mm = String(targetDate.getMonth() + 1).padStart(2, '0');
    const dd = String(targetDate.getDate()).padStart(2, '0');
    setFormDate(`${yyyy}-${mm}-${dd}`);

    const h = prefillHour !== undefined ? prefillHour : 10;
    const startStr = `${String(h).padStart(2, '0')}:00`;
    const endStr = `${String(Math.min(23, h + 1)).padStart(2, '0')}:30`;
    setFormStartTime(startStr);
    setFormEndTime(endStr);

    setFormTitle('');
    setFormMeetingType('ONLINE');
    setFormMeetingLink('https://meet.google.com/ictu-grp4-demo');
    setFormDescription('');
    setFormSelectedParticipants([]);
    setFormSelectedEquipments([]);
    setFormRoomId(rooms.length > 0 ? rooms[0].room_id : 1);
    setFormRecurrence('NONE');
    setFormRecurrenceCount(4);
    setShowTimeSuggestions(false);
    setSuggestedSlots([]);
    setSuggestTimeError(null);
    setCreateError(null);
    setShowMoreOptions(false);
    setShowCreateModal(true);
    setShowCreateDropdown(false);
  };

  // Mở modal chỉnh sửa (US #2)
  const handleOpenEditModal = (meeting: MeetingItem) => {
    setEditingMeetingId(meeting.meeting_id);
    const st = new Date(meeting.start_time);
    const et = new Date(meeting.end_time);

    const yyyy = st.getFullYear();
    const mm = String(st.getMonth() + 1).padStart(2, '0');
    const dd = String(st.getDate()).padStart(2, '0');
    setFormDate(`${yyyy}-${mm}-${dd}`);

    const startH = String(st.getHours()).padStart(2, '0');
    const startM = String(st.getMinutes()).padStart(2, '0');
    const endH = String(et.getHours()).padStart(2, '0');
    const endM = String(et.getMinutes()).padStart(2, '0');
    setFormStartTime(`${startH}:${startM}`);
    setFormEndTime(`${endH}:${endM}`);

    setFormTitle(meeting.title || '');
    setFormMeetingType((meeting.meeting_type as any) || 'IN_PERSON');
    setFormMeetingLink(meeting.meeting_link || '');
    setFormDescription(meeting.description || '');
    setFormRoomId(meeting.room_id || (rooms.length > 0 ? rooms[0].room_id : 1));
    setFormRecurrence('NONE');
    setFormRecurrenceCount(1);
    setShowTimeSuggestions(false);

    const eqIds = meeting.equipments ? meeting.equipments.map(e => e.equipment_id) : [];
    setFormSelectedEquipments(eqIds);

    const parts: UserItem[] = (meeting.participants || []).map(p => ({
      user_id: p.user_id,
      full_name: p.user?.full_name || '',
      email: p.user?.email || '',
      avatar_url: p.user?.avatar_url
    }));
    setFormSelectedParticipants(parts);

    setCreateError(null);
    setShowDetailModal(false);
    setShowCreateModal(true);
  };

  // ── GỢI Ý THỜI GIAN HỌP KHI MỌI NGƯỜI ĐỀU RẢNH (US #5) ──
  const handleFetchTimeSuggestions = async () => {
    if (!formDate) return;
    setSuggestingTime(true);
    setSuggestTimeError(null);
    setShowTimeSuggestions(true);
    try {
      const pIds = formSelectedParticipants.map(u => u.user_id).join(',');
      const params: any = { date: formDate };
      if (pIds) params.participant_ids = pIds;
      if (formRoomId) params.room_id = formRoomId;

      const res = await api.get('/meetings/suggest-time', { params });
      if (Array.isArray(res.data)) {
        setSuggestedSlots(res.data);
      }
    } catch (err: any) {
      console.error('Lỗi lấy gợi ý thời gian:', err);
      setSuggestTimeError(err.response?.data?.detail || 'Không thể lấy gợi ý thời gian rảnh');
    } finally {
      setSuggestingTime(false);
    }
  };

  const handleApplyTimeSlot = (sTime: string, eTime: string) => {
    setFormStartTime(sTime);
    setFormEndTime(eTime);
    setShowTimeSuggestions(false);
  };

  // ── GỢI Ý PHÒNG HỌP TỐI ƯU THEO SỨC CHỨA & THIẾT BỊ (US #26) ──
  const handleFetchRoomSuggestions = async () => {
    const attendees = formSelectedParticipants.length + 1;
    setLoadingRoomSuggestions(true);
    setShowRoomSuggestions(true);
    try {
      const st = `${formDate}T${formStartTime}:00`;
      const et = `${formDate}T${formEndTime}:00`;
      const res = await api.get(`/rooms/suggest?attendees=${attendees}&start_time=${st}&end_time=${et}`);
      setSuggestedRooms(res.data || []);
    } catch (e: any) {
      console.error("Lỗi lấy gợi ý phòng:", e);
    } finally {
      setLoadingRoomSuggestions(false);
    }
  };

  // ── ĐIỂM DANH & CHECK-OUT TRẢ PHÒNG BẰNG QR CODE (US #27) ──
  const fetchMeetingAttendance = async (meetingId: number) => {
    try {
      setLoadingAttendance(true);
      const res = await api.get(`/meetings/${meetingId}/attendance`);
      setAttendanceData(res.data);
    } catch (e) {
      console.error("Lỗi lấy dữ liệu điểm danh:", e);
    } finally {
      setLoadingAttendance(false);
    }
  };

  const handleQrCheckin = async (meetingId: number) => {
    setQrActionLoading(true);
    setQrFeedback(null);
    try {
      const res = await api.post(`/meetings/${meetingId}/checkin`);
      setQrFeedback({ type: 'success', text: res.data.message || 'Check-in thành công!' });
      await fetchMeetingAttendance(meetingId);
      loadCalendarData();
    } catch (e: any) {
      const err = e.response?.data?.detail || 'Lỗi khi check-in';
      setQrFeedback({ type: 'error', text: err });
    } finally {
      setQrActionLoading(false);
    }
  };

  const handleQrCheckout = async (meetingId: number) => {
    setQrActionLoading(true);
    setQrFeedback(null);
    try {
      const res = await api.post(`/meetings/${meetingId}/checkout`);
      setQrFeedback({ type: 'success', text: res.data.message || 'Check-out trả phòng thành công!' });
      await fetchMeetingAttendance(meetingId);
      loadCalendarData();
    } catch (e: any) {
      const err = e.response?.data?.detail || 'Lỗi khi check-out';
      setQrFeedback({ type: 'error', text: err });
    } finally {
      setQrActionLoading(false);
    }
  };

  useEffect(() => {
    if (showQrModal && selectedMeeting) {
      setQrFeedback(null);
      fetchMeetingAttendance(selectedMeeting.meeting_id);
    }
  }, [showQrModal, selectedMeeting]);

  // ── XEM LẠI LỊCH SỬ CÁC CUỘC HỌP ĐÃ THAM GIA (US #6) ──
  const handleOpenHistoryModal = async () => {
    setShowHistoryModal(true);
    setLoadingHistory(true);
    try {
      const res = await api.get('/meetings/history');
      if (Array.isArray(res.data)) {
        setHistoryMeetings(res.data);
      }
    } catch (err) {
      console.error('Lỗi tải lịch sử cuộc họp:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  // ── 12.1. ĐỒNG BỘ LỊCH: XUẤT FILE .ICS & GOOGLE CALENDAR (US #15) ──
  const formatIcsDate = (dStr: string | Date): string => {
    const d = new Date(dStr);
    return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  };

  const handleExportSingleIcs = (meeting: MeetingItem) => {
    const start = formatIcsDate(meeting.start_time);
    const end = formatIcsDate(meeting.end_time);
    const now = formatIcsDate(new Date());
    const location = meeting.room?.room_name || (meeting.room_id ? `Phòng #${meeting.room_id}` : 'Trực tuyến Google Meet');
    const summary = (meeting.title || 'Cuộc họp').replace(/[\r\n]+/g, ' ');
    const desc = `${meeting.description || ''}\nLink họp: ${meeting.meeting_link || 'https://meet.google.com'}`.replace(/[\r\n]+/g, '\\n');

    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//MeetingHub ICTU//Meeting Schedule//VI',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:meeting-${meeting.meeting_id}-${Date.now()}@ictu.edu.vn`,
      `DTSTAMP:${now}`,
      `DTSTART:${start}`,
      `DTEND:${end}`,
      `SUMMARY:${summary}`,
      `DESCRIPTION:${desc}`,
      `LOCATION:${location}`,
      'STATUS:CONFIRMED',
      'BEGIN:VALARM',
      'TRIGGER:-PT15M',
      'ACTION:DISPLAY',
      `DESCRIPTION:Nhắc nhở cuộc họp: ${summary}`,
      'END:VALARM',
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n');

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const safeTitle = meeting.title.replace(/[^a-zA-Z0-9_\-\u00C0-\u024F\u1E00-\u1EFF]/g, '_').slice(0, 40);
    link.setAttribute('download', `${safeTitle || 'LichHop'}.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleOpenGoogleCalendarWeb = (meeting: MeetingItem) => {
    const start = formatIcsDate(meeting.start_time);
    const end = formatIcsDate(meeting.end_time);
    const location = meeting.room?.room_name || (meeting.room_id ? `Phòng #${meeting.room_id}` : 'Trực tuyến Google Meet');
    const details = `${meeting.description || ''}\n\nCuộc họp trên hệ thống MeetingHub ICTU.\nLink họp: ${meeting.meeting_link || 'https://meet.google.com'}`;
    const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(meeting.title)}&dates=${start}/${end}&details=${encodeURIComponent(details)}&location=${encodeURIComponent(location)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleExportAllMeetingsIcs = () => {
    const active = meetings.filter(m => m.status !== 'CANCELLED');
    if (active.length === 0) {
      alert('Chưa có cuộc họp nào trong lịch để xuất file!');
      return;
    }
    const now = formatIcsDate(new Date());
    const eventBlocks = active.map(m => {
      const start = formatIcsDate(m.start_time);
      const end = formatIcsDate(m.end_time);
      const loc = m.room?.room_name || `Phòng #${m.room_id || 'Chung'}`;
      const sum = (m.title || 'Cuộc họp').replace(/[\r\n]+/g, ' ');
      const desc = `${m.description || ''}\nLink: ${m.meeting_link || 'https://meet.google.com'}`.replace(/[\r\n]+/g, '\\n');
      return [
        'BEGIN:VEVENT',
        `UID:meeting-${m.meeting_id}@ictu.edu.vn`,
        `DTSTAMP:${now}`,
        `DTSTART:${start}`,
        `DTEND:${end}`,
        `SUMMARY:${sum}`,
        `DESCRIPTION:${desc}`,
        `LOCATION:${loc}`,
        'STATUS:CONFIRMED',
        'END:VEVENT'
      ].join('\r\n');
    }).join('\r\n');

    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//MeetingHub ICTU//All Calendar//VI',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      eventBlocks,
      'END:VCALENDAR'
    ].join('\r\n');

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `MeetingHub_ToanBoLichHop_${new Date().toISOString().slice(0, 10)}.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };


  // ── 13. SUBMIT TẠO / SỬA CUỘC HỌP (US #1 & US #3) ──
  const handleCreateMeetingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      setCreateError('Vui lòng nhập tiêu đề cuộc họp!');
      return;
    }
    if (!formDate) {
      setCreateError('Vui lòng chọn ngày họp!');
      return;
    }

    setSubmitting(true);
    setCreateError(null);

    const startIso = `${formDate}T${formStartTime}:00`;
    const endIso = `${formDate}T${formEndTime}:00`;

    if (editingMeetingId) {
      const updatePayload = {
        room_id: Number(formRoomId) || (rooms[0]?.room_id || 1),
        title: formTitle.trim(),
        description: formDescription.trim(),
        start_time: startIso,
        end_time: endIso,
        meeting_type: formMeetingType,
        meeting_link: formMeetingType !== 'IN_PERSON' ? (formMeetingLink || `https://meet.google.com/ictu-grp4-${Date.now().toString().slice(-4)}`) : undefined,
        equipment_ids: formSelectedEquipments
      };

      try {
        await api.put(`/meetings/${editingMeetingId}`, updatePayload);
        setShowCreateModal(false);
        setEditingMeetingId(null);
        loadCalendarData();
      } catch (err: any) {
        console.error('Lỗi cập nhật cuộc họp:', err);
        setCreateError(err.response?.data?.detail || 'Không thể cập nhật cuộc họp!');
      } finally {
        setSubmitting(false);
      }
      return;
    }

    const payload = {
      room_id: Number(formRoomId) || (rooms[0]?.room_id || 1),
      title: formTitle.trim(),
      description: formDescription.trim(),
      start_time: startIso,
      end_time: endIso,
      meeting_type: formMeetingType,
      meeting_link: formMeetingType !== 'IN_PERSON' ? (formMeetingLink || `https://meet.google.com/ictu-grp4-${Date.now().toString().slice(-4)}`) : undefined,
      participant_ids: formSelectedParticipants.map(u => u.user_id),
      equipment_ids: formSelectedEquipments,
      recurrence: formRecurrence,
      recurrence_count: formRecurrence !== 'NONE' ? formRecurrenceCount : 1
    };

    try {
      await api.post('/meetings', payload);
      setShowCreateModal(false);
      setEditingMeetingId(null);
      loadCalendarData();
      window.dispatchEvent(new Event('meeting-updated'));
      window.dispatchEvent(new Event('system-notification-updated'));
      window.dispatchEvent(new Event('appDataSync'));
    } catch (err: any) {
      console.error('Lỗi tạo cuộc họp:', err);
      setCreateError(err.response?.data?.detail || 'Không thể tạo cuộc họp. Vui lòng kiểm tra lại thời gian!');
    } finally {
      setSubmitting(false);
    }
  };

  // ── 14. HỦY / XÓA CUỘC HỌP & GIẢI PHÓNG PHÒNG, THIẾT BỊ (US #2, #9, #12) ──
  const handleCancelMeeting = async (meetingId: number) => {
    if (!confirm('Bạn có chắc chắn muốn hủy cuộc họp này không? Hệ thống sẽ tự động giải phóng phòng họp và thu hồi thiết bị để các thành viên khác có thể sử dụng.')) return;
    try {
      await api.patch(`/meetings/${meetingId}/cancel`);
      setShowDetailModal(false);
      loadCalendarData();
    } catch (err: any) {
      alert(`[Lỗi]: ${err.response?.data?.detail || 'Không thể hủy cuộc họp!'}`);
    }
  };

  // ── 15. PHẢN HỒI RSVP ──
  const handleRespondRsvp = async (meetingId: number, status: 'ACCEPTED' | 'DECLINED') => {
    try {
      await api.patch(`/meetings/${meetingId}/respond`, { status });
      // Cập nhật ngay lập tức trên state meetings
      setMeetings(prev => prev.map(m => {
        if (m.meeting_id !== meetingId) return m;
        return {
          ...m,
          participants: m.participants?.map(p => {
            const isMe = (currentUserId && (p.user_id === currentUserId || p.user?.user_id === currentUserId)) ||
              (currentUserEmail && p.user?.email && p.user.email.toLowerCase() === currentUserEmail);
            return isMe ? { ...p, rsvp_status: status } : p;
          })
        };
      }));

      // Cập nhật ngay trên selectedMeeting nếu đang mở modal
      if (selectedMeeting && selectedMeeting.meeting_id === meetingId) {
        setSelectedMeeting(prev => prev ? {
          ...prev,
          participants: prev.participants?.map(p => {
            const isMe = (currentUserId && (p.user_id === currentUserId || p.user?.user_id === currentUserId)) ||
              (currentUserEmail && p.user?.email && p.user.email.toLowerCase() === currentUserEmail);
            return isMe ? { ...p, rsvp_status: status } : p;
          })
        } : null);
      }

      loadCalendarData();
      window.dispatchEvent(new Event('meeting-updated'));
      window.dispatchEvent(new Event('system-notification-updated'));
      window.dispatchEvent(new Event('appDataSync'));
    } catch (err: any) {
      alert(`[Lỗi RSVP]: ${err.response?.data?.detail || 'Không thể gửi phản hồi'}`);
    }
  };

  // Copy link Google Meet
  const handleCopyLink = (link?: string) => {
    if (!link) return;
    navigator.clipboard.writeText(link);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  // ── 16. MINI CALENDAR TRONG SIDEBAR ──
  const [miniCalMonth, setMiniCalMonth] = useState<Date>(() => new Date(2026, 9, 1));

  const getMiniCalendarDays = () => {
    const year = miniCalMonth.getFullYear();
    const month = miniCalMonth.getMonth();
    const firstDayIndex = new Date(year, month, 1).getDay(); // Sunday = 0
    const totalDays = new Date(year, month + 1, 0).getDate();
    const prevMonthDays = new Date(year, month, 0).getDate();

    const days: Array<{ day: number; isCurrentMonth: boolean; date: Date }> = [];

    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const d = prevMonthDays - i;
      days.push({ day: d, isCurrentMonth: false, date: new Date(year, month - 1, d) });
    }
    for (let i = 1; i <= totalDays; i++) {
      days.push({ day: i, isCurrentMonth: true, date: new Date(year, month, i) });
    }
    const remaining = 35 - days.length > 0 ? 35 - days.length : 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      days.push({ day: i, isCurrentMonth: false, date: new Date(year, month + 1, i) });
    }
    return days;
  };

  // Tính vị trí vạch đỏ hiển thị giờ hiện tại theo giờ Việt Nam (GMT+7)
  const currentHourPosition = (() => {
    const vnNow = getVietnamNow();
    return vnNow.getHours() + vnNow.getMinutes() / 60;
  })();

  // ── XỬ LÝ CHUYỂN ĐỔI TÀI KHOẢN & HỒ SƠ MEETHUB THẬT ──
  const handleSwitchAccount = async (targetEmail: string) => {
    setSwitchingAccount(true);
    try {
      // Đăng nhập chính thức qua API bằng tài khoản mục tiêu
      const response = await api.post('/auth/login', {
        email: targetEmail,
        password: '123456'
      });
      const data = response.data;
      const access_token = data.access_token || data.token;

      localStorage.setItem('access_token', access_token);
      localStorage.setItem('token', access_token);
      sessionStorage.setItem('access_token', access_token);
      sessionStorage.setItem('token', access_token);

      // Lấy thông tin user chuẩn từ DB qua /auth/me
      const meRes = await api.get('/auth/me', {
        headers: { Authorization: `Bearer ${access_token}` }
      });
      const dbUser = meRes.data;

      const updatedUser = {
        id: dbUser.user_id,
        email: dbUser.email,
        fullName: dbUser.full_name,
        role: dbUser.role?.role_name || (dbUser.email.includes('admin') ? 'ADMIN' : 'LECTURER'),
        avatar: dbUser.avatar_url || (dbUser.email.includes('admin') ? '/phuong_account_avatar.png' : '/hoang_phuong_avatar.png'),
        phone: dbUser.phone || '',
        department: dbUser.department?.department_name || 'Khoa CNTT'
      };

      localStorage.setItem('user', JSON.stringify(updatedUser));
      localStorage.setItem('currentUser', JSON.stringify(updatedUser));
      sessionStorage.setItem('user', JSON.stringify(updatedUser));
      sessionStorage.setItem('currentUser', JSON.stringify(updatedUser));
      setStorage('meetinghub_user', updatedUser);
      localStorage.removeItem('meetinghub_active_account');

      window.dispatchEvent(new Event('user-data-updated'));
      window.dispatchEvent(new Event('userProfileUpdated'));
      setShowProfileDropdown(false);

      // Chuyển hướng đúng giao diện tương ứng vai trò
      const r = (updatedUser.role || '').toLowerCase();
      if (r === 'admin' || r.includes('quản trị')) {
        window.location.href = '/dashboard';
      } else {
        window.location.href = '/user';
      }
    } catch (err) {
      console.error('Lỗi khi chuyển tài khoản:', err);
      alert('Không thể chuyển tài khoản tự động. Vui lòng kiểm tra lại mật khẩu hoặc dịch vụ backend!');
    } finally {
      setSwitchingAccount(false);
    }
  };

  const handleLogoutAllAccounts = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('currentUser');
    localStorage.removeItem('meetinghub_user');
    localStorage.removeItem('meetinghub_active_account');
    sessionStorage.clear();
    window.location.href = '/login';
  };

  const handleSaveMeetingHubProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const currentStoredUser = JSON.parse(localStorage.getItem('user') || '{}');
      const userId = currentStoredUser.id || 2;

      // Gọi API cập nhật thông tin người dùng trong DB
      await api.put(`/users/${userId}`, {
        full_name: editFullName,
        phone: editPhone
      });

      const updatedUser = {
        ...currentStoredUser,
        fullName: editFullName,
        phone: editPhone,
        avatar: editAvatar || currentStoredUser.avatar
      };

      localStorage.setItem('user', JSON.stringify(updatedUser));
      localStorage.setItem('currentUser', JSON.stringify(updatedUser));
      sessionStorage.setItem('user', JSON.stringify(updatedUser));
      setStorage('meetinghub_user', updatedUser);

      setActiveAccount(prev => ({
        ...prev,
        fullName: editFullName,
        phone: editPhone,
        avatar: editAvatar || prev.avatar
      }));

      window.dispatchEvent(new Event('user-data-updated'));
      setProfileSuccessMsg('Đã cập nhật thông tin hồ sơ thành công vào cơ sở dữ liệu!');
      setTimeout(() => {
        setProfileSuccessMsg('');
        setShowAccountManagerModal(false);
      }, 1200);
    } catch (err: any) {
      console.error('Lỗi khi lưu thông tin:', err);
      setActiveAccount(prev => ({ ...prev, fullName: editFullName, phone: editPhone, avatar: editAvatar || prev.avatar }));
      setProfileSuccessMsg('Đã cập nhật thông tin hồ sơ!');
      setTimeout(() => {
        setProfileSuccessMsg('');
        setShowAccountManagerModal(false);
      }, 1000);
    }
  };

  // Profile & Session Dropdown Popover (Thực tế, có tác dụng chuyển quyền và sử dụng dữ liệu)
  const renderProfileDropdown = () => {
    if (!showProfileDropdown) return null;

    const isCurrentAdmin = (activeAccount.email || '').includes('admin') ||
      (activeAccount.role || '').toLowerCase().includes('quản trị');

    const otherAccount = isCurrentAdmin
      ? {
        fullName: 'Hoàng Thanh Phương',
        email: 'hoangphuong@ictu.edu.vn',
        avatar: '/hoang_phuong_avatar.png',
        role: 'Người dùng (Khoa CNTT)',
        targetEmail: 'hoangphuong@ictu.edu.vn'
      }
      : {
        fullName: 'Hoàng Phương',
        email: 'admin@ictu.edu.vn',
        avatar: '/phuong_account_avatar.png',
        role: 'Quản trị viên (Hệ thống)',
        targetEmail: 'admin@ictu.edu.vn'
      };

    return (
      <div
        style={{
          position: 'absolute',
          top: 'calc(100% + 8px)',
          right: '0px',
          width: '390px',
          maxWidth: 'calc(100vw - 24px)',
          backgroundColor: '#f8fafc',
          borderRadius: '24px',
          boxShadow: '0 10px 30px rgba(0,0,0,0.18)',
          padding: '16px 14px',
          zIndex: 9999,
          fontFamily: "'Google Sans', Roboto, -apple-system, BlinkMacSystemFont, sans-serif",
          border: '1px solid #e2e8f0'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 1. Header: Thông tin hệ thống ICTU + Nút đóng */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 6px 12px 6px', borderBottom: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '22px', height: '22px', borderRadius: '50%', backgroundColor: '#0066b2', color: '#fff', fontSize: '9px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>ICTU</div>
            <span style={{ fontSize: '13px', fontWeight: '600', color: '#334155' }}>Hệ thống MeetingHub - ICTU</span>
          </div>
          <button
            onClick={() => setShowProfileDropdown(false)}
            style={{ width: '28px', height: '28px', borderRadius: '50%', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}
            className="hover:bg-slate-200 transition-colors"
            title="Đóng"
          >
            <X size={16} />
          </button>
        </div>

        {/* 2. Card Người dùng đang đăng nhập */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '20px',
          padding: '16px',
          margin: '12px 0',
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
          border: '1px solid #e2e8f0'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            {/* Avatar lớn + Icon chỉnh sửa */}
            <div style={{ position: 'relative', width: '56px', height: '56px', flexShrink: 0 }}>
              <img
                src={activeAccount.avatar}
                alt={activeAccount.fullName}
                style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover', border: '2px solid #0066b2' }}
                onError={(e) => {
                  (e.target as HTMLImageElement).src = isCurrentAdmin ? '/phuong_account_avatar.png' : '/hoang_phuong_avatar.png';
                }}
              />
              <button
                onClick={() => {
                  setShowAccountManagerModal(true);
                  setShowProfileDropdown(false);
                }}
                style={{
                  position: 'absolute',
                  bottom: '-2px',
                  right: '-2px',
                  width: '22px',
                  height: '22px',
                  borderRadius: '50%',
                  backgroundColor: '#ffffff',
                  border: '1px solid #cbd5e1',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.18)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: '#1e293b'
                }}
                className="hover:bg-slate-100"
                title="Chỉnh sửa hồ sơ"
              >
                <Edit2 size={11} />
              </button>
            </div>

            {/* Thông tin tài khoản */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '15px', fontWeight: '700', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {activeAccount.fullName}
              </div>
              <div style={{ fontSize: '12px', color: '#475569', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {activeAccount.email}
              </div>
              <div style={{ marginTop: '6px', display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '3px 9px', borderRadius: '9999px', backgroundColor: isCurrentAdmin ? '#eff6ff' : '#f0fdf4', color: isCurrentAdmin ? '#1d4ed8' : '#15803d', fontSize: '11px', fontWeight: '600' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: isCurrentAdmin ? '#2563eb' : '#22c55e' }}></span>
                {isCurrentAdmin ? 'Quản trị viên (Admin)' : 'Người dùng (Khoa CNTT)'}
              </div>
            </div>
          </div>
        </div>

        {/* 3. Chuyển đổi nhanh vai trò / tài khoản (CÓ TÁC DỤNG THẬT) */}
        <div style={{ marginBottom: '12px' }}>
          <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', padding: '0 6px 6px 6px' }}>
            Chuyển nhanh tài khoản demo
          </div>
          <div
            onClick={() => handleSwitchAccount(otherAccount.targetEmail)}
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              padding: '12px 14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: switchingAccount ? 'wait' : 'pointer',
              border: '1px solid #cbd5e1',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              transition: 'all 0.15s ease'
            }}
            className="hover:bg-blue-50 hover:border-blue-300"
            title={`Chuyển sang tài khoản ${otherAccount.fullName}`}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '38px', height: '38px', borderRadius: '50%', overflow: 'hidden', flexShrink: 0, border: '1.5px solid #0066b2' }}>
                <img
                  src={otherAccount.avatar}
                  alt={otherAccount.fullName}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </div>
              <div>
                <div style={{ fontSize: '13px', fontWeight: '600', color: '#0f172a' }}>
                  {otherAccount.fullName}
                </div>
                <div style={{ fontSize: '11px', color: '#64748b' }}>
                  {otherAccount.email} • <span style={{ fontWeight: '500', color: '#0284c7' }}>{otherAccount.role}</span>
                </div>
              </div>
            </div>
            <div style={{ padding: '6px 10px', borderRadius: '8px', backgroundColor: '#e0f2fe', color: '#0284c7', fontSize: '12px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <RefreshCw size={13} className={switchingAccount ? 'animate-spin' : ''} />
              <span>Chuyển</span>
            </div>
          </div>
        </div>

        {/* 4. Các chức năng thực tế của hệ thống MeetingHub */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', backgroundColor: '#ffffff', borderRadius: '16px', padding: '6px', border: '1px solid #e2e8f0' }}>
          {/* Lọc cuộc họp của tôi */}
          <button
            onClick={() => {
              setFilterMyMeetingsOnly(prev => !prev);
              setShowProfileDropdown(false);
            }}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '10px 12px',
              borderRadius: '10px',
              border: 'none',
              backgroundColor: filterMyMeetingsOnly ? '#dbeafe' : 'transparent',
              color: filterMyMeetingsOnly ? '#1d4ed8' : '#334155',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: '500',
              textAlign: 'left'
            }}
            className="hover:bg-slate-100"
          >
            <CalendarIcon size={16} color={filterMyMeetingsOnly ? '#1d4ed8' : '#64748b'} />
            <span style={{ flex: 1 }}>Cuộc họp của tôi</span>
            {filterMyMeetingsOnly && <span style={{ fontSize: '11px', backgroundColor: '#2563eb', color: '#fff', padding: '2px 6px', borderRadius: '10px' }}>Đang bật</span>}
          </button>

          {/* Xem danh sách phòng */}
          <button
            onClick={() => {
              setShowProfileDropdown(false);
              if (onNavigateToTab) {
                onNavigateToTab('book-room');
              } else {
                window.location.href = isCurrentAdmin ? '/dashboard/rooms' : '/user';
              }
            }}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '10px 12px',
              borderRadius: '10px',
              border: 'none',
              backgroundColor: 'transparent',
              color: '#334155',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: '500',
              textAlign: 'left'
            }}
            className="hover:bg-slate-100"
          >
            <Building2 size={16} color="#64748b" />
            <span>Tra cứu phòng họp</span>
          </button>

          {/* Chỉnh sửa hồ sơ cá nhân */}
          <button
            onClick={() => {
              setShowAccountManagerModal(true);
              setShowProfileDropdown(false);
            }}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '10px 12px',
              borderRadius: '10px',
              border: 'none',
              backgroundColor: 'transparent',
              color: '#334155',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: '500',
              textAlign: 'left'
            }}
            className="hover:bg-slate-100"
          >
            <User size={16} color="#64748b" />
            <span>Hồ sơ tài khoản cá nhân</span>
          </button>

          {/* Đăng xuất */}
          <button
            onClick={handleLogoutAllAccounts}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '10px 12px',
              borderRadius: '10px',
              border: 'none',
              backgroundColor: 'transparent',
              color: '#dc2626',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: '600',
              textAlign: 'left'
            }}
            className="hover:bg-red-50"
          >
            <LogOut size={16} color="#dc2626" />
            <span>Đăng xuất khỏi hệ thống</span>
          </button>
        </div>
      </div>
    );
  };

  // Google Apps Launcher Popover (9 dots icon)
  const renderAppsDropdown = () => {
    if (!showAppsDropdown) return null;

    return (
      <div
        style={{
          position: 'absolute',
          top: 'calc(100% + 8px)',
          right: '0px',
          width: '320px',
          backgroundColor: '#f0f4f9',
          borderRadius: '24px',
          boxShadow: '0 4px 20px 2px rgba(0,0,0,0.18)',
          padding: '16px',
          zIndex: 9999,
          fontFamily: "'Google Sans', Roboto, sans-serif"
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
          {/* Lịch */}
          <button
            onClick={() => { setActiveAppMode('calendar'); setShowAppsDropdown(false); }}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '6px',
              padding: '12px 6px',
              borderRadius: '16px',
              border: 'none',
              backgroundColor: activeAppMode === 'calendar' ? '#d3e3fd' : '#ffffff',
              cursor: 'pointer'
            }}
            className="hover:bg-slate-100 transition-colors"
          >
            <div style={{ width: '40px', height: '40px', borderRadius: '8px', backgroundColor: '#1a73e8', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '18px' }}>
              16
            </div>
            <span style={{ fontSize: '12px', color: '#1f1f1f', fontWeight: '500' }}>Lịch</span>
          </button>

          {/* Việc cần làm (Tasks) */}
          <button
            onClick={() => { setActiveAppMode('tasks'); setShowAppsDropdown(false); }}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '6px',
              padding: '12px 6px',
              borderRadius: '16px',
              border: 'none',
              backgroundColor: activeAppMode === 'tasks' ? '#d3e3fd' : '#ffffff',
              cursor: 'pointer'
            }}
            className="hover:bg-slate-100 transition-colors"
          >
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#0b57d0', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CheckSquare size={20} />
            </div>
            <span style={{ fontSize: '12px', color: '#1f1f1f', fontWeight: '500' }}>Tasks</span>
          </button>

          {/* Google Meet */}
          <a
            href="https://meet.google.com/new"
            target="_blank"
            rel="noreferrer"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '6px',
              padding: '12px 6px',
              borderRadius: '16px',
              textDecoration: 'none',
              backgroundColor: '#ffffff'
            }}
            className="hover:bg-slate-100 transition-colors"
          >
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#00ac47', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Video size={20} />
            </div>
            <span style={{ fontSize: '12px', color: '#1f1f1f', fontWeight: '500' }}>Meet</span>
          </a>

          {/* Gmail */}
          <a
            href="https://mail.google.com"
            target="_blank"
            rel="noreferrer"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '6px',
              padding: '12px 6px',
              borderRadius: '16px',
              textDecoration: 'none',
              backgroundColor: '#ffffff'
            }}
            className="hover:bg-slate-100 transition-colors"
          >
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#ea4335', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '18px' }}>
              M
            </div>
            <span style={{ fontSize: '12px', color: '#1f1f1f', fontWeight: '500' }}>Gmail</span>
          </a>

          {/* Phòng họp */}
          <button
            onClick={() => {
              if (onNavigateToTab) onNavigateToTab('rooms');
              setShowAppsDropdown(false);
            }}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '6px',
              padding: '12px 6px',
              borderRadius: '16px',
              border: 'none',
              backgroundColor: '#ffffff',
              cursor: 'pointer'
            }}
            className="hover:bg-slate-100 transition-colors"
          >
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#0284c7', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <DoorClosed size={20} />
            </div>
            <span style={{ fontSize: '12px', color: '#1f1f1f', fontWeight: '500' }}>Phòng họp</span>
          </button>

          {/* Danh bạ */}
          <button
            onClick={() => { setIsSearchExpanded(true); setShowAppsDropdown(false); }}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '6px',
              padding: '12px 6px',
              borderRadius: '16px',
              border: 'none',
              backgroundColor: '#ffffff',
              cursor: 'pointer'
            }}
            className="hover:bg-slate-100 transition-colors"
          >
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#4285f4', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Users size={20} />
            </div>
            <span style={{ fontSize: '12px', color: '#1f1f1f', fontWeight: '500' }}>Danh bạ</span>
          </button>
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', backgroundColor: '#ffffff', color: '#3c4043', overflow: 'hidden', fontFamily: 'Roboto, -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif' }}>

      {/* ══════════════════════════════════════════════════════════════════════
          1. TOP NAVIGATION BAR (CHUẨN GOOGLE CALENDAR PIXEL-PERFECT)
          ══════════════════════════════════════════════════════════════════════ */}
      {isSearchExpanded ? (
        /* ── CHẾ ĐỘ TÌM KIẾM MỞ RỘNG (SCREENSHOT 2) ── */
        <header style={{
          height: '64px',
          borderBottom: '1px solid #dadce0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
          flexShrink: 0,
          backgroundColor: '#ffffff'
        }}>
          {/* Nút quay lại + Chữ "Tìm kiếm" (Screenshot 2) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button
              onClick={() => {
                setIsSearchExpanded(false);
                setSearchGlobalQuery('');
              }}
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#5f6368'
              }}
              className="hover:bg-slate-100"
              title="Quay lại"
            >
              <ArrowLeft size={20} />
            </button>
            <span style={{ fontSize: '20px', fontWeight: '500', color: '#3c4043' }}>
              Tìm kiếm
            </span>
          </div>

          {/* Thanh tìm kiếm dài bo tròn với icon mũi tên ▾ (Screenshot 2) */}
          <div style={{ flex: 1, maxWidth: '720px', margin: '0 24px', position: 'relative' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: '#f1f3f4',
              borderRadius: '28px',
              padding: '0 16px',
              height: '48px',
              border: '1px solid transparent',
              transition: 'all 0.2s',
              boxShadow: searchGlobalQuery ? '0 2px 8px rgba(60,64,67,0.18)' : 'none'
            }}>
              <Search size={20} color="#5f6368" style={{ marginRight: '12px', flexShrink: 0 }} />
              <input
                type="text"
                value={searchGlobalQuery}
                onChange={(e) => setSearchGlobalQuery(e.target.value)}
                placeholder="Tìm kiếm cuộc họp, việc cần làm, phòng hoặc người..."
                autoFocus
                style={{
                  flex: 1,
                  border: 'none',
                  backgroundColor: 'transparent',
                  outline: 'none',
                  fontSize: '15px',
                  color: '#1f1f1f'
                }}
              />
              {searchGlobalQuery && (
                <button
                  onClick={() => setSearchGlobalQuery('')}
                  style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#5f6368', padding: '4px', marginRight: '6px' }}
                >
                  <X size={16} />
                </button>
              )}
              <div style={{ width: '1px', height: '20px', backgroundColor: '#dadce0', margin: '0 8px' }}></div>
              <ChevronDown size={18} color="#5f6368" style={{ cursor: 'pointer' }} />
            </div>

            {/* Khung gợi ý kết quả tìm kiếm trực tiếp (Live Search Results Popover) */}
            {searchGlobalQuery.trim() && (
              <div style={{
                position: 'absolute',
                top: 'calc(100% + 8px)',
                left: 0,
                right: 0,
                backgroundColor: '#ffffff',
                borderRadius: '12px',
                boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                border: '1px solid #dadce0',
                maxHeight: '440px',
                overflowY: 'auto',
                zIndex: 100,
                padding: '12px 0'
              }}>
                {/* 1. Cuộc họp phù hợp */}
                {meetings.filter(m =>
                  m.title.toLowerCase().includes(searchGlobalQuery.toLowerCase()) ||
                  (m.description && m.description.toLowerCase().includes(searchGlobalQuery.toLowerCase()))
                ).length > 0 && (
                    <div>
                      <div style={{ padding: '6px 16px', fontSize: '11px', fontWeight: 'bold', color: '#70757a', textTransform: 'uppercase' }}>
                        Cuộc họp ({meetings.filter(m => m.title.toLowerCase().includes(searchGlobalQuery.toLowerCase())).length})
                      </div>
                      {meetings.filter(m => m.title.toLowerCase().includes(searchGlobalQuery.toLowerCase())).map(m => (
                        <div
                          key={m.meeting_id}
                          onClick={() => {
                            setSelectedMeeting(m);
                            setShowDetailModal(true);
                            setIsSearchExpanded(false);
                          }}
                          style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
                          className="hover:bg-blue-50"
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <CalendarDays size={18} color="#1a73e8" />
                            <div>
                              <div style={{ fontSize: '14px', fontWeight: '500', color: '#1f1f1f' }}>{m.title}</div>
                              <div style={{ fontSize: '12px', color: '#5f6368' }}>{formatTime(m.start_time)} - {formatTime(m.end_time)} • {m.room?.room_name || 'Google Meet'}</div>
                            </div>
                          </div>
                          <span style={{ fontSize: '12px', color: '#1a73e8', fontWeight: '500' }}>Xem chi tiết</span>
                        </div>
                      ))}
                    </div>
                  )}

                {/* 2. Việc cần làm phù hợp */}
                {tasks.filter(t =>
                  t.title.toLowerCase().includes(searchGlobalQuery.toLowerCase()) ||
                  (t.notes && t.notes.toLowerCase().includes(searchGlobalQuery.toLowerCase()))
                ).length > 0 && (
                    <div style={{ borderTop: '1px solid #f1f3f4', marginTop: '6px', paddingTop: '6px' }}>
                      <div style={{ padding: '6px 16px', fontSize: '11px', fontWeight: 'bold', color: '#70757a', textTransform: 'uppercase' }}>
                        Việc cần làm ({tasks.filter(t => t.title.toLowerCase().includes(searchGlobalQuery.toLowerCase())).length})
                      </div>
                      {tasks.filter(t => t.title.toLowerCase().includes(searchGlobalQuery.toLowerCase())).map(t => (
                        <div
                          key={t.id}
                          onClick={() => {
                            setActiveAppMode('tasks');
                            setTaskFilter('all');
                            setIsSearchExpanded(false);
                          }}
                          style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
                          className="hover:bg-slate-50"
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <CheckCircle2 size={18} color={t.completed ? '#1e8e3e' : '#1a73e8'} />
                            <div>
                              <div style={{ fontSize: '14px', fontWeight: '500', color: '#1f1f1f', textDecoration: t.completed ? 'line-through' : 'none' }}>{t.title}</div>
                              {t.dueDate && <div style={{ fontSize: '12px', color: '#5f6368' }}>Hạn: {t.dueDate}</div>}
                            </div>
                          </div>
                          <span style={{ fontSize: '12px', color: '#5f6368' }}>Chuyển tới Tasks</span>
                        </div>
                      ))}
                    </div>
                  )}

                {/* 3. Người dùng / Khách mời phù hợp */}
                {defaultSuggestedUsers.filter(u =>
                  u.full_name.toLowerCase().includes(searchGlobalQuery.toLowerCase()) ||
                  u.email.toLowerCase().includes(searchGlobalQuery.toLowerCase())
                ).length > 0 && (
                    <div style={{ borderTop: '1px solid #f1f3f4', marginTop: '6px', paddingTop: '6px' }}>
                      <div style={{ padding: '6px 16px', fontSize: '11px', fontWeight: 'bold', color: '#70757a', textTransform: 'uppercase' }}>
                        Người dùng & Giảng viên
                      </div>
                      {defaultSuggestedUsers.filter(u =>
                        u.full_name.toLowerCase().includes(searchGlobalQuery.toLowerCase()) ||
                        u.email.toLowerCase().includes(searchGlobalQuery.toLowerCase())
                      ).map(u => (
                        <div
                          key={u.user_id}
                          onClick={() => {
                            setSelectedUserFilter(u);
                            setIsSearchExpanded(false);
                          }}
                          style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}
                          className="hover:bg-slate-50"
                        >
                          <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: '#4285F4', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 'bold' }}>
                            {u.full_name.charAt(0)}
                          </div>
                          <div>
                            <div style={{ fontSize: '13px', fontWeight: '500', color: '#1f1f1f' }}>{u.full_name}</div>
                            <div style={{ fontSize: '12px', color: '#70757a' }}>{u.email}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
              </div>
            )}
          </div>

          {/* Bên phải của chế độ tìm kiếm: Icon 9 chấm + Double Avatar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* 9 Dots Google Apps icon kèm Dropdown (Neo chuẩn xác) */}
            <div ref={appsDropdownRef} style={{ position: 'relative' }}>
              <button
                onClick={() => {
                  setShowAppsDropdown(prev => !prev);
                  setShowProfileDropdown(false);
                  setShowSettingsDropdown(false);
                  setShowHelpDropdown(false);
                }}
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  border: 'none',
                  background: showAppsDropdown ? '#e8eaed' : 'transparent',
                  cursor: 'pointer',
                  color: '#5f6368',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                className="hover:bg-slate-100 transition-colors"
                title="Các ứng dụng Google"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="#5f6368">
                  <circle cx="5" cy="5" r="2" /><circle cx="12" cy="5" r="2" /><circle cx="19" cy="5" r="2" />
                  <circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" />
                  <circle cx="5" cy="19" r="2" /><circle cx="12" cy="19" r="2" /><circle cx="19" cy="19" r="2" />
                </svg>
              </button>
              {renderAppsDropdown()}
            </div>

            {/* Viên nhộng đôi 2 logo/ảnh (Capsule Badge - Khớp 100% Ảnh 1 & 2) */}
            <div ref={profileDropdownRef} style={{ position: 'relative' }}>
              <div
                onClick={() => {
                  setShowProfileDropdown(prev => !prev);
                  setShowAppsDropdown(false);
                  setShowSettingsDropdown(false);
                  setShowHelpDropdown(false);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '2px 4px 2px 2px',
                  borderRadius: '9999px',
                  border: '1px solid #747775',
                  gap: '6px',
                  marginLeft: '4px',
                  cursor: 'pointer',
                  backgroundColor: showProfileDropdown ? '#edf2fa' : '#ffffff',
                  boxShadow: showProfileDropdown ? '0 1px 4px rgba(0,0,0,0.2)' : 'none',
                  transition: 'box-shadow 0.15s, background-color 0.15s'
                }}
                className="hover:shadow-sm hover:bg-slate-50"
                title={`Tài khoản: ${activeAccount.fullName} (${activeAccount.email})`}
              >
                {/* Huy hiệu ICTU chuẩn xanh đậm chữ trắng sắc nét (Khớp Ảnh 1) */}
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  backgroundColor: '#0066b2',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffffff',
                  fontSize: '11px',
                  fontWeight: 'bold',
                  letterSpacing: '0.2px',
                  flexShrink: 0
                }}>
                  ICTU
                </div>

                {/* Avatar người dùng */}
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: '#1a73e8',
                  flexShrink: 0
                }}>
                  <img
                    src={activeAccount.avatar || '/hoang_phuong_avatar.png'}
                    alt="Avatar"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '/hoang_phuong_avatar.png';
                    }}
                  />
                </div>
              </div>

              {/* Google Profile Dropdown Popover (Ảnh 2) */}
              {renderProfileDropdown()}
            </div>
          </div>
        </header>
      ) : (
        /* ── CHẾ ĐỘ HEADER BÌNH THƯỜNG (SCREENSHOT 1, 3, 4, 5) ── */
        <header style={{
          height: '64px',
          borderBottom: '1px solid #dadce0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
          flexShrink: 0,
          backgroundColor: '#ffffff',
          position: 'relative',
          zIndex: 60
        }}>
          {/* Left Section: Menu Toggle, Logo [16] Lịch, Hôm nay, Nav Arrows, Tháng/Năm */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* Hamburger toggle sidebar */}
            <button
              onClick={() => setShowSidebar(prev => !prev)}
              style={{ width: '40px', height: '40px', borderRadius: '50%', border: 'none', background: 'transparent', cursor: 'pointer', color: '#5f6368', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              className="hover:bg-slate-100 transition-colors"
              title="Menu chính"
            >
              <div style={{ width: '18px', height: '14px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <span style={{ height: '2px', backgroundColor: '#5f6368', borderRadius: '1px' }}></span>
                <span style={{ height: '2px', backgroundColor: '#5f6368', borderRadius: '1px' }}></span>
                <span style={{ height: '2px', backgroundColor: '#5f6368', borderRadius: '1px' }}></span>
              </div>
            </button>

            {/* Logo Google Calendar: Icon xanh số 16 + Chữ "Lịch" */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }} onClick={handleToday}>
              <div style={{
                width: '40px',
                height: '40px',
                backgroundColor: '#1a73e8',
                borderRadius: '8px',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
                fontSize: '20px',
                fontWeight: 'bold',
                lineHeight: 1
              }}>
                {getVietnamNow().getDate()}
              </div>
              <span style={{ fontSize: '22px', color: '#3c4043', fontWeight: '400', letterSpacing: '-0.3px' }}>
                Lịch
              </span>
            </div>

            {/* Nếu đang ở tab Calendar mới hiển thị Hôm nay, Arrows và Tháng/Năm */}
            {activeAppMode === 'calendar' && (
              <>
                <div style={{ width: '12px' }}></div>

                {/* Nút "Hôm nay" (Pill shape) */}
                <button
                  onClick={handleToday}
                  style={{
                    padding: '8px 20px',
                    border: '1px solid #dadce0',
                    borderRadius: '9999px',
                    backgroundColor: '#ffffff',
                    color: '#3c4043',
                    fontSize: '14px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    transition: 'background-color 0.2s'
                  }}
                  className="hover:bg-slate-50"
                >
                  Hôm nay
                </button>

                {/* Nút "Lịch sử họp" (US #6) */}
                <button
                  onClick={handleOpenHistoryModal}
                  style={{
                    padding: '8px 16px',
                    border: '1px solid #c2e7ff',
                    borderRadius: '9999px',
                    backgroundColor: '#f0f7ff',
                    color: '#0b57d0',
                    fontSize: '13px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.2s'
                  }}
                  className="hover:bg-blue-100 shadow-sm"
                  title="Xem lại lịch sử các cuộc họp đã tham gia (US #6)"
                >
                  <BookOpen size={16} color="#0b57d0" />
                  <span>Lịch sử họp</span>
                </button>

                {/* Nút "Danh mục phòng" (US #7, #10) */}
                <button
                  onClick={() => {
                    if (onNavigateToTab) {
                      onNavigateToTab('book-room');
                    } else {
                      window.location.href = '/rooms';
                    }
                  }}
                  style={{
                    padding: '8px 16px',
                    border: '1px solid #dadce0',
                    borderRadius: '9999px',
                    backgroundColor: '#ffffff',
                    color: '#3c4043',
                    fontSize: '13px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.2s'
                  }}
                  className="hover:bg-slate-50 shadow-sm"
                  title="Xem danh mục phòng họp & kiểm tra sức chứa (US #7, #10)"
                >
                  <Building2 size={16} color="#5f6368" />
                  <span>Danh mục phòng</span>
                </button>

                {/* Nút "Đồng bộ .ics" (US #15) */}
                <button
                  onClick={handleExportAllMeetingsIcs}
                  style={{
                    padding: '8px 16px',
                    border: '1px solid #dadce0',
                    borderRadius: '9999px',
                    backgroundColor: '#ffffff',
                    color: '#3c4043',
                    fontSize: '13px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.2s'
                  }}
                  className="hover:bg-slate-50 shadow-sm"
                  title="Xuất toàn bộ lịch họp thành file .ics để đồng bộ vào Google Calendar / Outlook (US #15)"
                >
                  <Download size={15} color="#5f6368" />
                  <span>Đồng bộ .ics</span>
                </button>

                {/* Nút lùi / tiến */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                  <button
                    onClick={handlePrev}
                    style={{ width: '36px', height: '36px', borderRadius: '50%', border: 'none', background: 'transparent', cursor: 'pointer', color: '#5f6368', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    className="hover:bg-slate-100"
                    title="Khoảng thời gian trước"
                  >
                    <ChevronLeft size={20} />
                  </button>
                  <button
                    onClick={handleNext}
                    style={{ width: '36px', height: '36px', borderRadius: '50%', border: 'none', background: 'transparent', cursor: 'pointer', color: '#5f6368', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    className="hover:bg-slate-100"
                    title="Khoảng thời gian sau"
                  >
                    <ChevronRight size={20} />
                  </button>
                </div>

                {/* Tiêu đề Tháng Năm / Ngày (Screenshot 1 & 5) */}
                <h2 style={{ fontSize: '22px', fontWeight: '400', color: '#3c4043', margin: '0 0 0 8px' }}>
                  {getHeaderTitle()}
                </h2>
              </>
            )}
          </div>

          {/* Right Section: Search, Support, Settings, View Dropdown, Calendar/Task Toggle, Avatar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* Nút Tìm kiếm (Click mở chế độ tìm kiếm mở rộng - Screenshot 2) */}
            <button
              onClick={() => setIsSearchExpanded(true)}
              style={{ width: '40px', height: '40px', borderRadius: '50%', border: 'none', background: 'transparent', cursor: 'pointer', color: '#5f6368', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              className="hover:bg-slate-100"
              title="Tìm kiếm"
            >
              <Search size={20} />
            </button>

            {/* Nút Trợ giúp kèm Menu Thả xuống (Screenshot 3) */}
            <div ref={helpDropdownRef} style={{ position: 'relative' }}>
              <button
                onClick={() => setShowHelpDropdown(prev => !prev)}
                style={{ width: '40px', height: '40px', borderRadius: '50%', border: 'none', background: 'transparent', cursor: 'pointer', color: '#5f6368', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                className="hover:bg-slate-100"
                title="Hỗ trợ"
              >
                <HelpCircle size={20} />
              </button>

              {/* Menu Thả xuống Trợ giúp (Khớp 100% Screenshot 3) */}
              {showHelpDropdown && (
                <div style={{
                  position: 'absolute',
                  top: 'calc(100% + 4px)',
                  right: 0,
                  backgroundColor: '#ffffff',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
                  borderRadius: '8px',
                  border: '1px solid #dadce0',
                  width: '240px',
                  padding: '6px 0',
                  zIndex: 80
                }}>
                  <button
                    onClick={() => { setShowHelpModal(true); setShowHelpDropdown(false); }}
                    style={{ width: '100%', padding: '10px 20px', display: 'flex', alignItems: 'center', gap: '12px', border: 'none', background: 'transparent', color: '#3c4043', fontSize: '14px', cursor: 'pointer', textAlign: 'left' }}
                    className="hover:bg-slate-100"
                  >
                    <span>Trợ giúp</span>
                  </button>
                  <button
                    onClick={() => { setShowTrainingModal(true); setShowHelpDropdown(false); }}
                    style={{ width: '100%', padding: '10px 20px', display: 'flex', alignItems: 'center', gap: '12px', border: 'none', background: 'transparent', color: '#3c4043', fontSize: '14px', cursor: 'pointer', textAlign: 'left' }}
                    className="hover:bg-slate-100"
                  >
                    <span>Đào tạo</span>
                  </button>
                  <button
                    onClick={() => { setShowFeedbackModal(true); setShowHelpDropdown(false); }}
                    style={{ width: '100%', padding: '10px 20px', display: 'flex', alignItems: 'center', gap: '12px', border: 'none', background: 'transparent', color: '#3c4043', fontSize: '14px', cursor: 'pointer', textAlign: 'left' }}
                    className="hover:bg-slate-100"
                  >
                    <span>Gửi ý kiến phản hồi cho Google</span>
                  </button>
                </div>
              )}
            </div>

            {/* Nút Cài đặt kèm Menu Thả xuống (Screenshot 4) */}
            <div ref={settingsDropdownRef} style={{ position: 'relative' }}>
              <button
                onClick={() => setShowSettingsDropdown(prev => !prev)}
                style={{ width: '40px', height: '40px', borderRadius: '50%', border: 'none', background: 'transparent', cursor: 'pointer', color: '#5f6368', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                className="hover:bg-slate-100"
                title="Menu cài đặt"
              >
                <Settings size={20} />
              </button>

              {/* Menu Thả xuống Cài đặt (Khớp 100% Screenshot 4) */}
              {showSettingsDropdown && (
                <div style={{
                  position: 'absolute',
                  top: 'calc(100% + 4px)',
                  right: 0,
                  backgroundColor: '#ffffff',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
                  borderRadius: '8px',
                  border: '1px solid #dadce0',
                  width: '240px',
                  padding: '6px 0',
                  zIndex: 80
                }}>
                  <button
                    onClick={() => { setShowSettingsModal(true); setShowSettingsDropdown(false); }}
                    style={{ width: '100%', padding: '10px 20px', display: 'flex', alignItems: 'center', gap: '12px', border: 'none', background: 'transparent', color: '#3c4043', fontSize: '14px', cursor: 'pointer', textAlign: 'left' }}
                    className="hover:bg-slate-100"
                  >
                    <span>Cài đặt</span>
                  </button>
                  <button
                    onClick={() => { setShowTrashModal(true); setShowSettingsDropdown(false); }}
                    style={{ width: '100%', padding: '10px 20px', display: 'flex', alignItems: 'center', gap: '12px', border: 'none', background: 'transparent', color: '#3c4043', fontSize: '14px', cursor: 'pointer', textAlign: 'left' }}
                    className="hover:bg-slate-100"
                  >
                    <span>Thùng rác</span>
                  </button>

                  <div style={{ height: '1px', backgroundColor: '#e8eaed', margin: '6px 0' }}></div>

                  <button
                    onClick={() => { setShowAppearanceModal(true); setShowSettingsDropdown(false); }}
                    style={{ width: '100%', padding: '10px 20px', display: 'flex', alignItems: 'center', gap: '12px', border: 'none', background: 'transparent', color: '#3c4043', fontSize: '14px', cursor: 'pointer', textAlign: 'left' }}
                    className="hover:bg-slate-100"
                  >
                    <span>Hình thức</span>
                  </button>
                  <button
                    onClick={() => { setShowSettingsDropdown(false); window.print(); }}
                    style={{ width: '100%', padding: '10px 20px', display: 'flex', alignItems: 'center', gap: '12px', border: 'none', background: 'transparent', color: '#3c4043', fontSize: '14px', cursor: 'pointer', textAlign: 'left' }}
                    className="hover:bg-slate-100"
                  >
                    <span>In</span>
                  </button>

                  <div style={{ height: '1px', backgroundColor: '#e8eaed', margin: '6px 0' }}></div>

                  <button
                    onClick={() => { setShowAddonsModal(true); setShowSettingsDropdown(false); }}
                    style={{ width: '100%', padding: '10px 20px', display: 'flex', alignItems: 'center', gap: '12px', border: 'none', background: 'transparent', color: '#3c4043', fontSize: '14px', cursor: 'pointer', textAlign: 'left' }}
                    className="hover:bg-slate-100"
                  >
                    <span>Tải tiện ích bổ sung</span>
                  </button>
                </div>
              )}
            </div>

            {/* Nút Chuông thông báo nhắc nhở & Lời mời họp (US #16) */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setShowNotificationsModal(prev => !prev)}
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  border: 'none',
                  background: showNotificationsModal ? '#e8eaed' : 'transparent',
                  cursor: 'pointer',
                  color: (upcomingMeetings.length > 0 || pendingInvitations.length > 0) ? '#1a73e8' : '#5f6368',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative'
                }}
                className="hover:bg-slate-100 transition-colors"
                title="Thông báo nhắc nhở & Lời mời cuộc họp"
              >
                <Bell size={20} />
                {(upcomingMeetings.length + pendingInvitations.length) > 0 && (
                  <span style={{
                    position: 'absolute',
                    top: '4px',
                    right: '4px',
                    width: '18px',
                    height: '18px',
                    borderRadius: '50%',
                    backgroundColor: pendingInvitations.length > 0 ? '#f59e0b' : '#ea4335',
                    color: 'white',
                    fontSize: '11px',
                    fontWeight: 'bold',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.2)'
                  }}>
                    {upcomingMeetings.length + pendingInvitations.length}
                  </span>
                )}
              </button>

              {/* Menu Popover Thông báo & Lời mời */}
              {showNotificationsModal && (
                <div style={{
                  position: 'absolute',
                  top: 'calc(100% + 4px)',
                  right: 0,
                  backgroundColor: '#ffffff',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
                  borderRadius: '12px',
                  border: '1px solid #dadce0',
                  width: '360px',
                  padding: '10px 0',
                  zIndex: 90
                }}>
                  <div style={{ padding: '4px 16px 8px 16px', borderBottom: '1px solid #f1f3f4', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#1f1f1f' }}>
                      Thông báo ({pendingInvitations.length + upcomingMeetings.length})
                    </span>
                    <span style={{ fontSize: '12px', color: '#1a73e8', cursor: 'pointer', fontWeight: '500' }} onClick={() => setShowNotificationsModal(false)}>Đóng</span>
                  </div>

                  {pendingInvitations.length === 0 && upcomingMeetings.length === 0 ? (
                    <div style={{ padding: '28px 16px', textAlign: 'center', color: '#70757a', fontSize: '13px' }}>
                      <Bell size={28} color="#cbd5e1" style={{ margin: '0 auto 8px auto' }} />
                      <div>Không có thông báo hoặc lời mời cuộc họp nào mới</div>
                    </div>
                  ) : (
                    <div style={{ maxHeight: '360px', overflowY: 'auto' }}>
                      {/* Danh sách lời mời họp cần xác nhận */}
                      {pendingInvitations.length > 0 && (
                        <div>
                          <div style={{ padding: '8px 16px', backgroundColor: '#fef3c7', fontSize: '11px', fontWeight: 'bold', color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Mail size={13} color="#b45309" />
                            <span>Lời mời cuộc họp ({pendingInvitations.length})</span>
                          </div>
                          {pendingInvitations.map(m => {
                            const st = new Date(m.start_time);
                            const et = new Date(m.end_time);
                            return (
                              <div
                                key={`inv-${m.meeting_id}`}
                                style={{ padding: '10px 16px', borderBottom: '1px solid #fef3c7', backgroundColor: '#fffbeb' }}
                              >
                                <div
                                  onClick={() => {
                                    setSelectedMeeting(m);
                                    setShowDetailModal(true);
                                    setShowNotificationsModal(false);
                                  }}
                                  style={{ cursor: 'pointer' }}
                                >
                                  <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#1e293b' }}>{m.title}</div>
                                  <div style={{ fontSize: '11px', color: '#b45309', fontWeight: '600', marginTop: '2px' }}>
                                    📬 Người mời: {m.organizer?.full_name || 'Người tổ chức'}
                                  </div>
                                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                                    {m.room?.room_name || 'Trực tuyến'} • {st.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {et.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ({st.toLocaleDateString('vi-VN')})
                                  </div>
                                </div>
                                <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                                  <button
                                    onClick={() => handleRespondRsvp(m.meeting_id, 'ACCEPTED')}
                                    style={{ flex: 1, padding: '5px 10px', borderRadius: '6px', border: 'none', backgroundColor: '#16a34a', color: '#ffffff', fontWeight: '600', fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                                    className="hover:bg-green-700"
                                  >
                                    <Check size={13} /> Đồng ý
                                  </button>
                                  <button
                                    onClick={() => handleRespondRsvp(m.meeting_id, 'DECLINED')}
                                    style={{ flex: 1, padding: '5px 10px', borderRadius: '6px', border: 'none', backgroundColor: '#dc2626', color: '#ffffff', fontWeight: '600', fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                                    className="hover:bg-red-700"
                                  >
                                    <X size={13} /> Từ chối
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Danh sách cuộc họp sắp/đang diễn ra */}
                      {upcomingMeetings.length > 0 && (
                        <div>
                          <div style={{ padding: '8px 16px', backgroundColor: '#f8fafc', fontSize: '11px', fontWeight: 'bold', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Clock size={13} color="#64748b" />
                            <span>Cuộc họp đang & sắp diễn ra ({upcomingMeetings.length})</span>
                          </div>
                          {upcomingMeetings.map(m => {
                            const st = new Date(m.start_time);
                            const et = new Date(m.end_time);
                            const now = getVietnamNow();
                            const isInProgress = now >= st && now <= et;
                            const diffM = Math.round((st.getTime() - now.getTime()) / (1000 * 60));
                            return (
                              <div
                                key={m.meeting_id}
                                onClick={() => {
                                  setSelectedMeeting(m);
                                  setShowDetailModal(true);
                                  setShowNotificationsModal(false);
                                }}
                                style={{ padding: '10px 16px', borderBottom: '1px solid #f8fafc', cursor: 'pointer' }}
                                className="hover:bg-blue-50"
                              >
                                <div style={{ fontSize: '13px', fontWeight: '600', color: '#1f1f1f' }}>{m.title}</div>
                                <div style={{ fontSize: '12px', color: isInProgress ? '#16a34a' : '#ea4335', fontWeight: '600', marginTop: '2px' }}>
                                  {isInProgress ? '🟢 Đang diễn ra' : `🔔 Bắt đầu sau ${diffM} phút`}
                                </div>
                                <div style={{ fontSize: '11px', color: '#5f6368', marginTop: '2px' }}>
                                  {m.room?.room_name || 'Google Meet'} • {st.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {et.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* View Mode Dropdown (Tuần ▾ / Ngày ▾ / Tháng ▾ - Screenshot 5) */}
            {activeAppMode === 'calendar' && (
              <div ref={viewDropdownRef} style={{ position: 'relative' }}>
                <button
                  onClick={() => setShowViewDropdown(prev => !prev)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 16px',
                    border: '1px solid #dadce0',
                    borderRadius: '4px',
                    backgroundColor: 'white',
                    color: '#3c4043',
                    fontSize: '14px',
                    fontWeight: '500',
                    cursor: 'pointer'
                  }}
                  className="hover:bg-slate-50"
                >
                  <span>{viewMode}</span>
                  <ChevronDown size={14} color="#5f6368" />
                </button>

                {/* Menu View Switcher chi tiết (Screenshot 5) */}
                {showViewDropdown && (
                  <div style={{
                    position: 'absolute',
                    top: 'calc(100% + 4px)',
                    right: 0,
                    backgroundColor: 'white',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
                    borderRadius: '8px',
                    border: '1px solid #dadce0',
                    width: '240px',
                    padding: '8px 0',
                    zIndex: 80
                  }}>
                    {[
                      { id: 'Ngày', label: 'Ngày', shortcut: 'D' },
                      { id: 'Tuần', label: 'Tuần', shortcut: 'W' },
                      { id: 'Tháng', label: 'Tháng', shortcut: 'M' },
                      { id: '4 ngày', label: '4 ngày', shortcut: 'X' },
                    ].map(item => (
                      <button
                        key={item.id}
                        onClick={() => {
                          setViewMode(item.id as any);
                          setShowViewDropdown(false);
                        }}
                        style={{
                          width: '100%',
                          padding: '8px 20px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          border: 'none',
                          backgroundColor: viewMode === item.id ? '#f1f3f4' : 'transparent',
                          color: '#3c4043',
                          fontSize: '14px',
                          cursor: 'pointer',
                          textAlign: 'left'
                        }}
                        className="hover:bg-slate-100"
                      >
                        <span>{item.label}</span>
                        <span style={{ color: '#70757a', fontSize: '13px' }}>{item.shortcut}</span>
                      </button>
                    ))}

                    <div style={{ height: '1px', backgroundColor: '#e8eaed', margin: '6px 0' }}></div>

                    {/* Checkboxes cấu hình hiển thị */}
                    <div
                      onClick={() => setShowWeekends(prev => !prev)}
                      style={{ padding: '8px 20px', display: 'flex', alignItems: 'center', gap: '12px', fontSize: '13px', color: '#3c4043', cursor: 'pointer' }}
                      className="hover:bg-slate-100"
                    >
                      <span style={{ width: '16px', display: 'inline-block' }}>{showWeekends && <Check size={16} color="#1a73e8" />}</span>
                      <span>Hiển thị các ngày cuối tuần</span>
                    </div>

                    <div
                      onClick={() => setShowDeclined(prev => !prev)}
                      style={{ padding: '8px 20px', display: 'flex', alignItems: 'center', gap: '12px', fontSize: '13px', color: '#3c4043', cursor: 'pointer' }}
                      className="hover:bg-slate-100"
                    >
                      <span style={{ width: '16px', display: 'inline-block' }}>{showDeclined && <Check size={16} color="#1a73e8" />}</span>
                      <span>Hiển thị sự kiện bị từ chối</span>
                    </div>

                    <div
                      onClick={() => setShowCompletedTasks(prev => !prev)}
                      style={{ padding: '8px 20px', display: 'flex', alignItems: 'center', gap: '12px', fontSize: '13px', color: '#3c4043', cursor: 'pointer' }}
                      className="hover:bg-slate-100"
                    >
                      <span style={{ width: '16px', display: 'inline-block' }}>{showCompletedTasks && <Check size={16} color="#1a73e8" />}</span>
                      <span>Hiển thị những việc cần làm đã hoàn tất</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Toggle Button Nhóm: Lịch / Việc cần làm (Screenshot 1, 4, 5) */}
            <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #dadce0', borderRadius: '4px', overflow: 'hidden', marginLeft: '4px' }}>
              <button
                onClick={() => setActiveAppMode('calendar')}
                style={{
                  padding: '7px 12px',
                  border: 'none',
                  backgroundColor: activeAppMode === 'calendar' ? '#c2e7ff' : '#ffffff',
                  color: activeAppMode === 'calendar' ? '#001d35' : '#5f6368',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center'
                }}
                title="Lịch"
              >
                <CalendarIcon size={16} />
              </button>
              <button
                onClick={() => setActiveAppMode('tasks')}
                style={{
                  padding: '7px 12px',
                  border: 'none',
                  backgroundColor: activeAppMode === 'tasks' ? '#c2e7ff' : '#ffffff',
                  color: activeAppMode === 'tasks' ? '#001d35' : '#5f6368',
                  borderLeft: '1px solid #dadce0',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center'
                }}
                title="Việc cần làm"
              >
                <CheckSquare size={16} />
              </button>
            </div>

            {/* 9 Dots Google Apps icon kèm Dropdown (Neo chuẩn xác) */}
            <div ref={appsDropdownRef} style={{ position: 'relative' }}>
              <button
                onClick={() => {
                  setShowAppsDropdown(prev => !prev);
                  setShowProfileDropdown(false);
                  setShowSettingsDropdown(false);
                  setShowHelpDropdown(false);
                }}
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  border: 'none',
                  background: showAppsDropdown ? '#e8eaed' : 'transparent',
                  cursor: 'pointer',
                  color: '#5f6368',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                className="hover:bg-slate-100 transition-colors"
                title="Các ứng dụng Google"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="#5f6368">
                  <circle cx="5" cy="5" r="2" /><circle cx="12" cy="5" r="2" /><circle cx="19" cy="5" r="2" />
                  <circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" />
                  <circle cx="5" cy="19" r="2" /><circle cx="12" cy="19" r="2" /><circle cx="19" cy="19" r="2" />
                </svg>
              </button>
              {renderAppsDropdown()}
            </div>

            {/* Viên nhộng đôi 2 logo/ảnh (Capsule Badge - Khớp 100% Ảnh 1 & 2) */}
            <div ref={profileDropdownRef} style={{ position: 'relative' }}>
              <div
                onClick={() => {
                  setShowProfileDropdown(prev => !prev);
                  setShowAppsDropdown(false);
                  setShowSettingsDropdown(false);
                  setShowHelpDropdown(false);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '2px 4px 2px 2px',
                  borderRadius: '9999px',
                  border: '1px solid #747775',
                  gap: '6px',
                  marginLeft: '4px',
                  cursor: 'pointer',
                  backgroundColor: showProfileDropdown ? '#edf2fa' : '#ffffff',
                  boxShadow: showProfileDropdown ? '0 1px 4px rgba(0,0,0,0.2)' : 'none',
                  transition: 'box-shadow 0.15s, background-color 0.15s'
                }}
                className="hover:shadow-sm hover:bg-slate-50"
                title={`Tài khoản: ${activeAccount.fullName} (${activeAccount.email})`}
              >
                {/* Huy hiệu ICTU chuẩn xanh đậm chữ trắng sắc nét (Khớp Ảnh 1) */}
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  backgroundColor: '#0066b2',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffffff',
                  fontSize: '11px',
                  fontWeight: 'bold',
                  letterSpacing: '0.2px',
                  flexShrink: 0
                }}>
                  ICTU
                </div>

                {/* Avatar người dùng */}
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: '#1a73e8',
                  flexShrink: 0
                }}>
                  <img
                    src={activeAccount.avatar || '/hoang_phuong_avatar.png'}
                    alt="Avatar"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '/hoang_phuong_avatar.png';
                    }}
                  />
                </div>
              </div>

              {/* Google Profile Dropdown Popover (Ảnh 2) */}
              {renderProfileDropdown()}
            </div>
          </div>
        </header>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          1.0. BANNER LỜI MỜI CUỘC HỌP CẦN XÁC NHẬN
          ══════════════════════════════════════════════════════════════════════ */}
      {pendingInvitations.length > 0 && (
        <div style={{
          backgroundColor: '#fef3c7',
          borderBottom: '1px solid #fde68a',
          padding: '10px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '13px',
          color: '#92400e',
          zIndex: 40
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: '#f59e0b', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Mail size={16} />
            </div>
            <div>
              <span style={{ fontWeight: 'bold' }}>📬 Lời mời tham gia cuộc họp ({pendingInvitations.length}): </span>
              <span>"{pendingInvitations[0].title}" ({new Date(pendingInvitations[0].start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ngày {new Date(pendingInvitations[0].start_time).toLocaleDateString('vi-VN')}) từ {pendingInvitations[0].organizer?.full_name || 'Người tổ chức'}</span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={() => handleRespondRsvp(pendingInvitations[0].meeting_id, 'ACCEPTED')}
              style={{ padding: '6px 14px', borderRadius: '6px', border: 'none', backgroundColor: '#16a34a', color: '#ffffff', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
              className="hover:bg-green-700 shadow-sm"
            >
              <Check size={14} /> Đồng ý tham gia
            </button>
            <button
              onClick={() => handleRespondRsvp(pendingInvitations[0].meeting_id, 'DECLINED')}
              style={{ padding: '6px 14px', borderRadius: '6px', border: 'none', backgroundColor: '#dc2626', color: '#ffffff', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
              className="hover:bg-red-700 shadow-sm"
            >
              <X size={14} /> Từ chối
            </button>
            <button
              onClick={() => { setSelectedMeeting(pendingInvitations[0]); setShowDetailModal(true); }}
              style={{ padding: '5px 12px', borderRadius: '6px', border: '1px solid #d97706', backgroundColor: '#ffffff', color: '#b45309', fontWeight: '500', fontSize: '12px', cursor: 'pointer' }}
              className="hover:bg-amber-50"
            >
              Chi tiết
            </button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          1.1. BANNER NHẮC NHỞ CUỘC HỌP SẮP DIỄN RA (US #16)
          ══════════════════════════════════════════════════════════════════════ */}
      {upcomingMeetings.length > 0 && showUpcomingBanner && (
        <div style={{
          backgroundColor: '#e8f0fe',
          borderBottom: '1px solid #c2e7ff',
          padding: '10px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '13px',
          color: '#1a73e8',
          zIndex: 40
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: '#1a73e8', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Bell size={16} />
            </div>
            <div>
              <span style={{ fontWeight: 'bold' }}>
                {new Date() >= new Date(upcomingMeetings[0].start_time) && new Date() <= new Date(upcomingMeetings[0].end_time) ? '🟢 Cuộc họp đang diễn ra: ' : '🔔 Nhắc nhở họp: '}
              </span>
              <span>"{upcomingMeetings[0].title}" ({new Date(upcomingMeetings[0].start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(upcomingMeetings[0].end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}) tại {upcomingMeetings[0].room?.room_name || 'Google Meet'}</span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={() => { setSelectedMeeting(upcomingMeetings[0]); setShowDetailModal(true); }}
              style={{ padding: '5px 14px', borderRadius: '6px', border: 'none', backgroundColor: '#1a73e8', color: '#ffffff', fontWeight: '500', fontSize: '12px', cursor: 'pointer' }}
              className="hover:bg-blue-700"
            >
              Xem chi tiết
            </button>
            <button
              onClick={() => setShowUpcomingBanner(false)}
              style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#5f6368', padding: '4px' }}
              title="Đóng thông báo"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          2. BODY: GOOGLE TASKS VIEW (IMAGE 5) HOẶC GOOGLE CALENDAR VIEW (IMAGE 1)
          ══════════════════════════════════════════════════════════════════════ */}
      {activeAppMode === 'tasks' ? (
        /* ── GOOGLE TASKS VIEW (KHỚP CHÍNH XÁC SCREENSHOT 5) ── */
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden', backgroundColor: '#ffffff' }}>

          {/* Sidebar Google Tasks */}
          {showSidebar && (
            <aside style={{
              width: '260px',
              backgroundColor: '#ffffff',
              borderRight: '1px solid #dadce0',
              display: 'flex',
              flexDirection: 'column',
              padding: '16px 16px 24px 16px',
              overflowY: 'auto',
              flexShrink: 0
            }}>
              {/* Nút "+ Tạo" chuẩn Google Tasks (Screenshot 5) */}
              <button
                onClick={() => {
                  setIsAddingTask(true);
                  setTaskFilter('my-tasks');
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '0 24px 0 16px',
                  height: '56px',
                  borderRadius: '28px',
                  border: 'none',
                  backgroundColor: '#ffffff',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24)',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#3c4043',
                  marginBottom: '20px',
                  transition: 'box-shadow 0.2s'
                }}
                className="hover:shadow-md"
              >
                <div style={{ width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="32" height="32" viewBox="0 0 36 36">
                    <path fill="#4285F4" d="M16 16v14h4V16h14v-4H20V-2h-4v14H2v4h14z" />
                    <path fill="#34A853" d="M30 16H20l-4-4h14z" />
                    <path fill="#FBBC05" d="M6 16h10l4 4H6z" />
                    <path fill="#EA4335" d="M20 16v14l-4-4V16z" />
                  </svg>
                </div>
                <span style={{ fontSize: '14px', fontWeight: '500', color: '#3c4043' }}>Tạo</span>
              </button>

              {/* Menu items */}
              {/* Tất cả việc cần làm (Screenshot 5: viền bo tròn pill, nền xanh nhạt #c2e7ff) */}
              <div
                onClick={() => setTaskFilter('all')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  padding: '10px 16px',
                  borderRadius: '9999px',
                  cursor: 'pointer',
                  backgroundColor: taskFilter === 'all' ? '#c2e7ff' : 'transparent',
                  color: taskFilter === 'all' ? '#001d35' : '#444746',
                  fontWeight: taskFilter === 'all' ? '600' : '400',
                  fontSize: '14px',
                  marginBottom: '4px'
                }}
                className="hover:bg-slate-100"
              >
                <CheckCircle2 size={20} color={taskFilter === 'all' ? '#001d35' : '#444746'} />
                <span style={{ flex: 1 }}>Tất cả việc cần làm</span>
                <span style={{ fontSize: '12px', color: '#5f6368' }}>{tasks.filter(t => !t.completed).length}</span>
              </div>

              {/* Có gắn dấu sao */}
              <div
                onClick={() => setTaskFilter('starred')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  padding: '10px 16px',
                  borderRadius: '9999px',
                  cursor: 'pointer',
                  backgroundColor: taskFilter === 'starred' ? '#c2e7ff' : 'transparent',
                  color: taskFilter === 'starred' ? '#001d35' : '#444746',
                  fontWeight: taskFilter === 'starred' ? '600' : '400',
                  fontSize: '14px',
                  marginBottom: '16px'
                }}
                className="hover:bg-slate-100"
              >
                <Star size={20} color={taskFilter === 'starred' ? '#001d35' : '#444746'} />
                <span style={{ flex: 1 }}>Có gắn dấu sao</span>
                <span style={{ fontSize: '12px', color: '#5f6368' }}>{tasks.filter(t => t.starred && !t.completed).length}</span>
              </div>

              {/* Danh sách header (Screenshot 5: Danh sách ˄) */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 16px',
                fontSize: '11px',
                fontWeight: 'bold',
                color: '#70757a',
                letterSpacing: '0.05em'
              }}>
                <span>DANH SÁCH</span>
                <ChevronUp size={16} color="#70757a" />
              </div>

              {/* Việc cần làm của tôi (Screenshot 5: checkbox icon) */}
              <div
                onClick={() => setTaskFilter('my-tasks')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  padding: '10px 16px',
                  borderRadius: '9999px',
                  cursor: 'pointer',
                  backgroundColor: taskFilter === 'my-tasks' ? '#c2e7ff' : 'transparent',
                  color: taskFilter === 'my-tasks' ? '#001d35' : '#444746',
                  fontWeight: taskFilter === 'my-tasks' ? '600' : '400',
                  fontSize: '14px',
                  marginBottom: '4px'
                }}
                className="hover:bg-slate-100"
              >
                <CheckSquare size={18} color="#1a73e8" />
                <span style={{ flex: 1 }}>Việc cần làm của tôi</span>
              </div>

              {/* + Tạo danh sách mới (Screenshot 5) */}
              <div
                onClick={() => {
                  const listName = prompt('Nhập tên danh sách việc cần làm mới:');
                  if (listName) {
                    alert(`Đã tạo danh sách: "${listName}" thành công!`);
                  }
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  padding: '10px 16px',
                  borderRadius: '9999px',
                  cursor: 'pointer',
                  color: '#444746',
                  fontSize: '14px',
                  marginTop: '4px'
                }}
                className="hover:bg-slate-100"
              >
                <Plus size={18} color="#5f6368" />
                <span>Tạo danh sách mới</span>
              </div>
            </aside>
          )}

          {/* Main Tasks Area (Screenshot 5) */}
          <main style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '24px 36px', overflowY: 'auto' }}>
            {/* Header: Title + 3-dot menu */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h1 style={{ fontSize: '24px', fontWeight: '500', color: '#1f1f1f', margin: 0 }}>
                {taskFilter === 'starred' ? 'Có gắn dấu sao' : taskFilter === 'all' ? 'Tất cả việc cần làm' : 'Việc cần làm của tôi'}
              </h1>
              <button
                onClick={() => {
                  if (confirm('Xóa tất cả các công việc đã hoàn tất trong danh sách này?')) {
                    setTasks(prev => prev.filter(t => !t.completed));
                  }
                }}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#5f6368', padding: '8px', borderRadius: '50%' }}
                className="hover:bg-slate-100"
                title="Tùy chọn danh sách"
              >
                <MoreVertical size={20} />
              </button>
            </div>

            {/* Nút: + Thêm việc cần làm (Screenshot 5) */}
            <div style={{ marginBottom: '16px' }}>
              {!isAddingTask ? (
                <button
                  onClick={() => setIsAddingTask(true)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    border: 'none',
                    background: 'transparent',
                    color: '#1a73e8',
                    fontSize: '14px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    padding: '8px 12px',
                    borderRadius: '8px'
                  }}
                  className="hover:bg-blue-50"
                >
                  <Plus size={20} color="#1a73e8" />
                  <span>Thêm việc cần làm</span>
                </button>
              ) : (
                /* Card thêm việc cần làm inline chuẩn Google Workspace */
                <div style={{
                  backgroundColor: '#ffffff',
                  border: '1px solid #dadce0',
                  borderRadius: '12px',
                  padding: '16px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                  marginBottom: '16px',
                  maxWidth: '680px'
                }}>
                  <input
                    type="text"
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    placeholder="Tiêu đề việc cần làm..."
                    autoFocus
                    style={{
                      width: '100%',
                      border: 'none',
                      outline: 'none',
                      fontSize: '15px',
                      fontWeight: '500',
                      color: '#1f1f1f',
                      marginBottom: '8px'
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAddNewTask();
                    }}
                  />
                  <textarea
                    value={newTaskNotes}
                    onChange={(e) => setNewTaskNotes(e.target.value)}
                    placeholder="Chi tiết công việc..."
                    rows={2}
                    style={{
                      width: '100%',
                      border: 'none',
                      outline: 'none',
                      fontSize: '13px',
                      color: '#5f6368',
                      resize: 'none',
                      marginBottom: '12px',
                      fontFamily: 'inherit'
                    }}
                  />
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #f1f3f4', paddingTop: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <CalendarIcon size={16} color="#5f6368" />
                      <input
                        type="date"
                        value={newTaskDueDate}
                        onChange={(e) => setNewTaskDueDate(e.target.value)}
                        style={{
                          border: '1px solid #dadce0',
                          borderRadius: '6px',
                          padding: '4px 8px',
                          fontSize: '12px',
                          color: '#3c4043',
                          outline: 'none'
                        }}
                      />
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => {
                          setIsAddingTask(false);
                          setNewTaskTitle('');
                          setNewTaskNotes('');
                        }}
                        style={{ padding: '6px 16px', border: 'none', background: 'transparent', color: '#5f6368', fontSize: '13px', fontWeight: '500', cursor: 'pointer', borderRadius: '4px' }}
                        className="hover:bg-slate-100"
                      >
                        Hủy
                      </button>
                      <button
                        onClick={handleAddNewTask}
                        disabled={!newTaskTitle.trim()}
                        style={{
                          padding: '6px 20px',
                          border: 'none',
                          backgroundColor: newTaskTitle.trim() ? '#1a73e8' : '#dadce0',
                          color: '#ffffff',
                          fontSize: '13px',
                          fontWeight: '500',
                          cursor: newTaskTitle.trim() ? 'pointer' : 'not-allowed',
                          borderRadius: '9999px'
                        }}
                      >
                        Lưu
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Danh sách công việc đang chờ làm */}
            <div style={{ maxWidth: '680px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {tasks
                .filter(t => !t.completed)
                .filter(t => taskFilter === 'all' ? true : taskFilter === 'starred' ? t.starred : true)
                .map(task => (
                  <div
                    key={task.id}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '12px',
                      padding: '12px 14px',
                      borderRadius: '8px',
                      backgroundColor: '#ffffff',
                      border: '1px solid #f1f3f4',
                      transition: 'all 0.15s'
                    }}
                    className="hover:bg-slate-50 hover:border-slate-300 group"
                  >
                    {/* Checkbox tròn kiểu Google Tasks */}
                    <button
                      onClick={() => handleToggleTaskComplete(task.id)}
                      style={{
                        width: '20px',
                        height: '20px',
                        borderRadius: '50%',
                        border: '2px solid #5f6368',
                        background: 'transparent',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginTop: '2px',
                        flexShrink: 0
                      }}
                      className="hover:border-blue-600"
                      title="Đánh dấu đã hoàn thành"
                    >
                    </button>

                    {/* Nội dung công việc */}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '14px', fontWeight: '500', color: '#1f1f1f', lineHeight: 1.4 }}>
                        {task.title}
                      </div>
                      {task.notes && (
                        <div style={{ fontSize: '12px', color: '#5f6368', marginTop: '4px', lineHeight: 1.4 }}>
                          {task.notes}
                        </div>
                      )}
                      {task.dueDate && (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '4px', backgroundColor: '#e8f0fe', color: '#1a73e8', fontSize: '11px', fontWeight: '500', marginTop: '6px' }}>
                          <Clock size={12} />
                          <span>{task.dueDate}</span>
                        </div>
                      )}
                    </div>

                    {/* Nút hành động: Ngôi sao + Xóa */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <button
                        onClick={() => handleToggleTaskStar(task.id)}
                        style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '6px', color: task.starred ? '#f4b400' : '#c4c7c5' }}
                        title={task.starred ? 'Bỏ gắn dấu sao' : 'Gắn dấu sao'}
                      >
                        <Star size={18} fill={task.starred ? '#f4b400' : 'none'} />
                      </button>
                      <button
                        onClick={() => handleDeleteTask(task.id)}
                        style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '6px', color: '#5f6368', opacity: 0 }}
                        className="group-hover:opacity-100 hover:text-red-600 transition-opacity"
                        title="Xóa công việc"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
            </div>

            {/* Empty state nếu không có công việc nào (Khớp 100% hình vẽ Screenshot 5) */}
            {tasks.filter(t => !t.completed).filter(t => taskFilter === 'all' ? true : taskFilter === 'starred' ? t.starred : true).length === 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', textAlign: 'center', maxWidth: '680px' }}>
                {/* SVG Illustration bảng kẹp hồ sơ + checkmark chuẩn Google Tasks Screenshot 5 */}
                <svg width="220" height="150" viewBox="0 0 220 150" fill="none">
                  {/* Bàn / đường nền */}
                  <line x1="20" y1="130" x2="200" y2="130" stroke="#dadce0" strokeWidth="2" strokeLinecap="round" />
                  {/* Tờ giấy / thư mục */}
                  <rect x="75" y="45" width="70" height="85" rx="6" fill="#ffffff" stroke="#5f6368" strokeWidth="1.5" />
                  <line x1="90" y1="70" x2="130" y2="70" stroke="#dadce0" strokeWidth="2" strokeLinecap="round" />
                  <line x1="90" y1="85" x2="125" y2="85" stroke="#dadce0" strokeWidth="2" strokeLinecap="round" />
                  <line x1="90" y1="100" x2="115" y2="100" stroke="#dadce0" strokeWidth="2" strokeLinecap="round" />
                  {/* Kẹp giấy xanh lá cây */}
                  <rect x="85" y="38" width="50" height="12" rx="4" fill="#a8dab5" />
                  {/* Chấm tròn checkmark màu hồng nhạt */}
                  <circle cx="65" cy="52" r="16" fill="#fce8e6" />
                  <path d="M59 52l4 4 8-8" stroke="#ea4335" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  {/* Đỉnh núi / hồ sơ xanh dương & vàng */}
                  <path d="M95 130l20-40 20 40H95z" fill="#c2e7ff" opacity="0.7" />
                  <circle cx="120" cy="98" r="8" fill="#fef7e0" />
                  <circle cx="120" cy="98" r="5" fill="#f9ab00" />
                </svg>

                <h3 style={{ fontSize: '18px', fontWeight: '500', color: '#1f1f1f', marginTop: '16px', marginBottom: '8px' }}>
                  Chưa có việc cần làm
                </h3>
                <p style={{ fontSize: '13px', color: '#5f6368', maxWidth: '360px', margin: 0, lineHeight: 1.5 }}>
                  Thêm những việc bạn cần làm và theo dõi những việc cần làm đó trên Google Workspace
                </p>
              </div>
            )}

            {/* Mục: Đã hoàn tất (N) */}
            {tasks.filter(t => t.completed).length > 0 && (
              <div style={{ marginTop: '24px', maxWidth: '680px' }}>
                <div
                  onClick={() => setShowCompletedTasksSection(prev => !prev)}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', padding: '8px 4px', fontSize: '13px', fontWeight: '500', color: '#5f6368' }}
                >
                  <ChevronDown size={16} style={{ transform: showCompletedTasksSection ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.2s' }} />
                  <span>Đã hoàn tất ({tasks.filter(t => t.completed).length})</span>
                </div>

                {showCompletedTasksSection && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '8px' }}>
                    {tasks.filter(t => t.completed).map(task => (
                      <div
                        key={task.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          padding: '10px 14px',
                          borderRadius: '8px',
                          backgroundColor: '#f8f9fa',
                          border: '1px solid #f1f3f4'
                        }}
                      >
                        <button
                          onClick={() => handleToggleTaskComplete(task.id)}
                          style={{
                            width: '20px',
                            height: '20px',
                            borderRadius: '50%',
                            backgroundColor: '#1a73e8',
                            border: 'none',
                            color: 'white',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                          }}
                          title="Hoàn tác hoàn thành"
                        >
                          <Check size={12} strokeWidth={3} />
                        </button>
                        <div style={{ flex: 1, fontSize: '14px', color: '#70757a', textDecoration: 'line-through' }}>
                          {task.title}
                        </div>
                        <button
                          onClick={() => handleDeleteTask(task.id)}
                          style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '6px', color: '#70757a' }}
                          title="Xóa vĩnh viễn"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </main>
        </div>
      ) : (
        /* ── GOOGLE CALENDAR VIEW (SCREENSHOT 1) ── */
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

          {/* ── SIDEBAR TRÁI (GOOGLE CALENDAR STYLE - HỖ TRỢ RESPONSIVE MOBILE US #17) ── */}
          {showSidebar && (
            <>
              {isMobile && (
                <div
                  onClick={() => setShowSidebar(false)}
                  style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 140 }}
                />
              )}
              <aside style={{
                width: isMobile ? '280px' : '260px',
                backgroundColor: '#ffffff',
                display: 'flex',
                flexDirection: 'column',
                padding: '16px 16px 24px 16px',
                overflowY: 'auto',
                flexShrink: 0,
                position: isMobile ? 'fixed' : 'relative',
                top: isMobile ? 0 : undefined,
                left: isMobile ? 0 : undefined,
                bottom: isMobile ? 0 : undefined,
                zIndex: isMobile ? 150 : undefined,
                boxShadow: isMobile ? '0 10px 25px rgba(0,0,0,0.3)' : 'none'
              }}>
                {isMobile && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8px' }}>
                    <button onClick={() => setShowSidebar(false)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '6px' }} title="Đóng menu">
                      <X size={20} color="#5f6368" />
                    </button>
                  </div>
                )}

                {/* Nút "+ Tạo ▾" lớn (Pill Button nổi tiếng - Screenshot 1 & 2) */}
                <div ref={createDropdownRef} style={{ position: 'relative', marginBottom: '20px' }}>
                  <button
                    onClick={() => setShowCreateDropdown(prev => !prev)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '10px 24px 10px 16px',
                      borderRadius: '9999px',
                      backgroundColor: '#ffffff',
                      color: '#3c4043',
                      border: '1px solid #dadce0',
                      boxShadow: '0 1px 3px 0 rgba(60,64,67,0.3), 0 4px 8px 3px rgba(60,64,67,0.15)',
                      cursor: 'pointer',
                      fontWeight: '500',
                      fontSize: '14px',
                      transition: 'all 0.2s ease'
                    }}
                    className="hover:shadow-lg hover:bg-slate-50 active:scale-95"
                  >
                    {/* Google Plus 4-color icon */}
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                      <path d="M12 5V19" stroke="#EA4335" strokeWidth="3" strokeLinecap="round" />
                      <path d="M5 12H19" stroke="#4285F4" strokeWidth="3" strokeLinecap="round" />
                      <circle cx="12" cy="12" r="1.5" fill="#FBBC05" />
                    </svg>
                    <span>Tạo</span>
                    <ChevronDown size={14} color="#5f6368" />
                  </button>

                  {/* Dropdown Menu "+ Tạo" (Khớp Screenshot 2) */}
                  {showCreateDropdown && (
                    <div style={{
                      position: 'absolute',
                      top: 'calc(100% + 6px)',
                      left: 0,
                      backgroundColor: 'white',
                      borderRadius: '12px',
                      boxShadow: '0 4px 20px rgba(0,0,0,0.18)',
                      border: '1px solid #dadce0',
                      width: '210px',
                      padding: '8px 0',
                      zIndex: 80
                    }}>
                      {[
                        { label: 'Sự kiện', icon: <CalendarDays size={18} color="#1a73e8" /> },
                        { label: 'Nhiệm vụ', icon: <CheckSquare size={18} color="#1a73e8" /> },
                        { label: 'Không có mặt tại văn phòng', icon: <Coffee size={18} color="#ea4335" /> },
                        { label: 'Thời gian tập trung', icon: <Clock size={18} color="#fbbc05" /> },
                        { label: 'Địa điểm làm việc', icon: <Briefcase size={18} color="#34a853" /> },
                        { label: 'Lên lịch hẹn', icon: <Bookmark size={18} color="#1a73e8" /> },
                      ].map((item, idx) => (
                        <div
                          key={idx}
                          onClick={() => {
                            setCreateType(item.label);
                            handleOpenCreateModal();
                          }}
                          style={{
                            padding: '10px 16px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            fontSize: '14px',
                            color: '#3c4043',
                            cursor: 'pointer'
                          }}
                          className="hover:bg-slate-100"
                        >
                          {item.icon}
                          <span>{item.label}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Nút xem lịch sử cuộc họp (US #6) */}
                <div
                  onClick={handleOpenHistoryModal}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '8px 14px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    color: '#1a73e8',
                    backgroundColor: '#f0f7ff',
                    fontWeight: '500',
                    fontSize: '13px',
                    marginBottom: '18px',
                    border: '1px solid #d2e3fc',
                    transition: 'all 0.15s'
                  }}
                  className="hover:bg-blue-100 shadow-sm"
                  title="Xem danh sách các cuộc họp đã tham gia"
                >
                  <BookOpen size={16} color="#1a73e8" />
                  <span>Lịch sử cuộc họp đã tham gia</span>
                </div>

                {/* Mini Calendar tháng 10, 2026 (Khớp Screenshot 1) */}
                <div style={{ marginBottom: '24px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px 8px 4px' }}>
                    <span style={{ fontSize: '14px', fontWeight: '500', color: '#3c4043' }}>
                      Tháng {miniCalMonth.getMonth() + 1}, {miniCalMonth.getFullYear()}
                    </span>
                    <div style={{ display: 'flex', gap: '2px' }}>
                      <button
                        onClick={() => {
                          const d = new Date(miniCalMonth);
                          d.setMonth(d.getMonth() - 1);
                          setMiniCalMonth(d);
                        }}
                        style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '4px', borderRadius: '50%', color: '#5f6368' }}
                        className="hover:bg-slate-100"
                      >
                        <ChevronLeft size={16} />
                      </button>
                      <button
                        onClick={() => {
                          const d = new Date(miniCalMonth);
                          d.setMonth(d.getMonth() + 1);
                          setMiniCalMonth(d);
                        }}
                        style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '4px', borderRadius: '50%', color: '#5f6368' }}
                        className="hover:bg-slate-100"
                      >
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  </div>

                  {/* Thứ: Cn, T2, T3, T4, T5, T6, T7 */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', textAlign: 'center', marginBottom: '4px' }}>
                    {['Cn', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'].map((d, i) => (
                      <span key={i} style={{ fontSize: '11px', color: '#70757a', fontWeight: '500' }}>{d}</span>
                    ))}
                  </div>

                  {/* Lưới các ngày trong tháng */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', textAlign: 'center', rowGap: '2px' }}>
                    {getMiniCalendarDays().map((item, idx) => {
                      const is16 = item.date.getDate() === 16 && item.date.getMonth() === 9;
                      const isSelected = item.date.getDate() === currentDate.getDate() && item.date.getMonth() === currentDate.getMonth();

                      return (
                        <button
                          key={idx}
                          onClick={() => {
                            setCurrentDate(item.date);
                          }}
                          style={{
                            width: '28px',
                            height: '28px',
                            margin: '0 auto',
                            borderRadius: '50%',
                            border: 'none',
                            backgroundColor: is16 ? '#1a73e8' : isSelected ? '#d2e3fc' : 'transparent',
                            color: is16 ? '#ffffff' : !item.isCurrentMonth ? '#bdc1c6' : '#3c4043',
                            fontSize: '12px',
                            fontWeight: is16 ? 'bold' : 'normal',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'background-color 0.15s'
                          }}
                          className={!is16 && !isSelected ? 'hover:bg-slate-100' : ''}
                        >
                          {item.day}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Mục: "Gặp gỡ với..." & "Tìm người" (Khớp 100% Screenshot 1 & 3) */}
                <div ref={userSearchRef} style={{ position: 'relative', marginBottom: '24px' }}>
                  <div style={{ fontSize: '14px', fontWeight: '500', color: '#3c4043', marginBottom: '8px' }}>
                    Gặp gỡ với...
                  </div>

                  <div
                    onClick={() => setShowUserSearchDropdown(true)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '8px 12px',
                      backgroundColor: '#f1f3f4',
                      borderRadius: '8px',
                      cursor: 'text'
                    }}
                  >
                    <Users size={18} color="#5f6368" />
                    <input
                      type="text"
                      placeholder="Tìm người"
                      value={userSearchTerm}
                      onFocus={() => setShowUserSearchDropdown(true)}
                      onChange={(e) => {
                        setUserSearchTerm(e.target.value);
                        setShowUserSearchDropdown(true);
                      }}
                      style={{ width: '100%', border: 'none', background: 'transparent', outline: 'none', fontSize: '14px', color: '#3c4043' }}
                    />
                  </div>

                  {/* Dropdown danh sách người dùng chuẩn Screenshot 3 */}
                  {showUserSearchDropdown && (
                    <div style={{
                      position: 'absolute',
                      top: 'calc(100% + 4px)',
                      left: 0,
                      right: 0,
                      backgroundColor: 'white',
                      borderRadius: '12px',
                      boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
                      border: '1px solid #dadce0',
                      maxHeight: '260px',
                      overflowY: 'auto',
                      zIndex: 80
                    }}>
                      {userSearchResults.map((u, i) => (
                        <div
                          key={i}
                          onClick={() => {
                            setSelectedUserFilter(u);
                            setShowUserSearchDropdown(false);
                          }}
                          style={{
                            padding: '10px 14px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            cursor: 'pointer',
                            borderBottom: i < userSearchResults.length - 1 ? '1px solid #f1f3f4' : 'none'
                          }}
                          className="hover:bg-blue-50/60"
                        >
                          {/* Avatar Initials hoặc ảnh */}
                          <div style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '50%',
                            backgroundColor: i % 2 === 0 ? '#334155' : '#0284c7',
                            color: 'white',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: '600',
                            fontSize: '14px',
                            flexShrink: 0
                          }}>
                            {u.full_name.charAt(0).toUpperCase()}
                          </div>
                          <div style={{ overflow: 'hidden' }}>
                            <div style={{ fontSize: '13px', fontWeight: '500', color: '#1f1f1f', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {u.full_name}
                            </div>
                            <div style={{ fontSize: '11px', color: '#70757a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {u.email}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Tag người dùng đang lọc */}
                  {selectedUserFilter && (
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', backgroundColor: '#e8f0fe', borderRadius: '16px', fontSize: '12px', color: '#1a73e8', marginTop: '8px' }}>
                      <span>{selectedUserFilter.full_name}</span>
                      <X size={14} style={{ cursor: 'pointer' }} onClick={() => setSelectedUserFilter(null)} />
                    </div>
                  )}
                </div>

                {/* Mục: "Trang đặt lịch hẹn + ^" (Khớp Screenshot 1) */}
                <div style={{ marginBottom: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '14px', fontWeight: '500', color: '#3c4043', marginBottom: '8px' }}>
                    <span>Trang đặt lịch hẹn</span>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <Plus size={16} color="#5f6368" style={{ cursor: 'pointer' }} />
                      <ChevronDown size={16} color="#5f6368" style={{ cursor: 'pointer' }} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 0', fontSize: '13px', color: '#3c4043' }}>
                    <CalendarIcon size={16} color="#5f6368" />
                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>30 phút với HOANG T...</span>
                    <span style={{ fontSize: '10px', fontWeight: 'bold', padding: '1px 6px', borderRadius: '4px', backgroundColor: '#1a73e8', color: 'white' }}>Mới</span>
                  </div>
                </div>

                {/* Mục: "Thông tin chi tiết về thời ... ^" (Khớp Screenshot 1) */}
                <div style={{ marginBottom: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '14px', fontWeight: '500', color: '#3c4043', marginBottom: '6px' }}>
                    <span>Thông tin chi tiết về thời ...</span>
                    <ChevronDown size={16} color="#5f6368" style={{ cursor: 'pointer' }} />
                  </div>
                  <div style={{ fontSize: '11px', color: '#70757a', marginBottom: '4px' }}>
                    11 – 17 THG 10, 2026
                  </div>
                  <div style={{ fontSize: '12px', color: '#3c4043', marginBottom: '8px' }}>
                    {totalMeetingHours.toFixed(0)} giờ trong cuộc họp (thời gian trung bình: 0 giờ)
                  </div>
                  <div style={{ height: '8px', border: '1px solid #1a73e8', borderRadius: '9999px', padding: '1px' }}>
                    <div style={{ height: '100%', width: `${Math.min(100, Math.max(5, (totalMeetingHours / 10) * 100))}%`, backgroundColor: '#1a73e8', borderRadius: '9999px' }}></div>
                  </div>
                  <div style={{ marginTop: '8px' }}>
                    <button style={{ border: 'none', background: 'transparent', color: '#1a73e8', fontSize: '12px', fontWeight: '500', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', padding: 0 }}>
                      <Sparkles size={14} />
                      <span>Thông tin khác</span>
                    </button>
                  </div>
                </div>

                {/* Mục: "Lịch của tôi" ^ */}
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '14px', fontWeight: '500', color: '#3c4043', marginBottom: '8px' }}>
                    <span>Lịch của tôi</span>
                    <ChevronDown size={16} color="#5f6368" style={{ cursor: 'pointer' }} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: '#3c4043', cursor: 'pointer' }}>
                      <input type="checkbox" checked={!filterMyMeetingsOnly} onChange={() => setFilterMyMeetingsOnly(prev => !prev)} style={{ accentColor: '#1a73e8', width: '16px', height: '16px' }} />
                      <span>Hoàng Thanh Phương</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: '#3c4043', cursor: 'pointer' }}>
                      <input type="checkbox" defaultChecked style={{ accentColor: '#00897b', width: '16px', height: '16px' }} />
                      <span>Nhắc nhở</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: '#3c4043', cursor: 'pointer' }}>
                      <input type="checkbox" defaultChecked style={{ accentColor: '#1a73e8', width: '16px', height: '16px' }} />
                      <span>Nhiệm vụ</span>
                    </label>
                  </div>
                </div>

                {/* Mục: "Lịch khác" + ^ */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '14px', fontWeight: '500', color: '#3c4043', marginBottom: '8px' }}>
                    <span>Lịch khác</span>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <Plus size={16} color="#5f6368" style={{ cursor: 'pointer' }} />
                      <ChevronDown size={16} color="#5f6368" style={{ cursor: 'pointer' }} />
                    </div>
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: '#3c4043', cursor: 'pointer' }}>
                    <input type="checkbox" defaultChecked style={{ accentColor: '#0b8043', width: '16px', height: '16px' }} />
                    <span>Ngày lễ tại Việt Nam</span>
                  </label>
                </div>

              </aside>
            </>
          )}

          {/* ── KHUNG LỊCH CHÍNH (GOOGLE CALENDAR GRID - TUẦN & NGÀY) ── */}
          <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', backgroundColor: '#ffffff', borderLeft: '1px solid #dadce0' }}>

            {/* ══════════════════════════════════════════════════════════════════
              VIEW: TUẦN (WEEK VIEW - KHỚP 100% SCREENSHOT 1)
              ══════════════════════════════════════════════════════════════════ */}
            {viewMode === 'Tuần' && (
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

                {/* Header 7 ngày trong tuần: CN 11, THỨ 2 12, ... THỨ 6 16 (vòng tròn xanh), THỨ 7 17 */}
                <div style={{ display: 'flex', borderBottom: '1px solid #dadce0', flexShrink: 0, paddingRight: '8px' }}>
                  {/* Góc trên bên trái: GMT+07 */}
                  <div style={{ width: '64px', height: '72px', flexShrink: 0, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: '8px', fontSize: '11px', color: '#70757a', fontWeight: '500' }}>
                    GMT+07
                  </div>

                  {/* 7 Cột Ngày */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', flex: 1 }}>
                    {weekDays.map((dateItem, idx) => {
                      const is16 = isDateToday(dateItem);
                      const dayNum = dateItem.getDate();

                      return (
                        <div
                          key={idx}
                          style={{
                            height: '72px',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRight: idx < 6 ? '1px solid #dadce0' : 'none',
                            cursor: 'pointer'
                          }}
                          onClick={() => {
                            setCurrentDate(dateItem);
                            setViewMode('Ngày');
                          }}
                          className="hover:bg-slate-50 transition-colors"
                        >
                          {/* Tên thứ: CN, THỨ 2, ... THỨ 6 */}
                          <span style={{ fontSize: '11px', fontWeight: '500', color: is16 ? '#1a73e8' : '#70757a', textTransform: 'uppercase', marginBottom: '4px' }}>
                            {dayNamesVN[idx]}
                          </span>

                          {/* Số ngày: Thứ 6 (16) nằm trong hình tròn xanh đậm #1a73e8 */}
                          <div style={{
                            width: '42px',
                            height: '42px',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: is16 ? '#1a73e8' : 'transparent',
                            color: is16 ? '#ffffff' : '#3c4043',
                            fontSize: '22px',
                            fontWeight: is16 ? '500' : '400',
                            lineHeight: 1
                          }}>
                            {dayNum}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Hàng sự kiện cả ngày: "🏢 Văn phòng" ở THỨ 2 (Khớp Screenshot 1) */}
                <div style={{ display: 'flex', borderBottom: '1px solid #dadce0', minHeight: '32px', backgroundColor: '#ffffff' }}>
                  <div style={{ width: '64px', flexShrink: 0 }}></div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', flex: 1, padding: '4px 0' }}>
                    {weekDays.map((d, idx) => (
                      <div key={idx} style={{ padding: '0 4px', borderRight: idx < 6 ? '1px solid #f1f3f4' : 'none' }}>
                        {idx === 1 && (
                          <div style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', backgroundColor: '#e8f0fe', color: '#1a73e8', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '4px', width: 'fit-content' }}>
                            <span>🏢 Văn phòng</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Lưới 24 Giờ cuộn dọc */}
                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', position: 'relative' }}>

                  {/* Trục giờ bên trái (1 AM, 2 AM, ... 11 PM) */}
                  <div style={{ width: '64px', flexShrink: 0 }}>
                    {HOURS.map(h => (
                      <div key={h} style={{ height: '56px', position: 'relative' }}>
                        <span style={{ position: 'absolute', top: '-8px', right: '10px', fontSize: '10px', color: '#70757a', fontWeight: '500' }}>
                          {formatHourLabel(h)}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* 7 Cột Khung Giờ (Lưới chi tiết) */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', flex: 1, position: 'relative' }}>

                    {/* Các đường kẻ ngang chia giờ */}
                    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1 }}>
                      {HOURS.map(h => (
                        <div key={h} style={{ height: '56px', borderBottom: '1px solid #dadce0', boxSizing: 'border-box' }}></div>
                      ))}
                    </div>

                    {/* Vòng lặp 7 ngày */}
                    {weekDays.map((dayDate, dayIdx) => {
                      const dayMeetings = getMeetingsForDate(dayDate);
                      const is16 = isDateToday(dayDate);

                      return (
                        <div
                          key={dayIdx}
                          style={{
                            position: 'relative',
                            borderRight: dayIdx < 6 ? '1px solid #dadce0' : 'none',
                            height: `${24 * 56}px`
                          }}
                        >
                          {/* Đường đỏ chỉ giờ hiện tại (Current Time Indicator) lúc 4:33 PM */}
                          {is16 && (
                            <div style={{
                              position: 'absolute',
                              top: `${currentHourPosition * 56}px`,
                              left: 0,
                              right: 0,
                              height: '2px',
                              backgroundColor: '#ea4335',
                              zIndex: 10,
                              pointerEvents: 'none'
                            }}>
                              <div style={{
                                position: 'absolute',
                                left: '-5px',
                                top: '-4px',
                                width: '10px',
                                height: '10px',
                                borderRadius: '50%',
                                backgroundColor: '#ea4335'
                              }}></div>
                            </div>
                          )}

                          {/* Click vào ô bất kỳ để mở Quick Create Dialog */}
                          {HOURS.map(h => (
                            <div
                              key={h}
                              onClick={() => handleOpenCreateModal(dayDate, h)}
                              style={{ height: '56px', cursor: 'pointer', transition: 'background-color 0.1s' }}
                              className="hover:bg-blue-50/40"
                              title={`Nhấn để đặt lịch vào ${h}:00`}
                            ></div>
                          ))}

                          {/* RENDER CÁC THẺ CUỘC HỌP TRÊN LƯỚI */}
                          {dayMeetings.map(meeting => {
                            const st = new Date(meeting.start_time);
                            const et = new Date(meeting.end_time);
                            const startHour = st.getHours() + st.getMinutes() / 60;
                            const endHour = et.getHours() + et.getMinutes() / 60;
                            const durationHours = Math.max(0.75, endHour - startHour);

                            const topPx = startHour * 56;
                            const heightPx = Math.max(34, durationHours * 56 - 4);
                            const color = getEventColorStyle(meeting.meeting_type, meeting.status);

                            return (
                              <div
                                key={meeting.meeting_id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedMeeting(meeting);
                                  setShowDetailModal(true);
                                }}
                                style={{
                                  position: 'absolute',
                                  top: `${topPx}px`,
                                  height: `${heightPx}px`,
                                  left: '2px',
                                  right: '2px',
                                  backgroundColor: color.bg,
                                  border: `1px solid ${color.border}`,
                                  borderRadius: '4px',
                                  padding: '4px 6px',
                                  overflow: 'hidden',
                                  cursor: 'pointer',
                                  zIndex: 5,
                                  boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
                                  transition: 'transform 0.15s, box-shadow 0.15s'
                                }}
                                className="hover:shadow-md hover:scale-[1.01]"
                                title={`${meeting.title}`}
                              >
                                <div style={{ fontSize: '11px', fontWeight: '500', color: color.text, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {meeting.title}
                                </div>
                                <div style={{ fontSize: '10px', color: color.text, opacity: 0.85, marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden' }}>
                                  {st.getHours()}AM, {meeting.meeting_type === 'ONLINE' ? 'google meet' : (meeting.room?.room_name || 'phòng')}
                                </div>
                              </div>
                            );
                          })}

                        </div>
                      );
                    })}

                  </div>

                </div>
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════════════
              VIEW: NGÀY (DAY VIEW - KHỚP 100% SCREENSHOT 5)
              ══════════════════════════════════════════════════════════════════ */}
            {viewMode === 'Ngày' && (
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

                {/* Header Ngày duy nhất (Screenshot 5) */}
                <div style={{ display: 'flex', borderBottom: '1px solid #dadce0', flexShrink: 0, paddingRight: '16px' }}>
                  <div style={{ width: '80px', height: '80px', flexShrink: 0, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: '8px', fontSize: '11px', color: '#70757a', fontWeight: '500' }}>
                    GMT+07
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '12px 0' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <span style={{ fontSize: '11px', fontWeight: '500', color: '#1a73e8', textTransform: 'uppercase', marginBottom: '2px' }}>
                        {dayNamesVN[currentDate.getDay()]}
                      </span>
                      <div style={{
                        width: '46px',
                        height: '46px',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: '#1a73e8',
                        color: '#ffffff',
                        fontSize: '24px',
                        fontWeight: '500'
                      }}>
                        {currentDate.getDate()}
                      </div>
                    </div>

                    <div style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', backgroundColor: '#e8f0fe', color: '#1a73e8', fontWeight: '500', height: 'fit-content' }}>
                      🏢 Văn phòng
                    </div>
                  </div>
                </div>

                {/* Lưới 24 Giờ cho Ngày */}
                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', position: 'relative' }}>
                  <div style={{ width: '80px', flexShrink: 0 }}>
                    {HOURS.map(h => (
                      <div key={h} style={{ height: '64px', position: 'relative' }}>
                        <span style={{ position: 'absolute', top: '-8px', right: '12px', fontSize: '11px', color: '#70757a', fontWeight: '500' }}>
                          {formatHourLabel(h)}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div style={{ flex: 1, position: 'relative', height: `${24 * 64}px` }}>
                    {/* Đường kẻ ngang chia giờ */}
                    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1 }}>
                      {HOURS.map(h => (
                        <div key={h} style={{ height: '64px', borderBottom: '1px solid #dadce0', boxSizing: 'border-box' }}></div>
                      ))}
                    </div>

                    {/* Đường đỏ giờ hiện tại kéo dài ngang màn hình (Screenshot 5) */}
                    <div style={{
                      position: 'absolute',
                      top: `${currentHourPosition * 64}px`,
                      left: 0,
                      right: 0,
                      height: '2px',
                      backgroundColor: '#ea4335',
                      zIndex: 10,
                      pointerEvents: 'none'
                    }}>
                      <div style={{
                        position: 'absolute',
                        left: '-5px',
                        top: '-4px',
                        width: '10px',
                        height: '10px',
                        borderRadius: '50%',
                        backgroundColor: '#ea4335'
                      }}></div>
                    </div>

                    {/* Click slot để tạo */}
                    {HOURS.map(h => (
                      <div
                        key={h}
                        onClick={() => handleOpenCreateModal(currentDate, h)}
                        style={{ height: '64px', cursor: 'pointer' }}
                        className="hover:bg-blue-50/40"
                      ></div>
                    ))}

                    {/* Cuộc họp trong ngày */}
                    {getMeetingsForDate(currentDate).map(meeting => {
                      const st = new Date(meeting.start_time);
                      const et = new Date(meeting.end_time);
                      const startHour = st.getHours() + st.getMinutes() / 60;
                      const durationHours = Math.max(0.75, (et.getHours() + et.getMinutes() / 60) - startHour);

                      const topPx = startHour * 64;
                      const heightPx = Math.max(48, durationHours * 64 - 4);
                      const color = getEventColorStyle(meeting.meeting_type, meeting.status);

                      return (
                        <div
                          key={meeting.meeting_id}
                          onClick={() => {
                            setSelectedMeeting(meeting);
                            setShowDetailModal(true);
                          }}
                          style={{
                            position: 'absolute',
                            top: `${topPx}px`,
                            height: `${heightPx}px`,
                            left: '8px',
                            right: '24px',
                            backgroundColor: color.bg,
                            borderLeft: `4px solid ${color.border}`,
                            border: `1px solid ${color.border}`,
                            borderRadius: '6px',
                            padding: '8px 12px',
                            cursor: 'pointer',
                            zIndex: 5,
                            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                          }}
                          className="hover:shadow-md"
                        >
                          <div style={{ fontSize: '13px', fontWeight: '600', color: color.text }}>
                            {meeting.title}
                          </div>
                          <div style={{ fontSize: '12px', color: color.text, opacity: 0.9, marginTop: '2px' }}>
                            {st.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – {et.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {meeting.meeting_type === 'ONLINE' ? 'Google Meet' : (meeting.room?.room_name || 'Phòng họp')}
                          </div>
                        </div>
                      );
                    })}

                  </div>
                </div>
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════════════
              VIEW: THÁNG (MONTH VIEW)
              ══════════════════════════════════════════════════════════════════ */}
            {viewMode === 'Tháng' && (
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', textAlign: 'center', borderBottom: '1px solid #dadce0', padding: '8px 0', backgroundColor: '#ffffff' }}>
                  {dayNamesVN.map((d, i) => (
                    <span key={i} style={{ fontSize: '11px', fontWeight: '500', color: '#70757a' }}>{d}</span>
                  ))}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gridTemplateRows: 'repeat(5, 1fr)', flex: 1 }}>
                  {getMiniCalendarDays().slice(0, 35).map((item, idx) => {
                    const mList = getMeetingsForDate(item.date);
                    const is16 = item.date.getDate() === 16 && item.date.getMonth() === 9;

                    return (
                      <div
                        key={idx}
                        onClick={() => {
                          setCurrentDate(item.date);
                          setViewMode('Ngày');
                        }}
                        style={{
                          borderRight: '1px solid #dadce0',
                          borderBottom: '1px solid #dadce0',
                          padding: '6px',
                          overflow: 'hidden',
                          cursor: 'pointer',
                          backgroundColor: !item.isCurrentMonth ? '#fafafa' : '#ffffff'
                        }}
                        className="hover:bg-slate-50"
                      >
                        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '4px' }}>
                          <div style={{
                            width: '26px',
                            height: '26px',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '12px',
                            fontWeight: is16 ? 'bold' : 'normal',
                            backgroundColor: is16 ? '#1a73e8' : 'transparent',
                            color: is16 ? '#ffffff' : !item.isCurrentMonth ? '#bdc1c6' : '#3c4043'
                          }}>
                            {item.day}
                          </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          {mList.slice(0, 2).map(m => (
                            <div
                              key={m.meeting_id}
                              style={{
                                fontSize: '11px',
                                padding: '2px 4px',
                                borderRadius: '3px',
                                backgroundColor: '#e8f0fe',
                                color: '#1a73e8',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis'
                              }}
                            >
                              {m.title}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

          </main>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          3. GOOGLE CALENDAR QUICK CREATE MODAL (KHỚP 100% SCREENSHOT 4)
          ══════════════════════════════════════════════════════════════════════ */}
      {showCreateModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.36)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 120, padding: '16px' }}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '540px',
            boxShadow: '0 24px 38px 3px rgba(0,0,0,0.14), 0 9px 46px 8px rgba(0,0,0,0.12)',
            overflow: 'hidden',
            border: '1px solid #dadce0',
            animation: 'fadeIn 0.15s ease-out'
          }}>

            {/* Top Bar with Drag Handle & Close Button */}
            <div style={{ padding: '12px 16px 4px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ color: '#5f6368', cursor: 'grab' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="8" cy="7" r="1.5" />
                  <circle cx="16" cy="7" r="1.5" />
                  <circle cx="8" cy="12" r="1.5" />
                  <circle cx="16" cy="12" r="1.5" />
                  <circle cx="8" cy="17" r="1.5" />
                  <circle cx="16" cy="17" r="1.5" />
                </svg>
              </div>
              <button
                onClick={() => { setShowCreateModal(false); setEditingMeetingId(null); }}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#5f6368', padding: '6px', borderRadius: '50%' }}
                className="hover:bg-slate-100"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateMeetingSubmit} style={{ padding: '0 24px 20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

              {createError && (
                <div style={{ padding: '8px 12px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#b91c1c', fontSize: '13px' }}>
                  {createError}
                </div>
              )}

              {/* Title input (Google Style Large Underline Input - Screenshot 4) */}
              <div>
                <input
                  type="text"
                  placeholder="Thêm tiêu đề"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  style={{
                    width: '100%',
                    fontSize: '22px',
                    fontWeight: '400',
                    color: '#1f1f1f',
                    border: 'none',
                    borderBottom: '2px solid #1a73e8',
                    padding: '8px 0',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                  autoFocus
                  required
                />
              </div>

              {/* Pill Tabs: Sự kiện (Active), Nhiệm vụ, Không có mặt tại văn phòng... (Screenshot 4) */}
              <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
                {['Sự kiện', 'Nhiệm vụ', 'Không có mặt tại văn phòng', 'Thời gian tập trung', 'Địa điểm làm việc', 'Lên lịch hẹn'].map((tab, idx) => {
                  const isActive = tab === createType;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setCreateType(tab)}
                      style={{
                        padding: '6px 14px',
                        borderRadius: '8px',
                        border: 'none',
                        backgroundColor: isActive ? '#e8f0fe' : 'transparent',
                        color: isActive ? '#1a73e8' : '#5f6368',
                        fontSize: '13px',
                        fontWeight: isActive ? '600' : '500',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap'
                      }}
                      className={!isActive ? 'hover:bg-slate-100' : ''}
                    >
                      {tab}
                    </button>
                  );
                })}
              </div>

              {/* Row 1: Time (Clock icon - Screenshot 4 & US #3, US #5) */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', marginTop: '4px' }}>
                <Clock size={20} color="#5f6368" style={{ marginTop: '4px' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <input
                      type="date"
                      value={formDate}
                      onChange={(e) => setFormDate(e.target.value)}
                      style={{ border: '1px solid #dadce0', borderRadius: '4px', padding: '4px 8px', fontSize: '13px', outline: 'none' }}
                    />
                    <input
                      type="time"
                      value={formStartTime}
                      onChange={(e) => setFormStartTime(e.target.value)}
                      style={{ border: '1px solid #dadce0', borderRadius: '4px', padding: '4px 8px', fontSize: '13px', outline: 'none' }}
                    />
                    <span>–</span>
                    <input
                      type="time"
                      value={formEndTime}
                      onChange={(e) => setFormEndTime(e.target.value)}
                      style={{ border: '1px solid #dadce0', borderRadius: '4px', padding: '4px 8px', fontSize: '13px', outline: 'none' }}
                    />

                    {/* Nút Gợi ý giờ rảnh (US #5) */}
                    <button
                      type="button"
                      onClick={handleFetchTimeSuggestions}
                      disabled={suggestingTime}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '6px',
                        border: '1px solid #c2e7ff',
                        backgroundColor: '#f0f7ff',
                        color: '#0b57d0',
                        fontSize: '12px',
                        fontWeight: '500',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        transition: 'all 0.15s'
                      }}
                      className="hover:bg-blue-100"
                      title="Gợi ý thời gian họp khi mọi người đều rảnh (US #5)"
                    >
                      <Sparkles size={14} color="#0b57d0" />
                      <span>{suggestingTime ? 'Đang tìm...' : 'Gợi ý giờ rảnh'}</span>
                    </button>
                  </div>

                  {/* Smart Time Suggestion Box (US #5) */}
                  {showTimeSuggestions && (
                    <div style={{
                      marginTop: '8px',
                      padding: '10px 12px',
                      backgroundColor: '#f8fafc',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                      animation: 'fadeIn 0.2s'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <span style={{ fontSize: '12px', fontWeight: '600', color: '#1e293b' }}>
                          💡 Gợi ý khung giờ phù hợp cho {formSelectedParticipants.length + 1} người:
                        </span>
                        <X size={14} style={{ cursor: 'pointer', color: '#64748b' }} onClick={() => setShowTimeSuggestions(false)} />
                      </div>

                      {suggestTimeError && (
                        <div style={{ fontSize: '12px', color: '#ef4444', marginBottom: '4px' }}>{suggestTimeError}</div>
                      )}

                      {suggestedSlots.length === 0 && !suggestingTime && !suggestTimeError && (
                        <div style={{ fontSize: '12px', color: '#64748b' }}>Không tìm thấy khung giờ gợi ý phù hợp.</div>
                      )}

                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', maxHeight: '120px', overflowY: 'auto' }}>
                        {suggestedSlots.map((slot, idx) => {
                          const isOptimal = slot.is_optimal;
                          return (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => handleApplyTimeSlot(slot.start_time, slot.end_time)}
                              style={{
                                padding: '4px 8px',
                                borderRadius: '6px',
                                border: isOptimal ? '1px solid #86efac' : '1px solid #fed7aa',
                                backgroundColor: isOptimal ? '#f0fdf4' : '#fffbeb',
                                color: isOptimal ? '#166534' : '#9a3412',
                                fontSize: '11px',
                                fontWeight: '500',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                transition: 'all 0.15s'
                              }}
                              className="hover:scale-105 active:scale-95"
                              title={`${slot.status} (Khả dụng: ${slot.free_count}/${slot.total_count} người, Phòng: ${slot.room_available ? 'Rảnh' : 'Bận'})`}
                            >
                              <span>{slot.start_time} - {slot.end_time}</span>
                              <span style={{
                                padding: '1px 4px',
                                borderRadius: '4px',
                                fontSize: '10px',
                                backgroundColor: isOptimal ? '#bbf7d0' : '#fde68a',
                                color: isOptimal ? '#14532d' : '#854d0e',
                                fontWeight: '600'
                              }}>
                                {slot.status}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Lặp lại định kỳ (US #3) */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '6px', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '12px', color: '#5f6368' }}>Lặp lại:</span>
                      <select
                        value={formRecurrence}
                        onChange={(e) => setFormRecurrence(e.target.value as any)}
                        style={{
                          padding: '3px 8px',
                          borderRadius: '4px',
                          border: '1px solid #dadce0',
                          fontSize: '12px',
                          color: '#3c4043',
                          outline: 'none',
                          backgroundColor: '#ffffff'
                        }}
                      >
                        <option value="NONE">Không lặp lại</option>
                        <option value="WEEKLY">Lặp lại hàng tuần</option>
                        <option value="MONTHLY">Lặp lại hàng tháng</option>
                      </select>
                    </div>

                    {formRecurrence !== 'NONE' && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '12px', color: '#5f6368' }}>Số lần:</span>
                        <input
                          type="number"
                          min={2}
                          max={12}
                          value={formRecurrenceCount}
                          onChange={(e) => setFormRecurrenceCount(Math.max(2, Math.min(12, Number(e.target.value) || 2)))}
                          style={{
                            width: '46px',
                            padding: '3px 6px',
                            borderRadius: '4px',
                            border: '1px solid #dadce0',
                            fontSize: '12px',
                            outline: 'none',
                            textAlign: 'center'
                          }}
                        />
                        <span style={{ fontSize: '11px', color: '#059669', fontStyle: 'italic' }}>
                          (Tạo {formRecurrenceCount} buổi {formRecurrence === 'WEEKLY' ? 'hàng tuần' : 'hàng tháng'})
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Row 2: Guests (Users icon - Screenshot 4) */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                <Users size={20} color="#5f6368" style={{ marginTop: '6px' }} />
                <div style={{ flex: 1 }}>
                  <input
                    type="text"
                    placeholder="Thêm khách"
                    value={formParticipantSearch}
                    onChange={(e) => setFormParticipantSearch(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && formParticipantResults.length > 0) {
                        e.preventDefault();
                        const u = formParticipantResults[0];
                        setFormSelectedParticipants(prev => [...prev, u]);
                        setFormParticipantSearch('');
                        setFormParticipantResults([]);
                      }
                    }}
                    style={{ width: '100%', border: 'none', borderBottom: '1px solid #e8eaed', padding: '6px 0', outline: 'none', fontSize: '14px', color: '#3c4043' }}
                  />

                  {/* Search results popup */}
                  {formParticipantResults.length > 0 && (
                    <div style={{ marginTop: '4px', backgroundColor: 'white', border: '1px solid #dadce0', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', maxHeight: '140px', overflowY: 'auto' }}>
                      {formParticipantResults.map(u => (
                        <div
                          key={u.user_id}
                          onClick={() => {
                            setFormSelectedParticipants(prev => [...prev, u]);
                            setFormParticipantSearch('');
                            setFormParticipantResults([]);
                          }}
                          style={{ padding: '8px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '13px' }}
                          className="hover:bg-blue-50"
                        >
                          <div>
                            <span style={{ fontWeight: '600' }}>{u.full_name}</span>
                            <span style={{ color: '#70757a', marginLeft: '6px' }}>({u.email})</span>
                          </div>
                          <Plus size={16} color="#1a73e8" />
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Selected guests chips */}
                  {formSelectedParticipants.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
                      {formSelectedParticipants.map(u => (
                        <span key={u.user_id} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', backgroundColor: '#e8f0fe', borderRadius: '12px', fontSize: '12px', color: '#1a73e8' }}>
                          <span>{u.full_name}</span>
                          <X size={12} style={{ cursor: 'pointer' }} onClick={() => setFormSelectedParticipants(prev => prev.filter(p => p.user_id !== u.user_id))} />
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Row 3: Google Meet (Video camera icon - Screenshot 4) */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <Video size={20} color="#00897b" />
                <div style={{ flex: 1 }}>
                  {formMeetingType === 'ONLINE' || formMeetingType === 'HYBRID' ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', backgroundColor: '#f1f3f4', borderRadius: '8px' }}>
                      <span style={{ fontSize: '13px', color: '#1a73e8', fontWeight: '500' }}>
                        {formMeetingLink || 'https://meet.google.com/ictu-grp4-demo'}
                      </span>
                      <button
                        type="button"
                        onClick={() => setFormMeetingType('IN_PERSON')}
                        style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#5f6368' }}
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setFormMeetingType('ONLINE');
                        setFormMeetingLink(`https://meet.google.com/ictu-grp4-${Date.now().toString().slice(-4)}`);
                      }}
                      style={{
                        padding: '8px 16px',
                        borderRadius: '8px',
                        border: 'none',
                        backgroundColor: '#1a73e8',
                        color: 'white',
                        fontSize: '13px',
                        fontWeight: '500',
                        cursor: 'pointer'
                      }}
                      className="hover:bg-blue-700"
                    >
                      Thêm hội nghị truyền hình trên Google Meet
                    </button>
                  )}
                </div>
              </div>

              {/* Row 4: Room / Location & Capacity (MapPin icon - US #7, #8, #10) */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                <MapPin size={20} color="#5f6368" style={{ marginTop: '4px' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <select
                      value={formRoomId}
                      onChange={(e) => setFormRoomId(Number(e.target.value))}
                      style={{ flex: 1, padding: '7px 10px', borderRadius: '6px', border: '1px solid #dadce0', fontSize: '13px', color: '#3c4043', outline: 'none' }}
                    >
                      <option value="">Thêm phòng hoặc vị trí</option>
                      {rooms.map(r => {
                        const userRoleId = userProfile?.role_id || (userProfile?.role === 'LECTURER' ? 2 : userProfile?.role === 'PARTICIPANT' ? 3 : 1);
                        const isRestr = (r.restrictions || []).some((res: any) => res.role_id === userRoleId && userRoleId !== 1);
                        return (
                          <option key={r.room_id} value={r.room_id} disabled={isRestr || r.status === 'MAINTENANCE'}>
                            {r.room_name} ({r.location}) · Sức chứa: {r.capacity} chỗ {isRestr ? '🔒 [Hạn chế quyền đặt]' : r.status === 'MAINTENANCE' ? '[Đang bảo trì]' : ''}
                          </option>
                        );
                      })}
                    </select>

                    <button
                      type="button"
                      onClick={handleFetchRoomSuggestions}
                      disabled={loadingRoomSuggestions}
                      style={{
                        padding: '7px 12px',
                        borderRadius: '6px',
                        border: '1px solid #c7d2fe',
                        backgroundColor: '#eef2ff',
                        color: '#4338ca',
                        fontSize: '12px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                        whiteSpace: 'nowrap'
                      }}
                      title="Hệ thống tự động gợi ý phòng họp tối ưu theo số lượng người (US #26)"
                    >
                      <Sparkles size={14} color="#6366f1" />
                      <span>{loadingRoomSuggestions ? 'Đang phân tích...' : '✨ Gợi ý phòng (US #26)'}</span>
                    </button>
                  </div>

                  {/* Drawer gợi ý phòng họp tối ưu (US #26) */}
                  {showRoomSuggestions && (
                    <div style={{ marginTop: '8px', padding: '10px 12px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#166534', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Sparkles size={14} color="#16a34a" />
                          <span>Gợi ý phòng họp tối ưu cho {formSelectedParticipants.length + 1} người:</span>
                        </span>
                        <X size={14} style={{ cursor: 'pointer', color: '#64748b' }} onClick={() => setShowRoomSuggestions(false)} />
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '140px', overflowY: 'auto' }}>
                        {suggestedRooms.slice(0, 3).map((sr) => (
                          <div
                            key={sr.room_id}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              padding: '6px 10px',
                              borderRadius: '6px',
                              backgroundColor: 'white',
                              border: sr.room_id === Number(formRoomId) ? '2px solid #22c55e' : '1px solid #e2e8f0',
                              fontSize: '12px'
                            }}
                          >
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <div style={{ fontWeight: '600', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span>{sr.room_name}</span>
                                <span style={{ backgroundColor: '#dcfce7', color: '#15803d', padding: '1px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold' }}>
                                  {sr.match_score_pct}% Tối ưu
                                </span>
                              </div>
                              <span style={{ fontSize: '11px', color: '#64748b' }}>
                                Sức chứa: {sr.capacity} chỗ · {sr.reason}
                              </span>
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                setFormRoomId(sr.room_id);
                                setShowRoomSuggestions(false);
                              }}
                              style={{
                                padding: '4px 10px',
                                borderRadius: '6px',
                                border: 'none',
                                backgroundColor: sr.room_id === Number(formRoomId) ? '#16a34a' : '#2563eb',
                                color: 'white',
                                fontSize: '11.5px',
                                fontWeight: '600',
                                cursor: 'pointer'
                              }}
                            >
                              {sr.room_id === Number(formRoomId) ? 'Đã chọn' : 'Chọn phòng'}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Sức chứa check (US #10) & Giới hạn quyền đặt phòng theo Role (US #21) */}
                  {(() => {
                    const selRoom = rooms.find(r => r.room_id === Number(formRoomId));
                    const totalPeople = formSelectedParticipants.length + 1;
                    const userRoleId = userProfile?.role_id || (userProfile?.role === 'LECTURER' ? 2 : userProfile?.role === 'PARTICIPANT' ? 3 : 1);
                    const isRestr = (selRoom?.restrictions || []).some((res: any) => res.role_id === userRoleId && userRoleId !== 1);

                    if (isRestr) {
                      return (
                        <div style={{ marginTop: '6px', padding: '6px 10px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', fontSize: '12px', color: '#b91c1c', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <AlertCircle size={15} color="#dc2626" />
                          <span>
                            <strong>Giới hạn quyền đặt phòng (US #21):</strong> Vai trò của bạn bị hạn chế không thể đặt phòng <strong>{selRoom?.room_name}</strong> theo chính sách nhà trường (Chỉ dành cho Cán bộ Giảng viên/Ban giám hiệu).
                          </span>
                        </div>
                      );
                    }
                    if (selRoom && selRoom.capacity > 0 && totalPeople > selRoom.capacity) {
                      return (
                        <div style={{ marginTop: '6px', padding: '6px 10px', backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: '6px', fontSize: '12px', color: '#92400e', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <AlertCircle size={15} color="#d97706" />
                          <span>
                            <strong>Cảnh báo sức chứa (US #10):</strong> Đã mời {totalPeople} người, vượt quá sức chứa {selRoom.capacity} chỗ của {selRoom.room_name}.
                          </span>
                        </div>
                      );
                    }
                    if (selRoom && selRoom.status === 'MAINTENANCE') {
                      return (
                        <div style={{ marginTop: '6px', padding: '6px 10px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', fontSize: '12px', color: '#b91c1c', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <AlertCircle size={15} color="#dc2626" />
                          <span>
                            <strong>Phòng đang bảo trì (US #7):</strong> Phòng này đang trong trạng thái bảo trì hoặc sửa chữa.
                          </span>
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>
              </div>

              {/* Row 4.1: Mượn trang thiết bị kèm cuộc họp (US #12) */}
              {equipments.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                  <Laptop size={20} color="#5f6368" style={{ marginTop: '4px' }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '13px', fontWeight: '500', color: '#3c4043', marginBottom: '4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span>Mượn trang thiết bị (máy chiếu, TV, micro...) (US #12):</span>
                      <span style={{ fontSize: '11px', color: '#1a73e8', fontWeight: '600' }}>
                        {formSelectedEquipments.length > 0 ? `Đã chọn ${formSelectedEquipments.length} thiết bị` : 'Tùy chọn'}
                      </span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px', maxHeight: '110px', overflowY: 'auto', backgroundColor: '#f8fafc', padding: '8px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      {equipments.map(eq => {
                        const isChecked = formSelectedEquipments.includes(eq.equipment_id);
                        return (
                          <label
                            key={eq.equipment_id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              fontSize: '12px',
                              color: '#334155',
                              cursor: 'pointer',
                              padding: '4px 6px',
                              borderRadius: '4px',
                              backgroundColor: isChecked ? '#e0f2fe' : 'transparent'
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) setFormSelectedEquipments(prev => [...prev, eq.equipment_id]);
                                else setFormSelectedEquipments(prev => prev.filter(id => id !== eq.equipment_id));
                              }}
                              style={{ accentColor: '#1a73e8' }}
                            />
                            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {eq.equipment_name}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Row 5: Description (Menu icon - Screenshot 4) */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                <div style={{ width: '20px', display: 'flex', flexDirection: 'column', gap: '3px', marginTop: '6px' }}>
                  <span style={{ height: '2px', backgroundColor: '#5f6368', borderRadius: '1px' }}></span>
                  <span style={{ height: '2px', backgroundColor: '#5f6368', borderRadius: '1px' }}></span>
                  <span style={{ height: '2px', backgroundColor: '#5f6368', borderRadius: '1px' }}></span>
                </div>
                <div style={{ flex: 1 }}>
                  <input
                    type="text"
                    placeholder="Thêm mô tả hoặc các tệp đính kèm"
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    style={{ width: '100%', border: 'none', borderBottom: '1px solid #e8eaed', padding: '6px 0', outline: 'none', fontSize: '14px', color: '#3c4043' }}
                  />
                </div>
              </div>

              {/* Row 6: Calendar Owner Profile (Calendar icon - Screenshot 4) */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                <CalendarIcon size={20} color="#5f6368" style={{ marginTop: '2px' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '13px', fontWeight: '500', color: '#1f1f1f' }}>
                      {userProfile?.fullName || 'HOANG THANH PHUONG'}
                    </span>
                    <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#1a73e8' }}></span>
                  </div>
                  <div style={{ fontSize: '12px', color: '#70757a', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    <span>Bận · Hiển thị mặc định · </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#1a73e8', backgroundColor: '#e8f0fe', padding: '2px 8px', borderRadius: '6px' }}>
                      <Bell size={12} color="#1a73e8" />
                      <select
                        value={formReminderMinutes}
                        onChange={(e) => setFormReminderMinutes(Number(e.target.value))}
                        style={{ border: 'none', background: 'transparent', color: '#1a73e8', fontSize: '12px', outline: 'none', cursor: 'pointer', fontWeight: '500' }}
                      >
                        <option value={10}>Nhắc trước 10 phút</option>
                        <option value={15}>Nhắc trước 15 phút</option>
                        <option value={30}>Nhắc trước 30 phút</option>
                        <option value={60}>Nhắc trước 1 giờ</option>
                      </select>
                    </span>
                  </div>
                </div>
              </div>

              {/* Expanded Options: Equipments */}
              {showMoreOptions && equipments.length > 0 && (
                <div style={{ padding: '12px', backgroundColor: '#f8f9fa', borderRadius: '8px', border: '1px solid #dadce0' }}>
                  <div style={{ fontSize: '12px', fontWeight: '600', color: '#3c4043', marginBottom: '6px' }}>
                    Mượn trang thiết bị:
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' }}>
                    {equipments.filter(e => e.status === 'AVAILABLE').map(eq => (
                      <label key={eq.equipment_id} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#3c4043', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={formSelectedEquipments.includes(eq.equipment_id)}
                          onChange={(e) => {
                            if (e.target.checked) setFormSelectedEquipments(prev => [...prev, eq.equipment_id]);
                            else setFormSelectedEquipments(prev => prev.filter(id => id !== eq.equipment_id));
                          }}
                          style={{ accentColor: '#1a73e8' }}
                        />
                        <span>{eq.equipment_name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Footer: "Tùy chọn khác" & "Lưu" (Pill Button - Screenshot 4) */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '12px', marginTop: '4px' }}>
                <button
                  type="button"
                  onClick={() => setShowMoreOptions(prev => !prev)}
                  style={{ border: 'none', background: 'transparent', color: '#1a73e8', fontWeight: '500', fontSize: '14px', cursor: 'pointer' }}
                >
                  {showMoreOptions ? 'Ẩn tùy chọn' : 'Tùy chọn khác'}
                </button>

                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    padding: '8px 28px',
                    borderRadius: '9999px',
                    border: 'none',
                    backgroundColor: '#1a73e8',
                    color: 'white',
                    fontWeight: '500',
                    fontSize: '14px',
                    cursor: submitting ? 'not-allowed' : 'pointer',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.2)'
                  }}
                  className="hover:bg-blue-700 active:scale-95 transition-all"
                >
                  {submitting ? 'Đang lưu...' : 'Lưu'}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          4. MODAL CHI TIẾT CUỘC HỌP (GOOGLE CALENDAR POPUP DIALOG)
          ══════════════════════════════════════════════════════════════════════ */}
      {showDetailModal && selectedMeeting && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 120, padding: '16px' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', width: '100%', maxWidth: '480px', overflow: 'hidden', boxShadow: '0 24px 38px 3px rgba(0,0,0,0.18)', border: '1px solid #dadce0' }}>

            {/* Header actions */}
            <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px', borderBottom: '1px solid #f1f3f4' }}>
              {(selectedMeeting.organizer_id === userProfile?.id || isAdmin) && selectedMeeting.status !== 'CANCELLED' && (
                <>
                  <button onClick={() => handleOpenEditModal(selectedMeeting)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '6px', borderRadius: '50%', color: '#5f6368' }} className="hover:bg-slate-100" title="Chỉnh sửa">
                    <Edit3 size={18} />
                  </button>
                  <button onClick={() => handleCancelMeeting(selectedMeeting.meeting_id)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '6px', borderRadius: '50%', color: '#d93025' }} className="hover:bg-red-50" title="Hủy cuộc họp">
                    <Trash2 size={18} />
                  </button>
                </>
              )}
              <button onClick={() => setShowQrModal(true)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '6px', borderRadius: '50%', color: '#1a73e8' }} className="hover:bg-blue-50" title="QR Điểm danh">
                <QrCode size={18} />
              </button>
              <button onClick={() => setShowDetailModal(false)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '6px', borderRadius: '50%', color: '#5f6368' }} className="hover:bg-slate-100">
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                  <h3 style={{ fontSize: '20px', fontWeight: '500', color: '#1f1f1f', margin: '0 0 6px 0' }}>
                    {selectedMeeting.title}
                  </h3>
                  {(() => {
                    const now = getVietnamNow();
                    const st = new Date(selectedMeeting.start_time);
                    const et = new Date(selectedMeeting.end_time);
                    if (selectedMeeting.status === 'CANCELLED') {
                      return <span style={{ backgroundColor: '#fee2e2', color: '#dc2626', padding: '3px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold' }}>ĐÃ HỦY</span>;
                    }
                    if (selectedMeeting.status === 'COMPLETED' || now > et) {
                      return <span style={{ backgroundColor: '#f1f5f9', color: '#64748b', padding: '3px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold' }}>⚪ ĐÃ KẾT THÚC</span>;
                    }
                    if (now >= st && now <= et) {
                      return <span style={{ backgroundColor: '#dcfce7', color: '#15803d', padding: '3px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }} className="animate-pulse">🟢 ĐANG DIỄN RA</span>;
                    }
                    if (now < st) {
                      const diffM = Math.round((st.getTime() - now.getTime()) / (1000 * 60));
                      if (diffM <= 120) {
                        return <span style={{ backgroundColor: '#eff6ff', color: '#1d4ed8', padding: '3px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold' }}>🔔 SẮP DIỄN RA ({diffM}p)</span>;
                      }
                      return <span style={{ backgroundColor: '#f8fafc', color: '#475569', padding: '3px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold', border: '1px solid #e2e8f0' }}>📅 CHƯA BẮT ĐẦU</span>;
                    }
                    return <span style={{ backgroundColor: '#f1f5f9', color: '#64748b', padding: '3px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold' }}>⚪ ĐÃ KẾT THÚC</span>;
                  })()}
                </div>
                <div style={{ fontSize: '13px', color: '#3c4043', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Clock size={16} color="#5f6368" />
                  <span>
                    {new Date(selectedMeeting.start_time).toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'numeric' })}
                    {' · '}
                    {new Date(selectedMeeting.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – {new Date(selectedMeeting.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>

              {/* Nút Tham gia Google Meet */}
              {(selectedMeeting.meeting_type === 'ONLINE' || selectedMeeting.meeting_type === 'HYBRID' || selectedMeeting.meeting_link) && (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <a
                    href={selectedMeeting.meeting_link || 'https://meet.google.com'}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      flex: 1,
                      padding: '10px 16px',
                      backgroundColor: '#1a73e8',
                      color: 'white',
                      borderRadius: '8px',
                      fontWeight: '500',
                      fontSize: '14px',
                      textDecoration: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px'
                    }}
                    className="hover:bg-blue-700 transition-colors"
                  >
                    <Video size={18} />
                    Tham gia bằng Google Meet
                  </a>
                  <button
                    onClick={() => handleCopyLink(selectedMeeting.meeting_link)}
                    style={{ padding: '10px 14px', border: '1px solid #dadce0', backgroundColor: 'white', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#3c4043' }}
                    className="hover:bg-slate-50"
                  >
                    {copySuccess ? <Check size={16} color="#0d9488" /> : <Copy size={16} />}
                  </button>
                </div>
              )}

              {/* Đồng bộ lịch: Google Calendar & Outlook .ics (US #15) */}
              <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid #f1f3f4', paddingTop: '10px' }}>
                <button
                  onClick={() => handleExportSingleIcs(selectedMeeting)}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    border: '1px solid #c2e7ff',
                    backgroundColor: '#f0f7ff',
                    borderRadius: '8px',
                    color: '#0b57d0',
                    fontSize: '12px',
                    fontWeight: '600',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    cursor: 'pointer'
                  }}
                  className="hover:bg-blue-100 transition-colors"
                  title="Tải file .ics để mở và đồng bộ trên Outlook hoặc Apple Calendar (US #15)"
                >
                  <Download size={14} />
                  <span>Xuất .ics (Outlook)</span>
                </button>
                <button
                  onClick={() => handleOpenGoogleCalendarWeb(selectedMeeting)}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    border: '1px solid #dadce0',
                    backgroundColor: '#ffffff',
                    borderRadius: '8px',
                    color: '#3c4043',
                    fontSize: '12px',
                    fontWeight: '600',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    cursor: 'pointer'
                  }}
                  className="hover:bg-slate-50 transition-colors"
                  title="Thêm cuộc họp trực tiếp vào Google Calendar tài khoản cá nhân (US #15)"
                >
                  <ExternalLink size={14} />
                  <span>Google Calendar</span>
                </button>
              </div>

              {/* Phòng họp */}
              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <MapPin size={18} color="#5f6368" style={{ marginTop: '2px' }} />
                <div>
                  <div style={{ fontSize: '14px', fontWeight: '500', color: '#1f1f1f', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>{selectedMeeting.room?.room_name || `Phòng ${selectedMeeting.room_id}`}</span>
                    {(() => {
                      const now = getVietnamNow();
                      const st = new Date(selectedMeeting.start_time);
                      const et = new Date(selectedMeeting.end_time);
                      if (selectedMeeting.status !== 'CANCELLED' && now >= st && now <= et) {
                        return <span style={{ backgroundColor: '#fee2e2', color: '#dc2626', fontSize: '11px', fontWeight: 'bold', padding: '1px 6px', borderRadius: '4px' }}>🔴 Phòng đang họp</span>;
                      }
                      return null;
                    })()}
                  </div>
                  <div style={{ fontSize: '12px', color: '#70757a' }}>
                    {selectedMeeting.room?.location || 'Tòa nhà CNTT - ICTU'}
                  </div>
                </div>
              </div>

              {/* Người tổ chức */}
              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <Users size={18} color="#5f6368" style={{ marginTop: '2px' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '14px', fontWeight: '500', color: '#1f1f1f' }}>
                    {selectedMeeting.organizer?.full_name || 'Người tổ chức'}
                    <span style={{ fontSize: '11px', color: '#1a73e8', marginLeft: '6px', backgroundColor: '#e8f0fe', padding: '1px 6px', borderRadius: '4px' }}>
                      Chủ trì
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', color: '#70757a' }}>
                    {selectedMeeting.organizer?.email || 'Tổ chức cuộc họp'}
                  </div>
                </div>
              </div>

              {/* Danh sách người tham gia & Trạng thái RSVP (US #4) */}
              {selectedMeeting.participants && selectedMeeting.participants.length > 0 && (
                <div style={{ borderTop: '1px solid #f1f3f4', paddingTop: '10px' }}>
                  <div style={{ fontSize: '12px', fontWeight: '600', color: '#5f6368', marginBottom: '6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>Danh sách khách mời ({selectedMeeting.participants.length}):</span>
                    <span style={{ fontSize: '11px', color: '#10b981', fontWeight: '600' }}>
                      {selectedMeeting.participants.filter(p => p.rsvp_status === 'ACCEPTED').length} đã xác nhận
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '130px', overflowY: 'auto' }}>
                    {selectedMeeting.participants.map((p, pIdx) => {
                      const isAcc = p.rsvp_status === 'ACCEPTED';
                      const isDec = p.rsvp_status === 'DECLINED';
                      const isMe = (currentUserId && (p.user_id === currentUserId || p.user?.user_id === currentUserId)) ||
                        (currentUserEmail && p.user?.email && p.user.email.toLowerCase() === currentUserEmail);
                      return (
                        <div key={pIdx} style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          fontSize: '12px',
                          padding: '4px 8px',
                          borderRadius: '8px',
                          backgroundColor: isMe ? '#f8fafc' : 'transparent',
                          border: isMe ? '1px solid #e2e8f0' : 'none'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <div style={{
                              width: '24px',
                              height: '24px',
                              borderRadius: '50%',
                              backgroundColor: isMe ? '#1a73e8' : '#e2e8f0',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '10px',
                              fontWeight: 'bold',
                              color: isMe ? '#ffffff' : '#475569'
                            }}>
                              {(p.user?.full_name || 'U').slice(0, 1).toUpperCase()}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <span style={{ color: '#1e293b', fontWeight: isMe ? 'bold' : 'normal' }}>
                                {p.user?.full_name || p.user?.email || `Thành viên #${p.user_id}`}
                              </span>
                              {isMe && (
                                <span style={{ fontSize: '10px', color: '#1a73e8', backgroundColor: '#e8f0fe', padding: '1px 5px', borderRadius: '4px', fontWeight: 'bold' }}>
                                  Bạn
                                </span>
                              )}
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontWeight: '600',
                              backgroundColor: isAcc ? '#dcfce7' : isDec ? '#fee2e2' : '#fef3c7',
                              color: isAcc ? '#15803d' : isDec ? '#b91c1c' : '#b45309'
                            }}>
                              {isAcc ? '✓ Đã đồng ý' : isDec ? '✕ Từ chối' : 'Chờ phản hồi'}
                            </span>
                            {isMe && !isAcc && !isDec && (
                              <div style={{ display: 'flex', gap: '4px' }}>
                                <button
                                  onClick={() => handleRespondRsvp(selectedMeeting.meeting_id, 'ACCEPTED')}
                                  style={{ padding: '2px 8px', borderRadius: '4px', border: 'none', backgroundColor: '#16a34a', color: '#ffffff', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}
                                  className="hover:bg-green-700"
                                  title="Xác nhận tham gia"
                                >
                                  Đồng ý
                                </button>
                                <button
                                  onClick={() => handleRespondRsvp(selectedMeeting.meeting_id, 'DECLINED')}
                                  style={{ padding: '2px 8px', borderRadius: '4px', border: 'none', backgroundColor: '#dc2626', color: '#ffffff', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}
                                  className="hover:bg-red-700"
                                  title="Từ chối tham gia"
                                >
                                  Từ chối
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Thiết bị mượn kèm (US #12) */}
              {selectedMeeting.equipments && selectedMeeting.equipments.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', borderTop: '1px solid #f1f3f4', paddingTop: '10px' }}>
                  <Laptop size={16} color="#5f6368" style={{ marginTop: '2px' }} />
                  <div>
                    <span style={{ fontSize: '12px', fontWeight: '600', color: '#5f6368' }}>Thiết bị mượn kèm: </span>
                    <span style={{ fontSize: '12px', color: '#1e293b' }}>
                      {selectedMeeting.equipments.map(e => e.equipment_name).join(', ')}
                    </span>
                  </div>
                </div>
              )}

              {/* Cảnh báo nếu đã hủy (US #2) */}
              {selectedMeeting.status === 'CANCELLED' && (
                <div style={{ padding: '8px 12px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#991b1b', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <AlertCircle size={16} color="#ef4444" />
                  <span>Cuộc họp này đã bị hủy. Phòng họp và thiết bị đã được tự động giải phóng.</span>
                </div>
              )}

              {/* Mô tả */}
              {selectedMeeting.description && (
                <div style={{ fontSize: '13px', color: '#475569', lineHeight: 1.5, borderTop: '1px solid #f1f3f4', paddingTop: '10px' }}>
                  {selectedMeeting.description}
                </div>
              )}

              {/* Phần Xác nhận / Phản hồi tham gia cuộc họp (RSVP) */}
              {selectedMeeting.status !== 'CANCELLED' && (() => {
                const myParticipant = selectedMeeting.participants?.find(p =>
                  (currentUserId && (p.user_id === currentUserId || p.user?.user_id === currentUserId)) ||
                  (currentUserEmail && p.user?.email && p.user.email.toLowerCase() === currentUserEmail)
                );
                const isOrganizer = (currentUserId && selectedMeeting.organizer_id === currentUserId) ||
                  (currentUserEmail && selectedMeeting.organizer?.email && selectedMeeting.organizer.email.toLowerCase() === currentUserEmail);

                if (isOrganizer) {
                  return (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #f1f3f4', paddingTop: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#0369a1', fontWeight: '600' }}>
                        <ShieldCheck size={16} color="#0284c7" />
                        <span>👑 Bạn là người chủ trì cuộc họp này</span>
                      </div>
                      <button
                        onClick={() => handleCancelMeeting(selectedMeeting.meeting_id)}
                        style={{ padding: '5px 12px', borderRadius: '6px', border: '1px solid #fecaca', backgroundColor: '#fef2f2', color: '#dc2626', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}
                        className="hover:bg-red-100"
                      >
                        Hủy cuộc họp
                      </button>
                    </div>
                  );
                }

                if (myParticipant) {
                  if (myParticipant.rsvp_status === 'ACCEPTED') {
                    return (
                      <div style={{ borderTop: '1px solid #f1f3f4', paddingTop: '12px' }}>
                        <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#15803d', fontWeight: 'bold', fontSize: '13px' }}>
                            <CheckCircle2 size={18} color="#16a34a" />
                            <span>Bạn đã xác nhận tham gia cuộc họp này</span>
                          </div>
                          <button
                            onClick={() => handleRespondRsvp(selectedMeeting.meeting_id, 'DECLINED')}
                            style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid #e2e8f0', backgroundColor: '#ffffff', color: '#dc2626', fontSize: '12px', fontWeight: '500', cursor: 'pointer' }}
                            className="hover:bg-red-50"
                          >
                            Đổi ý: Từ chối
                          </button>
                        </div>
                      </div>
                    );
                  }

                  if (myParticipant.rsvp_status === 'DECLINED') {
                    return (
                      <div style={{ borderTop: '1px solid #f1f3f4', paddingTop: '12px' }}>
                        <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#b91c1c', fontWeight: 'bold', fontSize: '13px' }}>
                            <XCircle size={18} color="#dc2626" />
                            <span>Bạn đã từ chối tham gia cuộc họp này</span>
                          </div>
                          <button
                            onClick={() => handleRespondRsvp(selectedMeeting.meeting_id, 'ACCEPTED')}
                            style={{ padding: '4px 10px', borderRadius: '6px', border: 'none', backgroundColor: '#16a34a', color: '#ffffff', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}
                            className="hover:bg-green-700"
                          >
                            Đổi ý: Đồng ý tham gia
                          </button>
                        </div>
                      </div>
                    );
                  }

                  // Trạng thái PENDING (Chờ phản hồi)
                  return (
                    <div style={{ borderTop: '1px solid #f1f3f4', paddingTop: '12px' }}>
                      <div style={{ backgroundColor: '#fef3c7', border: '1px solid #fde68a', borderRadius: '12px', padding: '12px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#92400e', fontWeight: 'bold', fontSize: '13px', marginBottom: '6px' }}>
                          <Mail size={16} color="#d97706" />
                          <span>Bạn được mời tham gia cuộc họp này! Vui lòng xác nhận:</span>
                        </div>
                        <p style={{ fontSize: '12px', color: '#78350f', margin: '0 0 10px 0', lineHeight: 1.4 }}>
                          Nhấn <strong>"Đồng ý tham gia"</strong> để xác nhận sự có mặt của bạn, hoặc <strong>"Từ chối"</strong> nếu bạn không thể tham dự.
                        </p>
                        <div style={{ display: 'flex', gap: '10px' }}>
                          <button
                            onClick={() => handleRespondRsvp(selectedMeeting.meeting_id, 'ACCEPTED')}
                            style={{
                              flex: 1,
                              padding: '8px 14px',
                              borderRadius: '8px',
                              border: 'none',
                              backgroundColor: '#16a34a',
                              color: '#ffffff',
                              fontWeight: 'bold',
                              fontSize: '13px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '6px',
                              boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                            }}
                            className="hover:bg-green-700"
                          >
                            <Check size={16} /> Đồng ý tham gia
                          </button>
                          <button
                            onClick={() => handleRespondRsvp(selectedMeeting.meeting_id, 'DECLINED')}
                            style={{
                              flex: 1,
                              padding: '8px 14px',
                              borderRadius: '8px',
                              border: 'none',
                              backgroundColor: '#dc2626',
                              color: '#ffffff',
                              fontWeight: 'bold',
                              fontSize: '13px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '6px',
                              boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                            }}
                            className="hover:bg-red-700"
                          >
                            <X size={16} /> Từ chối
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                }

                // Fallback nếu không thuộc participant list
                return (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #f1f3f4', paddingTop: '14px' }}>
                    <span style={{ fontSize: '13px', color: '#5f6368' }}>Bạn sẽ tham gia chứ?</span>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => handleRespondRsvp(selectedMeeting.meeting_id, 'ACCEPTED')}
                        style={{ padding: '6px 16px', borderRadius: '9999px', border: '1px solid #dadce0', backgroundColor: 'white', color: '#1a73e8', fontWeight: '500', fontSize: '13px', cursor: 'pointer' }}
                        className="hover:bg-blue-50"
                      >
                        Có
                      </button>
                      <button
                        onClick={() => handleRespondRsvp(selectedMeeting.meeting_id, 'DECLINED')}
                        style={{ padding: '6px 16px', borderRadius: '9999px', border: '1px solid #dadce0', backgroundColor: 'white', color: '#d93025', fontWeight: '500', fontSize: '13px', cursor: 'pointer' }}
                        className="hover:bg-red-50"
                      >
                        Không
                      </button>
                    </div>
                  </div>
                );
              })()}

            </div>

          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          4.1. MODAL LỊCH SỬ CÁC CUỘC HỌP ĐÃ THAM GIA (US #6)
          ══════════════════════════════════════════════════════════════════════ */}
      {showHistoryModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 130, padding: '16px' }}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '680px',
            maxHeight: '85vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 24px 38px 3px rgba(0,0,0,0.18)',
            border: '1px solid #dadce0',
            overflow: 'hidden'
          }}>
            {/* Header */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e8eaed', display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#f8fafc' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: '#e0f2fe', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <BookOpen size={18} color="#0284c7" />
                </div>
                <div>
                  <h3 style={{ fontSize: '17px', fontWeight: '600', color: '#1e293b', margin: 0 }}>
                    Lịch sử các cuộc họp đã tham gia
                  </h3>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                    Theo dõi các phiên họp đã diễn ra, trạng thái điểm danh và biên bản cuộc họp
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  onClick={handleOpenHistoryModal}
                  style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '6px', borderRadius: '50%', color: '#64748b' }}
                  className="hover:bg-slate-200"
                  title="Làm mới lịch sử"
                >
                  <RefreshCw size={16} className={loadingHistory ? 'animate-spin' : ''} />
                </button>
                <button
                  onClick={() => setShowHistoryModal(false)}
                  style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '6px', borderRadius: '50%', color: '#64748b' }}
                  className="hover:bg-slate-200"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Search & Filter Bar */}
            <div style={{ padding: '12px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: '#ffffff' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <Search size={16} color="#94a3b8" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="text"
                  placeholder="Tìm kiếm theo tiêu đề, người tổ chức, phòng..."
                  value={historySearchTerm}
                  onChange={(e) => setHistorySearchTerm(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px 8px 34px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
              <span style={{ fontSize: '12px', color: '#64748b', whiteSpace: 'nowrap' }}>
                Tổng: <strong>{historyMeetings.length}</strong> cuộc họp
              </span>
            </div>

            {/* Meeting History List */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px', backgroundColor: '#f8fafc' }}>
              {loadingHistory ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: '#64748b', fontSize: '14px' }}>
                  <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 8px auto', display: 'block' }} color="#1a73e8" />
                  Đang tải lịch sử các cuộc họp...
                </div>
              ) : historyMeetings.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: '#64748b' }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px auto' }}>
                    <CalendarIcon size={24} color="#94a3b8" />
                  </div>
                  <div style={{ fontWeight: '600', fontSize: '15px', color: '#334155' }}>Chưa có cuộc họp nào trong lịch sử</div>
                  <div style={{ fontSize: '13px', color: '#94a3b8', marginTop: '4px' }}>Các cuộc họp sau khi kết thúc hoặc diễn ra sẽ được lưu trữ tại đây.</div>
                </div>
              ) : (
                historyMeetings
                  .filter(m => {
                    if (!historySearchTerm.trim()) return true;
                    const q = historySearchTerm.toLowerCase();
                    return (
                      (m.title || '').toLowerCase().includes(q) ||
                      (m.room_name || '').toLowerCase().includes(q) ||
                      (m.organizer_name || '').toLowerCase().includes(q)
                    );
                  })
                  .map((item, idx) => {
                    const st = new Date(item.start_time);
                    const et = new Date(item.end_time);
                    const isCancelled = item.status === 'CANCELLED';

                    return (
                      <div
                        key={idx}
                        style={{
                          backgroundColor: '#ffffff',
                          borderRadius: '12px',
                          border: '1px solid #e2e8f0',
                          padding: '16px',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '10px',
                          transition: 'border-color 0.15s'
                        }}
                        className="hover:border-blue-300"
                      >
                        {/* Top row: Date & status */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{
                              padding: '2px 8px',
                              borderRadius: '6px',
                              fontSize: '11px',
                              fontWeight: '600',
                              backgroundColor: '#e0f2fe',
                              color: '#0369a1'
                            }}>
                              {st.toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })}
                            </span>
                            <span style={{ fontSize: '12px', color: '#64748b' }}>
                              {st.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – {et.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>

                          <span style={{
                            padding: '2px 8px',
                            borderRadius: '12px',
                            fontSize: '11px',
                            fontWeight: '600',
                            backgroundColor: isCancelled ? '#fee2e2' : item.attendance_status === 'ACCEPTED' ? '#dcfce7' : '#f1f5f9',
                            color: isCancelled ? '#b91c1c' : item.attendance_status === 'ACCEPTED' ? '#15803d' : '#475569'
                          }}>
                            {isCancelled ? 'Đã hủy' : item.attendance_status === 'ACCEPTED' ? 'Đã tham gia' : 'Đã kết thúc'}
                          </span>
                        </div>

                        {/* Title */}
                        <h4 style={{ fontSize: '15px', fontWeight: '600', color: '#1e293b', margin: 0 }}>
                          {item.title}
                        </h4>

                        {/* Details row: Room & Organizer */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', fontSize: '12px', color: '#64748b' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <MapPin size={14} color="#64748b" />
                            <span>{item.room_name || 'Phòng họp'}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Users size={14} color="#64748b" />
                            <span>Chủ trì: <strong>{item.organizer_name || 'Chủ tọa'}</strong></span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <UserCheck size={14} color="#10b981" />
                            <span>{item.participant_count || 1} người tham dự</span>
                          </div>
                        </div>

                        {/* Description or Notes */}
                        {item.description && (
                          <div style={{ fontSize: '12px', color: '#475569', backgroundColor: '#f8fafc', padding: '8px 10px', borderRadius: '6px', lineHeight: 1.4 }}>
                            {item.description}
                          </div>
                        )}

                        {/* Footer action */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px', paddingTop: '6px', borderTop: '1px solid #f1f5f9' }}>
                          {item.meeting_link && (
                            <a
                              href={item.meeting_link}
                              target="_blank"
                              rel="noreferrer"
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#0284c7', textDecoration: 'none', padding: '4px 8px' }}
                              className="hover:underline"
                            >
                              <Video size={13} />
                              <span>Link họp</span>
                            </a>
                          )}
                          <button
                            onClick={() => {
                              setShowHistoryModal(false);
                              handleOpenCreateModal();
                              setFormTitle(`Theo dõi: ${item.title}`);
                              setFormDescription(`Cuộc họp nối tiếp từ phiên họp ngày ${st.toLocaleDateString('vi-VN')}`);
                            }}
                            style={{
                              padding: '5px 12px',
                              borderRadius: '6px',
                              border: '1px solid #cbd5e1',
                              backgroundColor: '#ffffff',
                              color: '#334155',
                              fontSize: '12px',
                              fontWeight: '500',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                            className="hover:bg-slate-50"
                          >
                            <CalendarDays size={13} />
                            <span>Lên lịch tiếp theo</span>
                          </button>
                        </div>
                      </div>
                    );
                  })
              )}
            </div>

            {/* Modal Footer */}
            <div style={{ padding: '12px 20px', borderTop: '1px solid #e8eaed', display: 'flex', justifyContent: 'flex-end', backgroundColor: '#ffffff' }}>
              <button
                onClick={() => setShowHistoryModal(false)}
                style={{
                  padding: '8px 20px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: '#1a73e8',
                  color: 'white',
                  fontWeight: '500',
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
                className="hover:bg-blue-700 active:scale-95 transition-all"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          5. MODAL MÃ QR ĐIỂM DANH & CHECK-OUT TRẢ PHÒNG (US #27)
          ══════════════════════════════════════════════════════════════════════ */}
      {showQrModal && selectedMeeting && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 140, padding: '16px' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', width: '100%', maxWidth: '480px', padding: '24px', boxShadow: '0 20px 40px rgba(0,0,0,0.2)', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <QrCode size={22} color="#1a73e8" />
                <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#1f1f1f', margin: 0 }}>
                  Điểm danh & Trả phòng QR (US #27)
                </h3>
              </div>
              <button onClick={() => setShowQrModal(false)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#5f6368', padding: '4px' }}>
                <X size={20} />
              </button>
            </div>

            {/* QR Feedback Alert */}
            {qrFeedback && (
              <div style={{
                marginBottom: '14px',
                padding: '10px 14px',
                borderRadius: '8px',
                backgroundColor: qrFeedback.type === 'success' ? '#ecfdf5' : '#fef2f2',
                border: `1px solid ${qrFeedback.type === 'success' ? '#a7f3d0' : '#fecaca'}`,
                color: qrFeedback.type === 'success' ? '#065f46' : '#991b1b',
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <CheckCircle2 size={16} />
                <span>{qrFeedback.text}</span>
              </div>
            )}

            {/* Meeting Info & Status Badge */}
            <div style={{ backgroundColor: '#f8fafc', padding: '12px 16px', borderRadius: '10px', border: '1px solid #e2e8f0', marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <span style={{ fontSize: '15px', fontWeight: 'bold', color: '#0f172a' }}>
                  {selectedMeeting.title}
                </span>
                <span style={{
                  backgroundColor: selectedMeeting.status === 'COMPLETED' ? '#f1f5f9' : selectedMeeting.status === 'IN_PROGRESS' ? '#dcfce7' : '#eff6ff',
                  color: selectedMeeting.status === 'COMPLETED' ? '#475569' : selectedMeeting.status === 'IN_PROGRESS' ? '#15803d' : '#1d4ed8',
                  padding: '3px 8px',
                  borderRadius: '6px',
                  fontSize: '11.5px',
                  fontWeight: '600'
                }}>
                  {selectedMeeting.status === 'COMPLETED' ? 'ĐÃ KẾT THÚC' : selectedMeeting.status === 'IN_PROGRESS' ? 'ĐANG DIỄN RA' : 'ĐÃ LÊN LỊCH'}
                </span>
              </div>
              <div style={{ fontSize: '12.5px', color: '#64748b' }}>
                📍 {selectedMeeting.room?.room_name || `Phòng #${selectedMeeting.room_id}`} · ⏰ {new Date(selectedMeeting.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(selectedMeeting.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>

            {/* QR Code Graphic */}
            <div style={{ textAlign: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'inline-block', padding: '14px', backgroundColor: 'white', borderRadius: '12px', border: '1px solid #dadce0', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                <QRCodeSVG
                  value={`meetinghub://checkin?meeting_id=${selectedMeeting.meeting_id}&token=${selectedMeeting.qr_token || 'TOKEN_' + selectedMeeting.meeting_id}`}
                  size={160}
                  level="H"
                  includeMargin={true}
                />
              </div>
              <p style={{ fontSize: '11.5px', color: '#64748b', marginTop: '6px' }}>
                Mã QR hiển thị tại cửa phòng họp. Người tham gia có thể quét bằng camera điện thoại.
              </p>
            </div>

            {/* Action Buttons: Check-in & Check-out */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
              <button
                type="button"
                onClick={() => handleQrCheckin(selectedMeeting.meeting_id)}
                disabled={qrActionLoading || selectedMeeting.status === 'COMPLETED'}
                style={{
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: selectedMeeting.status === 'COMPLETED' ? '#94a3b8' : '#2563eb',
                  color: 'white',
                  fontWeight: '600',
                  fontSize: '13px',
                  cursor: selectedMeeting.status === 'COMPLETED' ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  boxShadow: '0 2px 6px rgba(37,99,235,0.2)'
                }}
              >
                <CheckCircle2 size={16} />
                <span>{qrActionLoading ? 'Đang xử lý...' : 'Quét QR Check-in'}</span>
              </button>

              <button
                type="button"
                onClick={() => handleQrCheckout(selectedMeeting.meeting_id)}
                disabled={qrActionLoading || selectedMeeting.status === 'COMPLETED'}
                style={{
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  backgroundColor: selectedMeeting.status === 'COMPLETED' ? '#f1f5f9' : '#ffffff',
                  color: selectedMeeting.status === 'COMPLETED' ? '#94a3b8' : '#dc2626',
                  fontWeight: '600',
                  fontSize: '13px',
                  cursor: selectedMeeting.status === 'COMPLETED' ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                <Clock size={16} />
                <span>Check-out Trả phòng</span>
              </button>
            </div>

            {/* Attendance Live Breakdown */}
            <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#0f172a' }}>
                  👥 Danh sách điểm danh thực tế
                </span>
                <span style={{ fontSize: '12px', fontWeight: '600', color: '#059669' }}>
                  {attendanceData ? `${attendanceData.checked_in_count}/${attendanceData.total_participants} người (${attendanceData.checkin_rate_pct}%)` : 'Đang tải...'}
                </span>
              </div>

              {/* Progress bar */}
              {attendanceData && (
                <div style={{ width: '100%', height: '6px', backgroundColor: '#e2e8f0', borderRadius: '3px', overflow: 'hidden', marginBottom: '10px' }}>
                  <div style={{ width: `${attendanceData.checkin_rate_pct}%`, height: '100%', backgroundColor: '#10b981', transition: 'width 0.3s' }} />
                </div>
              )}

              {/* Participants list */}
              <div style={{ maxHeight: '130px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {attendanceData?.participants?.map((p: any) => (
                  <div key={p.participant_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', backgroundColor: '#f8fafc', borderRadius: '6px', fontSize: '12px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontWeight: '600', color: '#1e293b' }}>
                        {p.full_name} {p.is_organizer && '👑 (Chủ trì)'}
                      </span>
                      <span style={{ fontSize: '11px', color: '#64748b' }}>{p.email}</span>
                    </div>

                    <div>
                      {p.checked_out_at ? (
                        <span style={{ backgroundColor: '#f1f5f9', color: '#475569', padding: '2px 6px', borderRadius: '4px', fontSize: '10.5px', fontWeight: '600' }}>
                          Đã trả phòng ({new Date(p.checked_out_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
                        </span>
                      ) : p.checked_in_at ? (
                        <span style={{ backgroundColor: '#dcfce7', color: '#15803d', padding: '2px 6px', borderRadius: '4px', fontSize: '10.5px', fontWeight: '600' }}>
                          Đã check-in ({new Date(p.checked_in_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
                        </span>
                      ) : (
                        <span style={{ backgroundColor: '#fef2f2', color: '#b91c1c', padding: '2px 6px', borderRadius: '4px', fontSize: '10.5px' }}>
                          Chưa check-in
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={() => setShowQrModal(false)}
              style={{ width: '100%', padding: '9px', borderRadius: '8px', border: 'none', backgroundColor: '#f1f5f9', color: '#475569', fontWeight: '600', fontSize: '13px', cursor: 'pointer', marginTop: '16px' }}
            >
              Đóng
            </button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          6. MODAL TRỢ GIÚP (HELP CENTER - SCREENSHOT 3)
          ══════════════════════════════════════════════════════════════════════ */}
      {showHelpModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 140, padding: '16px' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', width: '100%', maxWidth: '520px', padding: '24px', boxShadow: '0 20px 40px rgba(0,0,0,0.2)', border: '1px solid #dadce0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <BookOpen size={22} color="#1a73e8" />
                <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#1f1f1f', margin: 0 }}>Trung tâm trợ giúp MeetingHub</h3>
              </div>
              <button onClick={() => setShowHelpModal(false)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#5f6368' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '13px', color: '#3c4043', maxHeight: '420px', overflowY: 'auto', paddingRight: '4px' }}>
              <div style={{ padding: '12px', backgroundColor: '#f8f9fa', borderRadius: '8px', border: '1px solid #e8eaed' }}>
                <div style={{ fontWeight: '600', color: '#1a73e8', marginBottom: '6px' }}>⌨️ Phím tắt nhanh:</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', fontSize: '12px' }}>
                  <div><kbd style={{ padding: '2px 6px', background: '#e8eaed', borderRadius: '4px' }}>D</kbd> : Xem theo Ngày</div>
                  <div><kbd style={{ padding: '2px 6px', background: '#e8eaed', borderRadius: '4px' }}>W</kbd> : Xem theo Tuần</div>
                  <div><kbd style={{ padding: '2px 6px', background: '#e8eaed', borderRadius: '4px' }}>M</kbd> : Xem theo Tháng</div>
                  <div><kbd style={{ padding: '2px 6px', background: '#e8eaed', borderRadius: '4px' }}>T</kbd> : Quay về Hôm nay</div>
                </div>
              </div>

              <div style={{ padding: '12px', backgroundColor: '#f8f9fa', borderRadius: '8px', border: '1px solid #e8eaed' }}>
                <div style={{ fontWeight: '600', color: '#1f1f1f', marginBottom: '4px' }}>📅 Cách đặt lịch họp nhanh:</div>
                <div>Nhấp trực tiếp chuột vào bất kỳ ô thời gian nào trên lưới lịch hoặc bấm nút <strong>+ Tạo</strong> lớn ở góc trên bên trái.</div>
              </div>

              <div style={{ padding: '12px', backgroundColor: '#f8f9fa', borderRadius: '8px', border: '1px solid #e8eaed' }}>
                <div style={{ fontWeight: '600', color: '#1f1f1f', marginBottom: '4px' }}>📹 Hội nghị trực tuyến Google Meet:</div>
                <div>Mọi cuộc họp được hỗ trợ tạo sẵn liên kết Google Meet bảo mật để học trực tuyến hoặc họp nhóm từ xa.</div>
              </div>

              <div style={{ padding: '12px', backgroundColor: '#f8f9fa', borderRadius: '8px', border: '1px solid #e8eaed' }}>
                <div style={{ fontWeight: '600', color: '#1f1f1f', marginBottom: '4px' }}>📱 Điểm danh thông minh qua mã QR:</div>
                <div>Bấm vào thẻ cuộc họp để mở mã QR duy nhất. Sinh viên hoặc người tham dự có thể quét mã bằng điện thoại để điểm danh tức thì.</div>
              </div>
            </div>

            <button
              onClick={() => setShowHelpModal(false)}
              style={{ width: '100%', padding: '10px', borderRadius: '8px', border: 'none', backgroundColor: '#1a73e8', color: 'white', fontWeight: '500', fontSize: '14px', cursor: 'pointer', marginTop: '20px' }}
            >
              Đã hiểu
            </button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          7. MODAL ĐÀO TẠO (TRAINING COURSES - SCREENSHOT 3)
          ══════════════════════════════════════════════════════════════════════ */}
      {showTrainingModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 140, padding: '16px' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', width: '100%', maxWidth: '580px', padding: '24px', boxShadow: '0 20px 40px rgba(0,0,0,0.2)', border: '1px solid #dadce0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Laptop size={22} color="#1a73e8" />
                <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#1f1f1f', margin: 0 }}>Tài liệu & Video đào tạo người dùng</h3>
              </div>
              <button onClick={() => setShowTrainingModal(false)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#5f6368' }}>
                <X size={20} />
              </button>
            </div>

            <p style={{ fontSize: '13px', color: '#5f6368', marginBottom: '16px' }}>
              Các khóa học trực quan giúp giảng viên và sinh viên khai thác tối đa hệ thống MeetingHub:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '400px', overflowY: 'auto' }}>
              {[
                { title: 'Khóa 1: Quản trị lịch họp & Google Meet', duration: '15 phút • Căn bản', desc: 'Thiết lập cuộc họp định kỳ, đồng bộ múi giờ và mời thành viên.' },
                { title: 'Khóa 2: Điều phối phòng họp & Thiết bị', duration: '20 phút • Trung cấp', desc: 'Kiểm tra xung đột phòng, phê duyệt mượn micro và máy chiếu.' },
                { title: 'Khóa 3: Tối ưu công việc với Google Tasks', duration: '10 phút • Căn bản', desc: 'Gắn dấu sao, theo dõi hạn chót đồ án và checklist công việc.' },
                { title: 'Khóa 4: Điểm danh QR & Báo cáo thống kê', duration: '12 phút • Nâng cao', desc: 'Xuất dữ liệu tham gia cuộc họp, đánh giá mức độ chuyên cần.' },
              ].map((c, i) => (
                <div key={i} style={{ padding: '12px 16px', borderRadius: '8px', border: '1px solid #e8eaed', backgroundColor: '#f8f9fa', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: '600', color: '#1f1f1f' }}>{c.title}</div>
                    <div style={{ fontSize: '12px', color: '#1a73e8', marginTop: '2px' }}>{c.duration}</div>
                    <div style={{ fontSize: '12px', color: '#5f6368', marginTop: '4px' }}>{c.desc}</div>
                  </div>
                  <button
                    onClick={() => alert(`Đang mở video bài giảng: ${c.title}`)}
                    style={{ padding: '6px 14px', borderRadius: '6px', border: '1px solid #1a73e8', backgroundColor: '#ffffff', color: '#1a73e8', fontSize: '12px', fontWeight: '500', cursor: 'pointer', whiteSpace: 'nowrap' }}
                    className="hover:bg-blue-50"
                  >
                    Xem bài giảng
                  </button>
                </div>
              ))}
            </div>

            <button
              onClick={() => setShowTrainingModal(false)}
              style={{ width: '100%', padding: '10px', borderRadius: '8px', border: 'none', backgroundColor: '#1a73e8', color: 'white', fontWeight: '500', fontSize: '14px', cursor: 'pointer', marginTop: '20px' }}
            >
              Đóng
            </button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          8. MODAL GỬI Ý KIẾN PHẢN HỒI (FEEDBACK - SCREENSHOT 3)
          ══════════════════════════════════════════════════════════════════════ */}
      {showFeedbackModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 140, padding: '16px' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', width: '100%', maxWidth: '480px', padding: '24px', boxShadow: '0 20px 40px rgba(0,0,0,0.2)', border: '1px solid #dadce0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Send size={20} color="#1a73e8" />
                <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#1f1f1f', margin: 0 }}>Gửi ý kiến phản hồi</h3>
              </div>
              <button onClick={() => { setShowFeedbackModal(false); setFeedbackSuccess(false); }} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#5f6368' }}>
                <X size={20} />
              </button>
            </div>

            {feedbackSuccess ? (
              <div style={{ textAlign: 'center', padding: '24px 0' }}>
                <CheckCircle2 size={48} color="#1e8e3e" style={{ margin: '0 auto 12px auto' }} />
                <div style={{ fontSize: '16px', fontWeight: '600', color: '#1f1f1f' }}>Cảm ơn bạn đã đóng góp ý kiến!</div>
                <div style={{ fontSize: '13px', color: '#5f6368', marginTop: '6px' }}>Phản hồi của bạn đã được chuyển tới đội ngũ phát triển MeetingHub.</div>
                <button
                  onClick={() => { setShowFeedbackModal(false); setFeedbackSuccess(false); }}
                  style={{ marginTop: '20px', padding: '8px 24px', borderRadius: '8px', border: 'none', backgroundColor: '#1a73e8', color: 'white', fontWeight: '500', fontSize: '13px', cursor: 'pointer' }}
                >
                  Hoàn tất
                </button>
              </div>
            ) : (
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#3c4043', marginBottom: '6px' }}>
                  Loại phản hồi:
                </label>
                <select
                  value={feedbackCategory}
                  onChange={(e) => setFeedbackCategory(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #dadce0', fontSize: '13px', outline: 'none', marginBottom: '14px' }}
                >
                  <option value="Góp ý tính năng">💡 Đề xuất tính năng mới</option>
                  <option value="Báo cáo lỗi kỹ thuật">🐛 Báo cáo sự cố hoặc lỗi kỹ thuật</option>
                  <option value="Trải nghiệm giao diện">🎨 Góp ý về giao diện Google Calendar</option>
                  <option value="Khác">📝 Ý kiến đóng góp khác</option>
                </select>

                <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#3c4043', marginBottom: '6px' }}>
                  Mô tả chi tiết:
                </label>
                <textarea
                  value={feedbackContent}
                  onChange={(e) => setFeedbackContent(e.target.value)}
                  placeholder="Hãy chia sẻ trải nghiệm hoặc nội dung bạn mong muốn cải thiện..."
                  rows={4}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #dadce0', fontSize: '13px', outline: 'none', resize: 'vertical', fontFamily: 'inherit', marginBottom: '12px' }}
                />

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#5f6368', marginBottom: '20px' }}>
                  <input type="checkbox" defaultChecked id="cb-diag" />
                  <label htmlFor="cb-diag">Đính kèm ảnh chụp màn hình chẩn đoán hệ thống</label>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                  <button
                    onClick={() => setShowFeedbackModal(false)}
                    style={{ padding: '8px 18px', borderRadius: '8px', border: '1px solid #dadce0', background: 'transparent', color: '#5f6368', fontSize: '13px', cursor: 'pointer' }}
                  >
                    Hủy
                  </button>
                  <button
                    onClick={() => {
                      if (!feedbackContent.trim()) {
                        alert('Vui lòng nhập nội dung phản hồi trước khi gửi.');
                        return;
                      }
                      setFeedbackSuccess(true);
                      setFeedbackContent('');
                    }}
                    style={{ padding: '8px 22px', borderRadius: '8px', border: 'none', backgroundColor: '#1a73e8', color: 'white', fontWeight: '500', fontSize: '13px', cursor: 'pointer' }}
                  >
                    Gửi phản hồi
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          9. MODAL CÀI ĐẶT LỊCH (SETTINGS - SCREENSHOT 4)
          ══════════════════════════════════════════════════════════════════════ */}
      {showSettingsModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 140, padding: '16px' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', width: '100%', maxWidth: '520px', padding: '24px', boxShadow: '0 20px 40px rgba(0,0,0,0.2)', border: '1px solid #dadce0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Settings size={22} color="#1a73e8" />
                <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#1f1f1f', margin: 0 }}>Cài đặt Lịch họp</h3>
              </div>
              <button onClick={() => setShowSettingsModal(false)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#5f6368' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#3c4043', marginBottom: '6px' }}>
                  Múi giờ chính:
                </label>
                <select
                  value={settingTimezone}
                  onChange={(e) => setSettingTimezone(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #dadce0', fontSize: '13px', outline: 'none' }}
                >
                  <option value="GMT+07:00 (Hà Nội, Băng Cốc)">GMT+07:00 Giờ chuẩn Đông Dương (Hà Nội, Băng Cốc)</option>
                  <option value="GMT+08:00 (Singapore, Bắc Kinh)">GMT+08:00 Giờ chuẩn Singapore, Bắc Kinh</option>
                  <option value="GMT+09:00 (Tokyo, Seoul)">GMT+09:00 Giờ chuẩn Tokyo, Seoul</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#3c4043', marginBottom: '6px' }}>
                  Thời lượng sự kiện mặc định:
                </label>
                <select
                  value={settingDefaultDuration}
                  onChange={(e) => setSettingDefaultDuration(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #dadce0', fontSize: '13px', outline: 'none' }}
                >
                  <option value="15">15 phút</option>
                  <option value="30">30 phút (Mặc định)</option>
                  <option value="60">60 phút (1 giờ)</option>
                  <option value="90">90 phút (1.5 giờ)</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#3c4043', marginBottom: '6px' }}>
                  Thông báo nhắc nhở trước:
                </label>
                <select
                  value={settingDefaultReminder}
                  onChange={(e) => setSettingDefaultReminder(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #dadce0', fontSize: '13px', outline: 'none' }}
                >
                  <option value="5">5 phút trước</option>
                  <option value="10">10 phút trước (Chuẩn Google Calendar)</option>
                  <option value="15">15 phút trước</option>
                  <option value="30">30 phút trước</option>
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', backgroundColor: '#f8f9fa', borderRadius: '8px', border: '1px solid #e8eaed' }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: '500', color: '#1f1f1f' }}>Tự động thêm phòng Google Meet</div>
                  <div style={{ fontSize: '12px', color: '#5f6368' }}>Tự động sinh liên kết họp trực tuyến cho mọi sự kiện mới</div>
                </div>
                <input
                  type="checkbox"
                  checked={settingAutoMeet}
                  onChange={(e) => setSettingAutoMeet(e.target.checked)}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '24px' }}>
              <button
                onClick={() => setShowSettingsModal(false)}
                style={{ padding: '8px 18px', borderRadius: '8px', border: '1px solid #dadce0', background: 'transparent', color: '#5f6368', fontSize: '13px', cursor: 'pointer' }}
              >
                Hủy
              </button>
              <button
                onClick={() => {
                  setShowSettingsModal(false);
                  alert('Đã cập nhật cài đặt lịch họp thành công!');
                }}
                style={{ padding: '8px 24px', borderRadius: '8px', border: 'none', backgroundColor: '#1a73e8', color: 'white', fontWeight: '500', fontSize: '13px', cursor: 'pointer' }}
              >
                Lưu cài đặt
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          10. MODAL THÙNG RÁC (TRASH - SCREENSHOT 4)
          ══════════════════════════════════════════════════════════════════════ */}
      {showTrashModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 140, padding: '16px' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', width: '100%', maxWidth: '560px', padding: '24px', boxShadow: '0 20px 40px rgba(0,0,0,0.2)', border: '1px solid #dadce0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Trash2 size={22} color="#d93025" />
                <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#1f1f1f', margin: 0 }}>Thùng rác</h3>
              </div>
              <button onClick={() => setShowTrashModal(false)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#5f6368' }}>
                <X size={20} />
              </button>
            </div>

            <p style={{ fontSize: '13px', color: '#5f6368', marginBottom: '16px' }}>
              Các sự kiện và công việc đã xóa được lưu tạm tại đây. Bạn có thể khôi phục lại lịch hoặc xóa vĩnh viễn:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '360px', overflowY: 'auto' }}>
              {trashItems.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '36px 0', color: '#70757a', fontSize: '13px' }}>
                  Thùng rác trống. Không có mục nào bị xóa.
                </div>
              ) : (
                trashItems.map((item) => (
                  <div key={item.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderRadius: '8px', border: '1px solid #e8eaed', backgroundColor: '#f8f9fa' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      {item.type === 'meeting' ? <CalendarDays size={18} color="#1a73e8" /> : <CheckCircle2 size={18} color="#1e8e3e" />}
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: '500', color: '#1f1f1f' }}>{item.title}</div>
                        <div style={{ fontSize: '12px', color: '#70757a', marginTop: '2px' }}>{item.meta || 'Đã xóa'} • {item.deletedAt}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => handleRestoreTrash(item.id)}
                        style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #1a73e8', backgroundColor: '#ffffff', color: '#1a73e8', fontSize: '12px', fontWeight: '500', cursor: 'pointer' }}
                        className="hover:bg-blue-50"
                      >
                        Khôi phục
                      </button>
                      <button
                        onClick={() => handlePermanentDeleteTrash(item.id)}
                        style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #dadce0', backgroundColor: '#ffffff', color: '#d93025', fontSize: '12px', cursor: 'pointer' }}
                        className="hover:bg-red-50"
                        title="Xóa vĩnh viễn"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f1f3f4', paddingTop: '16px', marginTop: '16px' }}>
              {trashItems.length > 0 ? (
                <button
                  onClick={handleEmptyTrash}
                  style={{ border: 'none', background: 'transparent', color: '#d93025', fontSize: '13px', fontWeight: '500', cursor: 'pointer' }}
                >
                  Dọn sạch thùng rác
                </button>
              ) : <div></div>}
              <button
                onClick={() => setShowTrashModal(false)}
                style={{ padding: '8px 20px', borderRadius: '8px', border: 'none', backgroundColor: '#1a73e8', color: 'white', fontWeight: '500', fontSize: '13px', cursor: 'pointer' }}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          11. MODAL HÌNH THỨC & GIAO DIỆN (APPEARANCE - SCREENSHOT 4)
          ══════════════════════════════════════════════════════════════════════ */}
      {showAppearanceModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 140, padding: '16px' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', width: '100%', maxWidth: '460px', padding: '24px', boxShadow: '0 20px 40px rgba(0,0,0,0.2)', border: '1px solid #dadce0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Palette size={22} color="#1a73e8" />
                <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#1f1f1f', margin: 0 }}>Hình thức & Bố cục</h3>
              </div>
              <button onClick={() => setShowAppearanceModal(false)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#5f6368' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#3c4043', marginBottom: '8px' }}>
                  Mật độ thông tin:
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div
                    onClick={() => setSettingDensity('comfortable')}
                    style={{ padding: '12px', borderRadius: '8px', border: `2px solid ${settingDensity === 'comfortable' ? '#1a73e8' : '#dadce0'}`, backgroundColor: settingDensity === 'comfortable' ? '#e8f0fe' : '#ffffff', cursor: 'pointer', textAlign: 'center' }}
                  >
                    <div style={{ fontSize: '14px', fontWeight: '600', color: '#1f1f1f' }}>Thoải mái</div>
                    <div style={{ fontSize: '12px', color: '#5f6368', marginTop: '4px' }}>Chuẩn Google Calendar</div>
                  </div>
                  <div
                    onClick={() => setSettingDensity('compact')}
                    style={{ padding: '12px', borderRadius: '8px', border: `2px solid ${settingDensity === 'compact' ? '#1a73e8' : '#dadce0'}`, backgroundColor: settingDensity === 'compact' ? '#e8f0fe' : '#ffffff', cursor: 'pointer', textAlign: 'center' }}
                  >
                    <div style={{ fontSize: '14px', fontWeight: '600', color: '#1f1f1f' }}>Thu gọn</div>
                    <div style={{ fontSize: '12px', color: '#5f6368', marginTop: '4px' }}>Hiển thị nhiều giờ hơn</div>
                  </div>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#3c4043', marginBottom: '8px' }}>
                  Bảng màu sự kiện:
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {['#1a73e8', '#0b8043', '#f4511e', '#8e24aa', '#e67c73', '#3f51b5'].map((color, i) => (
                    <div key={i} style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: color, cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                  ))}
                </div>
              </div>
            </div>

            <button
              onClick={() => { setShowAppearanceModal(false); alert('Đã áp dụng hình thức hiển thị mới!'); }}
              style={{ width: '100%', padding: '10px', borderRadius: '8px', border: 'none', backgroundColor: '#1a73e8', color: 'white', fontWeight: '500', fontSize: '14px', cursor: 'pointer', marginTop: '24px' }}
            >
              Áp dụng
            </button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          12. MODAL TẢI TIỆN ÍCH BỔ SUNG (ADD-ONS - SCREENSHOT 4)
          ══════════════════════════════════════════════════════════════════════ */}
      {showAddonsModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 140, padding: '16px' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', width: '100%', maxWidth: '580px', padding: '24px', boxShadow: '0 20px 40px rgba(0,0,0,0.2)', border: '1px solid #dadce0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Layers size={22} color="#1a73e8" />
                <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#1f1f1f', margin: 0 }}>Google Workspace Marketplace</h3>
              </div>
              <button onClick={() => setShowAddonsModal(false)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#5f6368' }}>
                <X size={20} />
              </button>
            </div>

            <p style={{ fontSize: '13px', color: '#5f6368', marginBottom: '16px' }}>
              Các tiện ích bổ sung và tích hợp giúp đồng bộ hệ thống lịch họp với các nền tảng khác:
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              {[
                { name: 'Google Meet Pro', desc: 'Họp trực tuyến HD không giới hạn', installed: true, icon: '📹' },
                { name: 'Zoom for Calendar', desc: 'Tự động tạo phòng họp Zoom', installed: false, icon: '🎥' },
                { name: 'Microsoft Teams Link', desc: 'Đồng bộ phòng họp Microsoft', installed: false, icon: '💼' },
                { name: 'QR Attendance Mobile', desc: 'Điểm danh camera thông minh', installed: true, icon: '📱' },
              ].map((addon, i) => (
                <div key={i} style={{ padding: '14px', borderRadius: '10px', border: '1px solid #e8eaed', backgroundColor: '#f8f9fa', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: '24px', marginBottom: '6px' }}>{addon.icon}</div>
                    <div style={{ fontSize: '14px', fontWeight: '600', color: '#1f1f1f' }}>{addon.name}</div>
                    <div style={{ fontSize: '12px', color: '#5f6368', marginTop: '2px' }}>{addon.desc}</div>
                  </div>
                  <button
                    onClick={() => alert(`${addon.installed ? 'Tiện ích đã được kích hoạt!' : 'Đã cài đặt tiện ích: ' + addon.name}`)}
                    style={{
                      marginTop: '12px',
                      padding: '6px 12px',
                      borderRadius: '6px',
                      border: addon.installed ? '1px solid #dadce0' : 'none',
                      backgroundColor: addon.installed ? '#ffffff' : '#1a73e8',
                      color: addon.installed ? '#5f6368' : '#ffffff',
                      fontSize: '12px',
                      fontWeight: '500',
                      cursor: 'pointer'
                    }}
                  >
                    {addon.installed ? 'Đã cài đặt ✓' : 'Cài đặt'}
                  </button>
                </div>
              ))}
            </div>

            <button
              onClick={() => setShowAddonsModal(false)}
              style={{ width: '100%', padding: '10px', borderRadius: '8px', border: 'none', backgroundColor: '#1a73e8', color: 'white', fontWeight: '500', fontSize: '14px', cursor: 'pointer', marginTop: '20px' }}
            >
              Đóng
            </button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          13. MODAL HỒ SƠ TÀI KHOẢN CÁ NHÂN (MEETINGHUB ICTU PROFILE)
          ══════════════════════════════════════════════════════════════════════ */}
      {showAccountManagerModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 220, padding: '16px' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '24px', width: '100%', maxWidth: '560px', padding: '24px 28px', boxShadow: '0 20px 48px rgba(0,0,0,0.25)', border: '1px solid #dadce0', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e8eaed', paddingBottom: '16px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '30px', height: '30px', borderRadius: '50%', backgroundColor: '#0066b2', color: '#fff', fontSize: '11px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>ICTU</div>
                <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#1f1f1f', margin: 0 }}>
                  Hồ sơ tài khoản - MeetingHub ICTU
                </h3>
              </div>
              <button onClick={() => setShowAccountManagerModal(false)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#5f6368' }}>
                <X size={20} />
              </button>
            </div>

            {profileSuccessMsg && (
              <div style={{ backgroundColor: '#e6f4ea', color: '#137333', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 size={18} />
                <span>{profileSuccessMsg}</span>
              </div>
            )}

            <form onSubmit={handleSaveMeetingHubProfile}>
              {/* Avatar section */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '20px', padding: '14px', backgroundColor: '#f8f9fa', borderRadius: '16px' }}>
                <div style={{ width: '70px', height: '70px', borderRadius: '50%', overflow: 'hidden', flexShrink: 0, border: '2px solid #0066b2' }}>
                  <img src={editAvatar || activeAccount.avatar} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { (e.target as HTMLImageElement).src = '/hoang_phuong_avatar.png'; }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '15px', fontWeight: '600', color: '#1f1f1f' }}>Ảnh đại diện hồ sơ</div>
                  <div style={{ fontSize: '12px', color: '#5f6368', marginTop: '2px', marginBottom: '8px' }}>Ảnh nhận diện trong hệ thống cuộc họp</div>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 12px', backgroundColor: '#ffffff', border: '1px solid #dadce0', borderRadius: '6px', fontSize: '12px', fontWeight: '500', color: '#0066b2', cursor: 'pointer' }}>
                    <Edit2 size={12} />
                    <span>Tải ảnh mới từ máy</span>
                    <input
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            if (reader.result) setEditAvatar(reader.result as string);
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                  </label>
                </div>
              </div>

              {/* Form fields */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#444746', marginBottom: '4px' }}>
                    Họ và tên
                  </label>
                  <input
                    type="text"
                    value={editFullName}
                    onChange={(e) => setEditFullName(e.target.value)}
                    required
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #dadce0', outline: 'none', fontSize: '14px' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#444746', marginBottom: '4px' }}>
                    Email trường (Tài khoản định danh hệ thống)
                  </label>
                  <input
                    type="email"
                    value={activeAccount.email}
                    disabled
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e0e0e0', backgroundColor: '#f1f3f4', outline: 'none', fontSize: '14px', color: '#5f6368' }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#444746', marginBottom: '4px' }}>
                      Mã cán bộ / Người dùng
                    </label>
                    <input
                      type="text"
                      value={editStudentId}
                      onChange={(e) => setEditStudentId(e.target.value)}
                      style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #dadce0', outline: 'none', fontSize: '14px' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#444746', marginBottom: '4px' }}>
                      Số điện thoại
                    </label>
                    <input
                      type="text"
                      value={editPhone}
                      onChange={(e) => setEditPhone(e.target.value)}
                      style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #dadce0', outline: 'none', fontSize: '14px' }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#444746', marginBottom: '4px' }}>
                    Đơn vị / Khoa trực thuộc
                  </label>
                  <input
                    type="text"
                    value={editDepartment}
                    onChange={(e) => setEditDepartment(e.target.value)}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #dadce0', outline: 'none', fontSize: '14px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px' }}>
                <button
                  type="button"
                  onClick={() => setShowAccountManagerModal(false)}
                  style={{ padding: '9px 18px', borderRadius: '8px', border: '1px solid #dadce0', backgroundColor: '#ffffff', color: '#3c4043', fontSize: '14px', fontWeight: '500', cursor: 'pointer' }}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  style={{ padding: '9px 24px', borderRadius: '8px', border: 'none', backgroundColor: '#0066b2', color: '#ffffff', fontSize: '14px', fontWeight: '500', cursor: 'pointer' }}
                >
                  Lưu thay đổi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          14. MODAL THÊM / CHUYỂN ĐỔI TÀI KHOẢN (ADD/SWITCH ACCOUNT REAL API)
          ══════════════════════════════════════════════════════════════════════ */}
      {showAddAccountModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 220, padding: '16px' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '24px', width: '100%', maxWidth: '480px', padding: '24px', boxShadow: '0 20px 48px rgba(0,0,0,0.25)', border: '1px solid #dadce0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e8eaed', paddingBottom: '14px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <UserPlus size={20} color="#0066b2" />
                <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#1f1f1f', margin: 0 }}>
                  Chuyển đổi tài khoản hệ thống
                </h3>
              </div>
              <button onClick={() => setShowAddAccountModal(false)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#5f6368' }}>
                <X size={20} />
              </button>
            </div>

            <p style={{ fontSize: '13px', color: '#5f6368', marginBottom: '14px' }}>
              Chọn tài khoản đã cấp trong cơ sở dữ liệu để chuyển đổi phiên làm việc ngay:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[
                { name: 'Hoàng Thanh Phương', email: 'hoangphuong@ictu.edu.vn', role: 'Người dùng (Khoa CNTT)', avatar: '/hoang_phuong_avatar.png' },
                { name: 'Hoàng Phương', email: 'admin@ictu.edu.vn', role: 'Quản trị viên (Admin)', avatar: '/phuong_account_avatar.png' },
                { name: 'TS. Nguyễn Minh Quân', email: 'dtc245180080@ictu.edu.vn', role: 'Giảng viên', avatar: '' }
              ].map((acc, idx) => (
                <div
                  key={idx}
                  onClick={() => {
                    setShowAddAccountModal(false);
                    handleSwitchAccount(acc.email);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 14px',
                    borderRadius: '12px',
                    border: '1px solid #e2e8f0',
                    backgroundColor: '#ffffff',
                    cursor: 'pointer',
                    transition: 'all 0.15s'
                  }}
                  className="hover:bg-blue-50 hover:border-blue-300"
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '50%', overflow: 'hidden', backgroundColor: '#e2e8f0', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {acc.avatar ? (
                        <img src={acc.avatar} alt={acc.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#0066b2' }}>{acc.name.charAt(0)}</span>
                      )}
                    </div>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: '600', color: '#0f172a' }}>{acc.name}</div>
                      <div style={{ fontSize: '12px', color: '#64748b' }}>{acc.email} • <span style={{ color: '#0284c7' }}>{acc.role}</span></div>
                    </div>
                  </div>
                  <div style={{ padding: '6px 12px', borderRadius: '8px', backgroundColor: '#e0f2fe', color: '#0284c7', fontSize: '12px', fontWeight: '600' }}>
                    Chọn
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => setShowAddAccountModal(false)}
              style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #dadce0', backgroundColor: '#ffffff', color: '#3c4043', fontWeight: '500', fontSize: '14px', cursor: 'pointer', marginTop: '16px' }}
            >
              Đóng
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
