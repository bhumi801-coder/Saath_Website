import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { useMeta } from '../meta.jsx';
import { ErrorBox } from '../components/Common.jsx';
import { Logo } from '../components/Layout.jsx';
import { CheckIcon } from '../components/Icons.jsx';
import { EMAIL, Field, ariaFor } from './AuthPages.jsx';

// Service Partner (provider) log in and registration. Separate from resident accounts on purpose.

export function PartnerLogin() {
  const { partnerLogin, user, logout } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    const v = {};
    if (!EMAIL.test(form.email.trim())) v.email = 'Enter a valid email address.';
    if (!form.password) v.password = 'Enter your password.';
    setErrors(v);
    if (Object.keys(v).length) return;
    setBusy(true); setError(null);
    try { await partnerLogin(form.email, form.password); navigate('/partner', { replace: true }); }
    catch (err) { setError(err); setBusy(false); }
  };

  return (
    <div className="auth-wrap">
      <div className="card auth-card">
        <Logo />
        <span className="role-tag">Service partner</span>
        <h1>Partner log in</h1>
        <p className="muted">See unlocked group jobs in your area and accept the ones you can do.</p>
        {user && (
          <div className="alert alert-info" role="status">
            <p>You are logged in as a resident ({user.name.split(' ')[0]}). Logging in here replaces that session. <button type="button" className="linklike" onClick={logout}>Log out first</button></p>
          </div>
        )}
        <form onSubmit={submit} noValidate>
          <Field id="p-email" label="Email" error={errors.email}>
            <input {...ariaFor('p-email', errors.email)} type="email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
          <Field id="p-pass" label="Password" error={errors.password}>
            <input {...ariaFor('p-pass', errors.password)} type="password" autoComplete="current-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </Field>
          <p className="forgot-row"><Link to="/partner/forgot-password">Forgot password?</Link></p>
          <ErrorBox error={error} />
          <button className="btn btn-primary btn-block btn-lg" disabled={busy}>{busy ? 'Logging in…' : 'Log in'}</button>
        </form>
        <p className="muted center">New service partner? <Link to="/partner/register">Register</Link></p>
        <p className="muted center small">Looking to book a service? <Link to="/login">Resident log in</Link></p>
      </div>
    </div>
  );
}

export function ToggleChips({ label, hint, options, selected, onToggle, error }) {
  return (
    <div className="field">
      <span className="label-like" id={`${label}-l`}>{label}</span>
      <div className="chips" role="group" aria-labelledby={`${label}-l`}>
        {options.map((o) => {
          const on = selected.includes(o.value);
          return (
            <button key={o.value} type="button" className={`chip${on ? ' on' : ''}`} aria-pressed={on} onClick={() => onToggle(o.value)}>
              {on && <CheckIcon size={16} />} {o.label}
            </button>
          );
        })}
      </div>
      {hint && !error && <p className="hint">{hint}</p>}
      {error && <p className="field-error" role="alert">{error}</p>}
    </div>
  );
}

export function PartnerRegister() {
  const { partnerSignup } = useAuth();
  const { services, societies, meta } = useMeta();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', services: [], areas: [] });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const toggle = (k) => (v) => setForm((f) => ({ ...f, [k]: f[k].includes(v) ? f[k].filter((x) => x !== v) : [...f[k], v] }));

  const cities = useMemo(() => {
    const n = new Map();
    societies.forEach((s) => n.set(s.city, (n.get(s.city) || 0) + 1));
    return [...n.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([c]) => ({ value: c, label: c }));
  }, [societies]);

  const submit = async (e) => {
    e.preventDefault();
    const v = {};
    if (form.name.trim().length < 2) v.name = 'Enter your name or business name.';
    if (!EMAIL.test(form.email.trim())) v.email = 'Enter a valid email address.';
    if (!/^[6-9]\d{9}$/.test(form.phone)) v.phone = 'Enter a valid 10-digit mobile number.';
    if (form.password.length < 8) v.password = 'Use at least 8 characters.';
    if (!form.services.length) v.services = 'Choose at least one service.';
    if (!form.areas.length) v.areas = 'Choose at least one city.';
    setErrors(v);
    if (Object.keys(v).length) return;
    setBusy(true); setError(null);
    try { await partnerSignup(form); navigate('/partner', { replace: true }); }
    catch (err) { setError(err); setBusy(false); }
  };

  const approval = meta && meta.partners && !meta.partners.auto_approve;

  return (
    <div className="auth-wrap">
      <div className="card auth-card wide">
        <Logo />
        <span className="role-tag">Service partner</span>
        <h1>Register as a service partner</h1>
        <p className="muted">Tell us what you do and where. You will only see jobs that match.</p>
        {meta?.partners?.demo && (
          <div className="alert alert-info" role="note"><p><b>Demo environment.</b> Accounts made here are marked as test partners, and customers see a “Demo partner” tag. No real booking is made.</p></div>
        )}
        {approval && (
          <div className="alert alert-info" role="note"><p>New partner accounts are reviewed by the Saath team. You can log in straight away, but jobs appear after approval.</p></div>
        )}
        <form onSubmit={submit} noValidate>
          <Field id="r-name" label="Name or business name" error={errors.name}>
            <input {...ariaFor('r-name', errors.name)} autoComplete="name" value={form.name} onChange={set('name')} />
          </Field>
          <Field id="r-email" label="Email" error={errors.email}>
            <input {...ariaFor('r-email', errors.email)} type="email" autoComplete="email" value={form.email} onChange={set('email')} />
          </Field>
          <div className="two">
            <Field id="r-phone" label="Mobile number" error={errors.phone} hint="Shown to residents once you accept their group.">
              <input {...ariaFor('r-phone', errors.phone)} inputMode="numeric" maxLength="10" placeholder="10 digits" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, '') })} />
            </Field>
            <Field id="r-pass" label="Password" error={errors.password} hint="At least 8 characters.">
              <input {...ariaFor('r-pass', errors.password)} type="password" autoComplete="new-password" value={form.password} onChange={set('password')} />
            </Field>
          </div>
          <ToggleChips label="Services you provide" options={services.map((s) => ({ value: s.slug, label: s.name }))}
            selected={form.services} onToggle={toggle('services')} error={errors.services} />
          <ToggleChips label="Cities you work in" hint="You will see groups from every society in these cities." options={cities}
            selected={form.areas} onToggle={toggle('areas')} error={errors.areas} />
          <p className="muted small">By registering you agree to get job alerts, account messages and password codes from Saath on WhatsApp, SMS and email.</p>
          <ErrorBox error={error} />
          <button className="btn btn-primary btn-block btn-lg" disabled={busy}>{busy ? 'Creating account…' : 'Create partner account'}</button>
        </form>
        <p className="muted center">Already registered? <Link to="/partner/login">Partner log in</Link></p>
      </div>
    </div>
  );
}
