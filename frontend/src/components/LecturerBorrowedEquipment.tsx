import React, { useState, useEffect } from 'react';
import { Search, Package, Clock, AlertTriangle, CheckCircle, Info, Calendar, MapPin, Wrench, X } from 'lucide-react';

interface BorrowedItem {
  id: string;
  equipmentCode: string;
  equipmentName: string;
  quantity: number;
  location: string;
  borrowTime: string; // e.g. "07:00 - 30/09/2026"
  returnDeadline: string; // e.g. "11:30 - 30/09/2026"
  status: 'Đang mượn' | 'Đã trả';
  isOverdue: boolean;
  lecturerEmail?: string;
}

export default function LecturerBorrowedEquipment({ userProfile }: { userProfile: any }) {
  const [borrowedItems, setBorrowedItems] = useState<BorrowedItem[]>([]);
  const [activeTab, setActiveTab] = useState<'Đang mượn' | 'Đã trả'>('Đang mượn');
  const [searchQuery, setSearchQuery] = useState('');

  // Return Modal State
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<BorrowedItem | null>(null);
  const [condition, setCondition] = useState('Mới/Tốt');
  const [returnNotes, setReturnNotes] = useState('');

  // Report Issue Modal State
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [selectedReportItem, setSelectedReportItem] = useState<BorrowedItem | null>(null);
  const [incidentType, setIncidentType] = useState('Thiết bị không lên nguồn');
  const [incidentSeverity, setIncidentSeverity] = useState('Trung bình');
  const [incidentDesc, setIncidentDesc] = useState('');

  // Filter State
  const [filterOverdueOnly, setFilterOverdueOnly] = useState(false);

  useEffect(() => {
    loadBorrowedItems();

    const handleStorageChange = () => loadBorrowedItems();
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('borrowedEquipmentsUpdated', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('borrowedEquipmentsUpdated', handleStorageChange);
    };
  }, [userProfile]);

  const loadBorrowedItems = () => {
    const saved = localStorage.getItem('meetinghub_borrowed_items');
    const userEmail = userProfile?.email;

    let allItems: BorrowedItem[] = saved ? JSON.parse(saved) : [];
    let myItems = allItems.filter(item => item.lecturerEmail === userEmail);

    if (myItems.length === 0 && userEmail) {
      const mockData: BorrowedItem[] = [
        {
          id: 'BORROW_01',
          equipmentCode: 'SN-MC-045',
          equipmentName: 'Micro không dây Shure',
          quantity: 2,
          location: 'Phòng A102 - Lập trình Web',
          borrowTime: '07:00 - 30/09/2026',
          returnDeadline: '11:30 - 30/09/2026',
          status: 'Đang mượn',
          isOverdue: false,
          lecturerEmail: userEmail
        },
        {
          id: 'BORROW_02',
          equipmentCode: 'SN-LT-102',
          equipmentName: 'Laptop trình chiếu',
          quantity: 1,
          location: 'Phòng B201 - CSDL',
          borrowTime: '13:30 - 30/09/2026',
          returnDeadline: '17:00 - 30/09/2026',
          status: 'Đang mượn',
          isOverdue: false,
          lecturerEmail: userEmail
        },
        {
          id: 'BORROW_03',
          equipmentCode: 'SN-PJ-001',
          equipmentName: 'Máy chiếu 4K Sony',
          quantity: 1,
          location: 'Phòng C101',
          borrowTime: '07:00 - 29/09/2026',
          returnDeadline: '11:30 - 29/09/2026',
          status: 'Đã trả',
          isOverdue: false,
          lecturerEmail: userEmail
        },
        {
          id: 'BORROW_04',
          equipmentCode: 'SN-CM-003',
          equipmentName: 'Bộ camera họp trực tuyến Logitech',
          quantity: 1,
          location: 'Phòng B205',
          borrowTime: '07:00 - 28/09/2026',
          returnDeadline: '17:00 - 28/09/2026',
          status: 'Đang mượn',
          isOverdue: true,
          lecturerEmail: userEmail
        }
      ];
      allItems = [...allItems, ...mockData];
      localStorage.setItem('meetinghub_borrowed_items', JSON.stringify(allItems));
      myItems = mockData;
    }

    const currentDate = new Date();
    myItems = myItems.map(item => {
      const parts = item.returnDeadline.split(' - ');
      if (parts.length === 2) {
        const [timePart, datePart] = parts;
        const [hours, minutes] = timePart.split(':');
        const [day, month, year] = datePart.split('/');
        const deadlineDate = new Date(Number(year), Number(month) - 1, Number(day), Number(hours), Number(minutes));
        const isOverdue = deadlineDate < currentDate && item.status === 'Đang mượn';
        return { ...item, isOverdue };
      }
      return item;
    });

    setBorrowedItems(myItems);
  };

  const activeOverdueItems = borrowedItems.filter(i => i.isOverdue && i.status === 'Đang mượn');
  const overdueCount = activeOverdueItems.length;

  const filteredItems = borrowedItems.filter(item => {
    if (filterOverdueOnly && (!item.isOverdue || item.status !== 'Đang mượn')) return false;
    if (!filterOverdueOnly && item.status !== activeTab) return false;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!item.equipmentName.toLowerCase().includes(q) && !item.equipmentCode.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const openReturnModal = (item: BorrowedItem) => {
    setSelectedItem(item);
    setIsReturnModalOpen(true);
    setCondition('Mới/Tốt');
    setReturnNotes('');
  };

  const handleReturnSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;

    const saved = localStorage.getItem('meetinghub_borrowed_items');
    if (saved) {
      const allItems: BorrowedItem[] = JSON.parse(saved);
      const updated = allItems.map(item =>
        item.id === selectedItem.id ? { ...item, status: 'Đã trả' as const, actualReturnDate: new Date().toISOString() } : item
      );
      localStorage.setItem('meetinghub_borrowed_items', JSON.stringify(updated));
    }

    alert(`Đã báo trả [${selectedItem.equipmentName}] thành công!`);
    setIsReturnModalOpen(false);

    window.dispatchEvent(new Event('borrowedEquipmentsUpdated'));
  };

  const handleReportIssue = (item: BorrowedItem) => {
    setSelectedReportItem(item);
    setIncidentType('Thiết bị không lên nguồn');
    setIncidentSeverity('Trung bình');
    setIncidentDesc('');
    setIsReportModalOpen(true);
  };

  const handleReportSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReportItem || !incidentDesc.trim()) return;

    const savedReports = localStorage.getItem('meetinghub_incident_reports');
    const reports = savedReports ? JSON.parse(savedReports) : [];

    reports.push({
      id: 'INC_' + Date.now(),
      equipmentCode: selectedReportItem.equipmentCode,
      equipmentName: selectedReportItem.equipmentName,
      type: incidentType,
      severity: incidentSeverity,
      description: incidentDesc,
      status: 'Chưa xử lý',
      reportedAt: new Date().toISOString(),
      lecturerEmail: userProfile?.email || ''
    });

    localStorage.setItem('meetinghub_incident_reports', JSON.stringify(reports));

    alert('Đã gửi báo cáo sự cố thành công! Ban quản lý sẽ liên hệ hỗ trợ.');
    setIsReportModalOpen(false);
  };

  const getStatusBadge = (item: BorrowedItem) => {
    if (item.status === 'Đã trả') {
      return <span className="bg-slate-100 text-slate-600 text-xs font-medium px-2.5 py-1 rounded-md">Đã trả</span>;
    }
    if (item.isOverdue) {
      return <span className="bg-rose-50 text-rose-700 border border-rose-200/60 text-xs font-medium px-2.5 py-1 rounded-md">Quá hạn trả</span>;
    }
    return <span className="bg-emerald-50 text-emerald-700 border border-emerald-200/60 text-xs font-medium px-2.5 py-1 rounded-md">Đang sử dụng</span>;
  };

  return (
    <div className="flex flex-col gap-8 pb-12 font-sans antialiased">

      {/* Header */}
      <div>
        <h2 className="text-3xl font-extrabold text-slate-800 tracking-tight mb-2">Thiết bị đang mượn</h2>
        <p className="text-slate-500 text-base font-medium">Quản lý các thiết bị bạn đang giữ và thực hiện báo trả đúng hạn.</p>
      </div>

      {overdueCount > 0 && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-rose-800 shadow-sm -mt-2">
          <div className="flex items-center gap-3">
            <AlertTriangle size={24} className="text-rose-600 shrink-0" />
            <div>
              <p className="font-bold text-base">⚠️ CẢNH BÁO QUÁ HẠN</p>
              <p className="text-sm">Bạn có {overdueCount} thiết bị đã quá hạn hoàn trả! Vui lòng làm thủ tục báo trả hoặc gia hạn ngay để tránh bị khóa tài khoản đăng ký.</p>
            </div>
          </div>
          <div className="flex gap-2">
            {!filterOverdueOnly ? (
              <button
                onClick={() => setFilterOverdueOnly(true)}
                className="bg-white border border-rose-200 text-rose-700 hover:bg-rose-100 hover:border-rose-300 py-2 px-4 rounded-lg text-xs font-bold transition-all whitespace-nowrap shrink-0 shadow-sm"
              >
                Xem thiết bị quá hạn
              </button>
            ) : (
              <button
                onClick={() => setFilterOverdueOnly(false)}
                className="bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 py-2 px-4 rounded-lg text-xs font-bold transition-all whitespace-nowrap shrink-0 shadow-sm"
              >
                Hiện tất cả
              </button>
            )}
          </div>
        </div>
      )}

      {/* Filter & Search */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-wrap justify-between gap-6 items-center">

        {/* Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {['Đang mượn', 'Đã trả'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`px-5 py-2.5 rounded-full text-sm font-semibold whitespace-nowrap transition-all ${activeTab === tab
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
            placeholder="Tìm tên hoặc mã thiết bị..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full py-3 pl-11 pr-4 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 bg-slate-50 outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all"
          />
        </div>
      </div>

      {/* List / Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
        {filteredItems.map(item => (
          <div key={item.id} className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col gap-5">
            <div className="flex justify-between items-start">
              <div>
                <div className="text-xs font-mono font-semibold text-slate-400 mb-1">{item.equipmentCode}</div>
                <h3 className="text-lg font-bold text-slate-900 mb-1">{item.equipmentName}</h3>
                <div className="text-sm text-slate-500 font-medium">Số lượng: {item.quantity}</div>
              </div>
              <div>{getStatusBadge(item)}</div>
            </div>

            <div className="flex-1 flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <MapPin size={16} className="text-slate-400 shrink-0" />
                <span className="text-sm text-slate-600">{item.location}</span>
              </div>
              <div className="flex items-center gap-3">
                <Calendar size={16} className="text-slate-400 shrink-0" />
                <span className="text-sm text-slate-600">{item.borrowTime}</span>
              </div>
              <div className="flex items-center gap-3">
                <Clock size={16} className={item.isOverdue && item.status === 'Đang mượn' ? 'text-rose-500 shrink-0' : 'text-slate-400 shrink-0'} />
                <span className={`text-sm ${item.isOverdue && item.status === 'Đang mượn' ? 'text-rose-600 font-semibold' : 'text-slate-600'}`}>{item.returnDeadline}</span>
              </div>
            </div>

            {item.status === 'Đang mượn' && (
              <div className="grid grid-cols-2 gap-3 pt-4 border-t border-slate-100 mt-auto">
                <button
                  onClick={() => openReturnModal(item)}
                  className="bg-slate-900 hover:bg-slate-800 text-white py-2.5 rounded-xl text-xs font-bold transition-all"
                >
                  Báo trả thiết bị
                </button>
                <button
                  onClick={() => handleReportIssue(item)}
                  className="border border-slate-200 text-slate-700 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 py-2.5 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5"
                >
                  <Wrench size={14} /> Báo sự cố
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {filteredItems.length === 0 && (
        <div className="p-16 text-center bg-white rounded-3xl border border-slate-200 flex flex-col items-center justify-center gap-4">
          <Package size={48} className="text-slate-300" />
          <div>
            <h3 className="text-lg font-bold text-slate-800 mb-1">Không có dữ liệu</h3>
            <p className="text-slate-500 text-sm">Chưa có thiết bị nào trong danh sách này.</p>
          </div>
        </div>
      )}

      {/* Return Modal */}
      {isReturnModalOpen && selectedItem && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '24px', width: '100%', maxWidth: '500px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

            <div style={{ padding: '20px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc' }}>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#0f172a', margin: '0 0 4px 0' }}>Xác nhận trả thiết bị</h3>
                <p style={{ color: '#64748b', margin: 0, fontSize: '13px' }}>{selectedItem.equipmentName}</p>
              </div>
              <button type="button" onClick={() => setIsReturnModalOpen(false)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '8px', borderRadius: '50%' }} className="hover:bg-slate-200">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleReturnSubmit} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

              <div style={{ backgroundColor: '#eff6ff', padding: '16px', borderRadius: '12px', border: '1px solid #bfdbfe' }}>
                <div style={{ fontSize: '13px', color: '#3b82f6', marginBottom: '4px' }}>Mã thiết bị: <strong>{selectedItem.equipmentCode}</strong></div>
                <div style={{ fontSize: '13px', color: '#3b82f6' }}>Vị trí sử dụng: <strong>{selectedItem.location}</strong></div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#334155', marginBottom: '8px' }}>Tình trạng khi trả <span style={{ color: '#ef4444' }}>*</span></label>
                <div style={{ display: 'flex', gap: '12px' }}>
                  {['Mới/Tốt', 'Hỏng hóc nhẹ', 'Thiếu phụ kiện'].map(cond => (
                    <label key={cond} style={{ flex: 1, cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="condition"
                        value={cond}
                        checked={condition === cond}
                        onChange={(e) => setCondition(e.target.value)}
                        style={{ display: 'none' }}
                      />
                      <div style={{
                        padding: '12px',
                        textAlign: 'center',
                        borderRadius: '12px',
                        border: condition === cond ? '2px solid #3b82f6' : '1px solid #cbd5e1',
                        backgroundColor: condition === cond ? '#eff6ff' : 'white',
                        color: condition === cond ? '#1d4ed8' : '#475569',
                        fontWeight: condition === cond ? '600' : '500',
                        fontSize: '13px',
                        transition: 'all 0.2s'
                      }}>
                        {cond}
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#334155', marginBottom: '8px' }}>Ghi chú thêm (Không bắt buộc)</label>
                <textarea
                  value={returnNotes}
                  onChange={(e) => setReturnNotes(e.target.value)}
                  placeholder="Ghi chú về tình trạng thiết bị..."
                  style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #cbd5e1', fontSize: '14px', outline: 'none', minHeight: '80px', resize: 'vertical' }}
                  className="focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                ></textarea>
              </div>

              <div style={{ display: 'flex', gap: '16px', marginTop: '8px' }}>
                <button type="button" onClick={() => setIsReturnModalOpen(false)} style={{ flex: 1, padding: '12px', borderRadius: '12px', border: '1px solid #cbd5e1', backgroundColor: 'white', color: '#475569', fontWeight: 'bold', fontSize: '14px', cursor: 'pointer' }} className="hover:bg-slate-50">
                  Hủy
                </button>
                <button type="submit" style={{ flex: 1, padding: '12px', borderRadius: '12px', border: 'none', backgroundColor: '#2563eb', color: 'white', fontWeight: 'bold', fontSize: '14px', cursor: 'pointer', boxShadow: '0 4px 6px rgba(37, 99, 235, 0.2)' }} className="hover:bg-blue-700">
                  Xác nhận trả thiết bị
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Report Modal */}
      {isReportModalOpen && selectedReportItem && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '24px', width: '100%', maxWidth: '500px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

            <div style={{ padding: '20px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc' }}>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#0f172a', margin: '0 0 4px 0' }}>Báo cáo sự cố</h3>
                <p style={{ color: '#64748b', margin: 0, fontSize: '13px' }}>Khai báo sự cố kỹ thuật cho thiết bị đang mượn</p>
              </div>
              <button type="button" onClick={() => setIsReportModalOpen(false)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '8px', borderRadius: '50%' }} className="hover:bg-slate-200">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleReportSubmit} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

              <div style={{ backgroundColor: '#fff1f2', padding: '16px', borderRadius: '12px', border: '1px solid #fecdd3' }}>
                <div style={{ fontSize: '13px', color: '#e11d48', marginBottom: '4px' }}>Mã thiết bị: <strong>{selectedReportItem.equipmentCode}</strong></div>
                <div style={{ fontSize: '14px', color: '#be123c', fontWeight: 'bold' }}>{selectedReportItem.equipmentName}</div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#334155', marginBottom: '8px' }}>Loại sự cố <span style={{ color: '#ef4444' }}>*</span></label>
                <select
                  value={incidentType}
                  onChange={(e) => setIncidentType(e.target.value)}
                  style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #cbd5e1', fontSize: '14px', outline: 'none' }}
                  className="focus:border-rose-500 focus:ring-2 focus:ring-rose-100"
                >
                  <option>Thiết bị không lên nguồn</option>
                  <option>Hỏng phụ kiện</option>
                  <option>Mất thiết bị</option>
                  <option>Lỗi kết nối/kỹ thuật</option>
                  <option>Khác</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#334155', marginBottom: '8px' }}>Mức độ <span style={{ color: '#ef4444' }}>*</span></label>
                <div style={{ display: 'flex', gap: '12px' }}>
                  {['Nghiêm trọng', 'Trung bình', 'Nhẹ'].map(sev => (
                    <label key={sev} style={{ flex: 1, cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="severity"
                        value={sev}
                        checked={incidentSeverity === sev}
                        onChange={(e) => setIncidentSeverity(e.target.value)}
                        style={{ display: 'none' }}
                      />
                      <div style={{
                        padding: '10px',
                        textAlign: 'center',
                        borderRadius: '10px',
                        border: incidentSeverity === sev ? '2px solid #e11d48' : '1px solid #cbd5e1',
                        backgroundColor: incidentSeverity === sev ? '#fff1f2' : 'white',
                        color: incidentSeverity === sev ? '#be123c' : '#475569',
                        fontWeight: incidentSeverity === sev ? '600' : '500',
                        fontSize: '13px',
                        transition: 'all 0.2s'
                      }}>
                        {sev}
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#334155', marginBottom: '8px' }}>Mô tả chi tiết <span style={{ color: '#ef4444' }}>*</span></label>
                <textarea
                  value={incidentDesc}
                  onChange={(e) => setIncidentDesc(e.target.value)}
                  placeholder="Mô tả cụ thể tình trạng sự cố..."
                  style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #cbd5e1', fontSize: '14px', outline: 'none', minHeight: '80px', resize: 'vertical' }}
                  className="focus:border-rose-500 focus:ring-2 focus:ring-rose-100"
                  required
                ></textarea>
              </div>

              <div style={{ display: 'flex', gap: '16px', marginTop: '8px' }}>
                <button type="button" onClick={() => setIsReportModalOpen(false)} style={{ flex: 1, padding: '12px', borderRadius: '12px', border: '1px solid #cbd5e1', backgroundColor: 'white', color: '#475569', fontWeight: 'bold', fontSize: '14px', cursor: 'pointer' }} className="hover:bg-slate-50">
                  Hủy
                </button>
                <button type="submit" style={{ flex: 1, padding: '12px', borderRadius: '12px', border: 'none', backgroundColor: '#e11d48', color: 'white', fontWeight: 'bold', fontSize: '14px', cursor: 'pointer', boxShadow: '0 4px 6px rgba(225, 29, 72, 0.2)' }} className="hover:bg-rose-700">
                  Gửi báo cáo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
