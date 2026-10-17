import React, { useState } from 'react';
import { Calendar, Wrench, CheckCheck } from 'lucide-react';
import { getStorage, useDataSync } from '../utils/syncHelper';

export const NotificationDropdown: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [notifications, setNotifications] = useState<any[]>(() => getStorage<any[]>('system_notifications', []));

  useDataSync('system_notifications', () => {
    setNotifications(getStorage<any[]>('system_notifications', []));
  });


  return (
    <div 
      style={{ position: 'absolute', top: '100%', right: 0, marginTop: '8px', zIndex: 9999 }}
      className="w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden text-slate-800 text-left"
    >
      <div className="p-3.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-bold text-slate-900 text-sm">Thông báo</span>
          <span className="bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">{notifications.length}</span>
        </div>
        <button onClick={onClose} className="text-xs text-blue-600 font-semibold hover:underline flex items-center gap-1">
          <CheckCheck className="w-3.5 h-3.5" /> Đánh dấu đã đọc
        </button>
      </div>

      <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
        {notifications.map((n) => (
          <div key={n.id} className="p-3 hover:bg-slate-50 transition-colors flex items-start gap-3 bg-blue-50/20 cursor-pointer">
            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0 mt-0.5">
              <Calendar className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-slate-900 truncate">{n.title}</p>
              <p className="text-xs text-slate-600 line-clamp-2 mt-0.5">{n.content || n.desc}</p>
              <span className="text-[10px] text-slate-400 mt-1 block">{n.createdAt ? new Date(n.createdAt).toLocaleString('vi-VN') : n.time}</span>
            </div>
            <div className="w-2 h-2 rounded-full bg-blue-600 shrink-0 mt-1" />
          </div>
        ))}
      </div>

      <a href="/notifications" className="block py-2.5 bg-slate-50 hover:bg-slate-100 border-t border-slate-100 text-center text-xs font-bold text-blue-600">
        Xem tất cả thông báo
      </a>
    </div>
  );
};
