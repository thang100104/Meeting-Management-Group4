import axios from 'axios';

// Khởi tạo một instance axios kết nối tới Backend FastAPI
const api = axios.create({
  baseURL: 'http://localhost:8000/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Tự động đính kèm token vào mọi request nếu đã đăng nhập
api.interceptors.request.use(
  (config) => {
    const token = sessionStorage.getItem('token') || localStorage.getItem('token') || sessionStorage.getItem('access_token') || localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Xử lý lỗi trả về chung (ví dụ: hết hạn token hoặc bị tạm khóa)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      const isLoginRequest = error.config?.url?.includes('/auth/login');
      if (!isLoginRequest) {
        // Xóa sạch token hết hạn ở cả sessionStorage và localStorage
        sessionStorage.removeItem('access_token');
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('user');
        localStorage.removeItem('access_token');
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('currentUser');
        localStorage.removeItem('meetinghub_user');
        // TUYỆT ĐỐI KHÔNG dispatchEvent 'storage' ở đây vì sẽ tạo vòng lặp vô tận (infinite loop) gọi lại API
      }
    } else if (error.response && error.response.status === 403) {
      const detail = error.response.data?.detail || '';
      if (typeof detail === 'string' && (detail.includes('tạm khóa') || detail.includes('vô hiệu hóa'))) {
        if (!sessionStorage.getItem('lock_alert_shown')) {
          sessionStorage.setItem('lock_alert_shown', 'true');
          alert('⛔ THÔNG BÁO:\nTài khoản của bạn đã bị Quản trị viên tạm khóa.\nPhiên làm việc kết thúc!');
        }
        sessionStorage.clear();
        localStorage.removeItem('access_token');
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('currentUser');
        localStorage.removeItem('meetinghub_user');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
