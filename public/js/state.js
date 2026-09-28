/**
 * MeetFlow - Central Application State Management
 */

class AppState {
  constructor() {
    this.currentUser = null;
    this.currentDate = new Date();
    this.currentView = 'month'; // 'month' | 'week' | 'list' | 'rooms'
    this.selectedRoomFilter = null;
    this.searchQuery = '';
    
    this.meetings = [];
    this.rooms = [];
    this.users = [];

    // Form dirty state tracker for AC6
    this.isFormDirty = false;
    this.subscribers = new Set();
  }

  subscribe(callback) {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  notify(event, payload) {
    this.subscribers.forEach((cb) => {
      try {
        cb(event, payload);
      } catch (err) {
        console.error('State subscriber error:', err);
      }
    });
  }

  setUser(user) {
    this.currentUser = user;
    this.notify('user:changed', user);
  }

  setDate(date) {
    this.currentDate = new Date(date);
    this.notify('date:changed', this.currentDate);
  }

  setView(view) {
    this.currentView = view;
    this.notify('view:changed', view);
  }

  setMeetings(meetings) {
    this.meetings = meetings || [];
    this.notify('meetings:updated', this.meetings);
  }

  setRooms(rooms) {
    this.rooms = rooms || [];
    this.notify('rooms:updated', this.rooms);
  }

  setUsers(users) {
    this.users = users || [];
    this.notify('users:updated', this.users);
  }

  setDirty(dirty) {
    this.isFormDirty = dirty;
  }
}

export const state = new AppState();

/**
 * Toast Notification Utility
 */
export function showToast(title, message, type = 'success', durationMs = 4500) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  const iconMap = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ',
  };

  toast.innerHTML = `
    <div class="toast-icon">${iconMap[type] || '•'}</div>
    <div class="toast-content">
      <div class="toast-title">${title}</div>
      <div class="toast-message">${message}</div>
    </div>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = 'all 300ms ease';
    setTimeout(() => toast.remove(), 300);
  }, durationMs);
}
