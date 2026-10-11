import { AlertIcon, CalendarIcon, CheckIcon, ClockIcon } from './Icons.jsx';
import { longDate, plural } from '../format.js';

// Four separate facts, never merged into one "confirmed":
//   1. Group status    (Forming / Unlocked)           -> from the flat count
//   2. Provider status (awaiting / accepted ...)      -> from a real service partner accepting
//   3. Payment status  (Unpaid / Paid ...)            -> from payments, never from acceptance
//   4. Service status  (not confirmed / completed)    -> from the partner marking it done

export function groupStatus(g) {
  switch (g.state) {
    case 'open': return { label: 'Forming', cls: 'badge-wait' };
    case 'unlocked': case 'completed': return { label: 'Unlocked', cls: 'badge-ok' };
    case 'cancelled': return { label: 'Cancelled', cls: 'badge-bad' };
    default: return { label: 'Did not reach target', cls: 'badge-bad' };
  }
}

export function providerStatus(g) {
  switch (g.provider_status) {
    case 'awaiting': return { label: 'Awaiting provider', cls: 'badge-wait' };
    case 'accepted': return { label: 'Provider assigned', cls: 'badge-ok' };
    case 'completed': return { label: 'Provider assigned', cls: 'badge-ok' };
    case 'missed': return { label: 'No provider accepted', cls: 'badge-bad' };
    case 'cancelled': return { label: 'Cancelled', cls: 'badge-bad' };
    default: return { label: 'Opens when unlocked', cls: 'badge-gray' };
  }
}

export function paymentStatus(g) {
  switch (g.my_payment?.display) {
    case 'paid': return g.my_payment.demo ? { label: 'Paid (demo, no real money)', cls: 'badge-info' } : { label: 'Paid', cls: 'badge-ok' };
    case 'pending': return { label: 'Payment pending', cls: 'badge-wait' };
    case 'refund_due': return { label: 'Refund due', cls: 'badge-bad' };
    case 'refunded': return { label: 'Refunded', cls: 'badge-info' };
    default: return { label: 'Unpaid', cls: 'badge-gray' };
  }
}

export function serviceStatus(g) {
  switch (g.service_status) {
    case 'completed': return { label: 'Completed', cls: 'badge-ok' };
    case 'confirmed': return { label: 'Confirmed', cls: 'badge-ok' };
    case 'cancelled': return { label: 'Cancelled', cls: 'badge-bad' };
    case 'not_fulfilled': case 'expired': return { label: 'Not completed', cls: 'badge-bad' };
    default: return { label: 'Not confirmed yet', cls: 'badge-wait' };
  }
}

export const Badge = ({ s }) => <span className={`badge ${s.cls}`}>{s.label}</span>;

export function DemoTag() {
  return <span className="pill pill-demo" title="A test partner account from a demo environment. This is not a real service booking.">Demo partner</span>;
}

// One sentence the customer can act on, matching the provider status.
export function providerMessage(g) {
  switch (g.provider_status) {
    case 'awaiting': return 'The group is unlocked, but no service partner has accepted it yet. Your service date is not confirmed until one does.';
    case 'accepted': return 'A service partner has accepted this group. Your service is confirmed for the date below.';
    case 'completed': return 'The service partner has marked this service as completed.';
    case 'missed': return 'The service date passed and no service partner accepted this group. Nothing is charged for it.';
    case 'cancelled': return 'This group was cancelled.';
    default: return 'Service partners can accept this group once enough flats join and it unlocks.';
  }
}

export function ProviderCard({ group: g }) {
  const p = g.provider;
  if (!p) return null;
  return (
    <div className="provider-card">
      <div className="pc-head">
        <span className="avatar" aria-hidden="true">{p.name[0]}</span>
        <div>
          <p className="bk-label">Your service partner</p>
          <p><b>{p.name}</b> {p.is_demo && <DemoTag />}</p>
        </div>
      </div>
      {p.phone && <p>Phone: <a href={`tel:${p.phone}`}>{p.phone}</a></p>}
      {p.is_demo && <p className="muted small">This is a test account made in a demo environment. No real mechanic is booked.</p>}
    </div>
  );
}

// The full picture for one group, as the resident sees it.
export default function StatusPanel({ group: g }) {
  const member = g.my_units !== null && g.my_units !== undefined;
  const confirmed = g.service_status === 'confirmed' || g.service_status === 'completed';
  return (
    <section className="card status-panel" aria-labelledby="status-h">
      <h2 id="status-h">Booking status</h2>
      <dl className="status-grid">
        <div>
          <dt>Group</dt>
          <dd><Badge s={groupStatus(g)} /><span className="muted small">{plural(g.joined, 'flat')} of {g.target}</span></dd>
        </div>
        <div>
          <dt>Service partner</dt>
          <dd><Badge s={providerStatus(g)} /></dd>
        </div>
        <div>
          <dt>Service date</dt>
          <dd>
            <Badge s={serviceStatus(g)} />
            <span className="muted small"><CalendarIcon size={14} /> {longDate(g.scheduled_date)}, {g.time_slot_label}</span>
          </dd>
        </div>
        {member && (
          <div>
            <dt>Payment</dt>
            <dd><Badge s={paymentStatus(g)} /></dd>
          </div>
        )}
      </dl>
      <div className={`alert ${confirmed ? 'alert-success' : g.provider_status === 'awaiting' ? 'alert-info' : 'alert-neutral'}`} role="status">
        {confirmed ? <CheckIcon size={20} /> : g.provider_status === 'awaiting' ? <ClockIcon size={20} /> : <AlertIcon size={20} />}
        <p>{providerMessage(g)}</p>
      </div>
      {member && <ProviderCard group={g} />}
      {g.completed_at && <p className="muted small">Marked completed by the service partner.</p>}
    </section>
  );
}
