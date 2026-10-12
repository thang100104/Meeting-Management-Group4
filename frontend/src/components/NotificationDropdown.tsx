import React, { useState, useEffect } from 'react';
import { 
  Calendar, CheckCheck, X, MessageSquare, CheckCircle2, 
  XCircle, Bell, Clock, ChevronRight
} from 'lucide-react';
import { 
  getNotificationsForRole, markAllAsReadForRole, markSingleAsRead, 
  type SystemNotification, type UserRole 
} from '../utils/notificationService';

interface NotificationDropdownProps {
  onClose: () => void;
  show?: boolean;
  role?: UserRole | string;
}

export const NotificationDropdown: React.FC<NotificationDropdownProps> = ({ 
  onClose, 
  show, 
  role = 'admin' 
}) => {
  if (show === false) return null;

  const [notifications, setNotifications] = useState<SystemNotification[]>(() => 
    getNotificationsForRole(role)
  );

  const refreshNotifs = () => {
    setNotifications(getNotificationsForRole(role));
  };

  useEffect(() => {
    refreshNotifs();

    window.addEventListener('storage', refreshNotifs);
    window.addEventListener('appDataSync', refreshNotifs);
    window.addEventListener('system-notification-updated', refreshNotifs);

    return () => {
      window.removeEventListener('storage', refreshNotifs);
      window.removeEventListener('appDataSync', refreshNotifs);
      window.removeEventListener('system-notification-updated', refreshNotifs);
    };
  }, [role]);

  const handleMarkAllAsRead = (e: React.MouseEvent) => {
    e.stopPropagation();
    markAllAsReadForRole(role);
    refreshNotifs();
  };

  const handleItemClick = (id: string | number) => {
    markSingleAsRead(id);
    refreshNotifs();
  };

  const getNotificationIcon = (n: SystemNotification) => {
    switch (n.type) {
      case 'message':
        return (
          <div className="w-8 h-8 rounded-full bg-violet-100 text-violet-600 flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
            <MessageSquare className="w-4 h-4" />
          </div>
        );
      case 'approval':
        return (
          <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        );
      case 'rejection':
        return (
          <div className="w-8 h-8 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
            <XCircle className="w-4 h-4" />
          </div>
        );
      case 'booking':
        return (
          <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
            <Clock className="w-4 h-4" />
          </div>
        );
      case 'schedule':
      default:
        return (
          <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
            <Calendar className="w-4 h-4" />
          </div>
        );
    }
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <div 
      style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, zIndex: 9999 }}
      className="w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden text-slate-800 text-left animate-in fade-in zoom-in-95 duration-150"
    >
      {/* Header */}
      <div className="p-3.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-bold text-slate-900 text-sm">Thông báo</span>
          {unreadCount > 0 && (
            <span className="bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
              {unreadCount} mới
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {unreadCount > 0 && (
            <button 
              type="button"
              onClick={handleMarkAllAsRead} 
              className="text-xs text-blue-600 font-semibold hover:underline flex items-center gap-1 transition-colors"
            >
              <CheckCheck className="w-3.5 h-3.5" /> Đánh dấu đã đọc
            </button>
          )}
          <button 
            type="button"
            onClick={onClose} 
            className="text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 p-1 rounded-md transition-colors"
            title="Đóng"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* List */}
      <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
        {notifications.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
            <Bell className="w-8 h-8 text-slate-300 stroke-[1.5]" />
            <span>Không có thông báo nào dành cho bạn</span>
          </div>
        ) : (
          notifications.map((n) => (
            <div 
              key={n.id} 
              className={`p-3.5 hover:bg-slate-50/80 transition-all flex items-start gap-3 cursor-pointer ${
                n.isRead ? 'bg-white opacity-80' : 'bg-blue-50/25 border-l-2 border-blue-600'
              }`}
              onClick={() => handleItemClick(n.id)}
            >
              {getNotificationIcon(n)}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className={`text-xs ${n.isRead ? 'font-semibold text-slate-800' : 'font-bold text-slate-900'} truncate`}>
                    {n.title}
                  </p>
                  {!n.isRead && (
                    <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0" />
                  )}
                </div>
                <p className="text-xs text-slate-600 line-clamp-2 mt-1 leading-relaxed">
                  {n.content}
                </p>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-[10px] text-slate-400">
                    {n.createdAt ? new Date(n.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + ' ' + new Date(n.createdAt).toLocaleDateString('vi-VN') : ''}
                  </span>
                  {n.senderName && (
                    <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                      Từ: {n.senderName}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="p-2 bg-slate-50 border-t border-slate-100 text-center">
        <button 
          type="button"
          onClick={onClose} 
          className="w-full py-1.5 rounded-lg hover:bg-slate-100 text-xs font-bold text-slate-600 hover:text-slate-900 transition-colors"
        >
          Đóng
        </button>
      </div>
    </div>
  );
};


