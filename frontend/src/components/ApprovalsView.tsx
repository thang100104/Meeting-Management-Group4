import React, { useState, useEffect } from 'react';
import {
  Search, Filter, Check, X, Eye, CheckCircle2, XCircle, Clock,
  Trash2, Building2, Monitor, RefreshCw, AlertCircle, Calendar,
  ArrowRight, UserCheck, Shield, ChevronRight, CheckCheck, RotateCcw
} from 'lucide-react';
import api from '../services/api';
import './DashboardView.css';
import { addNotification } from '../utils/notificationService';

interface RoomBookingItem {
  id: number | string;
  name: string;
  email: string;
  role: string;
  room: string;
  capacity: string;
  time: string;
  date: string;
  reason: string;
  avatar: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  createdAt: string;
  meetingType?: string;
  meetingLink?: string;
  passcode?: string;
  equipments?: any[];
  participants?: any[];
  notes?: string;
}

interface EquipmentRequestItem {
  id: number;
  equipmentId: number;
  equipmentName: string;
  equipmentType?: string;
  equipmentSerial?: string;
  requesterName: string;
  requesterEmail?: string;
  requesterRole?: string;
  requesterAvatar?: string;
  quantity: number;
  useLocation: string;
  time: string;
  date: string;
  startTime: string;
  endTime: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected' | 'returned';
  createdAt: string;
}

export default function ApprovalsView() {
  // Category tab: 'rooms' (Phòng họp) | 'equipments' (Thiết bị)
  const [categoryTab, setCategoryTab] = useState<'rooms' | 'equipments'>('rooms');
  const [activeStatusTab, setActiveStatusTab] = useState<string>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [isLoading, setIsLoading] = useState(false);

  // Lists
  const [roomRequests, setRoomRequests] = useState<RoomBookingItem[]>([]);
  const [equipmentRequests, setEquipmentRequests] = useState<EquipmentRequestItem[]>([]);

  // Modals
  const [selectedRoomReq, setSelectedRoomReq] = useState<RoomBookingItem | null>(null);
  const [selectedEqReq, setSelectedEqReq] = useState<EquipmentRequestItem | null>(null);

  // Reject Modal State
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<{ type: 'room' | 'equipment'; id: any; name: string } | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // Toast alert
  const [toastMsg, setToastMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMsg({ text, type });
    setTimeout(() => setToastMsg(null), 4000);
  };

  // Helper to push to system notifications (visible in Header Bell dropdown)
  const pushSystemNotification = (
    title: string,
    content: string,
    targetRole: 'admin' | 'lecturer' | 'student' | 'all' = 'lecturer',
    type: 'booking' | 'approval' | 'rejection' | 'schedule' | 'message' | 'system' = 'approval'
  ) => {
    try {
      addNotification({
        title,
        content,
        targetRole,
        senderRole: 'admin',
        senderName: 'Quản trị viên',
        type
      });
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  useEffect(() => {
    const handleSync = () => {
      loadAllData();
    };
    window.addEventListener('roomBookingsUpdated', handleSync);
    window.addEventListener('request-updated', handleSync);
    return () => {
      window.removeEventListener('roomBookingsUpdated', handleSync);
      window.removeEventListener('request-updated', handleSync);
    };
  }, []);

  const loadAllData = async () => {
    setIsLoading(true);
    await Promise.allSettled([loadRoomBookings(), loadEquipmentRequests()]);
    setIsLoading(false);
  };

  // 1. TẢI DANH SÁCH ĐẶT PHÒNG HỌP TỪ API
  const loadRoomBookings = async () => {
    let apiList: RoomBookingItem[] = [];
    try {
      const response = await api.get('/meetings');
      const meetings = response.data || [];

      apiList = meetings.map((m: any) => {
        let statusStr: 'pending' | 'approved' | 'rejected' | 'cancelled' = 'pending';
        if (m.status === 'SCHEDULED' || m.status === 'APPROVED' || m.status === 'IN_PROGRESS' || m.status === 'COMPLETED') {
          statusStr = 'approved';
        } else if (m.status === 'REJECTED') {
          statusStr = 'rejected';
        } else if (m.status === 'CANCELLED') {
          statusStr = 'cancelled';
        }

        const startDate = new Date(m.start_time);
        const endDate = new Date(m.end_time);
        const timeSlotStr = `${startDate.getHours().toString().padStart(2, '0')}:${startDate.getMinutes().toString().padStart(2, '0')} - ${endDate.getHours().toString().padStart(2, '0')}:${endDate.getMinutes().toString().padStart(2, '0')}`;

        return {
          id: m.meeting_id,
          name: m.organizer?.full_name || 'Người dùng',
          email: m.organizer?.email || '',
          role: m.organizer?.role?.role_name === 'ADMIN' ? 'Quản trị viên' : (m.organizer?.role?.role_name === 'ORGANIZER' ? 'Giảng viên' : (m.organizer?.role?.role_name || 'Giảng viên')),
          room: m.room?.room_name || `Phòng ${m.room_id}`,
          capacity: `${m.room?.capacity || 0} chỗ`,
          time: timeSlotStr,
          date: startDate.toLocaleDateString('vi-VN'),
          reason: m.title || 'Cuộc họp',
          avatar: m.organizer?.avatar_url || m.organizer?.avatar || m.organizer?.avatarUrl || '',
          status: statusStr,
          createdAt: m.created_at || new Date().toISOString(),
          meetingType: m.meeting_type,
          meetingLink: m.meeting_link,
          passcode: m.passcode,
          equipments: m.equipments || [],
          participants: m.participants || [],
          notes: m.description || ''
        };
      });
    } catch (error) {
      console.warn("Lỗi tải meetings từ API, dùng fallback localStorage:", error);
    }

    apiList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    setRoomRequests(apiList);
  };

  // 2. TẢI DANH SÁCH MƯỢN THIẾT BỊ TỪ API
  const loadEquipmentRequests = async () => {
    try {
      const response = await api.get('/equipment-requests');
      const list = response.data || [];

      const formatted: EquipmentRequestItem[] = list.map((item: any) => {
        let st: 'pending' | 'approved' | 'rejected' | 'returned' = 'pending';
        const rawStatus = (item.status || '').toUpperCase();
        if (rawStatus === 'APPROVED') st = 'approved';
        else if (rawStatus === 'REJECTED') st = 'rejected';
        else if (rawStatus === 'RETURNED') st = 'returned';

        const stDate = new Date(item.start_time);
        const etDate = new Date(item.end_time);
        const timeSlotStr = `${stDate.getHours().toString().padStart(2, '0')}:${stDate.getMinutes().toString().padStart(2, '0')} - ${etDate.getHours().toString().padStart(2, '0')}:${etDate.getMinutes().toString().padStart(2, '0')}`;

        return {
          id: item.id,
          equipmentId: item.equipment_id,
          equipmentName: item.equipment_name || `Thiết bị #${item.equipment_id}`,
          equipmentType: item.equipment_type || 'Thiết bị',
          equipmentSerial: item.equipment_serial || '',
          requesterName: item.requester_name || 'Người dùng',
          requesterEmail: item.requester_email || '',
          requesterRole: item.requester_role === 'ADMIN' ? 'Quản trị viên' : (item.requester_role === 'ORGANIZER' ? 'Giảng viên' : (item.requester_role || 'Giảng viên')),
          requesterAvatar: item.requester_avatar || '',
          quantity: item.quantity || 1,
          useLocation: item.use_location || 'Chưa ghi rõ',
          time: timeSlotStr,
          date: stDate.toLocaleDateString('vi-VN'),
          startTime: item.start_time,
          endTime: item.end_time,
          reason: item.reason || 'Mượn phục vụ giảng dạy / sự kiện',
          status: st,
          createdAt: item.created_at || new Date().toISOString()
        };
      });

      formatted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setEquipmentRequests(formatted);
    } catch (error) {
      console.warn("Lỗi tải equipment requests từ API:", error);
    }
  };

  // ── XỬ LÝ DUYỆT PHÒNG HỌP ──
  const handleApproveRoom = async (item: RoomBookingItem) => {
    try {
      if (typeof item.id === 'number' || /^\d+$/.test(item.id.toString())) {
        await api.patch(`/meetings/${item.id}/approve`, { note: 'Phê duyệt bởi Quản trị viên' });
      }
      // Đồng bộ localStorage nếu có
      updateLocalRoomStatus(item.id, 'Đã duyệt');
      pushSystemNotification(
        'Đã duyệt yêu cầu đặt phòng',
        `Phòng '${item.room}' cho cuộc họp '${item.reason}' (${item.date} ${item.time}) đã được phê duyệt thành công.`,
        'lecturer',
        'approval'
      );
      // Gửi thông báo lịch họp cho Sinh viên
      pushSystemNotification(
        'Lịch họp mới được công bố',
        `Cuộc họp '${item.reason}' tại Phòng '${item.room}' lúc ${item.time} ngày ${item.date}.`,
        'student',
        'schedule'
      );
      showToast(`✓ Đã phê duyệt cuộc họp '${item.reason}' thành công!`);
      loadRoomBookings();
      if (selectedRoomReq?.id === item.id) setSelectedRoomReq(null);
    } catch (error: any) {
      const msg = error.response?.data?.detail || error.message;
      showToast(`Không thể duyệt: ${msg}`, 'error');
    }
  };

  // ── XỬ LÝ DUYỆT THIẾT BỊ ──
  const handleApproveEquipment = async (item: EquipmentRequestItem) => {
    try {
      await api.patch(`/equipment-requests/${item.id}/approve`);
      pushSystemNotification(
        'Đã duyệt mượn thiết bị',
        `Yêu cầu mượn thiết bị '${item.equipmentName}' tại '${item.useLocation}' đã được phê duyệt.`
      );
      showToast(`✓ Đã phê duyệt đơn mượn '${item.equipmentName}'!`);
      loadEquipmentRequests();
      if (selectedEqReq?.id === item.id) setSelectedEqReq(null);
    } catch (error: any) {
      const msg = error.response?.data?.detail || error.message;
      showToast(`Không thể duyệt: ${msg}`, 'error');
    }
  };

  // ── XỬ LÝ XÁC NHẬN THU HỒI / ĐÃ TRẢ THIẾT BỊ ──
  const handleReturnEquipment = async (item: EquipmentRequestItem) => {
    try {
      await api.patch(`/equipment-requests/${item.id}/status`, { status: 'RETURNED' });
      pushSystemNotification(
        'Thiết bị đã được thu hồi',
        `Thiết bị '${item.equipmentName}' (Người mượn: ${item.requesterName}) đã được hoàn trả về kho.`
      );
      showToast(`✓ Đã xác nhận thu hồi thiết bị '${item.equipmentName}'!`);
      loadEquipmentRequests();
      if (selectedEqReq?.id === item.id) setSelectedEqReq(null);
    } catch (error: any) {
      const msg = error.response?.data?.detail || error.message;
      showToast(`Lỗi: ${msg}`, 'error');
    }
  };

  // ── MỞ MODAL TỪ CHỐI (KÈM LÝ DO) ──
  const openRejectModal = (type: 'room' | 'equipment', id: any, name: string) => {
    setRejectTarget({ type, id, name });
    setRejectReason('');
    setRejectModalOpen(true);
  };

  const confirmReject = async () => {
    if (!rejectTarget) return;
    try {
      if (rejectTarget.type === 'room') {
        if (typeof rejectTarget.id === 'number' || /^\d+$/.test(rejectTarget.id.toString())) {
          await api.patch(`/meetings/${rejectTarget.id}/reject`, { reason: rejectReason.trim() || undefined });
        }
        updateLocalRoomStatus(rejectTarget.id, 'Từ chối');
        pushSystemNotification(
          'Đã từ chối đặt phòng',
          `Yêu cầu đặt phòng cho '${rejectTarget.name}' đã bị từ chối.${rejectReason ? ' Lý do: ' + rejectReason : ''}`
        );
        showToast(`Đã từ chối yêu cầu đặt phòng '${rejectTarget.name}'`);
        loadRoomBookings();
        if (selectedRoomReq?.id === rejectTarget.id) setSelectedRoomReq(null);
      } else {
        await api.patch(`/equipment-requests/${rejectTarget.id}/reject`, null, {
          params: { reason: rejectReason.trim() || undefined }
        });
        pushSystemNotification(
          'Đã từ chối mượn thiết bị',
          `Yêu cầu mượn '${rejectTarget.name}' đã bị từ chối.${rejectReason ? ' Lý do: ' + rejectReason : ''}`
        );
        showToast(`Đã từ chối yêu cầu mượn thiết bị '${rejectTarget.name}'`);
        loadEquipmentRequests();
        if (selectedEqReq?.id === rejectTarget.id) setSelectedEqReq(null);
      }
    } catch (error: any) {
      const msg = error.response?.data?.detail || error.message;
      showToast(`Lỗi từ chối: ${msg}`, 'error');
    } finally {
      setRejectModalOpen(false);
      setRejectTarget(null);
    }
  };

  // ── XÓA ĐƠN ──
  const handleDeleteRoom = async (id: any) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa đơn đặt phòng này không?')) return;
    try {
      if (typeof id === 'number' || /^\d+$/.test(id.toString())) {
        await api.delete(`/meetings/${id}`);
      }
      // Xóa localStorage nếu có
      const saved = localStorage.getItem('meetinghub_room_requests');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          const filtered = parsed.filter((m: any) => m.id?.toString() !== id?.toString());
          localStorage.setItem('meetinghub_room_requests', JSON.stringify(filtered));
        } catch (e) { }
      }
      showToast('Đã xóa đơn đặt phòng thành công!');
      loadRoomBookings();
      window.dispatchEvent(new Event('request-updated'));
    } catch (error: any) {
      showToast(`Lỗi khi xóa: ${error.message}`, 'error');
    }
  };

  const handleDeleteEquipment = async (id: number) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa yêu cầu mượn thiết bị này không?')) return;
    try {
      await api.delete(`/equipment-requests/${id}`);
      showToast('Đã xóa yêu cầu mượn thiết bị thành công!');
      loadEquipmentRequests();
      window.dispatchEvent(new Event('request-updated'));
    } catch (error: any) {
      showToast(`Lỗi khi xóa: ${error.message}`, 'error');
    }
  };

  const updateLocalRoomStatus = (id: any, statusStr: string) => {
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

  // ── COUNTS & STATS ──
  const pendingRoomsCount = roomRequests.filter(r => r.status === 'pending').length;
  const pendingEqCount = equipmentRequests.filter(e => e.status === 'pending').length;
  const totalPending = pendingRoomsCount + pendingEqCount;

  const approvedRoomsCount = roomRequests.filter(r => r.status === 'approved').length;
  const approvedEqCount = equipmentRequests.filter(e => e.status === 'approved' || e.status === 'returned').length;
  const totalApproved = approvedRoomsCount + approvedEqCount;

  // ── FILTER DATA ──
  const filteredRoomRequests = roomRequests.filter(req => {
    if (activeStatusTab !== 'all' && req.status !== activeStatusTab) return false;
    if (roleFilter !== 'all' && req.role !== roleFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!req.name.toLowerCase().includes(q) &&
        !req.room.toLowerCase().includes(q) &&
        !req.reason.toLowerCase().includes(q) &&
        !req.email.toLowerCase().includes(q)) {
        return false;
      }
    }
    return true;
  });

  const filteredEquipmentRequests = equipmentRequests.filter(req => {
    if (activeStatusTab !== 'all' && req.status !== activeStatusTab) return false;
    if (roleFilter !== 'all' && req.requesterRole !== roleFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!req.requesterName.toLowerCase().includes(q) &&
        !req.equipmentName.toLowerCase().includes(q) &&
        !req.useLocation.toLowerCase().includes(q) &&
        !req.reason.toLowerCase().includes(q)) {
        return false;
      }
    }
    return true;
  });

  return (
    <div style={{ padding: '28px 36px', width: '100%', boxSizing: 'border-box', fontFamily: 'Inter, system-ui, sans-serif', backgroundColor: '#f8fafc', minHeight: '100vh' }}>

      {/* TOAST ALERT NOTIFICATION */}
      {toastMsg && (
        <div style={{
          position: 'fixed',
          top: '24px',
          right: '28px',
          zIndex: 9999,
          backgroundColor: toastMsg.type === 'success' ? '#065f46' : '#991b1b',
          color: '#ffffff',
          padding: '14px 22px',
          borderRadius: '14px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontSize: '14px',
          fontWeight: 600,
          animation: 'fadeIn 0.2s ease-in-out'
        }}>
          {toastMsg.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          {toastMsg.text}
        </div>
      )}

      {/* 1. HEADER SECTION */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px' }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '4px 12px', borderRadius: '9999px', backgroundColor: '#ecfdf5', color: '#059669', fontSize: '12px', fontWeight: 700, marginBottom: '8px', border: '1px solid #a7f3d0' }}>
            <Shield size={14} /> QUYỀN HẠN QUẢN TRỊ VIÊN (ADMIN)
          </div>
          <h1 style={{ fontSize: '30px', fontWeight: 900, color: '#0f172a', margin: '0 0 6px 0', letterSpacing: '-0.7px' }}>
            Trung tâm Phê duyệt & Điều hành
          </h1>
          <p style={{ color: '#64748b', margin: 0, fontSize: '15px' }}>
            Kiểm tra, xét duyệt lịch đặt phòng họp và đơn mượn thiết bị di động trong toàn trường.
          </p>
        </div>

        <button
          onClick={loadAllData}
          disabled={isLoading}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 20px',
            backgroundColor: '#ffffff',
            border: '1px solid #cbd5e1',
            borderRadius: '12px',
            color: '#334155',
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer',
            boxShadow: '0 1px 2px 0 rgba(0,0,0,0.05)',
            transition: 'all 0.2s'
          }}
          className="hover:bg-slate-50"
        >
          <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
          {isLoading ? 'Đang đồng bộ...' : 'Làm mới'}
        </button>
      </div>

      {/* 2. FILTERS & SEARCH - MODERN UI */}
      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-4 mb-6">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">

          {/* Category & Status Tabs */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full lg:w-auto">
            {/* Category Toggle (Room vs Equipment) */}
            <div className="flex bg-slate-100 p-1 rounded-xl">
              <button
                onClick={() => { setCategoryTab('rooms'); setActiveStatusTab('pending'); }}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${categoryTab === 'rooms' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
              >
                <Building2 size={16} />
                Phòng họp
                {pendingRoomsCount > 0 && categoryTab !== 'rooms' && (
                  <span className="bg-blue-100 text-blue-600 text-[10px] px-1.5 py-0.5 rounded-full">{pendingRoomsCount}</span>
                )}
              </button>
              <button
                onClick={() => { setCategoryTab('equipments'); setActiveStatusTab('pending'); }}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${categoryTab === 'equipments' ? 'bg-white text-purple-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
              >
                <Monitor size={16} />
                Thiết bị
                {pendingEqCount > 0 && categoryTab !== 'equipments' && (
                  <span className="bg-purple-100 text-purple-600 text-[10px] px-1.5 py-0.5 rounded-full">{pendingEqCount}</span>
                )}
              </button>
            </div>

            <div className="h-6 w-px bg-slate-200 hidden sm:block"></div>

            {/* Status Filters */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setActiveStatusTab('all')}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-colors ${activeStatusTab === 'all' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                  }`}
              >
                Tất cả
              </button>
              <button
                onClick={() => setActiveStatusTab('pending')}
                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold transition-colors ${activeStatusTab === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                  }`}
              >
                <Clock size={14} /> Chờ duyệt
                <span className="bg-amber-500 text-white text-[10px] px-1.5 rounded-full">
                  {categoryTab === 'rooms' ? pendingRoomsCount : pendingEqCount}
                </span>
              </button>
              <button
                onClick={() => setActiveStatusTab('approved')}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-colors ${activeStatusTab === 'approved' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                  }`}
              >
                {categoryTab === 'rooms' ? 'Đã duyệt' : 'Đang mượn'}
              </button>
              {categoryTab === 'equipments' && (
                <button
                  onClick={() => setActiveStatusTab('returned')}
                  className={`px-4 py-1.5 rounded-full text-xs font-bold transition-colors ${activeStatusTab === 'returned' ? 'bg-sky-100 text-sky-700' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                    }`}
                >
                  Đã trả lại
                </button>
              )}
              <button
                onClick={() => setActiveStatusTab('rejected')}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-colors ${activeStatusTab === 'rejected' ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                  }`}
              >
                Từ chối
              </button>
            </div>
          </div>

          {/* Search & Role Filter */}
          <div className="flex items-center gap-3 w-full lg:w-auto">
            <div className="relative flex-1 lg:w-64">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder={categoryTab === 'rooms' ? "Tìm theo tên, phòng, lý do..." : "Tìm thiết bị, người mượn..."}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
            </div>

            <div className="relative shrink-0">
              <Filter size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <select
                value={roleFilter}
                onChange={e => setRoleFilter(e.target.value)}
                className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 appearance-none cursor-pointer transition-all"
              >
                <option value="all">Tất cả vai trò</option>
                <option value="Giảng viên">Giảng viên</option>
                <option value="Quản trị viên">Quản trị viên</option>
                <option value="Sinh viên">Sinh viên</option>
              </select>
            </div>
          </div>

        </div>
      </div>

      {/* 5. NỘI DUNG BẢNG DUYỆT */}
      {categoryTab === 'rooms' ? (
        /* ── BẢNG YÊU CẦU ĐẶT PHÒNG HỌP ── */
        <div className="bg-white rounded-2xl border border-slate-200/60 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-200/80">
                  <th className="px-5 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Người yêu cầu</th>
                  <th className="px-5 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Phòng đăng ký</th>
                  <th className="px-5 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Thời gian & Ngày</th>
                  <th className="px-5 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Mục đích & Thiết bị</th>
                  <th className="px-5 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Trạng thái</th>
                  <th className="px-5 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRoomRequests.length > 0 ? (
                  filteredRoomRequests.map(req => (
                    <tr key={req.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          {req.avatar && (req.avatar.startsWith('http') || req.avatar.startsWith('data:image/')) ? (
                            <img src={req.avatar} alt={req.name} className="w-10 h-10 rounded-full object-cover shadow-sm border border-slate-100" />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-500 to-cyan-500 flex items-center justify-center text-sm font-bold text-white shrink-0 shadow-sm">
                              {req.name.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <div className="font-bold text-slate-800 text-sm">{req.name}</div>
                            <div className="text-xs text-slate-500 mt-0.5">{req.email || req.role}</div>
                            <span className="inline-block mt-1 text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100/50">{req.role}</span>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <div className="font-bold text-slate-800 text-sm">{req.room}</div>
                        <div className="text-xs text-slate-500 mt-0.5">Sức chứa: {req.capacity}</div>
                      </td>

                      <td className="px-5 py-4">
                        <div className="font-semibold text-slate-800 text-sm">{req.time}</div>
                        <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-1"><Calendar size={12} /> {req.date}</div>
                      </td>

                      <td className="px-5 py-4 max-w-[280px]">
                        <div className="font-semibold text-slate-800 text-sm truncate" title={req.reason}>
                          {req.reason}
                        </div>
                        {req.equipments && req.equipments.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {req.equipments.map((eq: any, idx: number) => (
                              <span key={idx} className="text-[10px] font-medium bg-slate-100 text-slate-600 px-2 py-0.5 rounded border border-slate-200/60 flex items-center gap-1">
                                ⚡ {eq.equipment_name || eq.name || 'Thiết bị'}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>

                      <td className="px-5 py-4">
                        {req.status === 'pending' && (
                          <span className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-700 px-2.5 py-1 rounded-full text-xs font-bold border border-amber-200/60">
                            <Clock size={14} /> Chờ duyệt
                          </span>
                        )}
                        {req.status === 'approved' && (
                          <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full text-xs font-bold border border-emerald-200/60">
                            <CheckCircle2 size={14} /> Đã duyệt
                          </span>
                        )}
                        {req.status === 'rejected' && (
                          <span className="inline-flex items-center gap-1.5 bg-rose-50 text-rose-700 px-2.5 py-1 rounded-full text-xs font-bold border border-rose-200/60">
                            <XCircle size={14} /> Từ chối
                          </span>
                        )}
                        {req.status === 'cancelled' && (
                          <span className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full text-xs font-bold border border-slate-200/60">
                            Đã hủy
                          </span>
                        )}
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-2">
                          {req.status === 'pending' && (
                            <>
                              <button
                                onClick={() => handleApproveRoom(req)}
                                className="w-8 h-8 flex items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-500 hover:text-white hover:shadow-md hover:shadow-emerald-500/20 transition-all"
                                title="Phê duyệt cuộc họp này"
                              >
                                <Check size={16} strokeWidth={2.5} />
                              </button>
                              <button
                                onClick={() => openRejectModal('room', req.id, req.reason)}
                                className="w-8 h-8 flex items-center justify-center rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-500 hover:text-white hover:shadow-md hover:shadow-rose-500/20 transition-all"
                                title="Từ chối yêu cầu"
                              >
                                <X size={16} strokeWidth={2.5} />
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => setSelectedRoomReq(req)}
                            className="w-8 h-8 flex items-center justify-center rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-500 hover:text-white hover:shadow-md hover:shadow-blue-500/20 transition-all"
                            title="Xem chi tiết"
                          >
                            <Eye size={16} />
                          </button>
                          <button
                            onClick={() => handleDeleteRoom(req.id)}
                            className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-100 text-slate-400 hover:bg-rose-500 hover:text-white transition-all"
                            title="Xóa đơn này"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-5 py-12 text-center text-slate-500">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
                          <Search size={20} className="text-slate-400" />
                        </div>
                        <div className="text-sm font-semibold">Không tìm thấy yêu cầu đặt phòng nào phù hợp</div>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* ── BẢNG YÊU CẦU MƯỢN THIẾT BỊ ── */
        <div className="bg-white rounded-2xl border border-slate-200/60 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-200/80">
                  <th className="px-5 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Người mượn</th>
                  <th className="px-5 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Thiết bị</th>
                  <th className="px-5 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Địa điểm sử dụng</th>
                  <th className="px-5 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Thời gian mượn</th>
                  <th className="px-5 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Trạng thái</th>
                  <th className="px-5 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredEquipmentRequests.length > 0 ? (
                  filteredEquipmentRequests.map(eq => (
                    <tr key={eq.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          {eq.requesterAvatar && (eq.requesterAvatar.startsWith('http') || eq.requesterAvatar.startsWith('data:image/')) ? (
                            <img src={eq.requesterAvatar} alt={eq.requesterName} className="w-10 h-10 rounded-full object-cover shadow-sm border border-slate-100" />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-purple-500 to-pink-500 flex items-center justify-center text-sm font-bold text-white shrink-0 shadow-sm">
                              {eq.requesterName.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <div className="font-bold text-slate-800 text-sm">{eq.requesterName}</div>
                            <div className="text-xs text-slate-500 mt-0.5">{eq.requesterEmail || eq.requesterRole}</div>
                            <span className="inline-block mt-1 text-[10px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-100/50">{eq.requesterRole}</span>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <div className="font-bold text-slate-800 text-sm flex items-center gap-1.5"><Monitor size={14} className="text-slate-400" /> {eq.equipmentName}</div>
                        <div className="text-xs text-slate-500 mt-0.5 ml-5">SL: {eq.quantity} | Mã: {eq.equipmentId}</div>
                      </td>

                      <td className="px-5 py-4">
                        <div className="font-semibold text-slate-800 text-sm">{eq.useLocation}</div>
                      </td>

                      <td className="px-5 py-4">
                        <div className="font-semibold text-slate-800 text-sm">{eq.time}</div>
                        <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-1"><Calendar size={12} /> {eq.date}</div>
                      </td>

                      <td className="px-5 py-4">
                        {eq.status === 'pending' && (
                          <span className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-700 px-2.5 py-1 rounded-full text-xs font-bold border border-amber-200/60">
                            <Clock size={14} /> Chờ duyệt
                          </span>
                        )}
                        {eq.status === 'approved' && (
                          <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full text-xs font-bold border border-emerald-200/60">
                            <CheckCircle2 size={14} /> Đang mượn
                          </span>
                        )}
                        {eq.status === 'rejected' && (
                          <span className="inline-flex items-center gap-1.5 bg-rose-50 text-rose-700 px-2.5 py-1 rounded-full text-xs font-bold border border-rose-200/60">
                            <XCircle size={14} /> Từ chối
                          </span>
                        )}
                        {eq.status === 'returned' && (
                          <span className="inline-flex items-center gap-1.5 bg-sky-50 text-sky-700 px-2.5 py-1 rounded-full text-xs font-bold border border-sky-200/60">
                            <CheckCheck size={14} /> Đã trả lại
                          </span>
                        )}
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-2">
                          {eq.status === 'pending' && (
                            <>
                              <button
                                onClick={() => handleApproveEquipment(eq)}
                                className="w-8 h-8 flex items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-500 hover:text-white hover:shadow-md hover:shadow-emerald-500/20 transition-all"
                                title="Phê duyệt mượn"
                              >
                                <Check size={16} strokeWidth={2.5} />
                              </button>
                              <button
                                onClick={() => openRejectModal('equipment', eq.id, `Mượn ${eq.equipmentName}`)}
                                className="w-8 h-8 flex items-center justify-center rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-500 hover:text-white hover:shadow-md hover:shadow-rose-500/20 transition-all"
                                title="Từ chối yêu cầu"
                              >
                                <X size={16} strokeWidth={2.5} />
                              </button>
                            </>
                          )}
                          {eq.status === 'approved' && (
                            <button
                              onClick={() => handleReturnEquipment(eq)}
                              className="px-3 h-8 flex items-center justify-center gap-1.5 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-500 hover:text-white font-semibold text-xs transition-all"
                              title="Xác nhận đã trả thiết bị vào kho"
                            >
                              <RotateCcw size={14} /> Thu hồi
                            </button>
                          )}
                          <button
                            onClick={() => setSelectedEqReq(eq)}
                            className="w-8 h-8 flex items-center justify-center rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-500 hover:text-white hover:shadow-md hover:shadow-blue-500/20 transition-all"
                            title="Xem chi tiết"
                          >
                            <Eye size={16} />
                          </button>
                          <button
                            onClick={() => handleDeleteEquipment(eq.id)}
                            className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-100 text-slate-400 hover:bg-rose-500 hover:text-white transition-all"
                            title="Xóa đơn này"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-5 py-12 text-center text-slate-500">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
                          <Monitor size={20} className="text-slate-400" />
                        </div>
                        <div className="text-sm font-semibold">Không tìm thấy yêu cầu mượn thiết bị nào phù hợp</div>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── MODAL 1: CHI TIẾT ĐẶT PHÒNG HỌP ── */}
      {selectedRoomReq && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '24px', width: '100%', maxWidth: '640px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
            {/* Header */}
            <div style={{ padding: '24px 28px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a', margin: '0 0 4px 0' }}>Chi tiết đặt phòng họp</h3>
                <div style={{ color: '#64748b', fontSize: '13px' }}>Mã đơn: <span style={{ fontWeight: 700, color: '#0f172a' }}>#{selectedRoomReq.id}</span></div>
              </div>
              <button onClick={() => setSelectedRoomReq(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
                <X size={24} />
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Người đặt */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px', backgroundColor: '#f8fafc', borderRadius: '16px' }}>
                {selectedRoomReq.avatar && (selectedRoomReq.avatar.startsWith('http') || selectedRoomReq.avatar.startsWith('data:image/')) ? (
                  <img src={selectedRoomReq.avatar} alt={selectedRoomReq.name} style={{ width: '56px', height: '56px', borderRadius: '50%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'linear-gradient(135deg, #3b82f6, #06b6d4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', fontWeight: 'bold', color: 'white' }}>
                    {selectedRoomReq.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>{selectedRoomReq.name}</div>
                  <div style={{ fontSize: '13px', color: '#64748b' }}>{selectedRoomReq.email}</div>
                  <span style={{ fontSize: '11px', color: '#0284c7', backgroundColor: '#e0f2fe', padding: '2px 8px', borderRadius: '9999px', fontWeight: 700, marginTop: '4px', display: 'inline-block' }}>
                    {selectedRoomReq.role}
                  </span>
                </div>
              </div>

              {/* Thông tin phòng & thời gian */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div style={{ padding: '14px', backgroundColor: '#f8fafc', borderRadius: '12px' }}>
                  <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Phòng họp</div>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', marginTop: '4px' }}>{selectedRoomReq.room}</div>
                  <div style={{ fontSize: '12px', color: '#94a3b8' }}>Sức chứa: {selectedRoomReq.capacity}</div>
                </div>

                <div style={{ padding: '14px', backgroundColor: '#f8fafc', borderRadius: '12px' }}>
                  <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Thời gian & Ngày</div>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', marginTop: '4px' }}>{selectedRoomReq.time}</div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>Ngày: {selectedRoomReq.date}</div>
                </div>
              </div>

              {/* Mục đích & Tiêu đề */}
              <div style={{ padding: '14px', backgroundColor: '#f8fafc', borderRadius: '12px' }}>
                <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Tiêu đề / Mục đích</div>
                <div style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a', marginTop: '4px' }}>{selectedRoomReq.reason}</div>
                {selectedRoomReq.notes && (
                  <div style={{ fontSize: '13px', color: '#475569', marginTop: '8px', backgroundColor: '#ffffff', padding: '10px', borderRadius: '8px', border: '1px dashed #cbd5e1' }}>
                    {selectedRoomReq.notes}
                  </div>
                )}
              </div>

              {/* Thiết bị mượn kèm */}
              {selectedRoomReq.equipments && selectedRoomReq.equipments.length > 0 && (
                <div style={{ padding: '14px', backgroundColor: '#f8fafc', borderRadius: '12px' }}>
                  <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', marginBottom: '8px' }}>Thiết bị mượn kèm</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {selectedRoomReq.equipments.map((eq: any, i: number) => (
                      <div key={i} style={{ padding: '6px 12px', backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '13px', fontWeight: 600, color: '#1e293b' }}>
                        ⚡ {eq.equipment_name || eq.name}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer Actions */}
            <div style={{ padding: '20px 28px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '12px', backgroundColor: '#f8fafc' }}>
              <button
                onClick={() => setSelectedRoomReq(null)}
                style={{ padding: '10px 18px', borderRadius: '12px', fontSize: '14px', fontWeight: 600, color: '#64748b', backgroundColor: '#ffffff', border: '1px solid #cbd5e1', cursor: 'pointer' }}
              >
                Đóng
              </button>
              {selectedRoomReq.status === 'pending' && (
                <>
                  <button
                    onClick={() => {
                      const req = selectedRoomReq;
                      setSelectedRoomReq(null);
                      openRejectModal('room', req.id, req.reason);
                    }}
                    style={{ padding: '10px 20px', borderRadius: '12px', fontSize: '14px', fontWeight: 700, color: '#ffffff', backgroundColor: '#ef4444', border: 'none', cursor: 'pointer' }}
                  >
                    Từ chối
                  </button>
                  <button
                    onClick={() => handleApproveRoom(selectedRoomReq)}
                    style={{ padding: '10px 24px', borderRadius: '12px', fontSize: '14px', fontWeight: 700, color: '#ffffff', backgroundColor: '#10b981', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                  >
                    <Check size={18} /> Phê duyệt
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL 2: CHI TIẾT MƯỢN THIẾT BỊ ── */}
      {selectedEqReq && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '24px', width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
            <div style={{ padding: '24px 28px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a', margin: '0 0 4px 0' }}>Chi tiết đơn mượn thiết bị</h3>
                <div style={{ color: '#64748b', fontSize: '13px' }}>Mã yêu cầu: <span style={{ fontWeight: 700, color: '#0f172a' }}>#{selectedEqReq.id}</span></div>
              </div>
              <button onClick={() => setSelectedEqReq(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
                <X size={24} />
              </button>
            </div>

            <div style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Người mượn */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px', backgroundColor: '#f8fafc', borderRadius: '16px' }}>
                <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'linear-gradient(135deg, #8b5cf6, #ec4899)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', fontWeight: 'bold', color: 'white' }}>
                  {selectedEqReq.requesterName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>{selectedEqReq.requesterName}</div>
                  <div style={{ fontSize: '13px', color: '#64748b' }}>{selectedEqReq.requesterEmail}</div>
                  <span style={{ fontSize: '11px', color: '#7c3aed', backgroundColor: '#f5f3ff', padding: '2px 8px', borderRadius: '9999px', fontWeight: 700, marginTop: '4px', display: 'inline-block' }}>
                    {selectedEqReq.requesterRole}
                  </span>
                </div>
              </div>

              {/* Thông tin thiết bị */}
              <div style={{ padding: '16px', backgroundColor: '#f8fafc', borderRadius: '14px' }}>
                <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Thiết bị đăng ký mượn</div>
                <div style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a', marginTop: '4px' }}>{selectedEqReq.equipmentName}</div>
                <div style={{ fontSize: '13px', color: '#475569', marginTop: '4px' }}>
                  Loại: <b>{selectedEqReq.equipmentType}</b> | Số lượng: <b>{selectedEqReq.quantity}</b>
                  {selectedEqReq.equipmentSerial && <span> | Seri: <b>{selectedEqReq.equipmentSerial}</b></span>}
                </div>
              </div>

              {/* Địa điểm & Thời gian */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div style={{ padding: '14px', backgroundColor: '#f8fafc', borderRadius: '12px' }}>
                  <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Địa điểm sử dụng</div>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a', marginTop: '4px' }}>📍 {selectedEqReq.useLocation}</div>
                </div>

                <div style={{ padding: '14px', backgroundColor: '#f8fafc', borderRadius: '12px' }}>
                  <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Khung giờ mượn</div>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a', marginTop: '4px' }}>{selectedEqReq.time}</div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>Ngày: {selectedEqReq.date}</div>
                </div>
              </div>

              {/* Lý do mượn */}
              <div style={{ padding: '14px', backgroundColor: '#f8fafc', borderRadius: '12px' }}>
                <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Mục đích sử dụng</div>
                <div style={{ fontSize: '14px', color: '#334155', marginTop: '4px' }}>{selectedEqReq.reason}</div>
              </div>
            </div>

            <div style={{ padding: '20px 28px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '12px', backgroundColor: '#f8fafc' }}>
              <button
                onClick={() => setSelectedEqReq(null)}
                style={{ padding: '10px 18px', borderRadius: '12px', fontSize: '14px', fontWeight: 600, color: '#64748b', backgroundColor: '#ffffff', border: '1px solid #cbd5e1', cursor: 'pointer' }}
              >
                Đóng
              </button>
              {selectedEqReq.status === 'pending' && (
                <>
                  <button
                    onClick={() => {
                      const req = selectedEqReq;
                      setSelectedEqReq(null);
                      openRejectModal('equipment', req.id, req.equipmentName);
                    }}
                    style={{ padding: '10px 20px', borderRadius: '12px', fontSize: '14px', fontWeight: 700, color: '#ffffff', backgroundColor: '#ef4444', border: 'none', cursor: 'pointer' }}
                  >
                    Từ chối
                  </button>
                  <button
                    onClick={() => handleApproveEquipment(selectedEqReq)}
                    style={{ padding: '10px 24px', borderRadius: '12px', fontSize: '14px', fontWeight: 700, color: '#ffffff', backgroundColor: '#10b981', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                  >
                    <Check size={18} /> Phê duyệt
                  </button>
                </>
              )}
              {selectedEqReq.status === 'approved' && (
                <button
                  onClick={() => handleReturnEquipment(selectedEqReq)}
                  style={{ padding: '10px 24px', borderRadius: '12px', fontSize: '14px', fontWeight: 700, color: '#ffffff', backgroundColor: '#0284c7', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  <RotateCcw size={18} /> Thu hồi về kho
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL 3: NHẬP LÝ DO TỪ CHỐI ── */}
      {rejectModalOpen && rejectTarget && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '24px', width: '100%', maxWidth: '520px', padding: '28px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div style={{ width: '42px', height: '42px', borderRadius: '12px', backgroundColor: '#fee2e2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <XCircle size={24} />
              </div>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a', margin: 0 }}>Từ chối yêu cầu</h3>
                <div style={{ fontSize: '13px', color: '#64748b' }}>Đơn: {rejectTarget.name}</div>
              </div>
            </div>

            <p style={{ fontSize: '14px', color: '#475569', marginBottom: '14px' }}>
              Vui lòng nhập lý do từ chối để hệ thống gửi thông báo phản hồi tới người yêu cầu:
            </p>

            <textarea
              rows={4}
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="Ví dụ: Trùng lịch với hội nghị Ban Giám hiệu, Thiết bị đang bảo dưỡng..."
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '12px',
                border: '1px solid #cbd5e1',
                fontSize: '14px',
                boxSizing: 'border-box',
                outline: 'none',
                resize: 'none'
              }}
            />

            {/* Gợi ý lý do nhanh */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '10px', marginBottom: '20px' }}>
              {[
                'Trùng lịch Ban Giám hiệu',
                'Phòng đang bảo trì kỹ thuật',
                'Thiết bị tạm thời không khả dụng',
                'Chưa đủ điều kiện sử dụng'
              ].map((reasonChip, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setRejectReason(reasonChip)}
                  style={{
                    fontSize: '11px',
                    padding: '4px 8px',
                    borderRadius: '8px',
                    backgroundColor: '#f1f5f9',
                    border: '1px solid #e2e8f0',
                    color: '#475569',
                    cursor: 'pointer'
                  }}
                >
                  + {reasonChip}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => { setRejectModalOpen(false); setRejectTarget(null); }}
                style={{ padding: '10px 18px', borderRadius: '12px', fontSize: '14px', fontWeight: 600, color: '#64748b', backgroundColor: '#f1f5f9', border: 'none', cursor: 'pointer' }}
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={confirmReject}
                style={{ padding: '10px 22px', borderRadius: '12px', fontSize: '14px', fontWeight: 700, color: '#ffffff', backgroundColor: '#dc2626', border: 'none', cursor: 'pointer' }}
              >
                Xác nhận từ chối
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
