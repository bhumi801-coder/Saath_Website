import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useToast } from '../components/Toast.jsx';
import { ErrorBox } from '../components/Common.jsx';
import { Logo } from '../components/Layout.jsx';
import { EMAIL, Field, ariaFor } from './AuthPages.jsx';

// Forgot password, for residents (role="customer") and service partners (role="provider").
// Step 1: enter the email, a 6-digit code is sent to the email and the registered mobile.
// Step 2: enter the code and a new password.
const CFG = {
  customer: { base: '/auth', login: '/login', forgot: '/forgot-password', min: 6, tag: null, other: ['Service partner? ', 'Partner forgot password', '/partner/forgot-password'] },
  provider: { base: '/provider/auth', login: '/partner/login', forgot: '/partner/forgot-password', min: 8, tag: 'Service partner', other: ['Resident? ', 'Resident forgot password', '/forgot-password'] },
};

export default function ForgotPassword({ role = 'customer' }) {
  const cfg = CFG[role];
  const navigate = useNavigate();
  const toast = useToast();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ email: '', code: '', password: '' });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState(null);
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const sendCode = async (e) => {
    e?.preventDefault();
    if (!EMAIL.test(form.email.trim())) { setErrors({ email: 'Enter the email you signed up with.' }); return; }
    setErrors({}); setBusy(true); setError(null);
    try {
      const d = await api(`${cfg.base}/forgot`, { method: 'POST', body: { email: form.email } });
      setInfo(d.message);
      setStep(2);
    } catch (err) { setError(err); } finally { setBusy(false); }
  };

  const resetPassword = async (e) => {
    e.preventDefault();
    const v = {};
    if (!/^\d{6}$/.test(form.code.replace(/\s+/g, ''))) v.code = 'Enter the 6-digit code.';
    if (form.password.length < cfg.min) v.password = `Use at least ${cfg.min} characters.`;
    setErrors(v);
    if (Object.keys(v).length) return;
    setBusy(true); setError(null);
    try {
      await api(`${cfg.base}/reset`, { method: 'POST', body: form });
      toast('Password changed. Log in with your new password.');
      navigate(cfg.login, { replace: true });
    } catch (err) { setError(err); setBusy(false); }
  };

  return (
    <div className="auth-wrap">
      <div className="card auth-card">
        <Logo />
        {cfg.tag && <span className="role-tag">{cfg.tag}</span>}
        <h1>Forgot your password?</h1>

        {step === 1 && (
          <>
            <p className="muted">Enter your email. We will send a 6-digit code to it and to the mobile number on your account (WhatsApp or SMS).</p>
            <form onSubmit={sendCode} noValidate>
              <Field id="f-email" label="Email" error={errors.email}>
                <input {...ariaFor('f-email', errors.email)} type="email" autoComplete="email" value={form.email} onChange={set('email')} />
              </Field>
              <ErrorBox error={error} />
              <button className="btn btn-primary btn-block btn-lg" disabled={busy}>{busy ? 'Sending…' : 'Send code'}</button>
            </form>
          </>
        )}

        {step === 2 && (
          <>
            <div className="alert alert-info" role="status"><p>{info}</p></div>
            <form onSubmit={resetPassword} noValidate>
              <Field id="f-code" label="6-digit code" error={errors.code}>
                <input {...ariaFor('f-code', errors.code)} inputMode="numeric" autoComplete="one-time-code" maxLength="6" placeholder="123456"
                  value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.replace(/\D/g, '') })} />
              </Field>
              <Field id="f-new" label="New password" error={errors.password} hint={`At least ${cfg.min} characters.`}>
                <input {...ariaFor('f-new', errors.password)} type="password" autoComplete="new-password" value={form.password} onChange={set('password')} />
              </Field>
              <ErrorBox error={error} />
              <button className="btn btn-primary btn-block btn-lg" disabled={busy}>{busy ? 'Saving…' : 'Change password'}</button>
            </form>
            <p className="muted center small">
              Did not get a code? <button type="button" className="linklike" disabled={busy} onClick={sendCode}>Send it again</button>
            </p>
          </>
        )}

        <p className="muted center"><Link to={cfg.login}>Back to log in</Link></p>
        <p className="muted center small">{cfg.other[0]}<Link to={cfg.other[2]}>{cfg.other[1]}</Link></p>
      </div>
    </div>
  );
}
