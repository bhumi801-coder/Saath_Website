import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { AlertIcon, CloseIcon } from './Icons.jsx';

// The popup a service partner sees on any page of the website when something needs them:
// a group unlocked in their city, a flat joined their job, a job was cancelled, their account was approved.
// (The same event also goes to their WhatsApp and SMS from the server.)
// It checks for new alerts every 15 seconds while the tab is open, and again when the tab is opened.
const POLL_MS = 15_000;

export default function PartnerAlerts() {
  const { provider } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const known = useRef(new Set());

  const poll = useCallback(async () => {
    try {
      const d = await api('/provider/notifications');
      setItems(d.notifications);
      const fresh = d.notifications.filter((n) => !known.current.has(n.id));
      if (fresh.length) {
        fresh.forEach((n) => known.current.add(n.id));
        // Lets the dashboard refresh its job list the moment an alert arrives.
        window.dispatchEvent(new Event('saath:alerts'));
      }
    } catch { /* offline or logged out: try again on the next tick */ }
  }, []);

  useEffect(() => {
    if (!provider) { setItems([]); known.current = new Set(); return undefined; }
    poll();
    const timer = setInterval(() => { if (!document.hidden) poll(); }, POLL_MS);
    const onVisible = () => { if (!document.hidden) poll(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); };
  }, [provider?.id, poll]); // eslint-disable-line react-hooks/exhaustive-deps

  const markRead = async (ids) => {
    setItems((list) => list.filter((n) => !ids.includes(n.id)));
    try { await api('/provider/notifications/read', { method: 'POST', body: { ids } }); } catch { /* it will show again next time */ }
  };

  if (!provider || !items.length) return null;
  const top = items[0];
  const ids = items.map((n) => n.id);

  return (
    <div className="partner-alert-zone" role="region" aria-label="New alerts">
      <div className="partner-alert card" role="alert">
        <div className="pa-head">
          <span className="pa-icon" aria-hidden="true"><AlertIcon size={20} /></span>
          <h2>{top.title}</h2>
          <button type="button" className="pa-close" aria-label="Dismiss" onClick={() => markRead(ids)}><CloseIcon size={18} /></button>
        </div>
        <p>{top.body.replace(/^Saath:\s*/, '')}</p>
        {items.length > 1 && <p className="muted small">and {items.length - 1} more new {items.length - 1 === 1 ? 'alert' : 'alerts'}</p>}
        <div className="job-actions">
          <button type="button" className="btn btn-primary btn-sm" onClick={() => { markRead(ids); navigate('/partner'); }}>View jobs</button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => markRead(ids)}>Dismiss</button>
        </div>
      </div>
    </div>
  );
}
