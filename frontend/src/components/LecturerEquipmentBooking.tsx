import React, { useState, useEffect } from 'react';
import { Search, Monitor, Mic, Calendar, Clock, MapPin, X, Box, CheckCircle, Laptop, Speaker, Camera } from 'lucide-react';
import api from '../services/api';

interface Equipment {
  id: string;
  code: string;
  name: string;
  category: string;
  location: string;
  type: string;
  status: 'Sẵn sàng' | 'Bảo dưỡng' | 'Hỏng hóc';
}

export default function LecturerEquipmentBooking({ userProfile }: { userProfile: any }) {
  const [equipments, setEquipments] = useState<Equipment[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('Tất cả');
  const [selectedEq, setSelectedEq] = useState<Equipment | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [returnDate, setReturnDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [timeSlot, setTimeSlot] = useState('07:00');
  const [returnTimeSlot, setReturnTimeSlot] = useState('09:15');
  const [roomLocation, setRoomLocation] = useState('');
  const [purpose, setPurpose] = useState('');

  useEffect(() => { loadEquipment(); }, []);

  const loadEquipment = async () => {
    try {
      const res = await api.get('/equipments');
      if (res.data && res.data.length > 0) {
        const mapped: Equipment[] = res.data.map((e: any) => {
          let statusStr: 'Sẵn sàng' | 'Bảo dưỡng' | 'Hỏng hóc' = 'Sẵn sàng';
          if (e.status === 'MAINTENANCE') statusStr = 'Bảo dưỡng';
          else if (e.status === 'BROKEN') statusStr = 'Hỏng hóc';

          const typeMap: Record<string, string> = {
            PROJECTOR: 'Projector', LAPTOP: 'Laptop', MICROPHONE: 'Microphone',
            SPEAKER: 'Speaker', CAMERA: 'Camera', SMARTBOARD: 'Board'
          };
          const category = typeMap[e.equipment_type?.toUpperCase()] || e.equipment_type || 'Other';
          return {
            id: e.equipment_id.toString(),
            code: e.serial_number || e.code || `EQ-${e.equipment_id}`,
            name: e.equipment_name,
            category,
            location: e.room_name || 'Thiết bị di động',
            type: e.room_id ? 'Cố định' : 'Di động',
            status: statusStr,
          };
        });
        setEquipments(mapped);
      }
    } catch (err) {
      console.error('Lỗi tải thiết bị:', err);
    }
  };

  const filteredEquipments = equipments.filter(eq => {
    if (filterCategory === 'Thiết bị di động' && eq.type !== 'Di động') return false;
    if (filterCategory === 'Máy chiếu & Laptop' && !['Projector', 'Laptop'].includes(eq.category)) return false;
    if (filterCategory === 'Âm thanh & Camera' && !['Microphone', 'Speaker', 'Camera'].includes(eq.category)) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!eq.name.toLowerCase().includes(q) && !eq.code.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'Projector': return <Monitor size={28} />;
      case 'Laptop': return <Laptop size={28} />;
      case 'Microphone': return <Mic size={28} />;
      case 'Speaker': return <Speaker size={28} />;
      case 'Camera': return <Camera size={28} />;
      default: return <Box size={28} />;
    }
  };

  const openModal = (eq: Equipment) => {
    setSelectedEq(eq);
    setIsModalOpen(true);
    const today = new Date().toISOString().split('T')[0];
    setDate(today);
    setReturnDate(today);
    setTimeSlot('07:00');
    setReturnTimeSlot('09:15');
    setRoomLocation('');
    setPurpose('');
  };

  const submitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEq || !roomLocation.trim()) {
      alert('Vui lòng điền phòng/lớp sử dụng thiết bị!');
      return;
    }
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      const start_time = `${date}T${timeSlot}:00`;
      const end_time = `${returnDate}T${returnTimeSlot}:00`;

      await api.post('/equipment-requests', {
        equipment_id: parseInt(selectedEq.id),
        quantity: 1,
        start_time,
        end_time,
        use_location: roomLocation.trim(),
        reason: purpose.trim() || undefined,
      });

      alert('✓ Đã gửi yêu cầu mượn thiết bị thành công! Vui lòng chờ Admin phê duyệt.');
      setIsModalOpen(false);
      window.dispatchEvent(new Event('request-updated'));
    } catch (error: any) {
      const msg = error.response?.data?.detail || error.message;
      alert(`Lỗi khi gửi yêu cầu: ${msg}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Sẵn sàng':
        return <span className="inline-flex items-center gap-2 text-sm font-medium text-slate-700"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>Sẵn sàng</span>;
      case 'Bảo dưỡng':
        return <span className="inline-flex items-center gap-2 text-sm font-medium text-slate-700"><span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>Bảo dưỡng</span>;
      case 'Hỏng hóc':
        return <span className="inline-flex items-center gap-2 text-sm font-medium text-slate-500"><span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>Hỏng hóc</span>;
      default:
        return <span className="inline-flex items-center gap-2 text-sm font-medium text-slate-500"><span className="w-2.5 h-2.5 rounded-full bg-slate-400"></span>{status}</span>;
    }
  };

  return (
    <div className="flex flex-col gap-8 pb-12 font-sans antialiased">
      <div>
        <h2 className="text-3xl font-extrabold text-slate-800 tracking-tight mb-2">Đăng ký mượn thiết bị</h2>
        <p className="text-slate-500 text-base font-medium">Tra cứu thiết bị thực tế từ hệ thống và đăng ký mượn.</p>
      </div>

      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-wrap justify-between gap-6 items-center">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {['Tất cả', 'Thiết bị di động', 'Máy chiếu & Laptop', 'Âm thanh & Camera'].map(tab => (
            <button key={tab} onClick={() => setFilterCategory(tab)}
              className={`px-5 py-2.5 rounded-full text-sm font-semibold whitespace-nowrap transition-all ${filterCategory === tab ? 'bg-slate-800 text-white shadow-md' : 'bg-slate-50 text-slate-500 hover:bg-slate-200 hover:text-slate-700'}`}>
              {tab}
            </button>
          ))}
        </div>
        <div className="relative w-full md:w-[320px] group">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-hover:text-blue-500 transition-colors" />
          <input type="text" placeholder="Tìm tên hoặc mã Serial..."
            value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full py-3 pl-11 pr-4 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 bg-slate-50 outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
        {filteredEquipments.map(eq => (
          <div key={eq.id} className="bg-white rounded-2xl border border-slate-200/80 shadow-sm flex flex-col hover:shadow-md hover:border-slate-300 transition-all duration-200">
            <div className="p-7 flex-1 flex flex-col gap-6">
              <div className="flex justify-between items-start">
                <div className="flex gap-5 items-center">
                  <div className="w-14 h-14 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-600 shrink-0">
                    {getCategoryIcon(eq.category)}
                  </div>
                  <div>
                    <span className="font-mono text-sm font-medium text-slate-500">{eq.code}</span>
                    <h3 className="text-lg font-bold text-slate-900 mt-0.5">{eq.name}</h3>
                  </div>
                </div>
              </div>
              <div className="mt-auto flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-500 font-normal flex items-center gap-1.5"><MapPin size={16} /> {eq.location}</span>
                  <span className="bg-slate-100 text-slate-600 text-sm font-medium px-3 py-1 rounded-md">{eq.type}</span>
                </div>
                <div className="flex items-center justify-between mt-2 pt-4 border-t border-dashed border-slate-200">
                  <span className="text-sm font-semibold text-slate-400">Trạng thái:</span>
                  {getStatusBadge(eq.status)}
                </div>
              </div>
            </div>
            <div className="px-7 pb-7 mt-auto">
              <button onClick={() => openModal(eq)} disabled={eq.status !== 'Sẵn sàng'}
                className={`w-full py-3.5 rounded-xl text-sm font-bold tracking-wide transition-all flex justify-center items-center gap-2 ${eq.status === 'Sẵn sàng' ? 'bg-slate-900 hover:bg-slate-800 text-white shadow-sm cursor-pointer' : 'bg-slate-100 text-slate-400 border border-slate-200/60 cursor-not-allowed'}`}>
                {eq.status === 'Sẵn sàng' ? 'Đăng ký mượn' : 'Không khả dụng'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {filteredEquipments.length === 0 && (
        <div className="p-16 text-center bg-white rounded-3xl border border-slate-200 flex flex-col items-center justify-center gap-4">
          <Search size={48} className="text-slate-300" />
          <div>
            <h3 className="text-lg font-bold text-slate-800 mb-1">Không tìm thấy thiết bị</h3>
            <p className="text-slate-500 text-sm">Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm.</p>
          </div>
        </div>
      )}

      {/* Booking Modal */}
      {isModalOpen && selectedEq && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '24px', width: '100%', maxWidth: '600px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc' }}>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#0f172a', margin: '0 0 4px 0' }}>Yêu cầu mượn thiết bị</h3>
                <p style={{ color: '#64748b', margin: 0, fontSize: '13px' }}>Điền thông tin để đăng ký mượn thiết bị</p>
              </div>
              <button type="button" onClick={() => setIsModalOpen(false)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '8px', borderRadius: '50%' }} className="hover:bg-slate-200">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={submitRequest} style={{ padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', gap: '16px', alignItems: 'center', backgroundColor: '#eff6ff', padding: '16px', borderRadius: '16px', border: '1px solid #bfdbfe' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: 'white', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #dbeafe', flexShrink: 0 }}>
                  {getCategoryIcon(selectedEq.category)}
                </div>
                <div>
                  <div style={{ fontSize: '15px', fontWeight: 'bold', color: '#1e3a8a', marginBottom: '2px' }}>{selectedEq.name}</div>
                  <div style={{ fontSize: '13px', color: '#3b82f6' }}>Serial: {selectedEq.code} • Loại: {selectedEq.type}</div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#334155', marginBottom: '8px' }}>Ngày mượn <span style={{ color: '#ef4444' }}>*</span></label>
                  <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                    style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #cbd5e1', fontSize: '15px', outline: 'none' }}
                    className="focus:border-blue-500" required />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#334155', marginBottom: '8px' }}>Giờ mượn <span style={{ color: '#ef4444' }}>*</span></label>
                  <input type="time" value={timeSlot} onChange={(e) => setTimeSlot(e.target.value)}
                    style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #cbd5e1', fontSize: '15px', outline: 'none' }}
                    className="focus:border-blue-500" required />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#334155', marginBottom: '8px' }}>Ngày trả dự kiến <span style={{ color: '#ef4444' }}>*</span></label>
                  <input type="date" value={returnDate} onChange={(e) => setReturnDate(e.target.value)} min={date}
                    style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #cbd5e1', fontSize: '15px', outline: 'none' }}
                    className="focus:border-blue-500" required />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#334155', marginBottom: '8px' }}>Giờ trả <span style={{ color: '#ef4444' }}>*</span></label>
                  <input type="time" value={returnTimeSlot} onChange={(e) => setReturnTimeSlot(e.target.value)}
                    style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #cbd5e1', fontSize: '15px', outline: 'none' }}
                    className="focus:border-blue-500" required />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#334155', marginBottom: '8px' }}>Phòng / Lớp sử dụng <span style={{ color: '#ef4444' }}>*</span></label>
                <input type="text" value={roomLocation} onChange={(e) => setRoomLocation(e.target.value)}
                  placeholder="VD: Phòng B201, Giảng đường C4..."
                  style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #cbd5e1', fontSize: '15px', outline: 'none' }}
                  className="focus:border-blue-500" required />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#334155', marginBottom: '8px' }}>Mục đích sử dụng / Ghi chú</label>
                <textarea value={purpose} onChange={(e) => setPurpose(e.target.value)}
                  placeholder="VD: Cần dùng cho buổi bảo vệ đồ án..."
                  style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid #cbd5e1', fontSize: '15px', outline: 'none', minHeight: '80px', resize: 'vertical' }}
                  className="focus:border-blue-500" />
              </div>

              <div style={{ display: 'flex', gap: '16px', marginTop: '8px' }}>
                <button type="button" onClick={() => setIsModalOpen(false)}
                  style={{ flex: 1, padding: '14px', borderRadius: '12px', border: '1px solid #cbd5e1', backgroundColor: 'white', color: '#475569', fontWeight: 'bold', fontSize: '15px', cursor: 'pointer' }}
                  className="hover:bg-slate-50 transition-colors">Hủy thao tác</button>
                <button type="submit" disabled={isSubmitting}
                  style={{ flex: 1, padding: '14px', borderRadius: '12px', border: 'none', backgroundColor: isSubmitting ? '#93c5fd' : '#2563eb', color: 'white', fontWeight: 'bold', fontSize: '15px', cursor: isSubmitting ? 'not-allowed' : 'pointer', boxShadow: '0 4px 6px rgba(37, 99, 235, 0.2)' }}
                  className="hover:bg-blue-700 transition-colors">
                  {isSubmitting ? 'Đang gửi...' : 'Gửi yêu cầu mượn'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}