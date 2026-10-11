import { Link } from 'react-router-dom';
import ServiceMedia from './ServiceMedia.jsx';
import Progress from './Progress.jsx';
import { rupees, dayNumber, monthShort, weekdayShort, whenLabel, plural } from '../format.js';

export function stateText(g) {
  const left = Math.max(0, g.target - g.joined);
  switch (g.state) {
    case 'unlocked': return g.provider_status === 'accepted' ? 'Unlocked, provider assigned' : 'Unlocked, awaiting provider';
    case 'completed': return g.service_status === 'completed' ? 'Service completed' : 'Date passed';
    case 'cancelled': return 'Cancelled';
    case 'expired': return 'Did not reach target';
    default: return `${plural(left, 'more flat')} to unlock`;
  }
}

export default function GroupRow({ group: g, showSociety = false }) {
  const unlocked = g.state === 'unlocked' || g.state === 'completed';
  return (
    <Link to={`/groups/${g.id}`} className="card group-card">
      <div className="g-date" aria-hidden="true">
        <span>{weekdayShort(g.scheduled_date)}</span>
        <strong>{dayNumber(g.scheduled_date)}</strong>
        <span>{monthShort(g.scheduled_date)}</span>
      </div>
      <div className="g-main">
        <h3>{g.service.name}</h3>
        <p className="muted">
          {showSociety ? `${g.society.name}, ${g.society.city}` : `Started by ${g.host}`} · {whenLabel(g.scheduled_date)}, {g.time_slot_label}
        </p>
        <Progress joined={g.joined} target={g.target} />
        <p className="g-progress">
          <b>{g.joined} of {g.target} flats</b>
          <span className={unlocked ? 'ok-text' : 'muted'}>{stateText(g)}</span>
        </p>
      </div>
      <div className="g-price">
        <strong>{rupees(g.group_price)}</strong>
        <s>{rupees(g.regular_price)}</s>
        <span className="pill pill-ok">Save {g.saving_pct}%</span>
        <small className="muted">per {g.service.unit_label}</small>
      </div>
    </Link>
  );
}

export function GroupRowSkeleton() {
  return (
    <div className="card group-card skeleton-card" aria-hidden="true">
      <div className="g-date skel" />
      <div className="g-main"><div className="skel skel-line w60" /><div className="skel skel-line" /><div className="skel skel-line w40" /></div>
      <div className="g-price"><div className="skel skel-line" style={{ width: 80 }} /></div>
    </div>
  );
}
