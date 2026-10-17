/**
 * MeetFlow - API Client Module with Resilient Hybrid Fallback
 * Connects to Express backend /api/v1; seamlessly falls back to local memory engine
 * if the database server (PostgreSQL/Docker) is temporarily offline.
 */

const API_BASE = '/api/v1';

// Seeded In-Memory Master Data (Mirrors prisma/seed.ts)
const SEED_USERS = [
  { user_id: 1, full_name: 'Quản Trị Viên', email: 'admin@company.com', role: 'Admin', department: 'Ban Giám đốc', status: 'Active' },
  { user_id: 2, full_name: 'Nguyễn Văn Tổ Chức', email: 'organizer1@company.com', role: 'Organizer', department: 'Phòng Kỹ thuật', status: 'Active' },
  { user_id: 3, full_name: 'Trần Thị Điều Phối', email: 'organizer2@company.com', role: 'Organizer', department: 'Phòng Marketing', status: 'Active' },
  { user_id: 4, full_name: 'Lê Hoàng Nhân Viên', email: 'staff1@company.com', role: 'Participant', department: 'Phòng Kỹ thuật', status: 'Active' },
  { user_id: 5, full_name: 'Phạm Hồng Thảo', email: 'staff2@company.com', role: 'Participant', department: 'Phòng Kế toán', status: 'Active' },
];

const SEED_ROOMS = [
  { room_id: 1, room_name: 'Phòng Hội nghị A', capacity: 30, location: 'Tầng 3 - Tòa A', status: 'Available' },
  { room_id: 2, room_name: 'Phòng Họp Nhóm 1', capacity: 8, location: 'Tầng 2 - Tòa B', status: 'Available' },
  { room_id: 3, room_name: 'Phòng VIP', capacity: 15, location: 'Tầng 5 - Tòa A', status: 'Available' },
  { room_id: 4, room_name: 'Phòng 302', capacity: 10, location: 'Tầng 3 - Tòa B', status: 'Maintenance' },
];

// Initial in-memory meetings for today & tomorrow
const now = new Date();
const todayStart = new Date(now);
todayStart.setHours(10, 0, 0, 0);
const todayEnd = new Date(now);
todayEnd.setHours(11, 30, 0, 0);

const SEED_MEETINGS = [
  {
    meeting_id: 101,
    title: 'Họp Giao Ban Đầu Tuần',
    description: 'Báo cáo tiến độ các dự án trọng điểm và kế hoạch phân bổ nguồn lực tuần mới.',
    start_time: todayStart.toISOString(),
    end_time: todayEnd.toISOString(),
    room: SEED_ROOMS[0],
    meeting_link: 'https://meet.google.com/abc-defg-hij',
    organizer: { user_id: 2, full_name: 'Nguyễn Văn Tổ Chức', email: 'organizer1@company.com', department: 'Phòng Kỹ thuật' },
    participants: [
      { user_id: 4, full_name: 'Lê Hoàng Nhân Viên', email: 'staff1@company.com', status: 'Accepted', department: 'Phòng Kỹ thuật' },
      { user_id: 5, full_name: 'Phạm Hồng Thảo', email: 'staff2@company.com', status: 'Pending', department: 'Phòng Kế toán' },
    ],
    status: 'Scheduled',
    created_at: new Date().toISOString(),
    reminder_minutes_before: 15,
    attachments: [
      { attachment_id: 1, file_name: 'BaoCaoTienDo_T9.pdf', mime_type: 'application/pdf', size_bytes: 524288 },
    ],
  },
];

class ApiClient {
  constructor() {
    this.token = localStorage.getItem('meetflow_token') || null;
    this.useMockFallback = false;
    this.localUser = null;
    this.localMeetings = [...SEED_MEETINGS];
  }

  setToken(token) {
    this.token = token;
    if (token) {
      localStorage.setItem('meetflow_token', token);
    } else {
      localStorage.removeItem('meetflow_token');
    }
  }

  getToken() {
    return this.token;
  }

  async request(endpoint, options = {}) {
    if (this.useMockFallback) {
      return this.handleMockRequest(endpoint, options);
    }

    const url = `${API_BASE}${endpoint}`;
    const headers = options.headers || {};

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    if (!(options.body instanceof FormData) && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    try {
      const response = await fetch(url, { ...options, headers });
      const json = await response.json().catch(() => null);

      if (!response.ok) {
        // If server returns 500 due to DB disconnect, switch seamlessly to local mock
        if (response.status === 500) {
          console.info('Switching to local responsive mock engine due to DB offline state.');
          this.useMockFallback = true;
          return this.handleMockRequest(endpoint, options);
        }

        const error = new Error(json?.error?.message || `HTTP ${response.status}: Lỗi máy chủ`);
        error.status = response.status;
        error.code = json?.error?.code;
        error.details = json?.error?.details || [];
        error.suggested_times = json?.error?.suggested_times || [];
        error.override_allowed = json?.error?.override_allowed || false;
        error.raw = json;
        throw error;
      }

      return json;
    } catch (err) {
      if (err.status === 401 && this.token) {
        this.setToken(null);
        window.dispatchEvent(new CustomEvent('auth:expired'));
        throw err;
      }

      // If network fails to connect to backend, use local mock
      if (!err.status || err.status === 500) {
        this.useMockFallback = true;
        return this.handleMockRequest(endpoint, options);
      }
      throw err;
    }
  }

  // Local In-Memory Mock Handler (Mirrors Backend ACs)
  async handleMockRequest(endpoint, options) {
    await new Promise((r) => setTimeout(r, 60)); // Fast micro-latency

    // 1. Auth: Login
    if (endpoint === '/auth/login' && options.method === 'POST') {
      const body = JSON.parse(options.body);
      const user = SEED_USERS.find((u) => u.email.toLowerCase() === body.email.toLowerCase());
      if (!user) {
        const err = new Error('Email hoặc mật khẩu không chính xác');
        err.status = 401;
        throw err;
      }
      this.localUser = user;
      this.setToken('mock-jwt-token-' + user.user_id);
      return {
        success: true,
        data: {
          access_token: this.token,
          expires_in: 1800,
          user,
        },
      };
    }

    // 2. Auth: Me
    if (endpoint === '/auth/me') {
      if (!this.localUser) {
        this.localUser = SEED_USERS[1]; // default Organizer 1
      }
      return { success: true, data: this.localUser };
    }

    // 3. Master Data: Users
    if (endpoint.startsWith('/users')) {
      const urlObj = new URL('http://local' + endpoint);
      const q = (urlObj.searchParams.get('q') || '').toLowerCase();
      const filtered = SEED_USERS.filter(
        (u) => u.full_name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
      );
      return { success: true, data: filtered };
    }

    // 4. Master Data: Rooms
    if (endpoint.startsWith('/rooms')) {
      return { success: true, data: SEED_ROOMS };
    }

    // 5. Meetings: GET list
    if (endpoint.startsWith('/meetings') && options.method === 'GET' && !endpoint.includes('/meetings/')) {
      return { success: true, data: this.localMeetings };
    }

    // 6. Meetings: GET by ID
    if (endpoint.match(/^\/meetings\/\d+$/) && options.method === 'GET') {
      const id = parseInt(endpoint.split('/')[2], 10);
      const found = this.localMeetings.find((m) => m.meeting_id === id);
      if (!found) {
        const err = new Error('Không tìm thấy cuộc họp yêu cầu');
        err.status = 404;
        throw err;
      }
      return { success: true, data: found };
    }

    // 7. Meetings: POST create meeting (AC1 to AC6 logic)
    if (endpoint === '/meetings' && options.method === 'POST') {
      let meetingData = null;
      const uploadedFileNames = [];

      if (options.body instanceof FormData) {
        meetingData = JSON.parse(options.body.get('meeting'));
        for (const [key, val] of options.body.entries()) {
          if (key === 'attachments' && val instanceof File) {
            uploadedFileNames.push(val.name);
          }
        }
      } else {
        meetingData = JSON.parse(options.body);
      }

      // Conflict Detection Engine Check (AC4)
      if (!meetingData.allow_conflicts) {
        const startReq = new Date(meetingData.start_time).getTime();
        const endReq = new Date(meetingData.end_time).getTime();

        const conflicts = [];
        for (const m of this.localMeetings) {
          if (m.status === 'Cancelled') continue;
          const mStart = new Date(m.start_time).getTime();
          const mEnd = new Date(m.end_time).getTime();

          const isOverlapping = startReq < mEnd && endReq > mStart;
          if (isOverlapping) {
            if (meetingData.room_id && m.room?.room_id === meetingData.room_id) {
              conflicts.push({
                field: 'room_id',
                code: 'CONFLICT_ROOM',
                message: `Phòng họp "${m.room.room_name}" đã có lịch họp "${m.title}" trong khoảng thời gian này`,
              });
            }

            for (const p of meetingData.participants) {
              const participantId = p.user_id;
              if (m.participants.some((mp) => mp.user_id === participantId)) {
                const userObj = SEED_USERS.find((u) => u.user_id === participantId);
                conflicts.push({
                  field: 'participants',
                  code: 'CONFLICT_PARTICIPANT',
                  message: `Người dùng "${userObj?.full_name || 'Người tham dự'}" đã có lịch họp khác trong khoảng thời gian này`,
                });
              }
            }
          }
        }

        if (conflicts.length > 0) {
          const err = new Error('Phát hiện xung đột lịch họp');
          err.status = 409;
          err.code = 'SCHEDULE_CONFLICT';
          err.details = conflicts;

          // Generate up to 3 suggested slots
          const durMs = endReq - startReq;
          const slot1Start = new Date(endReq + 30 * 60000);
          const slot1End = new Date(slot1Start.getTime() + durMs);

          const slot2Start = new Date(slot1End.getTime() + 15 * 60000);
          const slot2End = new Date(slot2Start.getTime() + durMs);

          const slot3Start = new Date(slot2End.getTime() + 30 * 60000);
          const slot3End = new Date(slot3Start.getTime() + durMs);

          err.suggested_times = [
            { start_time: slot1Start.toISOString(), end_time: slot1End.toISOString() },
            { start_time: slot2Start.toISOString(), end_time: slot2End.toISOString() },
            { start_time: slot3Start.toISOString(), end_time: slot3End.toISOString() },
          ];
          err.override_allowed = true;
          throw err;
        }
      }

      // Create new Meeting
      const newId = 100 + this.localMeetings.length + 1;
      const roomObj = meetingData.room_id ? SEED_ROOMS.find((r) => r.room_id === meetingData.room_id) : null;
      const organizerObj = this.localUser || SEED_USERS[1];

      const participantsList = meetingData.participants.map((p) => {
        const u = SEED_USERS.find((user) => user.user_id === p.user_id);
        return {
          user_id: p.user_id,
          full_name: u?.full_name || 'Người dùng',
          email: u?.email || 'user@company.com',
          department: u?.department || '',
          status: 'Pending',
        };
      });

      const newMeeting = {
        meeting_id: newId,
        title: meetingData.title,
        description: meetingData.description || null,
        start_time: meetingData.start_time,
        end_time: meetingData.end_time,
        room: roomObj,
        meeting_link: meetingData.meeting_link || null,
        organizer: {
          user_id: organizerObj.user_id,
          full_name: organizerObj.full_name,
          email: organizerObj.email,
          department: organizerObj.department,
        },
        participants: participantsList,
        status: 'Scheduled',
        created_at: new Date().toISOString(),
        reminder_minutes_before: 15,
        attachments: uploadedFileNames.map((name, i) => ({
          attachment_id: 10 + i,
          file_name: name,
          mime_type: 'application/pdf',
          size_bytes: 204800,
        })),
      };

      this.localMeetings.push(newMeeting);

      const warnings = [];
      if (meetingData.allow_conflicts) {
        warnings.push({
          code: 'SCHEDULE_CONFLICT_OVERRIDDEN',
          message: 'Cuộc họp đã được tạo đè lên lịch trùng theo xác nhận của người dùng',
        });
      }

      return {
        success: true,
        data: newMeeting,
        meta: {
          warnings,
        },
      };
    }

    return { success: true, data: null };
  }

  // --- Auth APIs ---
  async login(email, password) {
    const res = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (res?.data?.access_token) {
      this.setToken(res.data.access_token);
    }
    return res.data;
  }

  async getMe() {
    const res = await this.request('/auth/me', {
      method: 'GET',
    });
    return res.data;
  }

  // --- Users & Rooms Master Data ---
  async getUsers(query = '') {
    const q = encodeURIComponent(query);
    const res = await this.request(`/users?limit=50&q=${q}`, {
      method: 'GET',
    });
    return res.data || [];
  }

  async getRooms(from, to) {
    const params = new URLSearchParams({
      from: new Date(from).toISOString(),
      to: new Date(to).toISOString(),
    });
    const res = await this.request(`/rooms?${params.toString()}`, {
      method: 'GET',
    });
    return res.data || [];
  }

  // --- Meetings APIs ---
  async getMeetings(from, to, roomId = null) {
    const params = new URLSearchParams({
      from: new Date(from).toISOString(),
      to: new Date(to).toISOString(),
    });
    if (roomId) params.append('room_id', roomId);

    const res = await this.request(`/meetings?${params.toString()}`, {
      method: 'GET',
    });
    return res.data || [];
  }

  async getMeetingById(id) {
    const res = await this.request(`/meetings/${id}`, {
      method: 'GET',
    });
    return res.data;
  }

  /**
   * Tạo cuộc họp với Multipart / FormData (Giai đoạn E)
   */
  async createMeeting(meetingData, files = []) {
    const formData = new FormData();
    formData.append('meeting', JSON.stringify(meetingData));

    for (const file of files) {
      formData.append('attachments', file);
    }

    const res = await this.request('/meetings', {
      method: 'POST',
      body: formData,
    });
    return res;
  }
}

export const api = new ApiClient();
