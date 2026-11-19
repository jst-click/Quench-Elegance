import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, token } from '../lib/api';

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

/** Holds the signed-in admin plus sidebar badge counts (pending requests, unread messages). */
export function AuthProvider({ children }) {
  const [admin, setAdmin] = useState(null);
  const [ready, setReady] = useState(false);
  const [counts, setCounts] = useState({});

  useEffect(() => {
    if (!token.get()) { setReady(true); return; }
    api.get('/me').then((d) => setAdmin(d.admin)).catch(() => {}).finally(() => setReady(true));
  }, []);

  useEffect(() => {
    const onLogout = () => setAdmin(null);
    window.addEventListener('qe:admin-logout', onLogout);
    return () => window.removeEventListener('qe:admin-logout', onLogout);
  }, []);

  const refreshCounts = useCallback(() => {
    api.get('/dashboard').then((d) => setCounts(d.stats)).catch(() => {});
  }, []);

  const login = async (email, password) => {
    const d = await api.post('/login', { email, password });
    token.set(d.token);
    setAdmin(d.admin);
  };
  const logout = () => { token.set(null); setAdmin(null); };

  return <AuthCtx.Provider value={{ admin, ready, login, logout, counts, refreshCounts }}>{children}</AuthCtx.Provider>;
}
