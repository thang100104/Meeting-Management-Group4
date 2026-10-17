/**
 * MeetFlow - Frontend Application Core Controller
 * Orchestrates UI views, calendar rendering, and Acceptance Criteria AC1 -> AC6.
 */

import { api } from './api.js';
import { state, showToast } from './state.js';

// --- State Variables for Creation Modal ---
let selectedParticipants = [];
let attachedFiles = [];
let pendingSubmissionPayload = null; // Stored payload when conflict occurs for AC4 override

// ==========================================================================
// 1. Initialization & Bootstrap
// ==========================================================================

document.addEventListener('DOMContentLoaded', async () => {
  initTheme();
  setupEventListeners();
  setupViewTabs();
  setupCreateMeetingForm();

  // Try authenticating with stored token or auto-login with default Demo Organizer
  await checkAuthStatus();

  // Load master data and initial meetings
  await loadRooms();
  await loadMeetingsForCurrentView();
});

// ==========================================================================
// 2. Theme Management (Light / Dark Mode)
// ==========================================================================

function initTheme() {
  const savedTheme = localStorage.getItem('meetflow_theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
  updateThemeIcon(savedTheme);

  const toggleBtn = document.getElementById('btn-toggle-theme');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme') || 'light';
      const next = current === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('meetflow_theme', next);
      updateThemeIcon(next);
    });
  }
}

function updateThemeIcon(theme) {
  const icon = document.getElementById('theme-icon');
  if (icon) {
    icon.textContent = theme === 'dark' ? '☀️' : '🌙';
  }
}

// ==========================================================================
// 3. Authentication & Account Quick-Switching
// ==========================================================================

async function checkAuthStatus() {
  const token = api.getToken();
  if (token) {
    try {
      const user = await api.getMe();
      state.setUser(user);
      renderAuthSection(user);
      return;
    } catch (err) {
      console.warn('Invalid token, clearing session');
      api.setToken(null);
    }
  }

  // Auto-login with default demo organizer for effortless exploration
  try {
    const data = await api.login('organizer1@company.com', 'Password@123');
    state.setUser(data.user);
    renderAuthSection(data.user);
    showToast('Chào mừng!', `Đã tự động kết nối tài khoản ${data.user.full_name}`, 'success');
  } catch (err) {
    renderAuthSection(null);
  }
}

function renderAuthSection(user) {
  const container = document.getElementById('auth-section');
  if (!container) return;

  if (user) {
    const roleClass = `role-${user.role.toLowerCase()}`;
    const initials = user.full_name
      .split(' ')
      .map((n) => n[0])
      .slice(-2)
      .join('')
      .toUpperCase();

    container.innerHTML = `
      <div class="user-profile-badge" id="btn-user-profile" title="Bấm để đăng xuất / đổi tài khoản">
        <div class="user-avatar">${initials}</div>
        <div>
          <div class="user-meta-name">${escapeHtml(user.full_name)}</div>
          <span class="user-role-tag ${roleClass}">${user.role}</span>
        </div>
      </div>
    `;

    document.getElementById('btn-user-profile')?.addEventListener('click', () => {
      openLoginModal();
    });
  } else {
    container.innerHTML = `
      <button class="btn-secondary" id="btn-open-login" style="padding: 7px 14px; font-size: 13px;">
        Đăng nhập
      </button>
    `;
    document.getElementById('btn-open-login')?.addEventListener('click', openLoginModal);
  }

  // Highlight current switch-pill
  document.querySelectorAll('.switch-pill').forEach((pill) => {
    pill.classList.toggle('current', pill.dataset.email === user?.email);
  });
}

function openLoginModal() {
  document.getElementById('modal-login')?.classList.add('open');
}

function closeLoginModal() {
  document.getElementById('modal-login')?.classList.remove('open');
}

// Quick Switch Pills in Sidebar & Login modal
function setupQuickSwitchers() {
  document.querySelectorAll('.switch-pill').forEach((pill) => {
    pill.addEventListener('click', async () => {
      const email = pill.dataset.email;
      if (!email) return;

      try {
        const data = await api.login(email, 'Password@123');
        state.setUser(data.user);
        renderAuthSection(data.user);
        closeLoginModal();
        showToast('Đổi tài khoản thành công', `Hiện đang đăng nhập: ${data.user.full_name} (${data.user.role})`, 'success');
        await loadMeetingsForCurrentView();
      } catch (err) {
        showToast('Đổi tài khoản thất bại', err.message, 'error');
      }
    });
  });
}

// ==========================================================================
// 4. View Tabs & Navigation
// ==========================================================================

function setupViewTabs() {
  const tabs = document.querySelectorAll('.view-btn');
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const view = tab.dataset.view;
      tabs.forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');

      state.setView(view);

      document.querySelectorAll('.view-panel').forEach((panel) => {
        panel.style.display = 'none';
      });

      const target = document.getElementById(`view-${view}`);
      if (target) target.style.display = 'block';

      loadMeetingsForCurrentView();
    });
  });
}

function setupEventListeners() {
  setupQuickSwitchers();

  // Calendar prev/next/today navigation
  document.getElementById('btn-cal-prev')?.addEventListener('click', () => changeDateStep(-1));
  document.getElementById('btn-cal-next')?.addEventListener('click', () => changeDateStep(1));
  document.getElementById('btn-cal-today')?.addEventListener('click', () => {
    state.setDate(new Date());
    loadMeetingsForCurrentView();
  });

  // Mini calendar nav
  document.getElementById('mini-cal-prev')?.addEventListener('click', () => {
    const d = new Date(state.currentDate);
    d.setMonth(d.getMonth() - 1);
    state.setDate(d);
    loadMeetingsForCurrentView();
  });

  document.getElementById('mini-cal-next')?.addEventListener('click', () => {
    const d = new Date(state.currentDate);
    d.setMonth(d.getMonth() + 1);
    state.setDate(d);
    loadMeetingsForCurrentView();
  });

  // Filters
  document.getElementById('filter-all')?.addEventListener('click', (e) => {
    document.querySelectorAll('.filter-item').forEach((el) => el.classList.remove('active'));
    e.currentTarget.classList.add('active');
    renderCurrentView();
  });

  document.getElementById('filter-mine')?.addEventListener('click', (e) => {
    document.querySelectorAll('.filter-item').forEach((el) => el.classList.remove('active'));
    e.currentTarget.classList.add('active');
    renderCurrentView();
  });

  // Search input
  document.getElementById('input-global-search')?.addEventListener('input', (e) => {
    state.searchQuery = e.target.value.trim().toLowerCase();
    renderCurrentView();
  });

  // Login Modal close & submit
  document.getElementById('btn-close-login')?.addEventListener('click', closeLoginModal);
  document.getElementById('form-login')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const errorEl = document.getElementById('login-error-msg');
    errorEl.style.display = 'none';

    try {
      const data = await api.login(email, password);
      state.setUser(data.user);
      renderAuthSection(data.user);
      closeLoginModal();
      showToast('Đăng nhập thành công', `Xin chào ${data.user.full_name}!`, 'success');
      await loadMeetingsForCurrentView();
    } catch (err) {
      errorEl.textContent = err.message || 'Email hoặc mật khẩu không chính xác';
      errorEl.style.display = 'block';
    }
  });

  // Login preset helpers
  document.getElementById('pill-fill-admin')?.addEventListener('click', () => {
    document.getElementById('login-email').value = 'admin@company.com';
    document.getElementById('login-password').value = 'Password@123';
  });
  document.getElementById('pill-fill-organizer')?.addEventListener('click', () => {
    document.getElementById('login-email').value = 'organizer1@company.com';
    document.getElementById('login-password').value = 'Password@123';
  });
  document.getElementById('pill-fill-staff')?.addEventListener('click', () => {
    document.getElementById('login-email').value = 'staff1@company.com';
    document.getElementById('login-password').value = 'Password@123';
  });

  // Details Modal close
  document.getElementById('btn-close-details')?.addEventListener('click', closeDetailsModal);
  document.getElementById('btn-dismiss-details')?.addEventListener('click', closeDetailsModal);
}

function changeDateStep(step) {
  const d = new Date(state.currentDate);
  if (state.currentView === 'month') {
    d.setMonth(d.getMonth() + step);
  } else if (state.currentView === 'week') {
    d.setDate(d.getDate() + step * 7);
  } else {
    d.setDate(d.getDate() + step * 7);
  }
  state.setDate(d);
  loadMeetingsForCurrentView();
}

// ==========================================================================
// 5. Data Fetching (Meetings & Rooms)
// ==========================================================================

async function loadRooms() {
  try {
    const now = new Date();
    const future = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const rooms = await api.getRooms(now, future);
    state.setRooms(rooms);
    renderSidebarRooms(rooms);
    populateRoomSelect(rooms);
  } catch (err) {
    console.error('Failed to load rooms:', err);
  }
}

function renderSidebarRooms(rooms) {
  const container = document.getElementById('sidebar-rooms-list');
  if (!container) return;

  if (rooms.length === 0) {
    container.innerHTML = '<div style="font-size: 12px; color: var(--text-subtle);">Không có phòng họp</div>';
    return;
  }

  container.innerHTML = rooms
    .map(
      (r) => `
    <div class="room-card" title="${escapeHtml(r.location || '')}">
      <div>
        <div class="room-name">${escapeHtml(r.room_name)}</div>
        <div class="room-details">${r.capacity} chỗ &bull; ${escapeHtml(r.location || 'Khu A')}</div>
      </div>
      <span class="status-dot ${r.status.toLowerCase()}"></span>
    </div>
  `
    )
    .join('');
}

function populateRoomSelect(rooms) {
  const select = document.getElementById('select-room-id');
  if (!select) return;

  select.innerHTML = '<option value="">-- Không chọn phòng (Họp online) --</option>';
  rooms.forEach((r) => {
    const opt = document.createElement('option');
    opt.value = r.room_id;
    opt.textContent = `${r.room_name} (${r.capacity} chỗ - ${r.location || ''})`;
    select.appendChild(opt);
  });
}

async function loadMeetingsForCurrentView() {
  const { from, to, label } = getDateRangeForView(state.currentDate, state.currentView);
  const labelEl = document.getElementById('cal-current-label');
  if (labelEl) labelEl.textContent = label;

  const miniTitle = document.getElementById('mini-cal-month-title');
  if (miniTitle) {
    miniTitle.textContent = `Tháng ${state.currentDate.getMonth() + 1}, ${state.currentDate.getFullYear()}`;
  }

  try {
    const meetings = await api.getMeetings(from, to);
    state.setMeetings(meetings);
    renderCurrentView();
    renderMiniCalendar(meetings);
  } catch (err) {
    console.error('Failed to load meetings:', err);
    state.setMeetings([]);
    renderCurrentView();
  }
}

function getDateRangeForView(centerDate, view) {
  const year = centerDate.getFullYear();
  const month = centerDate.getMonth();

  if (view === 'month') {
    const firstDay = new Date(year, month, 1, 0, 0, 0);
    const lastDay = new Date(year, month + 1, 0, 23, 59, 59);
    // Expand to complete full calendar week padding (Mon - Sun)
    const dayOfWeek = firstDay.getDay() === 0 ? 7 : firstDay.getDay();
    const from = new Date(firstDay);
    from.setDate(from.getDate() - (dayOfWeek - 1));

    const endDayOfWeek = lastDay.getDay() === 0 ? 7 : lastDay.getDay();
    const to = new Date(lastDay);
    to.setDate(to.getDate() + (7 - endDayOfWeek));

    return {
      from,
      to,
      label: `Tháng ${month + 1} năm ${year}`,
    };
  }

  if (view === 'week') {
    const curr = new Date(centerDate);
    const day = curr.getDay() === 0 ? 7 : curr.getDay();
    const from = new Date(curr.setDate(curr.getDate() - day + 1));
    from.setHours(0, 0, 0, 0);
    const to = new Date(from);
    to.setDate(to.getDate() + 6);
    to.setHours(23, 59, 59, 999);

    const fromStr = `${from.getDate()}/${from.getMonth() + 1}`;
    const toStr = `${to.getDate()}/${to.getMonth() + 1}/${to.getFullYear()}`;
    return {
      from,
      to,
      label: `Tuần: ${fromStr} – ${toStr}`,
    };
  }

  // List & Rooms views (default to 30 days)
  const from = new Date(year, month, 1, 0, 0, 0);
  const to = new Date(year, month + 1, 0, 23, 59, 59);
  return {
    from,
    to,
    label: `Tháng ${month + 1} năm ${year}`,
  };
}

// ==========================================================================
// 6. View Rendering (Month, Week, Agenda, Mini Calendar)
// ==========================================================================

function getFilteredMeetings() {
  let list = [...state.meetings];
  const isMineOnly = document.getElementById('filter-mine')?.classList.contains('active');

  if (isMineOnly && state.currentUser) {
    const uid = state.currentUser.user_id;
    list = list.filter(
      (m) => m.organizer.user_id === uid || m.participants.some((p) => p.user_id === uid)
    );
  }

  if (state.searchQuery) {
    const q = state.searchQuery;
    list = list.filter((m) => {
      const matchTitle = m.title.toLowerCase().includes(q);
      const matchRoom = m.room?.room_name.toLowerCase().includes(q);
      const matchOrg = m.organizer.full_name.toLowerCase().includes(q);
      const matchAttendee = m.participants.some((p) => p.full_name.toLowerCase().includes(q));
      return matchTitle || matchRoom || matchOrg || matchAttendee;
    });
  }

  // Update counts
  const countAll = document.getElementById('count-all-meetings');
  if (countAll) countAll.textContent = state.meetings.length;

  const countMine = document.getElementById('count-mine-meetings');
  if (countMine && state.currentUser) {
    const uid = state.currentUser.user_id;
    countMine.textContent = state.meetings.filter(
      (m) => m.organizer.user_id === uid || m.participants.some((p) => p.user_id === uid)
    ).length;
  }

  return list;
}

function renderCurrentView() {
  const filtered = getFilteredMeetings();

  if (state.currentView === 'month') {
    renderMonthView(filtered);
  } else if (state.currentView === 'week') {
    renderWeekView(filtered);
  } else if (state.currentView === 'list') {
    renderAgendaView(filtered);
  } else if (state.currentView === 'rooms') {
    renderRoomsView(filtered);
  }
}

function renderMonthView(meetings) {
  const grid = document.getElementById('month-grid');
  if (!grid) return;

  grid.innerHTML = '';

  // Day of week headers
  const dayNames = ['T2 (Hai)', 'T3 (Ba)', 'T4 (Tư)', 'T5 (Năm)', 'T6 (Sáu)', 'T7 (Bảy)', 'CN'];
  dayNames.forEach((name) => {
    const h = document.createElement('div');
    h.className = 'month-header-cell';
    h.textContent = name;
    grid.appendChild(h);
  });

  const { from, to } = getDateRangeForView(state.currentDate, 'month');
  const currentMonth = state.currentDate.getMonth();
  const todayStr = new Date().toDateString();

  const iter = new Date(from);
  while (iter <= to) {
    const cellDate = new Date(iter);
    const dateStr = cellDate.toDateString();
    const isOtherMonth = cellDate.getMonth() !== currentMonth;
    const isToday = dateStr === todayStr;

    const cell = document.createElement('div');
    cell.className = `month-day-cell ${isOtherMonth ? 'other-month' : ''} ${isToday ? 'is-today' : ''}`;

    // Header of cell
    const topRow = document.createElement('div');
    topRow.className = 'day-cell-top';
    topRow.innerHTML = `
      <span class="day-number">${cellDate.getDate()}</span>
      <button class="btn-add-slot" title="Tạo cuộc họp vào ngày này">+</button>
    `;

    topRow.querySelector('.btn-add-slot')?.addEventListener('click', (e) => {
      e.stopPropagation();
      openCreateMeetingModalWithDate(cellDate);
    });

    cell.appendChild(topRow);

    // Filter meetings on this day
    const dayStart = new Date(cellDate).setHours(0, 0, 0, 0);
    const dayEnd = new Date(cellDate).setHours(23, 59, 59, 999);

    const dayMeetings = meetings.filter((m) => {
      const mStart = new Date(m.start_time).getTime();
      const mEnd = new Date(m.end_time).getTime();
      return mStart < dayEnd && mEnd > dayStart;
    });

    dayMeetings.forEach((m) => {
      const chip = document.createElement('div');
      const isCancelled = m.status === 'Cancelled';
      chip.className = `meeting-event-chip ${isCancelled ? 'status-cancelled' : ''}`;

      const startTimeFormatted = formatTimeHM(new Date(m.start_time));
      chip.innerHTML = `
        <span class="meeting-chip-time">${startTimeFormatted}</span>
        <span>${escapeHtml(m.title)}</span>
      `;

      chip.addEventListener('click', (e) => {
        e.stopPropagation();
        openDetailsModal(m);
      });

      cell.appendChild(chip);
    });

    cell.addEventListener('click', () => {
      openCreateMeetingModalWithDate(cellDate);
    });

    grid.appendChild(cell);
    iter.setDate(iter.getDate() + 1);
  }
}

function renderWeekView(meetings) {
  const container = document.getElementById('week-grid-container');
  if (!container) return;

  const { from } = getDateRangeForView(state.currentDate, 'week');
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(from);
    d.setDate(d.getDate() + i);
    days.push(d);
  }

  const dayHeaders = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
  const todayStr = new Date().toDateString();

  container.innerHTML = `
    <div style="display: grid; grid-template-columns: 60px repeat(7, 1fr); border: 1px solid var(--border-subtle); border-radius: var(--radius-lg); background: var(--bg-surface); overflow: hidden;">
      <div style="background: var(--bg-surface-alt); padding: 10px; border-bottom: 1px solid var(--border-subtle);"></div>
      ${days
        .map((d, i) => {
          const isToday = d.toDateString() === todayStr;
          return `
          <div style="background: ${isToday ? 'var(--primary-gradient-subtle)' : 'var(--bg-surface-alt)'}; padding: 10px; text-align: center; border-bottom: 1px solid var(--border-subtle); border-left: 1px solid var(--border-subtle);">
            <div style="font-size: 11px; font-weight: 700; color: var(--text-muted);">${dayHeaders[i]}</div>
            <div style="font-size: 16px; font-weight: 800; ${isToday ? 'color: var(--primary-600);' : ''}">${d.getDate()}/${d.getMonth() + 1}</div>
          </div>
        `;
        })
        .join('')}
      
      <!-- Hourly rows from 08:00 to 18:00 -->
      ${Array.from({ length: 11 })
        .map((_, idx) => {
          const hour = idx + 8;
          const timeLabel = `${hour < 10 ? '0' + hour : hour}:00`;
          return `
          <div style="padding: 12px 6px; font-size: 11px; font-family: 'JetBrains Mono', monospace; color: var(--text-subtle); border-bottom: 1px solid var(--border-subtle); text-align: right;">
            ${timeLabel}
          </div>
          ${days
            .map((d) => {
              const slotTime = new Date(d);
              slotTime.setHours(hour, 0, 0, 0);
              const slotEnd = new Date(d);
              slotEnd.setHours(hour + 1, 0, 0, 0);

              const slotMeetings = meetings.filter((m) => {
                const s = new Date(m.start_time).getTime();
                const e = new Date(m.end_time).getTime();
                return s < slotEnd.getTime() && e > slotTime.getTime();
              });

              return `
              <div class="week-slot-cell" data-timestamp="${slotTime.toISOString()}" style="border-left: 1px solid var(--border-subtle); border-bottom: 1px solid var(--border-subtle); min-height: 48px; padding: 4px; position: relative;">
                ${slotMeetings
                  .map(
                    (m) => `
                  <div class="meeting-event-chip" data-meeting-id="${m.meeting_id}" style="margin-bottom: 3px;" title="${escapeHtml(m.title)} (${formatTimeHM(new Date(m.start_time))} - ${formatTimeHM(new Date(m.end_time))})">
                    <span class="meeting-chip-time">${formatTimeHM(new Date(m.start_time))}</span>
                    <span>${escapeHtml(m.title)}</span>
                  </div>
                `
                  )
                  .join('')}
              </div>
            `;
            })
            .join('')}
        `;
        })
        .join('')}
    </div>
  `;

  // Attach event clicks for week slots & chips
  container.querySelectorAll('.week-slot-cell').forEach((cell) => {
    cell.addEventListener('click', (e) => {
      if (e.target.closest('.meeting-event-chip')) return;
      const ts = cell.dataset.timestamp;
      if (ts) openCreateMeetingModalWithDate(new Date(ts));
    });
  });

  container.querySelectorAll('.meeting-event-chip').forEach((chip) => {
    chip.addEventListener('click', (e) => {
      e.stopPropagation();
      const mid = parseInt(chip.dataset.meetingId, 10);
      const m = state.meetings.find((item) => item.meeting_id === mid);
      if (m) openDetailsModal(m);
    });
  });
}

function renderAgendaView(meetings) {
  const container = document.getElementById('agenda-list-container');
  if (!container) return;

  if (meetings.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 60px 20px; background: var(--bg-surface); border-radius: var(--radius-lg); border: 1px solid var(--border-subtle);">
        <div style="font-size: 40px; margin-bottom: 12px;">📅</div>
        <div style="font-size: 16px; font-weight: 700; margin-bottom: 4px;">Không có cuộc họp nào trong khoảng thời gian này</div>
        <div style="font-size: 13px; color: var(--text-muted);">Bấm vào nút "Tạo lịch họp mới" ở góc trên bên phải để lên lịch.</div>
      </div>
    `;
    return;
  }

  // Group by date
  const groups = {};
  meetings.forEach((m) => {
    const dateKey = new Date(m.start_time).toLocaleDateString('vi-VN', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    if (!groups[dateKey]) groups[dateKey] = [];
    groups[dateKey].push(m);
  });

  container.innerHTML = Object.entries(groups)
    .map(
      ([dateLabel, items]) => `
    <div class="agenda-date-group">
      <div class="agenda-date-heading">${dateLabel}</div>
      ${items
        .map((m) => {
          const s = new Date(m.start_time);
          const e = new Date(m.end_time);
          const durationMin = Math.round((e - s) / 60000);
          const isCancelled = m.status === 'Cancelled';

          return `
          <div class="agenda-meeting-card" data-meeting-id="${m.meeting_id}">
            <div class="agenda-time-col">
              <div>${formatTimeHM(s)} - ${formatTimeHM(e)}</div>
              <div class="agenda-time-duration">${durationMin} phút</div>
            </div>
            <div class="agenda-content-col">
              <div class="agenda-meeting-title" style="${isCancelled ? 'text-decoration: line-through; opacity: 0.6;' : ''}">
                ${escapeHtml(m.title)}
              </div>
              <div class="agenda-meeting-meta">
                ${
                  m.room
                    ? `<div class="meta-item"><span>🏢</span><span>${escapeHtml(m.room.room_name)}</span></div>`
                    : ''
                }
                ${
                  m.meeting_link
                    ? `<div class="meta-item"><a href="${escapeHtml(m.meeting_link)}" target="_blank" onclick="event.stopPropagation();" style="color: var(--primary-600); font-weight: 600;">🔗 Họp Online</a></div>`
                    : ''
                }
                <div class="meta-item"><span>👤</span><span>Tổ chức: ${escapeHtml(m.organizer.full_name)}</span></div>
                <div class="meta-item"><span>👥</span><span>${m.participants.length} người tham gia</span></div>
                ${
                  m.attachments?.length
                    ? `<div class="meta-item"><span>📎</span><span>${m.attachments.length} tệp</span></div>`
                    : ''
                }
              </div>
            </div>
            <div class="agenda-actions-col">
              <span class="user-role-tag ${isCancelled ? 'role-admin' : 'role-organizer'}">${m.status}</span>
            </div>
          </div>
        `;
        })
        .join('')}
    </div>
  `
    )
    .join('');

  container.querySelectorAll('.agenda-meeting-card').forEach((card) => {
    card.addEventListener('click', () => {
      const mid = parseInt(card.dataset.meetingId, 10);
      const m = state.meetings.find((item) => item.meeting_id === mid);
      if (m) openDetailsModal(m);
    });
  });
}

function renderRoomsView(meetings) {
  const container = document.getElementById('rooms-grid-container');
  if (!container) return;

  const rooms = state.rooms;
  if (!rooms.length) {
    container.innerHTML = '<div style="padding: 40px; text-align: center;">Không có dữ liệu phòng họp.</div>';
    return;
  }

  container.innerHTML = `
    <div style="background: var(--bg-surface); border-radius: var(--radius-lg); border: 1px solid var(--border-subtle); padding: 20px;">
      <h3 style="font-size: 16px; font-weight: 800; margin-bottom: 16px;">Sơ đồ công suất &amp; lịch đặt phòng họp hôm nay</h3>
      <div style="display: flex; flex-direction: column; gap: 14px;">
        ${rooms
          .map((r) => {
            const roomMeetings = meetings.filter((m) => m.room?.room_id === r.room_id);
            return `
            <div style="border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 14px; background: var(--bg-surface-alt);">
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
                <div>
                  <strong style="font-size: 15px;">${escapeHtml(r.room_name)}</strong>
                  <span style="font-size: 12px; color: var(--text-muted); margin-left: 8px;">(${r.capacity} chỗ - ${escapeHtml(r.location || '')})</span>
                </div>
                <span class="status-dot ${r.status.toLowerCase()}"></span>
              </div>
              <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                ${
                  roomMeetings.length === 0
                    ? '<div style="font-size: 12px; color: var(--emerald-600); font-weight: 600;">✓ Trống suốt cả ngày</div>'
                    : roomMeetings
                        .map(
                          (m) => `
                    <div class="meeting-event-chip" style="cursor: pointer;" onclick="window.viewMeetingDetails(${m.meeting_id})">
                      ${formatTimeHM(new Date(m.start_time))} - ${formatTimeHM(new Date(m.end_time))}: ${escapeHtml(m.title)}
                    </div>
                  `
                        )
                        .join('')
                }
              </div>
            </div>
          `;
          })
          .join('')}
      </div>
    </div>
  `;
}

function renderMiniCalendar(meetings) {
  const container = document.getElementById('mini-cal-grid');
  if (!container) return;

  container.innerHTML = '';
  const labels = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
  labels.forEach((l) => {
    const cell = document.createElement('div');
    cell.className = 'mini-cal-day-name';
    cell.textContent = l;
    container.appendChild(cell);
  });

  const year = state.currentDate.getFullYear();
  const month = state.currentDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  const startDayOfWeek = firstDay.getDay() === 0 ? 7 : firstDay.getDay();
  const from = new Date(firstDay);
  from.setDate(from.getDate() - (startDayOfWeek - 1));

  const endDayOfWeek = lastDay.getDay() === 0 ? 7 : lastDay.getDay();
  const to = new Date(lastDay);
  to.setDate(to.getDate() + (7 - endDayOfWeek));

  const todayStr = new Date().toDateString();
  const currStr = state.currentDate.toDateString();

  const iter = new Date(from);
  while (iter <= to) {
    const d = new Date(iter);
    const isOtherMonth = d.getMonth() !== month;
    const isCurrent = d.toDateString() === currStr;

    // Check if meetings exist
    const hasMeeting = meetings.some((m) => {
      const ms = new Date(m.start_time).toDateString();
      return ms === d.toDateString();
    });

    const el = document.createElement('div');
    el.className = `mini-cal-day ${isOtherMonth ? 'other-month' : ''} ${isCurrent ? 'active' : ''} ${hasMeeting ? 'has-meeting' : ''}`;
    el.textContent = d.getDate();

    el.addEventListener('click', () => {
      state.setDate(d);
      loadMeetingsForCurrentView();
    });

    container.appendChild(el);
    iter.setDate(iter.getDate() + 1);
  }
}

// ==========================================================================
// 7. Meeting Creation Modal Controller (AC1, AC2, AC3, AC4, AC5, AC6)
// ==========================================================================

function setupCreateMeetingForm() {
  const modal = document.getElementById('modal-create-meeting');
  const openBtn = document.getElementById('btn-open-create-meeting');
  const closeBtn = document.getElementById('btn-close-modal');
  const cancelBtn = document.getElementById('btn-cancel-meeting');
  const submitBtn = document.getElementById('btn-submit-meeting');

  openBtn?.addEventListener('click', () => openCreateMeetingModal());

  // Close & Cancel triggers dirty confirmation (AC6)
  closeBtn?.addEventListener('click', handleAttemptCloseModal);
  cancelBtn?.addEventListener('click', handleAttemptCloseModal);

  modal?.addEventListener('click', (e) => {
    if (e.target === modal) handleAttemptCloseModal();
  });

  // Discard Confirmation dialog (AC6)
  document.getElementById('btn-cancel-discard')?.addEventListener('click', () => {
    document.getElementById('modal-confirm-discard')?.classList.remove('open');
  });

  document.getElementById('btn-confirm-discard')?.addEventListener('click', () => {
    document.getElementById('modal-confirm-discard')?.classList.remove('open');
    forceCloseCreateMeetingModal();
  });

  // Conflict override trigger (AC4)
  document.getElementById('btn-override-conflict')?.addEventListener('click', async () => {
    if (pendingSubmissionPayload) {
      pendingSubmissionPayload.allow_conflicts = true;
      document.getElementById('modal-conflict-warning')?.classList.remove('open');
      await submitMeetingData(pendingSubmissionPayload, attachedFiles, true);
    }
  });

  document.getElementById('btn-dismiss-conflict')?.addEventListener('click', () => {
    document.getElementById('modal-conflict-warning')?.classList.remove('open');
  });

  // Real-time Dirty Tracker & Input Validation (AC2 & AC6)
  const inputsToTrack = [
    'input-meeting-title',
    'input-start-time',
    'input-end-time',
    'select-room-id',
    'input-meeting-link',
    'input-description',
  ];

  inputsToTrack.forEach((id) => {
    const el = document.getElementById(id);
    el?.addEventListener('input', () => {
      state.setDirty(true);
      validateField(id);
    });
    el?.addEventListener('change', () => {
      state.setDirty(true);
      validateField(id);
    });
  });

  // Preset time buttons
  document.querySelectorAll('.preset-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const minutes = parseInt(btn.dataset.minutes, 10);
      const startEl = document.getElementById('input-start-time');
      const endEl = document.getElementById('input-end-time');
      if (startEl && endEl && startEl.value) {
        const s = new Date(startEl.value);
        const e = new Date(s.getTime() + minutes * 60000);
        endEl.value = formatDateTimeLocal(e);
        state.setDirty(true);
        validateField('input-end-time');
      }
    });
  });

  // Participant live search
  setupParticipantPicker();

  // Attachments Drag & Drop
  setupDropzone();

  // Form Submission (AC3, AC4, AC5)
  submitBtn?.addEventListener('click', handleMeetingSubmit);
}

function openCreateMeetingModalWithDate(date) {
  openCreateMeetingModal(date);
}

function openCreateMeetingModal(initialDate = null) {
  const modal = document.getElementById('modal-create-meeting');
  if (!modal) return;

  // Reset form inputs & dirty state
  resetCreateMeetingForm();

  const now = new Date();
  const start = initialDate ? new Date(initialDate) : new Date(now.getTime() + 60 * 60 * 1000);
  start.setMinutes(0, 0, 0);

  const end = new Date(start.getTime() + 60 * 60 * 1000);

  const startInput = document.getElementById('input-start-time');
  const endInput = document.getElementById('input-end-time');

  if (startInput) startInput.value = formatDateTimeLocal(start);
  if (endInput) endInput.value = formatDateTimeLocal(end);

  state.setDirty(false);
  modal.classList.add('open');
  document.getElementById('input-meeting-title')?.focus();
}

function resetCreateMeetingForm() {
  document.getElementById('input-meeting-title').value = '';
  document.getElementById('input-meeting-link').value = '';
  document.getElementById('input-description').value = '';
  document.getElementById('select-room-id').value = '';

  selectedParticipants = [];
  renderParticipantTags();

  attachedFiles = [];
  renderAttachedFilesList();

  // Clear all error states
  document.querySelectorAll('.form-input, .participant-tags-box').forEach((el) => {
    el.classList.remove('has-error');
  });
  document.querySelectorAll('.form-error-msg').forEach((el) => {
    el.classList.remove('visible');
  });

  state.setDirty(false);
  pendingSubmissionPayload = null;
}

// AC6: Discard Changes Logic
function handleAttemptCloseModal() {
  if (state.isFormDirty) {
    document.getElementById('modal-confirm-discard')?.classList.add('open');
  } else {
    forceCloseCreateMeetingModal();
  }
}

function forceCloseCreateMeetingModal() {
  document.getElementById('modal-create-meeting')?.classList.remove('open');
  resetCreateMeetingForm();
}

// AC2 & AC3: Real-time and Submit Validation Logic
function validateField(fieldId) {
  if (fieldId === 'input-meeting-title') {
    const el = document.getElementById('input-meeting-title');
    const err = document.getElementById('error-meeting-title');
    const isValid = el.value.trim().length > 0;
    el.classList.toggle('has-error', !isValid);
    err.classList.toggle('visible', !isValid);
    return isValid;
  }

  if (fieldId === 'input-end-time' || fieldId === 'input-start-time') {
    const startVal = document.getElementById('input-start-time').value;
    const endVal = document.getElementById('input-end-time').value;
    const endEl = document.getElementById('input-end-time');
    const err = document.getElementById('error-end-time');

    if (startVal && endVal) {
      const s = new Date(startVal).getTime();
      const e = new Date(endVal).getTime();
      const isValid = e > s;
      endEl.classList.toggle('has-error', !isValid);
      err.classList.toggle('visible', !isValid);
      return isValid;
    }
  }

  if (fieldId === 'participant-picker') {
    const picker = document.getElementById('participant-picker');
    const err = document.getElementById('error-participants');
    const isValid = selectedParticipants.length > 0;
    picker.classList.toggle('has-error', !isValid);
    err.classList.toggle('visible', !isValid);
    return isValid;
  }

  return true;
}

function validateAllFields() {
  const v1 = validateField('input-meeting-title');
  const v2 = validateField('input-end-time');
  const v3 = validateField('participant-picker');
  return v1 && v2 && v3;
}

// Participant Picker with live search
function setupParticipantPicker() {
  const input = document.getElementById('participant-search-input');
  const dropdown = document.getElementById('participant-dropdown');
  const pickerBox = document.getElementById('participant-picker');

  pickerBox?.addEventListener('click', (e) => {
    if (e.target !== input && !e.target.closest('.participant-tag')) {
      input?.focus();
      searchAndShowUsers('');
    }
  });

  let debounceTimer = null;

  input?.addEventListener('focus', () => searchAndShowUsers(''));
  input?.addEventListener('input', (e) => {
    state.setDirty(true);
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      searchAndShowUsers(e.target.value.trim());
    }, 200);
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.participant-picker-container')) {
      dropdown?.classList.remove('open');
    }
  });
}

async function searchAndShowUsers(query) {
  const dropdown = document.getElementById('participant-dropdown');
  if (!dropdown) return;

  try {
    const users = await api.getUsers(query);
    const currentUserId = state.currentUser?.user_id;

    // Filter out current organizer and already selected users
    const availableUsers = users.filter(
      (u) => u.user_id !== currentUserId && !selectedParticipants.some((sp) => sp.user_id === u.user_id)
    );

    if (availableUsers.length === 0) {
      dropdown.innerHTML = '<div style="padding: 10px; font-size: 12px; color: var(--text-subtle);">Không tìm thấy người dùng</div>';
    } else {
      dropdown.innerHTML = availableUsers
        .map(
          (u) => `
        <div class="participant-option" data-user-id="${u.user_id}" data-name="${escapeHtml(u.full_name)}" data-email="${escapeHtml(u.email)}" data-dept="${escapeHtml(u.department || '')}">
          <div class="participant-option-left">
            <div class="participant-tag-avatar">${u.full_name[0].toUpperCase()}</div>
            <div>
              <div class="participant-option-name">${escapeHtml(u.full_name)}</div>
              <div class="participant-option-dept">${escapeHtml(u.email)} ${u.department ? `&bull; ${escapeHtml(u.department)}` : ''}</div>
            </div>
          </div>
          <span style="color: var(--primary-600); font-weight: 700; font-size: 16px;">+</span>
        </div>
      `
        )
        .join('');

      dropdown.querySelectorAll('.participant-option').forEach((opt) => {
        opt.addEventListener('click', () => {
          const uid = parseInt(opt.dataset.userId, 10);
          selectedParticipants.push({
            user_id: uid,
            full_name: opt.dataset.name,
            email: opt.dataset.email,
          });
          state.setDirty(true);
          renderParticipantTags();
          validateField('participant-picker');
          document.getElementById('participant-search-input').value = '';
          dropdown.classList.remove('open');
        });
      });
    }

    dropdown.classList.add('open');
  } catch (err) {
    console.error('Failed to load users:', err);
  }
}

function renderParticipantTags() {
  const container = document.getElementById('participant-picker');
  const searchInput = document.getElementById('participant-search-input');
  if (!container || !searchInput) return;

  // Clear existing tags
  container.querySelectorAll('.participant-tag').forEach((t) => t.remove());

  selectedParticipants.forEach((p, idx) => {
    const tag = document.createElement('div');
    tag.className = 'participant-tag';
    tag.innerHTML = `
      <div class="participant-tag-avatar">${p.full_name[0].toUpperCase()}</div>
      <span>${escapeHtml(p.full_name)}</span>
      <span class="participant-tag-remove" title="Xóa người tham dự">&times;</span>
    `;

    tag.querySelector('.participant-tag-remove')?.addEventListener('click', (e) => {
      e.stopPropagation();
      selectedParticipants.splice(idx, 1);
      state.setDirty(true);
      renderParticipantTags();
      validateField('participant-picker');
    });

    container.insertBefore(tag, searchInput);
  });
}

// Drag & Drop Attachments Setup
function setupDropzone() {
  const dropzone = document.getElementById('dropzone-attachments');
  const fileInput = document.getElementById('input-attachments-file');

  dropzone?.addEventListener('click', () => fileInput?.click());

  fileInput?.addEventListener('change', (e) => {
    handleFilesSelected(Array.from(e.target.files || []));
    fileInput.value = '';
  });

  dropzone?.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('drag-over');
  });

  dropzone?.addEventListener('dragleave', () => {
    dropzone.classList.remove('drag-over');
  });

  dropzone?.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('drag-over');
    handleFilesSelected(Array.from(e.dataTransfer?.files || []));
  });
}

function handleFilesSelected(files) {
  const allowedExtensions = ['.pdf', '.docx', '.xlsx', '.pptx'];
  const maxBytes = 10 * 1024 * 1024; // 10MB

  for (const file of files) {
    if (attachedFiles.length >= 5) {
      showToast('Đạt giới hạn tệp', 'Tối đa 5 tệp đính kèm cho mỗi cuộc họp', 'warning');
      break;
    }

    const ext = '.' + file.name.split('.').pop().toLowerCase();
    if (!allowedExtensions.includes(ext)) {
      showToast('Định dạng không hợp lệ', `Tệp "${file.name}" không được hỗ trợ. Chỉ nhận PDF, DOCX, XLSX, PPTX.`, 'error');
      continue;
    }

    if (file.size > maxBytes) {
      showToast('Tệp quá dung lượng', `Tệp "${file.name}" vượt quá 10 MB.`, 'error');
      continue;
    }

    attachedFiles.push(file);
    state.setDirty(true);
  }

  renderAttachedFilesList();
}

function renderAttachedFilesList() {
  const list = document.getElementById('attached-files-list');
  if (!list) return;

  list.innerHTML = attachedFiles
    .map(
      (f, idx) => `
    <div class="file-item-pill">
      <div class="file-item-info">
        <span>📄</span>
        <span class="file-item-name">${escapeHtml(f.name)}</span>
        <span class="file-item-size">(${(f.size / (1024 * 1024)).toFixed(2)} MB)</span>
      </div>
      <span class="file-item-remove" data-index="${idx}" title="Xóa tệp">&times;</span>
    </div>
  `
    )
    .join('');

  list.querySelectorAll('.file-item-remove').forEach((btn) => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.index, 10);
      attachedFiles.splice(idx, 1);
      state.setDirty(true);
      renderAttachedFilesList();
    });
  });
}

// AC3, AC4, AC5: Submission Handler
async function handleMeetingSubmit() {
  if (!validateAllFields()) {
    showToast('Dữ liệu chưa hợp lệ', 'Vui lòng kiểm tra lại các trường được tô đỏ.', 'error');
    return;
  }

  const title = document.getElementById('input-meeting-title').value.trim();
  const startTime = new Date(document.getElementById('input-start-time').value).toISOString();
  const endTime = new Date(document.getElementById('input-end-time').value).toISOString();
  const roomIdVal = document.getElementById('select-room-id').value;
  const roomId = roomIdVal ? parseInt(roomIdVal, 10) : null;
  const meetingLink = document.getElementById('input-meeting-link').value.trim() || null;
  const description = document.getElementById('input-description').value.trim() || null;

  const payload = {
    title,
    start_time: startTime,
    end_time: endTime,
    room_id: roomId,
    meeting_link: meetingLink,
    description,
    participants: selectedParticipants.map((p) => ({ user_id: p.user_id })),
    allow_conflicts: false,
  };

  await submitMeetingData(payload, attachedFiles, false);
}

async function submitMeetingData(payload, files, isOverride = false) {
  const submitBtn = document.getElementById('btn-submit-meeting');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span>Đang lưu...</span>';
  }

  try {
    const res = await api.createMeeting(payload, files);

    // AC5: Success notification
    showToast('Thành công', 'Tạo lịch họp thành công!', 'success');

    // Handle warning headers/metadata if any (e.g. email error or conflict override)
    if (res?.meta?.warnings?.length) {
      res.meta.warnings.forEach((w) => {
        if (w.code === 'SCHEDULE_CONFLICT_OVERRIDDEN') {
          showToast('Thông báo trùng lịch', 'Cuộc họp đã được tạo đè lên lịch trùng theo xác nhận của bạn.', 'warning');
        } else if (w.code === 'INVITATION_EMAIL_FAILED') {
          showToast('Cảnh báo email', 'Không thể gửi email mời đến một số người tham gia (Cuộc họp vẫn được lưu an toàn).', 'warning');
        }
      });
    }

    forceCloseCreateMeetingModal();
    await loadMeetingsForCurrentView();
  } catch (err) {
    // AC4: Conflict Detection & Suggestions handling
    if (err.status === 409 && err.code === 'SCHEDULE_CONFLICT') {
      pendingSubmissionPayload = { ...payload };
      showConflictModal(err);
    } else if (err.status === 400 && err.details?.length) {
      // Map validation errors back to fields
      err.details.forEach((d) => {
        if (d.field === 'title') {
          document.getElementById('input-meeting-title')?.classList.add('has-error');
          const e = document.getElementById('error-meeting-title');
          if (e) {
            e.textContent = d.message;
            e.classList.add('visible');
          }
        }
        if (d.field === 'end_time') {
          document.getElementById('input-end-time')?.classList.add('has-error');
          const e = document.getElementById('error-end-time');
          if (e) {
            e.textContent = d.message;
            e.classList.add('visible');
          }
        }
        if (d.field === 'participants') {
          document.getElementById('participant-picker')?.classList.add('has-error');
          const e = document.getElementById('error-participants');
          if (e) {
            e.textContent = d.message;
            e.classList.add('visible');
          }
        }
      });
      showToast('Lỗi dữ liệu đầu vào', err.message, 'error');
    } else {
      showToast('Không thể tạo cuộc họp', err.message, 'error');
    }
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<span>Lưu lịch họp</span>';
    }
  }
}

// AC4: Show Conflict Warning Modal
function showConflictModal(conflictError) {
  const modal = document.getElementById('modal-conflict-warning');
  const detailsList = document.getElementById('conflict-details-list');
  const slotsContainer = document.getElementById('suggested-slots-container');
  if (!modal || !detailsList || !slotsContainer) return;

  // Render conflict details list
  const details = conflictError.details || [];
  detailsList.innerHTML = details
    .map(
      (d) => `
    <li><strong>• ${escapeHtml(d.message)}</strong></li>
  `
    )
    .join('');

  // Render up to 3 suggested slots
  const suggestedTimes = conflictError.suggested_times || [];
  if (suggestedTimes.length === 0) {
    slotsContainer.innerHTML = '<div style="font-size: 12px; color: var(--text-muted);">Không tìm thấy khung giờ trống gần nhất trong giờ làm việc.</div>';
  } else {
    slotsContainer.innerHTML = suggestedTimes
      .map((slot, idx) => {
        const s = new Date(slot.start_time);
        const e = new Date(slot.end_time);
        const timeStr = `${formatTimeHM(s)} - ${formatTimeHM(e)} (${s.toLocaleDateString('vi-VN')})`;
        return `
        <div class="suggestion-slot-card">
          <span class="slot-time-text">${timeStr}</span>
          <button type="button" class="btn-apply-slot" data-index="${idx}" data-start="${slot.start_time}" data-end="${slot.end_time}">
            Áp dụng khung giờ này
          </button>
        </div>
      `;
      })
      .join('');

    // Attach slot apply buttons
    slotsContainer.querySelectorAll('.btn-apply-slot').forEach((btn) => {
      btn.addEventListener('click', () => {
        const startIso = btn.dataset.start;
        const endIso = btn.dataset.end;
        if (startIso && endIso) {
          document.getElementById('input-start-time').value = formatDateTimeLocal(new Date(startIso));
          document.getElementById('input-end-time').value = formatDateTimeLocal(new Date(endIso));
          state.setDirty(true);
          modal.classList.remove('open');
          showToast('Đã áp dụng khung giờ', 'Khung giờ gợi ý đã được điền vào form tạo.', 'info');
        }
      });
    });
  }

  modal.classList.add('open');
}

// ==========================================================================
// 8. Meeting Details Modal
// ==========================================================================

function openDetailsModal(meeting) {
  const modal = document.getElementById('modal-meeting-details');
  const body = document.getElementById('details-modal-body');
  const titleEl = document.getElementById('details-meeting-title');
  if (!modal || !body) return;

  if (titleEl) titleEl.textContent = meeting.title;

  const s = new Date(meeting.start_time);
  const e = new Date(meeting.end_time);
  const dateFormatted = s.toLocaleDateString('vi-VN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const timeFormatted = `${formatTimeHM(s)} – ${formatTimeHM(e)}`;

  body.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 16px;">
      <!-- Time & Status Banner -->
      <div style="background: var(--primary-gradient-subtle); padding: 14px 18px; border-radius: var(--radius-lg); border: 1px solid var(--primary-200); display: flex; align-items: center; justify-content: space-between;">
        <div>
          <div style="font-size: 15px; font-weight: 800; color: var(--primary-700);">${dateFormatted}</div>
          <div style="font-size: 14px; font-family: 'JetBrains Mono', monospace; color: var(--text-muted);">${timeFormatted}</div>
        </div>
        <span class="user-role-tag role-organizer">${meeting.status}</span>
      </div>

      <!-- Room & Online Link -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
        <div style="background: var(--bg-surface-alt); padding: 12px; border-radius: var(--radius-md);">
          <div style="font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Phòng họp</div>
          <div style="font-weight: 700; font-size: 14px; margin-top: 2px;">
            ${meeting.room ? escapeHtml(meeting.room.room_name) : 'Họp trực tuyến'}
          </div>
          ${meeting.room ? `<div style="font-size: 11px; color: var(--text-subtle);">${meeting.room.capacity} chỗ - ${escapeHtml(meeting.room.location || '')}</div>` : ''}
        </div>

        <div style="background: var(--bg-surface-alt); padding: 12px; border-radius: var(--radius-md);">
          <div style="font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Link trực tuyến</div>
          <div style="margin-top: 2px;">
            ${
              meeting.meeting_link
                ? `<a href="${escapeHtml(meeting.meeting_link)}" target="_blank" style="color: var(--primary-600); font-weight: 700; word-break: break-all;">🔗 Tham gia ngay</a>`
                : '<span style="font-size: 13px; color: var(--text-subtle);">Không có</span>'
            }
          </div>
        </div>
      </div>

      <!-- Description -->
      ${
        meeting.description
          ? `
        <div>
          <div style="font-size: 12px; font-weight: 700; color: var(--text-muted); margin-bottom: 4px;">Nội dung cuộc họp:</div>
          <div style="background: var(--bg-surface-alt); padding: 12px; border-radius: var(--radius-md); font-size: 13px; white-space: pre-wrap;">${escapeHtml(meeting.description)}</div>
        </div>
      `
          : ''
      }

      <!-- Organizer & Participants -->
      <div>
        <div style="font-size: 12px; font-weight: 700; color: var(--text-muted); margin-bottom: 8px;">Người tham gia (${meeting.participants.length}):</div>
        <div style="display: flex; flex-direction: column; gap: 6px;">
          <!-- Organizer Row -->
          <div style="display: flex; align-items: center; justify-content: space-between; padding: 6px 10px; background: var(--bg-surface-alt); border-radius: var(--radius-sm); font-size: 13px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-weight: 700;">👑 ${escapeHtml(meeting.organizer.full_name)}</span>
              <span style="font-size: 11px; color: var(--text-muted);">(Người tổ chức)</span>
            </div>
            <span class="user-role-tag role-participant">Accepted</span>
          </div>

          <!-- Other Participants -->
          ${meeting.participants
            .map((p) => {
              const statusClass =
                p.status === 'Accepted'
                  ? 'role-participant'
                  : p.status === 'Declined'
                  ? 'role-admin'
                  : 'role-organizer';
              return `
              <div style="display: flex; align-items: center; justify-content: space-between; padding: 6px 10px; background: var(--bg-surface-alt); border-radius: var(--radius-sm); font-size: 13px;">
                <div>
                  <span>${escapeHtml(p.full_name)}</span>
                  <span style="font-size: 11px; color: var(--text-muted); margin-left: 6px;">${escapeHtml(p.email)}</span>
                </div>
                <span class="user-role-tag ${statusClass}">${p.status}</span>
              </div>
            `;
            })
            .join('')}
        </div>
      </div>

      <!-- Attachments -->
      ${
        meeting.attachments?.length
          ? `
        <div>
          <div style="font-size: 12px; font-weight: 700; color: var(--text-muted); margin-bottom: 6px;">Tệp đính kèm (${meeting.attachments.length}):</div>
          <div style="display: flex; flex-direction: column; gap: 6px;">
            ${meeting.attachments
              .map(
                (att) => `
              <div style="display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; border: 1px solid var(--border-subtle); border-radius: var(--radius-md); font-size: 12px;">
                <span>📄 ${escapeHtml(att.file_name)} (${(att.size_bytes / 1024).toFixed(1)} KB)</span>
                <a href="/api/v1/meetings/${meeting.meeting_id}/attachments/${att.attachment_id}" download="${escapeHtml(att.file_name)}" class="btn-secondary" style="padding: 4px 10px; font-size: 11px;">Tải xuống</a>
              </div>
            `
              )
              .join('')}
          </div>
        </div>
      `
          : ''
      }
    </div>
  `;

  modal.classList.add('open');
}

function closeDetailsModal() {
  document.getElementById('modal-meeting-details')?.classList.remove('open');
}

window.viewMeetingDetails = (meetingId) => {
  const m = state.meetings.find((item) => item.meeting_id === meetingId);
  if (m) openDetailsModal(m);
};

// ==========================================================================
// 9. Date & Formatting Helpers
// ==========================================================================

function formatTimeHM(date) {
  const h = date.getHours().toString().padStart(2, '0');
  const m = date.getMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}

function formatDateTimeLocal(date) {
  const pad = (n) => n.toString().padStart(2, '0');
  const y = date.getFullYear();
  const m = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  const h = pad(date.getHours());
  const min = pad(date.getMinutes());
  return `${y}-${m}-${d}T${h}:${min}`;
}

function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
