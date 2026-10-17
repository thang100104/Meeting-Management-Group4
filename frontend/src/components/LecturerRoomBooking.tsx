import React, { useState, useEffect } from 'react';
import { Search, MapPin, Users, Calendar, Clock, X, Check, Monitor, AlertTriangle } from 'lucide-react';
import { getStorage, setStorage } from '../utils/syncHelper';

import api from '../services/api';

interface Room {
  id: string;
  name: string;
  building: string;
  floor: string;
  capacity: number;
  type: string;
  status: string;      // 'Sẵn sàng' | 'Bảo trì'
  image: string;
  equipment: string[];
}

// Ảnh fallback theo index để mỗi phòng có hình khác nhau nếu DB chưa có image_url
const presetImages = [
  'https://images.unsplash.com/photo-1505373877841-8d25f7d46678?auto=format&fit=crop&q=80&w=600',
  'https://images.unsplash.com/photo-1571624436279-b272aff752b5?auto=format&fit=crop&q=80&w=600',
  'https://images.unsplash.com/photo-1542744173-8e7e53415bb0?auto=format&fit=crop&q=80&w=600',
  'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&q=80&w=600',
  'https://images.unsplash.com/photo-1516321497487-e288fb19713f?auto=format&fit=crop&q=80&w=600',
  'https://images.unsplash.com/photo-1524178232363-1fb2b075b655?auto=format&fit=crop&q=80&w=600',
];

export default function LecturerRoomBooking({ userProfile }: { userProfile: any }) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState(false);

  // ─── Fetch danh sách phòng từ API (đồng bộ với Admin) ───────────────────────
  useEffect(() => {
    const fetchRooms = async () => {
      try {
        const res = await api.get('/rooms');
        if (res.data && res.data.length > 0) {
          const mappedRooms: Room[] = res.data.map((r: any, index: number) => {
            // Parse location: "Tầng X Tòa Y" hoặc "Tầng X, Tòa Y"
            const loc: string = r.location || '';
            let floor = '';
            let building = loc;

            const commaParts = loc.split(',').map((s: string) => s.trim());
            if (commaParts.length >= 2) {
              // "Tầng 1, Tòa C1" => floor=Tầng 1, building=Tòa C1
              floor = commaParts[0];
              building = commaParts.slice(1).join(', ');
            } else {
              // "Tầng 1 Tòa C1" (không có dấu phẩy)
              const spaceMatch = loc.match(/^(T[ầẩ]ng\s+\S+)\s+(.+)$/i);
              if (spaceMatch) {
                floor = spaceMatch[1];
                building = spaceMatch[2];
              }
            }

            // Map trạng thái API sang tiếng Việt
            const mappedStatus = (r.status === 'MAINTENANCE' || r.status === 'Đang bảo trì')
              ? 'Bảo trì'
              : 'Sẵn sàng';

            // Parse danh sách thiết bị: ưu tiên equipments, sau đó description
            let eqList: string[] = [];
            if (r.equipments && r.equipments.trim()) {
              eqList = r.equipments.split(',').map((s: string) => s.trim()).filter(Boolean);
            } else if (r.description && r.description.trim()) {
              eqList = r.description.split(',').map((s: string) => s.trim()).filter(Boolean);
            }

            // Ảnh: ưu tiên image_url từ DB, fallback theo index vòng tròn
            const img = (r.image_url && r.image_url.trim())
              ? r.image_url
              : presetImages[index % presetImages.length];

            return {
              id: r.room_id ? r.room_id.toString() : (r.id || String(index + 1)),
              name: r.room_name || r.name || 'Phòng không tên',
              building: building || 'Không xác định',
              floor: floor,
              capacity: r.capacity || 0,
              type: 'Phòng họp',
              status: mappedStatus,
              image: img,
              equipment: eqList,
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

    const handleSync = () => {
      fetchRooms();
    };

    window.addEventListener('appDataSync', handleSync);
    window.addEventListener('roomsUpdated', handleSync);
    window.addEventListener('storage', handleSync);

    // Polling định kỳ mỗi 15 giây để đảm bảo dữ liệu luôn đồng bộ thời gian thực
    const pollInterval = setInterval(fetchRooms, 15000);

    return () => {
      window.removeEventListener('appDataSync', handleSync);
      window.removeEventListener('roomsUpdated', handleSync);
      window.removeEventListener('storage', handleSync);
      clearInterval(pollInterval);
    };
  }, []);

  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [timeSlot, setTimeSlot] = useState('08:00 - 10:00');
  const [building, setBuilding] = useState('Tất cả');
  const [capacityFilter, setCapacityFilter] = useState('all');

  const [bookedRoomIds, setBookedRoomIds] = useState<string[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // ─── Lấy lịch họp để kiểm tra phòng nào đã bị đặt ──────────────────────────
  useEffect(() => {
    const fetchMeetings = async () => {
      try {
        const res = await api.get('/meetings', {
          params: { from_date: date, to_date: date }
        });
        if (res.data) {
          const times = timeSlot.split(' - ');
          const selectedStart = new Date(`${date}T${times[0]}:00`).getTime();
          const selectedEnd = new Date(`${date}T${times[1]}:00`).getTime();

          const bookedIds: string[] = [];
          res.data.forEach((meeting: any) => {
            if (meeting.status !== 'CANCELLED' && meeting.status !== 'COMPLETED') {
              const mStart = new Date(meeting.start_time).getTime();
              const mEnd = new Date(meeting.end_time).getTime();

              if (mStart < selectedEnd && mEnd > selectedStart) {
                bookedIds.push(meeting.room_id.toString());
              }
            }
          });
          setBookedRoomIds(bookedIds);
        }
      } catch (err) {
        console.error("Lỗi lấy lịch họp", err);
      }
    };
    fetchMeetings();
  }, [date, timeSlot]);

  // Booking form state
  const [title, setTitle] = useState('');
  const [type, setType] = useState('Họp bộ môn');
  const [attendees, setAttendees] = useState('');
  const [notes, setNotes] = useState('');

  // Lấy danh sách tòa nhà tự động từ dữ liệu API
  const buildings = ['Tất cả', ...Array.from(new Set(rooms.map(r => r.building)))];

  const filteredRooms = rooms.filter(room => {
    if (building !== 'Tất cả' && room.building !== building) return false;
    if (capacityFilter === '30' && room.capacity <= 30) return false;
    if (capacityFilter === '50' && room.capacity <= 50) return false;
    if (capacityFilter === '100' && room.capacity <= 100) return false;
    return true;
  });

  const openBookingModal = (room: Room) => {
    setSelectedRoom(room);
    setIsModalOpen(true);
    setTitle('');
    setType('Họp bộ môn');
    setAttendees(room.capacity.toString());
    setNotes('');
  };

  const submitBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRoom || !title.trim()) {
      alert('Vui lòng điền đầy đủ tên cuộc họp/môn học!');
      return;
    }

    try {
      const times = timeSlot.split(' - ');
      const start_time = `${date}T${times[0]}:00`;
      const end_time = `${date}T${times[1]}:00`;

      const newBookingAPI = {
        room_id: parseInt(selectedRoom.id) || 1,
        title,
        description: notes || '',
        start_time,
        end_time,
        meeting_type: type
      };

      await api.post('/meetings', newBookingAPI);

      const currentUserStr = localStorage.getItem('user') || sessionStorage.getItem('user') || '{}';
      let currentUser: any = {};
      try { currentUser = JSON.parse(currentUserStr); } catch (e) { }

      // Lưu LocalStorage để sync Badge bên Sidebar
      const mockBooking = {
        id: Date.now().toString(),
        roomId: selectedRoom.id,
        roomName: selectedRoom.name,
        userId: currentUser.id || currentUser.email || userProfile?.email,
        userName: currentUser.name || currentUser.fullName || userProfile?.fullName || 'Giảng viên',
        userAvatar: currentUser.avatar || currentUser.avatarUrl || userProfile?.avatar || userProfile?.avatarUrl || '',
        userRole: currentUser.role || userProfile?.role || 'Giảng viên',
        userEmail: currentUser.email || userProfile?.email,
        lecturerName: currentUser.name || currentUser.fullName || userProfile?.fullName || 'Giảng viên',
        lecturerEmail: currentUser.email || userProfile?.email,
        date,
        timeSlot,
        purpose: title,
        participants: parseInt(attendees) || 0,
        status: 'Chờ duyệt',
        createdAt: new Date().toISOString()
      };

      const savedRequests = localStorage.getItem('meetinghub_room_requests');
      let currentRequests = savedRequests ? JSON.parse(savedRequests) : [];

      currentRequests = currentRequests.map((req: any) => {
        if (req.lecturerEmail === mockBooking.userEmail || req.lecturerName === mockBooking.userName) {
          return { ...req, userAvatar: mockBooking.userAvatar, userName: mockBooking.userName, lecturerName: mockBooking.userName };
        }
        return req;
      });

      currentRequests.unshift(mockBooking);
      localStorage.setItem('meetinghub_room_requests', JSON.stringify(currentRequests));

      window.dispatchEvent(new Event('request-updated'));
      window.dispatchEvent(new Event('storage'));

      alert('Gửi yêu cầu đặt phòng thành công! Vui lòng chờ Admin phê duyệt.');
      setIsModalOpen(false);
    } catch (error: any) {
      console.error('Lỗi khi đặt phòng:', error);
      const backendError = error.response?.data?.detail || error.message;
      alert(`Đã xảy ra lỗi khi gửi yêu cầu: ${backendError}`);
    }
  };

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-8 pb-12 font-sans antialiased">

      {/* Header */}
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-extrabold text-slate-800 tracking-tight mb-2">Đăng ký phòng họp &amp; Giảng đường</h2>
          <p className="text-slate-500 text-base font-medium">Tra cứu và đặt lịch sử dụng các không gian trong trường.</p>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm flex flex-wrap gap-6 items-end">

        <div className="flex flex-col gap-2 flex-1 min-w-[180px]">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Ngày sử dụng</label>
          <div className="relative group">
            <Calendar size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-hover:text-blue-500 transition-colors" />
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full py-3 pl-11 pr-4 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 bg-slate-50 outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all cursor-pointer"
            />
          </div>
        </div>

        <div className="flex flex-col gap-2 flex-1 min-w-[180px]">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Khung giờ / Ca</label>
          <div className="relative group">
            <Clock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-hover:text-blue-500 transition-colors" />
            <select
              value={timeSlot}
              onChange={(e) => setTimeSlot(e.target.value)}
              className="w-full py-3 pl-11 pr-4 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 bg-slate-50 outline-none appearance-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all cursor-pointer"
            >
              <option value="08:00 - 10:00">Ca 1: 08:00 - 10:00</option>
              <option value="10:00 - 12:00">Ca 2: 10:00 - 12:00</option>
              <option value="13:00 - 15:00">Ca 3: 13:00 - 15:00</option>
              <option value="15:00 - 17:00">Ca 4: 15:00 - 17:00</option>
              <option value="17:00 - 19:00">Ca 5: 17:00 - 19:00</option>
            </select>
          </div>
        </div>

        <div className="flex flex-col gap-2 flex-1 min-w-[180px]">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tòa nhà</label>
          <div className="relative group">
            <MapPin size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-hover:text-blue-500 transition-colors" />
            <select
              value={building}
              onChange={(e) => setBuilding(e.target.value)}
              className="w-full py-3 pl-11 pr-4 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 bg-slate-50 outline-none appearance-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all cursor-pointer"
            >
              {buildings.map(b => (
                <option key={b} value={b}>{b === 'Tất cả' ? 'Tất cả các tòa' : b}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-col gap-2 flex-1 min-w-[180px]">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Sức chứa</label>
          <div className="relative group">
            <Users size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-hover:text-blue-500 transition-colors" />
            <select
              value={capacityFilter}
              onChange={(e) => setCapacityFilter(e.target.value)}
              className="w-full py-3 pl-11 pr-4 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 bg-slate-50 outline-none appearance-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all cursor-pointer"
            >
              <option value="all">Mọi kích thước</option>
              <option value="30">&gt; 30 chỗ</option>
              <option value="50">&gt; 50 chỗ</option>
              <option value="100">&gt; 100 chỗ</option>
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
            const isBooked = bookedRoomIds.includes(room.id);
            const isAvailable = !isMaintenance && !isBooked;

            return (
              <div key={room.id} className="group bg-white rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-xl hover:-translate-y-1.5 transition-all duration-300 flex flex-col overflow-hidden">
                {/* Image & Status Badge */}
                <div className="h-52 lg:h-56 relative overflow-hidden">
                  <img
                    src={room.image}
                    alt={room.name}
                    className="w-full h-full object-cover group-hover:scale-105 duration-500 transition-transform"
                    onError={(e) => { e.currentTarget.src = presetImages[0]; }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent"></div>

                  <div className="absolute top-4 right-4 flex gap-2">
                    {isAvailable ? (
                      <span className="bg-emerald-500 text-white rounded-full px-3 py-1 text-xs font-bold flex items-center gap-1 shadow-md">
                        <Check size={14} /> Sẵn sàng
                      </span>
                    ) : isMaintenance ? (
                      <span className="bg-orange-500 text-white rounded-full px-3 py-1 text-xs font-bold flex items-center gap-1 shadow-md">
                        <AlertTriangle size={14} /> Bảo trì
                      </span>
                    ) : (
                      <span className="bg-blue-600 text-white rounded-full px-3 py-1 text-xs font-bold flex items-center gap-1 shadow-md">
                        <Clock size={14} /> Đang họp
                      </span>
                    )}
                  </div>

                  <div className="absolute bottom-4 left-4 right-4 text-white">
                    <h3 className="text-xl font-bold text-white group-hover:text-blue-300 transition-colors mb-1">{room.name}</h3>
                    <div className="flex items-center gap-4 text-slate-200 text-sm font-medium">
                      <span className="flex items-center gap-1.5"><MapPin size={16} /> {room.building}{room.floor ? ` - ${room.floor}` : ''}</span>
                      <span className="flex items-center gap-1.5"><Users size={16} /> {room.capacity} chỗ</span>
                    </div>
                  </div>
                </div>

                {/* Content & Action */}
                <div className="p-6 flex flex-col flex-1">

                  <div className="flex flex-wrap gap-2 mb-6">
                    {room.equipment.length > 0 ? room.equipment.map((item, i) => (
                      <span key={i} className="bg-slate-100 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5">
                        <Monitor size={12} className="text-slate-500" />
                        {item}
                      </span>
                    )) : (
                      <span className="text-slate-400 text-xs italic">Chưa có thông tin thiết bị</span>
                    )}
                  </div>

                  <div className="mt-auto">
                    <button
                      onClick={() => openBookingModal(room)}
                      disabled={!isAvailable}
                      className={`w-full py-3.5 flex items-center justify-center gap-2 rounded-xl font-bold text-sm transition-all ${isAvailable
                        ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20 active:scale-95'
                        : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                        }`}
                    >
                      <Calendar size={18} />
                      {isAvailable ? 'Đặt phòng này' : isMaintenance ? 'Đang bảo trì' : 'Đang họp'}
                    </button>
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

      {/* Booking Modal */}
      {isModalOpen && selectedRoom && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '24px', width: '100%', maxWidth: '600px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>

            {/* Modal Header */}
            <div style={{ padding: '24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc' }}>
              <div>
                <h3 style={{ fontSize: '20px', fontWeight: 'bold', color: '#0f172a', margin: '0 0 4px 0' }}>Đăng ký mượn phòng</h3>
                <p style={{ color: '#64748b', margin: 0, fontSize: '14px' }}>{selectedRoom.name} - {selectedRoom.building}</p>
              </div>
              <button type="button" onClick={() => setIsModalOpen(false)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '8px', borderRadius: '50%' }} className="hover:bg-slate-200">
                <X size={24} />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={submitBooking} style={{ padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', padding: '16px', backgroundColor: '#eff6ff', borderRadius: '16px', border: '1px solid #bfdbfe' }}>
                <div>
                  <div style={{ fontSize: '12px', color: '#3b82f6', fontWeight: '600', marginBottom: '4px' }}>NGÀY SỬ DỤNG</div>
                  <div style={{ fontSize: '15px', fontWeight: 'bold', color: '#1e3a8a' }}>{date.split('-').reverse().join('/')}</div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: '#3b82f6', fontWeight: '600', marginBottom: '4px' }}>KHUNG GIỜ</div>
                  <div style={{ fontSize: '15px', fontWeight: 'bold', color: '#1e3a8a' }}>{timeSlot}</div>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#334155', marginBottom: '8px' }}>Tên cuộc họp / Môn giảng dạy <span style={{ color: '#ef4444' }}>*</span></label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="VD: Học phần Trí tuệ nhân tạo..."
                  style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid #cbd5e1', fontSize: '15px', outline: 'none' }}
                  className="focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#334155', marginBottom: '8px' }}>Loại hình</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid #cbd5e1', fontSize: '15px', outline: 'none', appearance: 'none', backgroundColor: 'white' }}
                    className="focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  >
                    <option value="Họp bộ môn">Họp bộ môn</option>
                    <option value="Giảng dạy bổ sung">Giảng dạy bổ sung</option>
                    <option value="Hội thảo khoa học">Hội thảo khoa học</option>
                    <option value="Sinh hoạt lớp/CLB">Sinh hoạt lớp/CLB</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#334155', marginBottom: '8px' }}>Số lượng dự kiến</label>
                  <input
                    type="number"
                    value={attendees}
                    onChange={(e) => setAttendees(e.target.value)}
                    max={selectedRoom.capacity}
                    style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid #cbd5e1', fontSize: '15px', outline: 'none' }}
                    className="focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#334155', marginBottom: '8px' }}>Yêu cầu bổ sung (Không bắt buộc)</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="VD: Cần chuẩn bị 2 micro không dây, bật điều hòa trước 15 phút..."
                  style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid #cbd5e1', fontSize: '15px', outline: 'none', minHeight: '100px', resize: 'vertical' }}
                  className="focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                ></textarea>
              </div>

              {/* Modal Footer */}
              <div style={{ display: 'flex', gap: '16px', marginTop: '8px' }}>
                <button type="button" onClick={() => setIsModalOpen(false)} style={{ flex: 1, padding: '14px', borderRadius: '12px', border: '1px solid #cbd5e1', backgroundColor: 'white', color: '#475569', fontWeight: 'bold', fontSize: '15px', cursor: 'pointer' }} className="hover:bg-slate-50 transition-colors">
                  Hủy thao tác
                </button>
                <button type="submit" style={{ flex: 1, padding: '14px', borderRadius: '12px', border: 'none', backgroundColor: '#2563eb', color: 'white', fontWeight: 'bold', fontSize: '15px', cursor: 'pointer', boxShadow: '0 4px 6px rgba(37, 99, 235, 0.2)' }} className="hover:bg-blue-700 transition-colors">
                  Gửi yêu cầu đặt phòng
                </button>
              </div>
            </form>

          </div>
        </div>
      )}
    </div>
  );
}