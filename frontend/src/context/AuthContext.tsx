import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import api from '../services/api';

interface User {
  id?: number | string;
  email?: string;
  fullName?: string;
  shortName?: string;
  role?: string;
  avatar?: string;
  avatarUrl?: string;
  [key: string]: any;
}

interface AuthContextType {
  user: User | null;
  updateUser: (userData: User) => void;
  refreshProfile: () => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(() => {
    const savedUser = sessionStorage.getItem('user');
    return savedUser ? JSON.parse(savedUser) : null;
  });

  const refreshProfile = async () => {
    try {
      const res = await api.get('/auth/me');
      if (res.data) {
        const apiUser = res.data;

        const freshUser = {
          id: apiUser.user_id,
          email: apiUser.email,
          fullName: apiUser.full_name,
          role: apiUser.role?.role_name || apiUser.role,
          avatar: apiUser.avatar_url || ''
        };
        setUser(freshUser);
        sessionStorage.setItem('user', JSON.stringify(freshUser));
        localStorage.setItem('user', JSON.stringify(freshUser));
      }
    } catch (error) {
      console.error("AuthContext fetch error:", error);
    }
  };

  const updateUser = (userData: User) => {
    setUser(userData);
    sessionStorage.setItem('user', JSON.stringify(userData));
    localStorage.setItem('user', JSON.stringify(userData)); // Cập nhật localStorage
    localStorage.setItem('currentUser', JSON.stringify(userData)); // Thêm dự phòng
    sessionStorage.setItem('currentUser', JSON.stringify(userData));
    
    // Backup for mock accounts
    if (userData.email) {
      localStorage.setItem(`mock_profile_${userData.email}`, JSON.stringify(userData));
    }

    // Phát event để các Layout tự động cập nhật
    window.dispatchEvent(new Event('userProfileUpdated'));
    window.dispatchEvent(new Event('user-data-updated'));
  };

  const logout = () => {
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('access_token');
    sessionStorage.removeItem('user');
    sessionStorage.removeItem('currentUser');
    sessionStorage.removeItem('meetinghub_user');
    
    localStorage.removeItem('token');
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
    localStorage.removeItem('currentUser');
    localStorage.removeItem('meetinghub_user');
    
    setUser(null);
    window.location.href = '/login';
  };

  useEffect(() => {
    if (sessionStorage.getItem('access_token')) {
      refreshProfile();
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, updateUser, refreshProfile, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

