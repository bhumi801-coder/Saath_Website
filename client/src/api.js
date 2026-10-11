const TOKEN_KEY = 'saath_token';

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t) => (t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY));

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

export async function api(path, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    const API_BASE = 'https://saath-website-rrsa.onrender.com';

res = await fetch(`${API_BASE}/api${path}`, {
  method,
  headers,
  body: body ? JSON.stringify(body) : undefined,
});
  } catch {
    throw new ApiError('Cannot reach the server. Check that it is running and try again.', 0);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && token) setToken(null);
    throw new ApiError(data.error || 'Something went wrong. Try again.', res.status);
  }
  return data;
}
