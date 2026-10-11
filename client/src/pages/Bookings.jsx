import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApi } from '../hooks.js';
import ServiceMedia from '../components/ServiceMedia.jsx';
import Progress from '../components/Progress.jsx';
import { Empty, ErrorBox } from '../components/Common.jsx';
import { Badge, DemoTag, groupStatus, paymentStatus, providerStatus, serviceStatus } from '../components/Fulfilment.jsx';
import { CalendarIcon, ClockIcon, PinIcon } from '../components/Icons.jsx';
import { longDate, plural, rupees } from '../format.js';

// Which tab a booking sits in. "Confirmed" now means a real service partner accepted it, not just
// that the group reached its flat count.
const bucket = (b) => {
  const g = b.group;
  if (g.my_payment?.status === 'refund_due') return 'closed';
  switch (g.service_status) {
    case 'completed': return 'done';
    case 'confirmed': return 'confirmed';
    case 'cancelled': case 'not_fulfilled': case 'expired': return 'closed';
    default: return g.provider_status === 'awaiting' ? 'awaiting' : 'waiting';
  }
};

const TABS = [
  ['all', 'All'], ['confirmed', 'Confirmed'], ['awaiting', 'Awaiting provider'],
  ['waiting', 'Forming'], ['done', 'Completed'], ['closed', 'Closed'],
];

function whenLine(g) {
  const when = `${longDate(g.scheduled_date)}, ${g.time_slot_label}`;
  if (g.service_status === 'confirmed') return `Confirmed for ${when}`;
  if (g.service_status === 'completed') return `Completed. Was scheduled for ${when}`;
  return `Planned for ${when}`;
}

export default function Bookings() {
  const { data, error, loading, reload } = useApi('/me/bookings');
  const [tab, setTab] = useState('all');
  const bookings = data?.bookings || [];
  const rows = bookings.map((b) => ({ b, key: bucket(b) }));
  const shown = rows.filter((r) => tab === 'all' || r.key === tab);
  const saved = bookings.filter((b) => b.unlocked).reduce((n, b) => n + b.units * (b.group.regular_price - b.group.group_price), 0);
  const count = (k) => (k === 'all' ? rows.length : rows.filter((r) => r.key === k).length);

  return (
    <div className="container section-pad">
      <div className="page-head"><h1>My bookings</h1></div>
      <ErrorBox error={error} retry={reload} />

      {loading && <div className="stack">{[0, 1, 2].map((i) => <div key={i} className="card skel skel-block short" />)}</div>}

      {data && !bookings.length && (
        <Empty title="You have not joined any group yet">
          <p className="muted">Join a group to unlock the group price with your neighbours.</p>
          <Link className="btn btn-primary" to="/groups">Browse groups</Link>
        </Empty>
      )}

      {bookings.length > 0 && (
        <>
          <ul className="stats four">
            <li className="card"><span className="muted">Bookings</span><strong>{bookings.length}</strong></li>
            <li className="card"><span className="muted">Awaiting provider</span><strong>{count('awaiting')}</strong></li>
            <li className="card"><span className="muted">Confirmed</span><strong>{count('confirmed')}</strong></li>
            <li className="card"><span className="muted">Saved with group prices</span><strong className="ok-text">{rupees(saved)}</strong></li>
          </ul>

          <div className="tabs" role="group" aria-label="Filter bookings">
            {TABS.map(([k, label]) => (
              <button key={k} className={`chip${tab === k ? ' on' : ''}`} aria-pressed={tab === k} onClick={() => setTab(k)}>{label} ({count(k)})</button>
            ))}
          </div>

          <ul className="stack">
            {shown.map(({ b }) => {
              const g = b.group;
              return (
                <li key={g.id}>
                  <Link to={`/groups/${g.id}`} className="card booking-card v2">
                    <ServiceMedia service={g.service} iconSize={28} className="thumb" />
                    <div className="bk-main">
                      <h3>{g.service.name}</h3>
                      <p className="muted"><CalendarIcon size={15} /> {whenLine(g)} · {plural(b.units, g.service.unit_label)}</p>
                      <p className="muted"><PinIcon size={15} /> {g.society.name}</p>

                      <div className="bk-flats">
                        <Progress joined={g.joined} target={g.target} />
                        <span className="small"><b>{g.joined}/{g.target} flats</b></span>
                      </div>

                      <div className="bk-badges" aria-label="Booking status">
                        <span><small className="muted">Group</small><Badge s={groupStatus(g)} /></span>
                        <span><small className="muted">Provider</small><Badge s={providerStatus(g)} /></span>
                        <span><small className="muted">Payment</small><Badge s={paymentStatus(g)} /></span>
                        <span><small className="muted">Service</small><Badge s={serviceStatus(g)} /></span>
                      </div>

                      {g.provider && (
                        <p className="bk-provider">
                          <ClockIcon size={15} /> Partner: <b>{g.provider.name}</b>{g.provider.phone ? `, ${g.provider.phone}` : ''} {g.provider.is_demo && <DemoTag />}
                        </p>
                      )}
                      {!g.provider && g.provider_status === 'awaiting' && (
                        <p className="muted small">Waiting for a service partner to accept. Your date is not confirmed yet.</p>
                      )}
                    </div>
                    <div className="bk-amount">
                      <strong>{rupees(b.amount_if_unlocked)}</strong>
                      <small className="muted">
                        {g.my_payment?.display === 'paid' ? (g.my_payment.demo ? 'demo payment' : 'paid online') : b.unlocked ? 'pay after service or online' : 'if the group unlocks'}
                      </small>
                    </div>
                  </Link>
                </li>
              );
            })}
            {!shown.length && <Empty title="Nothing here"><p className="muted">No bookings with this status.</p></Empty>}
          </ul>
        </>
      )}
    </div>
  );
}
