import React, { useState, useEffect } from 'react';
import {
  Search, Filter, Check, X, Eye, CheckCircle2, XCircle, Clock,
  Trash2, Building2, Monitor, RefreshCw, AlertCircle, Calendar,
  ArrowRight, UserCheck, Shield, ChevronRight, CheckCheck, RotateCcw
} from 'lucide-react';
import api from '../services/api';
import './DashboardView.css';

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
  const pushSystemNotification = (title: string, content: string) => {
    try {
      const notifs = JSON.parse(localStorage.getItem('system_notifications') || '[]');
      const newNotif = {
        id: Date.now(),
        title,
        content,
        createdAt: new Date().toISOString(),
        isRead: false
      };
      localStorage.setItem('system_notifications', JSON.stringify([newNotif, ...notifs]));
      window.dispatchEvent(new Event('storage'));
      window.dispatchEvent(new Event('request-updated'));
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
          avatar: m.organizer?.avatar || m.organizer?.avatarUrl || '',
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

    // Gộp thêm localStorage mock nếu có (loại bỏ ID số đã có từ DB)
    let localList: RoomBookingItem[] = [];
    const saved = localStorage.getItem('meetinghub_room_requests');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const nonDbItems = parsed.filter((m: any) => typeof m.id === 'string' && !/^\d+$/.test(m.id));
        localList = nonDbItems.map((m: any) => {
          let statusStr: 'pending' | 'approved' | 'rejected' | 'cancelled' = 'pending';
          if (m.status === 'Đã duyệt' || m.status === 'approved') statusStr = 'approved';
          else if (m.status === 'Từ chối' || m.status === 'rejected') statusStr = 'rejected';
          else if (m.status === 'Đã hủy' || m.status === 'cancelled') statusStr = 'cancelled';

          return {
            id: m.id,
            name: m.lecturerName || m.userName || 'Giảng viên',
            email: m.lecturerEmail || m.userEmail || '',
            role: m.userRole || 'Giảng viên',
            room: m.roomName || 'Phòng họp',
            capacity: `${m.participants || m.attendees || 0} chỗ`,
            time: m.timeSlot || '',
            date: m.date ? new Date(m.date).toLocaleDateString('vi-VN') : '',
            reason: m.purpose || m.title || 'Không có lý do',
            avatar: m.userAvatar || m.requesterAvatar || '',
            status: statusStr,
            createdAt: m.createdAt || new Date().toISOString(),
            notes: m.notes || m.description || '',
            equipments: m.equipments || [],
            participants: []
          };
        });
      } catch (e) {}
    }

    const combined = [...apiList, ...localList];
    combined.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    setRoomRequests(combined);
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
        `Phòng '${item.room}' cho cuộc họp '${item.reason}' (${item.date} ${item.time}) đã được phê duyệt thành công.`
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
        } catch (e) {}
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
      } catch (e) {}
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

      {/* 2. STATS KPI CARDS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '28px' }}>
        {/* Card 1: Tổng chờ duyệt */}
        <div style={{ backgroundColor: '#ffffff', borderRadius: '18px', padding: '20px', border: '1px solid #fde68a', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', gap: '16px', background: 'linear-gradient(135deg, #ffffff 60%, #fffbeb)' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '14px', backgroundColor: '#fef3c7', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Clock size={24} />
          </div>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Tổng chờ duyệt</div>
            <div style={{ fontSize: '28px', fontWeight: 800, color: '#b45309' }}>{totalPending}</div>
          </div>
        </div>

        {/* Card 2: Đặt phòng chờ duyệt */}
        <div 
          onClick={() => { setCategoryTab('rooms'); setActiveStatusTab('pending'); }}
          style={{ backgroundColor: '#ffffff', borderRadius: '18px', padding: '20px', border: '1px solid #bfdbfe', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', gap: '16px', cursor: 'pointer', background: 'linear-gradient(135deg, #ffffff 60%, #eff6ff)' }}
          className="hover:scale-[1.02] transition-transform"
        >
          <div style={{ width: '48px', height: '48px', borderRadius: '14px', backgroundColor: '#dbeafe', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Building2 size={24} />
          </div>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#1e40af', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Phòng họp chờ duyệt</div>
            <div style={{ fontSize: '28px', fontWeight: 800, color: '#1d4ed8' }}>{pendingRoomsCount}</div>
          </div>
        </div>

        {/* Card 3: Thiết bị chờ duyệt */}
        <div 
          onClick={() => { setCategoryTab('equipments'); setActiveStatusTab('pending'); }}
          style={{ backgroundColor: '#ffffff', borderRadius: '18px', padding: '20px', border: '1px solid #ddd6fe', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', gap: '16px', cursor: 'pointer', background: 'linear-gradient(135deg, #ffffff 60%, #f5f3ff)' }}
          className="hover:scale-[1.02] transition-transform"
        >
          <div style={{ width: '48px', height: '48px', borderRadius: '14px', backgroundColor: '#ede9fe', color: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Monitor size={24} />
          </div>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#5b21b6', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Thiết bị chờ duyệt</div>
            <div style={{ fontSize: '28px', fontWeight: 800, color: '#6d28d9' }}>{pendingEqCount}</div>
          </div>
        </div>

        {/* Card 4: Đã xử lý */}
        <div style={{ backgroundColor: '#ffffff', borderRadius: '18px', padding: '20px', border: '1px solid #bbf7d0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', gap: '16px', background: 'linear-gradient(135deg, #ffffff 60%, #f0fdf4)' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '14px', backgroundColor: '#dcfce7', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CheckCircle2 size={24} />
          </div>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#166534', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Đã phê duyệt</div>
            <div style={{ fontSize: '28px', fontWeight: 800, color: '#15803d' }}>{totalApproved}</div>
          </div>
        </div>
      </div>

      {/* 3. CATEGORY SWITCHER (PHÒNG HỌP VS THIẾT BỊ) */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
        <button
          onClick={() => { setCategoryTab('rooms'); setActiveStatusTab('pending'); }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '12px 24px',
            borderRadius: '16px',
            fontWeight: 700,
            fontSize: '15px',
            border: categoryTab === 'rooms' ? '2px solid #2563eb' : '1px solid #e2e8f0',
            backgroundColor: categoryTab === 'rooms' ? '#eff6ff' : '#ffffff',
            color: categoryTab === 'rooms' ? '#1d4ed8' : '#64748b',
            cursor: 'pointer',
            boxShadow: categoryTab === 'rooms' ? '0 4px 12px rgba(37,99,235,0.15)' : 'none',
            transition: 'all 0.2s'
          }}
        >
          <Building2 size={20} />
          Yêu cầu Đặt phòng họp
          <span style={{
            backgroundColor: categoryTab === 'rooms' ? '#2563eb' : '#94a3b8',
            color: '#fff',
            fontSize: '12px',
            padding: '2px 8px',
            borderRadius: '9999px',
            fontWeight: 800
          }}>
            {pendingRoomsCount}
          </span>
        </button>

        <button
          onClick={() => { setCategoryTab('equipments'); setActiveStatusTab('pending'); }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '12px 24px',
            borderRadius: '16px',
            fontWeight: 700,
            fontSize: '15px',
            border: categoryTab === 'equipments' ? '2px solid #7c3aed' : '1px solid #e2e8f0',
            backgroundColor: categoryTab === 'equipments' ? '#f5f3ff' : '#ffffff',
            color: categoryTab === 'equipments' ? '#6d28d9' : '#64748b',
            cursor: 'pointer',
            boxShadow: categoryTab === 'equipments' ? '0 4px 12px rgba(124,58,237,0.15)' : 'none',
            transition: 'all 0.2s'
          }}
        >
          <Monitor size={20} />
          Yêu cầu Mượn thiết bị di động
          <span style={{
            backgroundColor: categoryTab === 'equipments' ? '#7c3aed' : '#94a3b8',
            color: '#fff',
            fontSize: '12px',
            padding: '2px 8px',
            borderRadius: '9999px',
            fontWeight: 800
          }}>
            {pendingEqCount}
          </span>
        </button>
      </div>

      {/* 4. SUB-FILTER TABS (THEO TRẠNG THÁI) & TÌM KIẾM */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setActiveStatusTab('all')}
            style={{
              padding: '8px 18px',
              borderRadius: '9999px',
              fontWeight: 600,
              fontSize: '13px',
              border: 'none',
              cursor: 'pointer',
              backgroundColor: activeStatusTab === 'all' ? '#0f172a' : '#e2e8f0',
              color: activeStatusTab === 'all' ? '#ffffff' : '#475569'
            }}
          >
            Tất cả
          </button>
          <button
            onClick={() => setActiveStatusTab('pending')}
            style={{
              padding: '8px 18px',
              borderRadius: '9999px',
              fontWeight: 600,
              fontSize: '13px',
              border: 'none',
              cursor: 'pointer',
              backgroundColor: activeStatusTab === 'pending' ? '#fef3c7' : '#f1f5f9',
              color: activeStatusTab === 'pending' ? '#b45309' : '#64748b',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Clock size={14} /> Chờ duyệt
            <span style={{ backgroundColor: '#d97706', color: '#fff', fontSize: '11px', padding: '1px 6px', borderRadius: '9999px' }}>
              {categoryTab === 'rooms' ? pendingRoomsCount : pendingEqCount}
            </span>
          </button>
          <button
            onClick={() => setActiveStatusTab('approved')}
            style={{
              padding: '8px 18px',
              borderRadius: '9999px',
              fontWeight: 600,
              fontSize: '13px',
              border: 'none',
              cursor: 'pointer',
              backgroundColor: activeStatusTab === 'approved' ? '#dcfce7' : '#f1f5f9',
              color: activeStatusTab === 'approved' ? '#15803d' : '#64748b'
            }}
          >
            {categoryTab === 'rooms' ? 'Đã duyệt' : 'Đang mượn / Đã duyệt'}
          </button>

          {categoryTab === 'equipments' && (
            <button
              onClick={() => setActiveStatusTab('returned')}
              style={{
                padding: '8px 18px',
                borderRadius: '9999px',
                fontWeight: 600,
                fontSize: '13px',
                border: 'none',
                cursor: 'pointer',
                backgroundColor: activeStatusTab === 'returned' ? '#e0f2fe' : '#f1f5f9',
                color: activeStatusTab === 'returned' ? '#0369a1' : '#64748b'
              }}
            >
              Đã trả lại
            </button>
          )}

          <button
            onClick={() => setActiveStatusTab('rejected')}
            style={{
              padding: '8px 18px',
              borderRadius: '9999px',
              fontWeight: 600,
              fontSize: '13px',
              border: 'none',
              cursor: 'pointer',
              backgroundColor: activeStatusTab === 'rejected' ? '#fee2e2' : '#f1f5f9',
              color: activeStatusTab === 'rejected' ? '#b91c1c' : '#64748b'
            }}
          >
            Đã từ chối
          </button>
        </div>

        {/* Search & Role filter */}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div style={{ position: 'relative', width: '280px' }}>
            <Search size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input
              type="text"
              placeholder={categoryTab === 'rooms' ? "Tìm theo người đặt, phòng, lý do..." : "Tìm thiết bị, người mượn, phòng..."}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 14px 9px 38px',
                borderRadius: '12px',
                border: '1px solid #cbd5e1',
                fontSize: '13px',
                outline: 'none',
                backgroundColor: '#ffffff'
              }}
            />
          </div>

          <div style={{ position: 'relative', width: '180px' }}>
            <Filter size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <select
              value={roleFilter}
              onChange={e => setRoleFilter(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 14px 9px 38px',
                borderRadius: '12px',
                border: '1px solid #cbd5e1',
                fontSize: '13px',
                outline: 'none',
                backgroundColor: '#ffffff',
                cursor: 'pointer',
                appearance: 'none'
              }}
            >
              <option value="all">Tất cả vai trò</option>
              <option value="Giảng viên">Giảng viên</option>
              <option value="Quản trị viên">Quản trị viên</option>
              <option value="Sinh viên">Sinh viên</option>
            </select>
          </div>
        </div>
      </div>

      {/* 5. NỘI DUNG BẢNG DUYỆT */}
      {categoryTab === 'rooms' ? (
        /* ── BẢNG YÊU CẦU ĐẶT PHÒNG HỌP ── */
        <div style={{ backgroundColor: '#ffffff', borderRadius: '20px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.03)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                <th style={{ padding: '16px 20px', fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>NGƯỜI YÊU CẦU</th>
                <th style={{ padding: '16px 20px', fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>PHÒNG ĐĂNG KÝ</th>
                <th style={{ padding: '16px 20px', fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>THỜI GIAN & NGÀY</th>
                <th style={{ padding: '16px 20px', fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>MỤC ĐÍCH & THIẾT BỊ</th>
                <th style={{ padding: '16px 20px', fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>TRẠNG THÁI</th>
                <th style={{ padding: '16px 20px', fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>THAO TÁC</th>
              </tr>
            </thead>
            <tbody>
              {filteredRoomRequests.length > 0 ? (
                filteredRoomRequests.map(req => (
                  <tr key={req.id} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background-color 0.2s' }} className="hover:bg-slate-50">
                    <td style={{ padding: '16px 20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {req.avatar && req.avatar.startsWith('http') ? (
                          <img src={req.avatar} alt={req.name} style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }} />
                        ) : (
                          <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'linear-gradient(135deg, #3b82f6, #06b6d4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '15px', fontWeight: 'bold', color: 'white', flexShrink: 0 }}>
                            {req.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '14px' }}>{req.name}</div>
                          <div style={{ fontSize: '12px', color: '#64748b' }}>{req.email || req.role}</div>
                          <span style={{ fontSize: '11px', color: '#0284c7', backgroundColor: '#e0f2fe', padding: '1px 6px', borderRadius: '6px', fontWeight: 600 }}>{req.role}</span>
                        </div>
                      </div>
                    </td>

                    <td style={{ padding: '16px 20px' }}>
                      <div style={{ fontWeight: 700, color: '#1e293b', fontSize: '14px' }}>{req.room}</div>
                      <div style={{ fontSize: '12px', color: '#94a3b8' }}>Sức chứa: {req.capacity}</div>
                    </td>

                    <td style={{ padding: '16px 20px' }}>
                      <div style={{ fontWeight: 600, color: '#334155', fontSize: '14px' }}>{req.time}</div>
                      <div style={{ fontSize: '12px', color: '#64748b' }}>{req.date}</div>
                    </td>

                    <td style={{ padding: '16px 20px', maxWidth: '280px' }}>
                      <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {req.reason}
                      </div>
                      {/* Hiển thị thiết bị kèm theo */}
                      {req.equipments && req.equipments.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
                          {req.equipments.map((eq: any, idx: number) => (
                            <span key={idx} style={{ fontSize: '11px', backgroundColor: '#f1f5f9', color: '#475569', padding: '1px 6px', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                              ⚡ {eq.equipment_name || eq.name || 'Thiết bị'}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>

                    <td style={{ padding: '16px 20px' }}>
                      {req.status === 'pending' && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', backgroundColor: '#fef3c7', color: '#b45309', padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 700 }}>
                          <Clock size={13} /> Chờ duyệt
                        </span>
                      )}
                      {req.status === 'approved' && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', backgroundColor: '#dcfce7', color: '#15803d', padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 700 }}>
                          <CheckCircle2 size={13} /> Đã duyệt
                        </span>
                      )}
                      {req.status === 'rejected' && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', backgroundColor: '#fee2e2', color: '#b91c1c', padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 700 }}>
                          <XCircle size={13} /> Đã từ chối
                        </span>
                      )}
                      {req.status === 'cancelled' && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', backgroundColor: '#f1f5f9', color: '#64748b', padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 700 }}>
                          Đã hủy
                        </span>
                      )}
                    </td>

                    <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                        {req.status === 'pending' && (
                          <>
                            <button
                              onClick={() => handleApproveRoom(req)}
                              className="btn-neon-approve"
                              title="Phê duyệt cuộc họp này"
                            >
                              <Check size={18} strokeWidth={2.5} />
                            </button>
                            <button
                              onClick={() => openRejectModal('room', req.id, req.reason)}
                              className="btn-neon-reject"
                              title="Từ chối yêu cầu"
                            >
                              <X size={18} strokeWidth={2.5} />
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => setSelectedRoomReq(req)}
                          className="btn-glass-view"
                          title="Xem chi tiết"
                        >
                          <Eye size={18} />
                        </button>
                        <button
                          onClick={() => handleDeleteRoom(req.id)}
                          title="Xóa đơn này"
                          style={{
                            background: '#fee2e2',
                            border: 'none',
                            borderRadius: '10px',
                            width: '36px',
                            height: '36px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            color: '#dc2626'
                          }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} style={{ padding: '48px', textAlign: 'center', color: '#64748b' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                      <Search size={32} style={{ color: '#cbd5e1' }} />
                      <div style={{ fontSize: '15px', fontWeight: 600 }}>Không tìm thấy yêu cầu đặt phòng nào phù hợp</div>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        /* ── BẢNG YÊU CẦU MƯỢN THIẾT BỊ ── */
        <div style={{ backgroundColor: '#ffffff', borderRadius: '20px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.03)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                <th style={{ padding: '16px 20px', fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>NGƯỜI MƯỢN</th>
                <th style={{ padding: '16px 20px', fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>THIẾT BỊ</th>
                <th style={{ padding: '16px 20px', fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>ĐỊA ĐIỂM SỬ DỤNG</th>
                <th style={{ padding: '16px 20px', fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>THỜI GIAN MƯỢN</th>
                <th style={{ padding: '16px 20px', fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>TRẠNG THÁI</th>
                <th style={{ padding: '16px 20px', fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>THAO TÁC</th>
              </tr>
            </thead>
            <tbody>
              {filteredEquipmentRequests.length > 0 ? (
                filteredEquipmentRequests.map(eq => (
                  <tr key={eq.id} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background-color 0.2s' }} className="hover:bg-slate-50">
                    <td style={{ padding: '16px 20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {eq.requesterAvatar && eq.requesterAvatar.startsWith('http') ? (
                          <img src={eq.requesterAvatar} alt={eq.requesterName} style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }} />
                        ) : (
                          <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'linear-gradient(135deg, #8b5cf6, #ec4899)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '15px', fontWeight: 'bold', color: 'white', flexShrink: 0 }}>
                            {eq.requesterName.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '14px' }}>{eq.requesterName}</div>
                          <div style={{ fontSize: '12px', color: '#64748b' }}>{eq.requesterEmail || eq.requesterRole}</div>
                          <span style={{ fontSize: '11px', color: '#7c3aed', backgroundColor: '#f5f3ff', padding: '1px 6px', borderRadius: '6px', fontWeight: 600 }}>{eq.requesterRole}</span>
                        </div>
                      </div>
                    </td>

                    <td style={{ padding: '16px 20px' }}>
                      <div style={{ fontWeight: 700, color: '#1e293b', fontSize: '14px' }}>{eq.equipmentName}</div>
                      <div style={{ fontSize: '12px', color: '#64748b' }}>
                        Loại: <span style={{ fontWeight: 600 }}>{eq.equipmentType}</span> | SL: <span style={{ fontWeight: 700, color: '#0f172a' }}>{eq.quantity}</span>
                      </div>
                      {eq.equipmentSerial && (
                        <div style={{ fontSize: '11px', color: '#94a3b8' }}>SN: {eq.equipmentSerial}</div>
                      )}
                    </td>

                    <td style={{ padding: '16px 20px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a', backgroundColor: '#f1f5f9', padding: '4px 10px', borderRadius: '8px', display: 'inline-block' }}>
                        📍 {eq.useLocation}
                      </span>
                    </td>

                    <td style={{ padding: '16px 20px' }}>
                      <div style={{ fontWeight: 600, color: '#334155', fontSize: '14px' }}>{eq.time}</div>
                      <div style={{ fontSize: '12px', color: '#64748b' }}>{eq.date}</div>
                    </td>

                    <td style={{ padding: '16px 20px' }}>
                      {eq.status === 'pending' && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', backgroundColor: '#fef3c7', color: '#b45309', padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 700 }}>
                          <Clock size={13} /> Chờ duyệt
                        </span>
                      )}
                      {eq.status === 'approved' && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', backgroundColor: '#dcfce7', color: '#15803d', padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 700 }}>
                          <CheckCircle2 size={13} /> Đang mượn
                        </span>
                      )}
                      {eq.status === 'returned' && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', backgroundColor: '#e0f2fe', color: '#0369a1', padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 700 }}>
                          <CheckCheck size={13} /> Đã trả lại
                        </span>
                      )}
                      {eq.status === 'rejected' && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', backgroundColor: '#fee2e2', color: '#b91c1c', padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 700 }}>
                          <XCircle size={13} /> Đã từ chối
                        </span>
                      )}
                    </td>

                    <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                        {eq.status === 'pending' && (
                          <>
                            <button
                              onClick={() => handleApproveEquipment(eq)}
                              className="btn-neon-approve"
                              title="Phê duyệt mượn thiết bị"
                            >
                              <Check size={18} strokeWidth={2.5} />
                            </button>
                            <button
                              onClick={() => openRejectModal('equipment', eq.id, eq.equipmentName)}
                              className="btn-neon-reject"
                              title="Từ chối yêu cầu"
                            >
                              <X size={18} strokeWidth={2.5} />
                            </button>
                          </>
                        )}
                        {eq.status === 'approved' && (
                          <button
                            onClick={() => handleReturnEquipment(eq)}
                            style={{
                              background: '#e0f2fe',
                              border: '1px solid #7dd3fc',
                              color: '#0369a1',
                              borderRadius: '10px',
                              padding: '6px 12px',
                              fontSize: '12px',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                            title="Xác nhận đã trả thiết bị vào kho"
                          >
                            <RotateCcw size={14} /> Thu hồi
                          </button>
                        )}
                        <button
                          onClick={() => setSelectedEqReq(eq)}
                          className="btn-glass-view"
                          title="Xem chi tiết"
                        >
                          <Eye size={18} />
                        </button>
                        <button
                          onClick={() => handleDeleteEquipment(eq.id)}
                          title="Xóa đơn này"
                          style={{
                            background: '#fee2e2',
                            border: 'none',
                            borderRadius: '10px',
                            width: '36px',
                            height: '36px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            color: '#dc2626'
                          }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} style={{ padding: '48px', textAlign: 'center', color: '#64748b' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                      <Monitor size={32} style={{ color: '#cbd5e1' }} />
                      <div style={{ fontSize: '15px', fontWeight: 600 }}>Không tìm thấy yêu cầu mượn thiết bị nào</div>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
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
                {selectedRoomReq.avatar && selectedRoomReq.avatar.startsWith('http') ? (
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
