import axios from 'axios';
import { clearSession, getAccessToken } from './session';

const api = axios.create({
  baseURL: 'http://localhost:8000/api/v1',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

let expiring = false;
const expireSession = () => {
  if (expiring) return;
  expiring = true;
  clearSession();
  // Do not dispatch storage: data listeners would issue the same failed requests again.
  window.dispatchEvent(new Event('session-expired'));
  if (!['/login', '/register'].includes(window.location.pathname)) {
    window.location.replace('/login?reason=session-expired');
  } else expiring = false;
};

api.interceptors.request.use(config => {
  const publicRequest = /^\/auth\/(login|token-login|register)$/.test(config.url || '');
  if (publicRequest) return config;
  const token = getAccessToken();
  if (!token) {
    expireSession();
    throw new axios.AxiosError('Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.', 'AUTH_REQUIRED', config);
  }
  expiring = false;
  if (!config.headers.Authorization) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(response => response, error => {
  if (error.response?.status === 401) {
    const sentToken = error.config?.headers?.Authorization;
    // A delayed response from an old account must not clear a newer login.
    if (sentToken === `Bearer ${getAccessToken()}`) expireSession();
  }
  return Promise.reject(error);
});

export default api;
