import React, { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';

export type NotificationType = 'booking_request' | 'device_alert' | 'system';

export interface Notification {
  id: string;
  title: string;
  description: string;
  time: string;
  type: NotificationType;
  isRead: boolean;
  link: string;
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([
    {
      id: 'notif-1',
      title: 'Yêu cầu đặt phòng mới',
      description: 'Giảng viên Nguyễn Văn A gửi yêu cầu đặt Phòng A1 (Dạy bù Lập trình Web)',
      time: '5 phút trước',
      type: 'booking_request',
      isRead: false,
      link: '/approvals'
    },
    {
      id: 'notif-2',
      title: 'Yêu cầu đặt phòng mới',
      description: 'CLB Âm nhạc (Trần Thị B) gửi yêu cầu đặt Phòng C2',
      time: '20 phút trước',
      type: 'booking_request',
      isRead: false,
      link: '/approvals'
    },
    {
      id: 'notif-3',
      title: 'Cảnh báo thiết bị lỗi',
      description: 'Micro phòng họp B3 mất kết nối tín hiệu kết nối',
      time: '1 giờ trước',
      type: 'device_alert',
      isRead: false,
      link: '/devices'
    },
    {
      id: 'notif-4',
      title: 'Yêu cầu đặt phòng mới',
      description: 'Sinh viên Lê Hoàng C gửi yêu cầu đặt Phòng D1 (Họp nhóm đồ án)',
      time: '2 giờ trước',
      type: 'booking_request',
      isRead: false,
      link: '/approvals'
    },
    {
      id: 'notif-5',
      title: 'Bảo trì hệ thống',
      description: 'Hệ thống sẽ bảo trì định kỳ vào 23:00 tối nay',
      time: '1 ngày trước',
      type: 'system',
      isRead: true,
      link: '/system'
    }
  ]);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const markAsRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
  };

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, markAsRead, markAllAsRead }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    return {
      notifications: [],
      unreadCount: 0,
      markAsRead: () => {},
      markAllAsRead: () => {}
    };
  }
  return context;
}
