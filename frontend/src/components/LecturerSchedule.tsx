import React, { useState, useEffect } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Clock, MapPin, Search, Users, Video, AlertTriangle, Monitor, X, Filter, Package, User, BookOpen, FileText, Info } from 'lucide-react';
import { getStorage, useDataSync } from '../utils/syncHelper';

interface ScheduleEvent {
  id: string;
  title: string;
  type: 'Dạy' | 'Họp' | 'Sinh hoạt';
  room: string;
  dayOfWeek: number; // 1 = Thứ 2, 2 = Thứ 3, ... 7 = Chủ Nhật
  timeSlot: 'Ca 1' | 'Ca 2' | 'Ca 3' | 'Ca 4' | 'Khác';
  timeString: string;
  dateStr: string;
  attendees?: number;
}

export default function LecturerSchedule({ userProfile, navigateToTab }: { userProfile: any, navigateToTab: (tab: string) => void }) {
  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [viewMode, setViewMode] = useState<'Tuần' | 'Ngày' | 'Timeline'>('Tuần');
  const [currentDate, setCurrentDate] = useState<Date>(new Date(2026, 8, 30));
  const [filterType, setFilterType] = useState<'Tất cả' | 'Lịch giảng dạy' | 'Lịch họp / Hội thảo'>('Tất cả');
  
  const [selectedEvent, setSelectedEvent] = useState<ScheduleEvent | null>(null);

  useDataSync('room_bookings', () => {
    loadSchedule();
  });

  useEffect(() => {
    loadSchedule();
  }, [userProfile]);

  const loadSchedule = () => {
    // 1. Mock base schedule
    let baseEvents: ScheduleEvent[] = [
      { id: 'EV_01', title: 'Lập trình Web (Lớp CNTT K18)', type: 'Dạy', room: 'Phòng A102', dayOfWeek: 1, timeSlot: 'Ca 1', timeString: '07:00 - 09:15', dateStr: '30/09/2026', attendees: 60 },
      { id: 'EV_02', title: 'Họp Bộ môn Phần mềm', type: 'Họp', room: 'Phòng Hội thảo 2', dayOfWeek: 2, timeSlot: 'Ca 2', timeString: '09:30 - 11:00', dateStr: '01/10/2026', attendees: 15 },
      { id: 'EV_03', title: 'Cơ sở dữ liệu (Lớp HTTT K18)', type: 'Dạy', room: 'Phòng B204', dayOfWeek: 3, timeSlot: 'Ca 3', timeString: '13:30 - 15:45', dateStr: '02/10/2026', attendees: 55 },
      { id: 'EV_04', title: 'Bảo vệ Đồ án tốt nghiệp đợt 1', type: 'Họp', room: 'Phòng A101', dayOfWeek: 4, timeSlot: 'Khác', timeString: '07:00 - 11:30', dateStr: '03/10/2026', attendees: 40 },
      { id: 'EV_05', title: 'Sinh hoạt lớp CNTT K18', type: 'Sinh hoạt', room: 'Phòng C102', dayOfWeek: 5, timeSlot: 'Khác', timeString: '14:00 - 16:30', dateStr: '04/10/2026', attendees: 60 },
    ];

    // 2. Read from room_bookings
    const parsedReqs = getStorage<any[]>('room_bookings', []);
    if (parsedReqs && parsedReqs.length > 0) {
      try {
        const approvedReqs = parsedReqs.filter((r: any) => 
          (r.status === 'Đã duyệt' || r.status === 'Chờ duyệt') && 
          r.lecturerEmail === userProfile?.email
        );
        
        approvedReqs.forEach((r: any) => {
          let mappedType: any = 'Họp';
          if (r.type === 'Giảng dạy bổ sung') mappedType = 'Dạy';
          if (r.type === 'Sinh hoạt lớp/CLB') mappedType = 'Sinh hoạt';

          // Calculate correct day of week from date (YYYY-MM-DD)
          // d.getDay() returns 0 for Sunday, 1 for Monday.
          // The grid uses 1 for Monday, ..., 7 for Sunday.
          const dateObj = new Date(r.date);
          let dow = dateObj.getDay();
          if (dow === 0) dow = 7;

          baseEvents.push({
            id: r.id,
            title: r.purpose || r.title || 'Sự kiện',
            type: mappedType,
            room: r.roomName,
            dayOfWeek: dow,
            timeSlot: r.shift as any || 'Khác',
            timeString: r.timeString || r.timeSlot || '',
            dateStr: r.date.split('-').reverse().join('/'),
            attendees: r.attendees
          });
        });
      } catch (e) {}
    }

    setEvents(baseEvents);
  };

  const getEventStyle = (type: string) => {
    if (type === 'Dạy') return { borderL: '#4f46e5', badgeBg: '#e0e7ff', badgeColor: '#4338ca' }; // indigo-600, indigo-50, indigo-700
    if (type === 'Họp') return { borderL: '#1e293b', badgeBg: '#f1f5f9', badgeColor: '#1e293b' }; // slate-800, slate-100, slate-800
    return { borderL: '#0ea5e9', badgeBg: '#f0f9ff', badgeColor: '#0369a1' }; // sky-500, sky-50, sky-700
  };

  const timeSlots = ['Ca 1', 'Ca 2', 'Ca 3', 'Ca 4'];
  const slotLabels = {
    'Ca 1': 'Ca 1 (07:00 - 09:15)',
    'Ca 2': 'Ca 2 (09:30 - 11:45)',
    'Ca 3': 'Ca 3 (13:00 - 15:15)',
    'Ca 4': 'Ca 4 (15:30 - 17:45)'
  };
  const days = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'CN'];
  
  const getMonday = (d: Date) => {
    const date = new Date(d);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(date.setDate(diff));
  };
  
  const startOfWeekDate = getMonday(currentDate);
  const getFormattedDate = (index: number) => {
    const d = new Date(startOfWeekDate);
    d.setDate(d.getDate() + index);
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`;
  };
  
  const isToday = (index: number) => {
    const d = new Date(startOfWeekDate);
    d.setDate(d.getDate() + index);
    const today = new Date(); // Or hardcoded demo today
    // Hardcode demo today for visual stability:
    const demoToday = new Date(2026, 8, 30);
    return d.getDate() === demoToday.getDate() && d.getMonth() === demoToday.getMonth() && d.getFullYear() === demoToday.getFullYear();
  };

  const handlePrev = () => {
    const newDate = new Date(currentDate);
    if (viewMode === 'Tuần') newDate.setDate(newDate.getDate() - 7);
    else newDate.setDate(newDate.getDate() - 1);
    setCurrentDate(newDate);
  };

  const handleNext = () => {
    const newDate = new Date(currentDate);
    if (viewMode === 'Tuần') newDate.setDate(newDate.getDate() + 7);
    else newDate.setDate(newDate.getDate() + 1);
    setCurrentDate(newDate);
  };

  const handleToday = () => setCurrentDate(new Date(2026, 8, 30));

  const renderDateRange = () => {
    if (viewMode === 'Tuần') {
      const endOfWeek = new Date(startOfWeekDate);
      endOfWeek.setDate(endOfWeek.getDate() + 6);
      return `Tuần từ ${startOfWeekDate.getDate().toString().padStart(2, '0')}/${(startOfWeekDate.getMonth() + 1).toString().padStart(2, '0')} - ${endOfWeek.getDate().toString().padStart(2, '0')}/${(endOfWeek.getMonth() + 1).toString().padStart(2, '0')}/${endOfWeek.getFullYear()}`;
    }
    return `Ngày ${currentDate.getDate().toString().padStart(2, '0')}/${(currentDate.getMonth() + 1).toString().padStart(2, '0')}/${currentDate.getFullYear()}`;
  };

  const filteredEvents = events.filter(ev => {
    if (filterType === 'Lịch giảng dạy' && ev.type !== 'Dạy') return false;
    if (filterType === 'Lịch họp / Hội thảo' && ev.type !== 'Họp') return false;
    return true;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', paddingBottom: '40px', height: '100%' }}>
      
      {/* Header & Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: '#0f172a', margin: '0 0 8px 0' }}>Lịch dạy & Lịch họp</h2>
          <p style={{ color: '#64748b', margin: 0, fontSize: '15px' }}>Xem tổng quan lịch trình của bạn trong tuần.</p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {/* View Mode Toggle */}
          <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200/60 shadow-sm">
            {['Tuần', 'Ngày', 'Timeline'].map(mode => (
              <button
                key={mode}
                onClick={() => setViewMode(mode as any)}
                className={`px-4 py-1.5 rounded-md text-sm transition-all ${
                  viewMode === mode 
                    ? 'bg-white text-slate-900 font-medium shadow-sm' 
                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Date Navigation & Filters */}
      <div style={{ backgroundColor: 'white', padding: '16px 24px', borderRadius: '20px', border: '1px solid #e2e8f0', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '20px', alignItems: 'center', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
        
        {/* Date Nav */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button onClick={handleToday} style={{ padding: '8px 16px', borderRadius: '10px', border: '1px solid #cbd5e1', backgroundColor: 'white', color: '#0f172a', fontWeight: '600', cursor: 'pointer', fontSize: '14px' }} className="hover:bg-slate-50">
            Hôm nay
          </button>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button onClick={handlePrev} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '4px', borderRadius: '50%' }} className="hover:bg-slate-100">
              <ChevronLeft size={20} />
            </button>
            <span style={{ fontSize: '15px', fontWeight: 'bold', color: '#0f172a', minWidth: '220px', textAlign: 'center' }}>
              {renderDateRange()}
            </span>
            <button onClick={handleNext} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '4px', borderRadius: '50%' }} className="hover:bg-slate-100">
              <ChevronRight size={20} />
            </button>
          </div>
        </div>

        {/* Type Filter */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-slate-500">
            <Filter size={16} />
            <span className="text-sm font-semibold">Lọc:</span>
          </div>
          <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200/60 shadow-sm">
            {['Tất cả', 'Lịch giảng dạy', 'Lịch họp / Hội thảo'].map(tab => (
              <button
                key={tab}
                onClick={() => setFilterType(tab as any)}
                className={`px-4 py-1.5 rounded-md text-sm transition-all ${
                  filterType === tab 
                    ? 'bg-white text-slate-900 font-medium shadow-sm' 
                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Calendar Grid View (Tuần) */}
      {viewMode === 'Tuần' && (
      <div style={{ backgroundColor: 'white', borderRadius: '24px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', flex: 1, display: 'flex', flexDirection: 'column' }}>
        
        {/* Grid Header (Days) */}
        <div style={{ display: 'grid', gridTemplateColumns: '100px repeat(7, 1fr)', borderBottom: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
          <div style={{ padding: '16px', borderRight: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: '13px', fontWeight: '600' }}>GMT+7</div>
          {days.map((day, i) => (
            <div key={day} className={`p-4 text-center ${isToday(i) ? 'bg-slate-900 text-white rounded-t-lg' : 'bg-transparent'} ${i < 6 ? 'border-r border-slate-200' : ''}`}>
              <div className={`text-sm font-bold ${isToday(i) ? 'text-white' : 'text-slate-900'}`}>{day}</div>
              <div className={`text-xs mt-1 font-medium ${isToday(i) ? 'text-slate-300' : 'text-slate-500'}`}>{getFormattedDate(i)}</div>
            </div>
          ))}
        </div>

        {/* Grid Body (Time Slots) */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {timeSlots.map((slot, sIdx) => (
            <div key={slot} style={{ display: 'grid', gridTemplateColumns: '100px repeat(7, 1fr)', borderBottom: '1px solid #e2e8f0', minHeight: '140px' }}>
              
              <div style={{ padding: '16px 8px', borderRight: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', backgroundColor: '#f8fafc' }}>
                <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#475569' }}>{slot}</span>
                <span style={{ fontSize: '11px', color: '#94a3b8', textAlign: 'center' }}>{(slotLabels as any)[slot].split('(')[1].replace(')', '')}</span>
              </div>

              {days.map((day, dIdx) => {
                const dayEvents = filteredEvents.filter(e => e.dayOfWeek === dIdx + 1 && e.timeSlot === slot);
                return (
                  <div key={day} className={`p-2 flex flex-col gap-2 relative ${dIdx < 6 ? 'border-r border-slate-200' : ''} ${isToday(dIdx) ? 'bg-slate-50/50' : 'bg-transparent'}`}>
                    {dayEvents.map(ev => {
                      const style = getEventStyle(ev.type);
                      return (
                        <div 
                          key={ev.id}
                          onClick={() => setSelectedEvent(ev)}
                          className="bg-white rounded-lg p-3 cursor-pointer flex flex-col gap-1.5 shadow-sm hover:shadow-md transition-all border border-slate-200/80 hover:border-slate-300"
                          style={{ borderLeft: `4px solid ${style.borderL}` }}
                        >
                          <div className="flex justify-between items-start mb-1">
                            <span style={{ backgroundColor: style.badgeBg, color: style.badgeColor }} className="text-[10px] font-bold px-1.5 py-0.5 rounded-md">
                              {ev.type}
                            </span>
                          </div>
                          <div className="font-semibold text-slate-900 text-sm mb-1 line-clamp-2 leading-snug">{ev.title}</div>
                          <div className="text-xs text-slate-500 flex items-center font-medium">
                            <MapPin className="w-3.5 h-3.5 text-slate-400 inline mr-1 shrink-0" />
                            {ev.room}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                );
              })}
            </div>
          ))}

          {/* "Khác" row for out-of-bounds times */}
          <div style={{ display: 'grid', gridTemplateColumns: '100px repeat(7, 1fr)', borderBottom: '1px solid #e2e8f0', minHeight: '140px' }}>
            <div style={{ padding: '16px 8px', borderRight: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', backgroundColor: '#f8fafc' }}>
              <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#475569' }}>Lịch Khác</span>
              <span style={{ fontSize: '11px', color: '#94a3b8', textAlign: 'center' }}>Ngoài giờ hành chính</span>
            </div>
            {days.map((day, dIdx) => {
              const dayEvents = filteredEvents.filter(e => e.dayOfWeek === dIdx + 1 && e.timeSlot === 'Khác');
              return (
                <div key={day} className={`p-2 flex flex-col gap-2 relative ${dIdx < 6 ? 'border-r border-slate-200' : ''} ${isToday(dIdx) ? 'bg-slate-50/50' : 'bg-transparent'}`}>
                  {dayEvents.map(ev => {
                    const style = getEventStyle(ev.type);
                    return (
                      <div 
                        key={ev.id}
                        onClick={() => setSelectedEvent(ev)}
                        className="bg-white rounded-lg p-3 cursor-pointer flex flex-col gap-1.5 shadow-sm hover:shadow-md transition-all border border-slate-200/80 hover:border-slate-300"
                        style={{ borderLeft: `4px solid ${style.borderL}` }}
                      >
                        <div className="flex justify-between items-start mb-1">
                          <span style={{ backgroundColor: style.badgeBg, color: style.badgeColor }} className="text-[10px] font-bold px-1.5 py-0.5 rounded-md">
                            {ev.type}
                          </span>
                        </div>
                        <div className="font-semibold text-slate-900 text-sm mb-1 line-clamp-2 leading-snug">{ev.title}</div>
                        <div className="text-xs text-slate-500 flex items-center font-medium">
                          <Clock className="w-3.5 h-3.5 text-slate-400 inline mr-1 shrink-0" />
                          {ev.timeString}
                        </div>
                      </div>
                    )
                  })}
                </div>
              );
            })}
          </div>

        </div>
      </div>
      )}

      {/* Day / Timeline Views Placeholder */}
      {viewMode !== 'Tuần' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col flex-1 p-8">
          <h3 className="text-xl font-bold text-slate-800 mb-6 border-b border-slate-100 pb-4">
            {viewMode === 'Ngày' ? 'Lịch trình chi tiết trong ngày' : 'Agenda sự kiện (Timeline)'}
          </h3>
          <div className="flex flex-col gap-4">
            {filteredEvents.filter(e => {
              if ((viewMode as string) === 'Tuần') return true;
              // Filter to exact date (demo logic uses startOfWeek offset)
              const eventDate = new Date(startOfWeekDate);
              eventDate.setDate(eventDate.getDate() + (e.dayOfWeek - 1));
              return eventDate.getDate() === currentDate.getDate() && eventDate.getMonth() === currentDate.getMonth();
            }).length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                <Calendar className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                <p>Không có lịch trình nào trong ngày này.</p>
              </div>
            ) : (
              filteredEvents.filter(e => {
                const eventDate = new Date(startOfWeekDate);
                eventDate.setDate(eventDate.getDate() + (e.dayOfWeek - 1));
                return eventDate.getDate() === currentDate.getDate() && eventDate.getMonth() === currentDate.getMonth();
              }).map(ev => {
                const style = getEventStyle(ev.type);
                return (
                  <div 
                    key={ev.id}
                    onClick={() => setSelectedEvent(ev)}
                    className="bg-white rounded-xl p-5 cursor-pointer flex gap-6 items-center shadow-sm hover:shadow-md transition-all border border-slate-200/80 hover:border-slate-300"
                    style={{ borderLeft: `6px solid ${style.borderL}` }}
                  >
                    <div className="w-24 shrink-0 text-center border-r border-slate-100 pr-6">
                      <div className="text-lg font-bold text-slate-700">{ev.timeSlot === 'Khác' ? ev.timeString.split(' - ')[0] : ev.timeString.split(' - ')[0]}</div>
                      <div className="text-xs font-semibold text-slate-400 mt-1">{ev.timeSlot}</div>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <span style={{ backgroundColor: style.badgeBg, color: style.badgeColor }} className="text-xs font-bold px-2 py-0.5 rounded-md">
                          {ev.type}
                        </span>
                      </div>
                      <div className="font-bold text-slate-900 text-lg mb-1">{ev.title}</div>
                      <div className="text-sm text-slate-500 flex items-center font-medium mt-2">
                        <MapPin className="w-4 h-4 text-slate-400 inline mr-1.5 shrink-0" />
                        {ev.room}
                        <Users className="w-4 h-4 text-slate-400 inline ml-4 mr-1.5 shrink-0" />
                        {ev.attendees} người
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}

      {/* Event Detail Modal */}
      {selectedEvent && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '24px', width: '100%', maxWidth: '500px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            
            <div style={{ padding: '24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', backgroundColor: '#f8fafc' }}>
              <div>
                <span style={{ fontSize: '12px', fontWeight: 'bold', backgroundColor: getEventStyle(selectedEvent.type).badgeBg, color: getEventStyle(selectedEvent.type).badgeColor, padding: '4px 8px', borderRadius: '6px', marginBottom: '8px', display: 'inline-block' }}>
                  {selectedEvent.type}
                </span>
                <h3 style={{ fontSize: '20px', fontWeight: 'bold', color: '#0f172a', margin: '0 0 8px 0', lineHeight: 1.4 }}>{selectedEvent.title}</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', color: '#64748b', fontSize: '14px' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Calendar size={16}/> {selectedEvent.dateStr}</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Clock size={16}/> {selectedEvent.timeString}</span>
                </div>
              </div>
              <button onClick={() => setSelectedEvent(null)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '8px', borderRadius: '50%' }} className="hover:bg-slate-200">
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', backgroundColor: '#eff6ff', padding: '16px', borderRadius: '16px', border: '1px solid #bfdbfe' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: 'white', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <MapPin size={24} />
                </div>
                <div>
                  <div style={{ fontSize: '13px', color: '#3b82f6', fontWeight: '600', marginBottom: '2px' }}>ĐỊA ĐIỂM SỬ DỤNG</div>
                  <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#1e3a8a' }}>{selectedEvent.room}</div>
                </div>
              </div>

              <div>
                <div style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Monitor size={18} color="#64748b"/> Tiện ích sẵn có tại phòng
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {['Máy chiếu', 'Bảng thông minh', 'Điều hòa', 'Wifi 6', 'Loa & Mic'].map(fac => (
                    <span key={fac} style={{ backgroundColor: '#f1f5f9', color: '#475569', padding: '6px 12px', borderRadius: '8px', fontSize: '13px', fontWeight: '500' }}>
                      {fac}
                    </span>
                  ))}
                </div>
              </div>

              {selectedEvent.attendees && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: '#475569' }}>
                  <Users size={16} /> Số lượng tham dự: <strong>{selectedEvent.attendees} người</strong>
                </div>
              )}

              <div style={{ height: '1px', backgroundColor: '#e2e8f0', margin: '8px 0' }}></div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <button 
                  onClick={() => {
                    setSelectedEvent(null);
                    navigateToTab('request-equipment');
                  }}
                  style={{ width: '100%', padding: '14px', borderRadius: '12px', border: 'none', backgroundColor: '#2563eb', color: 'white', fontWeight: 'bold', fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: '0 4px 6px rgba(37, 99, 235, 0.2)' }}
                  className="hover:bg-blue-700 transition-colors"
                >
                  <Package size={18} /> Đăng ký mượn thêm thiết bị
                </button>
                <button 
                  onClick={() => {
                    setSelectedEvent(null);
                    navigateToTab('report-issue');
                  }}
                  style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid #fecaca', backgroundColor: '#fef2f2', color: '#dc2626', fontWeight: 'bold', fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                  className="hover:bg-red-100 transition-colors"
                >
                  <AlertTriangle size={18} /> Báo sự cố phòng này
                </button>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}
