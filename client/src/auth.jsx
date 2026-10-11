import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, getToken, setToken } from './api.js';

// One login at a time. The server tells us the role of the token ('customer' | 'provider' | 'admin').
// `user` stays the resident account, exactly as before, so existing customer pages are unchanged.
// It is null while a service partner or admin is logged in.
const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

const EMPTY = { role: null, profile: null };

export function AuthProvider({ children }) {
  const [session, setSession] = useState(EMPTY);
  const [ready, setReady] = useState(!getToken());

  useEffect(() => {
    if (!getToken()) return;
    api('/session')
      .then((d) => setSession(d.role ? { role: d.role, profile: d.profile } : EMPTY))
      .catch(() => setSession(EMPTY))
      .finally(() => setReady(true));
  }, []);

  const finish = useCallback((token, role, profile) => {
    setToken(token);
    setSession({ role, profile });
  }, []);

  const login = useCallback(async (email, password) => {
    const d = await api('/auth/login', { method: 'POST', body: { email, password } });
    finish(d.token, 'customer', d.user);
  }, [finish]);

  const signup = useCallback(async (form) => {
    const d = await api('/auth/register', { method: 'POST', body: form });
    finish(d.token, 'customer', d.user);
  }, [finish]);

  const partnerLogin = useCallback(async (email, password) => {
    const d = await api('/provider/auth/login', { method: 'POST', body: { email, password } });
    finish(d.token, 'provider', d.provider);
  }, [finish]);

  const partnerSignup = useCallback(async (form) => {
    const d = await api('/provider/auth/register', { method: 'POST', body: form });
    finish(d.token, 'provider', d.provider);
  }, [finish]);

  const adminLogin = useCallback(async (email, password) => {
    const d = await api('/admin/auth/login', { method: 'POST', body: { email, password } });
    finish(d.token, 'admin', d.admin);
  }, [finish]);

  const logout = useCallback(() => {
    setToken(null);
    setSession(EMPTY);
  }, []);

  const value = useMemo(() => ({
    role: session.role,
    user: session.role === 'customer' ? session.profile : null,
    provider: session.role === 'provider' ? session.profile : null,
    admin: session.role === 'admin' ? session.profile : null,
    ready, login, signup, partnerLogin, partnerSignup, adminLogin, logout,
  }), [session, ready, login, signup, partnerLogin, partnerSignup, adminLogin, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
