import { Suspense, useEffect, useId, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { useMeta } from '../meta.jsx';
import { CloseIcon, MenuIcon, PinIcon } from './Icons.jsx';
import SocietyOptions from './SocietyOptions.jsx';
import PartnerAlerts from './PartnerAlerts.jsx';
import ChatWidget from './ChatWidget.jsx';

export function Logo({ light = false }) {
  const gid = useId();
  return (
    <Link to="/" className={`logo${light ? ' logo-light' : ''}`} aria-label="Saath, home">
      <svg width="34" height="34" viewBox="0 0 32 32" aria-hidden="true">
        <defs>
          <linearGradient id={gid} x1="4" y1="2" x2="28" y2="30" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#E7C48C" /><stop offset="1" stopColor="#B07A47" />
          </linearGradient>
        </defs>
        <path d="M22.5 8.8C20.7 6.9 18.3 6 15.6 6 11.6 6 9 8 9 10.9c0 2.6 2 3.8 6.1 4.7 3.5.8 4.5 1.4 4.5 2.7 0 1.4-1.6 2.3-3.9 2.3-2 0-3.8-.7-5.3-2" fill="none" stroke={`url(#${gid})`} strokeWidth="3.4" strokeLinecap="round" />
        <path d="M9.5 23.3c1.8 1.6 4.1 2.5 6.8 2.5 3.4 0 6.2-1.6 6.2-4.6" fill="none" stroke={`url(#${gid})`} strokeWidth="3.4" strokeLinecap="round" opacity=".75" />
      </svg>
      <span className="logo-text"><b>Saath</b><small>Har Service, Ek Saath</small></span>
    </Link>
  );
}

function LocationSelect({ id }) {
  const { societies, societyId, setSocietyId } = useMeta();
  return (
    <label className="location" htmlFor={id}>
      <PinIcon size={18} />
      <span className="sr">Society</span>
      <select id={id} value={societyId} onChange={(e) => setSocietyId(e.target.value)}>
        <option value="">All societies</option>
        <SocietyOptions societies={societies} />
      </select>
    </label>
  );
}

export default function Layout() {
  const { user, provider, admin, logout } = useAuth();
  const { services } = useMeta();
  const [open, setOpen] = useState(false);
  const { pathname, hash } = useLocation();
  const navigate = useNavigate();
  const menuBtn = useRef(null);

  useEffect(() => {
    setOpen(false);
    if (hash) {
      const t = setTimeout(() => document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth' }), 60);
      return () => clearTimeout(t);
    }
    window.scrollTo(0, 0);
    return undefined;
  }, [pathname, hash]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') { setOpen(false); menuBtn.current?.focus(); } };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      <a className="skip" href="#main">Skip to content</a>
      <header className="site-header">
        <div className="container bar">
          <Logo />
          <button ref={menuBtn} className="icon-btn menu-btn" aria-expanded={open} aria-controls="site-nav" aria-label={open ? 'Close menu' : 'Open menu'} onClick={() => setOpen((o) => !o)}>
            {open ? <CloseIcon size={24} /> : <MenuIcon size={24} />}
          </button>
          <nav id="site-nav" className={open ? 'open' : ''} aria-label="Main">
            {provider ? (
              <>
                {/* Service partners get their own navigation, with no resident links to mix up. */}
                <NavLink to="/partner" end>Partner dashboard</NavLink>
                <span className="nav-gap" />
                <div className="account">
                  <span className="role-tag">Service partner</span>
                  <span className="who" title={provider.name}>{provider.name.split(' ')[0]}</span>
                  <button className="btn btn-secondary btn-sm" onClick={() => { logout(); navigate('/partner/login'); }}>Log out</button>
                </div>
              </>
            ) : admin ? (
              <>
                <NavLink to="/admin" end>Admin</NavLink>
                <span className="nav-gap" />
                <div className="account">
                  <span className="role-tag">Admin</span>
                  <span className="who" title={admin.email}>{admin.name.split(' ')[0]}</span>
                  <button className="btn btn-secondary btn-sm" onClick={() => { logout(); navigate('/admin/login'); }}>Log out</button>
                </div>
              </>
            ) : (
              <>
                <NavLink to="/" end>Home</NavLink>
                <NavLink to="/services">Services</NavLink>
                <NavLink to="/groups">Groups</NavLink>
                <Link to="/#how">How it works</Link>
                {user && <NavLink to="/bookings">My bookings</NavLink>}
                {!user && <NavLink to="/partner" className="nav-partner">For partners</NavLink>}
                <span className="nav-gap" />
                <LocationSelect id="nav-location" />
                {user ? (
                  <div className="account">
                    <span className="who" title={`${user.name}, ${user.flat}, ${user.society.name}`}>{user.name.split(' ')[0]}</span>
                    <button className="btn btn-secondary btn-sm" onClick={() => { logout(); navigate('/'); }}>Log out</button>
                  </div>
                ) : (
                  <div className="account">
                    <Link className="btn btn-secondary btn-sm" to="/login">Log in</Link>
                    <Link className="btn btn-primary btn-sm" to="/signup">Sign up</Link>
                  </div>
                )}
              </>
            )}
          </nav>
        </div>
      </header>

      {provider && <PartnerAlerts />}

      <main id="main"><Suspense fallback={null}><Outlet /></Suspense></main>

      <footer className="site-footer">
        <div className="container foot">
          <div className="foot-brand">
            <Logo light />
            <p>Book home and car services together with your neighbours and unlock a group price.</p>
          </div>
          <div>
            <h2>Services</h2>
            <ul>
              {services.map((s) => <li key={s.slug}><Link to={`/services/${s.slug}`}>{s.name}</Link></li>)}
            </ul>
          </div>
          <div>
            <h2>Explore</h2>
            <ul>
              <li><Link to="/">Home</Link></li>
              <li><Link to="/services">All services</Link></li>
              <li><Link to="/groups">Open groups</Link></li>
              <li><Link to="/#how">How it works</Link></li>
              <li><Link to="/policies">Terms, privacy and refunds</Link></li>
              <li>{user ? <Link to="/bookings">My bookings</Link> : <Link to="/login">Log in</Link>}</li>
              <li><Link to="/partner">For service partners</Link></li>
            </ul>
          </div>
        </div>
        <div className="container legal">
          <p>© {new Date().getFullYear()} Saath. Group home and car services for housing societies in Uttar Pradesh. <Link to="/policies">Terms, privacy and refunds</Link></p>
        </div>
      </footer>
      <ChatWidget />
    </>
  );
}
