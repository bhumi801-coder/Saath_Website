import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useApi } from '../hooks.js';
import { useAuth } from '../auth.jsx';
import { useMeta } from '../meta.jsx';
import { useToast } from '../components/Toast.jsx';
import { Empty, ErrorBox } from '../components/Common.jsx';
import { ToggleChips } from './PartnerAuth.jsx';
import { DemoTag } from '../components/Fulfilment.jsx';
import { AlertIcon, CalendarIcon, CheckIcon, ClockIcon, PinIcon, UsersIcon } from '../components/Icons.jsx';
import { longDate, plural, rupees, whenLabel } from '../format.js';

const TABS = [['available', 'Available'], ['upcoming', 'Upcoming'], ['completed', 'Completed'], ['cancelled', 'Cancelled']];
const STATUS = {
  available: { label: 'Open for you', cls: 'badge-wait' },
  accepted: { label: 'Accepted', cls: 'badge-ok' },
  completed: { label: 'Completed', cls: 'badge-ok' },
  cancelled: { label: 'Cancelled', cls: 'badge-bad' },
};

function Welcome() {
  const { user, logout } = useAuth();
  return (
    <div className="container narrow section-pad">
      <Empty title="Saath for service partners">
        <p className="muted">Register once, choose the services and cities you cover, and accept unlocked group bookings from housing societies near you.</p>
        {user && <p className="muted small">You are logged in as a resident ({user.name.split(' ')[0]}). Partner accounts are separate. <button className="linklike" onClick={logout}>Log out</button> to use one.</p>}
        <div className="row-actions">
          <Link className="btn btn-primary" to="/partner/login">Partner log in</Link>
          <Link className="btn btn-secondary" to="/partner/register">Register as a partner</Link>
        </div>
      </Empty>
    </div>
  );
}

function Fact({ icon: Icon, children }) {
  return <p className="muted"><Icon size={15} /> {children}</p>;
}

function JobCard({ job, rules, today, onAct, busyId }) {
  const busy = busyId === job.group_id;
  const [open, setOpen] = useState(false);
  const st = STATUS[job.status];
  const tooEarly = job.status === 'accepted' && !rules.early_complete && job.scheduled_date > today;

  return (
    <li className="card job-card">
      <div className="job-top">
        <div>
          <h3>{job.service.name}</h3>
          <p className="muted small">Booking reference <b>{job.reference}</b></p>
        </div>
        <span className={`badge ${st.cls}`}>{st.label}</span>
      </div>

      <div className="job-facts">
        <Fact icon={PinIcon}>{job.society.name}, {job.society.area}, {job.society.city}</Fact>
        <Fact icon={CalendarIcon}>{longDate(job.scheduled_date)} <span className="muted">({whenLabel(job.scheduled_date)})</span></Fact>
        <Fact icon={ClockIcon}>{job.time_slot_label}</Fact>
        <Fact icon={UsersIcon}>{plural(job.flats, 'flat')} · {plural(job.total_units, job.service.unit_label)}</Fact>
      </div>

      <div className="job-amount">
        <span className="muted">Total service amount</span>
        <strong>{rupees(job.total_amount)}</strong>
        <small className="muted">{rupees(job.group_price)} per {job.service.unit_label}</small>
      </div>

      {job.status === 'available' && (
        <div className="job-actions">
          <button className="btn btn-primary" disabled={busy} onClick={() => onAct(job, 'accept')}>{busy ? 'Working…' : 'Accept job'}</button>
          <button className="btn btn-secondary" disabled={busy} onClick={() => onAct(job, 'reject')}>Reject</button>
        </div>
      )}

      {job.status === 'accepted' && (
        <>
          {job.overdue && <p className="alert alert-info"><AlertIcon size={18} /> The service date has passed. Mark it completed once the work is done.</p>}
          <button className="linklike" aria-expanded={open} onClick={() => setOpen((o) => !o)}>{open ? 'Hide residents' : `Show residents (${job.customers.length})`}</button>
          {open && (
            <ul className="cust-list">
              {job.customers.map((c, i) => (
                <li key={i}>
                  <p><b>{c.name}</b> · Flat {c.flat} · {plural(c.units, job.service.unit_label)}</p>
                  {c.phone && <p>Phone: <a href={`tel:${c.phone}`}>{c.phone}</a></p>}
                  {c.note && <p className="muted small">Note: {c.note}</p>}
                  <p className="muted small">{c.amount_due > 0 ? `Collect ${rupees(c.amount_due)} after service` : 'Paid online. Nothing to collect.'}</p>
                </li>
              ))}
            </ul>
          )}
          <div className="job-actions">
            <button className="btn btn-primary" disabled={busy || tooEarly} onClick={() => onAct(job, 'complete')}><CheckIcon size={18} /> Mark as completed</button>
            <button className="btn btn-secondary" disabled={busy} onClick={() => onAct(job, 'withdraw')}>Give job back</button>
          </div>
          {tooEarly && <p className="muted small">You can mark this completed on the service date.</p>}
          {!tooEarly && rules.early_complete && job.scheduled_date > today && <p className="muted small">Demo mode: completing before the service date is allowed so you can try the full flow.</p>}
        </>
      )}

      {job.status === 'completed' && <p className="muted small">Completed {job.completed_at ? `on ${job.completed_at.slice(0, 10)}` : ''}. Resident contact details are no longer shown.</p>}
      {job.status === 'cancelled' && <p className="muted small">This group was cancelled by the resident who started it.</p>}
    </li>
  );
}

// Lets a partner change the services and cities they cover. A job only shows up when BOTH its
// service and its city are in this list.
function CoverageEditor({ provider, onSaved, open, setOpen }) {
  const { services, societies } = useMeta();
  const toast = useToast();
  const [sel, setSel] = useState({ services: provider.services.map((s) => s.slug), areas: provider.areas });
  const [busy, setBusy] = useState(false);
  const cities = useMemo(
    () => [...new Set(societies.map((s) => s.city))].sort((a, b) => a.localeCompare(b)).map((c) => ({ value: c, label: c })),
    [societies],
  );
  const toggle = (k) => (v) => setSel((f) => ({ ...f, [k]: f[k].includes(v) ? f[k].filter((x) => x !== v) : [...f[k], v] }));

  const save = async () => {
    setBusy(true);
    try {
      await api('/provider/coverage', { method: 'PUT', body: sel });
      toast('Coverage updated. New jobs for these cities now appear in Available.');
      setOpen(false);
      onSaved();
    } catch (e) { toast(e.message, 'error'); } finally { setBusy(false); }
  };

  if (!open) return null;
  return (
    <section className="card coverage-card" aria-label="Edit coverage">
      <h2>Services and cities you cover</h2>
      <p className="muted">You see a job only when its service and its city are both selected here.</p>
      <ToggleChips label="Services you provide" options={services.map((s) => ({ value: s.slug, label: s.name }))} selected={sel.services} onToggle={toggle('services')} />
      <ToggleChips label="Cities you work in" options={cities} selected={sel.areas} onToggle={toggle('areas')} />
      <div className="job-actions">
        <button className="btn btn-primary" onClick={save} disabled={busy || !sel.services.length || !sel.areas.length}>{busy ? 'Saving…' : 'Save coverage'}</button>
        <button className="btn btn-secondary" onClick={() => setOpen(false)} disabled={busy}>Cancel</button>
      </div>
    </section>
  );
}

export default function PartnerDashboard() {
  const { provider } = useAuth();
  const { minDate } = useMeta();
  const toast = useToast();
  const { data, error, loading, reload } = useApi('/provider/jobs', Boolean(provider));
  const [tab, setTab] = useState('available');
  const [busyId, setBusyId] = useState(null);
  const [editing, setEditing] = useState(false);

  // A new alert (popup) means the job list changed, so refresh it right away.
  useEffect(() => {
    window.addEventListener('saath:alerts', reload);
    return () => window.removeEventListener('saath:alerts', reload);
  }, [reload]);

  if (!provider) return <Welcome />;

  const CONFIRM = {
    reject: (j) => `Reject this ${j.service.name} job? It stays open for other partners, and you will not see it again.`,
    withdraw: () => 'Give this job back? It becomes available to other partners again, and you will not be able to take it back.',
    complete: () => 'Mark this service as completed?',
  };
  const DONE = { accept: 'Job accepted. The residents can now see your name and phone number.', reject: 'Job rejected. It stays open for other partners.', withdraw: 'Job given back.', complete: 'Marked as completed.' };

  const onAct = async (job, action) => {
    if (CONFIRM[action] && !window.confirm(CONFIRM[action](job))) return;
    setBusyId(job.group_id);
    try {
      await api(`/provider/jobs/${job.group_id}/${action}`, { method: 'POST', body: {} });
      toast(DONE[action]);
      if (action === 'accept') setTab('upcoming');
    } catch (e) { toast(e.message, 'error'); }
    finally { setBusyId(null); reload(); }
  };

  const lists = { available: data?.available || [], upcoming: data?.upcoming || [], completed: data?.completed || [], cancelled: data?.cancelled || [] };
  const shown = lists[tab];
  const p = data?.provider || provider;
  const active = p.status === 'active';

  return (
    <div className="container section-pad">
      <div className="page-head dash-head">
        <div>
          <h1>Partner dashboard</h1>
          <p className="muted">
            {p.name} · {p.services.map((s) => s.name).join(', ')} · {p.areas.join(', ')}
            {' '}{p.is_demo && <DemoTag />}
          </p>
        </div>
        <div className="job-actions">
          <button className="btn btn-secondary btn-sm" onClick={() => setEditing((o) => !o)}>Edit coverage</button>
          <button className="btn btn-secondary btn-sm" onClick={reload} disabled={loading}>{loading ? 'Refreshing…' : 'Refresh'}</button>
        </div>
      </div>
      {data && <CoverageEditor key={p.areas.join('|') + p.services.map((s) => s.slug).join('|')} provider={p} open={editing} setOpen={setEditing} onSaved={reload} />}

      {p.is_demo && (
        <div className="alert alert-info" role="note"><AlertIcon size={20} /><p><b>Demo partner account.</b> Customers who see your acceptance are shown a “Demo partner” tag. Nothing here is a real booking.</p></div>
      )}
      {data?.notice && <div className="alert alert-error" role="status"><AlertIcon size={20} /><p>{data.notice}</p></div>}
      <ErrorBox error={error} retry={reload} />

      <ul className="stats four">
        {TABS.map(([k, label]) => <li key={k} className="card"><span className="muted">{label}</span><strong>{lists[k].length}</strong></li>)}
      </ul>

      <div className="tabs" role="group" aria-label="Filter jobs">
        {TABS.map(([k, label]) => (
          <button key={k} className={`chip${tab === k ? ' on' : ''}`} aria-pressed={tab === k} onClick={() => setTab(k)}>{label} ({lists[k].length})</button>
        ))}
      </div>

      {loading && !data && <div className="stack">{[0, 1].map((i) => <div key={i} className="card skel skel-block short" />)}</div>}

      {data && (
        <ul className="job-grid">
          {shown.map((job) => <JobCard key={job.group_id} job={job} rules={data.rules} today={minDate || ''} onAct={onAct} busyId={busyId} />)}
        </ul>
      )}

      {data && tab === 'available' && !shown.length && active && data.outside_areas?.length > 0 && (
        <div className="alert alert-info" role="status">
          <AlertIcon size={20} />
          <div>
            <p><b>Jobs are waiting outside your cities.</b> {data.outside_areas.map((o) => `${plural(o.count, 'unlocked job')} in ${o.city}`).join(', ')}, for services you provide, but you do not cover {data.outside_areas.length > 1 ? 'those cities' : 'that city'} yet.</p>
            <div className="job-actions">
              {data.outside_areas.map((o) => (
                <button key={o.city} className="btn btn-primary btn-sm" onClick={async () => {
                  try { await api('/provider/coverage', { method: 'PUT', body: { services: p.services.map((s) => s.slug), areas: [...p.areas, o.city] } }); toast(`${o.city} added. The job is now in Available.`); reload(); }
                  catch (e) { toast(e.message, 'error'); }
                }}>Add {o.city}</button>
              ))}
            </div>
          </div>
        </div>
      )}

      {data && !shown.length && (
        <Empty title={{ available: 'No open jobs right now', upcoming: 'No upcoming appointments', completed: 'No completed jobs yet', cancelled: 'No cancelled jobs' }[tab]}>
          <p className="muted">
            {tab === 'available' && (active ? 'Jobs appear here when a group in your cities unlocks for a service you provide. Jobs you reject are hidden from you.' : 'Jobs appear here once your account is active.')}
            {tab === 'upcoming' && 'Jobs you accept appear here with the residents’ contact details.'}
            {tab === 'completed' && 'Jobs you mark as completed appear here.'}
            {tab === 'cancelled' && 'Jobs cancelled by residents after you accepted them appear here.'}
          </p>
        </Empty>
      )}
    </div>
  );
}
