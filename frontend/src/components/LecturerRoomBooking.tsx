import React, { useState, useEffect } from 'react';
import {
  Search, MapPin, Users, Calendar, Monitor, AlertTriangle,
  Check, Info, ArrowRight, Eye, X, Building, CheckCircle2, Sparkles, Filter
} from 'lucide-react';
import api from '../services/api';

interface Room {
  id: string;
  room_id: number;
  name: string;
  building: string;
  floor: string;
  capacity: number;
  type: string;
  status: 'Sẵn sàng' | 'Bảo trì' | 'Đang họp';
  rawStatus: string;
  image: string;
  description: string;
  equipment: string[];
  restrictions?: any[];
  currentMeeting?: { title: string; time: string; requester?: string };
}

interface LecturerRoomBookingProps {
  userProfile?: any;
  onNavigateToTab?: (tab: string) => void;
}

const presetImages = [
  'https://images.unsplash.com/photo-1505373877841-8d25f7d46678?auto=format&fit=crop&q=80&w=800',
  'https://images.unsplash.com/photo-1571624436279-b272aff752b5?auto=format&fit=crop&q=80&w=800',
  'https://images.unsplash.com/photo-1542744173-8e7e53415bb0?auto=format&fit=crop&q=80&w=800',
  'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&q=80&w=800',
  'https://images.unsplash.com/photo-1516321497487-e288fb19713f?auto=format&fit=crop&q=80&w=800',
  'https://images.unsplash.com/photo-1524178232363-1fb2b075b655?auto=format&fit=crop&q=80&w=800',
];

export default function LecturerRoomBooking({ userProfile, onNavigateToTab }: LecturerRoomBookingProps) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [buildingFilter, setBuildingFilter] = useState('all');
  const [capacityFilter, setCapacityFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Modal
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);

  // ── Fetch danh sách phòng từ API ──
  useEffect(() => {
    const fetchRooms = async () => {
      setLoading(true);
      try {
        const [roomsRes, meetingsRes] = await Promise.allSettled([
          api.get('/rooms'),
          api.get('/meetings')
        ]);

        const allMeetings = (meetingsRes.status === 'fulfilled' && Array.isArray(meetingsRes.value.data)) ? meetingsRes.value.data : [];
        const now = new Date();

        if (roomsRes.status === 'fulfilled' && roomsRes.value.data && roomsRes.value.data.length > 0) {
          const mappedRooms: Room[] = roomsRes.value.data.map((r: any, index: number) => {
            const loc: string = r.location || '';
            let floor = '';
            let building = loc;

            const commaParts = loc.split(',').map((s: string) => s.trim());
            if (commaParts.length >= 2) {
              floor = commaParts[0];
              building = commaParts.slice(1).join(', ');
            } else {
              const spaceMatch = loc.match(/^(T[ầẩ]ng\s+\S+)\s+(.+)$/i);
              if (spaceMatch) {
                floor = spaceMatch[1];
                building = spaceMatch[2];
              }
            }

            const activeMeeting = allMeetings.find((m: any) => {
              if (['CANCELLED', 'REJECTED'].includes(m.status)) return false;
              if (Number(m.room_id) !== Number(r.room_id)) return false;
              const st = new Date(m.start_time);
              const et = new Date(m.end_time);
              return now >= st && now <= et;
            });

            let mappedStatus: 'Sẵn sàng' | 'Bảo trì' | 'Đang họp' = 'Sẵn sàng';
            let curMeet: any = undefined;
            if (r.status === 'MAINTENANCE' || r.status === 'Đang bảo trì') {
              mappedStatus = 'Bảo trì';
            } else if (activeMeeting) {
              mappedStatus = 'Đang họp';
              const st = new Date(activeMeeting.start_time);
              const et = new Date(activeMeeting.end_time);
              curMeet = {
                title: activeMeeting.title,
                time: `${st.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${et.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
                requester: activeMeeting.organizer?.full_name
              };
            }

            let eqList: string[] = [];
            if (r.equipments && r.equipments.trim()) {
              eqList = r.equipments.split(',').map((s: string) => s.trim()).filter(Boolean);
            } else if (r.description && r.description.trim()) {
              eqList = r.description.split(',').map((s: string) => s.trim()).filter(Boolean);
            }

            const img = (r.image_url && r.image_url.trim())
              ? r.image_url
              : presetImages[index % presetImages.length];

            return {
              id: r.room_id ? r.room_id.toString() : String(index + 1),
              room_id: r.room_id || (index + 1),
              name: r.room_name || r.name || 'Phòng không tên',
              building: building || 'Tòa nhà CNTT',
              floor: floor,
              capacity: r.capacity || 0,
              type: 'Phòng họp',
              status: mappedStatus,
              rawStatus: r.status || 'AVAILABLE',
              image: img,
              description: r.description || 'Không gian họp tiêu chuẩn phục vụ các cuộc họp, hội thảo, bảo vệ đồ án và sinh hoạt học thuật.',
              equipment: eqList,
              restrictions: r.restrictions || [],
              currentMeeting: curMeet,
            };
          });
          setRooms(mappedRooms);
          setApiError(false);
        } else {
          setRooms([]);
        }
      } catch (err) {
        console.error('Lỗi khi lấy danh sách phòng:', err);
        setApiError(true);
        setRooms([]);
      } finally {
        setLoading(false);
      }
    };

    fetchRooms();
  }, []);

  // Danh sách tòa nhà duy nhất
  const uniqueBuildings = Array.from(new Set(rooms.map(r => r.building).filter(Boolean)));

  // Lọc phòng
  const filteredRooms = rooms.filter(room => {
    if (buildingFilter !== 'all' && room.building !== buildingFilter) return false;
    if (statusFilter !== 'all' && room.rawStatus !== statusFilter) return false;

    if (capacityFilter === 'under30' && room.capacity >= 30) return false;
    if (capacityFilter === '30to60' && (room.capacity < 30 || room.capacity > 60)) return false;
    if (capacityFilter === 'over60' && room.capacity <= 60) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = room.name.toLowerCase().includes(q);
      const matchBuilding = room.building.toLowerCase().includes(q);
      const matchEq = room.equipment.some(e => e.toLowerCase().includes(q));
      return matchName || matchBuilding || matchEq;
    }
    return true;
  });

  const availableCount = rooms.filter(r => r.status === 'Sẵn sàng').length;
  const maintenanceCount = rooms.filter(r => r.status === 'Bảo trì').length;

  const handleGoToCalendar = () => {
    if (onNavigateToTab) {
      onNavigateToTab('overview');
    }
  };

  return (
    <div className="flex flex-col gap-6 pb-12 font-sans antialiased" style={{ maxWidth: '1400px', margin: '0 auto' }}>

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-900 rounded-3xl p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 opacity-10 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px]"></div>
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-semibold mb-3 border border-blue-400/30">
              <Sparkles size={14} /> Tra cứu tài nguyên không gian
            </div>
            <h2 className="text-3xl font-extrabold tracking-tight mb-2">Danh Mục Phòng Họp &amp; Tiện Ích</h2>
            <p className="text-slate-300 text-base max-w-2xl font-normal leading-relaxed">
              Khám phá danh sách các phòng họp, hội trường và phòng hội thảo của trường với thông tin sức chứa và trang thiết bị hỗ trợ đầy đủ.
            </p>
          </div>

          <button
            onClick={handleGoToCalendar}
            className="self-start md:self-center px-6 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm flex items-center gap-2.5 shadow-lg shadow-blue-600/30 transition-all hover:scale-105 active:scale-95 shrink-0"
          >
            <Calendar size={18} />
            <span>Mở Lịch họp (Calendar)</span>
            <ArrowRight size={16} />
          </button>
        </div>
      </div>

      {/* Thông báo hướng dẫn Calendar-centric */}
      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 px-6 flex items-center justify-between gap-4 text-blue-900 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0">
            <Info size={20} />
          </div>
          <div>
            <div className="font-bold text-sm text-blue-950">Quy trình đặt lịch họp chuẩn:</div>
            <div className="text-xs text-blue-800 mt-0.5">
              Phòng họp được quản lý tập trung theo lịch họp. Để sử dụng phòng, bạn vui lòng chuyển sang <strong>Lịch họp (Calendar)</strong> $\rightarrow$ chọn khung giờ $\rightarrow$ chọn phòng họp tương ứng.
            </div>
          </div>
        </div>

        <button
          onClick={handleGoToCalendar}
          className="px-4 py-2 bg-white hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-lg border border-blue-300 transition-colors shrink-0"
        >
          Tạo lịch ngay
        </button>
      </div>

      {/* Thống kê nhanh */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Building size={24} />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-800">{rooms.length}</div>
            <div className="text-xs font-medium text-slate-500">Tổng số phòng họp</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 size={24} />
          </div>
          <div>
            <div className="text-2xl font-black text-emerald-600">{availableCount}</div>
            <div className="text-xs font-medium text-slate-500">Phòng sẵn sàng hoạt động</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <AlertTriangle size={24} />
          </div>
          <div>
            <div className="text-2xl font-black text-amber-600">{maintenanceCount}</div>
            <div className="text-xs font-medium text-slate-500">Phòng đang bảo trì</div>
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-wrap gap-4 items-center justify-between">
        
        {/* Search */}
        <div className="relative flex-1 min-w-[260px]">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm theo tên phòng, tòa nhà, thiết bị..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full py-2.5 pl-10 pr-4 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 bg-slate-50 outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
          />
        </div>

        {/* Dropdowns */}
        <div className="flex flex-wrap gap-3 items-center">
          {/* Tòa nhà */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-400 uppercase">Tòa nhà:</span>
            <select
              value={buildingFilter}
              onChange={(e) => setBuildingFilter(e.target.value)}
              className="py-2 px-3 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 bg-slate-50 outline-none cursor-pointer focus:border-blue-500"
            >
              <option value="all">Tất cả các tòa</option>
              {uniqueBuildings.map(b => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>

          {/* Sức chứa */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-400 uppercase">Sức chứa:</span>
            <select
              value={capacityFilter}
              onChange={(e) => setCapacityFilter(e.target.value)}
              className="py-2 px-3 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 bg-slate-50 outline-none cursor-pointer focus:border-blue-500"
            >
              <option value="all">Tất cả</option>
              <option value="under30">&lt; 30 chỗ</option>
              <option value="30to60">30 - 60 chỗ</option>
              <option value="over60">&gt; 60 chỗ</option>
            </select>
          </div>

          {/* Trạng thái */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-400 uppercase">Trạng thái:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="py-2 px-3 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 bg-slate-50 outline-none cursor-pointer focus:border-blue-500"
            >
              <option value="all">Tất cả</option>
              <option value="AVAILABLE">Sẵn sàng</option>
              <option value="MAINTENANCE">Bảo trì</option>
            </select>
          </div>
        </div>

      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-500 font-medium">Đang tải danh sách phòng...</p>
        </div>
      )}

      {/* Error State */}
      {!loading && apiError && (
        <div style={{ padding: '40px', textAlign: 'center', backgroundColor: '#fff7ed', borderRadius: '24px', border: '1px solid #fed7aa' }}>
          <AlertTriangle size={48} color="#f97316" style={{ margin: '0 auto 16px auto' }} />
          <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#9a3412', margin: '0 0 8px 0' }}>Không thể kết nối với máy chủ</h3>
          <p style={{ color: '#ea580c', margin: 0 }}>Vui lòng kiểm tra kết nối mạng hoặc thử lại sau.</p>
        </div>
      )}

      {/* Room Grid */}
      {!loading && !apiError && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          {filteredRooms.map(room => {
            const isMaintenance = room.status === 'Bảo trì';

            return (
              <div
                key={room.id}
                className="group bg-white rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col overflow-hidden"
              >
                {/* Image & Status Badge */}
                <div className="h-52 relative overflow-hidden cursor-pointer" onClick={() => setSelectedRoom(room)}>
                  <img
                    src={room.image}
                    alt={room.name}
                    className="w-full h-full object-cover group-hover:scale-105 duration-500 transition-transform"
                    onError={(e) => { e.currentTarget.src = presetImages[0]; }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent"></div>

                  {/* Badge */}
                  <div className="absolute top-4 right-4 flex gap-2">
                    {room.status === 'Bảo trì' ? (
                      <span className="bg-amber-500 text-white rounded-full px-3 py-1 text-xs font-bold flex items-center gap-1 shadow-md">
                        <AlertTriangle size={14} /> Đang bảo trì
                      </span>
                    ) : room.status === 'Đang họp' ? (
                      <span className="bg-rose-600 text-white rounded-full px-3 py-1 text-xs font-bold flex items-center gap-1.5 shadow-md animate-pulse" title={room.currentMeeting?.title ? `Đang họp: ${room.currentMeeting.title} (${room.currentMeeting.time})` : 'Đang họp'}>
                        <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                        Đang họp
                      </span>
                    ) : (
                      <span className="bg-emerald-500 text-white rounded-full px-3 py-1 text-xs font-bold flex items-center gap-1 shadow-md">
                        <Check size={14} /> Sẵn sàng
                      </span>
                    )}
                  </div>

                  <div className="absolute bottom-4 left-4 right-4 text-white">
                    <h3 className="text-xl font-bold text-white group-hover:text-blue-300 transition-colors mb-1">
                      {room.name}
                    </h3>
                    <div className="flex items-center gap-4 text-slate-200 text-sm font-medium">
                      <span className="flex items-center gap-1.5">
                        <MapPin size={16} /> {room.building}{room.floor ? ` - ${room.floor}` : ''}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Users size={16} /> {room.capacity} chỗ
                      </span>
                    </div>
                  </div>
                </div>

                {/* Content */}
                <div className="p-6 flex flex-col flex-1">
                  
                  {/* Equipment Tags */}
                  <div className="flex flex-wrap gap-2 mb-6 min-h-[58px]">
                    {room.equipment.length > 0 ? room.equipment.slice(0, 4).map((item, i) => (
                      <span key={i} className="bg-slate-100 text-slate-700 px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5">
                        <Monitor size={12} className="text-slate-500" />
                        {item}
                      </span>
                    )) : (
                      <span className="text-slate-400 text-xs italic">Trang thiết bị tiêu chuẩn</span>
                    )}
                    {room.equipment.length > 4 && (
                      <span className="bg-slate-100 text-slate-500 px-2 py-1 rounded-lg text-xs font-medium">
                        +{room.equipment.length - 4} khác
                      </span>
                    )}
                  </div>

                  {/* Action Buttons: Xem chi tiết & Đặt phòng này (US #7, #8, #10) */}
                  <div className="mt-auto pt-4 border-t border-slate-100 flex items-center gap-2">
                    <button
                      onClick={() => setSelectedRoom(room)}
                      className="flex-1 py-2 px-3 flex items-center justify-center gap-1.5 rounded-xl font-semibold text-xs text-slate-700 bg-slate-100 hover:bg-slate-200 transition-all"
                      title="Xem toàn bộ thông tin chi tiết phòng và trang thiết bị"
                    >
                      <Eye size={15} />
                      <span>Chi tiết</span>
                    </button>
                    {/* US #21: Kiểm tra Giới hạn quyền đặt phòng theo Role */}
                    {(() => {
                      const userRoleId = userProfile?.role_id || (userProfile?.role === 'LECTURER' ? 2 : userProfile?.role === 'PARTICIPANT' ? 3 : 1);
                      const isRestricted = (room.restrictions || []).some((res: any) => res.role_id === userRoleId && userRoleId !== 1);

                      if (isMaintenance) {
                        return (
                          <span className="flex-1 py-2 px-3 text-center rounded-xl font-medium text-xs text-amber-700 bg-amber-50 border border-amber-200">
                            Đang bảo trì
                          </span>
                        );
                      }

                      if (isRestricted) {
                        return (
                          <span 
                            className="flex-1 py-2 px-2 text-center rounded-xl font-bold text-xs text-rose-700 bg-rose-50 border border-rose-200 cursor-not-allowed"
                            title="Phòng này bị giới hạn quyền theo chính sách nhà trường (US #21)"
                          >
                            🔒 Giới hạn quyền
                          </span>
                        );
                      }

                      return (
                        <button
                          onClick={() => {
                            localStorage.setItem('meetinghub_prefill_room_id', String(room.room_id || room.id));
                            if (onNavigateToTab) onNavigateToTab('overview');
                          }}
                          className="flex-1 py-2 px-3 flex items-center justify-center gap-1.5 rounded-xl font-bold text-xs text-white bg-blue-600 hover:bg-blue-700 transition-all shadow-sm hover:scale-[1.02] active:scale-95"
                          title="Đặt phòng này cho cuộc họp mới (US #8)"
                        >
                          <Calendar size={15} />
                          <span>Đặt phòng này</span>
                        </button>
                      );
                    })()}
                  </div>

                </div>
              </div>
            );
          })}
        </div>
      )}

      {!loading && !apiError && filteredRooms.length === 0 && (
        <div style={{ padding: '60px', textAlign: 'center', backgroundColor: 'white', borderRadius: '24px', border: '1px solid #e2e8f0' }}>
          <Search size={48} color="#cbd5e1" style={{ margin: '0 auto 16px auto' }} />
          <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#0f172a', margin: '0 0 8px 0' }}>Không tìm thấy phòng phù hợp</h3>
          <p style={{ color: '#64748b', margin: 0 }}>Vui lòng thay đổi tiêu chí bộ lọc để xem các kết quả khác.</p>
        </div>
      )}

      {/* Modal Chi tiết Phòng Họp (Chỉ để xem & tìm hiểu tiện ích) */}
      {selectedRoom && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '24px', width: '100%', maxWidth: '640px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>

            {/* Header with image */}
            <div style={{ height: '220px', position: 'relative' }}>
              <img
                src={selectedRoom.image}
                alt={selectedRoom.name}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 60%)' }}></div>
              
              <button
                onClick={() => setSelectedRoom(null)}
                style={{ position: 'absolute', top: '16px', right: '16px', width: '36px', height: '36px', borderRadius: '50%', backgroundColor: 'rgba(0,0,0,0.5)', color: 'white', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <X size={20} />
              </button>

              <div style={{ position: 'absolute', bottom: '16px', left: '20px', right: '20px', color: 'white' }}>
                <span style={{
                  padding: '3px 8px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontWeight: 'bold',
                  backgroundColor: selectedRoom.status === 'Sẵn sàng' ? '#10b981' : selectedRoom.status === 'Đang họp' ? '#e11d48' : '#f59e0b',
                  color: 'white',
                  display: 'inline-block',
                  marginBottom: '6px'
                }}>
                  {selectedRoom.status === 'Sẵn sàng' ? '✓ Sẵn sàng hoạt động' : selectedRoom.status === 'Đang họp' ? `🔴 Đang họp ${selectedRoom.currentMeeting ? `(${selectedRoom.currentMeeting.time})` : ''}` : '⚠ Đang bảo trì'}
                </span>
                <h3 style={{ fontSize: '22px', fontWeight: 'bold', margin: '0 0 4px 0' }}>{selectedRoom.name}</h3>
                <p style={{ margin: 0, fontSize: '13px', opacity: 0.9 }}>{selectedRoom.building} {selectedRoom.floor ? `· ${selectedRoom.floor}` : ''}</p>
              </div>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* Quick Info Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                <div style={{ padding: '12px', borderRadius: '12px', backgroundColor: '#f8fafc', border: '1px solid #f1f5f9', textAlign: 'center' }}>
                  <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase' }}>Sức chứa</div>
                  <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#0f172a', marginTop: '2px' }}>{selectedRoom.capacity} người</div>
                </div>

                <div style={{ padding: '12px', borderRadius: '12px', backgroundColor: '#f8fafc', border: '1px solid #f1f5f9', textAlign: 'center' }}>
                  <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase' }}>Vị trí</div>
                  <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#0f172a', marginTop: '4px' }}>{selectedRoom.building}</div>
                </div>

                <div style={{ padding: '12px', borderRadius: '12px', backgroundColor: '#f8fafc', border: '1px solid #f1f5f9', textAlign: 'center' }}>
                  <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase' }}>Trạng thái</div>
                  <div style={{ fontSize: '14px', fontWeight: 'bold', color: selectedRoom.status === 'Sẵn sàng' ? '#16a34a' : selectedRoom.status === 'Đang họp' ? '#e11d48' : '#d97706', marginTop: '4px' }}>
                    {selectedRoom.status === 'Đang họp' && selectedRoom.currentMeeting ? `Đang họp (${selectedRoom.currentMeeting.title})` : selectedRoom.status}
                  </div>
                </div>
              </div>

              {/* Mô tả phòng */}
              <div>
                <h4 style={{ fontSize: '14px', fontWeight: 'bold', color: '#0f172a', margin: '0 0 8px 0' }}>Mô tả không gian</h4>
                <p style={{ margin: 0, fontSize: '14px', color: '#475569', lineHeight: 1.6 }}>
                  {selectedRoom.description}
                </p>
              </div>

              {/* Trang thiết bị sẵn có */}
              <div>
                <h4 style={{ fontSize: '14px', fontWeight: 'bold', color: '#0f172a', margin: '0 0 10px 0' }}>
                  Trang thiết bị sẵn có trong phòng ({selectedRoom.equipment.length}):
                </h4>
                {selectedRoom.equipment.length > 0 ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '8px' }}>
                    {selectedRoom.equipment.map((eq, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', borderRadius: '8px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', fontSize: '13px', color: '#334155' }}>
                        <CheckCircle2 size={16} color="#16a34a" />
                        <span>{eq}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: '13px', color: '#94a3b8', fontStyle: 'italic' }}>
                    Phòng họp cơ bản, có thể yêu cầu mượn thêm thiết bị khi đặt lịch trên Calendar.
                  </div>
                )}
              </div>

            </div>

            {/* Modal Footer */}
            <div style={{ padding: '16px 24px', borderTop: '1px solid #e2e8f0', backgroundColor: '#f8fafc', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                type="button"
                onClick={() => setSelectedRoom(null)}
                style={{ padding: '10px 20px', borderRadius: '10px', border: '1px solid #cbd5e1', backgroundColor: 'white', color: '#475569', fontWeight: '600', fontSize: '14px', cursor: 'pointer' }}
              >
                Đóng
              </button>
              {selectedRoom.status === 'Sẵn sàng' ? (
                <button
                  type="button"
                  onClick={() => {
                    localStorage.setItem('meetinghub_prefill_room_id', String(selectedRoom.room_id || selectedRoom.id));
                    setSelectedRoom(null);
                    handleGoToCalendar();
                  }}
                  style={{ padding: '10px 24px', borderRadius: '10px', border: 'none', backgroundColor: '#2563eb', color: 'white', fontWeight: 'bold', fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                  className="hover:bg-blue-700 shadow-md transition-colors"
                >
                  <Calendar size={18} />
                  <span>Đặt phòng này ngay (Calendar)</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedRoom(null);
                    handleGoToCalendar();
                  }}
                  style={{ padding: '10px 20px', borderRadius: '10px', border: 'none', backgroundColor: '#64748b', color: 'white', fontWeight: '600', fontSize: '14px', cursor: 'pointer' }}
                >
                  Đi tới Lịch họp
                </button>
              )}
            </div>

          </div>
        </div>
      )}

    </div>
  );
}