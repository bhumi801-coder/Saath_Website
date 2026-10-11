import { Link, useParams } from 'react-router-dom';
import { useApi } from '../hooks.js';
import { useMeta } from '../meta.jsx';
import ServiceMedia from '../components/ServiceMedia.jsx';
import GroupRow, { GroupRowSkeleton } from '../components/GroupRow.jsx';
import { Empty, ErrorBox } from '../components/Common.jsx';
import { CheckIcon } from '../components/Icons.jsx';
import { rupees } from '../format.js';

export default function ServiceDetail() {
  const { slug } = useParams();
  const { services, society, societyId, error: metaError, reload } = useMeta();
  const service = services.find((s) => s.slug === slug);
  const q = new URLSearchParams({ service: slug });
  if (societyId) q.set('society_id', societyId);
  const { data, error, loading, reload: reloadGroups } = useApi(`/groups?${q}`, !!service);

  if (metaError) return <div className="container section-pad"><ErrorBox error={metaError} retry={reload} /></div>;
  if (!services.length) return <div className="container section-pad"><div className="skel skel-block" /></div>;
  if (!service) {
    return (
      <div className="container narrow section-pad">
        <Empty title="Service not found">
          <p className="muted">This service does not exist.</p>
          <Link className="btn btn-primary" to="/services">Browse services</Link>
        </Empty>
      </div>
    );
  }

  const groups = (data?.groups || []).filter((g) => ['open', 'unlocked'].includes(g.state));
  const lowest = groups.length ? Math.min(...groups.map((g) => g.group_price)) : null;

  return (
    <div className="container section-pad">
      <p className="crumbs"><Link to="/services">Services</Link> / {service.name}</p>
      <div className="detail-grid">
        <div>
          <ServiceMedia service={service} iconSize={64} className="media-hero" />
          <h1 className="mt">{service.name}</h1>
          <p className="lead-sm">{service.tagline}</p>

          <section className="block" aria-labelledby="inc-h">
            <h2 id="inc-h">What is included</h2>
            <ul className="ticks">
              {service.includes.map((i) => <li key={i}><CheckIcon size={18} /> {i}</li>)}
            </ul>
          </section>

          <section className="block" aria-labelledby="g-h">
            <h2 id="g-h">Open groups{society ? ` in ${society.name}` : ''}</h2>
            <ErrorBox error={error} retry={reloadGroups} />
            <div className="stack">
              {loading && [0, 1].map((i) => <GroupRowSkeleton key={i} />)}
              {groups.map((g) => <GroupRow key={g.id} group={g} showSociety={!society} />)}
              {!loading && !error && !groups.length && (
                <div className="state empty">
                  <h3>No open group for this service yet</h3>
                  <p className="muted">Start one and share it with your neighbours.</p>
                  <Link className="btn btn-primary" to="/new">Start a group</Link>
                </div>
              )}
            </div>
          </section>
        </div>

        <aside className="card side-card" aria-label="Pricing">
          <p className="muted">{lowest ? 'Group price from' : 'Starting at'}</p>
          <p className="side-price"><strong>{rupees(lowest || service.regular_price)}</strong> <span>per {service.unit_label}</span></p>
          {lowest && <p className="muted">Regular price <s>{rupees(service.regular_price)}</s></p>}
          <dl className="facts">
            <div><dt>Service partner</dt><dd>Assigned when a provider accepts</dd></div>
            <div><dt>Booked</dt><dd>With your society, on a set date</dd></div>
          </dl>
          <Link className="btn btn-primary btn-block" to="/new">Start a group</Link>
          <Link className="btn btn-secondary btn-block" to={`/groups?service=${service.slug}`}>See all {service.name.toLowerCase()} groups</Link>
        </aside>
      </div>
    </div>
  );
}
