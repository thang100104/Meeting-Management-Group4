import React, { useState, useEffect } from 'react';
import { 
  Search, Plus, Grid, List, MapPin, Users,
  Monitor, Calendar, Edit, MoreVertical,
  CheckCircle, Clock, AlertTriangle, Image as ImageIcon,
  X, Upload, Trash2, User,
  Tv, Mic, Volume2, Video, Laptop, Wind, Wifi, Check
} from 'lucide-react';
import api from '../services/api';

const presetImages = [
  'https://images.unsplash.com/photo-1571624436279-b272aff752b5?auto=format&fit=crop&q=80&w=600', // Modern meeting room
  'https://images.unsplash.com/photo-1505373877841-8d25f7d46678?auto=format&fit=crop&q=80&w=600', // Hall / Auditorium
  'https://images.unsplash.com/photo-1516321497487-e288fb19713f?auto=format&fit=crop&q=80&w=600', // Tech/PC room
  'https://images.unsplash.com/photo-1542744173-8e7e53415bb0?auto=format&fit=crop&q=80&w=600', // Creative Space
  'https://images.unsplash.com/photo-1524178232363-1fb2b075b655?auto=format&fit=crop&q=80&w=600', // Training
  'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&q=80&w=600'  // Small Meeting room
];

const standardDevices = [
  'Máy chiếu 4K Sony',
  'Micro không dây Shure',
  'Bảng tương tác thông minh',
  'Loa hội trường JBL',
  'Bộ camera họp trực tuyến Logitech',
  'Laptop trình chiếu',
  'Điều hòa trung tâm',
  'Wifi 6 High-Speed'
];

interface Room {
  id: string;
  name: string;
  building: string;
  floor: string;
  capacity: number;
  type: string;
  status: string; // 'Sẵn sàng' | 'Đang họp' | 'Bảo trì' (Base state saved in DB)
  image: string;
  equipment: string[];
}

interface BookingRequest {
  id: string;
  roomId: string;
  roomName: string;
  requesterName: string;
  requesterRole: string;
  title: string;
  date: string;
  timeSlot: string;
  status: 'pending' | 'approved' | 'rejected';
}

const mockRooms: Room[] = [
  {
    id: 'R01',
    name: 'Phòng họp VIP A1',
    building: 'Tòa A',
    floor: 'Tầng 2',
    capacity: 20,
    type: 'VIP',
    status: 'Sẵn sàng',
    image: presetImages[0],
    equipment: ['Máy chiếu 4K Sony', 'Bộ camera họp trực tuyến Logitech', 'Điều hòa trung tâm', 'Wifi 6 High-Speed'],
  },
  {
    id: 'R02',
    name: 'Phòng Hội trường B1',
    building: 'Tòa B',
    floor: 'Tầng 1',
    capacity: 200,
    type: 'Hội trường',
    status: 'Sẵn sàng',
    image: presetImages[1],
    equipment: ['Máy chiếu 4K Sony', 'Loa hội trường JBL', 'Micro không dây Shure', 'Điều hòa trung tâm'],
  },
  {
    id: 'R03',
    name: 'Phòng Lab Máy tính B02',
    building: 'Tòa Lab',
    floor: 'Tầng 3',
    capacity: 50,
    type: 'Lab',
    status: 'Sẵn sàng',
    image: presetImages[2],
    equipment: ['Laptop trình chiếu', 'Bảng tương tác thông minh', 'Điều hòa trung tâm', 'Wifi 6 High-Speed'],
  },
  {
    id: 'R04',
    name: 'Phòng Sáng tạo C3',
    building: 'Tòa C',
    floor: 'Tầng 4',
    capacity: 10,
    type: 'Creative',
    status: 'Bảo trì',
    image: presetImages[3],
    equipment: ['Bảng tương tác thông minh', 'Wifi 6 High-Speed', 'Điều hòa trung tâm'],
  },
  {
    id: 'R05',
    name: 'Phòng Đào tạo A4',
    building: 'Tòa A',
    floor: 'Tầng 4',
    capacity: 40,
    type: 'Training',
    status: 'Sẵn sàng',
    image: presetImages[4],
    equipment: ['Máy chiếu 4K Sony', 'Micro không dây Shure', 'Laptop trình chiếu', 'Wifi 6 High-Speed'],
  },
  {
    id: 'R06',
    name: 'Phòng Họp Nhỏ C1',
    building: 'Tòa C',
    floor: 'Tầng 2',
    capacity: 6,
    type: 'Meeting',
    status: 'Sẵn sàng',
    image: presetImages[5],
    equipment: ['Bảng tương tác thông minh', 'Bộ camera họp trực tuyến Logitech', 'Wifi 6 High-Speed'],
  },
];

const TIME_SLOTS = [
  '08:00 - 10:00',
  '10:00 - 12:00',
  '13:00 - 15:00',
  '15:00 - 17:00',
  '17:00 - 19:00'
];

const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=800&q=80';

const getTodayString = () => new Date().toISOString().split('T')[0];

const getCurrentTimeString = () => {
  const now = new Date();
  return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
};

// Map Device Names to Icons
const getDeviceIcon = (name: string) => {
  const n = name.toLowerCase();
  if (n.includes('máy chiếu') || n.includes('projector') || n.includes('tv')) return Tv;
  if (n.includes('micro') || n.includes('mic')) return Mic;
  if (n.includes('bảng') || n.includes('monitor') || n.includes('màn hình')) return Monitor;
  if (n.includes('loa') || n.includes('âm thanh')) return Volume2;
  if (n.includes('camera') || n.includes('video')) return Video;
  if (n.includes('laptop') || n.includes('pc') || n.includes('máy tính')) return Laptop;
  if (n.includes('điều hòa') || n.includes('quạt')) return Wind;
  if (n.includes('wifi') || n.includes('mạng') || n.includes('lan')) return Wifi;
  return Monitor; // fallback
};

// ----------------------------------------------------------------------
// API Integration Helpers
// ----------------------------------------------------------------------

const API_BASE = "http://localhost:8000/api/v1";

const getToken = (): string | null => {
  return (
    sessionStorage.getItem('access_token') ||
    localStorage.getItem('access_token') ||
    sessionStorage.getItem('token') ||
    localStorage.getItem('token') ||
    null
  );
};

// Map backend RoomOut -> frontend Room interface
const mapApiRoomToFrontend = (apiRoom: any): Room => {
  const locationStr = apiRoom.location || '';
  const parts = locationStr.split(',').map((p: string) => p.trim());
  let floor = '';
  let building = '';
  parts.forEach((p: string) => {
    if (p.toLowerCase().includes('tầng') || p.toLowerCase().includes('tang')) {
      floor = p;
    } else {
      building = p.replace(/tòa nhà /i, 'Tòa ').replace(/^tòa /i, 'Tòa ');
    }
  });
  if (!floor && parts.length > 0) floor = parts[0];
  if (!building && parts.length > 1) building = parts[1];

  const equipment = apiRoom.equipments
    ? apiRoom.equipments.split(',').map((e: string) => e.trim()).filter(Boolean)
    : [];

  let status = 'Sẵn sàng';
  if (apiRoom.status === 'MAINTENANCE') status = 'Bảo trì';

  return {
    id: String(apiRoom.room_id),
    name: apiRoom.room_name || apiRoom.name || '',
    building: building || locationStr || '',
    floor: floor || 'Tầng 1',
    capacity: apiRoom.capacity || 10,
    type: apiRoom.description || 'Meeting',
    status,
    image: apiRoom.image_url || '',
    equipment
  };
};

// Map frontend Room -> backend API request body
const mapFrontendRoomToApi = (room: Room) => {
  const location = room.floor && room.building
    ? `${room.floor}, ${room.building}`
    : (room.building || room.floor || '');
  return {
    room_name: room.name,
    capacity: room.capacity,
    location: location || 'Chưa xác định',
    status: room.status === 'Sẵn sàng' ? 'AVAILABLE' : (room.status === 'Bảo trì' ? 'MAINTENANCE' : 'AVAILABLE'),
    description: room.type || '',
    image_url: room.image || '',
    equipments: room.equipment.join(', ')
  };
};

// Fetch rooms from backend API
const fetchRoomsFromAPI = async (): Promise<Room[]> => {
  const token = getToken();
  if (!token) return [];
  try {
    const res = await fetch(`${API_BASE}/rooms`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) return [];
    const data = await res.json();
    if (Array.isArray(data) && data.length > 0) {
      return data.map(mapApiRoomToFrontend);
    }
    return [];
  } catch {
    return [];
  }
};

// Save room to backend API (create or update)
const saveRoomToAPI = async (room: Room, isNew: boolean): Promise<any> => {
  const token = getToken();
  if (!token) throw new Error('No token');
  const payload = mapFrontendRoomToApi(room);
  const url = isNew ? `${API_BASE}/rooms` : `${API_BASE}/rooms/${room.id}`;
  const res = await fetch(url, {
    method: isNew ? 'POST' : 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
};

// Delete room via API
const deleteRoomFromAPI = async (roomId: string): Promise<void> => {
  const token = getToken();
  if (!token) throw new Error('No token');
  const res = await fetch(`${API_BASE}/rooms/${roomId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
};

// ----------------------------------------------------------------------
// Load Data Functions
// ----------------------------------------------------------------------
const getInitialBookings = (): BookingRequest[] => {
  const saved = localStorage.getItem('admin_booking_requests');
  if (saved) {
    try { return JSON.parse(saved); } catch (e) { return []; }
  }
  
  const today = getTodayString();
  const mockBookings: BookingRequest[] = [
    {
      id: 'BK001',
      roomId: 'R02',
      roomName: 'Phòng Hội trường B1',
      requesterName: 'Nguyễn Văn A',
      requesterRole: 'Giảng viên',
      title: 'Hội thảo Công nghệ 2024',
      date: today,
      timeSlot: '13:00 - 15:00',
      status: 'approved'
    },
    {
      id: 'BK002',
      roomId: 'R02',
      roomName: 'Phòng Hội trường B1',
      requesterName: 'Nguyễn Văn A',
      requesterRole: 'Giảng viên',
      title: 'Hội thảo Công nghệ 2024 (Tiếp)',
      date: today,
      timeSlot: '15:00 - 17:00',
      status: 'approved'
    },
    {
      id: 'BK003',
      roomId: 'R05',
      roomName: 'Phòng Đào tạo A4',
      requesterName: 'Trần Thị B',
      requesterRole: 'Sinh viên',
      title: 'Sinh hoạt CLB IT',
      date: today,
      timeSlot: '08:00 - 10:00',
      status: 'approved'
    }
  ];
  localStorage.setItem('admin_booking_requests', JSON.stringify(mockBookings));
  return mockBookings;
};

const getInitialDevices = () => {
  const saved = localStorage.getItem('admin_devices');
  if (saved) {
    try { return JSON.parse(saved); } catch (e) { return []; }
  }
  const mockDevices = [
    { id: 'D01', name: 'Máy chiếu 4K Sony' },
    { id: 'D02', name: 'Micro không dây Shure' },
    { id: 'D03', name: 'Bảng tương tác thông minh' },
    { id: 'D04', name: 'Loa hội trường JBL' },
    { id: 'D05', name: 'Bộ camera họp trực tuyến Logitech' },
    { id: 'D06', name: 'Laptop trình chiếu' },
    { id: 'D07', name: 'Điều hòa trung tâm' },
    { id: 'D08', name: 'Wifi 6 High-Speed' },
  ];
  localStorage.setItem('admin_devices', JSON.stringify(mockDevices));
  return mockDevices;
};

// ----------------------------------------------------------------------
// Dynamic Resolver
// ----------------------------------------------------------------------
const getRoomStatusAndCurrentEvent = (room: Room, bookingRequests: BookingRequest[]) => {
  if (room.status === 'Bảo trì') {
    return { status: 'Bảo trì', currentEvent: null };
  }

  const today = getTodayString();
  const currentTime = getCurrentTimeString();

  const activeBooking = bookingRequests.find(req => {
    if ((req.roomId === room.id || req.roomName === room.name) && req.date === today && req.status === 'approved' && req.timeSlot) {
      const [start, end] = req.timeSlot.split(' - ');
      return currentTime >= start && currentTime <= end;
    }
    return false;
  });

  if (activeBooking) {
    return {
      status: 'Đang họp',
      currentEvent: { 
        title: activeBooking.title, 
        time: activeBooking.timeSlot, 
        requester: activeBooking.requesterName 
      }
    };
  }

  if (room.status === 'Đang họp') {
    return { 
      status: 'Đang họp', 
      currentEvent: { title: 'Cuộc họp đột xuất', time: 'Đang diễn ra', requester: 'Admin' } 
    };
  }

  return { status: 'Sẵn sàng', currentEvent: null };
};


const RoomsView: React.FC = () => {
  const [rooms, setRooms] = useState<Room[]>(() => {
    const saved = localStorage.getItem('admin_rooms');
    if (saved) {
      try { 
        const parsed: Room[] = JSON.parse(saved);
        
        // Automatic Data Migration: check for legacy fields or missing images
        const hasLegacyData = parsed.some(r => 
          !r.image || 
          r.image.trim() === '' || 
          r.equipment.some(eq => !standardDevices.includes(eq))
        );
        
        if (hasLegacyData) {
          console.warn("Detected old room data format. Cleaning up localStorage and migrating to new standards...");
          localStorage.setItem('admin_rooms', JSON.stringify(mockRooms));
          return mockRooms;
        }
        
        return parsed; 
      } catch (e) { 
        return mockRooms; 
      }
    }
    return mockRooms;
  });

  const [bookingRequests, setBookingRequests] = useState<BookingRequest[]>(getInitialBookings);
  const [deviceList, setDeviceList] = useState<any[]>(getInitialDevices);

  // Persist rooms to localStorage whenever they change (cache for same-tab offline)
  useEffect(() => {
    localStorage.setItem('admin_rooms', JSON.stringify(rooms));
  }, [rooms]);

  // Fetch rooms from backend API + set up polling for real-time sync
  useEffect(() => {
    const loadFromAPI = async () => {
      const apiRooms = await fetchRoomsFromAPI();
      if (apiRooms.length > 0) {
        setRooms(apiRooms);
        localStorage.setItem('admin_rooms', JSON.stringify(apiRooms));
      }
      // If API returns no data (empty server DB), keep localStorage/mock data
    };

    loadFromAPI();

    // Poll every 30 seconds for real-time sync between admin and user
    const pollInterval = setInterval(loadFromAPI, 30000);

    // Also listen for localStorage changes (same-origin cross-tab sync)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'admin_booking_requests' && e.newValue) {
        setBookingRequests(JSON.parse(e.newValue));
      }
      if (e.key === 'admin_devices' && e.newValue) {
        setDeviceList(JSON.parse(e.newValue));
      }
      if (e.key === 'admin_rooms' && e.newValue) {
        try {
          const parsedRooms = JSON.parse(e.newValue);
          setRooms(parsedRooms);
        } catch { }
      }
    };
    window.addEventListener('storage', handleStorageChange);

    // Listen for custom appDataSync events (same-tab dispatch)
    const handleAppDataSync = () => {
      loadFromAPI();
    };
    window.addEventListener('appDataSync', handleAppDataSync);

    return () => {
      clearInterval(pollInterval);
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('appDataSync', handleAppDataSync);
    };
  }, []);

  (window as any).roomsApi = { fetchRoomsFromAPI };

  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBuilding, setSelectedBuilding] = useState('All');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('All');
  
  // Menu State
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  useEffect(() => {
    const handleClickOutside = () => setActiveMenuId(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [formData, setFormData] = useState<Partial<Room>>({
    name: '', id: '', building: 'Tòa A', floor: '', capacity: 10, status: 'Sẵn sàng', equipment: [], image: ''
  });
  const [imageInputMode, setImageInputMode] = useState<'upload' | 'preset' | 'url'>('preset');

  // Schedule Modal State
  const [selectedRoomForSchedule, setSelectedRoomForSchedule] = useState<Room | null>(null);
  const [scheduleDate, setScheduleDate] = useState(() => getTodayString());

  const handleOpenAdd = () => {
    setModalMode('add');
    setFormData({
      name: '', id: '', building: 'Tòa A', floor: '', capacity: 10, status: 'Sẵn sàng', equipment: [], image: ''
    });
    setImageInputMode('preset');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (room: Room) => {
    setModalMode('edit');
    setFormData(room);
    setImageInputMode('preset');
    setIsModalOpen(true);
  };

  const handleQuickStatusChange = async (id: string, status: string) => {
    // Optimistic update for immediate UI feedback
    setRooms(prev => prev.map(r => r.id === id ? { ...r, status } : r));
    setActiveMenuId(null);

    // Persist to backend API
    const room = rooms.find(r => r.id === id);
    if (room) {
      try {
        await saveRoomToAPI({ ...room, status }, false);
        // Sync event for same-tab and cross-tab listeners
        window.dispatchEvent(new Event('appDataSync'));
        window.dispatchEvent(new Event('roomsUpdated'));
        window.dispatchEvent(new Event('storage'));
      } catch (err: any) {
        console.error("Failed to sync room status to API:", err.message);
        // Revert optimistic update on failure
        setRooms(prev => prev.map(r => r.id === id ? { ...r, status: room.status } : r));
        alert(`Lỗi cập nhật trạng thái: ${err.message}`);
      }
    }
  };

  const handleQuickDelete = async (id: string, name: string) => {
    if (window.confirm(`Bạn có chắc chắn muốn xóa phòng ${name} không?`)) {
      try {
        await deleteRoomFromAPI(id);
        setRooms(prev => prev.filter(r => r.id !== id));
        setActiveMenuId(null);
        window.dispatchEvent(new Event('appDataSync'));
        window.dispatchEvent(new Event('roomsUpdated'));
        window.dispatchEvent(new Event('storage'));
      } catch (err: any) {
        console.error("Failed to delete room via API:", err.message);
        alert(`Lỗi xóa phòng: ${err.message}`);
      }
    }
  };

  const handleEquipmentToggle = (eq: string) => {
    setFormData(prev => {
      const current = prev.equipment || [];
      if (current.includes(eq)) {
        return { ...prev, equipment: current.filter(e => e !== eq) };
      } else {
        return { ...prev, equipment: [...current, eq] };
      }
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, image: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    const roomToSave: Room = {
      id: formData.id || `R0${rooms.length + 1}`,
      name: formData.name || 'Phòng mới',
      building: formData.building || 'Tòa A',
      floor: formData.floor || 'Tầng 1',
      capacity: Number(formData.capacity) || 10,
      type: formData.type || 'Meeting',
      status: formData.status || 'Sẵn sàng',
      image: formData.image || FALLBACK_IMAGE,
      equipment: formData.equipment || [],
    };

    const isNew = modalMode === 'add';
    const prevRooms = rooms;

    // Optimistic update
    if (isNew) {
      setRooms(prev => [roomToSave, ...prev]);
    } else {
      setRooms(prev => prev.map(r => r.id === roomToSave.id ? roomToSave : r));
    }
    setIsModalOpen(false);

    // Persist to backend API
    try {
      const apiResult = await saveRoomToAPI(roomToSave, isNew);
      // If creating new room, update local id with server-generated id
      if (isNew && apiResult) {
        const serverRoom = mapApiRoomToFrontend(apiResult);
        setRooms(prev => prev.map(r => r.id === roomToSave.id ? serverRoom : r));
        localStorage.setItem('admin_rooms', JSON.stringify(
          prevRooms.map(r => r.id === roomToSave.id ? serverRoom : r)
        ));
      }
      window.dispatchEvent(new Event('appDataSync'));
      window.dispatchEvent(new Event('roomsUpdated'));
      window.dispatchEvent(new Event('storage'));
    } catch (err: any) {
      console.error("Failed to save room via API:", err.message);
      // Revert optimistic update on failure
      setRooms(prevRooms);
      alert(`Lỗi lưu phòng: ${err.message}`);
    }
  };

  const filteredRooms = rooms.filter(room => {
    const { status: dynamicStatus } = getRoomStatusAndCurrentEvent(room, bookingRequests);

    const matchesSearch = room.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          room.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesBuilding = selectedBuilding === 'All' || room.building === selectedBuilding;
    
    let matchesStatus = true;
    if (selectedStatusFilter === 'available') matchesStatus = dynamicStatus === 'Sẵn sàng';
    else if (selectedStatusFilter === 'occupied') matchesStatus = dynamicStatus === 'Đang họp';
    else if (selectedStatusFilter === 'maintenance') matchesStatus = dynamicStatus === 'Bảo trì';

    return matchesSearch && matchesBuilding && matchesStatus;
  });

  // Calculate dynamic KPIs
  let totalRooms = rooms.length;
  let availableRooms = 0;
  let occupiedRooms = 0;
  let maintenanceRooms = 0;

  rooms.forEach(room => {
    const { status: dStatus } = getRoomStatusAndCurrentEvent(room, bookingRequests);
    if (dStatus === 'Sẵn sàng') availableRooms++;
    else if (dStatus === 'Đang họp') occupiedRooms++;
    else if (dStatus === 'Bảo trì') maintenanceRooms++;
  });

  return (
    <div style={{ padding: '28px', backgroundColor: '#f8fafc', minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif', position: 'relative' }}>
      
      {/* HEADER & NÚT THÊM PHÒNG */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#0f172a', margin: 0 }}>Quản lý Phòng họp</h1>
          <p style={{ color: '#64748b', marginTop: '4px', fontSize: '14px', margin: '4px 0 0 0' }}>Theo dõi, quản lý và điều phối hệ thống không gian họp.</p>
        </div>
        <button 
          onClick={handleOpenAdd}
          style={{ background: 'linear-gradient(to right, #2563eb, #3b82f6)', color: '#ffffff', padding: '12px 24px', borderRadius: '12px', border: 'none', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)', transition: 'all 0.2s' }}>
          <Plus size={18} />
          <span>Thêm phòng mới</span>
        </button>
      </div>



      {/* FILTER BAR */}
      <div style={{ backgroundColor: '#ffffff', padding: '20px', borderRadius: '20px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center', marginBottom: '28px' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
          <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input 
            type="text" 
            placeholder="Tìm theo tên, mã phòng..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: '100%', boxSizing: 'border-box', padding: '10px 16px 10px 40px', borderRadius: '12px', border: '1px solid #cbd5e1', outline: 'none', backgroundColor: '#f8fafc', fontSize: '14px', transition: 'all 0.2s' }}
          />
        </div>
        <select 
          value={selectedBuilding}
          onChange={(e) => setSelectedBuilding(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', fontSize: '14px', outline: 'none', cursor: 'pointer' }}
        >
          <option value="All">Tất cả tòa nhà</option>
          <option value="Tòa A">Tòa A</option>
          <option value="Tòa B">Tòa B</option>
          <option value="Tòa C">Tòa C</option>
          <option value="Tòa Lab">Tòa Lab</option>
        </select>
        <select 
          value={selectedStatusFilter}
          onChange={(e) => setSelectedStatusFilter(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', fontSize: '14px', outline: 'none', cursor: 'pointer' }}
        >
          <option value="All">Tất cả trạng thái</option>
          <option value="available">Sẵn sàng</option>
          <option value="occupied">Đang sử dụng</option>
          <option value="maintenance">Bảo trì</option>
        </select>
        <div style={{ display: 'flex', backgroundColor: '#f1f5f9', padding: '4px', borderRadius: '8px', gap: '4px' }}>
          <button 
            onClick={() => setViewMode('grid')}
            style={{ padding: '6px', borderRadius: '6px', border: 'none', backgroundColor: viewMode === 'grid' ? '#ffffff' : 'transparent', color: viewMode === 'grid' ? '#0f172a' : '#64748b', cursor: 'pointer', boxShadow: viewMode === 'grid' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none' }}
          >
            <Grid size={18} />
          </button>
          <button 
            onClick={() => setViewMode('table')}
            style={{ padding: '6px', borderRadius: '6px', border: 'none', backgroundColor: viewMode === 'table' ? '#ffffff' : 'transparent', color: viewMode === 'table' ? '#0f172a' : '#64748b', cursor: 'pointer', boxShadow: viewMode === 'table' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none' }}
          >
            <List size={18} />
          </button>
        </div>
      </div>

      {/* DANH SÁCH PHÒNG (GRID) */}
      {viewMode === 'grid' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '24px' }}>
          {filteredRooms.map(room => {
            const { status: dynamicStatus, currentEvent } = getRoomStatusAndCurrentEvent(room, bookingRequests);

            let statusBg = '#f1f5f9';
            let statusColor = '#475569';
            let statusBorder = '#e2e8f0';
            let StatusIcon = null;

            if (dynamicStatus === 'Sẵn sàng') {
              statusBg = '#dcfce7'; statusColor = '#15803d'; statusBorder = '#bbf7d0'; StatusIcon = CheckCircle;
            } else if (dynamicStatus === 'Đang họp') {
              statusBg = '#dbeafe'; statusColor = '#1d4ed8'; statusBorder = '#bfdbfe'; StatusIcon = Clock;
            } else if (dynamicStatus === 'Bảo trì') {
              statusBg = '#ffedd5'; statusColor = '#c2410c'; statusBorder = '#fed7aa'; StatusIcon = AlertTriangle;
            }

            return (
              <div key={room.id} className="hover:shadow-lg transition-all duration-300" style={{ backgroundColor: '#ffffff', borderRadius: '24px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03)', display: 'flex', flexDirection: 'column' }}>
                <div style={{ position: 'relative' }}>
                  {room.image ? (
                    <img 
                      src={room.image} 
                      alt={room.name} 
                      onError={(e) => { e.currentTarget.src = FALLBACK_IMAGE; }}
                      style={{ width: '100%', height: '180px', objectFit: 'cover', display: 'block' }} 
                    />
                  ) : (
                    <div style={{ width: '100%', height: '180px', backgroundColor: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#cbd5e1' }}>
                      <ImageIcon size={48} />
                    </div>
                  )}
                  <div style={{ position: 'absolute', top: '12px', left: '12px', display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: '600', backgroundColor: statusBg, color: statusColor, border: `1px solid ${statusBorder}` }}>
                    {StatusIcon && <StatusIcon size={14} />}
                    <span>{dynamicStatus}</span>
                  </div>
                </div>
                
                <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px', flex: 1, position: 'relative' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                      <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#0f172a', margin: 0 }}>{room.name}</h3>
                      <span style={{ fontSize: '12px', fontFamily: 'monospace', backgroundColor: '#f1f5f9', color: '#475569', padding: '2px 8px', borderRadius: '6px' }}>{room.id}</span>
                    </div>
                    
                    <div style={{ display: 'flex', alignItems: 'center', fontSize: '14px', color: '#64748b', gap: '8px', marginBottom: '12px' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><MapPin size={14} /> {room.floor} - {room.building}</span>
                      <span style={{ color: '#e2e8f0' }}>|</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Users size={14} /> {room.capacity} người</span>
                    </div>

                    <div style={{ padding: '12px', borderRadius: '12px', border: '1px solid', fontSize: '14px', ...(dynamicStatus === 'Đang họp' ? { backgroundColor: '#f0fdf4', borderColor: '#dcfce7', color: '#166534' } : { backgroundColor: '#f8fafc', borderColor: '#f1f5f9', color: '#475569' }) }}>
                      {dynamicStatus === 'Đang họp' && currentEvent ? (
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                          <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#22c55e', marginTop: '6px', flexShrink: 0 }}></div>
                          <span><strong>Đang diễn ra:</strong> {currentEvent.title} ({currentEvent.time})</span>
                        </div>
                      ) : dynamicStatus === 'Bảo trì' ? (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#c2410c' }}><AlertTriangle size={14} /> Đang bảo trì / sửa chữa</span>
                      ) : (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><CheckCircle size={14} /> Trống - Sẵn sàng đặt phòng</span>
                      )}
                    </div>
                  </div>

                  {/* THIẾT BỊ BÊN TRONG CARD (Render theo icon) */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', paddingTop: '8px' }}>
                    {room.equipment.map((eq, idx) => {
                      const Icon = getDeviceIcon(eq);
                      return (
                        <span key={idx} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '8px', backgroundColor: '#f1f5f9', color: '#334155', border: '1px solid #e2e8f0', fontSize: '12px', fontWeight: '500' }}>
                          <Icon size={14} style={{ color: '#64748b' }} />
                          {eq}
                        </span>
                      );
                    })}
                  </div>

                  <div style={{ display: 'flex', gap: '8px', marginTop: 'auto', paddingTop: '12px', borderTop: '1px solid #f1f5f9', justifyContent: 'space-between', alignItems: 'center', position: 'relative' }}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={() => setSelectedRoomForSchedule(room)} style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#f1f5f9', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', color: '#334155', fontWeight: '500' }}>
                        <Calendar size={14} />
                        Lịch
                      </button>
                      <button onClick={() => handleOpenEdit(room)} style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#f1f5f9', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', color: '#334155', fontWeight: '500' }}>
                        <Edit size={14} />
                        Sửa
                      </button>
                    </div>
                    
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveMenuId(activeMenuId === room.id ? null : room.id);
                      }}
                      style={{ padding: '6px', backgroundColor: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                      <MoreVertical size={18} />
                    </button>

                    {/* MENU 3 CHẤM (DROPDOWN) */}
                    {activeMenuId === room.id && (
                      <div 
                        style={{ position: 'absolute', bottom: '44px', right: '0', zIndex: 10, backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1)', padding: '6px 0', width: '200px', display: 'flex', flexDirection: 'column', fontSize: '14px' }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button 
                          onClick={() => handleQuickStatusChange(room.id, 'Sẵn sàng')}
                          style={{ padding: '8px 16px', backgroundColor: 'transparent', border: 'none', textAlign: 'left', cursor: 'pointer', color: '#15803d', display: 'flex', alignItems: 'center', gap: '10px', fontWeight: '500' }}>
                          <CheckCircle size={16} /> Đánh dấu Sẵn sàng
                        </button>
                        <button 
                          onClick={() => handleQuickStatusChange(room.id, 'Đang họp')}
                          style={{ padding: '8px 16px', backgroundColor: 'transparent', border: 'none', textAlign: 'left', cursor: 'pointer', color: '#1d4ed8', display: 'flex', alignItems: 'center', gap: '10px', fontWeight: '500' }}>
                          <Clock size={16} /> Đánh dấu Đang họp
                        </button>
                        <button 
                          onClick={() => handleQuickStatusChange(room.id, 'Bảo trì')}
                          style={{ padding: '8px 16px', backgroundColor: 'transparent', border: 'none', textAlign: 'left', cursor: 'pointer', color: '#ea580c', display: 'flex', alignItems: 'center', gap: '10px', fontWeight: '500' }}>
                          <AlertTriangle size={16} /> Đánh dấu Bảo trì
                        </button>
                        <div style={{ height: '1px', backgroundColor: '#e2e8f0', margin: '4px 0' }}></div>
                        <button 
                          onClick={() => handleQuickDelete(room.id, room.name)}
                          style={{ padding: '8px 16px', backgroundColor: 'transparent', border: 'none', textAlign: 'left', cursor: 'pointer', color: '#dc2626', display: 'flex', alignItems: 'center', gap: '10px', fontWeight: '500' }}>
                          <Trash2 size={16} /> Xóa phòng
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* TABLE VIEW */
        <div style={{ backgroundColor: '#ffffff', borderRadius: '24px', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.05), 0 4px 6px -2px rgba(0,0,0,0.025)', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                  <th style={{ padding: '16px 24px', fontSize: '13px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>Phòng</th>
                  <th style={{ padding: '16px 24px', fontSize: '13px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>Vị trí & Sức chứa</th>
                  <th style={{ padding: '16px 24px', fontSize: '13px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Trang thiết bị</th>
                  <th style={{ padding: '16px 24px', fontSize: '13px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>Trạng thái</th>
                  <th style={{ padding: '16px 24px', fontSize: '13px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right', whiteSpace: 'nowrap' }}>Hành động</th>
                </tr>
              </thead>
              <tbody>
                {filteredRooms.map((room) => {
                  const { status: dynamicStatus, currentEvent } = getRoomStatusAndCurrentEvent(room, bookingRequests);
                  
                  let statusBg = '#f1f5f9';
                  let statusColor = '#475569';
                  let statusBorder = '#e2e8f0';
                  let StatusIcon = null;

                  if (dynamicStatus === 'Sẵn sàng') {
                    statusBg = '#dcfce7'; statusColor = '#15803d'; statusBorder = '#bbf7d0'; StatusIcon = CheckCircle;
                  } else if (dynamicStatus === 'Đang họp') {
                    statusBg = '#dbeafe'; statusColor = '#1d4ed8'; statusBorder = '#bfdbfe'; StatusIcon = Clock;
                  } else if (dynamicStatus === 'Bảo trì') {
                    statusBg = '#ffedd5'; statusColor = '#c2410c'; statusBorder = '#fed7aa'; StatusIcon = AlertTriangle;
                  }

                  return (
                    <tr key={room.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '16px 24px' }}>
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                          <div style={{ width: '40px', height: '40px', borderRadius: '8px', overflow: 'hidden', marginRight: '12px', backgroundColor: '#f1f5f9', flexShrink: 0 }}>
                            {room.image ? (
                              <img 
                                src={room.image} 
                                onError={(e) => { e.currentTarget.src = FALLBACK_IMAGE; }}
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                                alt="" 
                              />
                            ) : (
                              <ImageIcon size={20} color="#94a3b8" style={{ margin: '10px' }} />
                            )}
                          </div>
                          <div>
                            <div style={{ fontWeight: '600', color: '#0f172a', fontSize: '14px' }}>{room.name}</div>
                            <div style={{ fontSize: '12px', color: '#64748b' }}>{room.id} • {room.type}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '16px 24px' }}>
                        <div style={{ fontSize: '14px', color: '#0f172a' }}>{room.building} - {room.floor}</div>
                        <div style={{ fontSize: '12px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}><Users size={12} /> {room.capacity} người</div>
                      </td>
                      <td style={{ padding: '16px 24px' }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', maxWidth: '250px' }}>
                          {room.equipment.slice(0, 3).map((eq, i) => {
                            const Icon = getDeviceIcon(eq);
                            return (
                              <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', backgroundColor: '#f1f5f9', color: '#475569', padding: '3px 8px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                                <Icon size={12} />
                                {eq}
                              </span>
                            );
                          })}
                          {room.equipment.length > 3 && <span style={{ fontSize: '11px', backgroundColor: '#f1f5f9', color: '#475569', padding: '3px 8px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>+{room.equipment.length - 3}</span>}
                        </div>
                      </td>
                      <td style={{ padding: '16px 24px' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: '500', backgroundColor: statusBg, color: statusColor, border: `1px solid ${statusBorder}` }}>
                          {StatusIcon && <StatusIcon size={12} />}
                          {dynamicStatus}
                        </span>
                        {currentEvent && <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px', maxWidth: '150px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={currentEvent.title}>{currentEvent.title}</div>}
                      </td>
                      <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                        <button onClick={() => setSelectedRoomForSchedule(room)} style={{ color: '#2563eb', fontWeight: '500', fontSize: '14px', marginRight: '16px', border: 'none', backgroundColor: 'transparent', cursor: 'pointer' }}>Lịch</button>
                        <button onClick={() => handleOpenEdit(room)} style={{ color: '#475569', fontWeight: '500', fontSize: '14px', border: 'none', backgroundColor: 'transparent', cursor: 'pointer' }}>Sửa</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {filteredRooms.length === 0 && (
             <div style={{ padding: '48px', textAlign: 'center', color: '#64748b' }}>
               Không tìm thấy phòng nào phù hợp với bộ lọc.
             </div>
          )}
        </div>
      )}

      {/* MODAL THÊM / SỬA PHÒNG */}
      {isModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '20px', width: '100%', maxWidth: '700px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)', overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
            
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#0f172a', margin: 0 }}>
                {modalMode === 'add' ? 'Thêm phòng họp mới' : 'Chỉnh sửa phòng họp'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', display: 'flex', padding: '4px' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveRoom} style={{ padding: '24px', overflowY: 'auto' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#334155', marginBottom: '6px' }}>Tên phòng *</label>
                  <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="VD: Phòng Seminar A5" style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '14px' }} />
                </div>
                
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#334155', marginBottom: '6px' }}>Mã phòng *</label>
                  <input required type="text" value={formData.id} onChange={e => setFormData({...formData, id: e.target.value})} placeholder="VD: R07" disabled={modalMode === 'edit'} style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '14px', backgroundColor: modalMode === 'edit' ? '#f1f5f9' : '#fff' }} />
                </div>
                
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#334155', marginBottom: '6px' }}>Tòa nhà *</label>
                  <select value={formData.building} onChange={e => setFormData({...formData, building: e.target.value})} style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '14px', backgroundColor: '#fff', cursor: 'pointer' }}>
                    <option value="Tòa A">Tòa A</option>
                    <option value="Tòa B">Tòa B</option>
                    <option value="Tòa C">Tòa C</option>
                    <option value="Tòa Lab">Tòa Lab</option>
                  </select>
                </div>
                
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#334155', marginBottom: '6px' }}>Tầng *</label>
                  <input required type="text" value={formData.floor} onChange={e => setFormData({...formData, floor: e.target.value})} placeholder="VD: Tầng 3" style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '14px' }} />
                </div>
                
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#334155', marginBottom: '6px' }}>Sức chứa (Người) *</label>
                  <input required type="number" min="1" value={formData.capacity} onChange={e => setFormData({...formData, capacity: parseInt(e.target.value)})} placeholder="VD: 30" style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '14px' }} />
                </div>
                
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#334155', marginBottom: '6px' }}>Trạng thái phòng gốc (DB) *</label>
                  <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})} style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '14px', backgroundColor: '#fff', cursor: 'pointer' }}>
                    <option value="Sẵn sàng">Sẵn sàng (Tự động theo lịch)</option>
                    <option value="Đang họp">Đang họp (Chặn đặt phòng)</option>
                    <option value="Bảo trì">Bảo trì (Khóa phòng)</option>
                  </select>
                </div>
                
                {/* TRANG THIẾT BỊ (GRID CARDS ĐẸP) */}
                <div style={{ gridColumn: '1 / -1', borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#334155', marginBottom: '12px' }}>Trang thiết bị phòng họp</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                    {deviceList.map(dev => {
                      const Icon = getDeviceIcon(dev.name);
                      const isChecked = formData.equipment?.includes(dev.name);
                      return (
                        <div 
                          key={dev.id} 
                          onClick={() => handleEquipmentToggle(dev.name)}
                          style={{ 
                            display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', 
                            borderRadius: '12px', border: isChecked ? '2px solid #2563eb' : '1px solid #e2e8f0', 
                            backgroundColor: isChecked ? '#eff6ff' : '#ffffff', cursor: 'pointer', transition: 'all 0.2s' 
                          }}
                        >
                          <div style={{ color: isChecked ? '#2563eb' : '#64748b' }}>
                            <Icon size={20} />
                          </div>
                          <div style={{ flex: 1, fontSize: '14px', fontWeight: '500', color: isChecked ? '#1e3a8a' : '#334155' }}>
                            {dev.name}
                          </div>
                          <div style={{ width: '18px', height: '18px', borderRadius: '4px', border: isChecked ? 'none' : '1px solid #cbd5e1', backgroundColor: isChecked ? '#2563eb' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                            {isChecked && <Check size={14} strokeWidth={3} />}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
                
                {/* ẢNH ĐẠI DIỆN PHÒNG */}
                <div style={{ gridColumn: '1 / -1', borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#334155', marginBottom: '10px' }}>Ảnh đại diện phòng</label>
                  
                  {/* Tabs chọn kiểu nhập ảnh */}
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                    <button 
                      type="button" 
                      onClick={() => setImageInputMode('preset')}
                      style={{ padding: '6px 12px', borderRadius: '6px', fontSize: '13px', cursor: 'pointer', border: imageInputMode === 'preset' ? '1px solid #2563eb' : '1px solid #cbd5e1', backgroundColor: imageInputMode === 'preset' ? '#eff6ff' : '#ffffff', color: imageInputMode === 'preset' ? '#1d4ed8' : '#475569', fontWeight: '500' }}>
                      Chọn mẫu có sẵn
                    </button>
                    <button 
                      type="button" 
                      onClick={() => setImageInputMode('upload')}
                      style={{ padding: '6px 12px', borderRadius: '6px', fontSize: '13px', cursor: 'pointer', border: imageInputMode === 'upload' ? '1px solid #2563eb' : '1px solid #cbd5e1', backgroundColor: imageInputMode === 'upload' ? '#eff6ff' : '#ffffff', color: imageInputMode === 'upload' ? '#1d4ed8' : '#475569', fontWeight: '500' }}>
                      Tải ảnh từ máy
                    </button>
                    <button 
                      type="button" 
                      onClick={() => setImageInputMode('url')}
                      style={{ padding: '6px 12px', borderRadius: '6px', fontSize: '13px', cursor: 'pointer', border: imageInputMode === 'url' ? '1px solid #2563eb' : '1px solid #cbd5e1', backgroundColor: imageInputMode === 'url' ? '#eff6ff' : '#ffffff', color: imageInputMode === 'url' ? '#1d4ed8' : '#475569', fontWeight: '500' }}>
                      Nhập link URL
                    </button>
                  </div>

                  {/* Nội dung tab chọn mẫu */}
                  {imageInputMode === 'preset' && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                      {presetImages.map((img, idx) => (
                        <div 
                          key={idx} 
                          onClick={() => setFormData({...formData, image: img})}
                          style={{ height: '70px', borderRadius: '6px', overflow: 'hidden', border: formData.image === img ? '2px solid #2563eb' : '2px solid transparent', cursor: 'pointer' }}
                        >
                          <img src={img} alt={`Preset ${idx+1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Nội dung tab Tải ảnh */}
                  {imageInputMode === 'upload' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', border: '1px dashed #cbd5e1', borderRadius: '8px', cursor: 'pointer', backgroundColor: '#f8fafc', color: '#64748b' }}>
                        <Upload size={24} style={{ marginBottom: '8px' }} />
                        <span style={{ fontSize: '14px' }}>Bấm để tải ảnh lên</span>
                        <input type="file" accept="image/*" onChange={handleFileUpload} style={{ display: 'none' }} />
                      </label>
                    </div>
                  )}

                  {/* Nội dung tab URL */}
                  {imageInputMode === 'url' && (
                    <input type="text" value={formData.image} onChange={e => setFormData({...formData, image: e.target.value})} placeholder="https://..." style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '14px' }} />
                  )}

                  {/* Preview Image */}
                  {formData.image && (
                    <div style={{ marginTop: '12px', borderRadius: '8px', overflow: 'hidden', height: '140px', border: '1px solid #e2e8f0', backgroundColor: '#f1f5f9' }}>
                      <img 
                        src={formData.image} 
                        onError={(e) => { e.currentTarget.src = FALLBACK_IMAGE; }}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} 
                        alt="Preview" 
                      />
                    </div>
                  )}
                </div>
              </div>
              
              <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', borderTop: '1px solid #e2e8f0', paddingTop: '20px' }}>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button type="button" onClick={() => setIsModalOpen(false)} style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', color: '#475569', fontWeight: '500', cursor: 'pointer', fontSize: '14px' }}>
                    Hủy bỏ
                  </button>
                  <button type="submit" style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', backgroundColor: '#2563eb', color: '#ffffff', fontWeight: '500', cursor: 'pointer', fontSize: '14px' }}>
                    {modalMode === 'add' ? 'Xác nhận thêm' : 'Lưu thay đổi'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL LỊCH PHÒNG (TIMELINE SCHEDULE) */}
      {selectedRoomForSchedule && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '20px', width: '100%', maxWidth: '750px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
            
            {/* Header */}
            <div style={{ padding: '24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                <div style={{ width: '64px', height: '64px', borderRadius: '12px', overflow: 'hidden', backgroundColor: '#f1f5f9' }}>
                  <img src={selectedRoomForSchedule.image || FALLBACK_IMAGE} alt={selectedRoomForSchedule.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { e.currentTarget.src = FALLBACK_IMAGE; }} />
                </div>
                <div>
                  <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#0f172a', margin: '0 0 6px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {selectedRoomForSchedule.name}
                    <span style={{ fontSize: '12px', backgroundColor: '#f1f5f9', color: '#475569', padding: '2px 8px', borderRadius: '6px', fontWeight: 'normal' }}>{selectedRoomForSchedule.id}</span>
                  </h2>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '14px', color: '#64748b' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Users size={14} /> Sức chứa: {selectedRoomForSchedule.capacity}</span>
                    <span style={{ color: '#cbd5e1' }}>|</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><MapPin size={14} /> {selectedRoomForSchedule.floor} - {selectedRoomForSchedule.building}</span>
                  </div>
                </div>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '12px' }}>
                <button onClick={() => setSelectedRoomForSchedule(null)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '4px' }}>
                  <X size={24} />
                </button>
                <input 
                  type="date" 
                  value={scheduleDate}
                  onChange={(e) => setScheduleDate(e.target.value)}
                  style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '14px', color: '#334155', fontWeight: '500', cursor: 'pointer', backgroundColor: '#f8fafc' }}
                />
              </div>
            </div>

            {/* Timeline Content */}
            <div style={{ padding: '24px', overflowY: 'auto', backgroundColor: '#f8fafc', flex: 1 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {TIME_SLOTS.map((slot, index) => {
                  const match = bookingRequests.find(req => 
                    (req.roomId === selectedRoomForSchedule.id || req.roomName === selectedRoomForSchedule.name) &&
                    req.date === scheduleDate &&
                    (req.status === 'approved' || req.status === 'pending') &&
                    (req.timeSlot === slot || (req.timeSlot && req.timeSlot.includes(slot.split(' - ')[0])))
                  );

                  return (
                    <div key={index} style={{ display: 'flex', gap: '16px' }}>
                      <div style={{ width: '120px', flexShrink: 0, textAlign: 'right', paddingTop: '16px', color: '#64748b', fontWeight: '500', fontSize: '14px' }}>
                        {slot}
                      </div>
                      
                      {/* Trục thời gian */}
                      <div style={{ position: 'relative', width: '2px', backgroundColor: '#e2e8f0', marginTop: '16px' }}>
                        <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: '10px', height: '10px', borderRadius: '50%', backgroundColor: match ? '#2563eb' : '#cbd5e1', border: '2px solid #ffffff' }}></div>
                      </div>

                      {/* Content Box */}
                      <div style={{ flex: 1, paddingBottom: index === TIME_SLOTS.length - 1 ? '0' : '8px' }}>
                        {match ? (
                          <div style={{ backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '12px', padding: '16px', marginTop: '8px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                              <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 'bold', color: '#1e40af' }}>{match.title}</h4>
                              <span style={{ fontSize: '12px', backgroundColor: match.status === 'approved' ? '#dcfce7' : '#fef08a', color: match.status === 'approved' ? '#166534' : '#854d0e', padding: '4px 8px', borderRadius: '6px', fontWeight: '500' }}>
                                {match.status === 'approved' ? 'Đã duyệt' : 'Chờ duyệt'}
                              </span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '13px', color: '#3b82f6' }}>
                              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><User size={14} /> {match.requesterName} ({match.requesterRole})</span>
                            </div>
                          </div>
                        ) : (
                          <div style={{ backgroundColor: '#ffffff', border: '1px dashed #cbd5e1', borderRadius: '12px', padding: '16px', marginTop: '8px', display: 'flex', alignItems: 'center', color: '#64748b', fontSize: '14px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#22c55e' }}></div>
                              <span>Trống - Sẵn sàng sử dụng</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Footer Summary */}
            <div style={{ padding: '20px 24px', borderTop: '1px solid #e2e8f0', backgroundColor: '#ffffff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: '24px' }}>
                {(() => {
                  const occupiedSlotsCount = TIME_SLOTS.filter(slot => 
                    bookingRequests.some(req => 
                      (req.roomId === selectedRoomForSchedule.id || req.roomName === selectedRoomForSchedule.name) &&
                      req.date === scheduleDate &&
                      (req.status === 'approved' || req.status === 'pending') &&
                      (req.timeSlot === slot || (req.timeSlot && req.timeSlot.includes(slot.split(' - ')[0])))
                    )
                  ).length;
                  const freeHours = (TIME_SLOTS.length - occupiedSlotsCount) * 2;
                  
                  return (
                    <>
                      <div>
                        <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>Tổng số ca họp</p>
                        <p style={{ margin: 0, fontSize: '16px', fontWeight: 'bold', color: '#0f172a' }}>{occupiedSlotsCount} ca</p>
                      </div>
                      <div>
                        <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>Tổng giờ rảnh</p>
                        <p style={{ margin: 0, fontSize: '16px', fontWeight: 'bold', color: '#16a34a' }}>{freeHours} giờ</p>
                      </div>
                    </>
                  );
                })()}
              </div>
              <button onClick={() => setSelectedRoomForSchedule(null)} style={{ padding: '10px 24px', borderRadius: '8px', backgroundColor: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1', fontWeight: '600', cursor: 'pointer', fontSize: '14px' }}>
                Đóng
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default RoomsView;
