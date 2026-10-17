import React, { useState } from 'react';
import { 
  Users, UserCheck, UserX, UserPlus, 
  Search, Lock, Unlock, Edit2, Trash2, 
  MoreVertical, Shield, GraduationCap, X, RefreshCw 
} from 'lucide-react';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'Giảng viên' | 'Sinh viên' | 'Cán bộ phòng';
  identifier: string; // Mã GV / MSSV
  faculty: string;
  department: string; // Bộ môn hoặc Lớp
  status: 'active' | 'locked';
  avatar?: string;
}

const MOCK_USERS: User[] = [
  {
    id: '1',
    name: 'PGS.TS Trần Văn A',
    email: 'tranvana@university.edu.vn',
    role: 'Giảng viên',
    identifier: 'GV-10234',
    faculty: 'Khoa CNTT',
    department: 'Bộ môn Mạng Máy Tính',
    status: 'active'
  },
  {
    id: '2',
    name: 'Nguyễn Thị Bích',
    email: 'bich.nt@student.edu.vn',
    role: 'Sinh viên',
    identifier: 'SV20260123',
    faculty: 'Khoa CNTT',
    department: 'Lớp DPT14A',
    status: 'active'
  },
  {
    id: '3',
    name: 'ThS. Lê Hoàng C',
    email: 'hoangc@university.edu.vn',
    role: 'Cán bộ phòng',
    identifier: 'CB-9932',
    faculty: 'Phòng Hành Chính',
    department: 'Tổ Quản lý Thiết bị',
    status: 'active'
  },
  {
    id: '4',
    name: 'Trần Đại D',
    email: 'daid.tran@student.edu.vn',
    role: 'Sinh viên',
    identifier: 'SV20240999',
    faculty: 'Khoa Kinh tế',
    department: 'Lớp KTE12C',
    status: 'locked'
  },
  {
    id: '5',
    name: 'TS. Phạm Quang E',
    email: 'quange@university.edu.vn',
    role: 'Giảng viên',
    identifier: 'GV-20455',
    faculty: 'Khoa Điện - Điện tử',
    department: 'Bộ môn Tự động hóa',
    status: 'active'
  },
  {
    id: '6',
    name: 'Vũ Thị F',
    email: 'thif.vu@student.edu.vn',
    role: 'Sinh viên',
    identifier: 'SV20250777',
    faculty: 'Khoa Ngoại ngữ',
    department: 'Lớp NNA13B',
    status: 'active'
  },
  {
    id: '7',
    name: 'Hoàng Quốc G',
    email: 'quocg@student.edu.vn',
    role: 'Sinh viên',
    identifier: 'SV20260888',
    faculty: 'Khoa CNTT',
    department: 'Lớp KTPM14',
    status: 'locked'
  }
];

const FACULTIES = [
  'Tất cả',
  'Khoa CNTT',
  'Khoa Điện - Điện tử',
  'Khoa Kinh tế',
  'Khoa Ngoại ngữ',
  'Phòng Hành Chính'
];

export default function UserManagement() {
  const [users, setUsers] = useState<User[]>(MOCK_USERS);
  
  // Filters
  const [activeTab, setActiveTab] = useState<'Tất cả' | 'Giảng viên' | 'Sinh viên' | 'Cán bộ phòng'>('Tất cả');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterFaculty, setFilterFaculty] = useState('Tất cả');
  const [filterStatus, setFilterStatus] = useState('Tất cả');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  // Form State
  const [formData, setFormData] = useState<Partial<User>>({
    role: 'Sinh viên',
    status: 'active',
    faculty: 'Khoa CNTT'
  });

  // Calculate Metrics
  const totalUsers = users.length;
  const teacherCount = users.filter(u => u.role === 'Giảng viên').length;
  const studentCount = users.filter(u => u.role === 'Sinh viên').length;
  const lockedCount = users.filter(u => u.status === 'locked').length;

  // Filter Logic
  const filteredUsers = users.filter(u => {
    const matchTab = activeTab === 'Tất cả' || u.role === activeTab;
    const matchFaculty = filterFaculty === 'Tất cả' || u.faculty === filterFaculty;
    const matchStatus = filterStatus === 'Tất cả' || 
                        (filterStatus === 'Đang hoạt động' && u.status === 'active') || 
                        (filterStatus === 'Tạm khóa' && u.status === 'locked');
    
    const term = searchQuery.toLowerCase();
    const matchSearch = u.name.toLowerCase().includes(term) || 
                        u.email.toLowerCase().includes(term) || 
                        u.identifier.toLowerCase().includes(term) ||
                        u.faculty.toLowerCase().includes(term);

    return matchTab && matchFaculty && matchStatus && matchSearch;
  });

  const handleOpenModal = (user: User | null = null) => {
    if (user) {
      setEditingUser(user);
      setFormData(user);
    } else {
      setEditingUser(null);
      setFormData({ role: 'Sinh viên', status: 'active', faculty: 'Khoa CNTT' });
    }
    setIsModalOpen(true);
  };

  const handleSaveModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.identifier) {
      alert("Vui lòng điền đầy đủ các thông tin bắt buộc!");
      return;
    }

    if (editingUser) {
      setUsers(users.map(u => u.id === editingUser.id ? { ...u, ...formData } as User : u));
    } else {
      setUsers([{ ...formData, id: Date.now().toString() } as User, ...users]);
    }
    setIsModalOpen(false);
  };

  const toggleUserStatus = (id: string) => {
    setUsers(users.map(u => {
      if (u.id === id) {
        return { ...u, status: u.status === 'active' ? 'locked' : 'active' };
      }
      return u;
    }));
  };

  const handleDeleteUser = (id: string) => {
    if (window.confirm("Bạn có chắc chắn muốn xóa người dùng này khỏi hệ thống? Dữ liệu sẽ không thể khôi phục.")) {
      setUsers(users.filter(u => u.id !== id));
    }
  };



  const getAvatarInitials = (name: string) => {
    return name.split(' ').slice(-2).map(w => w[0]).join('').toUpperCase();
  };

  return (
    <div className="min-h-screen bg-slate-50/50 p-6 md:p-8 space-y-6 text-slate-800">
      
      {/* 1. HEADER & ACTION */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="font-bold text-xl text-slate-900">Quản lý Người dùng & Tài khoản</h1>
          <p className="text-sm text-slate-500 mt-1">Quản lý thông tin, phân quyền và trạng thái hoạt động của Giảng viên và Sinh viên</p>
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-medium text-sm shadow-sm transition-all flex items-center gap-2"
        >
          <UserPlus size={18} />
          Thêm người dùng mới
        </button>
      </div>

      {/* 2. HÀNG THỐNG KÊ CHI TIẾT (Grid 4 cột) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Tổng */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Tổng người dùng</p>
            <h3 className="text-2xl font-bold text-slate-900">{totalUsers}</h3>
          </div>
          <div className="bg-slate-100 p-2.5 rounded-xl text-slate-600">
            <Users size={20} />
          </div>
        </div>
        
        {/* Card 2: Giảng viên */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Giảng viên</p>
            <h3 className="text-2xl font-bold text-slate-900">{teacherCount}</h3>
          </div>
          <div className="bg-blue-50 p-2.5 rounded-xl text-blue-600">
            <Shield size={20} />
          </div>
        </div>

        {/* Card 3: Sinh viên */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Sinh viên</p>
            <h3 className="text-2xl font-bold text-slate-900">{studentCount}</h3>
          </div>
          <div className="bg-emerald-50 p-2.5 rounded-xl text-emerald-600">
            <GraduationCap size={20} />
          </div>
        </div>

        {/* Card 4: Bị khóa */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Tạm khóa / Hạn chế</p>
            <h3 className="text-2xl font-bold text-slate-900">{lockedCount}</h3>
          </div>
          <div className="bg-rose-50 p-2.5 rounded-xl text-rose-600">
            <Lock size={20} />
          </div>
        </div>
      </div>

      {/* 3. THANH TAB & BỘ LỌC */}
      <div className="space-y-4">
        {/* Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {['Tất cả', 'Giảng viên', 'Sinh viên', 'Cán bộ phòng'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={
                activeTab === tab 
                  ? "bg-blue-600 text-white text-xs font-semibold px-4 py-2 rounded-xl shadow-sm transition-all whitespace-nowrap"
                  : "bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-medium px-4 py-2 rounded-xl transition-all whitespace-nowrap"
              }
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Search & Filter Bar */}
        <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-sm flex flex-wrap gap-3 items-center justify-between">
          <div className="relative w-full md:w-[400px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text" 
              placeholder="Tìm theo tên, email, MSSV / Mã GV, khoa..." 
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200/80 rounded-xl text-xs font-medium focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-3 w-full md:w-auto">
            <select 
              className="flex-1 md:w-48 px-3.5 py-2.5 bg-slate-50 border border-slate-200/80 rounded-xl text-xs font-medium text-slate-600 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              value={filterFaculty}
              onChange={(e) => setFilterFaculty(e.target.value)}
            >
              {FACULTIES.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
            <select 
              className="flex-1 md:w-44 px-3.5 py-2.5 bg-slate-50 border border-slate-200/80 rounded-xl text-xs font-medium text-slate-600 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="Tất cả">Tất cả trạng thái</option>
              <option value="Đang hoạt động">Đang hoạt động</option>
              <option value="Tạm khóa">Tạm khóa</option>
            </select>
          </div>
        </div>
      </div>

      {/* 4. BẢNG DỮ LIỆU CHÍNH */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50/50 border-b border-slate-200/80 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4">Hoạt động & Họ tên</th>
                <th className="px-6 py-4">Vai trò</th>
                <th className="px-6 py-4">Mã định danh</th>
                <th className="px-6 py-4">Khoa / Đơn vị</th>
                <th className="px-6 py-4">Trạng thái</th>
                <th className="px-6 py-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredUsers.map(user => (
                <tr key={user.id} className="hover:bg-slate-50/50 transition-colors">
                  
                  {/* Info */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-600 text-xs shadow-sm">
                        {getAvatarInitials(user.name)}
                      </div>
                      <div>
                        <div className="font-bold text-slate-800 text-[13px]">{user.name}</div>
                        <div className="text-[11px] text-slate-500">{user.email}</div>
                      </div>
                    </div>
                  </td>
                  
                  {/* Role */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-xs font-medium text-slate-700">
                      {user.role}
                    </span>
                  </td>
                  
                  {/* ID */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="font-mono text-xs font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200/60">
                      {user.identifier}
                    </span>
                  </td>
                  
                  {/* Faculty */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-[12px] font-medium text-slate-700">{user.faculty}</div>
                    <div className="text-[11px] text-slate-400">{user.department}</div>
                  </td>
                  
                  {/* Status */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <span className={`h-2 w-2 rounded-full ${user.status === 'active' ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                      <span className="text-xs font-medium text-slate-700">
                        {user.status === 'active' ? 'Đang hoạt động' : 'Tạm khóa'}
                      </span>
                    </div>
                  </td>
                  
                  {/* Actions */}
                  <td className="px-6 py-4 whitespace-nowrap text-right text-slate-400">
                    <div className="flex items-center justify-end gap-2">
                      <button 
                        onClick={() => handleOpenModal(user)}
                        className="p-1.5 hover:bg-slate-100 hover:text-blue-600 rounded-lg transition-colors"
                        title="Sửa thông tin"
                      >
                        <Edit2 size={15} />
                      </button>
                      <button 
                        onClick={() => toggleUserStatus(user.id)}
                        className={`p-1.5 rounded-lg transition-colors ${
                          user.status === 'active' 
                            ? 'hover:bg-amber-50 hover:text-amber-600' 
                            : 'hover:bg-emerald-50 hover:text-emerald-600'
                        }`}
                        title={user.status === 'active' ? "Tạm khóa" : "Mở khóa"}
                      >
                        {user.status === 'active' ? <Lock size={15} /> : <Unlock size={15} />}
                      </button>
                      <button 
                        onClick={() => alert("Đã gửi email khôi phục mật khẩu!")}
                        className="p-1.5 hover:bg-slate-100 hover:text-slate-700 rounded-lg transition-colors"
                        title="Khôi phục mật khẩu"
                      >
                        <RefreshCw size={15} />
                      </button>
                      <button 
                        onClick={() => handleDeleteUser(user.id)}
                        className="p-1.5 hover:bg-rose-50 hover:text-rose-600 rounded-lg transition-colors"
                        title="Xóa người dùng"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center justify-center text-slate-400">
                      <UserX size={32} className="mb-2 text-slate-300" />
                      <p className="text-sm font-medium">Không tìm thấy người dùng nào</p>
                      <p className="text-xs mt-1">Thử thay đổi từ khóa hoặc bộ lọc</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        <div className="bg-slate-50/50 p-4 border-t border-slate-100 text-xs text-slate-500 font-medium flex justify-between items-center">
          <span>Hiển thị {filteredUsers.length} kết quả</span>
          <div className="flex gap-1">
            <button className="px-2 py-1 hover:bg-slate-200 rounded transition-colors disabled:opacity-50" disabled>Trước</button>
            <button className="px-2 py-1 bg-white border border-slate-200 rounded font-bold text-slate-700 shadow-sm">1</button>
            <button className="px-2 py-1 hover:bg-slate-200 rounded transition-colors disabled:opacity-50" disabled>Sau</button>
          </div>
        </div>
      </div>

      {/* 6. MODAL THÊM/SỬA NGƯỜI DÙNG */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-900">
                {editingUser ? 'Sửa thông tin người dùng' : 'Thêm người dùng mới'}
              </h2>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 rounded-lg transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            
            <form onSubmit={handleSaveModal} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">Loại người dùng <span className="text-rose-500">*</span></label>
                  <select 
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    value={formData.role}
                    onChange={(e) => setFormData({...formData, role: e.target.value as any})}
                  >
                    <option value="Sinh viên">Sinh viên</option>
                    <option value="Giảng viên">Giảng viên</option>
                    <option value="Cán bộ phòng">Cán bộ quản lý</option>
                  </select>
                </div>
                
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">Trạng thái</label>
                  <select 
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    value={formData.status}
                    onChange={(e) => setFormData({...formData, status: e.target.value as any})}
                  >
                    <option value="active">Đang hoạt động</option>
                    <option value="locked">Tạm khóa</option>
                  </select>
                </div>
                
                <div className="col-span-2">
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">Họ và tên <span className="text-rose-500">*</span></label>
                  <input 
                    type="text" 
                    placeholder="Nguyễn Văn A"
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    value={formData.name || ''}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                  />
                </div>
                
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">Email <span className="text-rose-500">*</span></label>
                  <input 
                    type="email" 
                    placeholder="email@truong.edu.vn"
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    value={formData.email || ''}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                  />
                </div>
                
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">Mã định danh (MSSV/GV) <span className="text-rose-500">*</span></label>
                  <input 
                    type="text" 
                    placeholder="VD: SV2026123"
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    value={formData.identifier || ''}
                    onChange={(e) => setFormData({...formData, identifier: e.target.value})}
                  />
                </div>

                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">Khoa / Viện</label>
                  <select 
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    value={formData.faculty || 'Khoa CNTT'}
                    onChange={(e) => setFormData({...formData, faculty: e.target.value})}
                  >
                    {FACULTIES.filter(f => f !== 'Tất cả').map(f => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                </div>

                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">Bộ môn / Lớp</label>
                  <input 
                    type="text" 
                    placeholder="VD: Lớp DPT14A"
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    value={formData.department || ''}
                    onChange={(e) => setFormData({...formData, department: e.target.value})}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 mt-6">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-xl transition-all"
                >
                  Hủy bỏ
                </button>
                <button 
                  type="submit"
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl shadow-sm transition-all flex items-center gap-2"
                >
                  {editingUser ? 'Lưu thay đổi' : 'Tạo người dùng'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
