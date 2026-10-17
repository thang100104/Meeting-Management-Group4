import { useState, useEffect, Fragment, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  X, Calendar as CalendarIcon, Box, Clock,
  CheckCircle2, AlertCircle, Trash2, Users, Search,
  FileText, MapPin, Info, Zap, Video, CalendarPlus, Check, XCircle, Play, StopCircle,
  Monitor, Mic, Camera
} from 'lucide-react';
import { MOCK_USERS, MOCK_EQUIPMENTS } from '../mockData';

export interface User {
  user_id: number;
  full_name: string;
  email: string;
  department?: { department_name: string };
  role?: { role_name: string };
  avatar_url?: string;
}

export interface Participant {
  user_id: number;
  rsvp_status: 'PENDING' | 'ACCEPTED' | 'DECLINED';
  user: User;
}

export interface Meeting {
  meeting_id: number;
  organizer: User;
  room_id: number;
  room?: { room_name: string; location: string; capacity: number };
  title: string;
  description?: string;
  start_time: string;
  end_time: string;
  meeting_type: 'IN_PERSON' | 'ONLINE' | 'HYBRID';
  meeting_link?: string;
  passcode?: string;
  status: string;
  participants: Participant[];
  equipments: any[];
}

const TIME_SLOTS = [
  "07:00", "08:00", "09:00", "10:00", "11:00",
  "12:00", "13:00", "14:00", "15:00", "16:00", "17:00"
];

// All selectable time options for start/end (every 30 minutes)
const TIME_OPTIONS = [
  "07:00", "07:30", "08:00", "08:30", "09:00", "09:30",
  "10:00", "10:30", "11:00", "11:30", "12:00", "12:30",
  "13:00", "13:30", "14:00", "14:30", "15:00", "15:30",
  "16:00", "16:30", "17:00", "17:30", "18:00", "18:30",
  "19:00", "19:30", "20:00", "20:30", "21:00"
];

const DURATION_PRESETS = [
  { label: "30 phút", minutes: 30 },
  { label: "1 tiếng", minutes: 60 },
  { label: "1.5 tiếng", minutes: 90 },
  { label: "2 tiếng", minutes: 120 },
  { label: "3 tiếng", minutes: 180 },
  { label: "Tùy chỉnh", minutes: 0 },
];

const API_BASE = "http://localhost:8000/api/v1";

interface TimetableGridProps {
  token: string;
  userRole: string;
  currentUserId?: number;
}

function addMinutesToTime(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number);
  const total = h * 60 + m + minutes;
  const newH = Math.floor(total / 60);
  const newM = total % 60;
  if (newH >= 24) return "23:59";
  return `${newH.toString().padStart(2, '0')}:${newM.toString().padStart(2, '0')}`;
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

export default function TimetableGrid({ token, userRole, currentUserId }: TimetableGridProps) {
  const [rooms, setRooms] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  // ===== STATE FOR FULL BOOKING MODAL =====
  const [showBookingModal, setShowBookingModal] = useState(false);
  // Form fields
  const [formRoomId, setFormRoomId] = useState<number | null>(null);
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
  const [formStartTime, setFormStartTime] = useState("08:00");
  const [formEndTime, setFormEndTime] = useState("09:00");
  const [formDurationPreset, setFormDurationPreset] = useState(60);
  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formMeetingType, setFormMeetingType] = useState<"IN_PERSON" | "ONLINE" | "HYBRID">("IN_PERSON");
  const [formParticipantIds, setFormParticipantIds] = useState<number[]>([]);

  // Equipment selection state
  const [availableEquipments, setAvailableEquipments] = useState<any[]>([]);
  const [selectedEquipmentIds, setSelectedEquipmentIds] = useState<number[]>([]);
  const [loadingEquipments, setLoadingEquipments] = useState(false);

  // Participant search state
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [userSearchResults, setUserSearchResults] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const userSearchRef = useRef<HTMLDivElement>(null);

  // Validation & error
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  // State for View Meeting Detail Modal
  const [detailMeeting, setDetailMeeting] = useState<any | null>(null);
  const [actionMsg, setActionMsg] = useState("");

  const [meetingSearch, setMeetingSearch] = useState("");
  const [meetingRoomFilter, setMeetingRoomFilter] = useState<string>("");

  // ===== 1. FETCH ROOMS & BOOKINGS =====
  const fetchData = async () => {
    if (!token) return;

    // Load dynamic rooms from localStorage if available
    let dynamicRooms = [
      { room_id: 1, room_name: 'Phòng Họp 1', location: 'Tầng 1', capacity: 20 },
      { room_id: 2, room_name: 'Phòng Hội Trường', location: 'Tầng 2', capacity: 100 }
    ];
    try {
      const storedRooms = localStorage.getItem('admin_rooms');
      if (storedRooms) {
        const parsed = JSON.parse(storedRooms);
        if (Array.isArray(parsed) && parsed.length > 0) {
          dynamicRooms = parsed?.map((r: any, idx: number) => ({
            room_id: r?.id || r?.room_id || String(idx + 1),
            room_name: r?.name || r?.room_name || `Phòng ${idx + 1}`,
            location: r?.location || r?.building || 'Chưa xác định',
            capacity: r?.capacity || 0,
            status: r?.status || 'active',
            isMaintenance: r?.isMaintenance || false,
            restrictions: r?.restrictions || []
          })) || dynamicRooms;
        }
      }
    } catch (e) { console.error("Error parsing admin_rooms", e); }

    // Load dynamic bookings from localStorage
    let dynamicBookings: any[] = [];
    try {
      const storedBookings = localStorage.getItem('admin_booking_requests');
      if (storedBookings) {
        const parsedBookings = JSON.parse(storedBookings);
        if (Array.isArray(parsedBookings)) {
          dynamicBookings = parsedBookings
            ?.filter((b: any) => b?.date === selectedDate && b?.status === 'approved')
            ?.map((b: any, idx: number) => {
              // Convert "08:00 - 10:00" to start/end times
              let start_time = `${selectedDate}T08:00:00`;
              let end_time = `${selectedDate}T09:00:00`;
              if (b?.timeSlot && b.timeSlot.includes('-')) {
                const parts = b.timeSlot.split('-');
                const s = parts[0]?.trim();
                const e = parts[1]?.trim();
                if (s && e) {
                  start_time = `${selectedDate}T${s}:00`;
                  end_time = `${selectedDate}T${e}:00`;
                }
              }
              return {
                meeting_id: b?.id || idx + 1,
                room_id: b?.roomId || b?.room || b?.roomName,
                title: b?.title || 'Cuộc họp',
                start_time,
                end_time,
                status: b?.status?.toUpperCase() || 'APPROVED',
                meeting_type: 'IN_PERSON',
                organizer: { full_name: b?.requesterName || 'Người dùng', email: '' },
                participants: []
              };
            }) || [];
        }
      }
    } catch (e) { console.error("Error parsing admin_booking_requests", e); }

    // Fallback
    if (dynamicBookings.length === 0) {
      dynamicBookings = [
        {
          meeting_id: 1,
          room_id: dynamicRooms[0]?.room_id || 1,
          title: 'Họp giao ban định kỳ (Mẫu)',
          start_time: `${selectedDate}T08:00:00`,
          end_time: `${selectedDate}T10:00:00`,
          status: 'APPROVED',
          meeting_type: 'IN_PERSON',
          organizer: { full_name: 'Nguyễn Văn A', email: 'nva@ictu.edu.vn' },
          participants: []
        }
      ];
    }

    setRooms(dynamicRooms);
    setBookings(dynamicBookings);
  };

  useEffect(() => {
    fetchData();
  }, [token, selectedDate]);

  // ===== CLICK OUTSIDE to close user dropdown =====
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userSearchRef.current && !userSearchRef.current.contains(e.target as Node)) {
        setShowUserDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ===== 2. OPEN BOOKING MODAL FROM CELL CLICK =====
  const handleCellClick = (roomId: number, time: string, isRestricted: boolean, booking: any) => {
    if (isRestricted) return;

    if (booking) {
      setDetailMeeting(booking);
      setActionMsg("");
      return;
    }
  };

  const openBookingModal = (roomId: number, date: string, startTime: string) => {
    setFormRoomId(roomId);
    setFormDate(date);
    setFormStartTime(startTime);
    setFormDurationPreset(60);
    setFormEndTime(addMinutesToTime(startTime, 60));
    setFormMeetingType("IN_PERSON");
    setFormTitle("");
    setFormDescription("");
    setFormParticipantIds([]);
    setSelectedEquipmentIds([]);
    setFormErrors([]);
    setSuccessMsg("");
    setUserSearchQuery("");
    setUserSearchResults([]);
    setShowBookingModal(true);

    // Fetch equipments for the selected time slot
    fetchEquipments(date, startTime, addMinutesToTime(startTime, 60));
  };

  const closeBookingModal = () => {
    setShowBookingModal(false);
    setFormErrors([]);
    setSuccessMsg("");
  };

  // ===== 3. FETCH AVAILABLE EQUIPMENTS =====
  const fetchEquipments = async (date: string, start: string, end: string) => {
    setLoadingEquipments(true);
    try {
      const startISO = `${date}T${start}:00`;
      const endISO = `${date}T${end}:00`;
      const res = await fetch(
        `${API_BASE}/equipments?from_time=${encodeURIComponent(startISO)}&to_time=${encodeURIComponent(endISO)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) {
        const eqList = await res.json();
        setAvailableEquipments(Array.isArray(eqList) && eqList.length > 0 ? eqList : MOCK_EQUIPMENTS);
      } else {
        setAvailableEquipments(MOCK_EQUIPMENTS);
      }
    } catch (err) {
      console.error("Lỗi lấy danh sách thiết bị rảnh:", err);
      setAvailableEquipments(MOCK_EQUIPMENTS);
    } finally {
      setLoadingEquipments(false);
    }
  };

  // Re-fetch equipments when time changes
  const handleTimeChange = (newStart: string, newEnd: string) => {
    setSelectedEquipmentIds([]);
    fetchEquipments(formDate, newStart, newEnd);
  };

  // ===== 4. HANDLE DURATION PRESETS =====
  const handleDurationPresetChange = (minutes: number) => {
    setFormDurationPreset(minutes);
    if (minutes > 0) {
      const newEnd = addMinutesToTime(formStartTime, minutes);
      setFormEndTime(newEnd);
      handleTimeChange(formStartTime, newEnd);
    }
  };

  const handleStartTimeChange = (newStart: string) => {
    setFormStartTime(newStart);
    if (formDurationPreset > 0) {
      const newEnd = addMinutesToTime(newStart, formDurationPreset);
      setFormEndTime(newEnd);
      handleTimeChange(newStart, newEnd);
    } else {
      handleTimeChange(newStart, formEndTime);
    }
  };

  const handleEndTimeChange = (newEnd: string) => {
    setFormEndTime(newEnd);
    setFormDurationPreset(0); // Switch to custom
    handleTimeChange(formStartTime, newEnd);
  };

  const handleDateChange = (newDate: string) => {
    setFormDate(newDate);
    setSelectedEquipmentIds([]);
    fetchEquipments(newDate, formStartTime, formEndTime);
  };

  // ===== 5. EQUIPMENT TOGGLE =====
  const handleToggleEquipment = (eqId: number) => {
    setSelectedEquipmentIds(prev =>
      prev.includes(eqId) ? prev.filter(id => id !== eqId) : [...prev, eqId]
    );
  };

  // ===== 6. PARTICIPANT SEARCH =====
  const searchUsers = async (query: string) => {
    setUserSearchQuery(query);
    if (query.trim().length < 1) {
      setUserSearchResults([]);
      setShowUserDropdown(false);
      return;
    }
    setLoadingUsers(true);
    setShowUserDropdown(true);
    try {
      const res = await fetch(
        `${API_BASE}/meetings/search-users?q=${encodeURIComponent(query)}&limit=10`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) {
        const users = await res.json();
        const results = Array.isArray(users) && users.length > 0 ? users : MOCK_USERS;
        setUserSearchResults(results.filter((u: any) => !formParticipantIds.includes(u.user_id)));
      } else {
        setUserSearchResults(MOCK_USERS.filter((u: any) => !formParticipantIds.includes(u.user_id)));
      }
    } catch (err) {
      console.error("Lỗi tìm kiếm người dùng:", err);
      setUserSearchResults(MOCK_USERS.filter((u: any) => !formParticipantIds.includes(u.user_id)));
    } finally {
      setLoadingUsers(false);
    }
  };

  const addParticipant = (user: any) => {
    setFormParticipantIds(prev => [...prev, user.user_id]);
    setUserSearchResults(prev => prev.filter(u => u.user_id !== user.user_id));
    // Store user info for display
    setSelectedParticipants(prev => [...prev, user]);
    setUserSearchQuery("");
    setShowUserDropdown(false);
  };

  const [selectedParticipants, setSelectedParticipants] = useState<any[]>([]);

  const removeParticipant = (userId: number) => {
    setFormParticipantIds(prev => prev.filter(id => id !== userId));
    setSelectedParticipants(prev => prev.filter(u => u.user_id !== userId));
  };

  // ===== 7. CLIENT-SIDE VALIDATION =====
  const validateForm = (): string[] => {
    const errors: string[] = [];

    if (!formTitle.trim()) {
      errors.push("Vui lòng nhập tiêu đề cuộc họp.");
    }
    if (!formRoomId) {
      errors.push("Vui lòng chọn phòng họp.");
    }
    if (!formDate) {
      errors.push("Vui lòng chọn ngày họp.");
    }

    const startMin = timeToMinutes(formStartTime);
    const endMin = timeToMinutes(formEndTime);

    if (endMin <= startMin) {
      errors.push("⏰ Giờ kết thúc phải lớn hơn giờ bắt đầu.");
    }

    // Check past time
    const now = new Date();
    const selectedDateTime = new Date(`${formDate}T${formStartTime}:00`);
    if (selectedDateTime < now) {
      errors.push("⚠️ Không thể đặt lịch trong quá khứ. Vui lòng chọn thời gian tương lai.");
    }

    return errors;
  };

  // ===== 8. SUBMIT BOOKING =====
  const handleBooking = async () => {
    const errors = validateForm();
    if (errors.length > 0) {
      setFormErrors(errors);
      return;
    }

    setFormErrors([]);
    setSubmitting(true);
    setSuccessMsg("");

    const start_time = `${formDate}T${formStartTime}:00`;
    const end_time = `${formDate}T${formEndTime}:00`;

    try {
      const res = await fetch(`${API_BASE}/meetings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          room_id: formRoomId,
          title: formTitle,
          description: formDescription,
          start_time,
          end_time,
          meeting_type: formMeetingType,
          participant_ids: formParticipantIds,
          equipment_ids: selectedEquipmentIds
        })
      });

      if (!res.ok) {
        const data = await res.json();
        // Handle structured error from backend
        if (typeof data.detail === 'object' && data.detail.message) {
          setFormErrors([data.detail.message]);
        } else if (typeof data.detail === 'string') {
          setFormErrors([data.detail]);
        } else {
          setFormErrors(["Có lỗi xảy ra khi tạo cuộc họp."]);
        }
        return;
      }

      setSuccessMsg("✅ Đặt phòng họp thành công! Lịch họp đã được tạo.");
      fetchData(); // reload calendar

      // Auto-close after short delay
      setTimeout(() => {
        closeBookingModal();
      }, 1500);
    } catch (_err) {
      setFormErrors(["Lỗi kết nối đến máy chủ. Vui lòng thử lại."]);
    } finally {
      setSubmitting(false);
    }
  };

  // ===== 9. CANCEL MEETING =====
  /*
  const handleCancelMeeting = async (meetingId: number) => {
    if (!window.confirm("Bạn có chắc chắn muốn hủy cuộc họp này và giải phóng tài nguyên phòng + thiết bị?")) return;
    try {
      const res = await fetch(`${API_BASE}/meetings/${meetingId}/cancel`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setDetailMeeting(null);
        fetchData();
      } else {
        const err = await res.json();
        setActionMsg(err.detail || "Không thể hủy cuộc họp");
      }
    } catch (_err) {
      setActionMsg("Lỗi kết nối");
    }
  };
  */

  // ===== 10. LIFECYCLE AND RSVP =====
  const handleStatusUpdate = async (meetingId: number, status: string) => {
    if (status === "CANCELLED" && !window.confirm("Hủy cuộc họp và giải phóng phòng/thiết bị?")) return;
    if (status === "COMPLETED" && !window.confirm("Kết thúc cuộc họp sớm và giải phóng phòng/thiết bị?")) return;
    try {
      const res = await fetch(`${API_BASE}/meetings/${meetingId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        setDetailMeeting(null);
        fetchData();
      } else {
        const err = await res.json();
        setActionMsg(err.detail || "Không thể cập nhật trạng thái");
      }
    } catch (_err) {
      setActionMsg("Lỗi kết nối");
    }
  };

  const handleRSVP = async (meetingId: number, status: string) => {
    try {
      const res = await fetch(`${API_BASE}/meetings/${meetingId}/respond`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        const updatedMeeting = { ...detailMeeting };
        const pIndex = updatedMeeting.participants.findIndex((p: any) => p.user_id === currentUserId);
        if (pIndex !== -1) {
          updatedMeeting.participants[pIndex].rsvp_status = status;
          setDetailMeeting(updatedMeeting);
        }
        fetchData();
      } else {
        const err = await res.json();
        setActionMsg(err.detail || "Không thể cập nhật phản hồi");
      }
    } catch (_err) {
      setActionMsg("Lỗi kết nối");
    }
  };

  const handleDownloadICS = (meeting: any) => {
    const safeStartTime = meeting?.start_time || '';
    const safeEndTime = meeting?.end_time || '';
    const startDate = safeStartTime.includes('T') ? safeStartTime.replace(/[-:]/g, '').split('.')[0] + 'Z' : '';
    const endDate = safeEndTime.includes('T') ? safeEndTime.replace(/[-:]/g, '').split('.')[0] + 'Z' : '';
    const roomName = rooms?.find(r => r?.room_id === meeting?.room_id)?.room_name || '';
    const icsContent = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "BEGIN:VEVENT",
      `DTSTART:${startDate}`,
      `DTEND:${endDate}`,
      `SUMMARY:${meeting.title}`,
      `DESCRIPTION:${meeting.description || ''}${meeting.meeting_link ? '\\n\\nLink họp: ' + meeting.meeting_link : ''}`,
      `LOCATION:${roomName}`,
      "END:VEVENT",
      "END:VCALENDAR"
    ].join('\\n');

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `meeting_${meeting.meeting_id}.ics`;
    a.click();
    window.URL.revokeObjectURL(url);
  };


  // ===== COMPUTED =====
  const selectedRoom = rooms.find(r => r.room_id === formRoomId);
  const isPastWarning = (() => {
    if (!formDate) return false;
    const selected = new Date(formDate);
    selected.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return selected < today;
  })();
  const isTimeInvalid = timeToMinutes(formEndTime) <= timeToMinutes(formStartTime);
  const durationMinutes = timeToMinutes(formEndTime) - timeToMinutes(formStartTime);
  const filteredRooms = rooms.filter(r => meetingRoomFilter ? String(r.room_id) === String(meetingRoomFilter) : true);

  const navigateDay = (offset: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + offset);
    setSelectedDate(d.toISOString().split('T')[0]);
  };
  const setToday = () => {
    setSelectedDate(new Date().toISOString().split('T')[0]);
  };

  return (
    <div className="ledger-container">
      <div className="ledger-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#0f172a', margin: 0 }}>Lịch họp toàn trường</h1>
          <p className="subtitle" style={{ color: '#64748b', marginTop: '4px', fontSize: '14px', margin: '4px 0 0 0' }}>Theo dõi và quản lý mốc thời gian sử dụng phòng họp toàn hệ thống</p>
        </div>

        {/* RIGHT CONTROLS */}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <select
            value={meetingRoomFilter}
            onChange={(e) => setMeetingRoomFilter(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', fontSize: '14px', outline: 'none', cursor: 'pointer', color: '#334155', fontWeight: '500' }}
          >
            <option value="">Tất cả phòng</option>
            {rooms.map(r => (
              <option key={r.room_id} value={r.room_id}>{r.room_name}</option>
            ))}
          </select>

          <div style={{ display: 'flex', alignItems: 'center', backgroundColor: '#f1f5f9', borderRadius: '8px', padding: '4px', border: '1px solid #e2e8f0' }}>
            <button onClick={() => navigateDay(-1)} style={{ padding: '4px 8px', border: 'none', background: 'transparent', cursor: 'pointer', color: '#475569', fontWeight: 'bold' }}>&lt;</button>
            <button onClick={setToday} style={{ padding: '4px 12px', border: 'none', background: '#ffffff', borderRadius: '6px', cursor: 'pointer', color: '#0f172a', fontSize: '13px', fontWeight: '600', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>Hôm nay</button>
            <button onClick={() => navigateDay(1)} style={{ padding: '4px 8px', border: 'none', background: 'transparent', cursor: 'pointer', color: '#475569', fontWeight: 'bold' }}>&gt;</button>
          </div>

          <div style={{ position: 'relative' }}>
            <CalendarIcon size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
            <input
              type="date"
              style={{ width: '150px', padding: '8px 12px 8px 34px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', backgroundColor: '#f8fafc', fontSize: '14px', color: '#334155', fontWeight: '500' }}
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="ledger-grid-wrapper overflow-hidden relative">
        <div
          className="ledger-grid"
          style={{ gridTemplateColumns: `80px repeat(${filteredRooms.length || 1}, minmax(190px, 1fr))` }}
        >
          {/* Header Row */}
          <div className="ledger-col-header-corner"></div>
          {filteredRooms.map(room => {
            const isOccupied = bookings.some(b => {
              if (b.room_id !== room.room_id || b.status === "CANCELLED" || b.status === "COMPLETED") return false;
              const now = new Date();
              const bStart = new Date(b.start_time);
              const bEnd = new Date(b.end_time);
              return now >= bStart && now <= bEnd;
            });

            return (
              <div key={room.room_id} className="ledger-col-header">
                <div className="room-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>{room.room_name}</span>
                  {room.status === 'maintenance' || room.status === 'bảo trì' ? (
                    <span style={{ fontSize: '10px', backgroundColor: '#f1f5f9', color: '#64748b', padding: '2px 6px', borderRadius: '4px', border: '1px solid #e2e8f0', fontWeight: 'bold' }}>🔧 Bảo trì</span>
                  ) : (
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: isOccupied ? '#ef4444' : '#10b981' }} title={isOccupied ? "Đang có cuộc họp" : "Rảnh"}></div>
                  )}
                </div>
                <div className="room-meta" style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                  <div className="room-badge" style={{ backgroundColor: '#f1f5f9', color: '#475569', fontSize: '12px', padding: '4px 8px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>👥 {room.capacity} chỗ</div>
                  <div className="room-badge" style={{ backgroundColor: '#f1f5f9', color: '#475569', fontSize: '12px', padding: '4px 8px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>📍 {room.location}</div>
                </div>
              </div>
            );
          })}

          {/* Grid Rows */}
          {(TIME_SLOTS || []).map(time => {
            const isCurrentHour = new Date().toDateString() === new Date(selectedDate).toDateString() && time.startsWith(new Date().getHours().toString().padStart(2, '0'));
            const currentMinute = new Date().getMinutes();
            const topOffset = (currentMinute / 60) * 100;

            return (
              <Fragment key={time}>
                <div className="ledger-time-label relative border-b border-r border-slate-200/60 flex items-center justify-center text-slate-500 font-medium text-sm h-16">
                  {time}
                  {isCurrentHour && (
                    <div className="absolute left-full z-20 flex items-center" style={{ top: `${topOffset}%`, width: '2000px', pointerEvents: 'none' }}>
                      <div className="w-1.5 h-1.5 rounded-full bg-slate-500 -ml-1 mr-1"></div>
                      <div className="h-px bg-slate-500 w-full opacity-60"></div>
                    </div>
                  )}
                </div>
                {(filteredRooms || []).map(room => {
                  let bookingToRender = null;
                  let isOccupiedByAnother = false;

                  for (const b of (bookings || [])) {
                    if (String(b.room_id) !== String(room.room_id) || b.status === "CANCELLED") continue;

                    if (meetingSearch.trim()) {
                      const term = meetingSearch.toLowerCase();
                      const t1 = b.title.toLowerCase();
                      const t2 = b.organizer?.full_name?.toLowerCase() || "";
                      if (!t1.includes(term) && !t2.includes(term)) continue;
                    }

                    const safeBTime = b?.start_time || '';
                    const bTime = safeBTime.includes('T') ? safeBTime.split('T')[1]?.substring(0, 5) : safeBTime.substring(0, 5);
                    const safeETime = b?.end_time || '';
                    const eTime = safeETime.includes('T') ? safeETime.split('T')[1]?.substring(0, 5) : safeETime.substring(0, 5);

                    const cellTimeMins = timeToMinutes(time);
                    const startMins = timeToMinutes(bTime);
                    const endMins = timeToMinutes(eTime);

                    if (cellTimeMins === startMins) {
                      bookingToRender = b;
                    } else if (cellTimeMins > startMins && cellTimeMins < endMins) {
                      isOccupiedByAnother = true;
                    }
                  }

                  const isMaintenance = room?.status === 'maintenance' || room?.status === 'bảo trì' || room?.isMaintenance;
                  const isRestricted = room?.restrictions?.some((r: any) => r.role_id === 3 && userRole === 'PARTICIPANT');
                  const isInteractable = !bookingToRender && !isOccupiedByAnother && !isRestricted && !isMaintenance;

                  return (
                    <div
                      key={`${room.room_id}-${time}`}
                      className={`ledger-cell h-16 border-b border-r border-slate-200/80 relative p-0 ${((isRestricted || isMaintenance) && !bookingToRender && !isOccupiedByAnother ? 'cursor-not-allowed' : '')}`}
                      style={{
                        ...(isMaintenance && !bookingToRender && !isOccupiedByAnother ? {
                          backgroundImage: 'repeating-linear-gradient(45deg, #f1f5f9 25%, transparent 25%, transparent 50%, #f1f5f9 50%, #f1f5f9 75%, transparent 75%, transparent)',
                          backgroundSize: '10px 10px',
                          backgroundColor: 'rgba(241, 245, 249, 0.7)'
                        } : ((isRestricted && !bookingToRender && !isOccupiedByAnother) ? { backgroundColor: '#f8fafc' } : {}))
                      }}
                    >
                      {isInteractable && (
                        <div 
                          className="w-full h-full text-slate-400 text-xs flex items-center justify-center font-normal select-none"
                        >
                          Trống
                        </div>
                      )}

                      {isMaintenance && !bookingToRender && !isOccupiedByAnother && (
                        <div className="w-full h-full bg-slate-100 text-slate-400 text-xs flex items-center justify-center font-medium cursor-not-allowed select-none">
                          🔧 Bảo trì
                        </div>
                      )}

                      {bookingToRender && (() => {
                        const safeStart = bookingToRender?.start_time || '';
                        const bStart = safeStart.includes('T') ? safeStart.split('T')[1]?.substring(0, 5) || '' : safeStart.substring(0, 5);
                        const safeEnd = bookingToRender?.end_time || '';
                        const bEnd = safeEnd.includes('T') ? safeEnd.split('T')[1]?.substring(0, 5) || '' : safeEnd.substring(0, 5);

                        return (
                          /* Thẻ cuộc họp đã duyệt */
                          <div
                            className="w-full h-full bg-slate-800 text-white p-2 rounded text-xs select-none shadow-sm cursor-pointer hover:bg-slate-700 transition-all overflow-hidden flex flex-col justify-between text-left"
                            onClick={(e) => { e.stopPropagation(); handleCellClick(room?.room_id, time, isRestricted, bookingToRender); }}
                          >
                            <div className="font-semibold text-white truncate" title={bookingToRender?.title || ''}>{bookingToRender?.title || 'Cuộc họp'}</div>
                            <div className="text-[11px] text-slate-300 mt-1">👤 {bookingToRender?.organizer?.full_name || 'Người dùng'}</div>
                            <div className="text-[10px] text-slate-400 mt-0.5">⏰ {bStart} - {bEnd}</div>
                          </div>
                        )
                      })()}
                    </div>
                  );
                })}
              </Fragment>
            );
          })}
        </div>
      </div>

      {/* ============================================================
          MODAL 1: FORM ĐẶT LỊCH HỌP HOÀN CHỈNH (NÂNG CẤP)
          ============================================================ */}
      {showBookingModal && (
        <div className="modal-overlay glass-overlay" onClick={closeBookingModal}>
          <div className="modal-content booking-modal-full glass-modal" onClick={e => e.stopPropagation()}>
            {/* HEADER */}
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <CalendarIcon size={22} />
                <div>
                  <h2>Đăng Ký Đặt Lịch Họp</h2>
                  <span style={{ fontSize: '0.75rem', opacity: 0.8 }}>Điền đầy đủ thông tin để đặt phòng & thiết bị</span>
                </div>
              </div>
              <button className="modal-close" onClick={closeBookingModal}>
                <X size={20} />
              </button>
            </div>

            {/* BODY - 2 COLUMNS */}
            <div className="modal-body booking-modal-body" style={{ maxHeight: '75vh', overflowY: 'auto', padding: '1.5rem', display: 'flex', gap: '1.5rem' }}>
              {/* SUCCESS MESSAGE */}
              {successMsg && (
                <div className="alert alert-success" style={{ marginBottom: '1rem' }}>
                  <CheckCircle2 size={18} /> {successMsg}
                </div>
              )}

              {/* ERROR MESSAGES */}
              {formErrors.length > 0 && (
                <div className="alert alert-danger" style={{ marginBottom: '1rem', flexDirection: 'column', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                    <AlertCircle size={18} /> Vui lòng kiểm tra lại:
                  </div>
                  {formErrors.map((err, i) => (
                    <div key={i} style={{ fontSize: '0.85rem', paddingLeft: '1.5rem' }}>• {err}</div>
                  ))}
                </div>
              )}

              <div className="booking-form-grid">
                {/* ===== LEFT COLUMN: Room, Time, Equipment ===== */}
                <div className="booking-form-col">
                  <div className="form-section-title">
                    <MapPin size={16} /> Phòng họp & Thời gian
                  </div>

                  {/* ROOM SELECTOR */}
                  <div className="form-group">
                    <label className="form-label">Phòng họp <span className="required">*</span></label>
                    <select
                      className="form-input form-select"
                      value={formRoomId || ""}
                      onChange={(e) => setFormRoomId(Number(e.target.value))}
                    >
                      <option value="" disabled>-- Chọn phòng họp --</option>
                      {rooms.map(room => (
                        <option
                          key={room.room_id}
                          value={room.room_id}
                          disabled={room.status !== 'AVAILABLE'}
                        >
                          {room.room_name} ({room.capacity} chỗ) — {room.location}
                          {room.status !== 'AVAILABLE' ? ' [Bảo trì]' : ''}
                        </option>
                      ))}
                    </select>
                    {selectedRoom && (
                      <div className="room-info-chip">
                        <MapPin size={13} />
                        <span>{selectedRoom.room_name} • {selectedRoom.capacity} chỗ • {selectedRoom.location}</span>
                      </div>
                    )}
                  </div>

                  {/* MEETING TYPE */}
                  <div className="form-group">
                    <label className="form-label">Loại cuộc họp <span className="required">*</span></label>
                    <div className="segmented-control">
                      <button
                        type="button"
                        className={`segment-btn ${formMeetingType === 'IN_PERSON' ? 'active' : ''}`}
                        onClick={() => setFormMeetingType('IN_PERSON')}
                      >
                        <MapPin size={16} /> Trực tiếp
                      </button>
                      <button
                        type="button"
                        className={`segment-btn ${formMeetingType === 'ONLINE' ? 'active' : ''}`}
                        onClick={() => setFormMeetingType('ONLINE')}
                      >
                        <Video size={16} /> Trực tuyến
                      </button>
                      <button
                        type="button"
                        className={`segment-btn ${formMeetingType === 'HYBRID' ? 'active' : ''}`}
                        onClick={() => setFormMeetingType('HYBRID')}
                      >
                        <Users size={16} /> Kết hợp
                      </button>
                    </div>
                  </div>

                  {/* DATE */}
                  <div className="form-group">
                    <label className="form-label">Ngày đặt họp <span className="required">*</span></label>
                    <input
                      type="date"
                      className="form-input"
                      value={formDate}
                      onChange={(e) => handleDateChange(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                    />
                  </div>

                  {/* TIME SELECTORS */}
                  <div className="form-group">
                    <label className="form-label">Khung giờ <span className="required">*</span></label>
                    <div className="time-row">
                      <div className="time-field">
                        <label className="time-sub-label">Bắt đầu</label>
                        <select
                          className="form-input form-select"
                          value={formStartTime}
                          onChange={(e) => handleStartTimeChange(e.target.value)}
                        >
                          {TIME_OPTIONS.map(t => (
                            <option key={`s-${t}`} value={t}>{t}</option>
                          ))}
                        </select>
                      </div>
                      <div className="time-separator">→</div>
                      <div className="time-field">
                        <label className="time-sub-label">Kết thúc</label>
                        <select
                          className={`form-input form-select ${isTimeInvalid ? 'input-error' : ''}`}
                          value={formEndTime}
                          onChange={(e) => handleEndTimeChange(e.target.value)}
                        >
                          {TIME_OPTIONS.map(t => (
                            <option key={`e-${t}`} value={t}>{t}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Duration Presets */}
                    <div className="duration-presets" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
                      <span className="duration-label" style={{ alignSelf: 'center', fontWeight: 600, fontSize: '0.85rem' }}>Thời lượng:</span>
                      {DURATION_PRESETS.map(dp => (
                        <button
                          key={dp.minutes}
                          type="button"
                          className={`duration-chip ${formDurationPreset === dp.minutes ? 'active' : ''}`}
                          style={{
                            padding: '0.375rem 0.75rem',
                            borderRadius: '0.5rem',
                            fontSize: '0.875rem',
                            border: `1px solid ${formDurationPreset === dp.minutes ? 'var(--color-primary)' : 'var(--color-gray-300)'}`,
                            backgroundColor: formDurationPreset === dp.minutes ? 'var(--color-primary-light)' : '#fff',
                            color: formDurationPreset === dp.minutes ? 'var(--color-primary-dark)' : 'var(--color-gray-700)',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                          }}
                          onClick={() => handleDurationPresetChange(dp.minutes)}
                        >
                          {dp.label}
                        </button>
                      ))}
                    </div>

                    {/* Time Validation Warnings */}
                    {isTimeInvalid && (
                      <div className="inline-warning">
                        <AlertCircle size={14} /> Giờ kết thúc phải lớn hơn giờ bắt đầu!
                      </div>
                    )}
                    {isPastWarning && !isTimeInvalid && (
                      <div className="inline-warning">
                        <AlertCircle size={14} /> Khung giờ đã chọn nằm trong quá khứ!
                      </div>
                    )}
                    {!isTimeInvalid && !isPastWarning && durationMinutes > 0 && (
                      <div className="inline-info">
                        <Info size={14} /> Thời lượng: {Math.floor(durationMinutes / 60) > 0 ? `${Math.floor(durationMinutes / 60)} giờ ` : ''}{durationMinutes % 60 > 0 ? `${durationMinutes % 60} phút` : ''}
                      </div>
                    )}
                  </div>

                  {/* EQUIPMENT SELECTION */}
                  <div className="form-group">
                    <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span><Box size={14} style={{ display: 'inline', verticalAlign: 'middle' }} /> Thiết bị mượn kèm ({selectedEquipmentIds.length} đã chọn)</span>
                    </label>

                    {loadingEquipments ? (
                      <div className="eq-loading-state">
                        <div className="loading-spinner-sm"></div>
                        Đang kiểm tra tình trạng thiết bị...
                      </div>
                    ) : availableEquipments.length === 0 ? (
                      <div className="alert alert-info" style={{ fontSize: '0.83rem' }}>Không có thiết bị khả dụng.</div>
                    ) : (
                      <div className="equipment-select-list">
                        {/* Fixed equipment in selected room */}
                        {formRoomId && availableEquipments.filter(eq => eq.room_id === formRoomId).length > 0 && (
                          <>
                            <div className="eq-group-title">🏢 Thiết bị cố định tại {selectedRoom?.room_name}</div>
                            <div className="eq-grid-cards" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.625rem' }}>
                              {availableEquipments
                                .filter(eq => eq.room_id === formRoomId)
                                .map(eq => {
                                  const isUnavailable = !eq.is_available_in_slot;
                                  const isChecked = selectedEquipmentIds.includes(eq.equipment_id);
                                  return (
                                    <label
                                      key={eq.equipment_id}
                                      className={`eq-card-item ${isUnavailable ? 'disabled' : ''} ${isChecked ? 'selected' : ''}`}
                                      style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', border: `1px solid ${isChecked ? 'var(--color-primary)' : '#e2e8f0'}`, borderRadius: '8px', cursor: isUnavailable ? 'not-allowed' : 'pointer', background: isChecked ? 'var(--color-primary-light)' : '#fff', opacity: isUnavailable ? 0.5 : 1 }}
                                    >
                                      <input
                                        type="checkbox"
                                        disabled={isUnavailable}
                                        checked={isChecked}
                                        onChange={() => handleToggleEquipment(eq.equipment_id)}
                                        style={{ display: 'none' }}
                                      />
                                      <div className="eq-card-icon" style={{ color: isChecked ? 'var(--color-primary)' : 'var(--color-gray-500)' }}>
                                        {eq.equipment_type === 'PROJECTOR' || eq.equipment_type === 'SCREEN' ? <Monitor size={20} /> :
                                          eq.equipment_type === 'CAMERA' ? <Camera size={20} /> :
                                            eq.equipment_type === 'AUDIO' ? <Mic size={20} /> : <Box size={20} />}
                                      </div>
                                      <div className="eq-card-content" style={{ flex: 1, overflow: 'hidden' }}>
                                        <div className="eq-card-name" style={{ fontWeight: 600, fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{eq.equipment_name}</div>
                                        <div className="eq-card-status" style={{ fontSize: '0.75rem', color: isUnavailable ? 'var(--color-danger)' : 'var(--color-success)' }}>
                                          {isUnavailable ? (eq.status !== 'AVAILABLE' ? eq.status : 'Đã mượn') : 'Sẵn sàng'}
                                        </div>
                                      </div>
                                      {isChecked && <div className="eq-check-icon" style={{ color: 'var(--color-primary)' }}><CheckCircle2 size={16} /></div>}
                                    </label>
                                  );
                                })}
                            </div>
                          </>
                        )}

                        {/* Portable equipment */}
                        {availableEquipments.filter(eq => eq.room_id === null).length > 0 && (
                          <>
                            <div className="eq-group-title" style={{ marginTop: '1rem', fontWeight: 600, fontSize: '0.9rem' }}>📦 Thiết bị di động dùng chung</div>
                            <div className="eq-grid-cards" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.625rem', marginTop: '0.5rem' }}>
                              {availableEquipments.filter(eq => eq.room_id === null).map(eq => {
                                const isUnavailable = !eq.is_available_in_slot;
                                const isChecked = selectedEquipmentIds.includes(eq.equipment_id);
                                return (
                                  <label
                                    key={eq.equipment_id}
                                    className={`eq-card-item ${isUnavailable ? 'disabled' : ''} ${isChecked ? 'selected' : ''}`}
                                    style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', border: `1px solid ${isChecked ? 'var(--color-primary)' : '#e2e8f0'}`, borderRadius: '8px', cursor: isUnavailable ? 'not-allowed' : 'pointer', background: isChecked ? 'var(--color-primary-light)' : '#fff', opacity: isUnavailable ? 0.5 : 1 }}
                                  >
                                    <input
                                      type="checkbox"
                                      disabled={isUnavailable}
                                      checked={isChecked}
                                      onChange={() => handleToggleEquipment(eq.equipment_id)}
                                      style={{ display: 'none' }}
                                    />
                                    <div className="eq-card-icon" style={{ color: isChecked ? 'var(--color-primary)' : 'var(--color-gray-500)' }}>
                                      {eq.equipment_type === 'PROJECTOR' || eq.equipment_type === 'SCREEN' ? <Monitor size={20} /> :
                                        eq.equipment_type === 'CAMERA' ? <Camera size={20} /> :
                                          eq.equipment_type === 'AUDIO' ? <Mic size={20} /> : <Box size={20} />}
                                    </div>
                                    <div className="eq-card-content" style={{ flex: 1, overflow: 'hidden' }}>
                                      <div className="eq-card-name" style={{ fontWeight: 600, fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{eq.equipment_name}</div>
                                      <div className="eq-card-status" style={{ fontSize: '0.75rem', color: isUnavailable ? 'var(--color-danger)' : 'var(--color-success)' }}>
                                        {isUnavailable ? (eq.status !== 'AVAILABLE' ? eq.status : 'Đã mượn') : 'Sẵn sàng'}
                                      </div>
                                    </div>
                                    {isChecked && <div className="eq-check-icon" style={{ color: 'var(--color-primary)' }}><CheckCircle2 size={16} /></div>}
                                  </label>
                                );
                              })}
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* ===== RIGHT COLUMN: Meeting Info, Participants ===== */}
                <div className="booking-form-col">
                  <div className="form-section-title">
                    <FileText size={16} /> Thông tin cuộc họp
                  </div>

                  {/* TITLE */}
                  <div className="form-group">
                    <label className="form-label">Tiêu đề cuộc họp <span className="required">*</span></label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="VD: Họp giao ban tuần, Bảo vệ đồ án tốt nghiệp..."
                      value={formTitle}
                      onChange={e => setFormTitle(e.target.value)}
                      autoFocus
                    />
                  </div>

                  {/* DESCRIPTION */}
                  <div className="form-group">
                    <label className="form-label">Nội dung / Ghi chú</label>
                    <textarea
                      className="form-input"
                      rows={3}
                      placeholder="Mô tả nội dung cuộc họp, agenda, hoặc yêu cầu hỗ trợ kỹ thuật..."
                      value={formDescription}
                      onChange={e => setFormDescription(e.target.value)}
                    ></textarea>
                  </div>

                  {/* PARTICIPANT SEARCH */}
                  <div className="form-group">
                    <label className="form-label">
                      <Users size={14} style={{ display: 'inline', verticalAlign: 'middle' }} /> Mời người tham dự ({formParticipantIds.length})
                    </label>

                    <div className="participant-search-wrapper" ref={userSearchRef}>
                      <div className="search-input-container">
                        <Search size={16} className="search-input-icon" />
                        <input
                          type="text"
                          className="form-input search-input"
                          placeholder="Tìm theo tên hoặc email..."
                          value={userSearchQuery}
                          onChange={(e) => searchUsers(e.target.value)}
                          onFocus={() => userSearchQuery.trim() && setShowUserDropdown(true)}
                        />
                      </div>

                      {/* Search Dropdown */}
                      {showUserDropdown && (
                        <div className="user-search-dropdown">
                          {loadingUsers ? (
                            <div className="user-search-loading">Đang tìm kiếm...</div>
                          ) : userSearchResults.length === 0 ? (
                            <div className="user-search-empty">Không tìm thấy người dùng phù hợp</div>
                          ) : (
                            userSearchResults.map(user => (
                              <div
                                key={user.user_id}
                                className="user-search-item"
                                onClick={() => addParticipant(user)}
                              >
                                <div className="user-search-avatar">
                                  {user.full_name.charAt(0).toUpperCase()}
                                </div>
                                <div className="user-search-info">
                                  <div className="user-search-name">{user.full_name}</div>
                                  <div className="user-search-email">{user.email} • {user.role_name}</div>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>

                    {/* Selected Participants List */}
                    {selectedParticipants.length > 0 && (
                      <div className="selected-participants-list">
                        {selectedParticipants.map(user => (
                          <div key={user.user_id} className="participant-tag">
                            <div className="participant-tag-avatar">
                              {user.full_name.charAt(0).toUpperCase()}
                            </div>
                            <span className="participant-tag-name">{user.full_name}</span>
                            <span className="participant-tag-role">{user.role_name}</span>
                            <button
                              type="button"
                              className="participant-tag-remove"
                              onClick={() => removeParticipant(user.user_id)}
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* SUMMARY PREVIEW */}
                  <div className="booking-summary-preview">
                    <div className="summary-preview-title"><Zap size={14} /> Tóm tắt đặt phòng</div>
                    <div className="summary-preview-row">
                      <span>Phòng:</span>
                      <strong>{selectedRoom?.room_name || '—'}</strong>
                    </div>
                    <div className="summary-preview-row">
                      <span>Ngày:</span>
                      <strong>{formDate}</strong>
                    </div>
                    <div className="summary-preview-row">
                      <span>Giờ:</span>
                      <strong>{formStartTime} → {formEndTime}</strong>
                    </div>
                    <div className="summary-preview-row">
                      <span>Thiết bị:</span>
                      <strong>{selectedEquipmentIds.length} thiết bị</strong>
                    </div>
                    <div className="summary-preview-row">
                      <span>Người tham dự:</span>
                      <strong>{formParticipantIds.length} người</strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* FOOTER */}
            <div className="modal-footer" style={{ borderTop: '1px solid #e2e8f0', paddingTop: '1rem', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', position: 'sticky', bottom: 0, backgroundColor: '#ffffff', zIndex: 10 }}>
              <button className="btn btn-ghost" onClick={closeBookingModal} disabled={submitting}>
                Hủy bỏ
              </button>
              <button
                className="btn btn-primary btn-lg"
                onClick={handleBooking}
                disabled={submitting || isTimeInvalid || !formTitle.trim() || !formRoomId}
              >
                {submitting ? (
                  <>
                    <span className="loading-spinner-sm"></span> Đang xử lý...
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={18} /> Xác nhận Đặt phòng & Thiết bị
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================
          MODAL 2: XEM CHI TIẾT CUỘC HỌP & THIẾT BỊ ĐÃ MƯỢN
          ============================================================ */}
      {detailMeeting && (
        <div className="modal-overlay" onClick={() => setDetailMeeting(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '850px' }}>
            <div className="modal-header">
              <h2>Chi Tiết Lịch Họp (ID: #{detailMeeting.meeting_id})</h2>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn btn-primary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }} onClick={() => handleDownloadICS(detailMeeting)}>
                  <CalendarPlus size={18} style={{ marginRight: '0.3rem' }} /> Thêm vào Lịch
                </button>
                <button className="modal-close" onClick={() => setDetailMeeting(null)}>
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="modal-body" style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '2rem' }}>

              {/* CỘT TRÁI: Thông tin chi tiết */}
              <div className="detail-col-left">
                {actionMsg && (
                  <div className="alert alert-danger" style={{ marginBottom: '1rem' }}>
                    {actionMsg}
                  </div>
                )}

                <h3 style={{ fontSize: '1.2rem', color: 'var(--color-tech-blue)', marginBottom: '0.5rem' }}>
                  {detailMeeting.title}
                </h3>
                <p style={{ color: 'var(--color-gray-600)', marginBottom: '1.25rem', fontSize: '0.9rem' }}>
                  {detailMeeting.description || 'Không có mô tả chi tiết'}
                </p>

                <div className="detail-meta-box">
                  <div className="detail-meta-row">
                    <span className="label">Phòng họp:</span>
                    <span className="value">
                      {rooms.find(r => r.room_id === detailMeeting.room_id)?.room_name || `Phòng #${detailMeeting.room_id}`}
                    </span>
                  </div>
                  <div className="detail-meta-row">
                    <span className="label">Thời gian:</span>
                    <span className="value">
                      {(detailMeeting?.start_time || '').replace('T', ' ')?.substring(0, 16)} ➔ {
                        (detailMeeting?.end_time || '').includes('T')
                          ? (detailMeeting?.end_time || '').split('T')[1]?.substring(0, 5)
                          : (detailMeeting?.end_time || '')?.substring(0, 5)
                      }
                    </span>
                  </div>
                  <div className="detail-meta-row">
                    <span className="label">Người tổ chức:</span>
                    <span className="value" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {detailMeeting.organizer?.avatar_url ? (
                        <img src={detailMeeting.organizer.avatar_url} alt="avatar" style={{ width: '24px', height: '24px', borderRadius: '50%' }} />
                      ) : (
                        <div className="participant-tag-avatar" style={{ width: '24px', height: '24px' }}>
                          {detailMeeting.organizer?.full_name?.charAt(0) || 'U'}
                        </div>
                      )}
                      <span>
                        {detailMeeting.organizer?.full_name || `User #${detailMeeting.organizer_id}`}
                        <span style={{ fontSize: '0.8rem', color: 'var(--color-gray-600)', marginLeft: '0.4rem' }}>
                          - {detailMeeting.organizer?.department?.department_name || 'N/A'}
                        </span>
                      </span>
                    </span>
                  </div>
                  <div className="detail-meta-row">
                    <span className="label">Trạng thái:</span>
                    <span className="badge badge-success">{detailMeeting.status}</span>
                  </div>

                  {/* Meeting Link */}
                  {(detailMeeting.meeting_type === 'ONLINE' || detailMeeting.meeting_type === 'HYBRID') && detailMeeting.meeting_link && (
                    <div className="detail-meta-row" style={{ backgroundColor: '#eff6ff', padding: '0.75rem', borderRadius: '8px', marginTop: '0.5rem' }}>
                      <span className="label" style={{ color: 'var(--color-tech-blue)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <Video size={16} /> Link họp:
                      </span>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
                        <a href={detailMeeting.meeting_link} target="_blank" rel="noreferrer" style={{ wordBreak: 'break-all', fontWeight: 600 }}>
                          {detailMeeting.meeting_link}
                        </a>
                        {detailMeeting.passcode && (
                          <div style={{ fontSize: '0.85rem' }}>Passcode: <strong>{detailMeeting.passcode}</strong></div>
                        )}
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <a href={detailMeeting.meeting_link} target="_blank" rel="noreferrer" className="btn btn-primary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.3rem', background: 'linear-gradient(to right, #8b5cf6, #3b82f6)', border: 'none' }}>
                            <Video size={14} /> Tham gia Online
                          </a>
                          <button className="btn btn-ghost" style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }} onClick={() => navigator.clipboard.writeText(detailMeeting.meeting_link)}>
                            Sao chép
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Danh sách thiết bị đã mượn kèm */}
                <div style={{ marginTop: '1.25rem' }}>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Box size={16} /> Thiết bị đã mượn kèm ({detailMeeting.equipments?.length || 0}):
                  </div>
                  {(!detailMeeting.equipments || detailMeeting.equipments.length === 0) ? (
                    <div style={{ fontSize: '0.85rem', color: 'var(--color-gray-500)', fontStyle: 'italic' }}>
                      Cuộc họp này không đăng ký mượn thêm thiết bị nào.
                    </div>
                  ) : (
                    <div className="detail-eq-list">
                      {detailMeeting.equipments.map((eq: any) => (
                        <div key={eq.equipment_id} className="detail-eq-item">
                          <CheckCircle2 size={16} color="var(--color-tech-blue)" />
                          <div>
                            <div style={{ fontWeight: 500 }}>{eq.equipment_name}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--color-gray-600)' }}>
                              Loại: {eq.equipment_type} | Serial: {eq.serial_number || 'N/A'}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* CỘT PHẢI: QR Code & Người tham dự */}
              <div className="detail-col-right" style={{ borderLeft: '1px solid #e2e8f0', paddingLeft: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

                {/* QR Code Block */}
                <div style={{ textAlign: 'center', padding: '1.5rem', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                  <div style={{ marginBottom: '1rem', fontWeight: 600, color: '#334155', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
                    <MapPin size={18} color="#3b82f6" /> Quét mã để Điểm danh
                  </div>
                  <div style={{ background: 'white', padding: '1rem', borderRadius: '12px', display: 'inline-block', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
                    <QRCodeSVG value={`https://ictu.edu.vn/checkin/${detailMeeting.meeting_id}`} size={160} />
                  </div>
                  <div style={{ marginTop: '0.75rem', fontSize: '0.75rem', color: '#64748b' }}>
                    Mã check-in: <strong>{detailMeeting.meeting_id.toString().padStart(6, '0')}</strong>
                  </div>
                </div>

                {/* Participants Block */}
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.4rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem' }}>
                    <Users size={16} /> Người tham dự ({detailMeeting.participants?.length || 0})
                  </div>

                  {(!detailMeeting.participants || detailMeeting.participants.length === 0) ? (
                    <div style={{ fontSize: '0.85rem', color: 'var(--color-gray-500)', fontStyle: 'italic', textAlign: 'center', padding: '1rem' }}>
                      Không có người tham dự
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', maxHeight: '300px', overflowY: 'auto', paddingRight: '0.5rem' }}>
                      {detailMeeting.participants.map((p: any) => (
                        <div key={p.participant_id} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.5rem', backgroundColor: 'white', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                          <div className="participant-tag-avatar" style={{ width: '28px', height: '28px', fontSize: '0.8rem' }}>
                            {p.user?.full_name?.charAt(0) || 'U'}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '0.85rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.user?.full_name}</div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--color-gray-500)' }}>{p.user?.department?.department_name || p.user?.email}</div>
                          </div>
                          <span style={{
                            fontSize: '0.65rem', padding: '0.25rem 0.5rem', borderRadius: '99px', fontWeight: 700, textTransform: 'uppercase',
                            backgroundColor: p.rsvp_status === 'ACCEPTED' ? '#dcfce7' : p.rsvp_status === 'DECLINED' ? '#fee2e2' : '#f1f5f9',
                            color: p.rsvp_status === 'ACCEPTED' ? '#166534' : p.rsvp_status === 'DECLINED' ? '#991b1b' : '#475569'
                          }}>
                            {p.rsvp_status}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>
            </div>

            <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {/* RSVP cho Người tham dự */}
                {detailMeeting.participants?.some((p: any) => p.user_id === currentUserId) && detailMeeting.status !== 'CANCELLED' && detailMeeting.status !== 'COMPLETED' && (
                  <>
                    <button className="btn btn-primary" style={{ backgroundColor: '#16a34a', borderColor: '#15803d' }} onClick={() => handleRSVP(detailMeeting.meeting_id, 'ACCEPTED')}>
                      <Check size={16} /> Đồng ý tham gia
                    </button>
                    <button className="btn btn-ghost" style={{ color: '#ef4444', borderColor: '#fca5a5' }} onClick={() => handleRSVP(detailMeeting.meeting_id, 'DECLINED')}>
                      <XCircle size={16} /> Từ chối
                    </button>
                  </>
                )}

                {/* Vòng đời cho Organizer / Admin */}
                {(userRole === 'ADMIN' || currentUserId === detailMeeting.organizer_id) && (
                  <>
                    {detailMeeting.status === 'SCHEDULED' && (
                      <button className="btn btn-primary" style={{ backgroundColor: '#16a34a', borderColor: '#15803d' }} onClick={() => handleStatusUpdate(detailMeeting.meeting_id, 'IN_PROGRESS')}>
                        <Play size={16} /> Bắt đầu cuộc họp
                      </button>
                    )}
                    {detailMeeting.status === 'IN_PROGRESS' && (
                      <button className="btn btn-primary" style={{ backgroundColor: '#4b5563', borderColor: '#374151' }} onClick={() => handleStatusUpdate(detailMeeting.meeting_id, 'COMPLETED')}>
                        <StopCircle size={16} /> Kết thúc cuộc họp
                      </button>
                    )}
                    {(detailMeeting.status === 'SCHEDULED' || detailMeeting.status === 'IN_PROGRESS') && (
                      <button className="btn btn-ghost" style={{ color: '#ef4444', borderColor: '#fca5a5' }} onClick={() => handleStatusUpdate(detailMeeting.meeting_id, 'CANCELLED')}>
                        <Trash2 size={16} /> Hủy cuộc họp
                      </button>
                    )}
                  </>
                )}
              </div>
              <button className="btn btn-primary" onClick={() => setDetailMeeting(null)}>Đóng</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
