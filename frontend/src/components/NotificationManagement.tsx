import React, { useState, useEffect } from 'react';
import { Bell, AlertTriangle, FileText, Users, Plus, Search, Trash2, Send, Eye, MessageSquare } from 'lucide-react';
import { getStorage, setStorage, useDataSync } from '../utils/syncHelper';

interface Notification {
  id: number;
  title: string;
  content: string;
  type: string;
  priority: string;
  target: string;
  createdAt: string;
  sender: string;
}

const NOTIFICATION_TYPES = [
  'Thông báo chung',
  'Bảo trì phòng',
  'Thay đổi lịch',
  'Khẩn cấp'
];

const TARGETS = [
  'Tất cả người dùng',
  'Sinh viên',
  'Giảng viên giảng dạy',
  'Cán bộ quản lý phòng'
];

const PRIORITIES = [
  { id: 'normal', label: 'Thường' },
  { id: 'high', label: 'Quan trọng' },
  { id: 'urgent', label: 'Khẩn cấp' }
];

const PRESETS = [
  { icon: '🔧', label: 'Bảo trì', type: 'Bảo trì phòng', title: 'Bảo trì phòng họp', content: 'Hệ thống phòng họp Tầng 3 sẽ tạm dừng phục vụ để bảo trì.' },
  { icon: '📅', label: 'Đổi lịch', type: 'Thay đổi lịch', title: 'Thay đổi lịch họp đột xuất', content: 'Do cuộc họp đột xuất, lịch đăng ký phòng A1 chiều nay sẽ chuyển sang B2.' },
  { icon: '📜', label: 'Nội quy', type: 'Thông báo chung', title: 'Nhắc nhở nội quy', content: 'Vui lòng tắt thiết bị điện và dọn vệ sinh sau khi kết thúc.' }
];

export default function NotificationManagement() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [type, setType] = useState('Thông báo chung');
  const [priority, setPriority] = useState('normal');
  const [target, setTarget] = useState('Tất cả người dùng');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');

  useDataSync('system_notifications', () => {
    setNotifications(getStorage<Notification[]>('system_notifications', []));
  });

  useEffect(() => {
    setNotifications(getStorage<Notification[]>('system_notifications', []));
  }, []);

  const handleSend = () => {
    if (!title.trim() || !content.trim()) {
      alert("Vui lòng nhập đầy đủ tiêu đề và nội dung.");
      return;
    }

    const newNotif: Notification = {
      id: Date.now(),
      title: title.trim(),
      content: content.trim(),
      type,
      priority,
      target,
      createdAt: new Date().toISOString(),
      sender: 'Admin'
    };

    const updated = [newNotif, ...notifications];
    setNotifications(updated);
    setStorage('system_notifications', updated);

    setTitle('');
    setContent('');
    setPriority('normal');
    alert("Đã tạo và gửi thông báo thành công!");
  };

  const handleClear = () => {
    setType('Thông báo chung');
    setPriority('normal');
    setTarget('Tất cả người dùng');
    setTitle('');
    setContent('');
  };

  const handleDelete = (id: number) => {
    if (!window.confirm("Bạn có chắc muốn xóa thông báo này khỏi lịch sử?")) return;
    const updated = notifications.filter(n => n.id !== id);
    setNotifications(updated);
    localStorage.setItem('admin_notifications', JSON.stringify(updated));
  };

  const applyPreset = (preset: typeof PRESETS[0]) => {
    setType(preset.type);
    setTitle(preset.title);
    setContent(preset.content);
  };

  const formatDate = (isoString: string) => {
    const d = new Date(isoString);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')} ${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
  };

  const filteredHistory = notifications.filter(n => {
    const matchSearch = n.title.toLowerCase().includes(searchQuery.toLowerCase()) || n.content.toLowerCase().includes(searchQuery.toLowerCase());
    const matchType = filterType === 'all' || n.type === filterType;
    const matchPriority = filterPriority === 'all' || n.priority === filterPriority;
    return matchSearch && matchType && matchPriority;
  });

  const urgentCount = notifications.filter(n => n.priority === 'urgent').length;
  const generalCount = notifications.filter(n => n.type === 'Thông báo chung').length;

  return (
    <div className="min-h-screen bg-slate-50/50 p-6 md:p-8 space-y-6 text-slate-800">
      
      {/* 1. HEADER & ACTION BUTTON */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="font-bold text-xl text-slate-900">Quản lý & Gửi thông báo hệ thống</h1>
          <p className="text-sm text-slate-500 mt-1">Soạn thảo, quản lý chiến dịch và gửi thông báo tới người dùng</p>
        </div>
        <button 
          onClick={() => { document.getElementById('title-input')?.focus(); }}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-medium text-sm shadow-sm transition-all flex items-center gap-2"
        >
          <Plus size={18} />
          Tạo thông báo mới
        </button>
      </div>

      {/* 2. HÀNG THỐNG KÊ NHANH (Grid 4 cột) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Tổng */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Tổng thông báo</p>
            <h3 className="text-2xl font-bold text-slate-900">{notifications.length}</h3>
          </div>
          <div className="bg-slate-100 p-2.5 rounded-xl text-slate-600">
            <Bell size={20} />
          </div>
        </div>
        
        {/* Card 2: Urgent */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Tin khẩn cấp</p>
            <h3 className="text-2xl font-bold text-slate-900">{urgentCount}</h3>
          </div>
          <div className="bg-rose-50 p-2.5 rounded-xl text-rose-600">
            <AlertTriangle size={20} />
          </div>
        </div>

        {/* Card 3: General */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Thông báo chung</p>
            <h3 className="text-2xl font-bold text-slate-900">{generalCount}</h3>
          </div>
          <div className="bg-blue-50 p-2.5 rounded-xl text-blue-600">
            <FileText size={20} />
          </div>
        </div>

        {/* Card 4: Đối tượng */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Mạng lưới nhận</p>
            <h3 className="text-lg font-bold text-slate-900 leading-tight">Toàn bộ<br/>Hệ thống</h3>
          </div>
          <div className="bg-emerald-50 p-2.5 rounded-xl text-emerald-600">
            <Users size={20} />
          </div>
        </div>
      </div>

      {/* 3. THANH TÌM KIẾM & BỘ LỌC */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-sm flex flex-wrap gap-3 items-center justify-between">
        <div className="relative w-full md:w-96 flex-1 md:flex-none">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input 
            type="text" 
            placeholder="Tìm theo tiêu đề, nội dung thông báo..." 
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200/80 rounded-xl text-xs font-medium focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <select 
            className="flex-1 md:w-48 px-3.5 py-2.5 bg-slate-50 border border-slate-200/80 rounded-xl text-xs font-medium text-slate-600 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
          >
            <option value="all">Tất cả loại thông báo</option>
            {NOTIFICATION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select 
            className="flex-1 md:w-44 px-3.5 py-2.5 bg-slate-50 border border-slate-200/80 rounded-xl text-xs font-medium text-slate-600 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
          >
            <option value="all">Tất cả mức độ ưu tiên</option>
            {PRIORITIES.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </div>
      </div>

      {/* 4. BỐ CỤC CHÍNH (Split 2 Cột) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        
        {/* CỘT TRÁI: FORM SOẠN THẢO (col-span-5) */}
        <div className="xl:col-span-5 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-5 h-fit">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <MessageSquare size={16} className="text-blue-600" /> Form soạn thảo
            </h2>
          </div>
          
          <div className="space-y-4">
            
            {/* LOẠI & ƯU TIÊN */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-2">Loại thông báo</label>
                <select 
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200/80 focus:bg-white focus:ring-2 focus:ring-blue-500 rounded-xl text-xs font-medium outline-none transition-all"
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                >
                  {NOTIFICATION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-2">Mức ưu tiên</label>
                <select 
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200/80 focus:bg-white focus:ring-2 focus:ring-blue-500 rounded-xl text-xs font-medium outline-none transition-all"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                >
                  {PRIORITIES.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                </select>
              </div>
            </div>

            {/* GỬI TỚI */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-2">Gửi tới</label>
              <select 
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200/80 focus:bg-white focus:ring-2 focus:ring-blue-500 rounded-xl text-xs font-medium outline-none transition-all"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
              >
                {TARGETS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            {/* PRESETS MẪU */}
            <div className="pt-1">
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Mẫu soạn nhanh</label>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {PRESETS.map((p, idx) => (
                  <button
                    key={idx}
                    onClick={() => applyPreset(p)}
                    className="flex-shrink-0 flex items-center gap-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 text-[11px] font-medium px-2.5 py-1.5 rounded-lg border border-slate-200/60 transition-all"
                  >
                    {p.icon} {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* TIÊU ĐỀ */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-2">Tiêu đề thông báo</label>
              <input 
                id="title-input"
                type="text" 
                placeholder="Nhập tiêu đề..."
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200/80 focus:bg-white focus:ring-2 focus:ring-blue-500 rounded-xl text-xs font-medium outline-none transition-all"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            {/* NỘI DUNG */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-2">Nội dung chi tiết</label>
              <textarea 
                rows={4}
                placeholder="Nhập nội dung..."
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200/80 focus:bg-white focus:ring-2 focus:ring-blue-500 rounded-xl text-xs font-medium outline-none transition-all resize-none"
                value={content}
                onChange={(e) => setContent(e.target.value)}
              />
            </div>

            {/* NÚT HÀNH ĐỘNG */}
            <div className="pt-2 space-y-2.5">
              <button 
                onClick={handleSend}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-xl w-full flex items-center justify-center gap-2 transition-all shadow-sm"
              >
                <Send size={16} /> Gửi thông báo ngay
              </button>
              <button 
                onClick={handleClear}
                className="bg-slate-100 hover:bg-slate-200 text-slate-600 font-medium py-2 rounded-xl w-full text-xs transition-all"
              >
                Xóa nội dung
              </button>
            </div>
          </div>
        </div>

        {/* CỘT PHẢI: LIVE PREVIEW & LỊCH SỬ (col-span-7) */}
        <div className="xl:col-span-7 space-y-6">
          
          {/* Card Live Preview */}
          <div className="bg-slate-900 text-white p-5 rounded-2xl shadow-md border border-slate-800 space-y-3 relative overflow-hidden">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Eye size={12}/> Live Preview
            </div>
            
            <div className="flex items-center gap-2 flex-wrap mt-1">
              <span className="bg-slate-100 text-slate-600 font-medium text-[11px] px-2.5 py-1 rounded-lg">
                {type}
              </span>
              {priority === 'urgent' && (
                <span className="bg-rose-50 text-rose-700 border border-rose-200/60 font-medium text-[11px] px-2.5 py-1 rounded-lg animate-pulse">
                  Khẩn cấp
                </span>
              )}
              {priority === 'high' && (
                <span className="bg-amber-50 text-amber-700 border border-amber-200/60 font-medium text-[11px] px-2.5 py-1 rounded-lg">
                  Quan trọng
                </span>
              )}
              {priority === 'normal' && (
                <span className="bg-emerald-50 text-emerald-700 border border-emerald-200/60 font-medium text-[11px] px-2.5 py-1 rounded-lg">
                  Thường
                </span>
              )}
            </div>
            
            <div className="text-sm font-bold text-white break-words mt-1">
              {title || 'Tiêu đề thông báo hiển thị tại đây...'}
            </div>
            
            <div className="text-xs text-slate-300 whitespace-pre-wrap break-words leading-relaxed">
              {content || 'Nội dung chi tiết thông báo...'}
            </div>
            
            <div className="pt-3 border-t border-slate-700/80 text-[10.5px] text-slate-400 flex justify-between items-center mt-3">
              <span className="font-medium">Người gửi: Admin</span>
              <span className="font-medium">Tới: {target}</span>
            </div>
          </div>

          {/* Lịch sử dạng Card như Devices View */}
          <div className="space-y-3 max-h-[550px] overflow-y-auto pr-1">
            {filteredHistory.map((notif) => (
              <div key={notif.id} className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm hover:border-blue-300 transition-all flex flex-col justify-between group">
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-wrap gap-1.5">
                      <span className="bg-slate-100 text-slate-600 font-medium text-[10px] px-2 py-0.5 rounded-lg border border-slate-200/60">
                        {notif.type}
                      </span>
                      {notif.priority === 'urgent' && (
                        <span className="bg-rose-50 text-rose-700 font-medium text-[10px] px-2 py-0.5 rounded-lg border border-rose-200/60">Khẩn cấp</span>
                      )}
                      {notif.priority === 'high' && (
                        <span className="bg-amber-50 text-amber-700 font-medium text-[10px] px-2 py-0.5 rounded-lg border border-amber-200/60">Quan trọng</span>
                      )}
                      {notif.priority === 'normal' && (
                        <span className="bg-emerald-50 text-emerald-700 font-medium text-[10px] px-2 py-0.5 rounded-lg border border-emerald-200/60">Thường</span>
                      )}
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="text-[13px] font-bold text-slate-800 line-clamp-2 leading-snug">{notif.title}</h3>
                    <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">{notif.content}</p>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <div className="text-[10px] text-slate-400 font-medium flex flex-col gap-0.5">
                    <span>{formatDate(notif.createdAt)}</span>
                    <span>Tới: {notif.target}</span>
                  </div>
                  <button 
                    onClick={() => handleDelete(notif.id)}
                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                    title="Xóa"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
            
            {filteredHistory.length === 0 && (
              <div className="col-span-1 sm:col-span-2 text-center py-10 bg-white rounded-2xl border border-slate-200/80 shadow-sm">
                <p className="text-sm font-medium text-slate-500">Không tìm thấy thông báo nào</p>
                <p className="text-xs text-slate-400 mt-1">Vui lòng điều chỉnh lại bộ lọc hoặc từ khóa tìm kiếm.</p>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
