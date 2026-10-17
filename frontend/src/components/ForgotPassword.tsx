import React, { useState } from 'react';
import { Mail, Video, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';

const API_BASE = "http://localhost:8000/api/v1";

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast.error('Vui lòng nhập email');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      });
      
      const data = await res.json();
      
      if (res.ok) {
        toast.success("Đã gửi liên kết khôi phục mật khẩu. Vui lòng kiểm tra email của bạn.", { duration: 5000 });
        setEmail('');
      } else {
        toast.error(data.detail || "Không thể gửi yêu cầu");
      }
    } catch (err) {
      toast.error("Lỗi kết nối đến máy chủ");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container relative overflow-hidden" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'linear-gradient(135deg, #e0e7ff 0%, #f3e8ff 100%)', position: 'relative' }}>
      {/* Decorative background shapes */}
      <div style={{ position: 'absolute', top: '-10%', left: '-10%', width: '40vw', height: '40vw', borderRadius: '50%', background: 'linear-gradient(to bottom right, rgba(99, 102, 241, 0.4), rgba(168, 85, 247, 0.4))', filter: 'blur(80px)', zIndex: 0 }}></div>
      <div style={{ position: 'absolute', bottom: '-10%', right: '-5%', width: '30vw', height: '30vw', borderRadius: '50%', background: 'linear-gradient(to top left, rgba(59, 130, 246, 0.4), rgba(147, 51, 234, 0.4))', filter: 'blur(60px)', zIndex: 0 }}></div>

      <div className="backdrop-blur-md bg-white/80 border border-slate-200/60 shadow-xl" style={{ maxWidth: '440px', width: '100%', padding: '2.5rem', borderRadius: '16px', background: 'rgba(255, 255, 255, 0.85)', backdropFilter: 'blur(12px)', border: '1px solid rgba(226, 232, 240, 0.6)', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)', position: 'relative', zIndex: 10 }}>
        <div className="login-form-header" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginBottom: '2rem' }}>
          <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 shadow-md mb-4 mx-auto" style={{ width: '4rem', height: '4rem', borderRadius: '0.75rem', background: 'linear-gradient(to bottom right, #2563eb, #4338ca)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', margin: '0 auto 1rem auto' }}>
            <Video size={36} color="white" />
          </div>
          <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-900 via-blue-700 to-indigo-600 bg-clip-text text-transparent" style={{ fontSize: '1.875rem', fontWeight: 'bold', background: 'linear-gradient(to right, #1e3a8a, #1d4ed8, #4f46e5)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', margin: '0 0 8px 0' }}>IctuMeeting</h2>
          <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#1e293b', margin: '0.5rem 0' }}>Khôi phục mật khẩu</h3>
          <p style={{ color: '#64748b', margin: 0 }}>Nhập email của bạn để nhận liên kết khôi phục</p>
        </div>
        
        <form onSubmit={handleForgot} className="login-form" style={{ gap: '1.25rem' }}>
          <div className="form-group">
            <label style={{ fontWeight: 500, color: '#334155', display: 'block', marginBottom: '0.5rem' }}>Email khôi phục</label>
            <div className="input-with-icon" style={{ position: 'relative' }}>
              <Mail size={18} className="input-icon" style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input 
                type="email" 
                placeholder="Ví dụ: name@ictu.edu.vn" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={{ width: '100%', padding: '0.75rem 1rem 0.75rem 2.75rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', outline: 'none', transition: 'border-color 0.2s', backgroundColor: 'rgba(255, 255, 255, 0.9)' }}
                onFocus={(e) => e.target.style.borderColor = '#4f46e5'}
                onBlur={(e) => e.target.style.borderColor = '#cbd5e1'}
              />
            </div>
          </div>
          
          <button type="submit" className="btn-login" disabled={loading} style={{ width: '100%', padding: '0.75rem', marginTop: '1rem', background: 'linear-gradient(to right, #4f46e5, #4338ca)', color: 'white', border: 'none', borderRadius: '0.5rem', fontWeight: 600, cursor: 'pointer', transition: 'opacity 0.2s, transform 0.1s', opacity: loading ? 0.7 : 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}
            onMouseOver={(e) => !loading && (e.currentTarget.style.opacity = '0.9')}
            onMouseOut={(e) => !loading && (e.currentTarget.style.opacity = '1')}
            onMouseDown={(e) => !loading && (e.currentTarget.style.transform = 'scale(0.98)')}
            onMouseUp={(e) => !loading && (e.currentTarget.style.transform = 'scale(1)')}
          >
            {loading ? <span className="loading-spinner-sm" style={{ width: '1rem', height: '1rem', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 1s linear infinite', display: 'inline-block' }}></span> : 'Gửi liên kết khôi phục'}
          </button>
        </form>
        
        <div style={{ textAlign: 'center', marginTop: '2rem' }}>
          <Link to="/login" className="back-to-login" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: '#4f46e5', textDecoration: 'none', fontWeight: 600, transition: 'all 0.2s', padding: '0.5rem 1rem', borderRadius: '0.5rem' }}
            onMouseOver={(e) => { e.currentTarget.style.backgroundColor = '#e0e7ff'; e.currentTarget.style.color = '#3730a3'; }}
            onMouseOut={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#4f46e5'; }}
          >
            <ArrowLeft size={18} style={{ transition: 'transform 0.2s' }} /> 
            <span>Quay lại Đăng nhập</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
