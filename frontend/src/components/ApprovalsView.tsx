import React, { useState } from 'react';
import { Search, Filter, Check, X, Eye, CheckCircle2, XCircle, Clock, Trash2 } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { getStorage, setStorage, useDataSync } from '../utils/syncHelper';
import api from '../services/api';
import './DashboardView.css'; // Use similar glass/admin styles if needed

export default function ApprovalsView() {
  const location = useLocation();
  // location.state?.requestId might have the passed ID from Dashboard

  const [activeTab, setActiveTab] = useState('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  const [requests, setRequests] = useState<any[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<any | null>(null);

  React.useEffect(() => {
    loadRequests();
  }, []);

  useDataSync('meetinghub_room_requests', () => {
    loadRequests();
  });

  const loadRequests = async () => {
    let apiRequests: any[] = [];
    try {
      const response = await api.get('/meetings');
      const allMeetings = response.data || [];

      apiRequests = allMeetings.map((m: any) => {
        let statusStr = 'pending';
        if (m.status === 'CONFIRMED' || m.status === 'SCHEDULED' || m.status === 'APPROVED') statusStr = 'approved';
        else if (m.status === 'REJECTED') statusStr = 'rejected';
        else if (m.status === 'CANCELLED') statusStr = 'cancelled';

        const startDate = new Date(m.start_time);
        const endDate = new Date(m.end_time);
        const timeSlotStr = `${startDate.getHours().toString().padStart(2, '0')}:${startDate.getMinutes().toString().padStart(2, '0')} - ${endDate.getHours().toString().padStart(2, '0')}:${endDate.getMinutes().toString().padStart(2, '0')}`;

        return {
          id: m.meeting_id,
          name: m.organizer?.full_name || 'Giảng viên',
          role: m.organizer?.role?.role_name || m.organizer?.role || 'Giảng viên',
          room: m.room?.room_name || 'Phòng ' + m.room_id,
          capacity: (m.room?.capacity || 0) + ' chỗ',
          time: timeSlotStr,
          date: startDate.toLocaleDateString('vi-VN'),
          reason: m.title,
          avatar: m.organizer?.avatar || m.organizer?.avatarUrl || m.organizer_id || '',
          status: statusStr,
          createdAt: m.created_at || new Date().toISOString()
        };
      });
    } catch (error) {
      console.error("Error loading approvals from API, falling back to local mock", error);
    }

    // LẤY TỪ LOCALSTORAGE ĐỂ ĐỒNG BỘ
    let localRequests: any[] = [];
    const saved = localStorage.getItem('meetinghub_room_requests');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Lọc bỏ dữ liệu rác B1, B2, B3, B4...
        const invalidIds = ['B1', 'B2', 'B3', 'B4', '#B1', '#B2', '#B3', '#B4'];
        const cleaned = parsed.filter((m: any) => !invalidIds.includes(m.id?.toString()));
        if (cleaned.length !== parsed.length) {
          localStorage.setItem('meetinghub_room_requests', JSON.stringify(cleaned));
        }

        localRequests = cleaned.map((m: any) => {
          let statusStr = 'pending';
          if (m.status === 'Đã duyệt' || m.status === 'approved') statusStr = 'approved';
          else if (m.status === 'Từ chối' || m.status === 'rejected') statusStr = 'rejected';
          else if (m.status === 'Đã hủy' || m.status === 'cancelled') statusStr = 'cancelled';

          let dynamicAvatar = m.userAvatar || m.requesterAvatar || '';

          try {
            const allUsers = JSON.parse(localStorage.getItem('users') || '[]');
            const matchedUser = allUsers.find((u: any) => u.email === m.lecturerEmail || u.email === m.userEmail);
            if (matchedUser && matchedUser.avatar) {
              dynamicAvatar = matchedUser.avatar;
            } else {
              const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
              if (currentUser && (currentUser.email === m.lecturerEmail || currentUser.email === m.userEmail)) {
                dynamicAvatar = currentUser.avatar || currentUser.avatarUrl || dynamicAvatar;
              }
            }
          } catch (e) { }

          return {
            id: m.id,
            name: m.lecturerName || m.userName || 'Giảng viên',
            role: m.userRole || 'Giảng viên',
            room: m.roomName || 'Phòng',
            capacity: (m.participants || m.attendees || 0) + ' chỗ',
            time: m.timeSlot || '',
            date: m.date ? new Date(m.date).toLocaleDateString('vi-VN') : '',
            reason: m.purpose || m.title || 'Không có lý do',
            avatar: dynamicAvatar,
            status: statusStr,
            createdAt: m.createdAt || new Date().toISOString(),
            notes: m.notes || m.description || '',
            participants: m.participants || m.attendees || 0,
            originalStatus: m.status
          };
        });
      } catch (e) { }
    }

    // Gộp và loại bỏ trùng
    const combinedMap = new Map();
    [...apiRequests, ...localRequests].forEach(req => {
      // Dùng chung ID để check trùng
      const checkId = req.id.toString().replace('REQ_', '');
      if (!combinedMap.has(checkId)) {
        combinedMap.set(checkId, req);
      }
    });

    const finalRequests = Array.from(combinedMap.values());
    // Sort by newest first
    finalRequests.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    setRequests(finalRequests);
  };

  const updateLocalStatus = (id: any, statusStr: string) => {
    const saved = localStorage.getItem('meetinghub_room_requests');
    if (saved) {
      try {
        let parsed = JSON.parse(saved);
        const strId = id.toString().replace('REQ_', '');
        parsed = parsed.map((m: any) => {
          const mIdStr = m.id.toString().replace('REQ_', '');
          if (mIdStr === strId) {
            return { ...m, status: statusStr };
          }
          return m;
        });
        localStorage.setItem('meetinghub_room_requests', JSON.stringify(parsed));
      } catch (e) { }
    }
  };

  const handleApprove = async (id: any) => {
    try {
      await api.patch(`/meetings/${id}/status`, { status: 'SCHEDULED' });
    } catch (error) {
      console.warn("Lỗi API Approve (Mock mode fallback):", error);
    }
    updateLocalStatus(id, 'Đã duyệt');
    alert('Đã phê duyệt yêu cầu thành công!');
    loadRequests();
    window.dispatchEvent(new Event('roomBookingsUpdated')); // Notify other components
    window.dispatchEvent(new Event('request-updated'));
  };

  const handleReject = async (id: any) => {
    try {
      await api.patch(`/meetings/${id}/status`, { status: 'REJECTED' });
    } catch (error) {
      console.warn("Lỗi API Reject (Mock mode fallback):", error);
    }
    updateLocalStatus(id, 'Từ chối');
    alert('Đã từ chối yêu cầu!');
    loadRequests();
    window.dispatchEvent(new Event('roomBookingsUpdated'));
    window.dispatchEvent(new Event('request-updated'));
  };

  const handleDelete = async (id: any) => {
    if (!window.confirm('Bạn có chắc muốn xóa hẳn đơn này không?')) return;
    try {
      await api.delete(`/meetings/${id}`);
    } catch (error) {
      console.warn("Lỗi API Delete:", error);
    }
    // Xóa khỏi localStorage nếu có
    const saved = localStorage.getItem('meetinghub_room_requests');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const filtered = parsed.filter((m: any) => m.id?.toString() !== id?.toString());
        localStorage.setItem('meetinghub_room_requests', JSON.stringify(filtered));
      } catch (e) { }
    }
    alert('Đã xóa đơn thành công!');
    loadRequests();
    window.dispatchEvent(new Event('request-updated'));
  };

  const handleViewDetails = (id: number | string) => {
    const req = requests.find(r => r.id === id);
    if (req) {
      setSelectedRequest(req);
    }
  };

  const filteredRequests = requests.filter(req => {
    // 1. Lọc theo Tab
    if (activeTab !== 'all' && req.status !== activeTab) return false;
    // 2. Lọc theo Role
    if (roleFilter !== 'all' && req.role !== roleFilter) return false;
    // 3. Lọc theo Search Query
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!req.name.toLowerCase().includes(q) &&
        !req.room.toLowerCase().includes(q) &&
        !req.reason.toLowerCase().includes(q)) {
        return false;
      }
    }
    return true;
  });

  const pendingCount = requests.filter(r => r.status === 'pending').length;

  return (
    <div style={{ padding: '24px 32px', width: '100%', boxSizing: 'border-box', fontFamily: 'Inter, sans-serif' }}>

      {/* 1. HEADER TRANG */}
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 800, color: '#0f172a', margin: '0 0 8px 0', letterSpacing: '-0.5px' }}>Phê duyệt yêu cầu đặt phòng</h1>
        <p style={{ color: '#64748b', margin: 0, fontSize: '15px' }}>Quản lý, kiểm tra và phê duyệt danh sách đăng ký sử dụng phòng họp, phòng lab toàn trường.</p>
      </div>

      {/* 2. BỘ THẺ LỌC TRẠNG THÁI (TAB FILTERS) */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', borderBottom: '1px solid #e2e8f0', paddingBottom: '16px' }}>
        <button
          onClick={() => setActiveTab('all')}
          style={{ padding: '8px 20px', borderRadius: '9999px', fontWeight: 600, fontSize: '14px', border: 'none', cursor: 'pointer', transition: 'all 0.2s', backgroundColor: activeTab === 'all' ? '#e2e8f0' : 'transparent', color: activeTab === 'all' ? '#0f172a' : '#64748b' }}
        >
          Tất cả
        </button>
        <button
          onClick={() => setActiveTab('pending')}
          style={{ padding: '8px 20px', borderRadius: '9999px', fontWeight: 600, fontSize: '14px', border: 'none', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: activeTab === 'pending' ? '#e0f2fe' : 'transparent', color: activeTab === 'pending' ? '#0284c7' : '#64748b' }}
        >
          Chờ duyệt
          <span style={{ backgroundColor: '#0ea5e9', color: '#fff', fontSize: '12px', padding: '2px 8px', borderRadius: '9999px' }}>{pendingCount}</span>
        </button>
        <button
          onClick={() => setActiveTab('approved')}
          style={{ padding: '8px 20px', borderRadius: '9999px', fontWeight: 600, fontSize: '14px', border: 'none', cursor: 'pointer', transition: 'all 0.2s', backgroundColor: activeTab === 'approved' ? '#dcfce7' : 'transparent', color: activeTab === 'approved' ? '#16a34a' : '#64748b' }}
        >
          Đã duyệt
        </button>
        <button
          onClick={() => setActiveTab('rejected')}
          style={{ padding: '8px 20px', borderRadius: '9999px', fontWeight: 600, fontSize: '14px', border: 'none', cursor: 'pointer', transition: 'all 0.2s', backgroundColor: activeTab === 'rejected' ? '#fee2e2' : 'transparent', color: activeTab === 'rejected' ? '#dc2626' : '#64748b' }}
        >
          Đã từ chối
        </button>
      </div>

      {/* 3. THANH TÌM KIẾM & BỘ LỌC KHU VỰC */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: '400px' }}>
          <Search size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input
            type="text"
            placeholder="Tìm theo tên người đặt, phòng, lý do..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ width: '100%', padding: '10px 16px 10px 44px', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '14px', outline: 'none', backgroundColor: '#fff' }}
          />
        </div>
        <div style={{ position: 'relative', width: '200px' }}>
          <Filter size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <select
            value={roleFilter}
            onChange={e => setRoleFilter(e.target.value)}
            style={{ width: '100%', padding: '10px 16px 10px 44px', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '14px', outline: 'none', backgroundColor: '#fff', cursor: 'pointer', appearance: 'none' }}
          >
            <option value="all">Tất cả vai trò</option>
            <option value="Giảng viên">Giảng viên</option>
            <option value="Sinh viên">Sinh viên</option>
            <option value="CLB Âm nhạc">CLB/Đội nhóm</option>
          </select>
        </div>
      </div>

      {/* 4. BẢNG DANH SÁCH YÊU CẦU */}
      <div style={{ backgroundColor: '#ffffff', borderRadius: '24px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -2px rgba(0, 0, 0, 0.025)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
              <th style={{ padding: '16px 24px', fontSize: '13px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>NGƯỜI YÊU CẦU</th>
              <th style={{ padding: '16px 24px', fontSize: '13px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>PHÒNG ĐĂNG KÝ</th>
              <th style={{ padding: '16px 24px', fontSize: '13px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>THỜI GIAN & NGÀY</th>
              <th style={{ padding: '16px 24px', fontSize: '13px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>LÝ DO SỬ DỤNG</th>
              <th style={{ padding: '16px 24px', fontSize: '13px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>TRẠNG THÁI</th>
              <th style={{ padding: '16px 24px', fontSize: '13px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>HÀNH ĐỘNG</th>
            </tr>
          </thead>
          <tbody>
            {filteredRequests.length > 0 ? (
              filteredRequests.map(req => (
                <tr key={req.id} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background-color 0.2s' }} className="hover:bg-slate-50">
                  <td style={{ padding: '16px 24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      {req.avatar && req.avatar !== '11' && isNaN(Number(req.avatar)) ? (
                        <img src={req.avatar} alt={req.name} style={{ width: '40px', height: '40px', borderRadius: '50%', border: '2px solid #e2e8f0', objectFit: 'cover' }} />
                      ) : (
                        <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'linear-gradient(135deg, #3b82f6, #2dd4bf)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: 'bold', color: 'white', flexShrink: 0 }}>
                          {req.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '14px' }}>{req.name}</div>
                        <div style={{ fontSize: '12px', color: '#64748b', backgroundColor: '#f1f5f9', padding: '2px 8px', borderRadius: '12px', display: 'inline-block', marginTop: '4px' }}>{req.role}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '16px 24px' }}>
                    <div style={{ fontWeight: 700, color: '#334155', fontSize: '14px' }}>{req.room}</div>
                    <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>Sức chứa: {req.capacity}</div>
                  </td>
                  <td style={{ padding: '16px 24px' }}>
                    <div style={{ fontWeight: 600, color: '#334155', fontSize: '14px' }}>{req.time}</div>
                    <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>{req.date}</div>
                  </td>
                  <td style={{ padding: '16px 24px', color: '#475569', fontSize: '14px', maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {req.reason}
                  </td>
                  <td style={{ padding: '16px 24px' }}>
                    {req.status === 'pending' && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: '#fef3c7', color: '#d97706', padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 600 }}><Clock size={14} /> Chờ duyệt</span>}
                    {req.status === 'approved' && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: '#dcfce7', color: '#16a34a', padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 600 }}><CheckCircle2 size={14} /> Đã duyệt</span>}
                    {req.status === 'rejected' && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: '#fee2e2', color: '#dc2626', padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 600 }}><XCircle size={14} /> Từ chối</span>}
                  </td>
                  <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                      {req.status === 'pending' && (
                        <>
                          <button onClick={() => handleApprove(req.id)} className="btn-neon-approve" title="Duyệt"><Check size={18} strokeWidth={2.5} /></button>
                          <button onClick={() => handleReject(req.id)} className="btn-neon-reject" title="Từ chối"><X size={18} strokeWidth={2.5} /></button>
                        </>
                      )}
                      <button onClick={() => handleViewDetails(req.id)} className="btn-glass-view" title="Xem chi tiết"><Eye size={18} /></button>
                      <button onClick={() => handleDelete(req.id)} title="Xóa đơn" style={{ background: '#fee2e2', border: 'none', borderRadius: '8px', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#dc2626' }}><Trash2 size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} style={{ padding: '48px', textAlign: 'center', color: '#64748b' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                    <Search size={32} style={{ color: '#cbd5e1' }} />
                    <div style={{ fontSize: '15px', fontWeight: 500 }}>Không có yêu cầu nào trùng khớp</div>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* MODAL CHI TIẾT */}
      {selectedRequest && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ backgroundColor: '#fff', borderRadius: '24px', width: '100%', maxWidth: '600px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', overflow: 'hidden' }}>
            {/* Modal Header */}
            <div style={{ padding: '24px 32px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a', margin: '0 0 4px 0' }}>Chi tiết đặt phòng</h3>
                <div style={{ color: '#64748b', fontSize: '14px' }}>Mã đơn: <span style={{ fontWeight: 600, color: '#334155' }}>{selectedRequest.id}</span></div>
              </div>
              <button onClick={() => setSelectedRequest(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
                <X size={24} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* Thông tin người đặt */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                {selectedRequest.avatar && selectedRequest.avatar !== '11' && isNaN(Number(selectedRequest.avatar)) ? (
                  <img src={selectedRequest.avatar} alt={selectedRequest.name} style={{ width: '56px', height: '56px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #e2e8f0' }} />
                ) : (
                  <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'linear-gradient(135deg, #3b82f6, #2dd4bf)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', fontWeight: 'bold', color: 'white' }}>
                    {selectedRequest.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>{selectedRequest.name}</div>
                  <div style={{ fontSize: '14px', color: '#64748b', marginTop: '4px' }}>{selectedRequest.role}</div>
                </div>
                <div style={{ marginLeft: 'auto' }}>
                  {selectedRequest.status === 'pending' && <span style={{ padding: '6px 12px', backgroundColor: '#fef3c7', color: '#d97706', borderRadius: '99px', fontSize: '13px', fontWeight: 600 }}>Chờ duyệt</span>}
                  {selectedRequest.status === 'approved' && <span style={{ padding: '6px 12px', backgroundColor: '#dcfce7', color: '#16a34a', borderRadius: '99px', fontSize: '13px', fontWeight: 600 }}>Đã duyệt</span>}
                  {selectedRequest.status === 'rejected' && <span style={{ padding: '6px 12px', backgroundColor: '#fee2e2', color: '#dc2626', borderRadius: '99px', fontSize: '13px', fontWeight: 600 }}>Từ chối</span>}
                  {selectedRequest.status === 'cancelled' && <span style={{ padding: '6px 12px', backgroundColor: '#f1f5f9', color: '#64748b', borderRadius: '99px', fontSize: '13px', fontWeight: 600 }}>Đã hủy</span>}
                </div>
              </div>

              {/* Thông tin chi tiết phòng & sự kiện */}
              <div style={{ backgroundColor: '#f8fafc', borderRadius: '16px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', gap: '16px' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em', marginBottom: '4px' }}>Phòng đặt</div>
                    <div style={{ fontSize: '15px', fontWeight: 600, color: '#0f172a' }}>{selectedRequest.room}</div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em', marginBottom: '4px' }}>Thời gian</div>
                    <div style={{ fontSize: '15px', fontWeight: 600, color: '#0f172a' }}>{selectedRequest.time}</div>
                    <div style={{ fontSize: '13px', color: '#64748b' }}>Ngày: {selectedRequest.date}</div>
                  </div>
                </div>

                <div style={{ borderTop: '1px solid #e2e8f0', margin: '8px 0' }}></div>

                <div>
                  <div style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em', marginBottom: '4px' }}>Mục đích sử dụng</div>
                  <div style={{ fontSize: '15px', fontWeight: 600, color: '#0f172a' }}>{selectedRequest.reason}</div>
                </div>

                <div style={{ display: 'flex', gap: '16px' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em', marginBottom: '4px' }}>Số người dự kiến</div>
                    <div style={{ fontSize: '15px', fontWeight: 600, color: '#0f172a' }}>{selectedRequest.participants} người</div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em', marginBottom: '4px' }}>Ngày gửi</div>
                    <div style={{ fontSize: '14px', color: '#334155' }}>{new Date(selectedRequest.createdAt).toLocaleString('vi-VN')}</div>
                  </div>
                </div>

                {selectedRequest.notes && (
                  <div>
                    <div style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em', marginBottom: '4px' }}>Ghi chú / Yêu cầu thêm</div>
                    <div style={{ fontSize: '14px', color: '#475569', backgroundColor: '#fff', padding: '12px', borderRadius: '8px', border: '1px dashed #cbd5e1' }}>{selectedRequest.notes}</div>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer / Actions */}
            <div style={{ padding: '24px 32px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '12px', backgroundColor: '#f8fafc' }}>
              <button onClick={() => setSelectedRequest(null)} style={{ padding: '10px 20px', borderRadius: '12px', fontSize: '14px', fontWeight: 600, color: '#64748b', backgroundColor: '#fff', border: '1px solid #cbd5e1', cursor: 'pointer' }}>
                Đóng
              </button>

              {selectedRequest.status === 'pending' && (
                <>
                  <button onClick={() => { handleReject(selectedRequest.id); setSelectedRequest(null); }} style={{ padding: '10px 20px', borderRadius: '12px', fontSize: '14px', fontWeight: 600, color: '#fff', backgroundColor: '#ef4444', border: 'none', cursor: 'pointer' }}>
                    Từ chối
                  </button>
                  <button onClick={() => { handleApprove(selectedRequest.id); setSelectedRequest(null); }} style={{ padding: '10px 20px', borderRadius: '12px', fontSize: '14px', fontWeight: 600, color: '#fff', backgroundColor: '#10b981', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Check size={18} /> Phê duyệt
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
