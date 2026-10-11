import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useApi } from '../hooks.js';
import { useAuth } from '../auth.jsx';
import { useMeta } from '../meta.jsx';
import SocietyOptions from '../components/SocietyOptions.jsx';
import GroupRow, { GroupRowSkeleton } from '../components/GroupRow.jsx';
import { Empty, ErrorBox } from '../components/Common.jsx';
import { SearchIcon, ServiceIcon } from '../components/Icons.jsx';

export default function Groups() {
  const { user } = useAuth();
  const { services, societies, societyId, setSocietyId, society } = useMeta();
  const [params, setParams] = useSearchParams();
  const service = params.get('service') || '';
  const q = params.get('q') || '';
  const status = params.get('status') || '';
  const sort = params.get('sort') || 'soonest';

  const set = (key, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    setParams(next, { replace: true });
  };

  const query = new URLSearchParams();
  if (societyId) query.set('society_id', societyId);
  if (service) query.set('service', service);
  const { data, error, loading, reload } = useApi(`/groups?${query}`);

  const groups = useMemo(() => {
    const term = q.trim().toLowerCase();
    let list = (data?.groups || []).filter((g) => {
      if (status && g.state !== status) return false;
      if (term && ![g.service.name, g.society.name, g.host, g.description].join(' ').toLowerCase().includes(term)) return false;
      return true;
    });
    if (sort === 'saving') list = [...list].sort((a, b) => b.saving_pct - a.saving_pct);
    else if (sort === 'almost') list = [...list].sort((a, b) => (a.target - a.joined) - (b.target - b.joined));
    return list;
  }, [data, q, status, sort]);

  return (
    <div className="container section-pad">
      <div className="page-head">
        <h1>Groups</h1>
        <p className="muted">Join a group to unlock the group price. Joining is free.</p>
      </div>

      <form className="filter-bar" role="search" aria-label="Filter groups" onSubmit={(e) => e.preventDefault()}>
        <label className="search-field grow" htmlFor="g-q">
          <SearchIcon size={20} />
          <span className="sr">Search groups</span>
          <input id="g-q" type="search" value={q} onChange={(e) => set('q', e.target.value)} placeholder="Search by service, society or host" />
        </label>
        <label className="field-inline" htmlFor="g-soc">
          <span>Society</span>
          <select id="g-soc" value={societyId} onChange={(e) => setSocietyId(e.target.value)}>
            <option value="">All societies</option>
            <SocietyOptions societies={societies} />
          </select>
        </label>
        <label className="field-inline" htmlFor="g-status">
          <span>Status</span>
          <select id="g-status" value={status} onChange={(e) => set('status', e.target.value)}>
            <option value="">All</option>
            <option value="open">Still filling</option>
            <option value="unlocked">Price unlocked</option>
          </select>
        </label>
        <label className="field-inline" htmlFor="g-sort">
          <span>Sort by</span>
          <select id="g-sort" value={sort} onChange={(e) => set('sort', e.target.value === 'soonest' ? '' : e.target.value)}>
            <option value="soonest">Soonest date</option>
            <option value="saving">Biggest saving</option>
            <option value="almost">Almost full</option>
          </select>
        </label>
      </form>

      <div className="chips" role="group" aria-label="Filter by service">
        <button className={`chip${!service ? ' on' : ''}`} onClick={() => set('service', '')} aria-pressed={!service}>All services</button>
        {services.map((s) => (
          <button key={s.slug} className={`chip${service === s.slug ? ' on' : ''}`} onClick={() => set('service', s.slug)} aria-pressed={service === s.slug}>
            <ServiceIcon slug={s.slug} size={16} /> {s.name}
          </button>
        ))}
      </div>

      <ErrorBox error={error} retry={reload} />
      <p className="result-count" role="status">{data ? `${groups.length} ${groups.length === 1 ? 'group' : 'groups'}${society ? ` in ${society.name}` : ''}` : ''}</p>
      <div className="stack">
        {loading && [0, 1, 2].map((i) => <GroupRowSkeleton key={i} />)}
        {groups.map((g) => <GroupRow key={g.id} group={g} showSociety={!societyId} />)}
        {!loading && !error && !groups.length && (
          <Empty title="No groups match">
            <p className="muted">Nobody has started a group for these filters yet. Start one and share it with your neighbours.</p>
            <Link className="btn btn-primary" to={user ? '/new' : '/signup'}>Start a group</Link>
          </Empty>
        )}
      </div>
    </div>
  );
}
