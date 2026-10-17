import React, { useState, useEffect } from 'react';
import { 
  Search, Plus, Grid, List, MapPin, 
  Settings, AlertTriangle, CheckCircle, Clock, 
  Edit, Trash2, Monitor, Tv, Mic, Volume2, 
  Video, Laptop, Wind, Wifi, Box, History, X,
  Tag
} from 'lucide-react';

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

// Map backend equipment_type to frontend display type
const typeBackToFront: Record<string, string> = {
  PROJECTOR: 'Projector', TV: 'TV', MICROPHONE: 'Microphone',
  SMARTBOARD: 'Board', SPEAKER: 'Speaker', CAMERA: 'Camera',
  LAPTOP: 'Laptop', HVAC: 'HVAC', NETWORK: 'Network', OTHER: 'Other'
};
const typeFrontToBack: Record<string, string> = {
  Projector: 'PROJECTOR', TV: 'TV', Microphone: 'MICROPHONE',
  Board: 'SMARTBOARD', Speaker: 'SPEAKER', Camera: 'CAMERA',
  Laptop: 'LAPTOP', HVAC: 'HVAC', Network: 'Network', Other: 'OTHER'
};

// Map backend status to frontend status
const statusBackToFront: Record<string, string> = {
  AVAILABLE: 'Sẵn sàng', MAINTENANCE: 'Bảo dưỡng', BROKEN: 'Hỏng hóc'
};
const statusFrontToBack: Record<string, string> = {
  'Sẵn sàng': 'AVAILABLE', 'Bảo dưỡng': 'MAINTENANCE', 'Hỏng hóc': 'BROKEN'
};

// Map API equipment → frontend Device
const mapApiEquipmentToFrontend = (apiEq: any, rooms: any[]): Device => {
  const roomName = apiEq.room_name || (apiEq.room_id ? `Phòng #${apiEq.room_id}` : 'Kho thiết bị di động');
  const mappedStatus = (statusBackToFront[apiEq.status] as ('Sẵn sàng' | 'Bảo dưỡng' | 'Hỏng hóc')) || 'Sẵn sàng';
  return {
    id: String(apiEq.equipment_id),
    name: apiEq.equipment_name || '',
    type: typeBackToFront[apiEq.equipment_type] || apiEq.equipment_type || 'Other',
    serial: apiEq.serial_number || '',
    allocation: apiEq.room_id ? 'Cố định' : 'Di động',
    location: roomName,
    status: mappedStatus,
    history: []
  };
};

// Map frontend Device → backend request body
const mapDeviceToApi = (dev: Device, rooms: any[]): any => {
  // Look up room_id by location name
  let roomId = null;
  if (dev.allocation === 'Cố định') {
    const matchedRoom = rooms.find(r => 
      (r.room_name === dev.location) || 
      (r.name === dev.location) ||
      (r.room_name && dev.location && r.room_name.includes(dev.location))
    );
    roomId = matchedRoom?.room_id || matchedRoom?.id || null;
  }
  return {
    equipment_name: dev.name,
    equipment_type: typeFrontToBack[dev.type] || dev.type.toUpperCase(),
    serial_number: dev.serial || null,
    room_id: roomId,
    status: statusFrontToBack[dev.status] || 'AVAILABLE',
    description: dev.history?.length ? dev.history[0]?.event : null
  };
};

// Fetch equipment list from API
const fetchEquipmentsFromAPI = async (): Promise<Device[]> => {
  const token = getToken();
  if (!token) return [];
  try {
    // Fetch rooms first to map room_id → room_name
    const roomsRes = await fetch(`${API_BASE}/rooms`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const rooms = roomsRes.ok ? await roomsRes.json() : [];

    const res = await fetch(`${API_BASE}/equipments`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) return [];
    const data = await res.json();
    if (Array.isArray(data) && data.length > 0) {
      return data.map((eq: any) => mapApiEquipmentToFrontend(eq, rooms));
    }
    return [];
  } catch {
    return [];
  }
};

// Save equipment to API
const saveEquipmentToAPI = async (dev: Device, rooms: any[], isNew: boolean): Promise<any> => {
  const token = getToken();
  if (!token) throw new Error('No token');

  // Fallback: nếu danh sách rooms truyền vào bị rỗng, tự động fetch rooms từ API
  let currentRooms = rooms;
  if (!currentRooms || currentRooms.length === 0) {
    try {
      const rRes = await fetch(`${API_BASE}/rooms`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (rRes.ok) currentRooms = await rRes.json();
    } catch {}
  }

  const payload = mapDeviceToApi(dev, currentRooms || []);
  const url = isNew ? `${API_BASE}/equipments` : `${API_BASE}/equipments/${dev.id}`;
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

// Delete equipment from API
const deleteEquipmentFromAPI = async (id: string): Promise<void> => {
  const token = getToken();
  if (!token) throw new Error('No token');
  const res = await fetch(`${API_BASE}/equipments/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
};

interface DeviceHistory {
  date: string;
  event: string;
}

interface Device {
  id: string;
  name: string;
  type: string;
  serial: string;
  allocation: 'Cố định' | 'Di động';
  location: string;
  status: 'Sẵn sàng' | 'Bảo dưỡng' | 'Hỏng hóc';
  history: DeviceHistory[];
}

const mockDevices: Device[] = [
  {
    id: 'D01', name: 'Máy chiếu 4K Sony', type: 'Projector', serial: 'SN-PJ-001', allocation: 'Cố định', location: 'Phòng Hội trường B1', status: 'Sẵn sàng',
    history: [{ date: '10/09/2026', event: 'Mua mới và gán vào Phòng Hội trường B1' }]
  },
  {
    id: 'D02', name: 'Micro không dây Shure', type: 'Microphone', serial: 'SN-MC-045', allocation: 'Di động', location: 'Kho thiết bị di động', status: 'Sẵn sàng',
    history: [{ date: '12/09/2026', event: 'Nhập kho' }]
  },
  {
    id: 'D03', name: 'Bảng tương tác thông minh', type: 'Board', serial: 'SN-BD-012', allocation: 'Cố định', location: 'Phòng Sáng tạo C3', status: 'Sẵn sàng',
    history: [{ date: '15/09/2026', event: 'Bảo trì định kỳ' }]
  },
  {
    id: 'D04', name: 'Loa hội trường JBL', type: 'Speaker', serial: 'SN-SP-088', allocation: 'Cố định', location: 'Phòng Hội trường B1', status: 'Bảo dưỡng',
    history: [{ date: '25/09/2026', event: 'Yêu cầu bảo trì do rè tiếng - Kỹ thuật viên: Nguyễn Văn B' }]
  },
  {
    id: 'D05', name: 'Bộ camera họp trực tuyến Logitech', type: 'Camera', serial: 'SN-CM-003', allocation: 'Di động', location: 'Kho thiết bị di động', status: 'Hỏng hóc',
    history: [{ date: '28/09/2026', event: 'Khách báo hỏng kết nối USB, đang gửi bảo hành' }]
  },
  {
    id: 'D06', name: 'Laptop trình chiếu', type: 'Laptop', serial: 'SN-LT-102', allocation: 'Di động', location: 'Kho thiết bị di động', status: 'Sẵn sàng',
    history: [{ date: '01/09/2026', event: 'Nhập kho' }]
  },
  {
    id: 'D07', name: 'Điều hòa trung tâm', type: 'HVAC', serial: 'SN-AC-055', allocation: 'Cố định', location: 'Phòng họp VIP A1', status: 'Sẵn sàng',
    history: [{ date: '20/08/2026', event: 'Vệ sinh lưới lọc' }]
  },
  {
    id: 'D08', name: 'Wifi 6 High-Speed', type: 'Network', serial: 'SN-WF-099', allocation: 'Cố định', location: 'Phòng họp VIP A1', status: 'Sẵn sàng',
    history: [{ date: '05/09/2026', event: 'Nâng cấp firmware' }]
  },
];

const getDeviceIcon = (name: string) => {
  const n = name.toLowerCase();
  if (n.includes('máy chiếu') || n.includes('projector') || n.includes('tv')) return Tv;
  if (n.includes('micro') || n.includes('mic')) return Mic;
  if (n.includes('bảng') || n.includes('monitor') || n.includes('màn hình')) return Monitor;
  if (n.includes('loa') || n.includes('âm thanh') || n.includes('speaker')) return Volume2;
  if (n.includes('camera') || n.includes('video')) return Video;
  if (n.includes('laptop') || n.includes('pc') || n.includes('máy tính')) return Laptop;
  if (n.includes('điều hòa') || n.includes('quạt') || n.includes('hvac')) return Wind;
  if (n.includes('wifi') || n.includes('mạng') || n.includes('lan')) return Wifi;
  return Box; 
};

const getTodayStringVN = () => {
  const d = new Date();
  return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
};

const DevicesView: React.FC = () => {
  const [devices, setDevices] = useState<Device[]>(() => {
    const saved = localStorage.getItem('admin_devices');
    if (saved) {
      try { 
        const parsed = JSON.parse(saved);
        if (parsed.length > 0 && parsed[0].allocation) return parsed;
        // Migration if old data structure
        console.warn("Old device data detected, resetting to mockDevices");
      } catch (e) { }
    }
    return mockDevices;
  });

  // Store rooms list for room_id lookup when saving equipment
  const [roomsData, setRoomsData] = useState<any[]>([]);

  const [availableRooms, setAvailableRooms] = useState<string[]>([]);

  // Fetch rooms + equipments from backend API + set up polling for real-time sync
  useEffect(() => {
    const loadFromAPI = async () => {
      const token = getToken();
      if (!token) return;

      // 1. Fetch rooms for location → room_id mapping
      let currentRooms: any[] = [];
      try {
        const roomsRes = await fetch(`${API_BASE}/rooms`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (roomsRes.ok) {
          currentRooms = await roomsRes.json();
          setRoomsData(currentRooms);
          const roomNames = currentRooms.map((r: any) => r.room_name || r.name);
          setAvailableRooms([...roomNames, 'Kho thiết bị di động']);
        }
      } catch (err) {
        console.error("Failed to fetch rooms:", err);
      }

      // 2. Fetch equipments from API
      try {
        const res = await fetch(`${API_BASE}/equipments`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            const mapped = data.map((eq: any) => mapApiEquipmentToFrontend(eq, currentRooms));
            setDevices(mapped);
            localStorage.setItem('admin_devices', JSON.stringify(mapped));
          }
        }
      } catch (err) {
        console.error("Failed to fetch equipments:", err);
      }
    };

    loadFromAPI();

    // Poll every 30 seconds for real-time sync between admin and user
    const pollInterval = setInterval(loadFromAPI, 30000);

    // Listen for storage changes across tabs
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'admin_devices' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].allocation) {
            setDevices(parsed);
          }
        } catch { }
      }
      if (e.key === 'admin_rooms' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          setAvailableRooms(parsed.map((r: any) => r.name || r.room_name));
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

  // Persist devices to localStorage whenever they change (cache for same-tab offline)
  useEffect(() => {
    localStorage.setItem('admin_devices', JSON.stringify(devices));
  }, [devices]);

  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  
  // Modals
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [formData, setFormData] = useState<Partial<Device>>({});
  
  const [historyModalDevice, setHistoryModalDevice] = useState<Device | null>(null);

  const totalDevices = devices.length;
  const readyDevices = devices.filter(d => d.status === 'Sẵn sàng').length;
  const maintenanceDevices = devices.filter(d => d.status === 'Bảo dưỡng').length;
  const brokenDevices = devices.filter(d => d.status === 'Hỏng hóc').length;

  const handleOpenAdd = () => {
    setModalMode('add');
    setFormData({
      id: `D${(devices.length + 1).toString().padStart(2, '0')}`,
      name: '',
      type: 'Projector',
      serial: '',
      allocation: 'Cố định',
      location: availableRooms[0] || 'Kho thiết bị di động',
      status: 'Sẵn sàng',
      history: []
    });
    setIsEditModalOpen(true);
  };

  const handleOpenEdit = (dev: Device) => {
    setModalMode('edit');
    setFormData(JSON.parse(JSON.stringify(dev))); // Deep copy
    setIsEditModalOpen(true);
  };

  const handleDelete = async (id: string, name: string) => {
    if (window.confirm(`Bạn có chắc chắn muốn xóa thiết bị "${name}" không? Hành động này không thể hoàn tác.`)) {
      try {
        await deleteEquipmentFromAPI(id);
        setDevices(prev => prev.filter(d => d.id !== id));
        window.dispatchEvent(new Event('appDataSync'));
        window.dispatchEvent(new Event('equipmentUpdated'));
        window.dispatchEvent(new Event('storage'));
      } catch (err: any) {
        console.error("Failed to delete equipment via API:", err.message);
        alert(`Lỗi xóa thiết bị: ${err.message}`);
      }
    }
  };

  const handleSaveDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    const isNew = modalMode === 'add';
    
    const deviceToSave = { ...formData } as Device;
    const prevDevices = devices;

    if (isNew) {
      deviceToSave.history = [{ date: getTodayStringVN(), event: 'Nhập mới vào hệ thống' }];
      setDevices(prev => [deviceToSave, ...prev]);
    } else {
      const oldDev = devices.find(d => d.id === deviceToSave.id);
      if (oldDev) {
        if (oldDev.status !== deviceToSave.status) {
          deviceToSave.history.unshift({ date: getTodayStringVN(), event: `Chuyển trạng thái từ ${oldDev.status} sang ${deviceToSave.status}` });
        }
        if (oldDev.location !== deviceToSave.location) {
          deviceToSave.history.unshift({ date: getTodayStringVN(), event: `Chuyển vị trí đến ${deviceToSave.location}` });
        }
      }
      setDevices(prev => prev.map(d => d.id === deviceToSave.id ? deviceToSave : d));
    }
    
    setIsEditModalOpen(false);

    // Persist to backend API
    try {
      await saveEquipmentToAPI(deviceToSave, roomsData, isNew);
      window.dispatchEvent(new Event('appDataSync'));
      window.dispatchEvent(new Event('equipmentUpdated'));
      window.dispatchEvent(new Event('storage'));
    } catch (err: any) {
      console.error("Failed to save equipment via API:", err.message);
      // Revert optimistic update on failure
      setDevices(prevDevices);
      alert(`Lỗi lưu thiết bị: ${err.message}`);
    }
  };

  const handleQuickStatusChange = async (id: string, newStatus: 'Sẵn sàng' | 'Bảo dưỡng' | 'Hỏng hóc') => {
    // Optimistic update for immediate UI feedback
    const oldDevice = devices.find(d => d.id === id);
    setDevices(prev => prev.map(d => {
      if (d.id === id && d.status !== newStatus) {
        const newHist = [{ date: getTodayStringVN(), event: `Chuyển trạng thái sang ${newStatus} (Cập nhật nhanh)` }, ...d.history];
        return { ...d, status: newStatus, history: newHist };
      }
      return d;
    }));

    // Persist to backend API
    if (oldDevice) {
      try {
        await saveEquipmentToAPI({ ...oldDevice, status: newStatus }, roomsData, false);
        window.dispatchEvent(new Event('appDataSync'));
        window.dispatchEvent(new Event('equipmentUpdated'));
        window.dispatchEvent(new Event('storage'));
      } catch (err: any) {
        console.error("Failed to sync equipment status to API:", err.message);
        // Revert optimistic update on failure
        setDevices(prev => prev.map(d => 
          d.id === id ? { ...d, status: oldDevice.status, history: oldDevice.history } : d
        ));
        alert(`Lỗi cập nhật trạng thái: ${err.message}`);
      }
    }
  };

  const filteredDevices = devices.filter(d => {
    const matchSearch = d.name.toLowerCase().includes(searchTerm.toLowerCase()) || d.serial.toLowerCase().includes(searchTerm.toLowerCase());
    const matchType = selectedType === 'All' || d.type === selectedType;
    const matchStatus = selectedStatus === 'All' || d.status === selectedStatus;
    return matchSearch && matchType && matchStatus;
  });

  const uniqueTypes = Array.from(new Set(devices.map(d => d.type)));

  return (
    <div style={{ padding: '28px', backgroundColor: '#f8fafc', minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#0f172a', margin: 0 }}>Quản lý Danh mục Thiết bị & Vật tư</h1>
          <p style={{ color: '#64748b', marginTop: '4px', fontSize: '14px', margin: '4px 0 0 0' }}>Theo dõi tài sản, kiểm soát bảo trì và luân chuyển thiết bị.</p>
        </div>
        <button 
          onClick={handleOpenAdd}
          style={{ background: 'linear-gradient(to right, #2563eb, #3b82f6)', color: '#ffffff', padding: '12px 24px', borderRadius: '12px', border: 'none', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)', transition: 'all 0.2s' }}>
          <Plus size={18} />
          <span>Thêm thiết bị mới</span>
        </button>
      </div>



      {/* ACTION BAR */}
      <div style={{ backgroundColor: '#ffffff', padding: '20px', borderRadius: '20px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center', marginBottom: '28px' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
          <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input 
            type="text" 
            placeholder="Tìm theo tên thiết bị, Serial..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: '100%', boxSizing: 'border-box', padding: '10px 16px 10px 40px', borderRadius: '12px', border: '1px solid #cbd5e1', outline: 'none', backgroundColor: '#f8fafc', fontSize: '14px', transition: 'all 0.2s' }}
          />
        </div>
        <select 
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', fontSize: '14px', outline: 'none', cursor: 'pointer' }}
        >
          <option value="All">Tất cả danh mục</option>
          {uniqueTypes.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select 
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', fontSize: '14px', outline: 'none', cursor: 'pointer' }}
        >
          <option value="All">Tất cả trạng thái</option>
          <option value="Sẵn sàng">Sẵn sàng</option>
          <option value="Bảo dưỡng">Bảo dưỡng</option>
          <option value="Hỏng hóc">Hỏng hóc</option>
        </select>
        <div style={{ display: 'flex', backgroundColor: '#f1f5f9', padding: '4px', borderRadius: '8px', gap: '4px' }}>
          <button onClick={() => setViewMode('grid')} style={{ padding: '6px', borderRadius: '6px', border: 'none', backgroundColor: viewMode === 'grid' ? '#ffffff' : 'transparent', color: viewMode === 'grid' ? '#0f172a' : '#64748b', cursor: 'pointer', boxShadow: viewMode === 'grid' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none' }}><Grid size={18} /></button>
          <button onClick={() => setViewMode('table')} style={{ padding: '6px', borderRadius: '6px', border: 'none', backgroundColor: viewMode === 'table' ? '#ffffff' : 'transparent', color: viewMode === 'table' ? '#0f172a' : '#64748b', cursor: 'pointer', boxShadow: viewMode === 'table' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none' }}><List size={18} /></button>
        </div>
      </div>

      {/* GRID VIEW */}
      {viewMode === 'grid' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '24px' }}>
          {filteredDevices.map(device => {
            const Icon = getDeviceIcon(device.name);
            let statusColor = '#334155'; let statusBg = '#f1f5f9'; let statusBorder = '#e2e8f0'; let StatusIcon = CheckCircle;
            if (device.status === 'Bảo dưỡng') { StatusIcon = Settings; }
            if (device.status === 'Hỏng hóc') { StatusIcon = AlertTriangle; }

            return (
              <div key={device.id} className="hover:shadow-lg transition-all duration-300" style={{ backgroundColor: '#ffffff', borderRadius: '24px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03)', display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '24px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', gap: '16px' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', flexShrink: 0 }}>
                      <Icon size={24} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: '#0f172a', margin: '0 0 4px 0' }}>{device.name}</h3>
                      <p style={{ fontSize: '13px', color: '#64748b', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Tag size={12} /> {device.serial} • {device.type}
                      </p>
                    </div>
                  </div>
                </div>
                
                <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '13px', color: '#64748b' }}>Phân loại:</span>
                    <span style={{ fontSize: '12px', fontWeight: '500', padding: '2px 8px', borderRadius: '6px', backgroundColor: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0' }}>
                      {device.allocation}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '13px', color: '#64748b' }}>Vị trí:</span>
                    <span style={{ fontSize: '12px', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '4px', color: '#334155', backgroundColor: '#f1f5f9', padding: '4px 8px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                      <MapPin size={12} /> {device.location}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '13px', color: '#64748b' }}>Trạng thái:</span>
                    <select 
                      value={device.status}
                      onChange={(e) => handleQuickStatusChange(device.id, e.target.value as any)}
                      style={{ padding: '4px 8px 4px 28px', borderRadius: '999px', fontSize: '12px', fontWeight: '600', backgroundColor: statusBg, color: statusColor, border: `1px solid ${statusBorder}`, outline: 'none', cursor: 'pointer', appearance: 'none', backgroundImage: `url('data:image/svg+xml;utf8,<svg fill="%23${statusColor.replace('#','')}" height="24" viewBox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg"><path d="M7 10l5 5 5-5z"/></svg>')`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 4px center', backgroundSize: '16px' }}
                    >
                      <option value="Sẵn sàng">Sẵn sàng</option>
                      <option value="Bảo dưỡng">Bảo dưỡng</option>
                      <option value="Hỏng hóc">Hỏng hóc</option>
                    </select>
                  </div>
                </div>

                <div style={{ padding: '16px 24px', borderTop: '1px solid #f1f5f9', backgroundColor: '#fafaf9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottomLeftRadius: '24px', borderBottomRightRadius: '24px' }}>
                  <button onClick={() => setHistoryModalDevice(device)} style={{ border: 'none', background: 'transparent', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: '500', cursor: 'pointer' }}>
                    <History size={16} /> Lịch sử
                  </button>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => handleOpenEdit(device)} className="btn-glass-view" style={{ width: '32px', height: '32px', borderRadius: '8px', border: '1px solid #e2e8f0', backgroundColor: '#ffffff', color: '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                      <Edit size={14} />
                    </button>
                    <button onClick={() => handleDelete(device.id, device.name)} style={{ width: '32px', height: '32px', borderRadius: '8px', border: '1px solid #fecaca', backgroundColor: '#fef2f2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* TABLE VIEW */
        <div style={{ backgroundColor: '#ffffff', borderRadius: '24px', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.05), 0 4px 6px -2px rgba(0,0,0,0.025)', overflow: 'hidden' }}>
          <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                <th style={{ padding: '16px 24px', fontSize: '13px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>Thiết bị</th>
                <th style={{ padding: '16px 24px', fontSize: '13px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>Phân bổ & Vị trí</th>
                <th style={{ padding: '16px 24px', fontSize: '13px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>Trạng thái</th>
                <th style={{ padding: '16px 24px', fontSize: '13px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right', whiteSpace: 'nowrap' }}>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {filteredDevices.map(device => {
                const Icon = getDeviceIcon(device.name);
                let statusColor = '#334155'; let statusBg = '#f1f5f9'; let statusBorder = '#e2e8f0';

                return (
                  <tr key={device.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '16px 24px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
                          <Icon size={20} />
                        </div>
                        <div>
                          <div style={{ fontWeight: '600', color: '#0f172a', fontSize: '14px' }}>{device.name}</div>
                          <div style={{ fontSize: '12px', color: '#64748b' }}>{device.serial} • {device.type}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '16px 24px' }}>
                      <div style={{ fontSize: '14px', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <MapPin size={14} color="#64748b" /> {device.location}
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                        {device.allocation === 'Cố định' ? <span style={{ color: '#2563eb' }}>Cố định</span> : 'Di động'}
                      </div>
                    </td>
                    <td style={{ padding: '16px 24px' }}>
                      <select 
                        value={device.status}
                        onChange={(e) => handleQuickStatusChange(device.id, e.target.value as any)}
                        style={{ padding: '4px 8px 4px 12px', borderRadius: '999px', fontSize: '12px', fontWeight: '600', backgroundColor: statusBg, color: statusColor, border: `1px solid ${statusBorder}`, outline: 'none', cursor: 'pointer', appearance: 'none' }}
                      >
                        <option value="Sẵn sàng">Sẵn sàng</option>
                        <option value="Bảo dưỡng">Bảo dưỡng</option>
                        <option value="Hỏng hóc">Hỏng hóc</option>
                      </select>
                    </td>
                    <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                        <button onClick={() => setHistoryModalDevice(device)} className="btn-glass-view" style={{ width: '32px', height: '32px', borderRadius: '8px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} title="Lịch sử"><History size={16}/></button>
                        <button onClick={() => handleOpenEdit(device)} className="btn-glass-view" style={{ width: '32px', height: '32px', borderRadius: '8px', border: '1px solid #e2e8f0', backgroundColor: '#ffffff', color: '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} title="Sửa"><Edit size={16}/></button>
                        <button onClick={() => handleDelete(device.id, device.name)} style={{ width: '32px', height: '32px', borderRadius: '8px', border: '1px solid #fecaca', backgroundColor: '#fef2f2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} title="Xóa"><Trash2 size={16}/></button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* MODAL THÊM / SỬA */}
      {isEditModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '20px', width: '100%', maxWidth: '600px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#0f172a', margin: 0 }}>
                {modalMode === 'add' ? 'Thêm thiết bị mới' : 'Cập nhật thiết bị'}
              </h2>
              <button onClick={() => setIsEditModalOpen(false)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            <form onSubmit={handleSaveDevice} style={{ padding: '24px', overflowY: 'auto', maxHeight: '70vh' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#334155', marginBottom: '6px' }}>Tên thiết bị *</label>
                  <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="VD: Máy chiếu 4K Sony" style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '14px' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#334155', marginBottom: '6px' }}>Mã Serial *</label>
                  <input required type="text" value={formData.serial} onChange={e => setFormData({...formData, serial: e.target.value})} placeholder="VD: SN-001" style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '14px' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#334155', marginBottom: '6px' }}>Danh mục *</label>
                  <select value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})} style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '14px', backgroundColor: '#fff', cursor: 'pointer' }}>
                    <option value="Projector">Projector</option>
                    <option value="Microphone">Microphone</option>
                    <option value="Speaker">Speaker</option>
                    <option value="Board">Board</option>
                    <option value="Camera">Camera</option>
                    <option value="Laptop">Laptop</option>
                    <option value="HVAC">HVAC (Điều hòa)</option>
                    <option value="Network">Network</option>
                    <option value="Other">Khác</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#334155', marginBottom: '6px' }}>Phân bổ *</label>
                  <select value={formData.allocation} onChange={e => setFormData({...formData, allocation: e.target.value as any})} style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '14px', backgroundColor: '#fff', cursor: 'pointer' }}>
                    <option value="Cố định">Cố định theo phòng</option>
                    <option value="Di động">Di động dùng chung</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#334155', marginBottom: '6px' }}>Vị trí / Phòng gán *</label>
                  <select value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})} style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '14px', backgroundColor: '#fff', cursor: 'pointer' }}>
                    <option value="Kho thiết bị di động">Kho thiết bị di động</option>
                    {availableRooms.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#334155', marginBottom: '6px' }}>Trạng thái hiện tại *</label>
                  <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value as any})} style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '14px', backgroundColor: '#fff', cursor: 'pointer' }}>
                    <option value="Sẵn sàng">Sẵn sàng</option>
                    <option value="Bảo dưỡng">Bảo dưỡng</option>
                    <option value="Hỏng hóc">Hỏng hóc / Sửa chữa</option>
                  </select>
                </div>
              </div>
              <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button type="button" onClick={() => setIsEditModalOpen(false)} style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', color: '#475569', fontWeight: '500', cursor: 'pointer' }}>Hủy bỏ</button>
                <button type="submit" style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', backgroundColor: '#2563eb', color: '#ffffff', fontWeight: '500', cursor: 'pointer' }}>Lưu thay đổi</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* HISTORY MODAL */}
      {historyModalDevice && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '20px', width: '100%', maxWidth: '500px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: '#f1f5f9', color: '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <History size={20} />
                </div>
                <div>
                  <h2 style={{ fontSize: '16px', fontWeight: 'bold', color: '#0f172a', margin: 0 }}>Nhật ký Thiết bị</h2>
                  <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>{historyModalDevice.name} ({historyModalDevice.serial})</p>
                </div>
              </div>
              <button onClick={() => setHistoryModalDevice(null)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            <div style={{ padding: '24px', overflowY: 'auto', maxHeight: '50vh', backgroundColor: '#ffffff' }}>
              <div style={{ position: 'relative', borderLeft: '2px solid #e2e8f0', marginLeft: '12px' }}>
                {historyModalDevice.history.map((hist, idx) => (
                  <div key={idx} style={{ position: 'relative', paddingLeft: '24px', paddingBottom: idx === historyModalDevice.history.length - 1 ? '0' : '24px' }}>
                    <div style={{ position: 'absolute', left: '-5px', top: '4px', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#64748b', border: '2px solid #ffffff' }}></div>
                    <div style={{ fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '4px' }}>{hist.date}</div>
                    <div style={{ fontSize: '14px', color: '#334155', backgroundColor: '#f8fafc', padding: '10px 14px', borderRadius: '8px', border: '1px solid #f1f5f9' }}>{hist.event}</div>
                  </div>
                ))}
              </div>
              {historyModalDevice.history.length === 0 && (
                <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: '14px', padding: '20px 0' }}>Không có nhật ký nào được ghi nhận.</div>
              )}
            </div>
            <div style={{ padding: '16px 24px', borderTop: '1px solid #e2e8f0', textAlign: 'right' }}>
              <button onClick={() => setHistoryModalDevice(null)} style={{ padding: '8px 16px', borderRadius: '8px', backgroundColor: '#f1f5f9', color: '#475569', border: 'none', fontWeight: '500', cursor: 'pointer' }}>Đóng</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default DevicesView;
