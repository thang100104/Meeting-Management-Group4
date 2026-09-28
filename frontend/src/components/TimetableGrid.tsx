import { useState, useEffect, Fragment } from 'react';
import { 
  X, Calendar as CalendarIcon, Clock, Box, 
  CheckCircle2, AlertCircle, Trash2 
} from 'lucide-react';

const TIME_SLOTS = [
  "07:00", "08:00", "09:00", "10:00", "11:00", 
  "12:00", "13:00", "14:00", "15:00", "16:00", "17:00"
];

const API_BASE = "http://localhost:8000/api/v1";

interface TimetableGridProps {
  token: string;
  userRole: string;
  currentUserId?: number;
}

export default function TimetableGrid({ token, userRole, currentUserId }: TimetableGridProps) {
  const [rooms, setRooms] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  
  // State for Booking Modal
  const [selectedSlot, setSelectedSlot] = useState<{roomId: number, time: string} | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  
  // Equipment selection state
  const [availableEquipments, setAvailableEquipments] = useState<any[]>([]);
  const [selectedEquipmentIds, setSelectedEquipmentIds] = useState<number[]>([]);
  const [loadingEquipments, setLoadingEquipments] = useState(false);

  // State for View Meeting Detail Modal
  const [detailMeeting, setDetailMeeting] = useState<any | null>(null);
  const [actionMsg, setActionMsg] = useState("");

  // 1. Fetch Rooms & Bookings
  const fetchData = async () => {
    if (!token) return;
    try {
      const roomRes = await fetch(`${API_BASE}/rooms`, { 
        headers: { Authorization: `Bearer ${token}` } 
      });
      const roomData = await roomRes.json();
      setRooms(roomData);

      const bookingRes = await fetch(`${API_BASE}/meetings?from_date=${selectedDate}&to_date=${selectedDate}`, { 
        headers: { Authorization: `Bearer ${token}` } 
      });
      const bookingData = await bookingRes.json();
      setBookings(bookingData);
    } catch (err) {
      console.error("Lỗi tải lịch họp:", err);
    }
  };

  useEffect(() => {
    fetchData();
  }, [token, selectedDate]);

  // 2. Khi chọn ô để đặt phòng -> Tự động nạp thiết bị khả dụng trong khung giờ đó
  const handleCellClick = async (roomId: number, time: string, isRestricted: boolean, booking: any) => {
    if (isRestricted) return;

    if (booking) {
      // Mở modal xem chi tiết cuộc họp đã đặt
      setDetailMeeting(booking);
      setActionMsg("");
      return;
    }

    // Mở modal đặt mới
    setSelectedSlot({ roomId, time });
    setError("");
    setSelectedEquipmentIds([]);
    setLoadingEquipments(true);

    const [h, m] = time.split(':');
    const endHour = parseInt(h) + 1;
    const start_time = `${selectedDate}T${time}:00`;
    const end_time = `${selectedDate}T${endHour.toString().padStart(2, '0')}:${m}:00`;

    try {
      const res = await fetch(
        `${API_BASE}/equipments?from_time=${encodeURIComponent(start_time)}&to_time=${encodeURIComponent(end_time)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) {
        const eqList = await res.json();
        setAvailableEquipments(eqList);
      }
    } catch (err) {
      console.error("Lỗi lấy danh sách thiết bị rảnh:", err);
    } finally {
      setLoadingEquipments(false);
    }
  };

  const handleToggleEquipment = (eqId: number) => {
    setSelectedEquipmentIds(prev => 
      prev.includes(eqId) ? prev.filter(id => id !== eqId) : [...prev, eqId]
    );
  };

  const handleBooking = async () => {
    if (!title.trim()) {
      setError("Vui lòng nhập tên cuộc họp");
      return;
    }
    
    // Parse time to ISO
    const start_time = `${selectedDate}T${selectedSlot?.time}:00`;
    const [h, m] = selectedSlot!.time.split(':');
    const endHour = parseInt(h) + 1;
    const end_time = `${selectedDate}T${endHour.toString().padStart(2, '0')}:${m}:00`;

    try {
      const res = await fetch(`${API_BASE}/meetings`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({
          room_id: selectedSlot?.roomId,
          title: title,
          description: description,
          start_time,
          end_time,
          equipment_ids: selectedEquipmentIds
        })
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.detail || "Có lỗi xảy ra khi tạo cuộc họp");
        return;
      }

      // Success
      setSelectedSlot(null);
      setTitle("");
      setDescription("");
      setSelectedEquipmentIds([]);
      fetchData(); // reload calendar
    } catch (_err) {
      setError("Lỗi kết nối API");
    }
  };

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

  const selectedRoom = rooms.find(r => r.room_id === selectedSlot?.roomId);

  return (
    <div className="ledger-container">
      <div className="ledger-header">
        <div>
          <h1>Lịch Đặt Phòng Họp & Phân Phối Thiết Bị</h1>
          <p className="subtitle">Nhấp vào ô trống để đặt phòng kèm thiết bị, hoặc nhấp vào lịch đã có để xem chi tiết</p>
        </div>
        <div className="ledger-filters">
          <input 
            type="date" 
            className="form-input" 
            value={selectedDate} 
            onChange={(e) => setSelectedDate(e.target.value)} 
          />
        </div>
      </div>

      <div className="ledger-grid-wrapper">
        <div 
          className="ledger-grid" 
          style={{ gridTemplateColumns: `80px repeat(${rooms.length || 1}, minmax(190px, 1fr))` }}
        >
          {/* Header Row */}
          <div className="ledger-col-header-corner"></div>
          {rooms.map(room => (
            <div key={room.room_id} className="ledger-col-header">
              <div className="room-title">{room.room_name}</div>
              <div className="room-meta">
                <span>{room.capacity} chỗ</span> • <span>{room.location}</span>
              </div>
            </div>
          ))}

          {/* Grid Rows */}
          {TIME_SLOTS.map(time => (
            <Fragment key={time}>
              <div className="ledger-time-label">{time}</div>
              {rooms.map(room => {
                // Tìm cuộc họp trong slot
                const booking = bookings.find(b => {
                  if (b.room_id !== room.room_id || b.status === "CANCELLED") return false;
                  const bTime = b.start_time.split('T')[1].substring(0, 5);
                  return bTime === time;
                });
                
                const isRestricted = room.restrictions?.some((r: any) => r.role_id === 3 && userRole === 'PARTICIPANT'); 
                
                return (
                  <div 
                    key={`${room.room_id}-${time}`} 
                    className={`ledger-cell ${booking ? 'is-booked' : ''} ${isRestricted && !booking ? 'is-restricted' : ''}`}
                    onClick={() => handleCellClick(room.room_id, time, isRestricted, booking)}
                  >
                    {booking && (
                      <div className="booking-block">
                        <div className="booking-title">{booking.title}</div>
                        <div className="booking-meta-row">
                          <span className="booking-org">ID: {booking.organizer_id}</span>
                          {booking.equipments && booking.equipments.length > 0 && (
                            <span className="equipment-chip" title={`Có mượn ${booking.equipments.length} thiết bị`}>
                              <Box size={11} /> {booking.equipments.length} TB
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </Fragment>
          ))}
        </div>
      </div>

      {/* MODAL 1: ĐẶT PHÒNG KÈM THIẾT BỊ (US #1, #12) */}
      {selectedSlot && (
        <div className="modal-overlay" onClick={() => setSelectedSlot(null)}>
          <div className="modal-content modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Đăng Ký Mượn Phòng & Thiết Bị (US #12)</h2>
              <button className="modal-close" onClick={() => setSelectedSlot(null)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <div className="booking-summary-banner">
                <div className="summary-item">
                  <CalendarIcon size={16} />
                  <span><strong>{selectedRoom?.room_name}</strong> ({selectedRoom?.capacity} chỗ)</span>
                </div>
                <div className="summary-item">
                  <Clock size={16} />
                  <span>Khung giờ: <strong>{selectedSlot.time} - {parseInt(selectedSlot.time.split(':')[0]) + 1}:00</strong> ({selectedDate})</span>
                </div>
              </div>

              {error && (
                <div className="alert alert-danger" style={{ marginBottom: '1rem' }}>
                  <AlertCircle size={18} /> {error}
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Tên cuộc họp *</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="VD: Họp giao ban, Bảo vệ đồ án tốt nghiệp..." 
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  autoFocus 
                />
              </div>

              <div className="form-group">
                <label className="form-label">Mục đích & Ghi chú họp</label>
                <textarea 
                  className="form-input" 
                  rows={2} 
                  placeholder="Nội dung tóm tắt hoặc yêu cầu hỗ trợ kỹ thuật..."
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                ></textarea>
              </div>

              {/* PHÂN HỆ CHỌN THIẾT BỊ KÈM THEO (US #12) */}
              <div className="form-group">
                <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Chọn thiết bị mượn kèm ({selectedEquipmentIds.length} đã chọn)</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-gray-600)' }}>
                    Tự động loại trừ thiết bị bận hoặc bảo dưỡng
                  </span>
                </label>

                {loadingEquipments ? (
                  <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--color-gray-600)' }}>
                    Đang kiểm tra tình trạng thiết bị...
                  </div>
                ) : availableEquipments.length === 0 ? (
                  <div className="alert alert-info">Không có thiết bị khả dụng trong hệ thống.</div>
                ) : (
                  <div className="equipment-select-list">
                    {/* 1. Thiết bị gắn tại phòng này */}
                    <div className="eq-group-title">🏢 Thiết bị gắn cố định tại {selectedRoom?.room_name}</div>
                    {availableEquipments.filter(eq => eq.room_id === selectedSlot.roomId).length === 0 ? (
                      <div className="eq-empty-hint">Không có thiết bị cố định nào tại phòng này.</div>
                    ) : (
                      availableEquipments
                        .filter(eq => eq.room_id === selectedSlot.roomId)
                        .map(eq => {
                          const isUnavailable = !eq.is_available_in_slot;
                          const isChecked = selectedEquipmentIds.includes(eq.equipment_id);
                          return (
                            <label 
                              key={eq.equipment_id} 
                              className={`eq-checkbox-item ${isUnavailable ? 'disabled' : ''} ${isChecked ? 'selected' : ''}`}
                            >
                              <input 
                                type="checkbox"
                                disabled={isUnavailable}
                                checked={isChecked}
                                onChange={() => handleToggleEquipment(eq.equipment_id)}
                              />
                              <div className="eq-item-content">
                                <span className="eq-item-name">{eq.equipment_name}</span>
                                <span className="eq-item-sub">Loại: {eq.equipment_type} • Serial: {eq.serial_number || 'N/A'}</span>
                              </div>
                              {isUnavailable && (
                                <span className="eq-conflict-badge" title={eq.conflict_reason || ''}>
                                  {eq.status !== 'AVAILABLE' ? eq.status : 'Đã có người mượn'}
                                </span>
                              )}
                            </label>
                          );
                        })
                    )}

                    {/* 2. Thiết bị di động dùng chung */}
                    <div className="eq-group-title" style={{ marginTop: '0.75rem' }}>
                      📦 Thiết bị di động dùng chung (Có thể mượn mang vào phòng)
                    </div>
                    {availableEquipments.filter(eq => eq.room_id === null).map(eq => {
                      const isUnavailable = !eq.is_available_in_slot;
                      const isChecked = selectedEquipmentIds.includes(eq.equipment_id);
                      return (
                        <label 
                          key={eq.equipment_id} 
                          className={`eq-checkbox-item ${isUnavailable ? 'disabled' : ''} ${isChecked ? 'selected' : ''}`}
                        >
                          <input 
                            type="checkbox"
                            disabled={isUnavailable}
                            checked={isChecked}
                            onChange={() => handleToggleEquipment(eq.equipment_id)}
                          />
                          <div className="eq-item-content">
                            <span className="eq-item-name">{eq.equipment_name}</span>
                            <span className="eq-item-sub">Loại: {eq.equipment_type} • Serial: {eq.serial_number || 'N/A'}</span>
                          </div>
                          {isUnavailable && (
                            <span className="eq-conflict-badge" title={eq.conflict_reason || ''}>
                              {eq.status !== 'AVAILABLE' ? eq.status : 'Đã có người mượn'}
                            </span>
                          )}
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setSelectedSlot(null)}>Hủy bỏ</button>
              <button className="btn btn-primary" onClick={handleBooking}>Xác nhận Đặt phòng & Thiết bị</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: XEM CHI TIẾT CUỘC HỌP & THIẾT BỊ ĐÃ MƯỢN */}
      {detailMeeting && (
        <div className="modal-overlay" onClick={() => setDetailMeeting(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '520px' }}>
            <div className="modal-header">
              <h2>Chi Tiết Lịch Họp (ID: #{detailMeeting.meeting_id})</h2>
              <button className="modal-close" onClick={() => setDetailMeeting(null)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
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
                    {detailMeeting.start_time.replace('T', ' ').substring(0, 16)} ➔ {detailMeeting.end_time.split('T')[1].substring(0, 5)}
                  </span>
                </div>
                <div className="detail-meta-row">
                  <span className="label">Người tổ chức:</span>
                  <span className="value">User ID #{detailMeeting.organizer_id}</span>
                </div>
                <div className="detail-meta-row">
                  <span className="label">Trạng thái:</span>
                  <span className="badge badge-success">{detailMeeting.status}</span>
                </div>
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

            <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
              <div>
                {(userRole === 'ADMIN' || currentUserId === detailMeeting.organizer_id) && (
                  <button 
                    className="btn btn-ghost" 
                    style={{ color: '#ef4444', borderColor: '#fca5a5' }}
                    onClick={() => handleCancelMeeting(detailMeeting.meeting_id)}
                  >
                    <Trash2 size={16} /> Hủy cuộc họp
                  </button>
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
