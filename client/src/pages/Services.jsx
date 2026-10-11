import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useApi } from '../hooks.js';
import { useMeta } from '../meta.jsx';
import ServiceCard, { ServiceCardSkeleton } from '../components/ServiceCard.jsx';
import { Empty, ErrorBox } from '../components/Common.jsx';
import { SearchIcon } from '../components/Icons.jsx';
import { rupees } from '../format.js';

const PRICES = [1000, 2000, 4000];

export default function Services() {
  const { services, society, societyId, error: metaError, reload } = useMeta();
  const [params, setParams] = useSearchParams();
  const q = params.get('q') || '';
  const max = Number(params.get('max')) || 0;
  const avail = params.get('open') === '1';
  const sort = params.get('sort') || 'popular';

  const { data, error } = useApi(`/groups${societyId ? `?society_id=${societyId}` : ''}`);
  const live = useMemo(() => (data?.groups || []).filter((g) => ['open', 'unlocked'].includes(g.state)), [data]);

  const set = (key, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    setParams(next, { replace: true });
  };

  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    const count = (s) => live.filter((g) => g.service.slug === s.slug).length;
    let list = services.filter((s) => {
      if (term && ![s.name, s.tagline, ...s.includes].join(' ').toLowerCase().includes(term)) return false;
      if (max && s.regular_price > max) return false;
      if (avail && !count(s)) return false;
      return true;
    });
    if (sort === 'price-asc') list = [...list].sort((a, b) => a.regular_price - b.regular_price);
    else if (sort === 'price-desc') list = [...list].sort((a, b) => b.regular_price - a.regular_price);
    else if (sort === 'name') list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    else list = [...list].sort((a, b) => count(b) - count(a));
    return list;
  }, [services, live, q, max, avail, sort]);

  const filtered = q || max || avail;

  return (
    <div className="container section-pad">
      <div className="page-head">
        <h1>Services</h1>
        <p className="muted">{society ? `Showing group availability for ${society.name}.` : 'Showing group availability across all societies.'} Change the society from the menu at the top.</p>
      </div>

      <form className="filter-bar" role="search" aria-label="Filter services" onSubmit={(e) => e.preventDefault()}>
        <label className="search-field grow" htmlFor="svc-q">
          <SearchIcon size={20} />
          <span className="sr">Search services</span>
          <input id="svc-q" type="search" value={q} onChange={(e) => set('q', e.target.value)} placeholder="Search by service, for example AC or sofa" />
        </label>
        <label className="field-inline" htmlFor="svc-price">
          <span>Price</span>
          <select id="svc-price" value={max || ''} onChange={(e) => set('max', e.target.value)}>
            <option value="">Any price</option>
            {PRICES.map((p) => <option key={p} value={p}>Up to {rupees(p)}</option>)}
          </select>
        </label>
        <label className="field-inline" htmlFor="svc-sort">
          <span>Sort by</span>
          <select id="svc-sort" value={sort} onChange={(e) => set('sort', e.target.value === 'popular' ? '' : e.target.value)}>
            <option value="popular">Most open groups</option>
            <option value="price-asc">Price: low to high</option>
            <option value="price-desc">Price: high to low</option>
            <option value="name">Name</option>
          </select>
        </label>
        <label className="check" htmlFor="svc-open">
          <input id="svc-open" type="checkbox" checked={avail} onChange={(e) => set('open', e.target.checked ? '1' : '')} />
          <span>Has an open group</span>
        </label>
      </form>

      <ErrorBox error={metaError || error} retry={reload} />
      <p className="result-count" role="status">
        {services.length ? `${results.length} of ${services.length} services` : ''}
        {filtered && <> · <button className="linklike" onClick={() => setParams({}, { replace: true })}>Clear filters</button></>}
      </p>

      <div className="grid-3">
        {!services.length && !metaError && Array.from({ length: 6 }, (_, i) => <ServiceCardSkeleton key={i} />)}
        {results.map((s) => <ServiceCard key={s.slug} service={s} liveGroups={live.filter((g) => g.service.slug === s.slug)} />)}
      </div>
      {services.length > 0 && !results.length && (
        <Empty title="No services match your search">
          <p className="muted">Try a different word or clear the filters.</p>
          <button className="btn btn-primary" onClick={() => setParams({}, { replace: true })}>Clear filters</button>
        </Empty>
      )}
      <p className="muted small">Prices are the regular price per unit. Group prices apply once a group reaches its target. <Link to="/groups">See all groups</Link></p>
    </div>
  );
}
