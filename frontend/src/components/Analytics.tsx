import React, { useState, useEffect } from 'react';
import { 
  BarChart3, PieChart, TrendingUp, Download, Printer, 
  Calendar, CheckCircle2, MonitorPlay, Users, Clock 
} from 'lucide-react';

export default function Analytics() {
  const [period, setPeriod] = useState('Tháng này (09/2026)');

  const resourcesData = [
    { id: 1, name: 'Phòng C1 - Hội trường lớn', type: 'Phòng họp', totalBookings: 45, totalHours: 120, fulfillment: 98, status: 'Đang hoạt động' },
    { id: 2, name: 'Phòng B2 - Họp trực tuyến', type: 'Phòng họp', totalBookings: 32, totalHours: 85, fulfillment: 92, status: 'Đang hoạt động' },
    { id: 3, name: 'Máy chiếu Sony Pro', type: 'Thiết bị', totalBookings: 28, totalHours: 65, fulfillment: 100, status: 'Đang hoạt động' },
    { id: 4, name: 'Phòng A1 - Họp bộ môn', type: 'Phòng họp', totalBookings: 15, totalHours: 42, fulfillment: 85, status: 'Cần bảo trì' },
    { id: 5, name: 'Micro không dây Sennheiser', type: 'Thiết bị', totalBookings: 50, totalHours: 150, fulfillment: 100, status: 'Đang hoạt động' },
  ];

  const facultyData = [
    { name: 'Khoa Công nghệ Thông tin', percent: 38, count: 45, hours: 85, color: 'bg-blue-600' },
    { name: 'Khoa Điện - Điện tử', percent: 25, count: 32, hours: 55, color: 'bg-blue-600' },
    { name: 'Khoa Ngoại ngữ', percent: 18, count: 20, hours: 38, color: 'bg-blue-600' },
    { name: 'Khoa Kinh tế', percent: 12, count: 15, hours: 26, color: 'bg-blue-600' },
    { name: 'Phòng Đào tạo', percent: 7, count: 8, hours: 14, color: 'bg-slate-400' },
  ];

  const [weeklyData, setWeeklyData] = useState([
    { day: 'Thứ 2', percent: 0, count: 0 },
    { day: 'Thứ 3', percent: 0, count: 0 },
    { day: 'Thứ 4', percent: 0, count: 0 },
    { day: 'Thứ 5', percent: 0, count: 0 },
    { day: 'Thứ 6', percent: 0, count: 0 },
  ]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('admin_booking_requests');
      const bookings = stored ? JSON.parse(stored) : [];
      const safeBookings = Array.isArray(bookings) ? bookings : [];

      const dayCounts = [0, 0, 0, 0, 0];
      
      safeBookings.forEach((b: any) => {
        if (b.date) {
          const d = new Date(b.date);
          const day = d.getDay();
          if (day >= 1 && day <= 5) {
            dayCounts[day - 1]++;
          }
        }
      });

      const MAX_SLOTS_PER_DAY = 15;

      const computed = [
        { day: 'Thứ 2', count: dayCounts[0], percent: Math.round((dayCounts[0] / MAX_SLOTS_PER_DAY) * 100) },
        { day: 'Thứ 3', count: dayCounts[1], percent: Math.round((dayCounts[1] / MAX_SLOTS_PER_DAY) * 100) },
        { day: 'Thứ 4', count: dayCounts[2], percent: Math.round((dayCounts[2] / MAX_SLOTS_PER_DAY) * 100) },
        { day: 'Thứ 5', count: dayCounts[3], percent: Math.round((dayCounts[3] / MAX_SLOTS_PER_DAY) * 100) },
        { day: 'Thứ 6', count: dayCounts[4], percent: Math.round((dayCounts[4] / MAX_SLOTS_PER_DAY) * 100) },
      ];

      setWeeklyData(computed);
    } catch (e) {
      console.error(e);
    }
  }, []);

  const handleExportExcel = () => {
    // Bổ sung BOM UTF-8 (\uFEFF) để Excel không bị lỗi font Tiếng Việt
    let csvContent = "\uFEFF";
    
    // 1. Tiêu đề Báo cáo
    csvContent += "BÁO CÁO VÀ THỐNG KÊ HỆ THỐNG MEETINGHUB\n";
    csvContent += `Thời gian xuất: ${new Date().toLocaleString('vi-VN')}\n\n`;
    
    // 2. Thống kê tổng quan
    csvContent += "TỔNG QUAN\n";
    csvContent += "Chỉ số,Giá trị\n";
    csvContent += `Tổng cuộc họp,142\n`;
    csvContent += `Tỷ lệ lấp đầy phòng,78%\n`;
    csvContent += `Phòng dùng nhiều nhất,Phòng C1 (120 giờ)\n`;
    csvContent += `Thiết bị mượn nhiều nhất,Micro không dây (50 lượt)\n\n`;

    // 3. Bảng chi tiết
    csvContent += "CHI TIẾT THEO PHÒNG HỌP & THIẾT BỊ\n";
    csvContent += "Tên tài nguyên,Loại,Tổng lượt đặt,Tổng giờ sử dụng,Tỷ lệ đáp ứng (%),Tình trạng\n";
    
    // Giả định/map từ dữ liệu bảng hiện tại
    const tableData = [
      ["Phòng C1 - Hội trường lớn", "Phòng họp", "45", "120", "98%", "Đang hoạt động"],
      ["Phòng B2 - Họp trực tuyến", "Phòng họp", "32", "85", "92%", "Đang hoạt động"],
      ["Máy chiếu Sony Pro", "Thiết bị", "28", "65", "100%", "Đang hoạt động"],
      ["Phòng A1 - Họp bộ môn", "Phòng họp", "15", "42", "85%", "Cần bảo trì"],
      ["Micro không dây Sennheiser", "Thiết bị", "50", "150", "100%", "Đang hoạt động"]
    ];

    tableData.forEach(row => {
      csvContent += row.map(cell => `"${cell}"`).join(",") + "\n";
    });

    // Tạo file download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Bao_Cao_Thong_Ke_MeetingHub_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-slate-50/50 p-4 sm:p-5 flex flex-col gap-4 text-slate-800">
      
      {/* 1. HEADER & THANH CÔNG CỤ */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3">
        <div>
          <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <BarChart3 className="text-blue-600" size={20} /> Báo cáo & Thống kê hệ thống
          </h1>
          <p className="text-[11px] text-slate-500 mt-1">Phân tích tần suất sử dụng phòng họp, thiết bị và hiệu suất điều phối</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2.5">
          <select 
            className="px-3 py-1.5 bg-white border border-slate-200/80 rounded-xl text-xs font-medium text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none shadow-sm transition-all"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
          >
            <option>Tháng này (09/2026)</option>
            <option>Tháng trước</option>
            <option>Quý III / 2026</option>
            <option>Năm 2026</option>
          </select>

          <button 
            onClick={handleExportExcel}
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-xl text-xs font-medium border border-slate-200 transition-all flex items-center gap-1.5 shadow-sm"
          >
            <Download size={14} /> Xuất Excel
          </button>
          
          <button 
            onClick={() => window.print()}
            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-xl text-xs font-medium shadow-sm transition-all flex items-center gap-1.5"
          >
            <Printer size={14} /> In báo cáo PDF
          </button>
        </div>
      </div>

      {/* 2. METRIC CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1 */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-3.5 flex flex-col justify-between">
          <div className="flex justify-between items-start mb-3">
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Tổng cuộc họp</div>
            <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg"><Calendar size={16} /></div>
          </div>
          <div className="flex items-end gap-2.5">
            <h3 className="text-2xl font-bold text-slate-900 leading-none">142</h3>
            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded flex items-center gap-0.5">
              <TrendingUp size={10} /> +12%
            </span>
          </div>
        </div>

        {/* Card 2 */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-3.5 flex flex-col justify-between">
          <div className="flex justify-between items-start mb-3">
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Tỷ lệ lấp đầy phòng</div>
            <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg"><PieChart size={16} /></div>
          </div>
          <div className="flex items-end gap-2.5">
            <h3 className="text-2xl font-bold text-slate-900 leading-none">78<span className="text-base">%</span></h3>
            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded flex items-center gap-0.5">
              <TrendingUp size={10} /> +5.4%
            </span>
          </div>
        </div>

        {/* Card 3 */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-3.5 flex flex-col justify-between">
          <div className="flex justify-between items-start mb-2">
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Phòng dùng nhiều nhất</div>
            <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg"><Users size={16} /></div>
          </div>
          <div>
            <h3 className="text-[15px] font-bold text-slate-900 leading-tight">Phòng C1</h3>
            <p className="text-[11px] font-medium text-slate-500 mt-0.5">120 giờ sử dụng</p>
          </div>
        </div>

        {/* Card 4 */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-3.5 flex flex-col justify-between">
          <div className="flex justify-between items-start mb-2">
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Thiết bị mượn nhiều</div>
            <div className="p-1.5 bg-rose-50 text-rose-600 rounded-lg"><MonitorPlay size={16} /></div>
          </div>
          <div>
            <h3 className="text-[15px] font-bold text-slate-900 leading-tight">Micro không dây</h3>
            <p className="text-[11px] font-medium text-slate-500 mt-0.5">50 lượt mượn</p>
          </div>
        </div>
      </div>

      {/* 3. KHỐI BIỂU ĐỒ (STACKED DỌC - FULL WIDTH) */}
      <div className="flex flex-col gap-4">
        
        {/* KHỐI 1: BIỂU ĐỒ SỐ LƯỢNG & TỶ LỆ LẤP ĐẦY */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 w-full flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <BarChart3 size={16} className="text-blue-600"/> Số lượng cuộc họp & Tỷ lệ lấp đầy theo ngày
            </h2>
            <span className="bg-emerald-50 text-emerald-700 text-xs font-semibold px-2.5 py-1 rounded-lg border border-emerald-200/60">
              +18.5% so với tuần trước
            </span>
          </div>
          
          {/* Khối Biểu Đồ Có Đường Lưới & Trục Y */}
          <div className="w-full relative pt-6 pb-2">
            {/* 1. Các đường lưới ngang (Background Grid Lines) & Trục Y */}
            <div className="absolute inset-0 pt-6 pb-8 flex flex-col justify-between pointer-events-none">
              {[100, 75, 50, 25, 0].map((val) => (
                <div key={val} className="w-full flex items-center gap-3">
                  <span className="text-[10px] font-mono text-slate-400 w-8 text-right flex-shrink-0">
                    {val}%
                  </span>
                  <div className="w-full border-b border-dashed border-slate-200/70" />
                </div>
              ))}
            </div>

            {/* 2. Cột biểu đồ chính (Render đè lên grid lines) */}
            <div className="h-48 pl-11 pr-2 flex items-end justify-between gap-3 sm:gap-6 relative z-10">
              {weeklyData.map((item) => (
                <div key={item.day} className="flex-1 flex flex-col items-center h-full justify-end group">
                  
                  {/* Value Label khi hover hoặc mặc định */}
                  <div className="mb-2 transition-all opacity-90 group-hover:opacity-100 group-hover:-translate-y-0.5">
                    <span className="text-[11px] font-semibold text-slate-700 bg-white/90 backdrop-blur px-2 py-0.5 rounded border border-slate-200/60 shadow-sm">
                      {item.percent}% ({item.count} lượt)
                    </span>
                  </div>

                  {/* Thanh Cột Xanh (Không dùng background xám to đùng) */}
                  <div className="w-full max-w-[40px] flex items-end justify-center h-full">
                    <div
                      className={`w-8 sm:w-10 bg-blue-600 hover:bg-blue-700 transition-all duration-500 rounded-t-md shadow-sm ${
                        item.percent === 0 ? 'h-[2px] bg-slate-300' : ''
                      }`}
                      style={{
                        height: item.percent > 0 ? `${item.percent}%` : undefined,
                      }}
                    />
                  </div>

                  {/* Nhãn Ngày bên dưới */}
                  <span className="text-xs font-medium text-slate-600 mt-3">{item.day}</span>
                </div>
              ))}
            </div>
          </div>
          
          <div className="flex items-center gap-4 text-[11px] font-medium text-slate-500 pt-3 border-t border-slate-50">
            <span className="flex items-center gap-1.5"><PieChart size={12}/> Tỷ lệ lấp đầy trung bình tuần: <strong className="text-slate-700">63%</strong></span>
            <span className="text-slate-300">|</span>
            <span className="flex items-center gap-1.5"><Clock size={12}/> Khung giờ cao điểm: <strong className="text-slate-700">09:00 - 11:00</strong></span>
          </div>
        </div>

        {/* KHỐI 2: TẦN SUẤT SỬ DỤNG THEO KHOA / VIỆN */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 w-full">
          <h2 className="text-sm font-bold text-slate-900 mb-5 flex items-center gap-2">
            <PieChart size={16} className="text-indigo-600"/> Tần suất & Tỷ lệ thời lượng sử dụng theo Khoa / Viện
          </h2>
          
          <div className="space-y-4">
            {facultyData.map((faculty, i) => (
              <div key={i} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                <div className="w-full sm:w-[180px] shrink-0 text-xs font-semibold text-slate-700 truncate">
                  {faculty.name}
                </div>
                
                <div className="flex-1 w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full ${faculty.color} transition-all duration-1000`} 
                    style={{ width: `${faculty.percent}%` }}
                  ></div>
                </div>
                
                <div className="w-full sm:w-[260px] shrink-0 text-[11px] font-medium text-slate-600 text-left sm:text-right">
                  <span className="font-bold text-slate-800">{faculty.count} lần</span> ({faculty.hours} giờ) - <span className="font-bold text-blue-700">{faculty.percent}%</span> tổng thời lượng
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* 4. BẢNG TỔNG HỢP CHI TIẾT */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100">
          <h2 className="text-sm font-bold text-slate-900">Thống kê chi tiết theo Phòng họp & Thiết bị</h2>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[11px] text-slate-700">
            <thead className="bg-slate-50/50 text-slate-500 font-semibold uppercase tracking-wider border-b border-slate-200/80">
              <tr>
                <th className="px-4 py-2.5">Tên Tài nguyên</th>
                <th className="px-4 py-2.5">Loại</th>
                <th className="px-4 py-2.5 text-right">Tổng số lượt đặt (Lượt)</th>
                <th className="px-4 py-2.5 text-right">Tổng số giờ sử dụng (Giờ)</th>
                <th className="px-4 py-2.5 text-right">Tỷ lệ đáp ứng (%)</th>
                <th className="px-4 py-2.5">Tình trạng</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {resourcesData.map(res => (
                <tr key={res.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-4 py-2.5 font-bold text-slate-800 text-xs">{res.name}</td>
                  <td className="px-4 py-2.5">
                    <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded font-bold tracking-wide border border-slate-200/60">
                      {res.type}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right font-bold text-slate-700">{res.totalBookings}</td>
                  <td className="px-4 py-2.5 text-right font-bold text-slate-700">
                    <div className="flex items-center justify-end gap-1">
                      <Clock size={12} className="text-slate-400" />
                      {res.totalHours}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <span className={`font-bold ${res.fulfillment >= 95 ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {res.fulfillment}%
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1.5">
                      {res.status === 'Đang hoạt động' 
                        ? <CheckCircle2 size={14} className="text-emerald-500" /> 
                        : <AlertTriangle size={14} className="text-rose-500" />
                      }
                      <span className={`font-semibold ${res.status === 'Đang hoạt động' ? 'text-emerald-700' : 'text-rose-700'}`}>
                        {res.status}
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}

const AlertTriangle = ({ size, className }: { size: number, className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
    <path d="M12 9v4"/>
    <path d="M12 17h.01"/>
  </svg>
);
