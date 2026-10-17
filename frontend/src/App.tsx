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
import TimetableGrid from './components/TimetableGrid';
import DevicesView from './components/DevicesView';
import Analytics from './components/Analytics';
import AuditLogViewer from './components/AuditLogViewer';
import ProfileView from './components/ProfileView';
import ApprovalsView from './components/ApprovalsView';
import RoomsView from './components/RoomsView';
import LecturerDashboard from './components/LecturerDashboard';
import { NotificationProvider } from './context/NotificationContext';
import NotificationManagement from './components/NotificationManagement';
import UserManagement from './components/UserManagement';
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

export default function App() {
  const [currentUser] = React.useState({
    id: 1,
    full_name: 'Quản trị viên',
    email: 'admin@ictu.edu.vn',
    role: 'ADMIN',
    department: { department_name: 'CNTT' }
  });

  useEffect(() => {
    initializeSystemData();
  }, []);

  return (
    <ErrorBoundary>
      <NotificationProvider>
        <Routes>
          <Route path="/" element={<MainLayout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardView />} />
            <Route path="approvals" element={<ApprovalsView />} />
            <Route path="rooms" element={<RoomsView />} />
            <Route path="devices" element={<DevicesView />} />
            <Route path="schedules" element={<TimetableGrid token={sessionStorage.getItem('access_token') || ''} userRole={currentUser.role} currentUserId={currentUser.id} />} />
            <Route path="notifications" element={<NotificationManagement />} />
            <Route path="users" element={<UserManagement />} />
            <Route path="reports" element={<Analytics />} />
            <Route path="bot-qr-settings" element={<div style={{ padding: '24px', fontSize: '18px', color: '#64748b' }}>Trang Cấu hình Chatbot & QR đang phát triển...</div>} />
            <Route path="system" element={<AuditLogViewer />} />
            <Route path="profile" element={<ProfileView />} />
            <Route path="*" element={<DashboardView />} />
          </Route>
          <Route path="/login" element={<Login onLoginSuccess={() => { }} />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/lecturer" element={<LecturerDashboard />} />
          <Route path="/auth/google" element={<GoogleAuth onLoginSuccess={() => { }} />} />
          <Route path="/auth/microsoft" element={<MicrosoftAuth onLoginSuccess={() => { }} />} />
        </Routes>
      </NotificationProvider>
    </ErrorBoundary>
  );
}
