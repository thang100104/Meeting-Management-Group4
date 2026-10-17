import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft } from 'lucide-react';

const API_BASE = "http://localhost:8000/api/v1";

interface MicrosoftAuthProps {
  onLoginSuccess: (token: string, user: any) => void;
}

export default function MicrosoftAuth({ onLoginSuccess }: MicrosoftAuthProps) {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('giangvien@ictu.edu.vn');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleNextStep1 = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast.error('Enter a valid email address, phone number, or Skype name.');
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
    if (!password) {
      toast.error('Please enter the password for your account.');
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
        body: JSON.stringify({ email: 'giangvien@ictu.edu.vn', password: '123456' })
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Xác thực Microsoft 365 thành công!");
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
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#e2e8f0', backgroundImage: 'url("https://aadcdn.msauth.net/shared/1.0/content/images/backgrounds/2_bc3d32a696895f78c19df6c717586a5d.svg")', backgroundSize: 'cover', fontFamily: '"Segoe UI", "Helvetica Neue", "Lucida Grande", Roboto, Ebrima, "Nirmala UI", Gadugi, "Segoe Xbox Symbol", "Segoe UI Symbol", "Meiryo UI", "Khmer UI", Tunga, "Lao UI", Raavi, "Iskoola Pota", Latha, Leelawadee, Math1, "Kurdish UMF", "Microsoft PhagsPa", "Microsoft Tai Le", "Microsoft New Tai Lue", "Sylfaen", "Shruti", "Kalinga", "DaunPenh", "Plantagenet Cherokee", "Vrinda", "Kartika", "MV Boli", "Fiji", "Lao UI", "Raavi", "Iskoola Pota", "Latha", "Leelawadee", "Math1", "Kurdish UMF", "Microsoft PhagsPa", "Microsoft Tai Le", "Microsoft New Tai Lue", "Sylfaen", "Shruti", "Kalinga", "DaunPenh", "Plantagenet Cherokee", "Vrinda", "Kartika", "MV Boli", "Fiji", sans-serif' }}>
      
      <div style={{ padding: '20px' }}>
        <button onClick={() => navigate('/login')} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.8)', border: 'none', color: '#1b1b1b', cursor: 'pointer', fontWeight: 600, padding: '8px 16px', borderRadius: '4px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
          <ArrowLeft size={16} /> Hủy và quay lại IctuMeeting
        </button>
      </div>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ background: '#fff', padding: '44px', maxWidth: '440px', width: '100%', boxShadow: '0 2px 6px rgba(0,0,0,0.2)' }}>
          <img src="https://upload.wikimedia.org/wikipedia/commons/4/44/Microsoft_logo.svg" alt="Microsoft" style={{ height: '24px', marginBottom: '24px' }} />
          
          {step === 1 && (
            <form onSubmit={handleNextStep1}>
              <h1 style={{ fontSize: '24px', fontWeight: 600, color: '#1b1b1b', marginBottom: '16px' }}>Sign in</h1>
              <div style={{ marginBottom: '16px' }}>
                <input 
                  type="text" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{ width: '100%', padding: '6px 0', fontSize: '15px', border: 'none', borderBottom: '1px solid #1b1b1b', outline: 'none' }}
                  placeholder="Email, phone, or Skype"
                />
              </div>
              <p style={{ fontSize: '13px', color: '#1b1b1b', marginBottom: '32px' }}>
                No account? <a href="#" style={{ color: '#0067b8', textDecoration: 'none' }}>Create one!</a>
              </p>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button type="submit" disabled={loading} style={{ background: '#0067b8', color: '#fff', border: 'none', padding: '8px 32px', fontSize: '15px', cursor: loading ? 'not-allowed' : 'pointer' }}>
                  {loading ? 'Processing...' : 'Next'}
                </button>
              </div>
            </form>
          )}

          {step === 2 && (
            <form onSubmit={handleNextStep2}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', cursor: 'pointer' }} onClick={() => setStep(1)}>
                <ArrowLeft size={16} color="#1b1b1b" />
                <span style={{ fontSize: '15px', color: '#1b1b1b' }}>{email}</span>
              </div>
              <h1 style={{ fontSize: '24px', fontWeight: 600, color: '#1b1b1b', marginBottom: '16px' }}>Enter password</h1>
              <div style={{ marginBottom: '16px' }}>
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{ width: '100%', padding: '6px 0', fontSize: '15px', border: 'none', borderBottom: '1px solid #1b1b1b', outline: 'none' }}
                  placeholder="Password"
                  autoFocus
                />
              </div>
              <p style={{ fontSize: '13px', color: '#0067b8', marginBottom: '32px', cursor: 'pointer' }}>Forgot my password</p>
              
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button type="submit" disabled={loading} style={{ background: '#0067b8', color: '#fff', border: 'none', padding: '8px 32px', fontSize: '15px', cursor: loading ? 'not-allowed' : 'pointer' }}>
                  {loading ? 'Processing...' : 'Sign in'}
                </button>
              </div>
            </form>
          )}

          {step === 3 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <span style={{ fontSize: '15px', color: '#1b1b1b' }}>{email}</span>
              </div>
              <h1 style={{ fontSize: '24px', fontWeight: 600, color: '#1b1b1b', marginBottom: '8px' }}>Permissions requested</h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
                <div style={{ width: '48px', height: '48px', background: '#0078d4', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', fontWeight: 'bold' }}>I</div>
                <div>
                  <h2 style={{ fontSize: '16px', fontWeight: 600, margin: 0 }}>IctuMeeting App</h2>
                  <p style={{ fontSize: '13px', color: '#666', margin: 0 }}>App info</p>
                </div>
              </div>
              
              <p style={{ fontSize: '15px', marginBottom: '16px' }}>This application requires access to:</p>
              <ul style={{ paddingLeft: '20px', fontSize: '13px', color: '#1b1b1b', marginBottom: '24px', lineHeight: '1.5' }}>
                <li>Maintain access to data you have given it access to</li>
                <li>View your basic profile</li>
                <li>Read your calendars</li>
              </ul>
              
              <p style={{ fontSize: '12px', color: '#666', marginBottom: '24px' }}>Accepting these permissions means that you allow this app to use your data as specified in their terms of service and privacy statement.</p>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={handleConsent} disabled={loading} style={{ background: '#0067b8', color: '#fff', border: 'none', padding: '8px 24px', fontSize: '15px', cursor: loading ? 'not-allowed' : 'pointer', flex: 1 }}>
                  {loading ? 'Processing...' : 'Accept'}
                </button>
                <button onClick={() => navigate('/login')} style={{ background: '#e1dfdd', color: '#1b1b1b', border: 'none', padding: '8px 24px', fontSize: '15px', cursor: 'pointer', flex: 1 }}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      
      <div style={{ background: 'rgba(255,255,255,0.6)', padding: '10px 20px', display: 'flex', justifyContent: 'flex-end', fontSize: '12px', gap: '16px', color: '#1b1b1b' }}>
        <span>Terms of use</span>
        <span>Privacy & cookies</span>
      </div>
    </div>
  );
}
