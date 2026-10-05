import React, { useState, useEffect } from 'react';
import { Search, Eye, Trash2, Calendar, Clock, MapPin, X, CheckCircle, XCircle, AlertCircle, FileText, Info } from 'lucide-react';
// Legacy syncHelper imports removed – data now fetched directly from API
import api from '../services/api';

interface RoomRequest {
  id: string;
  lecturerName: string;
  lecturerEmail: string;
  roomName: string;
  roomId?: string;
  title: string;
  type: string;
  date: string;
  timeSlot: string;
  attendees: number;
  notes: string;
  status: 'Chờ duyệt' | 'Đã duyệt' | 'Từ chối' | 'Đã hủy';
  rejectReason?: string;
  createdAt: string;
}

export default function LecturerMyRequests({ userProfile }: { userProfile: any }) {
  const [requests, setRequests] = useState<RoomRequest[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('Tất cả');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRequest, setSelectedRequest] = useState<RoomRequest | null>(null);

  useEffect(() => {
    loadRequests();
  }, [userProfile]);

  // useDataSync removed – component now relies solely on API data
  const loadRequests = async () => {
    try {
      const response = await api.get('/meetings');
      const allMeetings = response.data || [];
      const apiRequests: RoomRequest[] = allMeetings
        .filter((m: any) => m.organizer_id === userProfile?.id || m.organizer?.email === userProfile?.email)
        .map((m: any) => {
          let statusStr = 'Chờ duyệt';
          if (['CONFIRMED', 'SCHEDULED', 'APPROVED'].includes(m.status)) statusStr = 'Đã duyệt';
          else if (m.status === 'CANCELLED') statusStr = 'Đã hủy';
          else if (m.status === 'REJECTED') statusStr = 'Từ chối';

          const startDate = new Date(m.start_time);
          const endDate = new Date(m.end_time);
          const timeSlotStr = `${startDate.getHours().toString().padStart(2, '0')}:${startDate.getMinutes().toString().padStart(2, '0')} - ${endDate.getHours().toString().padStart(2, '0')}:${endDate.getMinutes().toString().padStart(2, '0')}`;

          return {
            id: 'REQ_' + m.meeting_id,
            lecturerName: m.organizer?.full_name || userProfile?.fullName,
            lecturerEmail: m.organizer?.email || userProfile?.email,
            roomName: m.room?.room_name || 'Phòng ' + m.room_id,
            roomId: m.room_id?.toString() ?? '',
            title: m.title,
            type: m.meeting_type || 'Họp',
            date: startDate.toISOString().split('T')[0],
            timeSlot: timeSlotStr,
            attendees: m.participants?.length || 0,
            notes: m.description || '',
            status: statusStr as any,
            rejectReason: '',
            createdAt: m.created_at || new Date().toISOString(),
          };
        });

      apiRequests.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setRequests(apiRequests);
    } catch (error) {
      console.error('Error fetching requests from API', error);
    }
  };


  const handleCancelRequest = async (reqId: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn hủy yêu cầu đặt phòng này?')) return;
    const strId = reqId.replace('REQ_', '');
    try {
      await api.patch(`/meetings/${strId}/status`, { status: 'CANCELLED' });
    } catch (err) {
      console.warn('Lỗi API Hủy đơn', err);
    }
    // Reload requests from API to reflect cancellation
    await loadRequests();
    alert('Đã hủy yêu cầu thành công!');
  };

  // Stats
  const totalReq = requests.length;
  const pendingReq = requests.filter(r => r.status === 'Chờ duyệt').length;
  const approvedReq = requests.filter(r => r.status === 'Đã duyệt').length;
  const rejectedReq = requests.filter(r => r.status === 'Từ chối').length;

  // Filters
  const filteredRequests = requests.filter(req => {
    if (filterStatus !== 'Tất cả' && req.status !== filterStatus) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!req.roomName.toLowerCase().includes(q) &&
        !req.title.toLowerCase().includes(q) &&
        !req.id.toLowerCase().includes(q)) {
        return false;
      }
    }
    return true;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Chờ duyệt':
      case 'Đã duyệt':
      case 'Từ chối':
      case 'Đã hủy':
        return <span className="text-sm font-medium text-slate-700">{status}</span>;
      default:
        return <span className="text-sm font-medium text-slate-700">{status}</span>;
    }
  };

  return (
    <div className="flex flex-col gap-8 pb-12 font-sans antialiased">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-extrabold text-slate-800 tracking-tight mb-2">Yêu cầu đặt phòng của tôi</h2>
        <p className="text-slate-500 text-base font-medium">Theo dõi trạng thái và quản lý các đơn đặt phòng bạn đã gửi.</p>
      </div>

      {/* Filter & Search */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-wrap justify-between gap-6 items-center">

        {/* Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {['Tất cả', 'Chờ duyệt', 'Đã duyệt', 'Từ chối', 'Đã hủy'].map(tab => (
            <button
              key={tab}
              onClick={() => setFilterStatus(tab)}
              className={`px-5 py-2.5 rounded-full text-sm font-semibold whitespace-nowrap transition-all ${filterStatus === tab
                ? 'bg-slate-800 text-white shadow-md'
                : 'bg-slate-50 text-slate-500 hover:bg-slate-200 hover:text-slate-700'
                }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full md:w-[320px] group">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-hover:text-blue-500 transition-colors" />
          <input
            type="text"
            placeholder="Tìm theo mã đơn, phòng, sự kiện..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full py-3 pl-11 pr-4 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 bg-slate-50 outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all"
          />
        </div>
      </div>

      {/* Requests List */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200/80">
              <th className="px-6 py-5 text-sm font-bold text-slate-500 uppercase tracking-wider">Mã đơn</th>
              <th className="px-6 py-5 text-sm font-bold text-slate-500 uppercase tracking-wider">Sự kiện / Cuộc họp</th>
              <th className="px-6 py-5 text-sm font-bold text-slate-500 uppercase tracking-wider">Phòng / Thời gian</th>
              <th className="px-6 py-5 text-sm font-bold text-slate-500 uppercase tracking-wider">Ngày gửi</th>
              <th className="px-6 py-5 text-sm font-bold text-slate-500 uppercase tracking-wider">Trạng thái</th>
              <th className="px-6 py-5 text-sm font-bold text-slate-500 uppercase tracking-wider text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {filteredRequests.map((req) => (
              <tr key={req.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                <td className="px-6 py-5 text-base font-bold text-blue-600">#{req.id.split('_')[1] || req.id}</td>
                <td className="px-6 py-5">
                  <div className="text-base font-bold text-slate-800 mb-1">{req.title}</div>
                  <div className="text-sm text-slate-500 font-medium">{req.type}</div>
                </td>
                <td className="px-6 py-5">
                  <div className="text-base font-bold text-slate-800 mb-1 flex items-center gap-2"><MapPin size={16} className="text-slate-400" /> {req.roomName}</div>
                  <div className="text-sm text-slate-500 font-medium flex items-center gap-2"><Calendar size={16} className="text-slate-400" /> {req.date.split('-').reverse().join('/')} • {req.timeSlot.split(' ')[0]}</div>
                </td>
                <td className="px-6 py-5 text-base font-medium text-slate-600">
                  {new Date(req.createdAt).toLocaleDateString('vi-VN')}
                </td>
                <td className="px-6 py-5">
                  {getStatusBadge(req.status)}
                </td>
                <td className="px-6 py-5 text-right">
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setSelectedRequest(req)}
                      className="p-2.5 bg-slate-100 text-blue-600 rounded-xl hover:bg-blue-100 transition-colors"
                      title="Xem chi tiết"
                    >
                      <Eye size={18} />
                    </button>
                    {req.status === 'Chờ duyệt' && (
                      <button
                        onClick={() => handleCancelRequest(req.id)}
                        className="p-2.5 bg-red-50 text-red-500 rounded-xl hover:bg-red-100 transition-colors"
                        title="Hủy đơn"
                      >
                        <Trash2 size={18} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}

            {filteredRequests.length === 0 && (
              <tr>
                <td colSpan={6} className="p-16 text-center">
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center">
                      <FileText size={32} className="text-slate-400" />
                    </div>
                    <div className="text-lg font-semibold text-slate-600">Không tìm thấy yêu cầu nào phù hợp.</div>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Detail Modal */}
      {selectedRequest && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '24px', width: '100%', maxWidth: '600px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>

            {/* Modal Header */}
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc' }}>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#0f172a', margin: '0 0 4px 0' }}>Chi tiết đơn đặt phòng</h3>
                <p style={{ color: '#64748b', margin: 0, fontSize: '13px' }}>Mã đơn: #{selectedRequest.id.split('_')[1] || selectedRequest.id}</p>
              </div>
              <button onClick={() => setSelectedRequest(null)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '8px', borderRadius: '50%' }} className="hover:bg-slate-200">
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>

              {/* Header Info */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#0f172a', marginBottom: '4px' }}>{selectedRequest.title}</div>
                  <div style={{ fontSize: '14px', color: '#64748b' }}>{selectedRequest.type}</div>
                </div>
                <div>{getStatusBadge(selectedRequest.status)}</div>
              </div>

              {/* Reject Reason Block */}
              {selectedRequest.status === 'Từ chối' && selectedRequest.rejectReason && (
                <div style={{ backgroundColor: '#fef2f2', padding: '16px', borderRadius: '12px', border: '1px solid #fecaca', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  <AlertCircle size={20} color="#dc2626" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#991b1b', marginBottom: '4px' }}>Lý do từ chối:</div>
                    <div style={{ fontSize: '14px', color: '#b91c1c' }}>{selectedRequest.rejectReason}</div>
                  </div>
                </div>
              )}

              {/* Detail Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', backgroundColor: '#f8fafc', padding: '20px', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                <div>
                  <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '600', marginBottom: '4px' }}>PHÒNG / GIẢNG ĐƯỜNG</div>
                  <div style={{ fontSize: '15px', fontWeight: '600', color: '#0f172a' }}>{selectedRequest.roomName}</div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '600', marginBottom: '4px' }}>SỐ NGƯỜI THAM DỰ</div>
                  <div style={{ fontSize: '15px', fontWeight: '600', color: '#0f172a' }}>{selectedRequest.attendees} người</div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '600', marginBottom: '4px' }}>NGÀY SỬ DỤNG</div>
                  <div style={{ fontSize: '15px', fontWeight: '600', color: '#0f172a' }}>{selectedRequest.date.split('-').reverse().join('/')}</div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '600', marginBottom: '4px' }}>KHUNG GIỜ</div>
                  <div style={{ fontSize: '15px', fontWeight: '600', color: '#0f172a' }}>{selectedRequest.timeSlot}</div>
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '600', marginBottom: '4px' }}>NGƯỜI ĐĂNG KÝ</div>
                  <div style={{ fontSize: '15px', fontWeight: '600', color: '#0f172a' }}>{selectedRequest.lecturerName} <span style={{ color: '#94a3b8', fontWeight: 'normal' }}>({selectedRequest.lecturerEmail})</span></div>
                </div>
              </div>

              {/* Notes */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: '600', color: '#0f172a', marginBottom: '8px' }}>
                  <Info size={16} color="#3b82f6" /> Yêu cầu bổ sung / Ghi chú
                </div>
                <div style={{ backgroundColor: '#f1f5f9', padding: '16px', borderRadius: '12px', fontSize: '14px', color: '#334155', minHeight: '80px', border: '1px solid #e2e8f0' }}>
                  {selectedRequest.notes || <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Không có ghi chú thêm</span>}
                </div>
              </div>

            </div>

            <div style={{ padding: '16px 24px', borderTop: '1px solid #e2e8f0', backgroundColor: '#f8fafc', display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setSelectedRequest(null)} style={{ padding: '10px 24px', borderRadius: '10px', backgroundColor: '#e2e8f0', color: '#475569', fontWeight: '600', fontSize: '14px', border: 'none', cursor: 'pointer' }} className="hover:bg-slate-300">
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
