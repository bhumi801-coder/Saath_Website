import { Link } from 'react-router-dom';
import { ServiceIcon } from './Icons.jsx';
import ServiceMedia from './ServiceMedia.jsx';
import { ArrowRightIcon } from './Icons.jsx';
import { plural, rupees } from '../format.js';

// `liveGroups` are the open groups for this service in the visitor's chosen society.
// `decorative` marks the repeated copies used by the moving carousel: hidden from screen readers and the tab order.
export default function ServiceCard({ service: s, liveGroups = [], decorative = false }) {
  const lowest = liveGroups.length ? Math.min(...liveGroups.map((g) => g.group_price)) : null;
  return (
    <Link to={`/services/${s.slug}`} className="card service-card" {...(decorative ? { 'aria-hidden': 'true', tabIndex: -1 } : {})}>
      <ServiceMedia service={s} eager />
      <div className="service-body">
        <div className="svc-head">
          <span className={`svc-ic tone-${s.slug}`} aria-hidden="true"><ServiceIcon slug={s.slug} size={28} /></span>
          <h3>{s.name}</h3>
        </div>
        <p className="muted clamp-2">{s.tagline}</p>
        <div className="service-price">
          {lowest ? (
            <>
              <span className="from">Group price from</span>
              <strong>{rupees(lowest)}</strong>
              <s>{rupees(s.regular_price)}</s>
            </>
          ) : (
            <>
              <span className="from">Starting at</span>
              <strong>{rupees(s.regular_price)}</strong>
            </>
          )}
          <span className="per">per {s.unit_label}</span>
        </div>
        <div className="service-foot">
          <span className={`pill${liveGroups.length ? ' pill-ok' : ''}`}>
            {liveGroups.length ? `${plural(liveGroups.length, 'open group')}` : 'No open group yet'}
          </span>
          <span className="link-cta">Book now <ArrowRightIcon size={16} /></span>
        </div>
      </div>
    </Link>
  );
}

export function ServiceCardSkeleton() {
  return (
    <div className="card service-card skeleton-card" aria-hidden="true">
      <div className="service-body">
        <div className="skel skel-line w60" /><div className="skel skel-line" /><div className="skel skel-line w40" />
      </div>
    </div>
  );
}
