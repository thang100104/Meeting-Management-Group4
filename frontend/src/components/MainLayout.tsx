import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Video, Monitor, CalendarDays,
  MessageSquare, Users, Settings, LogOut, Search,
  Bell, Check, X, FileCheck2, Bot, FileText, User
} from 'lucide-react';
import ChatbotWidget from './ChatbotWidget';
import { NotificationDropdown } from './NotificationDropdown';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

export default function MainLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const activePath = location.pathname;
  const { user: userProfile } = useAuth();

  const [showNotif, setShowNotif] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [notifications, setNotifications] = useState([
    { id: 1, title: 'Yêu cầu phòng Lab 3', time: '5 phút trước' },
    { id: 2, title: 'Cập nhật hệ thống', time: '1 giờ trước' },
    { id: 3, title: 'Báo cáo tháng', time: '2 giờ trước' }
  ]);

  const handleLogout = () => {
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
    sessionStorage.removeItem('meetinghub_token');
    sessionStorage.removeItem('meetinghub_user');
    setShowUserDropdown(false);
    window.location.href = '/login';
  };

  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);

  const updatePendingCount = async () => {
    let count = 0;
    try {
      // 1. Fetch live from backend APIs
      const [meetingsRes, eqRes] = await Promise.allSettled([
        api.get('/meetings?status=PENDING'),
        api.get('/equipment-requests?status=PENDING')
      ]);

      if (meetingsRes.status === 'fulfilled' && Array.isArray(meetingsRes.value?.data)) {
        count += meetingsRes.value.data.filter((m: any) => m.status === 'PENDING').length;
      }
      if (eqRes.status === 'fulfilled' && Array.isArray(eqRes.value?.data)) {
        count += eqRes.value.data.filter((e: any) => e.status === 'PENDING').length;
      }

      // 2. Include any non-numeric/mock items from localStorage
      const saved = localStorage.getItem('meetinghub_room_requests');
      if (saved) {
        try {
          const requests = JSON.parse(saved);
          const localOnly = requests.filter((r: any) => 
            (r.status === 'Chờ duyệt' || r.status === 'pending') &&
            typeof r.id === 'string' && !/^\d+$/.test(r.id)
          ).length;
          count += localOnly;
        } catch (e) {}
      }

      setPendingRequestsCount(count);
    } catch (e) {
      console.error("Lỗi cập nhật badge chờ duyệt:", e);
    }
  };

  useEffect(() => {
    updatePendingCount();
    window.addEventListener('storage', updatePendingCount);
    window.addEventListener('request-updated', updatePendingCount);
    window.addEventListener('roomBookingsUpdated', updatePendingCount);
    return () => {
      window.removeEventListener('storage', updatePendingCount);
      window.removeEventListener('request-updated', updatePendingCount);
      window.removeEventListener('roomBookingsUpdated', updatePendingCount);
    };
  }, []);

  const menuGroups = [
    {
      group: 'ĐIỀU HÀNH & PHÊ DUYỆT',
      items: [
        { id: '/dashboard', label: 'Trang tổng quan', icon: <LayoutDashboard size={20} /> },
        { id: '/approvals', label: 'Phê duyệt yêu cầu', icon: <FileCheck2 size={20} />, badge: pendingRequestsCount > 0 ? pendingRequestsCount : undefined },
      ]
    },
    {
      group: 'QUẢN LÝ TÀI NGUYÊN',
      items: [
        { id: '/rooms', label: 'Quản lý phòng họp', icon: <Video size={20} /> },
        { id: '/devices', label: 'Quản lý thiết bị', icon: <Monitor size={20} /> },
        { id: '/schedules', label: 'Lịch họp toàn trường', icon: <CalendarDays size={20} /> },
      ]
    },
    {
      group: 'QUẢN TRỊ & THỐNG KÊ',
      items: [
        { id: '/notifications', label: 'Gửi thông báo', icon: <MessageSquare size={20} /> },
        { id: '/users', label: 'Quản lý người dùng', icon: <Users size={20} /> },
        { id: '/reports', label: 'Báo cáo & Thống kê', icon: <FileText size={20} /> },
      ]
    },
    {
      group: 'CẤU HÌNH HỆ THỐNG',
      items: [
        { id: '/bot-qr-settings', label: 'Cấu hình Chatbot & QR', icon: <Bot size={20} /> },
        { id: '/system', label: 'Cài đặt hệ thống', icon: <Settings size={20} /> },
      ]
    },
    {
      group: 'TÀI KHOẢN',
      items: [
        { id: '/profile', label: 'Hồ sơ cá nhân', icon: <User size={20} /> },
      ]
    }
  ];

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', backgroundColor: '#f4f5f8', overflow: 'hidden', position: 'relative' }}>

      {/* Sidebar - Dark Mode Slate */}
      <aside style={{ width: '260px', backgroundColor: '#0f172a', color: 'white', display: 'flex', flexDirection: 'column', flexShrink: 0, zIndex: 10 }}>
        {/* Logo */}
        <div style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <Video size={28} color="#3b82f6" />
          <span style={{ fontSize: '20px', fontWeight: 'bold' }}>MeetingHub</span>
        </div>

        {/* User Info (Sidebar) */}
        <div style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          {userProfile?.avatar || userProfile?.avatarUrl ? (
            <img src={userProfile?.avatar || userProfile?.avatarUrl} alt="Avatar" className="w-10 h-10 rounded-full object-cover shrink-0 border-2 border-white/20" />
          ) : (
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'linear-gradient(135deg, #3b82f6, #2dd4bf)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', fontWeight: 'bold', color: 'white', flexShrink: 0 }}>
              {userProfile?.fullName ? userProfile?.fullName.charAt(0).toUpperCase() : (userProfile?.name ? userProfile?.name.charAt(0).toUpperCase() : 'H')}
            </div>
          )}
          <div style={{ overflow: 'hidden' }}>
            <div style={{ fontSize: '15px', fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {userProfile?.fullName || userProfile?.name || 'Quản trị viên'}
            </div>
            <div style={{ fontSize: '13px', color: '#94a3b8', marginTop: '2px' }}>
              Quản trị viên
            </div>
          </div>
        </div>

        {/* Menu Groups */}
        <nav style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', padding: '0 16px 24px 16px' }}>
          {menuGroups.map((group, gIdx) => (
            <div key={gIdx} style={{ marginBottom: '8px' }}>
              <div style={{
                fontSize: '10px', fontWeight: 700, letterSpacing: '0.05em',
                color: '#64748b', textTransform: 'uppercase', padding: '0 12px',
                marginTop: '16px', marginBottom: '6px'
              }}>
                {group.group}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {group.items.map((item) => {
                  const isActive = activePath === item.id || (activePath === '/' && item.id === '/dashboard');
                  return (
                    <button
                      key={item.id}
                      onClick={() => navigate(item.id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '12px', width: '100%',
                        padding: '10px 12px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                        backgroundColor: isActive ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                        color: isActive ? '#3b82f6' : '#94a3b8',
                        transition: 'all 0.2s ease',
                        textAlign: 'left'
                      }}
                      onMouseOver={(e) => {
                        if (!isActive) {
                          e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)';
                          e.currentTarget.style.color = 'white';
                        }
                      }}
                      onMouseOut={(e) => {
                        if (!isActive) {
                          e.currentTarget.style.backgroundColor = 'transparent';
                          e.currentTarget.style.color = '#94a3b8';
                        }
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {item.icon}
                      </div>
                      <span style={{ fontSize: '14px', fontWeight: isActive ? '600' : '500', flex: 1 }}>
                        {item.label}
                      </span>
                      {item.badge && (
                        <span style={{
                          backgroundColor: '#ef4444', color: 'white', fontSize: '10px', fontWeight: 'bold',
                          padding: '2px 6px', borderRadius: '10px'
                        }}>
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Nút Đăng xuất Sidebar */}
        <div style={{ padding: '16px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <button
            onClick={handleLogout}
            style={{
              display: 'flex', alignItems: 'center', gap: '10px', width: '100%',
              padding: '12px', borderRadius: '8px', backgroundColor: 'rgba(239,68,68,0.1)',
              color: '#ef4444', border: 'none', cursor: 'pointer',
              fontWeight: '600', fontSize: '14px'
            }}
          >
            <LogOut size={18} />
            Đăng xuất
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>

        {/* TOP HEADER - Chỉ hiển thị nếu không phải trang Profile */}
        {activePath !== '/profile' && (
          <header style={{
            width: '100%',
            height: '64px',
            backgroundColor: '#1b1c3a', /* Màu nền Xanh Navy đậm chuẩn */
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 28px',
            marginBottom: activePath === '/dashboard' ? '0px' : '24px', /* Tạo khoảng cách với bên dưới */
            boxSizing: 'border-box',
            position: 'relative',
            zIndex: 50
          }}>
            {/* BÊN TRÁI: Ô TÌM KIẾM DÙNG CHUNG */}
            <div style={{ position: 'relative', width: '320px' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}>
                <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
              </svg>
              <input
                type="text"
                placeholder="Tìm kiếm tài khoản, mã phòng... (Ctrl + K)"
                style={{
                  width: '100%',
                  height: '38px',
                  paddingLeft: '38px',
                  paddingRight: '12px',
                  backgroundColor: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '20px',
                  color: '#ffffff',
                  fontSize: '13px',
                  outline: 'none'
                }}
              />
            </div>

            {/* BÊN PHẢI: QUẢ CHUÔNG + TÀI KHOẢN (NẰM TRÊN 1 HÀNG NGANG) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>

              {/* 1. QUẢ CHUÔNG THÔNG BÁO */}
              <div style={{ position: 'relative', cursor: 'pointer' }} onClick={() => setShowNotif(!showNotif)}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
                {/* Badge Đỏ Số 7 */}
                <span style={{
                  position: 'absolute',
                  top: '-6px',
                  right: '-6px',
                  backgroundColor: '#ef4444',
                  color: '#ffffff',
                  fontSize: '10px',
                  fontWeight: 'bold',
                  width: '18px',
                  height: '18px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '2px solid #1b1c3a'
                }}>
                  {notifications.length}
                </span>
                {/* Dropdown Thông báo */}
                {showNotif && (
                  <NotificationDropdown onClose={() => setShowNotif(false)} />
                )}
              </div>

              {/* 2. AVATAR + HOÀNG THANH */}
              <div style={{ position: 'relative' }}>
                <button
                  type="button"
                  onClick={() => { setShowUserDropdown(!showUserDropdown); setShowNotif(false); }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    backgroundColor: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '4px 8px'
                  }}
                >
                  {userProfile?.avatar || userProfile?.avatarUrl ? (
                    <img
                      src={userProfile?.avatar || userProfile?.avatarUrl}
                      alt="Avatar"
                      className="w-8 h-8 rounded-full object-cover border border-slate-200"
                    />
                  ) : (
                    <div style={{
                      width: '34px',
                      height: '34px',
                      borderRadius: '50%',
                      backgroundColor: 'rgba(255,255,255,0.2)',
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 'bold',
                      fontSize: '14px'
                    }}>
                      {userProfile?.fullName ? userProfile?.fullName.charAt(0).toUpperCase() : 'H'}
                    </div>
                  )}
                  <span style={{ color: '#ffffff', fontSize: '14px', fontWeight: '600' }}>{userProfile?.shortName || userProfile?.fullName || 'Tài khoản'}</span>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2"><path d="m6 9 6 6 6-6" /></svg>
                </button>

                {/* POPUP DROPDOWN MENU TÀI KHOẢN */}
                {showUserDropdown && (
                  <div style={{
                    position: 'absolute',
                    right: 0,
                    top: '48px',
                    zIndex: 9999,
                    width: '250px',
                    backgroundColor: '#ffffff',
                    borderRadius: '16px',
                    boxShadow: '0 20px 30px -10px rgba(0,0,0,0.2)',
                    border: '1px solid #e2e8f0',
                    padding: '16px',
                    textAlign: 'left',
                    color: '#1e293b'
                  }}>
                    <div style={{ marginBottom: '12px' }}>
                      <p style={{ margin: 0, fontSize: '15px', fontWeight: 'bold', color: '#0f172a' }}>{userProfile?.fullName || 'Tài khoản'}</p>
                      <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#64748b' }}>{userProfile?.email}</p>
                    </div>
                    <div style={{ height: '1px', backgroundColor: '#f1f5f9', margin: '10px 0' }} />
                    <button type="button" onClick={() => { setShowUserDropdown(false); navigate('/profile'); }} style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '8px 4px', background: 'none', border: 'none', color: '#334155', fontSize: '14px', cursor: 'pointer', textAlign: 'left' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                      Hồ sơ
                    </button>
                    <button type="button" onClick={() => { setShowUserDropdown(false); navigate('/system'); }} style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '8px 4px', background: 'none', border: 'none', color: '#334155', fontSize: '14px', cursor: 'pointer', textAlign: 'left' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
                      Cài đặt
                    </button>
                    <div style={{ height: '1px', backgroundColor: '#f1f5f9', margin: '10px 0' }} />
                    <button type="button" onClick={handleLogout} style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '6px 4px', background: 'none', border: 'none', color: '#ef4444', fontSize: '14px', fontWeight: '600', cursor: 'pointer', textAlign: 'left' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
                      Đăng xuất
                    </button>
                  </div>
                )}
              </div>
            </div>
          </header>
        )}

        {/* Dynamic Main Content */}
        <main style={{ flex: 1, overflowY: 'auto', backgroundColor: activePath === '/dashboard' ? '#020617' : '#f8fafc' }}>
          <Outlet />
        </main>

        <ChatbotWidget />
      </div>
    </div>
  );
}
