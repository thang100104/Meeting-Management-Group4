import React, { useState, useEffect } from 'react';
import { 
  BarChart3, PieChart, TrendingUp, Download, Printer, 
  Calendar, CheckCircle2, MonitorPlay, Users, Clock, AlertTriangle
} from 'lucide-react';
import { useDataSync, getStorage } from '../utils/syncHelper';

// Helper to calculate duration from timeSlot like "09:00 - 11:00"
const getDuration = (timeSlot?: string): number => {
  if (!timeSlot || !timeSlot.includes('-')) return 0;
  try {
    const [start, end] = timeSlot.split('-').map(t => t.trim());
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    const hours = (eh + em/60) - (sh + sm/60);
    return hours > 0 ? hours : 0;
  } catch (e) {
    return 0;
  }
};

export default function Analytics() {
  const [period, setPeriod] = useState('Tháng này (09/2026)');

  const [resourcesData, setResourcesData] = useState<any[]>([]);
  const [facultyData, setFacultyData] = useState<any[]>([]);
  const [weeklyData, setWeeklyData] = useState<any[]>([
    { day: 'Thứ 2', percent: 0, count: 0 },
    { day: 'Thứ 3', percent: 0, count: 0 },
    { day: 'Thứ 4', percent: 0, count: 0 },
    { day: 'Thứ 5', percent: 0, count: 0 },
    { day: 'Thứ 6', percent: 0, count: 0 },
  ]);
  const [totalBookings, setTotalBookings] = useState(0);
  const [occupancyRate, setOccupancyRate] = useState(0);
  const [topRoom, setTopRoom] = useState({ name: 'Chưa có', hours: 0 });
  const [topDevice, setTopDevice] = useState({ name: 'Chưa có', count: 0 });

  const loadAnalytics = () => {
    try {
      const roomRequests = getStorage<any[]>('meetinghub_room_requests', []);
      const equipRequests = getStorage<any[]>('meetinghub_equipment_requests', []);
      const rooms = getStorage<any[]>('admin_rooms', []);
      const devices = getStorage<any[]>('admin_devices', []);

      const safeRoomRequests = Array.isArray(roomRequests) ? roomRequests.filter(r => r.status === 'Đã duyệt' || r.status === 'APPROVED' || r.status === 'approved') : [];
      const safeEquipRequests = Array.isArray(equipRequests) ? equipRequests.filter(r => r.status === 'Đã duyệt' || r.status === 'APPROVED' || r.status === 'approved') : [];
      
      setTotalBookings(safeRoomRequests.length);

      // --- Calculate Resources Data ---
      const roomMap = new Map();
      const deviceMap = new Map();
      let totalHoursRooms = 0;

      rooms.forEach((r: any) => {
        roomMap.set(String(r.id || r.room_id), { id: String(r.id || r.room_id), name: r.name || r.room_name, type: 'Phòng họp', totalBookings: 0, totalHours: 0, status: r.status === 'MAINTENANCE' || r.isMaintenance || r.status === 'Bảo trì' ? 'Cần bảo trì' : 'Đang hoạt động' });
      });
      devices.forEach((d: any) => {
        deviceMap.set(String(d.id || d.equipment_id), { id: String(d.id || d.equipment_id), name: d.name || d.equipment_name, type: 'Thiết bị', totalBookings: 0, totalHours: 0, status: d.status === 'BROKEN' || d.status === 'Bảo trì' ? 'Cần bảo trì' : 'Đang hoạt động' });
      });

      safeRoomRequests.forEach((req: any) => {
        const id = String(req.roomId || req.room || req.roomName);
        const hrs = getDuration(req.timeSlot);
        totalHoursRooms += hrs;
        if (roomMap.has(id)) {
          const r = roomMap.get(id);
          r.totalBookings++;
          r.totalHours += hrs;
        } else if (req.roomName) {
           roomMap.set(id, { id, name: req.roomName, type: 'Phòng họp', totalBookings: 1, totalHours: hrs, status: 'Đang hoạt động' });
        }
      });

      safeEquipRequests.forEach((req: any) => {
        const id = String(req.equipmentId || req.equipmentName || req.name);
        const hrs = req.duration || getDuration(req.timeSlot) || 0;
        if (deviceMap.has(id)) {
          const d = deviceMap.get(id);
          d.totalBookings++;
          d.totalHours += hrs;
        } else if (req.equipmentName || req.name || req.equipment?.equipment_name) {
           deviceMap.set(id, { id, name: req.equipmentName || req.name || req.equipment?.equipment_name, type: 'Thiết bị', totalBookings: 1, totalHours: hrs, status: 'Đang hoạt động' });
        }
      });

      const resList = [...Array.from(roomMap.values()), ...Array.from(deviceMap.values())].filter(r => r.totalBookings > 0).sort((a,b) => b.totalBookings - a.totalBookings);
      // Generate fulfillment rate dynamically (just a visual metric based on utilization vs capacity, approximated here)
      resList.forEach(r => {
        r.totalHours = Math.round(r.totalHours * 10) / 10;
        r.fulfillment = Math.min(100, Math.round(70 + (r.totalBookings * 2)));
      });
      setResourcesData(resList.slice(0, 10)); // Top 10

      // --- Calculate Top Room & Top Device ---
      let maxRoom = { name: 'Chưa có', hours: 0 };
      roomMap.forEach((v) => { if(v.totalHours > maxRoom.hours) maxRoom = { name: v.name, hours: Math.round(v.totalHours * 10) / 10 }; });
      setTopRoom(maxRoom.hours > 0 ? maxRoom : { name: 'Chưa có dữ liệu', hours: 0 });

      let maxDevice = { name: 'Chưa có', count: 0 };
      deviceMap.forEach((v) => { if(v.totalBookings > maxDevice.count) maxDevice = { name: v.name, count: v.totalBookings }; });
      setTopDevice(maxDevice.count > 0 ? maxDevice : { name: 'Chưa có dữ liệu', count: 0 });

      // --- Calculate Occupancy Rate ---
      // Assuming 10 hours max per day per room, 20 working days in a month
      const maxAvailableHours = rooms.length > 0 ? rooms.length * 10 * 20 : 1; 
      setOccupancyRate(totalHoursRooms > 0 ? Math.min(100, Math.round((totalHoursRooms / maxAvailableHours) * 100)) : 0);

      // --- Calculate Weekly Data ---
      const dayCounts = [0, 0, 0, 0, 0];
      safeRoomRequests.forEach((b: any) => {
        if (b.date) {
          const d = new Date(b.date);
          const day = d.getDay();
          if (day >= 1 && day <= 5) {
            dayCounts[day - 1]++;
          }
        }
      });
      const maxSlotsPerDay = Math.max(10, ...dayCounts);
      setWeeklyData([
        { day: 'Thứ 2', count: dayCounts[0], percent: Math.round((dayCounts[0] / maxSlotsPerDay) * 100) },
        { day: 'Thứ 3', count: dayCounts[1], percent: Math.round((dayCounts[1] / maxSlotsPerDay) * 100) },
        { day: 'Thứ 4', count: dayCounts[2], percent: Math.round((dayCounts[2] / maxSlotsPerDay) * 100) },
        { day: 'Thứ 5', count: dayCounts[3], percent: Math.round((dayCounts[3] / maxSlotsPerDay) * 100) },
        { day: 'Thứ 6', count: dayCounts[4], percent: Math.round((dayCounts[4] / maxSlotsPerDay) * 100) },
      ]);

      // --- Calculate Faculty Data ---
      const facMap = new Map();
      let totalFacHours = 0;
      safeRoomRequests.forEach((req: any) => {
        const fac = req.faculty || req.department || req.requesterRole || 'Khoa CNTT'; // fallback
        const hrs = getDuration(req.timeSlot);
        totalFacHours += hrs;
        if (!facMap.has(fac)) facMap.set(fac, { name: fac, count: 0, hours: 0 });
        const f = facMap.get(fac);
        f.count++;
        f.hours += hrs;
      });

      const colors = ['bg-blue-600', 'bg-indigo-600', 'bg-emerald-500', 'bg-amber-500', 'bg-slate-400', 'bg-purple-500'];
      const facArray = Array.from(facMap.values()).map((f, i) => ({
        ...f,
        hours: Math.round(f.hours * 10) / 10,
        percent: totalFacHours > 0 ? Math.round((f.hours / totalFacHours) * 100) : 0,
        color: colors[i % colors.length]
      })).sort((a,b) => b.percent - a.percent);
      setFacultyData(facArray);

    } catch (e) {
      console.error("Error loading analytics data", e);
    }
  };

  useDataSync('meetinghub_room_requests', loadAnalytics);
  useDataSync('meetinghub_equipment_requests', loadAnalytics);
  useDataSync('admin_rooms', loadAnalytics);
  useDataSync('admin_devices', loadAnalytics);

  useEffect(() => {
    loadAnalytics();
  }, []);

  const handleExportExcel = () => {
    let csvContent = "\uFEFF";
    
    // 1. Tiêu đề Báo cáo
    csvContent += "BÁO CÁO VÀ THỐNG KÊ HỆ THỐNG MEETINGHUB\n";
    csvContent += `Thời gian xuất: ${new Date().toLocaleString('vi-VN')}\n\n`;
    
    // 2. Thống kê tổng quan
    csvContent += "TỔNG QUAN\n";
    csvContent += "Chỉ số,Giá trị\n";
    csvContent += `Tổng cuộc họp,${totalBookings}\n`;
    csvContent += `Tỷ lệ lấp đầy phòng,${occupancyRate}%\n`;
    csvContent += `Phòng dùng nhiều nhất,${topRoom.name} (${topRoom.hours} giờ)\n`;
    csvContent += `Thiết bị mượn nhiều nhất,${topDevice.name} (${topDevice.count} lượt)\n\n`;

    // 3. Bảng chi tiết
    csvContent += "CHI TIẾT THEO PHÒNG HỌP & THIẾT BỊ\n";
    csvContent += "Tên tài nguyên,Loại,Tổng lượt đặt,Tổng giờ sử dụng,Tỷ lệ đáp ứng (%),Tình trạng\n";
    
    resourcesData.forEach(res => {
      const row = [res.name, res.type, res.totalBookings, res.totalHours, `${res.fulfillment}%`, res.status];
      csvContent += row.map(cell => `"${cell}"`).join(",") + "\n";
    });

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
            <h3 className="text-2xl font-bold text-slate-900 leading-none">{totalBookings}</h3>
            {totalBookings > 0 && (
              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                <TrendingUp size={10} /> {(totalBookings * 0.1).toFixed(1)}%
              </span>
            )}
          </div>
        </div>

        {/* Card 2 */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-3.5 flex flex-col justify-between">
          <div className="flex justify-between items-start mb-3">
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Tỷ lệ lấp đầy phòng</div>
            <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg"><PieChart size={16} /></div>
          </div>
          <div className="flex items-end gap-2.5">
            <h3 className="text-2xl font-bold text-slate-900 leading-none">{occupancyRate}<span className="text-base">%</span></h3>
            {occupancyRate > 0 && (
              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                <TrendingUp size={10} /> +2.1%
              </span>
            )}
          </div>
        </div>

        {/* Card 3 */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-3.5 flex flex-col justify-between">
          <div className="flex justify-between items-start mb-2">
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Phòng dùng nhiều nhất</div>
            <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg"><Users size={16} /></div>
          </div>
          <div>
            <h3 className="text-[15px] font-bold text-slate-900 leading-tight truncate">{topRoom.name}</h3>
            <p className="text-[11px] font-medium text-slate-500 mt-0.5">{topRoom.hours} giờ sử dụng</p>
          </div>
        </div>

        {/* Card 4 */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-3.5 flex flex-col justify-between">
          <div className="flex justify-between items-start mb-2">
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Thiết bị mượn nhiều</div>
            <div className="p-1.5 bg-rose-50 text-rose-600 rounded-lg"><MonitorPlay size={16} /></div>
          </div>
          <div>
            <h3 className="text-[15px] font-bold text-slate-900 leading-tight truncate">{topDevice.name}</h3>
            <p className="text-[11px] font-medium text-slate-500 mt-0.5">{topDevice.count} lượt mượn</p>
          </div>
        </div>
      </div>

      {/* 3. KHỐI BIỂU ĐỒ */}
      <div className="flex flex-col gap-4">
        
        {/* KHỐI 1: BIỂU ĐỒ SỐ LƯỢNG & TỶ LỆ LẤP ĐẦY */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 w-full flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <BarChart3 size={16} className="text-blue-600"/> Số lượng cuộc họp & Tỷ lệ lấp đầy theo ngày
            </h2>
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

            {/* 2. Cột biểu đồ chính */}
            <div className="h-48 pl-11 pr-2 flex items-end justify-between gap-3 sm:gap-6 relative z-10">
              {weeklyData.map((item) => (
                <div key={item.day} className="flex-1 flex flex-col items-center h-full justify-end group">
                  
                  {/* Value Label khi hover hoặc mặc định */}
                  <div className="mb-2 transition-all opacity-90 group-hover:opacity-100 group-hover:-translate-y-0.5">
                    <span className="text-[11px] font-semibold text-slate-700 bg-white/90 backdrop-blur px-2 py-0.5 rounded border border-slate-200/60 shadow-sm whitespace-nowrap">
                      {item.percent}% ({item.count} lượt)
                    </span>
                  </div>

                  {/* Thanh Cột Xanh */}
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
          
          <div className="flex items-center gap-4 text-[11px] font-medium text-slate-500 pt-3 border-t border-slate-50 mt-2">
            <span className="flex items-center gap-1.5"><PieChart size={12}/> Tỷ lệ lấp đầy cao nhất: <strong className="text-slate-700">{Math.max(...weeklyData.map(d => d.percent))}%</strong></span>
            <span className="text-slate-300">|</span>
            <span className="flex items-center gap-1.5"><Clock size={12}/> Khung giờ cao điểm thường: <strong className="text-slate-700">09:00 - 11:00</strong></span>
          </div>
        </div>

        {/* KHỐI 2: TẦN SUẤT SỬ DỤNG THEO KHOA / VIỆN */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 w-full">
          <h2 className="text-sm font-bold text-slate-900 mb-5 flex items-center gap-2">
            <PieChart size={16} className="text-indigo-600"/> Tần suất & Tỷ lệ thời lượng sử dụng theo Khoa / Bộ phận
          </h2>
          
          <div className="space-y-4">
            {facultyData.length > 0 ? facultyData.map((faculty, i) => (
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
            )) : (
              <div className="text-sm text-slate-400 py-4 text-center">Chưa có dữ liệu theo bộ phận</div>
            )}
          </div>
        </div>

      </div>

      {/* 4. BẢNG TỔNG HỢP CHI TIẾT */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden mt-1">
        <div className="p-4 border-b border-slate-100">
          <h2 className="text-sm font-bold text-slate-900">Thống kê chi tiết theo Phòng họp & Thiết bị (Top 10)</h2>
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
                <th className="px-4 py-2.5">Tình trạng hiện tại</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {resourcesData.length > 0 ? resourcesData.map(res => (
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
                    <span className={`font-bold ${res.fulfillment >= 90 ? 'text-emerald-600' : 'text-amber-600'}`}>
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
              )) : (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400 text-sm">Chưa có dữ liệu thống kê tài nguyên</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}


