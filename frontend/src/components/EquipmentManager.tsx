import { useState, useEffect, type FormEvent } from 'react';
import { 
  Plus, Search, Filter, Wrench, Tv, Mic, Speaker, Camera, 
  Laptop, CheckCircle2, AlertTriangle, XCircle, Trash2, Edit3, 
  X, RefreshCw, Box
} from 'lucide-react';

const API_BASE = "http://localhost:8000/api/v1";

interface Equipment {
  equipment_id: number;
  equipment_name: string;
  equipment_type: string;
  serial_number: string | null;
  room_id: number | null;
  room_name?: string | null;
  status: string;
  description: string | null;
  is_available_in_slot?: boolean;
  conflict_reason?: string | null;
}

interface EquipmentStats {
  total: number;
  available: number;
  maintenance: number;
  broken: number;
  portable_count: number;
  in_rooms_count: number;
}

interface EquipmentManagerProps {
  token: string;
  userRole: string;
}

export default function EquipmentManager({ token, userRole }: EquipmentManagerProps) {
  const [equipments, setEquipments] = useState<Equipment[]>([]);
  const [stats, setStats] = useState<EquipmentStats | null>(null);
  const [rooms, setRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  
  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentId, setCurrentId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    equipment_name: '',
    equipment_type: 'PROJECTOR',
    serial_number: '',
    room_id: 0,
    status: 'AVAILABLE',
    description: ''
  });
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const isAdmin = userRole === 'ADMIN';

  const fetchData = async () => {
    if (!token) return;
    setLoading(true);
    try {
      // 1. Fetch Stats
      const resStats = await fetch(`${API_BASE}/equipments/stats/summary`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (resStats.ok) {
        const statsData = await resStats.json();
        setStats(statsData);
      }

      // 2. Fetch Equipments
      let url = `${API_BASE}/equipments?`;
      if (searchTerm) url += `search=${encodeURIComponent(searchTerm)}&`;
      if (typeFilter) url += `equipment_type=${typeFilter}&`;
      if (statusFilter) url += `status=${statusFilter}&`;

      const resEq = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (resEq.ok) {
        const eqData = await resEq.json();
        setEquipments(eqData);
      }

      // 3. Fetch Rooms for dropdown
      const resRooms = await fetch(`${API_BASE}/rooms`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (resRooms.ok) {
        const roomsData = await resRooms.json();
        setRooms(roomsData);
      }
    } catch (err) {
      console.error("Lỗi nạp dữ liệu thiết bị:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [token, searchTerm, typeFilter, statusFilter]);

  const handleOpenAdd = () => {
    setIsEditing(false);
    setCurrentId(null);
    setFormData({
      equipment_name: '',
      equipment_type: 'PROJECTOR',
      serial_number: '',
      room_id: 0,
      status: 'AVAILABLE',
      description: ''
    });
    setErrorMsg('');
    setShowModal(true);
  };

  const handleOpenEdit = (eq: Equipment) => {
    setIsEditing(true);
    setCurrentId(eq.equipment_id);
    setFormData({
      equipment_name: eq.equipment_name,
      equipment_type: eq.equipment_type,
      serial_number: eq.serial_number || '',
      room_id: eq.room_id || 0,
      status: eq.status,
      description: eq.description || ''
    });
    setErrorMsg('');
    setShowModal(true);
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!formData.equipment_name.trim()) {
      setErrorMsg('Vui lòng nhập tên thiết bị');
      return;
    }

    const payload: any = {
      equipment_name: formData.equipment_name.trim(),
      equipment_type: formData.equipment_type,
      serial_number: formData.serial_number.trim() || null,
      room_id: formData.room_id === 0 ? null : Number(formData.room_id),
      status: formData.status,
      description: formData.description.trim() || null
    };

    try {
      let res;
      if (isEditing && currentId) {
        res = await fetch(`${API_BASE}/equipments/${currentId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify(payload)
        });
      } else {
        res = await fetch(`${API_BASE}/equipments`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify(payload)
        });
      }

      if (!res.ok) {
        const data = await res.json();
        setErrorMsg(data.detail || 'Thao tác không thành công');
        return;
      }

      setShowModal(false);
      setSuccessMsg(isEditing ? 'Cập nhật thiết bị thành công!' : 'Thêm thiết bị mới thành công!');
      setTimeout(() => setSuccessMsg(''), 3000);
      fetchData();
    } catch (_err) {
      setErrorMsg('Lỗi kết nối máy chủ');
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa thiết bị "${name}"?`)) return;
    try {
      const res = await fetch(`${API_BASE}/equipments/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.detail || 'Xóa thiết bị thất bại');
        return;
      }
      setSuccessMsg(`Đã xóa thiết bị "${name}"`);
      setTimeout(() => setSuccessMsg(''), 3000);
      fetchData();
    } catch (_err) {
      alert('Lỗi kết nối mạng');
    }
  };

  const handleQuickStatusChange = async (eq: Equipment, newStatus: string) => {
    try {
      const res = await fetch(`${API_BASE}/equipments/${eq.equipment_id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const getEquipmentIcon = (type: string) => {
    switch (type.toUpperCase()) {
      case 'PROJECTOR':
        return <Laptop size={20} className="icon-blue" />;
      case 'TV':
        return <Tv size={20} className="icon-purple" />;
      case 'MICROPHONE':
        return <Mic size={20} className="icon-orange" />;
      case 'SPEAKER':
        return <Speaker size={20} className="icon-indigo" />;
      case 'CAMERA':
        return <Camera size={20} className="icon-teal" />;
      case 'SMARTBOARD':
        return <Tv size={20} className="icon-green" />;
      default:
        return <Box size={20} className="icon-gray" />;
    }
  };

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'AVAILABLE':
        return (
          <span className="badge badge-success">
            <CheckCircle2 size={13} /> Sẵn sàng
          </span>
        );
      case 'MAINTENANCE':
        return (
          <span className="badge badge-warning">
            <Wrench size={13} /> Đang bảo trì
          </span>
        );
      case 'BROKEN':
        return (
          <span className="badge badge-danger">
            <XCircle size={13} /> Hỏng hóc
          </span>
        );
      default:
        return <span className="badge badge-neutral">{status}</span>;
    }
  };

  return (
    <div className="equipment-manager">
      {/* Header & Controls */}
      <div className="eq-header">
        <div>
          <h2>Quản lý Danh mục Thiết bị & Vật tư (US #12, #13, #14)</h2>
          <p className="subtitle">
            Theo dõi hiện trạng, cấu hình phòng gán và cấp phát mượn kèm cuộc họp
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn btn-ghost" onClick={fetchData} title="Làm mới">
            <RefreshCw size={16} /> Làm mới
          </button>
          {isAdmin && (
            <button className="btn btn-primary" onClick={handleOpenAdd}>
              <Plus size={18} /> Thêm thiết bị mới
            </button>
          )}
        </div>
      </div>

      {successMsg && (
        <div className="alert alert-success">
          <CheckCircle2 size={18} /> {successMsg}
        </div>
      )}

      {/* KPI Stats Cards */}
      {stats && (
        <div className="eq-stats-grid">
          <div className="stat-card">
            <div className="stat-icon total"><Box size={24} /></div>
            <div>
              <div className="stat-num">{stats.total}</div>
              <div className="stat-label">Tổng thiết bị</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon available"><CheckCircle2 size={24} /></div>
            <div>
              <div className="stat-num">{stats.available}</div>
              <div className="stat-label">Sẵn sàng sử dụng</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon maintenance"><Wrench size={24} /></div>
            <div>
              <div className="stat-num">{stats.maintenance}</div>
              <div className="stat-label">Đang bảo dưỡng</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon broken"><XCircle size={24} /></div>
            <div>
              <div className="stat-num">{stats.broken}</div>
              <div className="stat-label">Hỏng hóc / Chờ sửa</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon portable"><Laptop size={24} /></div>
            <div>
              <div className="stat-num">{stats.portable_count}</div>
              <div className="stat-label">Thiết bị di động dùng chung</div>
            </div>
          </div>
        </div>
      )}

      {/* Filters Toolbar */}
      <div className="eq-toolbar">
        <div className="search-box">
          <Search size={18} className="search-icon" />
          <input 
            type="text" 
            placeholder="Tìm theo tên thiết bị, mã Serial..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="form-input search-input"
          />
        </div>

        <div className="filter-group">
          <Filter size={18} color="var(--color-gray-600)" />
          <select 
            value={typeFilter} 
            onChange={e => setTypeFilter(e.target.value)}
            className="form-input form-select"
          >
            <option value="">Tất cả loại thiết bị</option>
            <option value="PROJECTOR">Máy chiếu (Projector)</option>
            <option value="TV">Màn hình / TV</option>
            <option value="MICROPHONE">Microphone</option>
            <option value="SMARTBOARD">Bảng tương tác thông minh</option>
            <option value="SPEAKER">Hệ thống Loa</option>
            <option value="CAMERA">Camera họp trực tuyến</option>
            <option value="OTHER">Phụ kiện & Khác</option>
          </select>

          <select 
            value={statusFilter} 
            onChange={e => setStatusFilter(e.target.value)}
            className="form-input form-select"
          >
            <option value="">Tất cả trạng thái</option>
            <option value="AVAILABLE">Sẵn sàng (Available)</option>
            <option value="MAINTENANCE">Bảo trì (Maintenance)</option>
            <option value="BROKEN">Hỏng hóc (Broken)</option>
          </select>
        </div>
      </div>

      {/* Equipment Cards Grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-gray-600)' }}>
          Đang tải dữ liệu thiết bị...
        </div>
      ) : equipments.length === 0 ? (
        <div className="empty-state">
          <Box size={48} color="var(--color-gray-400)" />
          <p>Không tìm thấy thiết bị nào phù hợp với bộ lọc</p>
        </div>
      ) : (
        <div className="equipment-grid">
          {equipments.map(eq => (
            <div key={eq.equipment_id} className={`eq-card ${eq.status.toLowerCase()}`}>
              <div className="eq-card-header">
                <div className="eq-icon-wrapper">
                  {getEquipmentIcon(eq.equipment_type)}
                </div>
                <div style={{ flex: 1 }}>
                  <div className="eq-type">{eq.equipment_type}</div>
                  <h3 className="eq-name" title={eq.equipment_name}>{eq.equipment_name}</h3>
                </div>
                {renderStatusBadge(eq.status)}
              </div>

              <div className="eq-card-body">
                <div className="eq-meta-row">
                  <span className="meta-label">Mã Serial:</span>
                  <span className="meta-val font-mono">{eq.serial_number || 'Chưa gán'}</span>
                </div>
                <div className="eq-meta-row">
                  <span className="meta-label">Vị trí:</span>
                  <span className="meta-val">
                    {eq.room_id ? (
                      <span className="location-badge in-room">{eq.room_name}</span>
                    ) : (
                      <span className="location-badge portable">Di động dùng chung</span>
                    )}
                  </span>
                </div>
                {eq.description && (
                  <p className="eq-desc" title={eq.description}>
                    {eq.description}
                  </p>
                )}
              </div>

              {isAdmin && (
                <div className="eq-card-actions">
                  <div className="status-dropdown">
                    <select 
                      value={eq.status} 
                      onChange={(e) => handleQuickStatusChange(eq, e.target.value)}
                      className="form-input form-select-sm"
                    >
                      <option value="AVAILABLE">Sẵn sàng</option>
                      <option value="MAINTENANCE">Bảo dưỡng</option>
                      <option value="BROKEN">Báo hỏng</option>
                    </select>
                  </div>

                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <button 
                      className="btn-icon" 
                      onClick={() => handleOpenEdit(eq)}
                      title="Chỉnh sửa thiết bị"
                    >
                      <Edit3 size={16} />
                    </button>
                    <button 
                      className="btn-icon btn-icon-danger" 
                      onClick={() => handleDelete(eq.equipment_id, eq.equipment_name)}
                      title="Xóa thiết bị"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal Add / Edit Equipment */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '580px' }}>
            <div className="modal-header">
              <h2>{isEditing ? 'Cập nhật thiết bị' : 'Thêm thiết bị mới (Admin)'}</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSave}>
              <div className="modal-body">
                {errorMsg && (
                  <div className="alert alert-danger" style={{ marginBottom: '1rem' }}>
                    <AlertTriangle size={18} /> {errorMsg}
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">Tên thiết bị *</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="VD: Máy chiếu Laser Sony 4K, Loa di động..."
                    value={formData.equipment_name}
                    onChange={e => setFormData({ ...formData, equipment_name: e.target.value })}
                    required
                  />
                </div>

                <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">Loại thiết bị *</label>
                    <select 
                      className="form-input"
                      value={formData.equipment_type}
                      onChange={e => setFormData({ ...formData, equipment_type: e.target.value })}
                    >
                      <option value="PROJECTOR">Máy chiếu (Projector)</option>
                      <option value="TV">Màn hình / TV</option>
                      <option value="MICROPHONE">Microphone</option>
                      <option value="SMARTBOARD">Bảng tương tác Maxhub</option>
                      <option value="SPEAKER">Hệ thống Loa</option>
                      <option value="CAMERA">Camera họp trực tuyến</option>
                      <option value="OTHER">Khác</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Số Serial / Mã định danh</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="VD: PRJ-SNY-01"
                      value={formData.serial_number}
                      onChange={e => setFormData({ ...formData, serial_number: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">Vị trí bố trí</label>
                    <select 
                      className="form-input"
                      value={formData.room_id}
                      onChange={e => setFormData({ ...formData, room_id: Number(e.target.value) })}
                    >
                      <option value="0">📦 Thiết bị di động dùng chung</option>
                      {rooms.map(r => (
                        <option key={r.room_id} value={r.room_id}>
                          🏢 Gắn tại {r.room_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Tình trạng ban đầu</label>
                    <select 
                      className="form-input"
                      value={formData.status}
                      onChange={e => setFormData({ ...formData, status: e.target.value })}
                    >
                      <option value="AVAILABLE">🟢 Sẵn sàng (Available)</option>
                      <option value="MAINTENANCE">🟡 Đang bảo trì (Maintenance)</option>
                      <option value="BROKEN">🔴 Hỏng hóc (Broken)</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Mô tả thông số kỹ thuật & Ghi chú</label>
                  <textarea 
                    className="form-input" 
                    rows={3} 
                    placeholder="Độ phân giải, phụ kiện đi kèm, hướng dẫn cắm nối..."
                    value={formData.description}
                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                  ></textarea>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>
                  Hủy
                </button>
                <button type="submit" className="btn btn-primary">
                  {isEditing ? 'Lưu thay đổi' : 'Tạo thiết bị'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
