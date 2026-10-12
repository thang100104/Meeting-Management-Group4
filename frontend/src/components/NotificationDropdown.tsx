import { Calendar, CheckCheck, Bell } from 'lucide-react';
import { useNotifications } from '../context/NotificationContext';

export const NotificationDropdown = ({ onClose }: { onClose: () => void }) => {
  const { notifications, unreadCount, markAllAsRead, openNotification } = useNotifications();
  return (
    <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: '8px', zIndex: 9999 }} className="notification-panel">
      <div className="notification-panel-header">
        <span className="font-bold text-slate-900 text-sm">Thông báo ({unreadCount} chưa đọc)</span>
        <button onClick={() => void markAllAsRead()} className="notification-read-all"><CheckCheck className="w-3.5 h-3.5" /> Đọc tất cả</button>
      </div>
      <div className="notification-list">
        {notifications.length === 0 && <p className="notification-empty">Chưa có thông báo. Lịch họp đã duyệt sẽ được nhắc trước 15 phút.</p>}
        {notifications.map(n => (
          <button key={n.id} onClick={() => { openNotification(n); if (n.meetingId) onClose(); }} className={`notification-row ${n.isRead ? '' : 'notification-row-unread'}`}>
            <div className="notification-icon">{n.type === 'meeting_reminder' ? <Calendar className="w-4 h-4" /> : <Bell className="w-4 h-4" />}</div>
            <div className="notification-text">
              <p className="notification-title">{n.title}</p>
              <p className="notification-description">{n.description}</p>
              <span className="notification-time">{n.createdAt ? new Date(n.createdAt).toLocaleString('vi-VN') : ''}</span>
            </div>
            {!n.isRead && <span aria-label="Chưa đọc" className="notification-unread-dot" />}
          </button>
        ))}
      </div>
      <button onClick={onClose} className="notification-panel-footer">Đóng thông báo</button>
    </div>
  );
};
