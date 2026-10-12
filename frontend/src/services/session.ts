const SESSION_KEYS = ['token', 'access_token', 'user', 'currentUser', 'meetinghub_user', 'meetinghub_token'];

export function getAccessToken(): string | null {
  const token = sessionStorage.getItem('access_token') || sessionStorage.getItem('token') || localStorage.getItem('access_token') || localStorage.getItem('token');
  return token && token !== 'undefined' && token !== 'null' && !token.startsWith('mock-token') ? token : null;
}

export function clearSession() {
  for (const key of SESSION_KEYS) {
    sessionStorage.removeItem(key);
    localStorage.removeItem(key);
  }
}

export function saveAccessToken(token: string) {
  for (const storage of [sessionStorage, localStorage]) {
    storage.setItem('access_token', token);
    storage.setItem('token', token);
  }
}
