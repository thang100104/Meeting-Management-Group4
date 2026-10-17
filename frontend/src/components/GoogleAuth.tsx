import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft } from 'lucide-react';

const API_BASE = "http://localhost:8000/api/v1";

interface GoogleAuthProps {
  onLoginSuccess: (token: string, user: any) => void;
}

export default function GoogleAuth({ onLoginSuccess }: GoogleAuthProps) {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('sinhvien@ictu.edu.vn');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(60);

  useEffect(() => {
    let timer: any;
    if (step === 2 && countdown > 0) {
      timer = setInterval(() => setCountdown(c => c - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [step, countdown]);

  const handleNextStep1 = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast.error('Vui lòng nhập email');
      return;
    }
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setStep(2);
    }, 1500);
  };

  const handleNextStep2 = (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp) {
      toast.error('Vui lòng nhập mã OTP');
      return;
    }
    if (otp !== '123456') {
      toast.error('Mã OTP không đúng. Vui lòng nhập 123456');
      return;
    }
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setStep(3);
    }, 1500);
  };

  const handleConsent = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: 'sinhvien@ictu.edu.vn', password: '123456' })
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Đăng nhập Google thành công!");
        const meRes = await fetch(`${API_BASE}/auth/me`, {
          headers: { Authorization: `Bearer ${data.access_token}` }
        });
        if (meRes.ok) {
          const userData = await meRes.json();
          localStorage.setItem('token', data.access_token);
          onLoginSuccess(data.access_token, userData);
          navigate('/');
        }
      } else {
        toast.error("Đăng nhập thất bại");
      }
    } catch (err) {
      toast.error("Lỗi kết nối máy chủ");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#f0f4f9', fontFamily: '"Roboto", sans-serif' }}>
      <div style={{ padding: '20px' }}>
        <button onClick={() => navigate('/login')} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'none', border: 'none', color: '#5f6368', cursor: 'pointer', fontWeight: 500 }}>
          <ArrowLeft size={16} /> Hủy và quay lại IctuMeeting
        </button>
      </div>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
        <div style={{ background: '#fff', borderRadius: '8px', padding: '40px', maxWidth: '450px', width: '100%', border: '1px solid #dadce0', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          
          <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google" style={{ width: '48px', height: '48px', marginBottom: '16px' }} />
          <h1 style={{ fontSize: '24px', fontWeight: 400, color: '#202124', marginBottom: '8px' }}>Đăng nhập</h1>
          <p style={{ fontSize: '16px', color: '#202124', marginBottom: '32px', textAlign: 'center' }}>Chuyển tiếp tới ứng dụng IctuMeeting (ictu.edu.vn)</p>

          {step === 1 && (
            <form onSubmit={handleNextStep1} style={{ width: '100%' }}>
              <div style={{ marginBottom: '32px', position: 'relative' }}>
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{ width: '100%', padding: '13px 15px', fontSize: '16px', border: '1px solid #dadce0', borderRadius: '4px', outline: 'none' }}
                  placeholder="Email hoặc số điện thoại"
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button type="button" style={{ color: '#1a73e8', background: 'none', border: 'none', fontWeight: 500, cursor: 'pointer' }}>Bạn quên địa chỉ email?</button>
                <button type="submit" disabled={loading} style={{ background: '#1a73e8', color: '#fff', border: 'none', padding: '10px 24px', borderRadius: '4px', fontWeight: 500, cursor: loading ? 'not-allowed' : 'pointer' }}>
                  {loading ? 'Đang xử lý...' : 'Tiếp theo'}
                </button>
              </div>
            </form>
          )}

          {step === 2 && (
            <form onSubmit={handleNextStep2} style={{ width: '100%' }}>
              <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', border: '1px solid #dadce0', borderRadius: '16px', padding: '4px 8px', width: 'fit-content', margin: '0 auto 24px' }}>
                <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: '#1a73e8', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px' }}>S</div>
                <span style={{ fontSize: '14px', color: '#3c4043', fontWeight: 500 }}>{email}</span>
              </div>
              
              <h2 style={{ fontSize: '18px', fontWeight: 400, color: '#202124', marginBottom: '24px', textAlign: 'center' }}>Xác minh 2 bước</h2>
              <p style={{ fontSize: '14px', color: '#5f6368', marginBottom: '16px', textAlign: 'center' }}>Nhập mã xác minh gồm 6 chữ số được gửi tới thiết bị của bạn. (Demo: 123456)</p>
              
              <div style={{ marginBottom: '24px' }}>
                <input 
                  type="text" 
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  style={{ width: '100%', padding: '13px 15px', fontSize: '16px', border: '1px solid #dadce0', borderRadius: '4px', outline: 'none', letterSpacing: '2px', textAlign: 'center' }}
                  placeholder="G - 1 2 3 4 5 6"
                  maxLength={6}
                />
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: '14px', color: '#1a73e8' }}>
                  {countdown > 0 ? `Gửi lại mã sau ${countdown}s` : <button type="button" onClick={() => setCountdown(60)} style={{ color: '#1a73e8', background: 'none', border: 'none', cursor: 'pointer' }}>Gửi lại mã</button>}
                </div>
                <button type="submit" disabled={loading} style={{ background: '#1a73e8', color: '#fff', border: 'none', padding: '10px 24px', borderRadius: '4px', fontWeight: 500, cursor: loading ? 'not-allowed' : 'pointer' }}>
                  {loading ? 'Đang xử lý...' : 'Tiếp theo'}
                </button>
              </div>
            </form>
          )}

          {step === 3 && (
            <div style={{ width: '100%' }}>
              <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', border: '1px solid #dadce0', borderRadius: '16px', padding: '4px 8px', width: 'fit-content', margin: '0 auto 24px' }}>
                <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: '#1a73e8', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px' }}>S</div>
                <span style={{ fontSize: '14px', color: '#3c4043', fontWeight: 500 }}>{email}</span>
              </div>
              
              <h2 style={{ fontSize: '18px', fontWeight: 400, color: '#202124', marginBottom: '16px' }}>IctuMeeting muốn truy cập Tài khoản Google của bạn</h2>
              
              <ul style={{ paddingLeft: '20px', color: '#3c4043', fontSize: '14px', marginBottom: '32px', lineHeight: '1.6' }}>
                <li>Xem thông tin cá nhân của bạn, bao gồm mọi thông tin cá nhân mà bạn đã đặt ở chế độ công khai.</li>
                <li>Xem địa chỉ email chính của bạn.</li>
                <li>Đồng bộ lịch họp với Google Calendar.</li>
              </ul>
              
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '16px' }}>
                <button type="button" onClick={() => navigate('/login')} style={{ color: '#1a73e8', background: 'none', border: 'none', fontWeight: 500, cursor: 'pointer', padding: '10px' }}>Hủy bỏ</button>
                <button type="button" onClick={handleConsent} disabled={loading} style={{ background: '#1a73e8', color: '#fff', border: 'none', padding: '10px 24px', borderRadius: '4px', fontWeight: 500, cursor: loading ? 'not-allowed' : 'pointer' }}>
                  {loading ? 'Đang xử lý...' : 'Cho phép & Đăng nhập'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
