import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckSquare, MonitorSpeaker, Activity, ShieldCheck, Server } from 'lucide-react';
import api from '../services/api';

export default function DashboardView() {
  const navigate = useNavigate();
  const [time, setTime] = useState(new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));

  const [userProfile, setUserProfile] = useState({
    fullName: "Hoàng Thanh Phương",
    shortName: "Hoàng Thanh",
    email: "dtc245180008@ictu.edu.vn",
    avatarUrl: ""
  });

  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);

  const loadUserFromStorage = () => {
    const saved = localStorage.getItem('user') || sessionStorage.getItem('user') || sessionStorage.getItem('currentUser') || sessionStorage.getItem('meetinghub_user');
    if (saved) {
      try {
        setUserProfile(JSON.parse(saved));
      } catch (e) {
        console.error("Lỗi parse user", e);
      }
    }
  };

  const loadDashboardData = async () => {
    let count = 0;
    try {
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

      const saved = localStorage.getItem('meetinghub_room_requests');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          const localOnly = parsed.filter((r: any) => 
            (r.status === 'Chờ duyệt' || r.status === 'pending') &&
            typeof r.id === 'string' && !/^\d+$/.test(r.id)
          ).length;
          count += localOnly;
        } catch (e) {}
      }
      setPendingRequestsCount(count);
    } catch(e) {}
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    loadUserFromStorage();
    loadDashboardData();
    window.addEventListener('user-data-updated', loadUserFromStorage);
    window.addEventListener('userProfileUpdated', loadUserFromStorage);
    window.addEventListener('storage', loadUserFromStorage);
    window.addEventListener('storage', loadDashboardData);
    window.addEventListener('request-updated', loadDashboardData);
    window.addEventListener('roomBookingsUpdated', loadDashboardData);
    return () => {
      window.removeEventListener('user-data-updated', loadUserFromStorage);
      window.removeEventListener('userProfileUpdated', loadUserFromStorage);
      window.removeEventListener('storage', loadUserFromStorage);
      window.removeEventListener('storage', loadDashboardData);
      window.removeEventListener('request-updated', loadDashboardData);
      window.removeEventListener('roomBookingsUpdated', loadDashboardData);
    };
  }, []);

  return (
    <div className="w-full h-[calc(100vh-64px)] relative flex items-center p-8 md:p-16 lg:px-24 bg-[#020617] overflow-hidden">
      {/* ẢNH NỀN VÀ LỚP PHỦ */}
      <img 
        src="https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1600&q=80" 
        alt="Hero Background" 
        className="absolute inset-0 w-full h-full object-cover z-0 opacity-50"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-[#020617] via-[#020617]/90 to-transparent z-10"></div>
      
      {/* NỘI DUNG CHÍNH (CHIA 2 CỘT) */}
      <div className="relative z-20 w-full max-w-[1400px] mx-auto flex flex-col lg:flex-row items-center justify-between gap-16">
        
        {/* CỘT TRÁI: TEXT & BUTTONS */}
        <div className="flex-1 space-y-8 w-full max-w-2xl">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold bg-teal-500/10 text-teal-400 border border-teal-500/30 tracking-widest shadow-lg shadow-teal-500/10">
            <Activity size={16} className="animate-pulse" />
            TRUNG TÂM ĐIỀU HÀNH ADMIN
          </div>
          
          {/* Tiêu đề */}
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-white tracking-tight leading-[1.15]">
            HỆ THỐNG <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-cyan-300">QUẢN LÝ PHÒNG HỌP & THIẾT BỊ</span> THÔNG MINH
          </h1>
          
          {/* Subtitle */}
          <p className="text-slate-300 text-lg md:text-xl font-normal leading-relaxed opacity-90">
            Chào mừng <span className="text-white font-bold">{userProfile.fullName || userProfile.shortName || 'Hoàng Phương'}</span>. Hệ thống hiện đang có <span className="text-amber-400 font-bold px-1">{pendingRequestsCount} yêu cầu</span> chờ duyệt. Trọn bộ công cụ kiểm soát không gian và thiết bị chất lượng cao.
          </p>
          
          {/* Buttons */}
          <div className="flex flex-wrap items-center gap-5 pt-4">
            <button 
              onClick={() => navigate('/approvals')}
              className="group relative flex items-center gap-3 px-8 py-4 rounded-full bg-gradient-to-r from-teal-400 to-teal-500 hover:from-teal-300 hover:to-teal-400 text-slate-950 font-extrabold tracking-wide transition-all shadow-[0_0_20px_rgba(45,212,191,0.4)] hover:shadow-[0_0_40px_rgba(45,212,191,0.6)] transform hover:-translate-y-1"
            >
              DUYỆT YÊU CẦU
              <CheckSquare size={20} className="group-hover:scale-110 transition-transform" />
              {pendingRequestsCount > 0 && (
                <span className="absolute -top-2 -right-2 flex items-center justify-center w-6 h-6 bg-red-500 text-white text-xs font-black rounded-full animate-bounce shadow-lg shadow-red-500/50">
                  {pendingRequestsCount}
                </span>
              )}
            </button>

            <button 
              onClick={() => navigate('/rooms')}
              className="group flex items-center gap-3 px-8 py-4 rounded-full bg-slate-900/50 backdrop-blur-md border border-teal-500/50 text-teal-400 hover:bg-teal-500/10 font-bold tracking-wide transition-all transform hover:-translate-y-1"
            >
              QUẢN LÝ PHÒNG HỌP
              <MonitorSpeaker size={20} className="group-hover:scale-110 transition-transform" />
            </button>
          </div>
        </div>

        {/* CỘT PHẢI: HÌNH ẢNH TRÒN VÀ FLOATING BADGES */}
        <div className="hidden lg:flex flex-1 justify-center relative w-full">
          <div className="relative w-[500px] h-[500px] xl:w-[600px] xl:h-[600px] rounded-full p-[3px] bg-gradient-to-bl from-teal-400 via-teal-500/20 to-transparent animate-pulse-slow">
            {/* Hình ảnh tròn */}
            <div className="w-full h-full rounded-full overflow-hidden border-[6px] border-[#020617] relative shadow-[0_0_50px_rgba(45,212,191,0.15)]">
              <img 
                src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1200&q=80" 
                alt="Dashboard Data" 
                className="w-full h-full object-cover scale-105 hover:scale-100 transition-transform duration-1000"
              />
              <div className="absolute inset-0 bg-teal-900/10 mix-blend-overlay"></div>
            </div>

            {/* Floating Badge 1 (Top Left) */}
            <div className="absolute top-20 -left-6 xl:top-24 xl:-left-12 bg-slate-900/90 backdrop-blur-xl border border-slate-700/50 p-4 rounded-2xl flex items-center gap-4 shadow-2xl transform hover:scale-105 transition-transform cursor-default">
              <div className="w-12 h-12 rounded-xl bg-teal-500/20 flex items-center justify-center shadow-inner">
                <ShieldCheck size={24} className="text-teal-400" />
              </div>
              <div>
                <p className="text-white font-black text-sm m-0 leading-tight tracking-wide">Bảo mật hệ thống</p>
                <p className="text-teal-400 text-xs font-bold m-0 mt-1">An toàn 100%</p>
              </div>
            </div>

            {/* Floating Badge 2 (Bottom Right) */}
            <div className="absolute bottom-20 -right-6 xl:bottom-24 xl:-right-12 bg-slate-900/90 backdrop-blur-xl border border-slate-700/50 p-4 rounded-2xl flex items-center gap-4 shadow-2xl transform hover:scale-105 transition-transform cursor-default">
              <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center shadow-inner">
                <Server size={24} className="text-blue-400" />
              </div>
              <div>
                <p className="text-white font-black text-sm m-0 leading-tight tracking-wide">Trạng thái Server</p>
                <p className="text-blue-400 text-xs font-bold m-0 mt-1">Hoạt động ổn định</p>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
