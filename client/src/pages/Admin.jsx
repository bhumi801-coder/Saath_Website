import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useApi } from '../hooks.js';
import { useAuth } from '../auth.jsx';
import { useToast } from '../components/Toast.jsx';
import { Empty, ErrorBox } from '../components/Common.jsx';
import { Logo } from '../components/Layout.jsx';
import { DemoTag } from '../components/Fulfilment.jsx';
import { shortDate } from '../format.js';
import { EMAIL, Field, ariaFor } from './AuthPages.jsx';

// Minimal administration: approve or suspend service partners, and take a job back from a partner.
// Admin accounts are created from the command line (npm run create-admin), never through sign-up.

export function AdminLogin() {
  const { adminLogin } = useAuth();
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
    try { await adminLogin(form.email, form.password); navigate('/admin', { replace: true }); }
    catch (err) { setError(err); setBusy(false); }
  };

  return (
    <div className="auth-wrap">
      <div className="card auth-card">
        <Logo />
        <span className="role-tag">Admin</span>
        <h1>Admin log in</h1>
        <form onSubmit={submit} noValidate>
          <Field id="a-email" label="Email" error={errors.email}>
            <input {...ariaFor('a-email', errors.email)} type="email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
          <Field id="a-pass" label="Password" error={errors.password}>
            <input {...ariaFor('a-pass', errors.password)} type="password" autoComplete="current-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </Field>
          <ErrorBox error={error} />
          <button className="btn btn-primary btn-block btn-lg" disabled={busy}>{busy ? 'Logging in…' : 'Log in'}</button>
        </form>
        <p className="muted center small"><Link to="/">Back to Saath</Link></p>
      </div>
    </div>
  );
}

const PARTNER_BADGE = { active: 'badge-ok', pending: 'badge-wait', suspended: 'badge-bad' };
const JOB_BADGE = { unassigned: ['Awaiting provider', 'badge-wait'], accepted: ['Provider accepted', 'badge-ok'], completed: ['Completed', 'badge-ok'], cancelled: ['Cancelled', 'badge-bad'] };

export default function Admin() {
  const { data, error, loading, reload } = useApi('/admin/overview');
  const toast = useToast();
  const [busy, setBusy] = useState(null);

  const run = async (key, path, body, ok, confirmText) => {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(key);
    try { await api(path, { method: 'POST', body }); toast(ok); }
    catch (e) { toast(e.message, 'error'); }
    finally { setBusy(null); reload(); }
  };

  return (
    <div className="container section-pad">
      <div className="page-head dash-head">
        <div><h1>Admin</h1><p className="muted">Service partners and unlocked groups.</p></div>
        <button className="btn btn-secondary btn-sm" onClick={reload} disabled={loading}>{loading ? 'Refreshing…' : 'Refresh'}</button>
      </div>
      <ErrorBox error={error} retry={reload} />

      {data && (
        <>
          <section className="block" aria-labelledby="ap-h">
            <h2 id="ap-h">Service partners ({data.providers.length})</h2>
            {!data.providers.length ? <Empty title="No partners yet"><p className="muted">Partners who register appear here.</p></Empty> : (
              <div className="table-wrap card">
                <table className="data-table">
                  <thead><tr><th>Partner</th><th>Services</th><th>Cities</th><th>Open / done</th><th>Status</th><th><span className="sr">Actions</span></th></tr></thead>
                  <tbody>
                    {data.providers.map((p) => (
                      <tr key={p.id}>
                        <td><b>{p.name}</b> {p.is_demo && <DemoTag />}<br /><span className="muted small">{p.email} · {p.phone}</span></td>
                        <td>{p.services.map((s) => s.name).join(', ')}</td>
                        <td>{p.areas.join(', ')}</td>
                        <td>{p.open_jobs} / {p.done_jobs}</td>
                        <td><span className={`badge ${PARTNER_BADGE[p.status]}`}>{p.status}</span></td>
                        <td>
                          {p.status !== 'active'
                            ? <button className="btn btn-primary btn-sm" disabled={busy === `p${p.id}`} onClick={() => run(`p${p.id}`, `/admin/providers/${p.id}/status`, { status: 'active' }, 'Partner approved.')}>Approve</button>
                            : <button className="btn btn-secondary btn-sm" disabled={busy === `p${p.id}`} onClick={() => run(`p${p.id}`, `/admin/providers/${p.id}/status`, { status: 'suspended' }, 'Partner suspended.', `Suspend ${p.name}? They will not be able to accept jobs. Jobs they already accepted stay with them until you release them below.`)}>Suspend</button>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="block" aria-labelledby="aj-h">
            <h2 id="aj-h">Unlocked groups ({data.jobs.length})</h2>
            {!data.jobs.length ? <Empty title="No unlocked groups"><p className="muted">Groups that reach their flat count appear here.</p></Empty> : (
              <div className="table-wrap card">
                <table className="data-table">
                  <thead><tr><th>Ref</th><th>Group</th><th>When</th><th>Flats</th><th>Provider</th><th><span className="sr">Actions</span></th></tr></thead>
                  <tbody>
                    {data.jobs.map((j) => {
                      const [label, cls] = JOB_BADGE[j.assignment] || JOB_BADGE.unassigned;
                      return (
                        <tr key={j.group_id}>
                          <td>{j.reference}</td>
                          <td><b>{j.service}</b><br /><span className="muted small">{j.society}</span></td>
                          <td>{shortDate(j.scheduled_date)}<br /><span className="muted small">{j.time_slot_label}</span></td>
                          <td>{j.flats}/{j.target}</td>
                          <td><span className={`badge ${cls}`}>{label}</span>{j.provider && <><br /><span className="small">{j.provider.name}</span> {j.provider.is_demo && <DemoTag />}</>}</td>
                          <td>
                            {j.assignment === 'accepted' && (
                              <button className="btn btn-secondary btn-sm" disabled={busy === `j${j.group_id}`}
                                onClick={() => run(`j${j.group_id}`, `/admin/jobs/${j.group_id}/release`, {}, 'Job released. It is available to partners again.', `Take ${j.reference} back from ${j.provider.name}? It becomes available to other partners.`)}>Release</button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
