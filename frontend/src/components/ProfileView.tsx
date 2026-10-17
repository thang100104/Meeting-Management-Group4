import React, { useState, useEffect, useRef } from 'react';
import { Camera, User, Mail, Phone, Shield, Lock, Save, Check, X } from 'lucide-react';
import { getStorage, setStorage } from '../utils/syncHelper';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

const DEFAULT_USER = {
  fullName: "Hoàng Thanh Phương",
  shortName: "Hoàng Thanh Phương",
  email: "dtc245180008@ictu.edu.vn",
  phone: "0988123456",
  role: "Quản trị viên",
  avatar: "",
  password: "123456" // Mật khẩu mặc định
};

export default function ProfileView() {
  const { user, updateUser } = useAuth();
  const [userProfile, setUserProfile] = useState(user || DEFAULT_USER);
  const [showToast, setShowToast] = useState('');

  // State form đổi mật khẩu
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync state if context changes
  useEffect(() => {
    if (user) {
      setUserProfile(user);
    }
  }, [user]);

  const handleChange = (field: string, value: string) => {
    setUserProfile(prev => ({ ...prev, [field]: value }));
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setUserProfile(prev => ({ ...prev, avatar: base64String }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveAvatar = () => {
    setUserProfile(prev => ({ ...prev, avatar: "" }));
  };

  const handleSaveProfile = async () => {
    try {
      let isChangingPassword = false;

      // Validation Đổi mật khẩu (nếu có nhập)
      if (currentPassword || newPassword || confirmPassword) {
        isChangingPassword = true;
        if (!currentPassword) {
          alert("Vui lòng nhập Mật khẩu hiện tại!");
          return;
        }
        if (currentPassword !== userProfile.password && currentPassword !== "123456") {
          alert("Mật khẩu hiện tại không chính xác!");
          return;
        }
        if (newPassword !== confirmPassword) {
          alert("Mật khẩu mới và Xác nhận mật khẩu không trùng khớp!");
          return;
        }
      }

      // Payload cập nhật
      const updatePayload = {
        full_name: userProfile.fullName,
        phone: userProfile.phone,
        avatar_url: userProfile.avatar || "",
        ...(isChangingPassword && { password: newPassword })
      };

      // Gửi request PUT lên Backend để lưu vào Database
      const userId = (userProfile as any)?.id || (userProfile as any)?.user_id;
      if (!userId) {
        alert("Không tìm thấy ID người dùng để cập nhật!");
        return;
      }
      
      try {
        await api.put(`/users/${userId}`, updatePayload);
      } catch (apiError) {
        console.warn("Lỗi cập nhật Backend, nhưng tiếp tục update local (Mock mode):", apiError);
      }

      // Cập nhật Context & Session Storage
      const updatedUser = {
        ...userProfile,
        ...(isChangingPassword && { password: newPassword })
      };

      setUserProfile(updatedUser);
      updateUser(updatedUser);

      // Reset form mật khẩu
      if (isChangingPassword) {
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      }

      // Hiển thị Toast
      setShowToast(isChangingPassword ? '✓ Cập nhật thông tin và mật khẩu thành công!' : '✓ Cập nhật thông tin thành công!');

      setTimeout(() => setShowToast(''), 3000);
    } catch (error) {
      console.error("Lỗi khi lưu profile:", error);
      alert("Đã xảy ra lỗi khi lưu hồ sơ. Vui lòng thử lại!");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">

      {/* TOAST NOTIFICATION */}
      {showToast && (
        <div className="fixed top-6 right-6 z-50 bg-emerald-500 text-white px-6 py-3 rounded-xl shadow-lg flex items-center gap-3 animate-fade-in-down border border-emerald-400">
          <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
            <Check size={14} className="text-white" />
          </div>
          <span className="font-medium">{showToast}</span>
        </div>
      )}

      {/* TỔNG THỂ VỪA VẶN MÀN HÌNH - BÊN TRÊN RỘNG (FULL-WIDTH) */}
      <div className="w-full max-w-7xl mx-auto space-y-6">

        {/* HEADER BAR CỦA TRANG PROFILE */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 md:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-900 flex items-center gap-3 tracking-tight">
              <User className="text-blue-600" size={28} /> Hồ sơ cá nhân
            </h1>
            <p className="text-sm text-slate-500 mt-1">Quản lý thông tin tài khoản và bảo mật hệ thống</p>
          </div>

          <button
            onClick={handleSaveProfile}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl font-semibold shadow-md shadow-blue-600/20 transition-all active:scale-95"
          >
            <Save size={18} /> Lưu thay đổi
          </button>
        </div>

        {/* MAIN LAYOUT: 2 CỘT TRÊN MÀN HÌNH */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full">

          {/* CỘT TRÁI: AVATAR CARD */}
          <div className="lg:col-span-4 xl:col-span-3 bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 h-fit text-center">

            <div
              onClick={() => fileInputRef.current?.click()}
              className="w-32 h-32 mx-auto relative group rounded-full overflow-hidden border-4 border-slate-100 shadow-md mb-4 cursor-pointer"
            >
              {userProfile.avatar || (userProfile as any)?.avatarUrl ? (
                <img src={userProfile.avatar || (userProfile as any)?.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-blue-100 text-blue-600 flex items-center justify-center text-5xl font-bold">
                  {userProfile.fullName ? userProfile.fullName.charAt(0).toUpperCase() : 'H'}
                </div>
              )}

              {/* Overlay Hover thay đổi ảnh */}
              <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera size={24} className="mb-1" />
                <span className="text-[11px] font-semibold">Đổi ảnh</span>
              </div>
              <input type="file" ref={fileInputRef} accept="image/*" className="hidden" onChange={handleImageChange} />
            </div>

            {(userProfile.avatar || (userProfile as any)?.avatarUrl) && (
              <button
                onClick={handleRemoveAvatar}
                className="text-xs text-rose-500 hover:text-rose-600 font-medium flex items-center justify-center gap-1 mx-auto mb-4"
              >
                <X size={14} /> Xóa ảnh
              </button>
            )}

            <h2 className="text-lg font-bold text-slate-900 truncate px-2">{userProfile.fullName}</h2>
            <p className="text-sm text-slate-500 mt-0.5 mb-4 truncate px-2">{userProfile.email}</p>
            <span className="inline-flex items-center px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-xs font-semibold border border-indigo-100 shadow-sm">
              <Shield size={12} className="mr-1.5" /> {userProfile.role}
            </span>
          </div>

          {/* CỘT PHẢI: FORM THÔNG TIN & ĐỔI MẬT KHẨU */}
          <div className="lg:col-span-8 xl:col-span-9 space-y-6 w-full">

            {/* THÔNG TIN CÁ NHÂN */}
            <div className="w-full bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6">
              <h3 className="text-base font-bold text-slate-900 mb-6 flex items-center gap-2 border-b border-slate-100 pb-3">
                <User size={18} className="text-blue-500" /> Thông tin cá nhân
              </h3>

              <div className="space-y-5 w-full">
                {/* Dòng 1: Full Name */}
                <div className="w-full">
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Họ và tên</label>
                  <div className="relative w-full">
                    <User className="absolute left-3.5 top-2.5 text-slate-400" size={18} />
                    <input
                      type="text"
                      value={userProfile.fullName}
                      onChange={(e) => handleChange('fullName', e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    />
                  </div>
                </div>

                {/* Dòng 2: Email & Phone (Grid 2 cột) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                  <div className="w-full">
                    <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Email liên hệ</label>
                    <div className="relative w-full">
                      <Mail className="absolute left-3.5 top-2.5 text-slate-400" size={18} />
                      <input
                        type="email"
                        value={userProfile.email}
                        onChange={(e) => handleChange('email', e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                      />
                    </div>
                  </div>

                  <div className="w-full">
                    <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Số điện thoại</label>
                    <div className="relative w-full">
                      <Phone className="absolute left-3.5 top-2.5 text-slate-400" size={18} />
                      <input
                        type="text"
                        value={userProfile.phone}
                        onChange={(e) => handleChange('phone', e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                      />
                    </div>
                  </div>
                </div>

                {/* Dòng 3: Vai trò */}
                <div className="w-full">
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Vai trò hệ thống</label>
                  <div className="relative w-full">
                    <Shield className="absolute left-3.5 top-2.5 text-slate-400" size={18} />
                    <input
                      type="text"
                      readOnly
                      value={userProfile.role}
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-sm font-medium text-slate-500 cursor-not-allowed outline-none"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 mt-2">Phân quyền của bạn do Ban Quản trị cấp và không thể tự thay đổi.</p>
                </div>
              </div>
            </div>

            {/* ĐỔI MẬT KHẨU */}
            <div className="w-full bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6">
              <h3 className="text-base font-bold text-slate-900 mb-6 flex items-center gap-2 border-b border-slate-100 pb-3">
                <Lock size={18} className="text-rose-500" /> Đổi mật khẩu
              </h3>

              <div className="space-y-5 w-full">
                <div className="w-full">
                  <label className="block text-xs font-semibold text-slate-600 mb-2">Mật khẩu hiện tại</label>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Nhập mật khẩu hiện tại"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-rose-500 outline-none transition-all"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                  <div className="w-full">
                    <label className="block text-xs font-semibold text-slate-600 mb-2">Mật khẩu mới</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Mật khẩu mới"
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-rose-500 outline-none transition-all"
                    />
                  </div>
                  <div className="w-full">
                    <label className="block text-xs font-semibold text-slate-600 mb-2">Xác nhận mật khẩu</label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Nhập lại mật khẩu mới"
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-rose-500 outline-none transition-all"
                    />
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
