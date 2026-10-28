import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { useMeta } from '../meta.jsx';
import './chat.css';

const STORE = 'saath_chat_v1';
const STARTERS = [
  'Mere AC se paani tapak raha hai',
  'मेरे RO का पानी कड़वा लग रहा है',
  'My sofa has a tea stain',
  'Pest control bachchon ke liye safe hai?',
];
const GREETING = {
  role: 'assistant',
  content: 'Hi! I am the Saath assistant. Tell me about a problem at home, like "AC se paani tapak raha hai", or ask about services, prices and booking. You can write in English, Hindi or Hinglish.',
};

const SpeechRec = typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null;

export default function ChatWidget() {
  const { provider, admin } = useAuth();
  const { services } = useMeta();
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState(() => {
    try { const saved = JSON.parse(sessionStorage.getItem(STORE)); if (Array.isArray(saved) && saved.length) return saved; } catch { /* ignore */ }
    return [GREETING];
  });
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const bodyRef = useRef(null);
  const inputRef = useRef(null);
  const recRef = useRef(null);

  useEffect(() => { try { sessionStorage.setItem(STORE, JSON.stringify(msgs.slice(-40))); } catch { /* ignore */ } }, [msgs]);
  useEffect(() => { bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: 'smooth' }); }, [msgs, busy, open]);
  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 80); }, [open]);
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  if (provider || admin) return null; // partners and admins do not need the resident assistant

  const send = async (raw) => {
    const q = (raw ?? text).trim();
    if (!q || busy) return;
    const next = [...msgs, { role: 'user', content: q }];
    setMsgs(next); setText(''); setBusy(true);
    try {
      // the greeting is UI only, so it is not sent to the server
      const history = next.filter((m) => m !== GREETING && m.content !== GREETING.content).map(({ role, content }) => ({ role, content }));
      const d = await api('/chat', { method: 'POST', body: { messages: history } });
      setMsgs((m) => [...m, { role: 'assistant', content: d.reply, service: d.service }]);
    } catch (e) {
      setMsgs((m) => [...m, { role: 'assistant', content: e.message || 'Something went wrong. Please try again.', error: true }]);
    } finally { setBusy(false); }
  };

  const mic = () => {
    if (!SpeechRec) return;
    if (listening) { recRef.current?.stop(); return; }
    const r = new SpeechRec();
    r.lang = 'hi-IN'; r.interimResults = false; r.maxAlternatives = 1;
    r.onresult = (e) => setText((t) => `${t} ${e.results[0][0].transcript}`.trim());
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    recRef.current = r; setListening(true); r.start();
  };

  const nameOf = (slug) => services.find((s) => s.slug === slug)?.name;
  const fresh = msgs.length <= 1;

  return (
    <div className="chat-root">
      {open && (
        <section className="chat-panel" role="dialog" aria-label="Saath assistant" aria-modal="false">
          <header className="chat-head">
            <span className="chat-avatar" aria-hidden="true">S</span>
            <div className="chat-title"><b>Saath assistant</b><small><i className="chat-dot" />Hindi · English · Hinglish</small></div>
            <button className="chat-x" onClick={() => setMsgs([GREETING])} aria-label="Start a new chat" title="New chat">↺</button>
            <button className="chat-x" onClick={() => setOpen(false)} aria-label="Close chat">✕</button>
          </header>

          <div className="chat-body" ref={bodyRef} aria-live="polite">
            {msgs.map((m, i) => (
              <div key={i} className={`chat-row ${m.role}`}>
                <div className={`chat-bubble${m.error ? ' err' : ''}`}>{m.content}</div>
                {m.service && nameOf(m.service) && (
                  <Link className="chat-cta" to={`/services/${m.service}`} onClick={() => setOpen(false)}>Book {nameOf(m.service)} →</Link>
                )}
              </div>
            ))}
            {busy && <div className="chat-row assistant"><div className="chat-bubble typing" aria-label="Assistant is typing"><i /><i /><i /></div></div>}
            {fresh && !busy && (
              <div className="chat-starters">
                {STARTERS.map((s) => <button key={s} type="button" onClick={() => send(s)}>{s}</button>)}
              </div>
            )}
          </div>

          <form className="chat-form" onSubmit={(e) => { e.preventDefault(); send(); }}>
            <input ref={inputRef} value={text} maxLength={600} onChange={(e) => setText(e.target.value)} placeholder="Type your problem…" aria-label="Your message" autoComplete="off" />
            {SpeechRec && <button type="button" className={`chat-mic${listening ? ' on' : ''}`} onClick={mic} aria-label={listening ? 'Stop listening' : 'Speak your problem'} title="Speak">🎤</button>}
            <button type="submit" className="chat-send" disabled={busy || !text.trim()} aria-label="Send">➤</button>
          </form>
          <p className="chat-note">AI assistant. For anything urgent or risky, switch the appliance off and call 112.</p>
        </section>
      )}

      <button className={`chat-fab${open ? ' open' : ''}`} onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={open ? 'Close assistant' : 'Chat with Saath assistant'}>
        {open ? <span aria-hidden="true">✕</span> : (
          <>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H11l-4.2 3.6c-.5.4-1.3.1-1.3-.6V16A2.5 2.5 0 0 1 4 13.5v-8Z" fill="currentColor" /><circle cx="9" cy="9.5" r="1.2" fill="#0A0805" /><circle cx="12.5" cy="9.5" r="1.2" fill="#0A0805" /><circle cx="16" cy="9.5" r="1.2" fill="#0A0805" /></svg>
            <span className="chat-fab-label">Ask Saath</span>
          </>
        )}
      </button>
    </div>
  );
}
