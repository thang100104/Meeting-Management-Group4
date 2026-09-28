import { useState, useEffect } from 'react';
import TimetableGrid from './components/TimetableGrid';
import EquipmentManager from './components/EquipmentManager';
import { Calendar, Wrench, Shield, User, ChevronDown, Check } from 'lucide-react';
import './App.css';
import './index.css';

const API_BASE = "http://localhost:8000/api/v1";

const DEMO_ACCOUNTS = [
  {
    label: "Quản trị viên (Admin)",
    email: "admin@ictu.vn",
    password: "Admin@123",
    role: "ADMIN"
  },
  {
    label: "Giảng viên (Organizer)",
    email: "organizer@ictu.vn",
    password: "123456",
    role: "ORGANIZER"
  },
  {
    label: "Sinh viên (Participant)",
    email: "student1@ictu.vn",
    password: "password123",
    role: "PARTICIPANT"
  }
];

function App() {
  const [activeTab, setActiveTab] = useState<'calendar' | 'equipments'>('calendar');
  const [currentAccountIndex, setCurrentAccountIndex] = useState(1); // default Organizer
  const [token, setToken] = useState("");
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [showAccountDropdown, setShowAccountDropdown] = useState(false);

  // Đăng nhập tự động theo tài khoản demo đã chọn
  const handleLogin = async (accIndex: number) => {
    const acc = DEMO_ACCOUNTS[accIndex];
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: acc.email, password: acc.password })
      });
      if (res.ok) {
        const data = await res.json();
        setToken(data.access_token);

        // Lấy thông tin me
        const meRes = await fetch(`${API_BASE}/auth/me`, {
          headers: { Authorization: `Bearer ${data.access_token}` }
        });
        if (meRes.ok) {
          const meData = await meRes.json();
          setCurrentUser(meData);
        }
      }
    } catch (err) {
      console.error("Login failed", err);
    }
  };

  useEffect(() => {
    handleLogin(currentAccountIndex);
  }, [currentAccountIndex]);

  const switchAccount = (idx: number) => {
    setCurrentAccountIndex(idx);
    setShowAccountDropdown(false);
  };

  const userRole = currentUser?.role?.role_name || DEMO_ACCOUNTS[currentAccountIndex].role;

  return (
    <div className="app-container">
      {/* Topbar Header */}
      <header className="topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
          <div className="topbar-brand">
            <Calendar size={24} color="var(--color-accent)" />
            ICTU <span>Meeting</span>
            <span className="phase-tag">Giai đoạn 4: Thiết bị</span>
          </div>

          {/* Navigation Tabs */}
          <nav className="topbar-nav">
            <button 
              className={`nav-tab-btn ${activeTab === 'calendar' ? 'active' : ''}`}
              onClick={() => setActiveTab('calendar')}
            >
              <Calendar size={18} />
              <span>Lịch phòng họp</span>
            </button>
            <button 
              className={`nav-tab-btn ${activeTab === 'equipments' ? 'active' : ''}`}
              onClick={() => setActiveTab('equipments')}
            >
              <Wrench size={18} />
              <span>Quản lý Thiết bị</span>
            </button>
          </nav>
        </div>

        {/* User / Demo Role Switcher */}
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', position: 'relative' }}>
          <div className="demo-switch-wrapper">
            <button 
              className="user-profile-btn"
              onClick={() => setShowAccountDropdown(!showAccountDropdown)}
            >
              <div className={`user-avatar ${userRole.toLowerCase()}`}>
                {userRole === 'ADMIN' ? <Shield size={16} /> : <User size={16} />}
              </div>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                  {currentUser?.full_name || DEMO_ACCOUNTS[currentAccountIndex].label}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--color-gray-300)' }}>
                  Vai trò: <span className={`role-badge ${userRole.toLowerCase()}`}>{userRole}</span>
                </div>
              </div>
              <ChevronDown size={14} />
            </button>

            {/* Account Switcher Dropdown */}
            {showAccountDropdown && (
              <div className="account-dropdown">
                <div className="dropdown-header">Chọn tài khoản demo để thử nghiệm quyền:</div>
                {DEMO_ACCOUNTS.map((acc, idx) => (
                  <div 
                    key={acc.email} 
                    className={`dropdown-item ${currentAccountIndex === idx ? 'selected' : ''}`}
                    onClick={() => switchAccount(idx)}
                  >
                    <div>
                      <div className="dropdown-acc-name">{acc.label}</div>
                      <div className="dropdown-acc-email">{acc.email}</div>
                    </div>
                    {currentAccountIndex === idx && <Check size={16} color="var(--color-accent)" />}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="main-content">
        {activeTab === 'calendar' ? (
          <TimetableGrid 
            token={token} 
            userRole={userRole} 
            currentUserId={currentUser?.user_id} 
          />
        ) : (
          <EquipmentManager 
            token={token} 
            userRole={userRole} 
          />
        )}
      </main>
    </div>
  );
}

export default App;
