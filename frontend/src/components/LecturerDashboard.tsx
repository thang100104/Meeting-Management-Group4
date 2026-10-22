import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getStorage, useDataSync } from '../utils/syncHelper';
import { NotificationDropdown } from './NotificationDropdown';
import {
  LayoutDashboard, Calendar, ClipboardList, Monitor, Package,
  AlertTriangle, User, LogOut, Video, ChevronDown, Bell, Clock, Plus, MessageSquare, Building
} from 'lucide-react';
import LecturerRoomBooking from './LecturerRoomBooking';
import LecturerMyRequests from './LecturerMyRequests';
import LecturerSchedule from './LecturerSchedule';
import LecturerReportIssue from './LecturerReportIssue';
import StudentLecturerChat from './StudentLecturerChat';
import ProfileView from './ProfileView';
import MeetingGoogleCalendar from './MeetingGoogleCalendar';
import api from '../services/api';
import { getNotificationsForRole, getMeetingNotificationsForUser, type SystemNotification } from '../utils/notificationService';

export default function LecturerDashboard() {
  const navigate = useNavigate();

  const [userProfile, setUserProfile] = useState<any>(() => {
    const saved = sessionStorage.getItem('user') || sessionStorage.getItem('currentUser') || sessionStorage.getItem('meetinghub_user');
    let parsed = null;
    try {
      if (saved && saved !== 'undefined' && saved !== 'null') {
        parsed = JSON.parse(saved);
      }
    } catch (e) { }

    return parsed || {
      fullName: "Người dùng",
      email: "user@ictu.edu.vn",
      role: "user"
    };
  });

  const [notifications, setNotifications] = useState<SystemNotification[]>(() => 
    getNotificationsForRole('lecturer')
  );
  const [showNotif, setShowNotif] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const userDropdownRef = useRef<HTMLDivElement>(null);

  const refreshNotifs = async () => {
    const staticNotifs = getNotificationsForRole('lecturer');
    try {
      const res = await api.get('/meetings');
      if (Array.isArray(res.data)) {
        const dyn = getMeetingNotificationsForUser(res.data, userProfile);
        setNotifications([...dyn, ...staticNotifs]);
        return;
      }
    } catch (e) { }
    setNotifications(staticNotifs);
  };

  useEffect(() => {
    refreshNotifs();
    window.addEventListener('storage', refreshNotifs);
    window.addEventListener('appDataSync', refreshNotifs);
    window.addEventListener('meeting-updated', refreshNotifs);
    window.addEventListener('system-notification-updated', refreshNotifs);
    return () => {
      window.removeEventListener('storage', refreshNotifs);
      window.removeEventListener('appDataSync', refreshNotifs);
      window.removeEventListener('meeting-updated', refreshNotifs);
      window.removeEventListener('system-notification-updated', refreshNotifs);
    };
  }, [userProfile?.id, userProfile?.email]);

  const [activeTab, setActiveTab] = useState('overview');
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setShowNotif(false);
      }
      if (userDropdownRef.current && !userDropdownRef.current.contains(event.target as Node)) {
        setShowUserDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const updatePendingCount = async () => {
    try {
      const { default: api } = await import('../services/api');
      const response = await api.get('/meetings');
      if (response.data) {
        const count = response.data.filter((m: any) => 
          (m.organizer_id === userProfile?.id || m.organizer?.email === userProfile?.email) && 
          (m.status === 'PENDING')
        ).length;
        setPendingRequestsCount(count);
      } else {
        setPendingRequestsCount(0);
      }
    } catch (e) {
      console.error('Error fetching pending count', e);
    }
  };

  useEffect(() => {
    const handleUserDataUpdate = () => {
      const saved = sessionStorage.getItem('user') || sessionStorage.getItem('currentUser') || sessionStorage.getItem('meetinghub_user');
      if (saved) {
        try {
          setUserProfile(JSON.parse(saved));
        } catch (e) { }
      }
    };

    updatePendingCount();

    window.addEventListener('user-data-updated', handleUserDataUpdate);
    window.addEventListener('userProfileUpdated', handleUserDataUpdate);
    window.addEventListener('storage', handleUserDataUpdate);
    window.addEventListener('storage', updatePendingCount);
    window.addEventListener('request-updated', updatePendingCount);

    return () => {
      window.removeEventListener('user-data-updated', handleUserDataUpdate);
      window.removeEventListener('userProfileUpdated', handleUserDataUpdate);
      window.removeEventListener('storage', handleUserDataUpdate);
      window.removeEventListener('storage', updatePendingCount);
      window.removeEventListener('request-updated', updatePendingCount);
    };
  }, []);

  const handleLogout = () => {
    sessionStorage.clear();
    localStorage.removeItem('token');
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
    localStorage.removeItem('currentUser');
    localStorage.removeItem('meetinghub_user');
    localStorage.removeItem('meetinghub_room_requests');
    localStorage.removeItem('room_bookings');
    localStorage.removeItem('system_rooms');
    localStorage.removeItem('admin_rooms');
    setShowUserDropdown(false);
    navigate('/login');
  };

  const menuGroups = [
    {
      group: 'QUẢN LÝ LỊCH HỌP',
      items: [
        { id: 'overview', label: 'Lịch họp (Calendar)', icon: <Calendar size={20} /> },
      ]
    },
    {
      group: 'PHÒNG HỌP & LỊCH TRÌNH',
      items: [
        { id: 'book-room', label: 'Danh mục phòng họp', icon: <Building size={20} /> },
        { id: 'schedule', label: 'Lịch trình cá nhân', icon: <Clock size={20} /> },
      ]
    },
    {
      group: 'HỖ TRỢ & CÁ NHÂN',
      items: [
        { id: 'student-chat', label: 'Tin nhắn trao đổi', icon: <MessageSquare size={20} /> },
        { id: 'profile', label: 'Hồ sơ cá nhân', icon: <User size={20} /> },
      ]
    }
  ];

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', backgroundColor: '#f8fafc', overflow: 'hidden' }}>

      {/* SIDEBAR */}
      <aside style={{ width: '280px', backgroundColor: '#0f172a', color: 'white', display: 'flex', flexDirection: 'column', flexShrink: 0, zIndex: 10 }}>
        {/* Logo */}
        <div style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <Video size={28} color="#3b82f6" />
          <span style={{ fontSize: '20px', fontWeight: 'bold', letterSpacing: '0.5px' }}>MeetingHub</span>
        </div>

        {/* User Info (Sidebar) */}
        <div style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          {userProfile?.avatar || userProfile?.avatarUrl ? (
            <img src={userProfile.avatar || userProfile.avatarUrl} alt="Avatar" className="w-10 h-10 rounded-full object-cover shrink-0 border-2 border-white/20" />
          ) : (
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'linear-gradient(135deg, #3b82f6, #2dd4bf)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', fontWeight: 'bold', color: 'white', flexShrink: 0 }}>
              {userProfile?.fullName ? userProfile.fullName.charAt(0).toUpperCase() : (userProfile?.name ? userProfile.name.charAt(0).toUpperCase() : 'U')}
            </div>
          )}
          <div style={{ overflow: 'hidden' }}>
            <div style={{ fontSize: '15px', fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {userProfile?.fullName || userProfile?.name || 'Người dùng'}
            </div>
            <div style={{ fontSize: '13px', color: '#94a3b8', marginTop: '2px' }}>
              Người dùng
            </div>
          </div>
        </div>

        {/* Nav Links */}
        <div style={{ padding: '16px 12px', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {menuGroups.map((group, gIndex) => (
            <div key={gIndex}>
              <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', marginBottom: '8px', paddingLeft: '16px', letterSpacing: '0.1em' }}>{group.group}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {group.items.map(item => {
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setActiveTab(item.id);
                      }}
                      style={{
                        position: 'relative',
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 16px',
                        backgroundColor: isActive ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                        color: isActive ? '#60a5fa' : '#cbd5e1',
                        border: 'none',
                        borderRadius: '12px',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: isActive ? '600' : '500',
                        transition: 'all 0.2s',
                        textAlign: 'left'
                      }}
                      className="hover:bg-slate-800 hover:text-white"
                    >
                      {isActive && <div style={{ position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)', width: '4px', height: '24px', backgroundColor: '#3b82f6', borderRadius: '0 4px 4px 0' }}></div>}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {item.icon}
                        {item.label}
                      </div>
                      {(item as any).badge && (
                        <span style={{ backgroundColor: '#3b82f6', color: 'white', fontSize: '11px', fontWeight: 'bold', padding: '2px 8px', borderRadius: '999px' }}>{(item as any).badge}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Sidebar Footer (Logout) */}
        <div style={{ padding: '16px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <button
            onClick={handleLogout}
            style={{ width: '100%', padding: '12px', display: 'flex', alignItems: 'center', gap: '12px', backgroundColor: 'transparent', color: '#cbd5e1', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', cursor: 'pointer', fontSize: '14px', fontWeight: '500', transition: 'all 0.2s' }}
            className="hover:bg-red-500 hover:border-red-500 hover:text-white"
          >
            <LogOut size={20} />
            Đăng xuất
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>

        {/* Header - chỉ hiển thị trên các tab khác overview */}
        {activeTab !== 'overview' && (
          <header style={{
            height: '64px',
            backgroundColor: '#ffffff',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            padding: '0 24px',
            flexShrink: 0
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
              <div ref={notifRef} style={{ position: 'relative' }}>
                <button
                  type="button"
                  onClick={() => { setShowNotif(prev => !prev); setShowUserDropdown(false); }}
                  style={{ position: 'relative', background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px' }}
                  title="Thông báo"
                >
                  <Bell size={20} />
                  {notifications.filter(n => !n.isRead).length > 0 && (
                    <span style={{ position: 'absolute', top: '-4px', right: '-4px', width: '18px', height: '18px', backgroundColor: '#ef4444', color: 'white', fontSize: '10px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', border: '2px solid white' }}>
                      {notifications.filter(n => !n.isRead).length}
                    </span>
                  )}
                </button>
                {showNotif && (
                  <NotificationDropdown onClose={() => setShowNotif(false)} role="lecturer" userProfile={userProfile} />
                )}
              </div>
              <div style={{ width: '1px', height: '24px', backgroundColor: '#e2e8f0' }}></div>

              <div ref={userDropdownRef} style={{ position: 'relative' }}>
                <button
                  type="button"
                  onClick={() => { setShowUserDropdown(prev => !prev); setShowNotif(false); }}
                  style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', borderRadius: '8px' }}
                  className="hover:bg-slate-50"
                >
                  {userProfile?.avatar || userProfile?.avatarUrl ? (
                    <img src={userProfile.avatar || userProfile.avatarUrl} alt="Avatar" className="w-8 h-8 rounded-full object-cover shrink-0 border border-slate-200" />
                  ) : (
                    <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: '#e0f2fe', color: '#0369a1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '14px' }}>
                      {userProfile?.fullName ? userProfile.fullName.charAt(0).toUpperCase() : (userProfile?.name ? userProfile.name.charAt(0).toUpperCase() : 'G')}
                    </div>
                  )}
                  <div style={{ textAlign: 'left', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '14px', fontWeight: '600', color: '#1e293b' }}>
                      {userProfile?.fullName || userProfile?.name || 'Giảng viên'}
                    </span>
                    <ChevronDown size={14} color="#64748b" />
                  </div>
                </button>

                {showUserDropdown && (
                  <div style={{ position: 'absolute', top: '110%', right: '0', backgroundColor: '#ffffff', borderRadius: '12px', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)', width: '220px', overflow: 'hidden', border: '1px solid #e2e8f0', zIndex: 50 }}>
                    <div style={{ padding: '16px', borderBottom: '1px solid #f1f5f9' }}>
                      <div style={{ fontWeight: '600', color: '#0f172a', fontSize: '14px' }}>{userProfile?.fullName || userProfile?.name || 'Giảng viên'}</div>
                      <div style={{ fontSize: '13px', color: '#64748b', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{userProfile?.email}</div>
                    </div>
                    <div style={{ padding: '8px' }}>
                      <button onClick={() => { setActiveTab('profile'); setShowUserDropdown(false); }} style={{ width: '100%', padding: '10px 12px', display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'transparent', border: 'none', cursor: 'pointer', borderRadius: '8px', color: '#334155', fontSize: '14px', textAlign: 'left' }} className="hover:bg-slate-50">
                        <User size={16} /> Hồ sơ cá nhân
                      </button>
                      <button onClick={handleLogout} style={{ width: '100%', padding: '10px 12px', display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'transparent', border: 'none', cursor: 'pointer', borderRadius: '8px', color: '#dc2626', fontSize: '14px', textAlign: 'left' }} className="hover:bg-red-50">
                        <LogOut size={16} /> Đăng xuất
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </header>
        )}

        {/* Dashboard Content */}
        <div style={{ flex: 1, padding: activeTab === 'overview' ? '0' : '32px', overflowY: activeTab === 'overview' ? 'hidden' : 'auto', backgroundColor: '#ffffff' }}>
          {activeTab === 'overview' ? (
            <MeetingGoogleCalendar userProfile={userProfile} userRole="lecturer" onNavigateToTab={setActiveTab} />
          ) : activeTab === 'book-room' ? (
            <LecturerRoomBooking userProfile={userProfile} onNavigateToTab={setActiveTab} />
          ) : activeTab === 'my-room-requests' ? (
            <LecturerMyRequests userProfile={userProfile} />
          ) : activeTab === 'schedule' ? (
            <LecturerSchedule userProfile={userProfile} navigateToTab={setActiveTab} />
          ) : (activeTab === 'student-chat' || activeTab === 'report-issue') ? (
            <StudentLecturerChat currentRole="lecturer" userProfile={userProfile} />
          ) : activeTab === 'profile' ? (
            <ProfileView />
          ) : (
            <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '18px', flexDirection: 'column', gap: '16px' }}>
              <Monitor size={48} opacity={0.5} />
              <div>Giao diện <strong style={{ color: '#0f172a' }}>{menuGroups.reduce((acc: any[], group) => [...acc, ...group.items], []).find(i => i.id === activeTab)?.label}</strong> đang được cập nhật...</div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
