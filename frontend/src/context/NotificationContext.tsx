import { createContext, useContext, useState, useEffect, useMemo } from 'react';
import type { ReactNode } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import api from '../services/api';
import { useAuth } from './AuthContext';
import { getStorage } from '../utils/syncHelper';
import '../components/notifications.css';

export interface Notification {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  type: 'meeting_reminder' | 'system';
  isRead: boolean;
  link: string;
  meetingId?: number;
  startTime?: string;
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  openNotification: (notification: Notification) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const account = user ? `${user.id || ''}-${user.email || ''}` : '';
  const [reminders, setReminders] = useState<Notification[]>([]);
  const [general, setGeneral] = useState<any[]>(() => getStorage('system_notifications', []));
  const [readIds, setReadIds] = useState<string[]>([]);
  const [selected, setSelected] = useState<Notification | null>(null);
  const [meeting, setMeeting] = useState<any>(null);
  const [detailError, setDetailError] = useState('');
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    setReminders([]);
    setSelected(null);
    setActionError('');
    setReadIds(getStorage<string[]>(`notification_reads_${account}`, []));
    toast.dismiss();
    if (!account) return;
    let active = true;
    let busy = false;
    const controller = new AbortController();
    const refresh = async () => {
      const token = sessionStorage.getItem('token') || sessionStorage.getItem('access_token') || localStorage.getItem('token') || localStorage.getItem('access_token');
      if (!token || busy) return;
      busy = true;
      try {
        const { data } = await api.get<Notification[]>('/notifications', { signal: controller.signal, timeout: 15000 });
        if (!active) return;
        setReminders(data);
        const seenKey = `meeting_reminder_toasts_${account}`;
        let seen: string[] = [];
        try { seen = JSON.parse(sessionStorage.getItem(seenKey) || '[]'); } catch { /* Reset malformed cache. */ }
        for (const n of data) {
          if (!n.isRead && n.startTime && Date.parse(n.startTime) > Date.now() && !seen.includes(n.id)) {
            seen.push(n.id);
            toast((t) => (
              <button onClick={() => { setSelected(n); toast.dismiss(t.id); }} className="meeting-reminder-toast">
                <strong>{n.title}</strong><br />{n.description}<br />
                <span className="text-blue-600 text-xs">Xem chi tiết cuộc họp</span>
              </button>
            ), { id: `reminder-${account}-${n.id}`, duration: 12000, icon: '🔔' });
          }
        }
        sessionStorage.setItem(seenKey, JSON.stringify(seen.slice(-200)));
      } catch (error) {
        if (active) console.error('Không thể tải thông báo lịch họp', error);
      } finally { busy = false; }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 30000);
    window.addEventListener('focus', refresh);
    window.addEventListener('request-updated', refresh);
    return () => {
      active = false;
      controller.abort();
      window.clearInterval(timer);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('request-updated', refresh);
    };
  }, [account]);

  useEffect(() => {
    const sync = () => {
      setGeneral(getStorage('system_notifications', []));
      setReadIds(getStorage<string[]>(`notification_reads_${account}`, []));
    };
    window.addEventListener('appDataSync', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('appDataSync', sync);
      window.removeEventListener('storage', sync);
    };
  }, [account]);

  const notifications = useMemo<Notification[]>(() => {
    if (!account) return [];
    const announcements: Notification[] = general.map(n => ({
      id: `system-${n.id}`, title: n.title, description: n.content || n.desc || '',
      createdAt: n.createdAt || '', type: 'system', isRead: readIds.includes(`system-${n.id}`), link: '/notifications'
    }));
    return [...reminders, ...announcements].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  }, [account, reminders, general, readIds]);

  const saveReads = (ids: string[]) => {
    setReadIds(ids);
    localStorage.setItem(`notification_reads_${account}`, JSON.stringify(ids));
  };

  const markAsRead = async (id: string) => {
    setActionError('');
    try {
      if (id.startsWith('system-')) saveReads([...new Set([...readIds, id])]);
      else {
        await api.patch(`/notifications/${id}/read`);
        setReminders(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
      }
    } catch { setActionError('Không thể đánh dấu đã đọc. Vui lòng thử lại.'); }
  };

  const markAllAsRead = async () => {
    setActionError('');
    try {
      await api.patch('/notifications/read-all');
      setReminders(prev => prev.map(n => ({ ...n, isRead: true })));
      saveReads(notifications.filter(n => n.type === 'system').map(n => n.id));
    } catch { setActionError('Không thể đánh dấu đã đọc. Vui lòng thử lại.'); }
  };

  useEffect(() => {
    setMeeting(null);
    setDetailError('');
    if (!selected?.meetingId) return;
    let active = true;
    void api.get(`/meetings/${selected.meetingId}`).then(({ data }) => {
      if (active) setMeeting(data);
    }).catch(() => { if (active) setDetailError('Không thể tải cuộc họp. Cuộc họp có thể đã bị xóa.'); });
    void markAsRead(selected.id);
    return () => { active = false; };
  }, [selected]);

  useEffect(() => {
    if (!selected) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelected(null);
      if (event.key === 'Tab') {
        const buttons = document.querySelectorAll<HTMLElement>('.meeting-reminder-dialog button, .meeting-reminder-dialog a');
        const first = buttons[0];
        const last = buttons[buttons.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      window.removeEventListener('keydown', closeOnEscape);
      previousFocus?.focus();
    };
  }, [selected]);

  const openNotification = (notification: Notification) => {
    if (notification.meetingId) setSelected(notification);
    else void markAsRead(notification.id);
  };
  const validMeeting = meeting && ['SCHEDULED', 'APPROVED'].includes(meeting.status);
  const safeLink = meeting?.meeting_link && /^https?:\/\//i.test(meeting.meeting_link) ? meeting.meeting_link : null;

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount: notifications.filter(n => !n.isRead).length, markAsRead, markAllAsRead, openNotification }}>
      {children}
      <Toaster position="top-right" />
      {actionError && <div role="alert" className="notification-error"><button onClick={() => setActionError('')}>{actionError} ×</button></div>}
      {selected && (
        <div className="meeting-reminder-overlay" onClick={() => setSelected(null)}>
          <section role="dialog" aria-modal="true" aria-labelledby="reminder-detail-title" className="meeting-reminder-dialog" onClick={e => e.stopPropagation()}>
            <div className="meeting-reminder-dialog-header"><h2 id="reminder-detail-title" className="font-bold text-lg">Nhắc lịch họp</h2><button autoFocus aria-label="Đóng chi tiết" onClick={() => setSelected(null)}>✕</button></div>
            {detailError ? <p role="alert" className="mt-4 text-red-600">{detailError}</p> : !meeting ? <p className="mt-4">Đang tải cuộc họp...</p> : (
              <div className="meeting-reminder-dialog-body">
                <h3 className="font-bold">{meeting.title}</h3>
                <p>Thời gian: {new Date(meeting.start_time.endsWith('Z') || /[+-]\d\d:\d\d$/.test(meeting.start_time) ? meeting.start_time : `${meeting.start_time}+07:00`).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })} (giờ Việt Nam)</p>
                <p>Phòng: {meeting.room?.room_name || 'Trực tuyến'}</p>
                <p>Người tổ chức: {meeting.organizer?.full_name}</p>
                {meeting.description && <p>{meeting.description}</p>}
                {!validMeeting && <p className="text-amber-700">Cuộc họp hiện có trạng thái: {meeting.status}</p>}
                {validMeeting && safeLink && <a className="meeting-reminder-join" href={safeLink} target="_blank" rel="noopener noreferrer">Tham gia cuộc họp</a>}
              </div>
            )}
          </section>
        </div>
      )}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) throw new Error('useNotifications must be used within NotificationProvider');
  return context;
}
