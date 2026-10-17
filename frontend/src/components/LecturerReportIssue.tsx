import React, { useState, useEffect } from 'react';
import { AlertTriangle, Clock, Wrench, Send, CheckCircle2 as CheckCircle, Search, Filter, Plus, X, FileText } from 'lucide-react';

interface Incident {
  id: string;
  reporterName: string;
  reporterEmail: string;
  category: string;
  targetItem: string;
  location: string;
  priority: string;
  description: string;
  status: 'Chờ tiếp nhận' | 'Đang xử lý' | 'Đã khắc phục';
  techNote?: string;
  createdAt: string;
}

export default function LecturerReportIssue({ userProfile }: { userProfile: any }) {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('Tất cả');

  // Form State
  const [category, setCategory] = useState('Phòng họp / Giảng đường');
  const [targetItem, setTargetItem] = useState('');
  const [location, setLocation] = useState('');
  const [priority, setPriority] = useState('Bình thường');
  const [description, setDescription] = useState('');

  // Storage data
  const [borrowedEquipments, setBorrowedEquipments] = useState<any[]>([]);
  const [roomBookings, setRoomBookings] = useState<any[]>([]);

  useEffect(() => {
    loadIncidents();
    loadContextData();
  }, [userProfile]);

  const loadContextData = () => {
    const eq = localStorage.getItem('meetinghub_borrowed_items');
    if (eq) {
      try {
        setBorrowedEquipments(JSON.parse(eq).filter((i: any) => i.status === 'Đang mượn' || i.status === 'Quá hạn trả'));
      } catch (e) {}
    }
    const rb = localStorage.getItem('room_bookings');
    if (rb) {
      try {
        const today = new Date().toISOString().split('T')[0];
        setRoomBookings(JSON.parse(rb).filter((r: any) => r.date === today && r.lecturerEmail === userProfile?.email));
      } catch (e) {}
    }
  };

  const cancelIncident = (id: string) => {
    if (window.confirm('Bạn có chắc chắn muốn hủy báo cáo sự cố này?')) {
      const updated = incidents.map(inc => inc.id === id ? { ...inc, status: 'Đã khắc phục' as const, techNote: 'Giảng viên đã tự hủy báo cáo.' } : inc);
      setIncidents(updated);
      try {
        localStorage.setItem('meetinghub_incidents', JSON.stringify(updated));
      } catch (e) {}
    }
  };

  const loadIncidents = () => {
    let allIncidents: Incident[] = [];
    const userEmail = userProfile?.email || 'lecturer@school.edu.vn';
    const userName = userProfile?.fullName || 'Giảng viên';

    const defaultIncidents: Incident[] = [
      {
        id: 'INC_101',
        reporterName: userName,
        reporterEmail: userEmail,
        category: 'Thiết bị giảng dạy',
        targetItem: 'Loa hội trường JBL (SN-SP-088)',
        location: 'Phòng Hội trường B1',
        priority: 'Cần gấp',
        description: 'Loa bị rè và mất tiếng đột ngột trong khi đang giảng dạy.',
        status: 'Đang xử lý',
        techNote: 'Đã cử kỹ thuật viên mang loa dự phòng sang thay thế.',
        createdAt: new Date(Date.now() - 3600000).toLocaleString('vi-VN')
      },
      {
        id: 'INC_102',
        reporterName: userName,
        reporterEmail: userEmail,
        category: 'Phòng họp / Giảng đường',
        targetItem: 'Điều hòa phòng A102',
        location: 'Phòng A102',
        priority: 'Bình thường',
        description: 'Điều hòa chảy nước nhẹ ở góc bên phải.',
        status: 'Đã khắc phục',
        techNote: 'Đã vệ sinh ống thoát nước và kiểm tra lại.',
        createdAt: new Date(Date.now() - 86400000 * 2).toLocaleString('vi-VN')
      }
    ];

    try {
      const saved = localStorage.getItem('meetinghub_incidents');
      if (saved) {
        allIncidents = JSON.parse(saved);
      }
    } catch (e) {
      console.error('Failed to parse meetinghub_incidents from localStorage', e);
      allIncidents = [];
    }

    // Filter by user
    let userIncidents = (allIncidents || []).filter(inc => inc.reporterEmail === userEmail);

    if (userIncidents.length === 0) {
      allIncidents = [...allIncidents, ...defaultIncidents];
      try {
        localStorage.setItem('meetinghub_incidents', JSON.stringify(allIncidents));
      } catch (e) { }
      userIncidents = defaultIncidents;
    }


    // Sort descending by timestamp in id if we assume INC_ timestamp format
    (userIncidents || []).sort((a, b) => b.id.localeCompare(a.id));
    setIncidents(userIncidents);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetItem.trim() || !location.trim() || !description.trim()) {
      alert('Vui lòng điền đầy đủ Thiết bị lỗi, Vị trí và Mô tả sự cố!');
      return;
    }

    const newIncident: Incident = {
      id: 'INC_' + Date.now(),
      reporterName: userProfile?.fullName || 'Giảng viên',
      reporterEmail: userProfile?.email || '',
      category,
      targetItem,
      location,
      priority,
      description,
      status: 'Chờ tiếp nhận',
      createdAt: new Date().toLocaleString('vi-VN')
    };

    const saved = localStorage.getItem('meetinghub_incidents');
    let allIncidents: Incident[] = [];
    try {
      if (saved) allIncidents = JSON.parse(saved);
    } catch (e) {
      allIncidents = [];
    }
    allIncidents.push(newIncident);
    try {
      localStorage.setItem('meetinghub_incidents', JSON.stringify(allIncidents));
    } catch (e) { }

    alert('✓ Báo cáo sự cố đã được gửi tới Ban quản lý & Kỹ thuật viên!');

    // Reset Form
    setCategory('Phòng họp / Giảng đường');
    setTargetItem('');
    setLocation('');
    setPriority('Bình thường');
    setDescription('');

    loadIncidents();
  };

  const filteredIncidents = (incidents || []).filter(inc => {
    if (filterStatus !== 'Tất cả' && inc.status !== filterStatus) return false;
    return true;
  });

  const getPriorityStyle = (pri: string) => {
    return { color: '#475569', bg: '#f8fafc', border: '#e2e8f0' };
  };

  const getStatusBadge = (status: string) => {
    return <span className="bg-slate-100 text-slate-700 text-xs px-2.5 py-1 rounded-md font-medium">{status}</span>;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', paddingBottom: '40px', height: '100%' }}>

      {/* Header */}
      <div>
        <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: '#0f172a', margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
          Báo cáo sự cố
        </h2>
        <p style={{ color: '#64748b', margin: 0, fontSize: '15px' }}>Báo cáo các hỏng hóc hoặc sự cố trong quá trình giảng dạy để Kỹ thuật viên hỗ trợ kịp thời.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '32px', alignItems: 'start' }}>

        {/* CỘT TRÁI: FORM BÁO CÁO */}
        <div style={{ backgroundColor: 'white', borderRadius: '24px', padding: '32px', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#0f172a', margin: '0 0 24px 0', borderBottom: '2px solid #f1f5f9', paddingBottom: '16px' }}>Tạo báo cáo mới</h3>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            {/* Phân loại */}
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#334155', marginBottom: '8px' }}>Phân loại sự cố <span style={{ color: '#ef4444' }}>*</span></label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid #cbd5e1', fontSize: '15px', outline: 'none', appearance: 'none', backgroundColor: '#f8fafc' }}
                className="focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
              >
                <option value="Phòng họp / Giảng đường">Phòng họp / Giảng đường</option>
                <option value="Thiết bị mượn">Thiết bị mượn</option>
                <option value="Cơ sở vật chất">Cơ sở vật chất</option>
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              {/* Thiết bị lỗi */}
              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#334155', marginBottom: '8px' }}>Tên thiết bị / Vấn đề <span style={{ color: '#ef4444' }}>*</span></label>
                  <input
                    type="text"
                    value={targetItem}
                    list={category === 'Thiết bị mượn' || category === 'Thiết bị giảng dạy' ? "borrowed-suggestions" : undefined}
                    onChange={(e) => {
                      const val = e.target.value;
                      setTargetItem(val);
                      if (category === 'Thiết bị mượn' || category === 'Thiết bị giảng dạy') {
                        const matched = borrowedEquipments.find(eq => `${eq.equipmentName} (${eq.equipmentCode})` === val);
                        if (matched && matched.location) setLocation(matched.location);
                      }
                    }}
                    style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid #cbd5e1', fontSize: '15px', outline: 'none', backgroundColor: '#ffffff' }}
                    className="focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition-all"
                    required
                  />
                  <datalist id="borrowed-suggestions">
                    {borrowedEquipments.map((eq: any) => (
                      <option key={eq.id} value={`${eq.equipmentName} (${eq.equipmentCode})`} />
                    ))}
                  </datalist>
              </div>

              {/* Vị trí */}
              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#334155', marginBottom: '8px' }}>Vị trí / Phòng <span style={{ color: '#ef4444' }}>*</span></label>
                  <input
                    type="text"
                    value={location}
                    list={category === 'Phòng họp / Giảng đường' ? "room-suggestions" : undefined}
                    onChange={(e) => setLocation(e.target.value)}
                    style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid #cbd5e1', fontSize: '15px', outline: 'none', backgroundColor: '#ffffff' }}
                    className="focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition-all"
                    required
                  />
                  <datalist id="room-suggestions">
                    {roomBookings.map((r: any) => (
                      <option key={r.id} value={r.roomName} />
                    ))}
                  </datalist>
              </div>
            </div>

            {/* Mức độ ưu tiên */}
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#334155', marginBottom: '12px' }}>Mức độ ưu tiên <span style={{ color: '#ef4444' }}>*</span></label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                {['Bình thường', 'Cần gấp', 'Khẩn cấp (Giờ dạy)'].map(pri => {
                  const style = getPriorityStyle(pri);
                  const isSelected = priority === pri;
                  return (
                    <label key={pri} style={{ cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="priority"
                        value={pri}
                        checked={isSelected}
                        onChange={(e) => setPriority(e.target.value)}
                        style={{ display: 'none' }}
                      />
                      <div className={`border py-2.5 px-4 rounded-lg text-center transition-all ${isSelected ? 'border-slate-900 bg-slate-50 text-slate-900 font-medium' : 'border-slate-200 text-slate-600'}`}>
                        <span style={{ fontSize: '13px' }}>
                          {pri}
                        </span>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Mô tả */}
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#334155', marginBottom: '8px' }}>Mô tả chi tiết hiện tượng <span style={{ color: '#ef4444' }}>*</span></label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                style={{ width: '100%', padding: '16px', borderRadius: '12px', border: '1px solid #cbd5e1', fontSize: '15px', outline: 'none', minHeight: '120px', resize: 'vertical', backgroundColor: '#ffffff', lineHeight: 1.5 }}
                className="focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition-all"
                required
              ></textarea>
            </div>

            {/* Image Upload */}
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#334155', marginBottom: '8px' }}>Hình ảnh minh chứng (Không bắt buộc)</label>
              <div className="border-dashed border-2 border-slate-200 p-4 text-center rounded-xl hover:border-slate-400 cursor-pointer transition-colors">
                <span className="text-slate-500 text-sm font-medium">
                  Nhấn để chọn ảnh hoặc kéo thả vào đây
                </span>
              </div>
            </div>

            <button
              type="submit"
              className="bg-slate-900 hover:bg-slate-800 text-white font-medium py-3 rounded-xl transition-all shadow-sm w-full mt-4"
            >
              Gửi Báo Cáo Sự Cố
            </button>
          </form>
        </div>

        {/* CỘT PHẢI: LỊCH SỬ SỰ CỐ */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          <div className="bg-slate-100 p-1 rounded-xl flex gap-1">
            {['Tất cả', 'Chờ tiếp nhận', 'Đang xử lý', 'Đã khắc phục'].map(tab => (
              <button
                key={tab}
                onClick={() => setFilterStatus(tab)}
                className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${filterStatus === tab ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', flex: 1, overflowY: 'auto' }}>
            {(filteredIncidents || []).map(inc => {
              const priStyle = getPriorityStyle(inc.priority);
              return (
                <div key={inc.id} className="bg-white border border-slate-200/80 rounded-xl p-4 space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="text-sm font-bold text-slate-900 mb-1">{inc.targetItem}</div>
                      <div className="text-xs text-slate-500">
                        {inc.location} • {inc.createdAt}
                      </div>
                    </div>
                    {getStatusBadge(inc.status)}
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-md">
                      {inc.priority}
                    </span>
                    <span className="text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-md">
                      {inc.category}
                    </span>
                  </div>

                  <div className="text-sm text-slate-700 mt-2 relative">
                    {inc.description}
                    {inc.status === 'Chờ tiếp nhận' && (
                      <button 
                        onClick={() => cancelIncident(inc.id)}
                        className="absolute right-0 top-0 text-red-500 hover:text-red-700 text-xs font-medium bg-red-50 px-2 py-0.5 rounded"
                      >
                        Hủy báo cáo
                      </button>
                    )}
                  </div>

                  {inc.techNote && (
                    <div className="bg-slate-50 border-l-2 border-slate-400 p-3 text-xs text-slate-700 rounded-r-lg mt-3">
                      <div className="font-semibold mb-1">Phản hồi từ Kỹ thuật viên:</div>
                      <div>{inc.techNote}</div>
                    </div>
                  )}
                </div>
              );
            })}

            {filteredIncidents.length === 0 && (
              <div style={{ padding: '60px 20px', textAlign: 'center', backgroundColor: 'white', borderRadius: '24px', border: '1px dashed #cbd5e1' }}>
                <CheckCircle size={48} color="#94a3b8" style={{ margin: '0 auto 16px auto', opacity: 0.5 }} />
                <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: '#475569', margin: '0 0 4px 0' }}>Không có báo cáo nào</h3>
                <p style={{ color: '#94a3b8', margin: 0, fontSize: '14px' }}>Tất cả các phòng và thiết bị đều đang hoạt động tốt.</p>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
