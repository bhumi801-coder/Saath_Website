import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApi } from '../hooks.js';
import { useAuth } from '../auth.jsx';
import { useMeta } from '../meta.jsx';
import SocietyOptions from '../components/SocietyOptions.jsx';
import HeroBurst from '../components/HeroBurst.jsx';
import { ServiceCardSkeleton } from '../components/ServiceCard.jsx';
import CinemaScenes from '../components/CinemaScenes.jsx';
import GroupRow, { GroupRowSkeleton } from '../components/GroupRow.jsx';
import Progress from '../components/Progress.jsx';
import { ErrorBox } from '../components/Common.jsx';
import { ArrowRightIcon, CalendarIcon, CheckIcon, PinIcon, ReceiptIcon, SearchIcon, TagIcon, UsersIcon } from '../components/Icons.jsx';
import { plural, rupees, whenLabel } from '../format.js';

const STEPS = [
  [SearchIcon, 'Choose a service', 'Pick AC repair, car wash, sofa cleaning or any other service your society is booking.'],
  [UsersIcon, 'Select your requirements', 'Say how many ACs, cars or sofa sets you have. Your flat joins the group in one tap.'],
  [CheckIcon, 'Confirm your booking', 'The group price unlocks once enough flats join. Your date is confirmed when a service partner accepts the group.'],
  [CalendarIcon, 'Get your service done', 'The service partner who accepted your group visits your society on the group date.'],
];

const BENEFITS = [
  [ReceiptIcon, 'Transparent pricing', 'See the regular price and the group price side by side, with a full breakdown before you join.'],
  [UsersIcon, 'Better prices with neighbours', 'The more flats in your society join a group, the sooner everyone gets the group price.'],
  [CalendarIcon, 'Convenient booking', 'Join a group in a few taps and track every booking in one place.'],
  [CheckIcon, 'No payment to join', 'Joining a group does not charge you. If the target is not reached, the group simply does not go ahead.'],
];

const TRUST = [
  [ReceiptIcon, 'Transparent', 'pricing'],
  [UsersIcon, 'Group', 'prices'],
  [TagIcon, 'No payment', 'to join'],
  [CalendarIcon, 'Easy', 'booking'],
];

export default function Home() {
  const { user } = useAuth();
  const { services, societies, societyId, setSocietyId, society, error: metaError, reload } = useMeta();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const { data, error, loading } = useApi(`/groups${societyId ? `?society_id=${societyId}` : ''}`);

  const live = (data?.groups || []).filter((g) => ['open', 'unlocked'].includes(g.state));
  const forService = (slug) => live.filter((g) => g.service.slug === slug);
  const featured = live.find((g) => g.state === 'open') || live[0];
  const bestSaving = [...live].sort((a, b) => b.saving_pct - a.saving_pct)[0];
  const where = society ? society.name : 'all societies';

  const search = (e) => {
    e.preventDefault();
    navigate(`/services${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''}`);
  };

  return (
    <>
      <section className="hero">
        <div className="hero-bg" aria-hidden="true" />
        <HeroBurst service={services[0]} />
        <div className="container hero-inner">
          <div className="hero-grid">
            <div className="hero-copy">
              <span className="hero-badge"><i className="dot" aria-hidden="true" /> All home services, one platform</span>
              <h1>
                <span className="h1-line">Book Trusted</span>{' '}
                <em>Home Services</em>{' '}
                <span className="h1-line">At Your Fingertips</span>
              </h1>
              <p className="lead">From AC Repair to Car Wash, Sofa Cleaning to Pest Control, get everything you need — quickly, easily, reliably. Join your neighbours to unlock a group price.</p>

              <div className="hero-cta">
                <Link className="btn btn-primary btn-lg" to="/groups">Book a Service <ArrowRightIcon size={18} /></Link>
                <Link className="btn btn-ghost btn-lg" to="/services">Explore Services <ArrowRightIcon size={18} /></Link>
              </div>

              <ul className="trust" aria-label="Why Saath">
                {TRUST.map(([Icon, a, b]) => (
                  <li key={a}><span className="t-ic"><Icon size={20} /></span><div><b>{a}</b><span className="s">{b}</span></div></li>
                ))}
              </ul>

              <form className="search-card" onSubmit={search} role="search" aria-label="Find a service">
                <label className="search-field" htmlFor="hero-q">
                  <SearchIcon size={20} />
                  <span className="sr">Search services</span>
                  <input id="hero-q" list="service-names" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search a service" autoComplete="off" />
                  <datalist id="service-names">{services.map((s) => <option key={s.slug} value={s.name} />)}</datalist>
                </label>
                <label className="search-field search-where" htmlFor="hero-society">
                  <PinIcon size={18} />
                  <span className="sr">Your society</span>
                  <select id="hero-society" value={societyId} onChange={(e) => setSocietyId(e.target.value)}>
                    <option value="">All societies</option>
                    <SocietyOptions societies={societies} />
                  </select>
                </label>
                <button className="btn btn-secondary" type="submit">Search</button>
              </form>
              <div className="hero-links">
                <Link className="link-cta" to="/#how">How It Works <ArrowRightIcon size={16} /></Link>
                {!user && <span className="muted">Demo login: demo@saath.in / demo1234</span>}
              </div>
            </div>

            <div className="hero-aside">
              {featured && (
                <Link to={`/groups/${featured.id}`} className="live-card">
                  <span className="live-dot" aria-hidden="true" />
                  <div>
                    <p className="live-title">{featured.service.name} · {whenLabel(featured.scheduled_date)}</p>
                    <Progress joined={featured.joined} target={featured.target} />
                    <p className="live-sub">
                      {featured.joined} of {featured.target} flats joined ·{' '}
                      {featured.state === 'unlocked' ? `unlocked at ${rupees(featured.group_price)}` : `unlocks at ${rupees(featured.group_price)}`}
                    </p>
                  </div>
                </Link>
              )}
            </div>
          </div>

          {services.length > 0 && (
            <ul className="stat-strip" aria-label="Saath at a glance">
              <li><span className="st-ic"><TagIcon size={20} /></span><div><strong>{services.length}</strong><span>Services you can book</span></div></li>
              <li><span className="st-ic"><PinIcon size={20} /></span><div><strong>{societies.length}</strong><span>Societies in Uttar Pradesh</span></div></li>
              <li><span className="st-ic"><UsersIcon size={20} /></span><div><strong>{loading ? '–' : live.length}</strong><span>Groups open right now</span></div></li>
              {bestSaving && <li><span className="st-ic"><ReceiptIcon size={20} /></span><div><strong>Up to {bestSaving.saving_pct}%</strong><span>Saved with group prices</span></div></li>}
            </ul>
          )}
        </div>
      </section>

      <section className="section reveal" aria-labelledby="pop-h">
        <div className="container">
          <div className="section-head">
            <div>
              <h2 id="pop-h">Popular services</h2>
              <p className="muted">Group prices shown for {where}.</p>
            </div>
            <Link to="/services" className="link-cta">View all services <ArrowRightIcon size={16} /></Link>
          </div>
          <ErrorBox error={metaError} retry={reload} />
          {!services.length && !metaError && (
            <div className="grid-3">{Array.from({ length: 6 }, (_, i) => <ServiceCardSkeleton key={i} />)}</div>
          )}
          {services.length > 0 && <CinemaScenes services={services} groupsFor={forService} />}
        </div>
      </section>

      <section className="section section-white reveal" aria-labelledby="open-h">
        <div className="container">
          <div className="section-head">
            <div>
              <h2 id="open-h">{society ? `Open in ${society.name}` : 'Groups open right now'}</h2>
              <p className="muted">Join a group before it fills up.</p>
            </div>
            <Link to="/groups" className="link-cta">See all groups <ArrowRightIcon size={16} /></Link>
          </div>
          <ErrorBox error={error} />
          <div className="stack">
            {loading && [0, 1, 2].map((i) => <GroupRowSkeleton key={i} />)}
            {live.slice(0, 4).map((g) => <GroupRow key={g.id} group={g} showSociety={!society} />)}
            {!loading && !error && !live.length && (
              <div className="state empty">
                <h3>No open groups here yet</h3>
                <p className="muted">Be the first to start one and invite your neighbours.</p>
                <Link className="btn btn-primary" to="/new">Start a group</Link>
              </div>
            )}
          </div>
        </div>
      </section>

      {bestSaving && (
        <section className="section-tight" aria-label="Current savings">
          <div className="container">
            <div className="promo">
              <div className="promo-icon"><TagIcon size={28} /></div>
              <div className="promo-text">
                <h2>Save up to {bestSaving.saving_pct}% with your neighbours</h2>
                <p>
                  {bestSaving.service.name} is {rupees(bestSaving.group_price)} per {bestSaving.service.unit_label} instead of {rupees(bestSaving.regular_price)} once{' '}
                  {plural(Math.max(0, bestSaving.target - bestSaving.joined), 'more flat')} join{bestSaving.target - bestSaving.joined === 1 ? 's' : ''} at {bestSaving.society.name}.
                </p>
              </div>
              <Link className="btn btn-light" to={`/groups/${bestSaving.id}`}>Join this group</Link>
            </div>
          </div>
        </section>
      )}

      <section className="section reveal" aria-labelledby="why-h">
        <div className="container">
          <h2 id="why-h">Why book with Saath</h2>
          <ul className="grid-4 features">
            {BENEFITS.map(([Icon, title, text]) => (
              <li key={title} className="card feature">
                <span className="feature-icon"><Icon size={22} /></span>
                <h3>{title}</h3>
                <p className="muted">{text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="section section-white reveal" id="how" aria-labelledby="how-h">
        <div className="container">
          <h2 id="how-h">How it works</h2>
          <ol className="grid-4 steps">
            {STEPS.map(([Icon, title, text], i) => (
              <li key={title}>
                <span className="step-icon"><Icon size={24} /><b>{i + 1}</b></span>
                <h3>{title}</h3>
                <p className="muted">{text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </>
  );
}
