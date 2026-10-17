import React, { useState, useEffect } from 'react';
import { 
  Settings, Building2, CalendarRange, Bell, ShieldCheck, 
  Save, Download, Check, Trash2
} from 'lucide-react';

const DEFAULT_SETTINGS = {
  // General
  orgName: 'Trường Đại học Công nghệ',
  systemEmail: 'admin@meetinghub.edu.vn',
  supportPhone: '0988.123.456',
  operatingHours: '07:00 - 22:00',
  language: 'Tiếng Việt',
  
  // Booking Policy
  maxAdvanceDays: '14 ngày',
  minBookingDuration: '30 phút',
  bufferTime: '15 phút',
  autoApprove: true,
  allowOutsideHours: false,
  autoCancelNoShow: true,
  autoCancelMinutes: '15',
  
  // Notifications
  emailConfirmations: true,
  meetingReminders: true,
  reminderTime: 'Trước 30 phút',
  zaloTelegramBot: false,
  webhookToken: '',
  
  // Security
  autoLogout: '30 phút'
};

const TABS = [
  { id: 'general', label: 'Cài đặt chung', icon: Building2 },
  { id: 'booking', label: 'Quy định đặt phòng', icon: CalendarRange },
  { id: 'notifications', label: 'Thông báo & Nhắc lịch', icon: Bell },
  { id: 'security', label: 'Bảo mật & Dữ liệu', icon: ShieldCheck },
];

export default function SystemSettings() {
  const [activeTab, setActiveTab] = useState('general');
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [showToast, setShowToast] = useState(false);

  // Load from LocalStorage
  useEffect(() => {
    const saved = localStorage.getItem('system_settings');
    if (saved) {
      try {
        setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(saved) });
      } catch (e) {
        console.error('Failed to parse settings');
      }
    }
  }, []);

  const handleChange = (key: keyof typeof DEFAULT_SETTINGS, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    localStorage.setItem('system_settings', JSON.stringify(settings));
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  const handleClearCache = () => {
    if (window.confirm("Bạn có chắc chắn muốn xóa bộ nhớ tạm (Cache)? Thao tác này sẽ đặt lại một số cài đặt trên trình duyệt này.")) {
      localStorage.removeItem('system_settings');
      setSettings(DEFAULT_SETTINGS);
      alert("Đã xóa bộ nhớ tạm thành công!");
    }
  };

  // UI Helpers
  const ToggleSwitch = ({ checked, onChange }: { checked: boolean, onChange: (val: boolean) => void }) => (
    <div 
      className={`w-11 h-6 rounded-full flex items-center p-1 cursor-pointer transition-colors shrink-0 ${checked ? 'bg-blue-600' : 'bg-slate-300'}`}
      onClick={() => onChange(!checked)}
    >
      <div className={`bg-white w-4 h-4 rounded-full shadow-sm transform transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50/50 text-slate-800">
      
      {/* TOAST NOTIFICATION */}
      {showToast && (
        <div className="fixed top-6 right-6 z-50 bg-emerald-600 text-white px-5 py-3 rounded-xl shadow-lg flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="bg-white/20 p-1 rounded-full"><Check size={16} /></div>
          <span className="text-sm font-semibold">✓ Đã cập nhật cài đặt hệ thống thành công!</span>
        </div>
      )}

      {/* TỔNG THỂ VỪA VẶN MÀN HÌNH - BẢN TRÀN RỘNG TOÀN DIỆN (FULL-WIDTH) */}
      <div className="w-full space-y-6 pb-12 px-6 py-2">
        
        {/* HEADER & NÚT LƯU */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Settings className="text-blue-600" size={28} /> Cài đặt hệ thống
            </h1>
            <p className="text-sm text-slate-500 mt-1">Cấu hình chung, quy định đặt phòng, thông báo và bảo mật</p>
          </div>
          <button 
            onClick={handleSave}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl text-sm font-semibold shadow-sm transition-all flex items-center gap-2"
          >
            <Save size={18} /> Lưu thay đổi
          </button>
        </div>

        {/* KHUNG THẺ MÀU TRẮNG CHỨA TẤT CẢ */}
        <div className="w-full bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          
          {/* THANH TAB NGANG NẰM TRONG KHUNG */}
          <div className="border-b border-slate-200 bg-slate-50/50 px-6 pt-4 flex gap-8 overflow-x-auto">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`pb-4 flex items-center gap-2.5 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600 font-semibold'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>

          {/* KHUNG NỘI DUNG DẠNG HÀNG TRÀN RỘNG (ROW-BY-ROW) */}
          <div className="w-full divide-y divide-slate-100">
            
            {/* TAB 1: CÀI ĐẶT CHUNG */}
            {activeTab === 'general' && (
              <div className="animate-in fade-in duration-300 divide-y divide-slate-100">
                
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 hover:bg-slate-50/40 transition-colors">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">Tên tổ chức / Đơn vị</p>
                    <p className="text-xs text-slate-500 mt-0.5">Tên đơn vị sở hữu và vận hành hệ thống</p>
                  </div>
                  <input 
                    type="text" 
                    value={settings.orgName}
                    onChange={(e) => handleChange('orgName', e.target.value)}
                    className="w-full max-w-lg px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:bg-white focus:border-blue-500 focus:outline-none transition-all"
                  />
                </div>

                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 hover:bg-slate-50/40 transition-colors">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">Email hệ thống</p>
                    <p className="text-xs text-slate-500 mt-0.5">Sử dụng để gửi email xác nhận đặt phòng và nhắc nhở</p>
                  </div>
                  <input 
                    type="email" 
                    value={settings.systemEmail}
                    onChange={(e) => handleChange('systemEmail', e.target.value)}
                    className="w-full max-w-lg px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:bg-white focus:border-blue-500 focus:outline-none transition-all"
                  />
                </div>

                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 hover:bg-slate-50/40 transition-colors">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">Hotline hỗ trợ kỹ thuật</p>
                    <p className="text-xs text-slate-500 mt-0.5">Được hiển thị trong các thông báo và email lỗi</p>
                  </div>
                  <input 
                    type="text" 
                    value={settings.supportPhone}
                    onChange={(e) => handleChange('supportPhone', e.target.value)}
                    className="w-full max-w-lg px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:bg-white focus:border-blue-500 focus:outline-none transition-all"
                  />
                </div>

                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 hover:bg-slate-50/40 transition-colors">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">Khung giờ hoạt động hệ thống</p>
                    <p className="text-xs text-slate-500 mt-0.5">Phạm vi thời gian khả dụng để đặt phòng mặc định</p>
                  </div>
                  <select 
                    value={settings.operatingHours}
                    onChange={(e) => handleChange('operatingHours', e.target.value)}
                    className="w-full max-w-lg px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:bg-white focus:border-blue-500 focus:outline-none transition-all"
                  >
                    <option>07:00 - 18:00</option>
                    <option>07:00 - 22:00</option>
                    <option>00:00 - 23:59 (24/7)</option>
                  </select>
                </div>

                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 hover:bg-slate-50/40 transition-colors">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">Ngôn ngữ mặc định</p>
                    <p className="text-xs text-slate-500 mt-0.5">Ngôn ngữ hiển thị chính trên toàn hệ thống</p>
                  </div>
                  <select 
                    value={settings.language}
                    onChange={(e) => handleChange('language', e.target.value)}
                    className="w-full max-w-lg px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:bg-white focus:border-blue-500 focus:outline-none transition-all"
                  >
                    <option>Tiếng Việt</option>
                    <option>English</option>
                  </select>
                </div>

              </div>
            )}

            {/* TAB 2: QUY ĐỊNH ĐẶT PHÒNG */}
            {activeTab === 'booking' && (
              <div className="animate-in fade-in duration-300 divide-y divide-slate-100">
                
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 hover:bg-slate-50/40 transition-colors">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">Thời gian đặt trước tối đa</p>
                    <p className="text-xs text-slate-500 mt-0.5">Giới hạn khoảng thời gian người dùng có thể tạo lịch trước</p>
                  </div>
                  <select 
                    value={settings.maxAdvanceDays}
                    onChange={(e) => handleChange('maxAdvanceDays', e.target.value)}
                    className="w-full max-w-lg px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:bg-white focus:border-blue-500 focus:outline-none transition-all"
                  >
                    <option>7 ngày</option>
                    <option>14 ngày</option>
                    <option>30 ngày</option>
                  </select>
                </div>

                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 hover:bg-slate-50/40 transition-colors">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">Thời gian đặt tối thiểu (1 cuộc họp)</p>
                    <p className="text-xs text-slate-500 mt-0.5">Thời lượng ngắn nhất có thể đặt cho mỗi lượt</p>
                  </div>
                  <select 
                    value={settings.minBookingDuration}
                    onChange={(e) => handleChange('minBookingDuration', e.target.value)}
                    className="w-full max-w-lg px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:bg-white focus:border-blue-500 focus:outline-none transition-all"
                  >
                    <option>30 phút</option>
                    <option>60 phút</option>
                  </select>
                </div>

                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 hover:bg-slate-50/40 transition-colors">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">Thời gian giãn cách giữa 2 cuộc họp (Buffer time)</p>
                    <p className="text-xs text-slate-500 mt-0.5">Khoảng thời gian trống bắt buộc để dọn dẹp hoặc chuẩn bị phòng</p>
                  </div>
                  <select 
                    value={settings.bufferTime}
                    onChange={(e) => handleChange('bufferTime', e.target.value)}
                    className="w-full max-w-lg px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:bg-white focus:border-blue-500 focus:outline-none transition-all"
                  >
                    <option>Không có</option>
                    <option>10 phút</option>
                    <option>15 phút</option>
                  </select>
                </div>

                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 hover:bg-slate-50/40 transition-colors">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">Tự động duyệt lịch đặt phòng</p>
                    <p className="text-xs text-slate-500 mt-0.5">Hệ thống sẽ tự phê duyệt nếu thỏa mãn khung giờ và phòng trống</p>
                  </div>
                  <div className="w-full max-w-lg flex items-center md:justify-end">
                    <ToggleSwitch checked={settings.autoApprove} onChange={(v) => handleChange('autoApprove', v)} />
                  </div>
                </div>

                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 hover:bg-slate-50/40 transition-colors">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">Cho phép đặt ngoài giờ hành chính</p>
                    <p className="text-xs text-slate-500 mt-0.5">Mở khóa quyền đặt phòng cho người dùng ngoài giờ hệ thống</p>
                  </div>
                  <div className="w-full max-w-lg flex items-center md:justify-end">
                    <ToggleSwitch checked={settings.allowOutsideHours} onChange={(v) => handleChange('allowOutsideHours', v)} />
                  </div>
                </div>

                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 hover:bg-slate-50/40 transition-colors">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">Tự động hủy nếu không Check-in</p>
                    <p className="text-xs text-slate-500 mt-0.5">Giải phóng phòng nếu người đặt không xác nhận tham gia</p>
                  </div>
                  <div className="w-full max-w-lg flex items-center md:justify-end gap-3">
                    {settings.autoCancelNoShow && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-600">Hủy sau</span>
                        <input 
                          type="number" 
                          className="w-16 px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-center font-medium focus:bg-white focus:border-blue-500 focus:outline-none transition-all"
                          value={settings.autoCancelMinutes}
                          onChange={(e) => handleChange('autoCancelMinutes', e.target.value)}
                        />
                        <span className="text-xs text-slate-600">phút</span>
                      </div>
                    )}
                    <ToggleSwitch checked={settings.autoCancelNoShow} onChange={(v) => handleChange('autoCancelNoShow', v)} />
                  </div>
                </div>

              </div>
            )}

            {/* TAB 3: THÔNG BÁO & NHẮC LỊCH */}
            {activeTab === 'notifications' && (
              <div className="animate-in fade-in duration-300 divide-y divide-slate-100">
                
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 hover:bg-slate-50/40 transition-colors">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">Gửi email xác nhận thao tác</p>
                    <p className="text-xs text-slate-500 mt-0.5">Gửi email cho người dùng khi Đặt mới, Cập nhật hoặc Hủy phòng</p>
                  </div>
                  <div className="w-full max-w-lg flex items-center md:justify-end">
                    <ToggleSwitch checked={settings.emailConfirmations} onChange={(v) => handleChange('emailConfirmations', v)} />
                  </div>
                </div>

                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 hover:bg-slate-50/40 transition-colors">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">Nhắc nhở cuộc họp sắp diễn ra</p>
                    <p className="text-xs text-slate-500 mt-0.5">Nhắc nhở tự động giúp giảm tỷ lệ quên lịch họp</p>
                  </div>
                  <div className="w-full max-w-lg flex items-center md:justify-end gap-3">
                    <select 
                      disabled={!settings.meetingReminders}
                      value={settings.reminderTime}
                      onChange={(e) => handleChange('reminderTime', e.target.value)}
                      className="w-40 px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:bg-white focus:border-blue-500 focus:outline-none disabled:opacity-50 transition-all"
                    >
                      <option>Trước 15 phút</option>
                      <option>Trước 30 phút</option>
                      <option>Trước 1 giờ</option>
                    </select>
                    <ToggleSwitch checked={settings.meetingReminders} onChange={(v) => handleChange('meetingReminders', v)} />
                  </div>
                </div>

                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 hover:bg-slate-50/40 transition-colors">
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-slate-800">Thông báo qua Telegram/Zalo Webhook</p>
                    <p className="text-xs text-slate-500 mt-0.5">Tích hợp Webhook đẩy thông báo theo thời gian thực về OTT</p>
                  </div>
                  <div className="w-full max-w-lg flex items-center md:justify-end gap-4">
                    {settings.zaloTelegramBot && (
                      <input 
                        type="url" 
                        placeholder="https://webhook.site/..."
                        value={settings.webhookToken}
                        onChange={(e) => handleChange('webhookToken', e.target.value)}
                        className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 focus:border-blue-500 focus:outline-none transition-all shadow-sm"
                      />
                    )}
                    <ToggleSwitch checked={settings.zaloTelegramBot} onChange={(v) => handleChange('zaloTelegramBot', v)} />
                  </div>
                </div>

              </div>
            )}

            {/* TAB 4: BẢO MẬT & DỮ LIỆU */}
            {activeTab === 'security' && (
              <div className="animate-in fade-in duration-300 divide-y divide-slate-100">
                
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 hover:bg-slate-50/40 transition-colors">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">Tự động đăng xuất sau khi hết hạn phiên làm việc</p>
                    <p className="text-xs text-slate-500 mt-0.5">Bảo vệ tài khoản khi người dùng không có tương tác quá lâu</p>
                  </div>
                  <select 
                    value={settings.autoLogout}
                    onChange={(e) => handleChange('autoLogout', e.target.value)}
                    className="w-full max-w-lg px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:bg-white focus:border-blue-500 focus:outline-none transition-all"
                  >
                    <option>15 phút</option>
                    <option>30 phút</option>
                    <option>1 tiếng</option>
                    <option>8 tiếng</option>
                  </select>
                </div>

                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 hover:bg-slate-50/40 transition-colors">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">Sao lưu dữ liệu hệ thống (Backup)</p>
                    <p className="text-xs text-slate-500 mt-0.5">Trích xuất cấu hình và cài đặt hiện tại thành file JSON</p>
                  </div>
                  <div className="w-full max-w-lg flex items-center md:justify-end">
                    <button 
                      className="w-full sm:w-auto bg-slate-50 hover:bg-slate-100 text-slate-700 px-5 py-2.5 rounded-xl text-sm font-semibold border border-slate-200 transition-all flex items-center justify-center gap-2 shadow-sm"
                      onClick={() => alert("Đã tải xuống bản sao lưu: settings_backup.json")}
                    >
                      <Download size={16} className="text-blue-600" /> Tải bản sao lưu
                    </button>
                  </div>
                </div>

                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 hover:bg-slate-50/40 transition-colors">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">Xóa Cache hệ thống</p>
                    <p className="text-xs text-rose-500 mt-0.5">Cảnh báo: Hành động này sẽ đặt lại cấu hình mặc định cục bộ</p>
                  </div>
                  <div className="w-full max-w-lg flex items-center md:justify-end">
                    <button 
                      onClick={handleClearCache}
                      className="w-full sm:w-auto bg-white hover:bg-rose-50 text-slate-700 px-5 py-2.5 rounded-xl text-sm font-semibold border border-slate-200 hover:border-rose-200 hover:text-rose-600 transition-all flex items-center justify-center gap-2 shadow-sm"
                    >
                      <Trash2 size={16} className="text-rose-500" /> Xóa bộ nhớ tạm
                    </button>
                  </div>
                </div>

              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
