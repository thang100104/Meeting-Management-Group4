import React, { useState } from 'react';
import { Mail, Lock, Video, Calendar, MonitorPlay, RefreshCw } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { getStorage, setStorage } from '../utils/syncHelper';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

interface LoginProps {
  onLoginSuccess: (token: string, user: any) => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const navigate = useNavigate();
  const { updateUser } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<string | null>(null);

  const validate = () => {
    let isValid = true;
    setEmailError('');
    setPasswordError('');

    if (!email) {
      setEmailError('Email không được để trống');
      isValid = false;
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      setEmailError('Email không đúng định dạng');
      isValid = false;
    }

    if (!password) {
      setPasswordError('Mật khẩu không được để trống');
      isValid = false;
    }
    return isValid;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    const inputEmail = email.trim().toLowerCase();
    const inputPassword = password.trim();

    try {
      let payload: any = {
        email: inputEmail,
        password: inputPassword
      };

      try {
        const response = await api.post('/auth/login', payload);
        await handleLoginResponse(response.data);
      } catch (jsonErr: any) {
        if (jsonErr.response?.status === 422) {
          const formData = new URLSearchParams();
          formData.append('username', inputEmail);
          formData.append('password', inputPassword);
          const formResponse = await api.post('/auth/login', formData, {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
          });
          await handleLoginResponse(formResponse.data);
        } else {
          throw jsonErr;
        }
      }

    } catch (error: any) {
      console.error("Login API Error, attempting fallback mock data:", error);
      
      // MOCK FALLBACK DUAL-MODE
      if (inputEmail === 'admin@ictu.edu.vn' && inputPassword === '123456') {
        let mockAdmin = { id: 1, email: inputEmail, fullName: 'Admin System', role: 'ADMIN', avatar: '' };
        
        // Ưu tiên đọc dữ liệu cũ đã lưu (nếu có) để không bị mất sửa đổi Profile
        const savedMock = localStorage.getItem(`mock_profile_${inputEmail}`);
        if (savedMock) {
          try { mockAdmin = { ...mockAdmin, ...JSON.parse(savedMock) }; } catch(e){}
        }

        const token = 'mock-token-admin';
        localStorage.setItem('access_token', token);
        localStorage.setItem('token', token);
        sessionStorage.setItem('access_token', token);
        sessionStorage.setItem('token', token);
        
        localStorage.setItem('user', JSON.stringify(mockAdmin));
        localStorage.setItem('currentUser', JSON.stringify(mockAdmin));
        sessionStorage.setItem('user', JSON.stringify(mockAdmin));
        sessionStorage.setItem('currentUser', JSON.stringify(mockAdmin));
        setStorage('meetinghub_user', mockAdmin);
        
        onLoginSuccess(token, mockAdmin);
        updateUser(mockAdmin);
        
        navigate('/dashboard');
        setLoading(false);
        return;
      }

      if ((inputEmail === 'hoangphuong@ictu.edu.vn' || inputEmail.endsWith('@ictu.edu.vn')) && inputPassword === '123456') {
        let mockLecturer = { id: 2, email: inputEmail, fullName: 'Giảng viên ICTU', role: 'LECTURER', avatar: '' };
        
        // Ưu tiên đọc dữ liệu cũ đã lưu
        const savedMock = localStorage.getItem(`mock_profile_${inputEmail}`);
        if (savedMock) {
          try { mockLecturer = { ...mockLecturer, ...JSON.parse(savedMock) }; } catch(e){}
        }

        const token = 'mock-token-lecturer';
        localStorage.setItem('access_token', token);
        localStorage.setItem('token', token);
        sessionStorage.setItem('access_token', token);
        sessionStorage.setItem('token', token);
        
        localStorage.setItem('user', JSON.stringify(mockLecturer));
        localStorage.setItem('currentUser', JSON.stringify(mockLecturer));
        sessionStorage.setItem('user', JSON.stringify(mockLecturer));
        sessionStorage.setItem('currentUser', JSON.stringify(mockLecturer));
        setStorage('meetinghub_user', mockLecturer);
        
        onLoginSuccess(token, mockLecturer);
        updateUser(mockLecturer);
        
        navigate('/lecturer');
        setLoading(false);
        return;
      }

      // Nếu không phải tài khoản mock thì báo lỗi như bình thường
      const detail = error.response?.data?.detail;
      const errorMsg = typeof detail === 'string' ? detail : 'Email hoặc mật khẩu không chính xác!';
      alert(`[Lỗi Backend]: ${errorMsg}`);
    } finally {
      setLoading(false);
    }
  };

  const handleLoginResponse = async (data: any) => {
    const access_token = data.access_token || data.token;
    
    // Lưu token ngay lập tức để api.ts có thể mang theo trong request tiếp theo
    localStorage.setItem('access_token', access_token);
    localStorage.setItem('token', access_token); 
    sessionStorage.setItem('access_token', access_token);
    sessionStorage.setItem('token', access_token);

    try {
      // 2. FRONTEND: Gọi API lấy dữ liệu chuẩn từ Database
      const meResponse = await api.get('/auth/me', {
        headers: {
          Authorization: `Bearer ${access_token}`
        }
      });
      
      const dbUser = meResponse.data;
      
      const finalUserData = {
        id: dbUser.user_id,
        email: dbUser.email,
        fullName: dbUser.full_name,
        role: dbUser.role?.role_name || dbUser.role || data.role || (dbUser.email.includes('admin') ? 'ADMIN' : 'LECTURER'),
        avatar: dbUser.avatar_url || ''
      };

      localStorage.setItem('user', JSON.stringify(finalUserData));
      localStorage.setItem('currentUser', JSON.stringify(finalUserData));
      sessionStorage.setItem('user', JSON.stringify(finalUserData));
      sessionStorage.setItem('currentUser', JSON.stringify(finalUserData));
      setStorage('meetinghub_user', finalUserData);

      onLoginSuccess(access_token, finalUserData);
      updateUser(finalUserData);

      window.dispatchEvent(new Event('user-data-updated'));
      window.dispatchEvent(new Event('userProfileUpdated'));

      const r = (finalUserData.role || '').toLowerCase();
      if (r === 'lecturer' || r.includes('giảng viên')) {
        navigate('/lecturer');
      } else {
        navigate('/dashboard'); // Admin dashboard
      }
    } catch (error) {
      console.error("Lỗi khi fetch thông tin user từ DB:", error);
      alert("Đăng nhập thành công nhưng không lấy được thông tin hồ sơ. Vui lòng thử lại!");
    }
  };

  const handleSocialLogin = (provider: string) => {
    if (provider === 'Google') {
      navigate('/auth/google');
    } else {
      navigate('/auth/microsoft');
    }
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
                <span className="ictu-text">ICTU<br /><small>Đại học Thái Nguyên</small></span>
              </div>
            </div>

            <h1 className="login-slogan">
              Quản lý cuộc họp dễ dàng,<br />kết nối mọi người
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
          <div className="login-form-wrapper">
            <div className="login-form-header" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginBottom: '2rem' }}>
              <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 shadow-md mb-4 mx-auto" style={{ width: '4rem', height: '4rem', borderRadius: '0.75rem', background: 'linear-gradient(to bottom right, #2563eb, #4338ca)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', margin: '0 auto 1rem auto' }}>
                <Video size={36} color="white" />
              </div>
              <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-900 via-blue-700 to-indigo-600 bg-clip-text text-transparent" style={{ fontSize: '1.875rem', fontWeight: 'bold', background: 'linear-gradient(to right, #1e3a8a, #1d4ed8, #4f46e5)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', margin: '0 0 8px 0' }}>IctuMeeting</h2>
              <p style={{ color: '#64748b', margin: 0 }}>Đăng nhập để tiếp tục sử dụng hệ thống</p>
            </div>

            <form onSubmit={handleLogin} className="login-form" autoComplete="off">
              {/* Khắc phục triệt để Autofill của Chrome */}
              <input type="email" name="fake_email" style={{ position: 'absolute', opacity: 0, top: '-9999px', height: 0, width: 0 }} tabIndex={-1} aria-hidden="true" autoComplete="off" />
              <input type="password" name="fake_password" style={{ position: 'absolute', opacity: 0, top: '-9999px', height: 0, width: 0 }} tabIndex={-1} aria-hidden="true" autoComplete="off" />
              <div className="form-group">
                <label>Email</label>
                <div className={`input-with-icon ${emailError ? 'has-error' : ''}`}>
                  <Mail size={18} className="input-icon" />
                  <input
                    type="email"
                    placeholder="Nhập email của bạn"
                    value={email}
                    autoComplete="new-password"
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (emailError) setEmailError('');
                    }}
                  />
                </div>
                {emailError && <div className="error-text">{emailError}</div>}
              </div>

              <div className="form-group">
                <label>Mật khẩu</label>
                <div className={`input-with-icon ${passwordError ? 'has-error' : ''}`}>
                  <Lock size={18} className="input-icon" />
                  <input
                    type="password"
                    placeholder="Nhập mật khẩu"
                    value={password}
                    autoComplete="new-password"
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (passwordError) setPasswordError('');
                    }}
                  />
                </div>
                {passwordError && <div className="error-text">{passwordError}</div>}
              </div>

              <div className="form-options">
                <label className="remember-me">
                  <input type="checkbox" />
                  <span>Ghi nhớ đăng nhập</span>
                </label>
                <Link to="/forgot-password" className="forgot-password">Quên mật khẩu?</Link>
              </div>

              <button type="submit" className="btn-login" disabled={loading}>
                {loading ? <span className="loading-spinner-sm"></span> : 'Đăng nhập'}
              </button>
            </form>

            <div className="login-divider">
              <span>Hoặc đăng nhập bằng</span>
            </div>

            <div className="social-login" style={{ display: 'flex', gap: '1rem' }}>
              <button type="button" className="btn-social hover:border-indigo-500 hover:shadow-md active:scale-95 transition-all duration-200 flex-1" onClick={() => handleSocialLogin('Google')} disabled={socialLoading !== null} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '0.75rem', border: '1px solid #e2e8f0', borderRadius: '0.5rem', backgroundColor: 'white', cursor: socialLoading !== null ? 'not-allowed' : 'pointer', transition: 'all 0.2s', width: '100%', opacity: socialLoading !== null ? 0.7 : 1 }}>
                {socialLoading === 'Google' ? (
                  <span className="loading-spinner-sm" style={{ width: '1.25rem', height: '1.25rem', border: '2px solid rgba(79, 70, 229, 0.3)', borderTopColor: '#4f46e5', borderRadius: '50%', animation: 'spin 1s linear infinite', display: 'inline-block' }}></span>
                ) : (
                  <>
                    <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google" style={{ width: '20px', height: '20px' }} />
                    <span style={{ fontWeight: 500, color: '#334155' }}>Google</span>
                  </>
                )}
              </button>
              <button type="button" className="btn-social hover:border-indigo-500 hover:shadow-md active:scale-95 transition-all duration-200 flex-1" onClick={() => handleSocialLogin('Microsoft')} disabled={socialLoading !== null} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '0.75rem', border: '1px solid #e2e8f0', borderRadius: '0.5rem', backgroundColor: 'white', cursor: socialLoading !== null ? 'not-allowed' : 'pointer', transition: 'all 0.2s', width: '100%', opacity: socialLoading !== null ? 0.7 : 1 }}>
                {socialLoading === 'Microsoft' ? (
                  <span className="loading-spinner-sm" style={{ width: '1.25rem', height: '1.25rem', border: '2px solid rgba(79, 70, 229, 0.3)', borderTopColor: '#4f46e5', borderRadius: '50%', animation: 'spin 1s linear infinite', display: 'inline-block' }}></span>
                ) : (
                  <>
                    <img src="https://upload.wikimedia.org/wikipedia/commons/4/44/Microsoft_logo.svg" alt="Microsoft" style={{ width: '20px', height: '20px' }} />
                    <span style={{ fontWeight: 500, color: '#334155' }}>Microsoft</span>
                  </>
                )}
              </button>
            </div>

            <div className="login-footer">
              Chưa có tài khoản? <Link to="/register">Đăng ký ngay</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
