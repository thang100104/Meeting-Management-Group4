import React, { useState } from 'react';
import { Mail, Lock, Video, Calendar, MonitorPlay, RefreshCw, User as UserIcon } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

const API_BASE = "http://localhost:8000/api/v1";

export default function Register() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [roleName, setRoleName] = useState('student');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !email || !password || !confirmPassword) {
      alert('Vui lòng điền đầy đủ các thông tin!');
      return;
    }
    if (password !== confirmPassword) {
      alert('Mật khẩu xác nhận không trùng khớp!');
      return;
    }

    setLoading(true);
    
    // Simulate API delay
    setTimeout(() => {
      const registeredUsers = JSON.parse(localStorage.getItem('meetinghub_registered_users') || '[]');
      const cleanEmail = email.trim().toLowerCase();
      
      const emailExists = registeredUsers.some((u: any) => u.email === cleanEmail);
      if (emailExists) {
        alert("Email này đã được sử dụng! Vui lòng dùng email khác.");
        setLoading(false);
        return;
      }

      const newUser = {
        fullName,
        email: cleanEmail,
        password,
        role: roleName,
        avatarUrl: "",
        phone: ""
      };

      registeredUsers.push(newUser);
      localStorage.setItem('meetinghub_registered_users', JSON.stringify(registeredUsers));
      localStorage.setItem('meetinghub_user', JSON.stringify(newUser));

      alert("✓ Đăng ký tài khoản thành công! Vui lòng đăng nhập.");
      setLoading(false);
      
      // Navigate to login with the registered email
      navigate('/login', { state: { registeredEmail: cleanEmail } });
    }, 800);
  };

  return (
    <div className="login-container">
      <div className="login-split">
        {/* CỘT TRÁI - Banner */}
        <div className="login-banner">
          <div className="login-banner-bg"></div>
          <div className="login-banner-overlay"></div>
          <div className="login-banner-content">
            <div className="login-logo-group">
              <div className="login-logo-large">
                <Video size={42} strokeWidth={2.5} />
                <div className="logo-text">
                  Ictu<span>Meeting</span>
                </div>
              </div>
              <div className="login-logo-separator"></div>
              <div className="login-logo-ictu">
                <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/c/cf/Logo_ICTU.png/120px-Logo_ICTU.png" alt="ICTU" className="ictu-logo-img" onError={(e) => e.currentTarget.style.display = 'none'} />
                <span className="ictu-text">ICTU<br/><small>Đại học Thái Nguyên</small></span>
              </div>
            </div>
            
            <h1 className="login-slogan">
              Bắt đầu với nền tảng<br />quản lý cuộc họp tối ưu
            </h1>
            
            <div className="login-features">
              <div className="feature-item">
                <Calendar size={20} />
                <span>Lên lịch cuộc họp nhanh chóng</span>
              </div>
              <div className="feature-item">
                <MonitorPlay size={20} />
                <span>Quản lý phòng và thiết bị</span>
              </div>
              <div className="feature-item">
                <RefreshCw size={20} />
                <span>Đồng bộ lịch cá nhân</span>
              </div>
            </div>
          </div>
        </div>
        
        {/* CỘT PHẢI - Form */}
        <div className="login-form-container">
          <div className="login-form-wrapper" style={{ padding: '1rem 2rem' }}>
            <div className="login-form-header" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginBottom: '2rem' }}>
              <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 shadow-md mb-4 mx-auto" style={{ width: '4rem', height: '4rem', borderRadius: '0.75rem', background: 'linear-gradient(to bottom right, #2563eb, #4338ca)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', margin: '0 auto 1rem auto' }}>
                <Video size={36} color="white" />
              </div>
              <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-900 via-blue-700 to-indigo-600 bg-clip-text text-transparent" style={{ fontSize: '1.875rem', fontWeight: 'bold', background: 'linear-gradient(to right, #1e3a8a, #1d4ed8, #4f46e5)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', margin: '0 0 8px 0' }}>IctuMeeting</h2>
              <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#1e293b', margin: '0.5rem 0' }}>Đăng ký tài khoản</h3>
              <p style={{ color: '#64748b', margin: 0 }}>Tạo tài khoản IctuMeeting mới</p>
            </div>
            
            <form onSubmit={handleRegister} className="login-form" style={{ gap: '1rem' }} autoComplete="off">
              {/* Khắc phục triệt để Autofill của Chrome */}
              <input type="email" name="fake_email" style={{ position: 'absolute', opacity: 0, top: '-9999px', height: 0, width: 0 }} tabIndex={-1} aria-hidden="true" autoComplete="off" />
              <input type="password" name="fake_password" style={{ position: 'absolute', opacity: 0, top: '-9999px', height: 0, width: 0 }} tabIndex={-1} aria-hidden="true" autoComplete="off" />
              <div className="form-group">
                <label>Họ và tên</label>
                <div className="input-with-icon">
                  <UserIcon size={18} className="input-icon" />
                  <input 
                    type="text" 
                    placeholder="VD: Nguyễn Văn A" 
                    value={fullName}
                    autoComplete="new-password"
                    onChange={(e) => setFullName(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Email (Nội bộ ICTU)</label>
                <div className="input-with-icon">
                  <Mail size={18} className="input-icon" />
                  <input 
                    type="email" 
                    placeholder="VD: name@ictu.edu.vn" 
                    value={email}
                    autoComplete="new-password"
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>
              
              <div style={{ display: 'flex', gap: '1rem' }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Mật khẩu</label>
                  <div className="input-with-icon">
                    <Lock size={18} className="input-icon" />
                    <input 
                      type="password" 
                      placeholder="Mật khẩu" 
                      value={password}
                      autoComplete="new-password"
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="form-group" style={{ flex: 1 }}>
                  <label>Nhập lại mật khẩu</label>
                  <div className="input-with-icon">
                    <Lock size={18} className="input-icon" />
                    <input 
                      type="password" 
                      placeholder="Nhập lại" 
                      value={confirmPassword}
                      autoComplete="new-password"
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="form-group">
                <label>Vai trò</label>
                <select className="modern-input" value={roleName} onChange={(e) => setRoleName(e.target.value)} style={{ padding: '0.875rem 1rem', width: '100%', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                  <option value="student">Sinh viên / Khách tham gia</option>
                  <option value="lecturer">Giảng viên / Người tổ chức</option>
                  <option value="admin">Quản trị viên</option>
                </select>
              </div>
              
              <button type="submit" className="btn-login" disabled={loading} style={{ marginTop: '0.5rem' }}>
                {loading ? <span className="loading-spinner-sm"></span> : 'Đăng ký tài khoản'}
              </button>
            </form>
            
            <div className="login-footer">
              Đã có tài khoản? <Link to="/login">Đăng nhập ngay</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
