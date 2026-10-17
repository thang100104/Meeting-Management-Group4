import { setStorage } from './syncHelper';

export const initializeSystemData = (forceReset: boolean = false) => {
  const isInitialized = localStorage.getItem('sys_init_v2');
  
  if (isInitialized && !forceReset) {
    return; // Already seeded
  }

  // 1. NORMALIZE USERS_DB
  const cleanUsersDB = {
    'admin@ictu.edu.vn': {
      id: 'admin_1',
      fullName: 'Quản trị viên Hệ thống',
      name: 'Quản trị viên Hệ thống',
      email: 'admin@ictu.edu.vn',
      phone: '0988000000',
      role: 'ADMIN',
      avatar: '',
      password: '12345678',
      department: 'Phòng Hành chính Tổng hợp'
    },
    'giangvien@ictu.edu.vn': {
      id: 'lecturer_1',
      fullName: 'Hoàng Thanh Phương',
      name: 'Hoàng Thanh Phương',
      email: 'giangvien@ictu.edu.vn',
      phone: '0988123456',
      role: 'LECTURER',
      avatar: '',
      password: '12345678',
      department: 'Khoa CNTT'
    }
  };
  setStorage('users_db', cleanUsersDB);

  // 2. INITIALIZE STANDARD RESOURCES
  const standardRooms = [
    {
      id: 'ROOM_1',
      name: 'Phòng Hội trường A1',
      building: 'Tòa A',
      floor: 'Tầng 1',
      capacity: 200,
      type: 'Hội trường',
      status: 'Sẵn sàng',
      image: 'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?auto=format&fit=crop&q=80&w=400',
      equipment: ['Máy chiếu', 'Micro', 'Loa', 'Bục phát biểu']
    },
    {
      id: 'ROOM_2',
      name: 'Giảng đường C102',
      building: 'Tòa C',
      floor: 'Tầng 1',
      capacity: 80,
      type: 'Giảng đường',
      status: 'Sẵn sàng',
      image: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&q=80&w=400',
      equipment: ['Máy chiếu', 'Bảng từ', 'Điều hòa']
    },
    {
      id: 'ROOM_3',
      name: 'Phòng B201',
      building: 'Tòa B',
      floor: 'Tầng 2',
      capacity: 40,
      type: 'Phòng học',
      status: 'Sẵn sàng',
      image: 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&q=80&w=400',
      equipment: ['TV 65inch', 'Bảng từ']
    }
  ];
  setStorage('system_rooms', standardRooms);
  setStorage('admin_rooms', standardRooms);

  const standardEquipments = [
    {
      id: 'EQ_1',
      name: 'Máy chiếu Sony 4K',
      code: 'SN-4K-01',
      category: 'Thiết bị trình chiếu',
      status: 'Sẵn sàng',
      image: 'https://images.unsplash.com/photo-1588702547923-7097902cafd0?auto=format&fit=crop&q=80&w=400'
    },
    {
      id: 'EQ_2',
      name: 'Micro không dây Sennheiser',
      code: 'MIC-SN-02',
      category: 'Âm thanh',
      status: 'Sẵn sàng',
      image: 'https://images.unsplash.com/photo-1590602847861-f357a9332bbc?auto=format&fit=crop&q=80&w=400'
    },
    {
      id: 'EQ_3',
      name: 'Bộ Logitech MeetUp',
      code: 'CAM-LOGI-03',
      category: 'Hội nghị trực tuyến',
      status: 'Sẵn sàng',
      image: 'https://images.unsplash.com/photo-1589894404892-7310b92ea7a2?auto=format&fit=crop&q=80&w=400'
    },
    {
      id: 'EQ_4',
      name: 'Bảng tương tác thông minh Samsung',
      code: 'SM-SS-04',
      category: 'Thiết bị trình chiếu',
      status: 'Sẵn sàng',
      image: 'https://images.unsplash.com/photo-1544383835-bda2bc66a55d?auto=format&fit=crop&q=80&w=400'
    }
  ];
  setStorage('system_equipments', standardEquipments);
  setStorage('admin_equipments', standardEquipments);

  // 3. INITIALIZE RICH MOCK DATA
  
  // Lấy ngày hiện tại
  const today = new Date();
  const getFormattedDate = (daysToAdd: number = 0) => {
    const d = new Date(today);
    d.setDate(d.getDate() + daysToAdd);
    return d.toISOString().split('T')[0];
  };

  const initialBookings = [
    {
      id: 'B1',
      roomId: 'ROOM_1',
      roomName: 'Phòng Hội trường A1',
      userId: 'lecturer_1',
      userName: 'Hoàng Thanh Phương',
      date: getFormattedDate(0),
      timeSlot: '08:00 - 11:30',
      purpose: 'Hội thảo Công nghệ mới 2026',
      status: 'Đã duyệt',
      createdAt: new Date().toISOString(),
      participants: 150
    },
    {
      id: 'B2',
      roomId: 'ROOM_2',
      roomName: 'Giảng đường C102',
      userId: 'lecturer_1',
      userName: 'Hoàng Thanh Phương',
      date: getFormattedDate(1),
      timeSlot: '13:00 - 15:30',
      purpose: 'Dạy bù môn Cấu trúc dữ liệu',
      status: 'Chờ duyệt',
      createdAt: new Date().toISOString(),
      participants: 70
    },
    {
      id: 'B3',
      roomId: 'ROOM_3',
      roomName: 'Phòng B201',
      userId: 'lecturer_1',
      userName: 'Hoàng Thanh Phương',
      date: getFormattedDate(2),
      timeSlot: '09:00 - 11:00',
      purpose: 'Họp bộ môn định kỳ',
      status: 'Từ chối',
      reason: 'Phòng đang bảo trì định kỳ',
      createdAt: new Date().toISOString(),
      participants: 15
    },
    {
      id: 'B4',
      roomId: 'ROOM_1',
      roomName: 'Phòng Hội trường A1',
      userId: 'admin_1',
      userName: 'Quản trị viên',
      date: getFormattedDate(3),
      timeSlot: '14:00 - 17:00',
      purpose: 'Đón tiếp đoàn thanh tra',
      status: 'Đã duyệt',
      createdAt: new Date().toISOString(),
      participants: 50
    }
  ];
  setStorage('room_bookings', initialBookings);
  setStorage('meetinghub_room_requests', initialBookings);

  const initialEquipmentRequests = [
    {
      id: 'ER1',
      equipmentId: 'EQ_1',
      equipmentName: 'Máy chiếu Sony 4K',
      userId: 'lecturer_1',
      userName: 'Hoàng Thanh Phương',
      startDate: getFormattedDate(0),
      endDate: getFormattedDate(0),
      purpose: 'Mượn dùng cho hội thảo',
      status: 'Đã duyệt'
    },
    {
      id: 'ER2',
      equipmentId: 'EQ_3',
      equipmentName: 'Bộ Logitech MeetUp',
      userId: 'lecturer_1',
      userName: 'Hoàng Thanh Phương',
      startDate: getFormattedDate(1),
      endDate: getFormattedDate(1),
      purpose: 'Họp trực tuyến với đối tác',
      status: 'Chờ duyệt'
    },
    {
      id: 'ER3',
      equipmentId: 'EQ_2',
      equipmentName: 'Micro không dây Sennheiser',
      userId: 'lecturer_1',
      userName: 'Hoàng Thanh Phương',
      startDate: getFormattedDate(2),
      endDate: getFormattedDate(2),
      purpose: 'Dạy học trên hội trường lớn',
      status: 'Từ chối',
      reason: 'Thiết bị đang bảo trì'
    }
  ];
  setStorage('equipment_bookings', initialEquipmentRequests);

  const initialIncidents = [
    {
      id: 'INC1',
      roomId: 'ROOM_2',
      roomName: 'Giảng đường C102',
      reporterId: 'lecturer_1',
      reporterName: 'Hoàng Thanh Phương',
      date: getFormattedDate(-1),
      description: 'Điều hòa không mát, có tiếng kêu lạ',
      status: 'Đang xử lý',
      severity: 'Trung bình',
      image: 'https://images.unsplash.com/photo-1581092921461-7031e4bf648f?auto=format&fit=crop&q=80&w=400'
    },
    {
      id: 'INC2',
      roomId: 'ROOM_1',
      roomName: 'Phòng Hội trường A1',
      reporterId: 'admin_1',
      reporterName: 'Quản trị viên Hệ thống',
      date: getFormattedDate(-2),
      description: 'Hỏng mic số 2',
      status: 'Đã giải quyết',
      severity: 'Thấp'
    }
  ];
  setStorage('incident_reports', initialIncidents);
  setStorage('system_notifications', [
    {
      id: 'NOTIF1',
      userId: 'lecturer_1',
      title: 'Yêu cầu mượn thiết bị đã được duyệt',
      message: 'Yêu cầu mượn Máy chiếu Sony 4K của bạn đã được duyệt.',
      isRead: false,
      createdAt: new Date().toISOString()
    },
    {
      id: 'NOTIF2',
      userId: 'lecturer_1',
      title: 'Báo cáo sự cố đang được xử lý',
      message: 'Sự cố "Điều hòa không mát" tại C102 đang được kỹ thuật viên kiểm tra.',
      isRead: false,
      createdAt: new Date().toISOString()
    }
  ]);

  // Mark as initialized
  localStorage.setItem('sys_init_v2', 'true');
  
  // Trigger update
  window.dispatchEvent(new Event('appDataSync'));
  window.dispatchEvent(new Event('storage'));
  
  console.log("System data initialized successfully with rich mock state.");
};
