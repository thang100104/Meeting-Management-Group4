import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getStorage, useDataSync } from '../utils/syncHelper';
import { NotificationDropdown } from './NotificationDropdown';
import { getNotificationsForRole, getMeetingNotificationsForUser, type SystemNotification } from '../utils/notificationService';
import api from '../services/api';
import {
  LayoutDashboard, Calendar, MessageSquare, User, Video, ChevronDown, Bell, LogOut, Mail
} from 'lucide-react';
import ProfileView from './ProfileView';
import StudentLecturerChat from './StudentLecturerChat';
import MeetingGoogleCalendar from './MeetingGoogleCalendar';
import StudentInvitations from './StudentInvitations';

export default function StudentDashboard() {
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
      fullName: "Sinh viên",
      email: "student@ictu.edu.vn",
      role: "student"
    };
  });

  const [notifications, setNotifications] = useState<SystemNotification[]>(() => 
    getNotificationsForRole('student')
  );
  const [showNotif, setShowNotif] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const userDropdownRef = useRef<HTMLDivElement>(null);

  const refreshNotifs = async () => {
    const staticNotifs = getNotificationsForRole('student');
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

  // Click outside listener for notification and user dropdown
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

  useEffect(() => {
    const handleUserDataUpdate = () => {
      const saved = sessionStorage.getItem('user') || sessionStorage.getItem('currentUser') || sessionStorage.getItem('meetinghub_user');
      if (saved) {
        try {
          setUserProfile(JSON.parse(saved));
        } catch (e) { }
      }
    };

    window.addEventListener('user-data-updated', handleUserDataUpdate);
    window.addEventListener('userProfileUpdated', handleUserDataUpdate);
    window.addEventListener('storage', handleUserDataUpdate);

    return () => {
      window.removeEventListener('user-data-updated', handleUserDataUpdate);
      window.removeEventListener('userProfileUpdated', handleUserDataUpdate);
      window.removeEventListener('storage', handleUserDataUpdate);
    };
  }, []);

  const handleLogout = () => {
    sessionStorage.removeItem('access_token');
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
    sessionStorage.removeItem('currentUser');
    sessionStorage.removeItem('meetinghub_user');
    setShowUserDropdown(false);
    navigate('/login');
  };

  const [pendingInvitesCount, setPendingInvitesCount] = useState(0);

  const updatePendingInvites = async () => {
    try {
      const { default: api } = await import('../services/api');
      const res = await api.get('/meetings');
      if (Array.isArray(res.data)) {
        const uid = userProfile?.id || userProfile?.user_id;
        const uEmail = userProfile?.email?.toLowerCase();
        const count = res.data.filter((m: any) =>
          m.participants && m.participants.some((p: any) =>
            (p.user_id === uid || (uEmail && p.user?.email && p.user.email.toLowerCase() === uEmail)) &&
            p.rsvp_status === 'PENDING'
          )
        ).length;
        setPendingInvitesCount(count);
      }
    } catch (e) {
      console.error('Lỗi lấy số lượng lời mời:', e);
    }
  };

  useEffect(() => {
    updatePendingInvites();
    window.addEventListener('meeting-updated', updatePendingInvites);
    window.addEventListener('storage', updatePendingInvites);
    return () => {
      window.removeEventListener('meeting-updated', updatePendingInvites);
      window.removeEventListener('storage', updatePendingInvites);
    };
  }, [userProfile]);

  const menuGroups = [
    {
      group: 'LỊCH HỌP & THÔNG BÁO',
      items: [
        { id: 'overview', label: 'Lịch họp sinh viên', icon: <Calendar size={20} /> },
        { id: 'invitations', label: 'Lời mời cuộc họp', icon: <Mail size={20} />, badge: pendingInvitesCount > 0 ? pendingInvitesCount : undefined },
      ]
    },
    {
      group: 'HỖ TRỢ & CÁ NHÂN',
      items: [
        { id: 'chat', label: 'Chat với giảng viên', icon: <MessageSquare size={20} /> },
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
              {userProfile?.fullName ? userProfile.fullName.charAt(0).toUpperCase() : (userProfile?.name ? userProfile.name.charAt(0).toUpperCase() : 'S')}
            </div>
          )}
          <div style={{ overflow: 'hidden' }}>
            <div style={{ fontSize: '15px', fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {userProfile?.fullName || userProfile?.name || 'Sinh viên'}
            </div>
            <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              Sinh viên
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav style={{ flex: 1, padding: '20px 16px', overflowY: 'auto' }}>
          {menuGroups.map((group, gIdx) => (
            <div key={gIdx} style={{ marginBottom: '24px' }}>
              <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', marginBottom: '12px', paddingLeft: '12px', letterSpacing: '1px' }}>
                {group.group}
              </div>
              {group.items.map(item => (
                <div
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', borderRadius: '8px', cursor: 'pointer', marginBottom: '4px',
                    backgroundColor: activeTab === item.id ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                    color: activeTab === item.id ? '#3b82f6' : '#cbd5e1',
                    borderLeft: activeTab === item.id ? '3px solid #3b82f6' : '3px solid transparent',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={e => { if (activeTab !== item.id) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)' }}
                  onMouseLeave={e => { if (activeTab !== item.id) e.currentTarget.style.backgroundColor = 'transparent' }}
                >
                  <div style={{ color: activeTab === item.id ? '#3b82f6' : '#94a3b8' }}>
                    {item.icon}
                  </div>
                  <span style={{ fontSize: '14px', fontWeight: activeTab === item.id ? '600' : '500', flex: 1 }}>
                    {item.label}
                  </span>
                  {(item as any).badge && (
                    <span style={{ backgroundColor: '#ef4444', color: 'white', fontSize: '10px', fontWeight: 'bold', padding: '2px 7px', borderRadius: '10px' }}>
                      {(item as any).badge}
                    </span>
                  )}
                </div>
              ))}
            </div>
          ))}
        </nav>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* TOP NAVBAR - chỉ hiển thị trên các tab khác overview */}
        {activeTab !== 'overview' && (
          <header style={{ height: '70px', backgroundColor: 'white', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', flexShrink: 0 }}>
            <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#0f172a', margin: 0 }}>
              {menuGroups.flatMap(g => g.items).find(i => i.id === activeTab)?.label}
            </h2>

            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
              {/* Notification */}
              <div ref={notifRef} style={{ position: 'relative' }}>
                <button 
                  type="button"
                  onClick={() => {
                    setShowNotif(prev => !prev);
                    setShowUserDropdown(false);
                  }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', position: 'relative', padding: '6px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  className="hover:bg-slate-100 transition-colors"
                  title="Thông báo"
                >
                  <Bell size={20} />
                  {notifications.filter(n => !n.isRead).length > 0 && (
                    <span style={{ position: 'absolute', top: 2, right: 2, width: '18px', height: '18px', backgroundColor: '#ef4444', color: 'white', borderRadius: '50%', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', border: '2px solid white' }}>
                      {notifications.filter(n => !n.isRead).length}
                    </span>
                  )}
                </button>
                {showNotif && (
                  <NotificationDropdown onClose={() => setShowNotif(false)} role="student" userProfile={userProfile} />
                )}
              </div>

              {/* User Dropdown */}
              <div ref={userDropdownRef} style={{ position: 'relative' }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowUserDropdown(prev => !prev);
                    setShowNotif(false);
                  }}
                  style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', borderRadius: '8px' }}
                  className="hover:bg-slate-100 transition-colors"
                >
                  {userProfile?.avatar || userProfile?.avatarUrl ? (
                    <img src={userProfile.avatar || userProfile.avatarUrl} alt="Avatar" className="w-8 h-8 rounded-full object-cover shrink-0" />
                  ) : (
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#e2e8f0', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '14px' }}>
                      {userProfile?.fullName ? userProfile.fullName.charAt(0).toUpperCase() : (userProfile?.name ? userProfile.name.charAt(0).toUpperCase() : 'S')}
                    </div>
                  )}
                  <ChevronDown size={16} color="#64748b" />
                </button>

                {showUserDropdown && (
                  <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: '220px', backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0', overflow: 'hidden', zIndex: 50 }}>
                    <div style={{ padding: '16px', borderBottom: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
                      <div style={{ fontWeight: '600', color: '#0f172a', fontSize: '14px' }}>{userProfile?.fullName || userProfile?.name}</div>
                      <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>{userProfile?.email}</div>
                    </div>
                    <div style={{ padding: '8px' }}>
                      <button
                        onClick={() => { setActiveTab('profile'); setShowUserDropdown(false); }}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '10px 12px', background: 'none', border: 'none', cursor: 'pointer', color: '#475569', fontSize: '13px', fontWeight: '500', borderRadius: '6px', textAlign: 'left' }}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f1f5f9'}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        <User size={16} /> Hồ sơ cá nhân
                      </button>
                      <button
                        onClick={handleLogout}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '10px 12px', background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: '13px', fontWeight: '500', borderRadius: '6px', textAlign: 'left', marginTop: '4px' }}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = '#fef2f2'}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        <LogOut size={16} /> Đăng xuất
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </header>
        )}

        {/* CONTENT AREA */}
        <div style={{ flex: 1, overflow: activeTab === 'overview' ? 'hidden' : 'auto', backgroundColor: '#ffffff' }}>
          {activeTab === 'overview' && (
            <MeetingGoogleCalendar userProfile={userProfile} userRole="student" />
          )}

          {activeTab === 'invitations' && (
            <div className="h-full overflow-y-auto">
              <StudentInvitations userProfile={userProfile} />
            </div>
          )}

          {activeTab === 'chat' && (
            <div className="h-full">
              <StudentLecturerChat currentRole="student" userProfile={userProfile} />
            </div>
          )}

          {activeTab === 'profile' && (
            <div className="h-full">
              <ProfileView />
            </div>
          )}
        </div>
      </main>

    </div>
  );
}
