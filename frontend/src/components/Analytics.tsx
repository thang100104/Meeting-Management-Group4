import React, { useState, useEffect } from 'react';
import { 
  BarChart3, PieChart, TrendingUp, Download, Printer, 
  Calendar, CheckCircle2, MonitorPlay, Users, Clock, AlertTriangle,
  XCircle, Ban, FileSpreadsheet, RefreshCw, ShieldAlert, Sparkles
} from 'lucide-react';
import api from '../services/api';

export default function Analytics() {
  const [period, setPeriod] = useState('Tháng này (10/2026)');
  const [loading, setLoading] = useState(true);

  // Summary Metrics
  const [summary, setSummary] = useState({
    total_meetings: 0,
    active_meetings: 0,
    cancelled_meetings: 0,
    cancellation_rate_pct: 0,
    total_hours_used: 0,
    wasted_hours: 0,
    occupancy_rate_pct: 0,
    top_room: { name: 'Chưa có', hours: 0, bookings: 0 },
    top_device: { name: 'Chưa có', count: 0 },
    total_rooms: 0,
    total_equipments: 0
  });

  // Detailed Datasets
  const [roomUtilization, setRoomUtilization] = useState<any[]>([]);
  const [equipmentStats, setEquipmentStats] = useState<any[]>([]);
  const [cancelledMeetings, setCancelledMeetings] = useState<any[]>([]);
  const [weeklyData, setWeeklyData] = useState<any[]>([]);
  const [departmentData, setDepartmentData] = useState<any[]>([]);

  // Active view tab for detailed tables
  const [activeTableTab, setActiveTableTab] = useState<'rooms' | 'cancelled' | 'equipments'>('rooms');

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      const res = await api.get('/meetings/reports/analytics');
      if (res.data) {
        setSummary(res.data.summary || {});
        setRoomUtilization(res.data.room_utilization || []);
        setEquipmentStats(res.data.equipment_stats || []);
        setCancelledMeetings(res.data.cancelled_meetings || []);
        setWeeklyData(res.data.weekly_distribution || []);
        setDepartmentData(res.data.department_distribution || []);
      }
    } catch (e) {
      console.error("Lỗi khi tải dữ liệu báo cáo từ backend:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
  }, []);

  // US #24: Xuất báo cáo ra file Excel (CSV UTF-8 BOM)
  const handleExportExcel = () => {
    let csvContent = "\uFEFF"; // UTF-8 BOM
    
    // 1. Tiêu đề Báo cáo
    csvContent += "BÁO CÁO TỔNG HỢP VÀ THỐNG KÊ HIỆU SUẤT HỆ THỐNG MEETINGHUB\n";
    csvContent += `Thời gian xuất báo cáo: ${new Date().toLocaleString('vi-VN')}\n`;
    csvContent += `Kỳ thống kê: ${period}\n\n`;
    
    // 2. TỔNG QUAN HIỆU SUẤT (US #22, #23)
    csvContent += "=== 1. TỔNG QUAN CHỈ SỐ HỆ THỐNG ===\n";
    csvContent += "Chỉ số,Giá trị,Đơn vị tính\n";
    csvContent += `Tổng số cuộc họp đăng ký,${summary.total_meetings},Cuộc họp\n`;
    csvContent += `Số cuộc họp diễn ra thành công,${summary.active_meetings},Cuộc họp\n`;
    csvContent += `Số cuộc họp bị hủy (US #23),${summary.cancelled_meetings},Cuộc họp\n`;
    csvContent += `Tỷ lệ hủy họp (US #23),${summary.cancellation_rate_pct}%\n`;
    csvContent += `Tổng số giờ sử dụng phòng (US #22),${summary.total_hours_used},Giờ\n`;
    csvContent += `Tổng số giờ lãng phí do hủy (US #23),${summary.wasted_hours},Giờ\n`;
    csvContent += `Tỷ lệ lấp đầy phòng trung bình (US #22),${summary.occupancy_rate_pct}%\n`;
    csvContent += `Phòng họp sử dụng nhiều nhất (US #22),"${summary.top_room.name} (${summary.top_room.hours} giờ / ${summary.top_room.bookings} lượt)",\n`;
    csvContent += `Thiết bị mượn nhiều nhất,"${summary.top_device.name} (${summary.top_device.count} lượt)",\n\n`;

    // 3. BÁO CÁO SỬ DỤNG PHÒNG HỌP (US #22)
    csvContent += "=== 2. BÁO CÁO CHI TIẾT SỬ DỤNG PHÒNG HỌP (US #22) ===\n";
    csvContent += "STT,Mã phòng,Tên phòng họp,Sức chứa,Vị trí,Tổng lượt đặt,Tổng số giờ sử dụng,Số lần bị hủy,Giới hạn quyền đặt,Tình trạng\n";
    roomUtilization.forEach((r, idx) => {
      const restrictionsStr = (r.restrictions || []).map((x: any) => `${x.role_name || 'Vai trò'}: ${x.notes || ''}`).join("; ") || "Không giới hạn";
      const row = [
        idx + 1,
        `PH-${r.room_id}`,
        r.room_name,
        `${r.capacity} người`,
        r.location,
        r.total_bookings,
        r.total_hours,
        r.cancelled_count,
        restrictionsStr,
        r.status
      ];
      csvContent += row.map(cell => `"${cell}"`).join(",") + "\n";
    });
    csvContent += "\n";

    // 4. THỐNG KÊ CHI TIẾT CÁC CUỘC HỌP BỊ HỦY (US #23)
    csvContent += "=== 3. THỐNG KÊ CHI TIẾT CÁC CUỘC HỌP BỊ HỦY & SỐ GIỜ LÃNG PHÍ (US #23) ===\n";
    csvContent += "STT,Mã cuộc họp,Tên cuộc họp,Người tổ chức,Email,Phòng đã đặt,Thời gian bắt đầu,Thời gian kết thúc,Thời lượng lãng phí (Giờ),Lý do hủy họp\n";
    cancelledMeetings.forEach((m, idx) => {
      const row = [
        idx + 1,
        `MT-${m.meeting_id}`,
        m.title,
        m.organizer_name,
        m.organizer_email,
        m.room_name,
        m.start_time,
        m.end_time,
        m.duration_hours,
        m.reason || "Người tổ chức hủy lịch"
      ];
      csvContent += row.map(cell => `"${cell}"`).join(",") + "\n";
    });
    csvContent += "\n";

    // 5. THỐNG KÊ THEO THIẾT BỊ
    csvContent += "=== 4. THỐNG KÊ SỬ DỤNG THIẾT BỊ ===\n";
    csvContent += "STT,Mã thiết bị,Tên thiết bị,Vị trí mặc định,Tổng lượt mượn,Tình trạng\n";
    equipmentStats.forEach((eq, idx) => {
      const row = [
        idx + 1,
        `TB-${eq.equipment_id}`,
        eq.equipment_name,
        eq.room_name,
        eq.booking_count,
        eq.status
      ];
      csvContent += row.map(cell => `"${cell}"`).join(",") + "\n";
    });

    // Tạo blob tải xuống
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Bao_Cao_Hieu_Suat_MeetingHub_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // US #24: In / Xuất PDF
  const handlePrintPdf = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-slate-50/60 p-4 sm:p-6 flex flex-col gap-5 text-slate-800 print:bg-white print:p-0">
      
      {/* 1. HEADER & THANH CÔNG CỤ (Ẩn khi in bản in) */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3.5 print:hidden">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2.5">
              <BarChart3 className="text-blue-600" size={24} /> Báo cáo & Thống kê Hiệu suất Hệ thống
            </h1>
            <span className="text-[11px] font-semibold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full border border-blue-200">
              Live SQLite DB
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Phân tích số giờ sử dụng phòng, tỷ lệ lấp đầy, thống kê hủy họp và hiệu suất điều phối tài nguyên (US #22, #23, #24)
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={loadAnalytics}
            disabled={loading}
            className="p-2 text-slate-600 hover:text-blue-600 bg-white border border-slate-200/80 rounded-xl hover:bg-slate-50 transition-all shadow-sm"
            title="Làm mới dữ liệu từ CSDL"
          >
            <RefreshCw size={15} className={loading ? "animate-spin text-blue-600" : ""} />
          </button>

          <select 
            className="px-3 py-1.5 bg-white border border-slate-200/80 rounded-xl text-xs font-semibold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none shadow-sm transition-all"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
          >
            <option>Tháng này (10/2026)</option>
            <option>Tháng trước (09/2026)</option>
            <option>Học kỳ I (2026 - 2027)</option>
            <option>Toàn bộ năm học 2026</option>
          </select>

          {/* Nút Xuất Excel (US #24) */}
          <button 
            onClick={handleExportExcel}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-xl text-xs font-semibold shadow-sm transition-all flex items-center gap-2 hover:shadow"
            title="Xuất đầy đủ dữ liệu ra file Excel/CSV chuẩn UTF-8"
          >
            <FileSpreadsheet size={15} /> Xuất Excel (CSV)
          </button>
          
          {/* Nút In / Xuất PDF (US #24) */}
          <button 
            onClick={handlePrintPdf}
            className="bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-2 rounded-xl text-xs font-semibold shadow-sm transition-all flex items-center gap-2 hover:shadow"
            title="In hoặc lưu dạng PDF để trình Ban giám hiệu"
          >
            <Printer size={15} /> In / Xuất PDF
          </button>
        </div>
      </div>

      {/* HEADER DÀNH RIÊNG CHO BẢN IN (Chỉ hiển thị khi in) */}
      <div className="hidden print:block mb-6 border-b border-slate-300 pb-4">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-base font-bold text-slate-900 uppercase">ĐẠI HỌC THÁI NGUYÊN - TRƯỜNG ĐẠI HỌC CNTT & TRUYỀN THÔNG</h2>
            <p className="text-xs text-slate-600 font-semibold">PHÒNG QUẢN TRỊ THIẾT BỊ VÀ ĐIỀU HÀNH PHÒNG HỌP (MEETINGHUB)</p>
          </div>
          <div className="text-right text-xs text-slate-500">
            <p>Ngày in: {new Date().toLocaleDateString('vi-VN')}</p>
            <p>Kỳ báo cáo: {period}</p>
          </div>
        </div>
        <h1 className="text-xl font-bold text-center text-slate-900 uppercase mt-4">
          BÁO CÁO TỔNG HỢP HIỆU SUẤT SỬ DỤNG PHÒNG HỌP & THỐNG KÊ HỦY HỌP
        </h1>
      </div>

      {/* 2. CHỈ SỐ METRIC CARDS (Hàng trên cùng) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Card 1: Tổng cuộc họp & Số cuộc thành công */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 flex flex-col justify-between hover:shadow-md transition-all">
          <div className="flex justify-between items-start mb-2">
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Tổng cuộc họp đăng ký</div>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl"><Calendar size={18} /></div>
          </div>
          <div className="flex items-baseline justify-between mt-1">
            <h3 className="text-3xl font-extrabold text-slate-900 leading-none">{summary.total_meetings}</h3>
            <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">
              {summary.active_meetings} thành công
            </span>
          </div>
          <div className="text-[11px] text-slate-500 mt-2 flex items-center gap-1 font-medium">
            <TrendingUp size={12} className="text-blue-600" /> Tổng số phòng quản lý: <strong className="text-slate-700">{summary.total_rooms}</strong>
          </div>
        </div>

        {/* Card 2: Báo cáo sử dụng phòng (US #22) */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 flex flex-col justify-between hover:shadow-md transition-all">
          <div className="flex justify-between items-start mb-2">
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Sử dụng phòng (US #22)</div>
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl"><PieChart size={18} /></div>
          </div>
          <div className="flex items-baseline justify-between mt-1">
            <h3 className="text-3xl font-extrabold text-indigo-600 leading-none">{summary.total_hours_used}<span className="text-base font-semibold text-slate-600 ml-1">giờ</span></h3>
            <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-200">
              {summary.occupancy_rate_pct}% lấp đầy
            </span>
          </div>
          <div className="text-[11px] text-slate-500 mt-2 truncate font-medium">
            Dùng nhiều nhất: <strong className="text-slate-800">{summary.top_room.name}</strong> ({summary.top_room.hours}h)
          </div>
        </div>

        {/* Card 3: Thống kê hủy họp (US #23) - Tông cảnh báo đỏ/cam nổi bật */}
        <div className="bg-gradient-to-br from-white to-rose-50/50 rounded-2xl border border-rose-200 shadow-sm p-4 flex flex-col justify-between hover:shadow-md transition-all">
          <div className="flex justify-between items-start mb-2">
            <div className="text-[11px] font-bold text-rose-700 uppercase tracking-wider flex items-center gap-1">
              <Ban size={13} /> Thống kê hủy họp (US #23)
            </div>
            <div className="p-2 bg-rose-100 text-rose-600 rounded-xl"><XCircle size={18} /></div>
          </div>
          <div className="flex items-baseline justify-between mt-1">
            <h3 className="text-3xl font-extrabold text-rose-600 leading-none">
              {summary.cancelled_meetings}
              <span className="text-xs font-semibold text-rose-500 ml-1">cuộc</span>
            </h3>
            <span className="text-[11px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-lg border border-rose-200">
              {summary.cancellation_rate_pct}% tỷ lệ hủy
            </span>
          </div>
          <div className="text-[11px] text-rose-700 mt-2 flex items-center gap-1 font-semibold">
            <Clock size={12} className="text-rose-500" /> Số giờ lãng phí: <strong>{summary.wasted_hours} giờ</strong>
          </div>
        </div>

        {/* Card 4: Thiết bị mượn nhiều nhất */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 flex flex-col justify-between hover:shadow-md transition-all">
          <div className="flex justify-between items-start mb-2">
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Thiết bị mượn nhiều</div>
            <div className="p-2 bg-amber-50 text-amber-600 rounded-xl"><MonitorPlay size={18} /></div>
          </div>
          <div className="mt-1">
            <h3 className="text-lg font-bold text-slate-900 leading-tight truncate">{summary.top_device.name}</h3>
            <p className="text-2xl font-extrabold text-amber-600 mt-1">{summary.top_device.count} <span className="text-xs font-semibold text-slate-500">lượt mượn</span></p>
          </div>
          <div className="text-[11px] text-slate-500 mt-2 font-medium">
            Tổng thiết bị trong kho: <strong className="text-slate-700">{summary.total_equipments}</strong>
          </div>
        </div>

      </div>

      {/* 3. KHỐI BIỂU ĐỒ TRỰC QUAN (Số lượng & Tỷ lệ lấp đầy + Tần suất theo Khoa) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        
        {/* BIỂU ĐỒ 1: SỐ LƯỢNG CUỘC HỌP & TỶ LỆ LẤP ĐẦY THEO CÁC NGÀY TRONG TUẦN (US #22) */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <BarChart3 size={17} className="text-blue-600"/> Số lượng cuộc họp & Tỷ lệ lấp đầy theo ngày trong tuần (US #22)
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5">Phân tích chu kỳ đặt phòng để tối ưu hóa thời gian mở cửa và điều phối kỹ thuật viên</p>
            </div>
            <span className="text-[11px] font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200">
              Thứ 2 - Chủ nhật
            </span>
          </div>
          
          {/* Biểu đồ cột có Grid lines */}
          <div className="w-full relative pt-6 pb-2">
            <div className="absolute inset-0 pt-6 pb-8 flex flex-col justify-between pointer-events-none">
              {[100, 75, 50, 25, 0].map((val) => (
                <div key={val} className="w-full flex items-center gap-3">
                  <span className="text-[10px] font-mono text-slate-400 w-8 text-right flex-shrink-0">
                    {val}%
                  </span>
                  <div className="w-full border-b border-dashed border-slate-200/80" />
                </div>
              ))}
            </div>

            <div className="h-44 pl-11 pr-2 flex items-end justify-between gap-2 sm:gap-4 relative z-10">
              {weeklyData.map((item) => (
                <div key={item.day} className="flex-1 flex flex-col items-center h-full justify-end group">
                  <div className="mb-2 transition-all opacity-80 group-hover:opacity-100 group-hover:-translate-y-0.5">
                    <span className="text-[10px] font-bold text-slate-700 bg-white/95 px-1.5 py-0.5 rounded border border-slate-200 shadow-sm whitespace-nowrap">
                      {item.count} lượt
                    </span>
                  </div>

                  <div className="w-full max-w-[44px] flex items-end justify-center h-full">
                    <div
                      className={`w-7 sm:w-9 bg-blue-600 group-hover:bg-blue-700 transition-all duration-500 rounded-t-lg shadow-sm ${
                        item.percent === 0 ? 'h-[3px] bg-slate-300' : ''
                      }`}
                      style={{
                        height: item.percent > 0 ? `${item.percent}%` : undefined,
                      }}
                    />
                  </div>

                  <span className="text-[11px] font-semibold text-slate-600 mt-2.5">{item.day}</span>
                </div>
              ))}
            </div>
          </div>
          
          <div className="flex flex-wrap items-center justify-between text-[11px] font-medium text-slate-500 pt-3 border-t border-slate-100 mt-3">
            <span className="flex items-center gap-1.5">
              <PieChart size={13} className="text-blue-600"/> Tỷ lệ lấp đầy trung bình: <strong className="text-slate-800">{summary.occupancy_rate_pct}%</strong>
            </span>
            <span className="flex items-center gap-1.5">
              <Clock size={13} className="text-amber-500"/> Khung giờ cao điểm: <strong className="text-slate-800">08:00 - 11:30 &amp; 13:30 - 16:30</strong>
            </span>
          </div>
        </div>

        {/* BIỂU ĐỒ 2: TẦN SUẤT & THỜI LƯỢNG THEO KHOA / ĐƠN VỊ (US #22) */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900 mb-1 flex items-center gap-2">
              <Users size={17} className="text-indigo-600"/> Tần suất sử dụng theo Khoa / Viện
            </h2>
            <p className="text-[11px] text-slate-500 mb-4">Tỷ lệ thời lượng sử dụng tài nguyên giữa các đơn vị</p>
            
            <div className="space-y-3.5">
              {departmentData.length > 0 ? departmentData.slice(0, 5).map((dept, i) => (
                <div key={i} className="flex flex-col gap-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-700 truncate max-w-[170px]">{dept.name}</span>
                    <span className="font-extrabold text-slate-900">{dept.hours}h <span className="font-semibold text-slate-500 text-[11px]">({dept.percent}%)</span></span>
                  </div>
                  <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full ${dept.color} transition-all duration-700`} 
                      style={{ width: `${Math.max(4, dept.percent)}%` }}
                    />
                  </div>
                  <div className="text-[10px] text-slate-400 text-right">{dept.count} cuộc họp</div>
                </div>
              )) : (
                <div className="text-xs text-slate-400 py-6 text-center">Chưa có dữ liệu theo bộ phận</div>
              )}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 text-[11px] text-slate-500 flex items-center gap-1.5 font-medium">
            <Sparkles size={13} className="text-indigo-500" />
            Đơn vị hoạt động tích cực nhất: <strong className="text-slate-800">{departmentData[0]?.name || "Khoa CNTT"}</strong>
          </div>
        </div>

      </div>

      {/* 4. CÁC BẢNG CHI TIẾT TỔNG HỢP (US #22, US #23) */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden mt-1">
        
        {/* Table Navigation Header */}
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto">
            
            {/* Tab 1: Báo cáo phòng họp (US #22) */}
            <button
              onClick={() => setActiveTableTab('rooms')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                activeTableTab === 'rooms'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <BarChart3 size={14} /> Báo cáo sử dụng phòng họp (US #22)
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTableTab === 'rooms' ? 'bg-blue-700 text-white' : 'bg-slate-200 text-slate-700'}`}>
                {roomUtilization.length}
              </span>
            </button>

            {/* Tab 2: Thống kê hủy họp (US #23) */}
            <button
              onClick={() => setActiveTableTab('cancelled')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                activeTableTab === 'cancelled'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
              }`}
            >
              <Ban size={14} /> Thống kê các cuộc họp bị hủy (US #23)
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTableTab === 'cancelled' ? 'bg-rose-700 text-white' : 'bg-rose-200 text-rose-800'}`}>
                {cancelledMeetings.length}
              </span>
            </button>

            {/* Tab 3: Thiết bị */}
            <button
              onClick={() => setActiveTableTab('equipments')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                activeTableTab === 'equipments'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <MonitorPlay size={14} /> Thống kê thiết bị
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTableTab === 'equipments' ? 'bg-amber-700 text-white' : 'bg-slate-200 text-slate-700'}`}>
                {equipmentStats.length}
              </span>
            </button>

          </div>

          <div className="text-[11px] font-medium text-slate-500">
            Dữ liệu đồng bộ trực tiếp từ SQLite Database
          </div>
        </div>
        
        {/* TABLE 1: BÁO CÁO CHI TIẾT SỬ DỤNG PHÒNG HỌP (US #22) */}
        {activeTableTab === 'rooms' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50/80 text-slate-500 font-semibold uppercase tracking-wider border-b border-slate-200/80">
                <tr>
                  <th className="px-4 py-3">Mã phòng</th>
                  <th className="px-4 py-3">Tên phòng họp</th>
                  <th className="px-4 py-3">Sức chứa &amp; Vị trí</th>
                  <th className="px-4 py-3 text-right">Lượt đặt thành công</th>
                  <th className="px-4 py-3 text-right">Tổng giờ sử dụng (Giờ)</th>
                  <th className="px-4 py-3 text-right">Số lần hủy</th>
                  <th className="px-4 py-3">Giới hạn quyền đặt (US #21)</th>
                  <th className="px-4 py-3">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {roomUtilization.length > 0 ? roomUtilization.map(r => (
                  <tr key={r.room_id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-slate-500">PH-{r.room_id}</td>
                    <td className="px-4 py-3 font-bold text-slate-900">{r.room_name}</td>
                    <td className="px-4 py-3 text-slate-600">
                      <div><strong className="text-slate-800">{r.capacity}</strong> chỗ ngồi</div>
                      <div className="text-[11px] text-slate-400">{r.location}</div>
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-blue-600">{r.total_bookings} lượt</td>
                    <td className="px-4 py-3 text-right font-extrabold text-slate-900">
                      <div className="flex items-center justify-end gap-1">
                        <Clock size={13} className="text-slate-400" />
                        {r.total_hours}h
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-rose-600">
                      {r.cancelled_count > 0 ? `${r.cancelled_count} lần` : '0'}
                    </td>
                    <td className="px-4 py-3">
                      {r.restrictions && r.restrictions.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {r.restrictions.map((res: any) => (
                            <span 
                              key={res.restriction_id} 
                              className="px-2 py-0.5 bg-rose-50 text-rose-700 border border-rose-200 rounded text-[10px] font-bold flex items-center gap-1"
                              title={res.notes || "Giới hạn quyền"}
                            >
                              <ShieldAlert size={11} /> Cấm: {res.role_name || `Role ${res.role_id}`}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-400 font-medium">Mở cho mọi người</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold inline-flex items-center gap-1 ${
                        r.status === 'Đang hoạt động' 
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                          : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}>
                        {r.status === 'Đang hoạt động' ? <CheckCircle2 size={11} /> : <AlertTriangle size={11} />}
                        {r.status}
                      </span>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-slate-400">Chưa có dữ liệu phòng họp</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* TABLE 2: THỐNG KÊ CHI TIẾT CÁC CUỘC HỌP BỊ HỦY (US #23) */}
        {activeTableTab === 'cancelled' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-rose-50/70 text-rose-800 font-semibold uppercase tracking-wider border-b border-rose-200">
                <tr>
                  <th className="px-4 py-3">Mã họp</th>
                  <th className="px-4 py-3">Tên cuộc họp bị hủy</th>
                  <th className="px-4 py-3">Người tổ chức</th>
                  <th className="px-4 py-3">Phòng đã xếp</th>
                  <th className="px-4 py-3">Thời gian dự kiến</th>
                  <th className="px-4 py-3 text-right">Giờ lãng phí</th>
                  <th className="px-4 py-3">Lý do hủy (US #23)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rose-100">
                {cancelledMeetings.length > 0 ? cancelledMeetings.map(m => (
                  <tr key={m.meeting_id} className="hover:bg-rose-50/40 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-rose-700">MT-{m.meeting_id}</td>
                    <td className="px-4 py-3 font-bold text-slate-900">{m.title}</td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-800">{m.organizer_name}</div>
                      <div className="text-[11px] text-slate-400">{m.organizer_email}</div>
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-700">{m.room_name}</td>
                    <td className="px-4 py-3 text-[11px] text-slate-600">
                      <div>Từ: {m.start_time}</div>
                      <div>Đến: {m.end_time}</div>
                    </td>
                    <td className="px-4 py-3 text-right font-extrabold text-rose-600">
                      <div className="flex items-center justify-end gap-1">
                        <Clock size={13} className="text-rose-400" />
                        {m.duration_hours} giờ
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2.5 py-1 bg-rose-100/80 text-rose-800 rounded-lg text-xs font-semibold border border-rose-200 inline-block">
                        {m.reason || "Người tổ chức hủy lịch"}
                      </span>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                      Không có cuộc họp nào bị hủy trong khoảng thời gian này
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* TABLE 3: THỐNG KÊ CHI TIẾT THIẾT BỊ */}
        {activeTableTab === 'equipments' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-amber-50/70 text-amber-900 font-semibold uppercase tracking-wider border-b border-amber-200">
                <tr>
                  <th className="px-4 py-3">Mã thiết bị</th>
                  <th className="px-4 py-3">Tên thiết bị</th>
                  <th className="px-4 py-3">Vị trí lưu kho / Phòng</th>
                  <th className="px-4 py-3 text-right">Tổng lượt mượn</th>
                  <th className="px-4 py-3">Trạng thái hiện tại</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-amber-100">
                {equipmentStats.length > 0 ? equipmentStats.map(eq => (
                  <tr key={eq.equipment_id} className="hover:bg-amber-50/30 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-amber-800">TB-{eq.equipment_id}</td>
                    <td className="px-4 py-3 font-bold text-slate-900">{eq.equipment_name}</td>
                    <td className="px-4 py-3 text-slate-600 font-medium">{eq.room_name}</td>
                    <td className="px-4 py-3 text-right font-bold text-amber-700">{eq.booking_count} lượt</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold inline-flex items-center gap-1 ${
                        eq.status === 'Sẵn sàng' 
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}>
                        <CheckCircle2 size={11} /> {eq.status}
                      </span>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-400">Chưa có dữ liệu thiết bị</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

      </div>

    </div>
  );
}
