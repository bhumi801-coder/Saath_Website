import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from './api.js';
import { useAuth } from './auth.jsx';

// Services + societies (loaded once) and the visitor's chosen society ("location").
const MetaContext = createContext(null);
export const useMeta = () => useContext(MetaContext);
const KEY = 'saath_society'; // a society id, or 'all'

export function MetaProvider({ children }) {
  const { user } = useAuth();
  const [meta, setMeta] = useState(null);
  const [error, setError] = useState(null);
  const [pref, setPref] = useState(() => localStorage.getItem(KEY));

  const load = useCallback(() => {
    setError(null);
    api('/meta').then(setMeta).catch(setError);
  }, []);
  useEffect(load, [load]);

  // Logging in resets the location to the resident's own society.
  useEffect(() => {
    if (user) { localStorage.removeItem(KEY); setPref(null); }
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const societyId = pref === 'all' ? '' : pref ?? (user ? String(user.society.id) : '');
  const setSocietyId = useCallback((id) => {
    const v = id ? String(id) : 'all';
    localStorage.setItem(KEY, v);
    setPref(v);
  }, []);

  // Adds a society that is missing from the list, reloads the list, returns the society.
  const addSociety = useCallback(async (form) => {
    const d = await api('/societies', { method: 'POST', body: form });
    const fresh = await api('/meta');
    setMeta(fresh);
    return d.society;
  }, []);

  const value = useMemo(() => ({
    meta, error, reload: load, addSociety,
    services: meta?.services || [],
    societies: meta?.societies || [],
    timeSlots: meta?.time_slots || [],
    cities: meta?.cities || [],
    payments: meta?.payments || { mode: 'off', key_id: null },
    minDate: meta?.today || null,
    maxDate: meta?.max_date || null,
    societyId,
    society: meta?.societies.find((s) => String(s.id) === String(societyId)) || null,
    setSocietyId,
  }), [meta, error, load, societyId, setSocietyId, addSociety]);

  return <MetaContext.Provider value={value}>{children}</MetaContext.Provider>;
}
