import React, { Component, useEffect } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/Login';
import Register from './components/Register';
import ForgotPassword from './components/ForgotPassword';
import GoogleAuth from './components/GoogleAuth';
import MicrosoftAuth from './components/MicrosoftAuth';
import MainLayout from './components/MainLayout';
import DashboardView from './components/DashboardView';
import DevicesView from './components/DevicesView';
import Analytics from './components/Analytics';
import AuditLogViewer from './components/AuditLogViewer';
import ProfileView from './components/ProfileView';
import ApprovalsView from './components/ApprovalsView';
import RoomsView from './components/RoomsView';
import LecturerDashboard from './components/LecturerDashboard';
import StudentDashboard from './components/StudentDashboard';
import { NotificationProvider } from './context/NotificationContext';
import NotificationManagement from './components/NotificationManagement';
import UserManagement from './components/UserManagement';
import MeetingGoogleCalendar from './components/MeetingGoogleCalendar';
import HRMIntegrationView from './components/HRMIntegrationView';
import { useAuth } from './context/AuthContext';
import './App.css';
import './index.css';
import './custom-ui.css';
import { initializeSystemData } from './utils/resetData';

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: any }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }
  componentDidCatch(error: any, errorInfo: ErrorInfo) {
    console.error("React Error Boundary caught an error:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 20, color: 'red', background: '#fff' }}>
          <h2>⚠️ Đã xảy ra lỗi Render trong Component:</h2>
          <pre>{this.state.error?.toString()}</pre>
          <pre>{this.state.error?.stack}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

function RootRedirect() {
  const { user } = useAuth();
  const token = sessionStorage.getItem('access_token') || localStorage.getItem('access_token') || sessionStorage.getItem('token');
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  const rawRole = typeof user?.role === 'object' ? (user.role as any)?.role_name : user?.role;
  const role = (rawRole || '').toLowerCase();
  if (role === 'admin' || role.includes('quản trị') || role.includes('cán bộ')) {
    return <Navigate to="/dashboard" replace />;
  }
  return <Navigate to="/user" replace />;
}

export default function App() {
  const { user } = useAuth();
  const currentUser = user || {
    id: 1,
    full_name: 'Quản trị viên',
    email: 'admin@ictu.edu.vn',
    role: 'ADMIN',
    department: { department_name: 'CNTT' }
  };

  useEffect(() => {
    initializeSystemData();

    // ── LẮNG NGHE & TỰ ĐỘNG NGẮT PHIÊN KHI TÀI KHOẢN BỊ TẠM KHÓA ──
    const kickOutLockedUser = () => {
      if (!sessionStorage.getItem('lock_alert_shown')) {
        sessionStorage.setItem('lock_alert_shown', 'true');
        alert("⛔ TÀI KHOẢN ĐÃ BỊ TẠM KHÓA!\n\nTài khoản của bạn đã bị Quản trị viên tạm khóa hoạt động.\nPhiên làm việc hiện tại kết thúc và bạn sẽ được chuyển về màn hình đăng nhập!");
      }
      sessionStorage.clear();
      localStorage.removeItem('access_token');
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('currentUser');
      localStorage.removeItem('meetinghub_user');
      window.location.href = '/login';
    };

    const checkAccountLock = () => {
      const rawUser = sessionStorage.getItem('user') || localStorage.getItem('user') || sessionStorage.getItem('currentUser');
      if (!rawUser) return;

      let currentLoggedIn: any = null;
      try {
        currentLoggedIn = JSON.parse(rawUser);
      } catch (e) {
        return;
      }
      if (!currentLoggedIn || !currentLoggedIn.email) return;

      const userEmail = currentLoggedIn.email.toLowerCase().trim();
      const userId = String(currentLoggedIn.id || currentLoggedIn.user_id || '');

      // Kiểm tra sự kiện khóa được phát đi
      const rawLockEvent = localStorage.getItem('meetinghub_account_locked_event');
      if (rawLockEvent) {
        try {
          const lockData = JSON.parse(rawLockEvent);
          if (
            (lockData.email && lockData.email.toLowerCase().trim() === userEmail) ||
            (lockData.userId && String(lockData.userId) === userId)
          ) {
            kickOutLockedUser();
          }
        } catch (e) {}
      }
    };

    // Kiểm tra ngay khi tải trang và khi có sự kiện
    checkAccountLock();
    window.addEventListener('storage', checkAccountLock);
    window.addEventListener('meetinghub_account_locked', checkAccountLock);

    // Định kỳ 5 giây kiểm tra lại trạng thái thực tế từ backend khi đã đăng nhập
    const intervalId = setInterval(async () => {
      checkAccountLock();

      if (window.location.pathname.includes('/login') || window.location.pathname.includes('/register') || window.location.pathname.includes('/forgot-password')) {
        return;
      }

      const token = sessionStorage.getItem('access_token') || localStorage.getItem('access_token') || sessionStorage.getItem('token');
      if (token) {
        try {
          const { default: api } = await import('./services/api');
          const res = await api.get('/auth/me');
          if (res.data && res.data.status !== 'ACTIVE') {
            kickOutLockedUser();
          }
        } catch (err: any) {
          if (err.response && err.response.status === 403) {
            const detail = err.response.data?.detail || '';
            if (typeof detail === 'string' && (detail.includes('tạm khóa') || detail.includes('vô hiệu hóa'))) {
              kickOutLockedUser();
            }
          }
        }
      }
    }, 5000);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener('storage', checkAccountLock);
      window.removeEventListener('meetinghub_account_locked', checkAccountLock);
    };
  }, []);

  return (
    <ErrorBoundary>
      <NotificationProvider>
        <Routes>
          <Route path="/" element={<MainLayout />}>
            <Route index element={<RootRedirect />} />
            <Route path="dashboard" element={<DashboardView />} />
            <Route path="calendar" element={<MeetingGoogleCalendar userProfile={currentUser} userRole="admin" />} />
            <Route path="approvals" element={<Navigate to="/calendar" replace />} />
            <Route path="rooms" element={<RoomsView />} />
            <Route path="devices" element={<DevicesView />} />
            <Route path="schedules" element={<Navigate to="/calendar" replace />} />
            <Route path="notifications" element={<NotificationManagement />} />
            <Route path="users" element={<UserManagement />} />
            <Route path="reports" element={<Analytics />} />
            <Route path="bot-qr-settings" element={<HRMIntegrationView />} />
            <Route path="system" element={<AuditLogViewer />} />
            <Route path="profile" element={<ProfileView />} />
            <Route path="*" element={<DashboardView />} />
          </Route>
          <Route path="/login" element={<Login onLoginSuccess={() => { }} />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/user" element={<LecturerDashboard />} />
          <Route path="/lecturer" element={<LecturerDashboard />} />
          <Route path="/student" element={<LecturerDashboard />} />
          <Route path="/auth/google" element={<GoogleAuth onLoginSuccess={() => { }} />} />
          <Route path="/auth/microsoft" element={<MicrosoftAuth onLoginSuccess={() => { }} />} />
        </Routes>
      </NotificationProvider>
    </ErrorBoundary>
  );
}
