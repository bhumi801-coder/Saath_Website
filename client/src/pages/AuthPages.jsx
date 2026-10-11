import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { useMeta } from '../meta.jsx';
import { ErrorBox } from '../components/Common.jsx';
import { Logo } from '../components/Layout.jsx';
import SocietyOptions from '../components/SocietyOptions.jsx';

function useAfterAuth() {
  const navigate = useNavigate();
  const { state } = useLocation();
  return () => navigate(state?.from || '/services', { replace: true });
}

export function Field({ id, label, error, hint, children }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children}
      {hint && !error && <p className="hint">{hint}</p>}
      {error && <p className="field-error" id={`${id}-err`} role="alert">{error}</p>}
    </div>
  );
}
export const ariaFor = (id, error) => ({ id, 'aria-invalid': !!error, 'aria-describedby': error ? `${id}-err` : undefined });
export const EMAIL = /^\S+@\S+\.\S+$/;

export function Login() {
  const { login } = useAuth();
  const done = useAfterAuth();
  const location = useLocation();
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
    try { await login(form.email, form.password); done(); }
    catch (err) { setError(err); setBusy(false); }
  };

  return (
    <div className="auth-wrap">
      <div className="card auth-card">
        <Logo />
        <h1>Welcome back</h1>
        <p className="muted">Log in to join groups and see your bookings.</p>
        <form onSubmit={submit} noValidate>
          <Field id="l-email" label="Email" error={errors.email}>
            <input {...ariaFor('l-email', errors.email)} type="email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
          <Field id="l-pass" label="Password" error={errors.password}>
            <input {...ariaFor('l-pass', errors.password)} type="password" autoComplete="current-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </Field>
          <p className="forgot-row"><Link to="/forgot-password">Forgot password?</Link></p>
          <ErrorBox error={error} />
          <button className="btn btn-primary btn-block btn-lg" disabled={busy}>{busy ? 'Logging in…' : 'Log in'}</button>
          <button type="button" className="btn btn-secondary btn-block" onClick={() => setForm({ email: 'demo@saath.in', password: 'demo1234' })}>Fill in the demo account</button>
        </form>
        <p className="muted center">New to Saath? <Link to="/signup" state={location.state}>Create an account</Link></p>
        <p className="muted center small">Do you provide the service? <Link to="/partner/login">Service partner login</Link></p>
      </div>
    </div>
  );
}

export function Signup() {
  const { signup } = useAuth();
  const { societies, cities, addSociety } = useMeta();
  const done = useAfterAuth();
  const location = useLocation();
  const [form, setForm] = useState({ name: '', email: '', password: '', society_id: '', flat: '', phone: '' });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const [socQuery, setSocQuery] = useState('');
  const [adding, setAdding] = useState(false);
  const [newSoc, setNewSoc] = useState({ name: '', area: '', city: '' });
  const [addError, setAddError] = useState(null);
  const [addBusy, setAddBusy] = useState(false);

  const q = socQuery.trim().toLowerCase();
  const shownSocieties = q
    ? societies.filter((s) => `${s.name} ${s.area} ${s.city}`.toLowerCase().includes(q) || String(s.id) === form.society_id)
    : societies;

  const submitNewSociety = async () => {
    setAddBusy(true); setAddError(null);
    try {
      const s = await addSociety(newSoc);
      setForm((f) => ({ ...f, society_id: String(s.id) }));
      setErrors((er) => ({ ...er, society_id: undefined }));
      setAdding(false); setSocQuery(''); setNewSoc({ name: '', area: '', city: '' });
    } catch (err) { setAddError(err); } finally { setAddBusy(false); }
  };

  const submit = async (e) => {
    e.preventDefault();
    const v = {};
    if (form.name.trim().length < 2) v.name = 'Enter your full name.';
    if (!EMAIL.test(form.email.trim())) v.email = 'Enter a valid email address.';
    if (form.password.length < 6) v.password = 'Use at least 6 characters.';
    if (!form.society_id) v.society_id = 'Choose your society.';
    if (!form.flat.trim()) v.flat = 'Enter your flat number, for example B-402.';
    if (!/^[6-9]\d{9}$/.test(form.phone)) v.phone = 'Enter a valid 10-digit mobile number.';
    setErrors(v);
    if (Object.keys(v).length) return;
    setBusy(true); setError(null);
    try { await signup({ ...form, society_id: Number(form.society_id) }); done(); }
    catch (err) { setError(err); setBusy(false); }
  };

  return (
    <div className="auth-wrap">
      <div className="card auth-card wide">
        <Logo />
        <h1>Create your account</h1>
        <p className="muted">Groups are shared only between residents of the same society.</p>
        <form onSubmit={submit} noValidate>
          <Field id="s-name" label="Full name" error={errors.name}>
            <input {...ariaFor('s-name', errors.name)} autoComplete="name" value={form.name} onChange={set('name')} />
          </Field>
          <Field id="s-email" label="Email" error={errors.email}>
            <input {...ariaFor('s-email', errors.email)} type="email" autoComplete="email" value={form.email} onChange={set('email')} />
          </Field>
          <Field id="s-pass" label="Password" error={errors.password} hint="At least 6 characters.">
            <input {...ariaFor('s-pass', errors.password)} type="password" autoComplete="new-password" value={form.password} onChange={set('password')} />
          </Field>
          <Field id="s-soc" label="Your society (Uttar Pradesh)" error={errors.society_id}>
            <input type="search" className="soc-search" placeholder="Type to search: society, area or city" value={socQuery} onChange={(e) => setSocQuery(e.target.value)} aria-label="Search societies" />
            <select {...ariaFor('s-soc', errors.society_id)} value={form.society_id} onChange={set('society_id')}>
              <option value="" disabled>{shownSocieties.length ? `Choose your society (${shownSocieties.length} found)` : 'No match, add your society below'}</option>
              <SocietyOptions societies={shownSocieties} withArea />
            </select>
            <button type="button" className="linklike" onClick={() => setAdding((a) => !a)}>{adding ? 'Close' : 'My society is not in the list'}</button>
          </Field>
          {adding && (
            <div className="card add-society" role="group" aria-label="Add your society">
              <p><b>Add your society</b></p>
              <Field id="n-name" label="Society name"><input id="n-name" value={newSoc.name} onChange={(e) => setNewSoc({ ...newSoc, name: e.target.value })} placeholder="e.g. Green Park Apartments" /></Field>
              <div className="two">
                <Field id="n-area" label="Area or sector"><input id="n-area" value={newSoc.area} onChange={(e) => setNewSoc({ ...newSoc, area: e.target.value })} placeholder="e.g. Sector 62" /></Field>
                <Field id="n-city" label="City">
                  <select id="n-city" value={newSoc.city} onChange={(e) => setNewSoc({ ...newSoc, city: e.target.value })}>
                    <option value="" disabled>Choose city</option>
                    {cities.map((c) => <option key={c} value={c === 'Other (Uttar Pradesh)' ? 'Other' : c}>{c}</option>)}
                  </select>
                </Field>
              </div>
              <ErrorBox error={addError} />
              <button type="button" className="btn btn-secondary" disabled={addBusy} onClick={submitNewSociety}>{addBusy ? 'Adding…' : 'Add and select'}</button>
            </div>
          )}
          <div className="two">
            <Field id="s-flat" label="Flat number" error={errors.flat}>
              <input {...ariaFor('s-flat', errors.flat)} placeholder="B-402" value={form.flat} onChange={set('flat')} />
            </Field>
            <Field id="s-phone" label="Mobile number" error={errors.phone} hint="The service team calls on this number.">
              <input {...ariaFor('s-phone', errors.phone)} inputMode="numeric" maxLength="10" placeholder="10 digits" value={form.phone} onChange={set('phone')} />
            </Field>
          </div>
          <ErrorBox error={error} />
          <button className="btn btn-primary btn-block btn-lg" disabled={busy}>{busy ? 'Creating account…' : 'Create account'}</button>
        </form>
        <p className="muted center">Already have an account? <Link to="/login" state={location.state}>Log in</Link></p>
        <p className="muted center small">Want to offer services instead? <Link to="/partner/register">Register as a service partner</Link></p>
      </div>
    </div>
  );
}
