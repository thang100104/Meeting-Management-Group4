import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getStorage, useDataSync } from '../utils/syncHelper';
import { NotificationDropdown } from './NotificationDropdown';
import {
  LayoutDashboard, Calendar, ClipboardList, Monitor, Package,
  AlertTriangle, User, LogOut, Video, ChevronDown, Bell, Clock, Plus
} from 'lucide-react';
import LecturerRoomBooking from './LecturerRoomBooking';
import LecturerMyRequests from './LecturerMyRequests';
import LecturerEquipmentBooking from './LecturerEquipmentBooking';
import LecturerBorrowedEquipment from './LecturerBorrowedEquipment';
import LecturerSchedule from './LecturerSchedule';
import LecturerReportIssue from './LecturerReportIssue';
import ProfileView from './ProfileView';

export default function LecturerDashboard() {
  const navigate = useNavigate();

  const [notifications, setNotifications] = useState<any[]>(() => getStorage<any[]>('system_notifications', []));
  const [showNotif, setShowNotif] = useState(false);

  useDataSync('system_notifications', () => {
    setNotifications(getStorage<any[]>('system_notifications', []));
  });
  const [activeTab, setActiveTab] = useState('overview');
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);

  const [userProfile, setUserProfile] = useState<any>(() => {
    const saved = sessionStorage.getItem('user') || sessionStorage.getItem('currentUser') || sessionStorage.getItem('meetinghub_user');
    let parsed = null;
    try {
      if (saved && saved !== 'undefined' && saved !== 'null') {
        parsed = JSON.parse(saved);
      }
    } catch (e) { }

    return parsed || {
      fullName: "Giảng viên",
      email: "lecturer@ictu.edu.vn",
      role: "lecturer"
    };
  });

  const updatePendingCount = () => {
    try {
      const saved = localStorage.getItem('meetinghub_room_requests');
      if (saved) {
        const requests = JSON.parse(saved);
        const count = requests.filter((r: any) => r.status === 'Chờ duyệt' || r.status === 'pending').length;
        setPendingRequestsCount(count);
      } else {
        setPendingRequestsCount(0);
      }
    } catch (e) {
      console.error(e);
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
    sessionStorage.removeItem('access_token');
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
    sessionStorage.removeItem('currentUser');
    sessionStorage.removeItem('meetinghub_user');
    setShowUserDropdown(false);
    navigate('/login');
  };

  const menuGroups = [
    {
      group: 'TỔNG QUAN',
      items: [
        { id: 'overview', label: 'Trang tổng quan', icon: <LayoutDashboard size={20} /> },
      ]
    },
    {
      group: 'PHÒNG HỌP & GIẢNG ĐƯỜNG',
      items: [
        { id: 'book-room', label: 'Đăng ký phòng họp', icon: <Calendar size={20} /> },
        { id: 'my-room-requests', label: 'Yêu cầu của tôi', icon: <ClipboardList size={20} />, badge: pendingRequestsCount > 0 ? pendingRequestsCount : undefined },
      ]
    },
    {
      group: 'THIẾT BỊ GIẢNG DẠY',
      items: [
        { id: 'request-equipment', label: 'Đăng ký mượn thiết bị', icon: <Monitor size={20} /> },
        { id: 'my-equipment', label: 'Thiết bị đang mượn', icon: <Package size={20} /> },
      ]
    },
    {
      group: 'LỊCH TRÌNH',
      items: [
        { id: 'schedule', label: 'Lịch dạy & Lịch họp', icon: <Calendar size={20} /> },
      ]
    },
    {
      group: 'HỖ TRỢ & CÁ NHÂN',
      items: [
        { id: 'report-issue', label: 'Báo cáo sự cố', icon: <AlertTriangle size={20} /> },
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
              {userProfile?.fullName ? userProfile.fullName.charAt(0).toUpperCase() : (userProfile?.name ? userProfile.name.charAt(0).toUpperCase() : 'G')}
            </div>
          )}
          <div style={{ overflow: 'hidden' }}>
            <div style={{ fontSize: '15px', fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {userProfile?.fullName || userProfile?.name || 'Giảng viên'}
            </div>
            <div style={{ fontSize: '13px', color: '#94a3b8', marginTop: '2px' }}>
              Giảng viên
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
                      {item.badge && (
                        <span style={{ backgroundColor: '#3b82f6', color: 'white', fontSize: '11px', fontWeight: 'bold', padding: '2px 8px', borderRadius: '999px' }}>{item.badge}</span>
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

        {/* Header */}
        <header style={{
          height: '72px',
          backgroundColor: activeTab === 'overview' ? 'rgba(15, 23, 42, 1)' : '#ffffff',
          borderBottom: activeTab === 'overview' ? '1px solid rgba(255,255,255,0.05)' : '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          padding: '0 24px',
          flexShrink: 0,
          transition: 'all 0.3s ease'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => { setShowNotif(!showNotif); setShowUserDropdown(false); }}
                style={{ position: 'relative', background: 'none', border: 'none', cursor: 'pointer', color: activeTab === 'overview' ? '#f8fafc' : '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <Bell size={20} />
                <span style={{ position: 'absolute', top: '-4px', right: '-4px', width: '18px', height: '18px', backgroundColor: '#ef4444', color: 'white', fontSize: '10px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', border: '2px solid white' }}>{notifications.length}</span>
              </button>
              {showNotif && (
                <NotificationDropdown onClose={() => setShowNotif(false)} />
              )}
            </div>
            <div style={{ width: '1px', height: '24px', backgroundColor: activeTab === 'overview' ? 'rgba(255,255,255,0.1)' : '#e2e8f0' }}></div>

            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setShowUserDropdown(!showUserDropdown)}
                style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', borderRadius: '8px', transition: 'background-color 0.2s' }}
                className={activeTab === 'overview' ? "hover:bg-slate-800" : "hover:bg-slate-50"}
              >
                {userProfile?.avatar || userProfile?.avatarUrl ? (
                  <img src={userProfile.avatar || userProfile.avatarUrl} alt="Avatar" className="w-8 h-8 rounded-full object-cover shrink-0 border border-slate-200" />
                ) : (
                  <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: activeTab === 'overview' ? 'rgba(255,255,255,0.1)' : '#e0f2fe', color: activeTab === 'overview' ? '#f8fafc' : '#0369a1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '14px' }}>
                    {userProfile?.fullName ? userProfile.fullName.charAt(0).toUpperCase() : (userProfile?.name ? userProfile.name.charAt(0).toUpperCase() : 'G')}
                  </div>
                )}
                <div style={{ textAlign: 'left', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '14px', fontWeight: '600', color: activeTab === 'overview' ? '#f8fafc' : '#1e293b' }}>
                    {userProfile?.fullName || userProfile?.name || 'Giảng viên'}
                  </span>
                  <ChevronDown size={14} color={activeTab === 'overview' ? '#cbd5e1' : '#64748b'} />
                </div>
              </button>

              {showUserDropdown && (
                <div style={{ position: 'absolute', top: '110%', right: '0', backgroundColor: '#ffffff', borderRadius: '12px', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)', width: '220px', overflow: 'hidden', border: '1px solid #e2e8f0', zIndex: 50 }}>
                  <div style={{ padding: '16px', borderBottom: '1px solid #f1f5f9' }}>
                    <div style={{ fontWeight: '600', color: '#0f172a', fontSize: '14px' }}>{userProfile?.fullName || userProfile?.name || 'Giảng viên'}</div>
                    <div style={{ fontSize: '13px', color: '#64748b', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{userProfile?.email}</div>
                  </div>
                  <div style={{ padding: '8px' }}>
                    <button onClick={() => { setActiveTab('profile'); setShowUserDropdown(false); }} style={{ width: '100%', padding: '10px 12px', display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'transparent', border: 'none', cursor: 'pointer', borderRadius: '8px', color: '#334155', fontSize: '14px', transition: 'background-color 0.2s', textAlign: 'left' }} className="hover:bg-slate-50">
                      <User size={16} /> Hồ sơ cá nhân
                    </button>
                    <button onClick={handleLogout} style={{ width: '100%', padding: '10px 12px', display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'transparent', border: 'none', cursor: 'pointer', borderRadius: '8px', color: '#dc2626', fontSize: '14px', transition: 'background-color 0.2s', textAlign: 'left' }} className="hover:bg-red-50">
                      <LogOut size={16} /> Đăng xuất
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Dashboard Content */}
        <div style={{ flex: 1, padding: activeTab === 'overview' ? '0' : '32px', overflowY: 'auto', backgroundColor: activeTab === 'overview' ? '#0f172a' : 'transparent' }}>
          <style>{`
            @keyframes floatAnimation {
              0%, 100% { transform: translateY(0) rotate(-5deg); }
              50% { transform: translateY(-10px) rotate(-5deg); }
            }
            @keyframes floatAnimationReverse {
              0%, 100% { transform: translateY(0) rotate(3deg); }
              50% { transform: translateY(-12px) rotate(3deg); }
            }
            .tech-card-1 {
              animation: floatAnimation 4s ease-in-out infinite;
              transition: all 0.3s ease-out;
              cursor: pointer;
            }
            .tech-card-1:hover {
              transform: scale(1.1) rotate(0deg) !important;
              border-color: #34d399 !important;
              box-shadow: 0 0 20px rgba(16,185,129,0.5) !important;
              animation-play-state: paused;
            }
            .tech-card-2 {
              animation: floatAnimationReverse 5s ease-in-out infinite;
              transition: all 0.3s ease-out;
              cursor: pointer;
            }
            .tech-card-2:hover {
              transform: scale(1.1) rotate(0deg) !important;
              border-color: #34d399 !important;
              box-shadow: 0 0 20px rgba(16,185,129,0.5) !important;
              animation-play-state: paused;
            }
            .hero-frame {
              transition: all 0.5s ease;
              cursor: pointer;
            }
            .hero-frame:hover {
              transform: scale(1.05);
              box-shadow: 0 0 40px rgba(16,185,129,0.6) !important;
              border-color: #34d399 !important;
            }
          `}</style>

          {activeTab === 'overview' ? (
            <>
              {/* FULL-SCREEN EDGE-TO-EDGE HERO BANNER */}
              <div
                style={{
                  position: 'relative',
                  width: '100%',
                  minHeight: 'calc(100vh - 72px)',
                  overflow: 'hidden',
                  backgroundImage: 'url("https://images.unsplash.com/photo-1517502884422-41eaead166d4?auto=format&fit=crop&q=80&w=1920")',
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                {/* Dark/Cyan Gradient Overlay */}
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'linear-gradient(to right, rgba(15, 23, 42, 0.98) 0%, rgba(15, 23, 42, 0.85) 45%, rgba(0, 180, 147, 0.2) 100%)'
                }}></div>

                {/* Main Content Grid */}
                <div className="font-sans antialiased w-full flex flex-col lg:flex-row justify-between items-center px-10 py-12 lg:px-16 lg:py-20 gap-8 lg:gap-12" style={{ position: 'relative', zIndex: 2 }}>

                  {/* Left Column: Text & CTA */}
                  <div className="w-full lg:w-7/12 flex flex-col items-start">
                    <div className="text-xs font-semibold tracking-widest uppercase text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-4 py-1.5 rounded-full inline-flex items-center gap-2 mb-6">
                      ✨ MEETINGHUB - ICTU PHÒNG HỌP & THIẾT BỊ
                    </div>

                    <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-[1.15] text-white mb-6">
                      HỆ THỐNG PHÒNG HỌP <br />
                      <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
                        & THIẾT BỊ GIẢNG DẠY
                      </span> <br />
                      THÔNG MINH
                    </h1>

                    <p className="text-slate-300 text-base lg:text-lg font-normal leading-relaxed max-w-2xl mb-8">
                      Chào mừng Giảng viên <strong className="font-semibold text-white">{userProfile?.fullName || userProfile?.name || 'Hoàng Thanh Phương'}</strong> • Trọn bộ giải pháp đăng ký phòng & mượn thiết bị nhanh chóng, chất lượng.
                    </p>

                    <div className="flex flex-wrap gap-4">
                      <button
                        onClick={() => setActiveTab('book-room')}
                        className="bg-[#00b493] text-white px-8 py-3.5 rounded-full text-xs sm:text-sm font-extrabold tracking-wider uppercase transition-all duration-300 shadow-md hover:bg-[#009b7e] hover:-translate-y-1 hover:shadow-[0_15px_30px_rgba(0,180,147,0.6)] flex items-center gap-2"
                      >
                        ĐĂNG KÝ PHÒNG HỌP <Calendar size={18} />
                      </button>
                      <button
                        onClick={() => setActiveTab('request-equipment')}
                        className="bg-transparent text-[#00b493] border-2 border-[#00b493] px-8 py-3.5 rounded-full text-xs sm:text-sm font-extrabold tracking-wider uppercase transition-all duration-300 shadow-md hover:bg-[#00b493]/10 hover:-translate-y-1 hover:shadow-[0_10px_20px_rgba(0,180,147,0.3)] flex items-center gap-2"
                      >
                        MƯỢN THIẾT BỊ <Monitor size={18} />
                      </button>
                    </div>
                  </div>

                  {/* Right Column: Visual Showcase */}
                  <div className="lg:w-5/12 flex justify-center items-center" style={{ position: 'relative' }}>

                    {/* Big Circular Frame */}
                    <div className="hero-frame" style={{
                      width: '450px',
                      height: '450px',
                      borderRadius: '50%',
                      border: '6px solid rgba(0, 180, 147, 0.8)',
                      overflow: 'hidden',
                      boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 40px rgba(0, 180, 147, 0.3)',
                      position: 'relative'
                    }}>
                      <img
                        src="https://images.unsplash.com/photo-1593642632823-8f785ba67e45?auto=format&fit=crop&q=80&w=800"
                        alt="Modern Equipment"
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    </div>

                    {/* Floating Tech Cards */}
                    <div className="tech-card-1" style={{ position: 'absolute', top: '10%', left: '-5%', backgroundColor: 'rgba(15, 23, 42, 0.8)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: '1px solid rgba(0, 180, 147, 0.3)', padding: '12px 20px', borderRadius: '16px', display: 'flex', alignItems: 'center', gap: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.5)', transform: 'rotate(-5deg)' }}>
                      <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: '#00b493', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                        <Video size={20} />
                      </div>
                      <div>
                        <div style={{ color: 'white', fontWeight: 'bold', fontSize: '14px' }}>Camera 4K</div>
                        <div style={{ color: '#00b493', fontSize: '12px', fontWeight: '600' }}>Sẵn sàng</div>
                      </div>
                    </div>

                    <div className="tech-card-2" style={{ position: 'absolute', bottom: '15%', right: '0%', backgroundColor: 'rgba(15, 23, 42, 0.8)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: '1px solid rgba(0, 180, 147, 0.3)', padding: '12px 20px', borderRadius: '16px', display: 'flex', alignItems: 'center', gap: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.5)', transform: 'rotate(3deg)' }}>
                      <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: '#0f172a', border: '1px solid #00b493', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#00b493' }}>
                        <Monitor size={20} />
                      </div>
                      <div>
                        <div style={{ color: 'white', fontWeight: 'bold', fontSize: '14px' }}>Máy chiếu HD</div>
                        <div style={{ color: '#cbd5e1', fontSize: '12px' }}>Trọn bộ thiết bị</div>
                      </div>
                    </div>

                  </div>

                </div>
              </div>
            </>
          ) : activeTab === 'book-room' ? (
            <LecturerRoomBooking userProfile={userProfile} />
          ) : activeTab === 'my-room-requests' ? (
            <LecturerMyRequests userProfile={userProfile} />
          ) : activeTab === 'request-equipment' ? (
            <LecturerEquipmentBooking userProfile={userProfile} />
          ) : activeTab === 'my-equipment' ? (
            <LecturerBorrowedEquipment userProfile={userProfile} />
          ) : activeTab === 'schedule' ? (
            <LecturerSchedule userProfile={userProfile} navigateToTab={setActiveTab} />
          ) : activeTab === 'report-issue' ? (
            <LecturerReportIssue userProfile={userProfile} />
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
