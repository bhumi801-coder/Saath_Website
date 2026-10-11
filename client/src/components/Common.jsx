import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { AlertIcon } from './Icons.jsx';

export function Loading({ label = 'Loading' }) {
  return <div className="state" role="status"><span className="spinner" aria-hidden="true" />{label}</div>;
}

export function ErrorBox({ error, retry }) {
  if (!error) return null;
  return (
    <div className="alert alert-error" role="alert">
      <AlertIcon size={20} />
      <div>
        <p>{error.message || String(error)}</p>
        {retry && <button className="btn btn-secondary btn-sm" onClick={retry}>Try again</button>}
      </div>
    </div>
  );
}

export function Empty({ title, children }) {
  return (
    <div className="state empty">
      <h3>{title}</h3>
      {children}
    </div>
  );
}

// Pages for residents. A logged-in service partner or admin is told clearly, not shown a login form.
export function RequireAuth({ children }) {
  const { user, role, ready, logout } = useAuth();
  const loc = useLocation();
  if (!ready) return <Loading />;
  if (!user && (role === 'provider' || role === 'admin')) {
    return (
      <div className="container narrow section-pad">
        <Empty title="This page is for residents">
          <p className="muted">You are logged in as {role === 'provider' ? 'a service partner' : 'an administrator'}. Log out to use a resident account.</p>
          <div className="row-actions">
            <Link className="btn btn-primary" to={role === 'provider' ? '/partner' : '/admin'}>{role === 'provider' ? 'Partner dashboard' : 'Admin dashboard'}</Link>
            <button className="btn btn-secondary" onClick={logout}>Log out</button>
          </div>
        </Empty>
      </div>
    );
  }
  if (!user) {
    return (
      <div className="container narrow section-pad">
        <Empty title="Log in to continue">
          <p className="muted">You need a Saath account to do this.</p>
          <Link className="btn btn-primary" to="/login" state={{ from: loc.pathname }}>Log in</Link>
        </Empty>
      </div>
    );
  }
  return children;
}

// Pages for one non-resident role ('provider' or 'admin'). Everyone else sees a clear explanation,
// and the API refuses them regardless of what the browser shows.
export function RequireRole({ role: wanted, loginTo, children }) {
  const { role, ready, user, logout } = useAuth();
  if (!ready) return <Loading />;
  if (role === wanted) return children;
  const label = wanted === 'provider' ? 'service partners' : 'administrators';
  return (
    <div className="container narrow section-pad">
      <Empty title={`This page is for ${label}`}>
        <p className="muted">
          {user ? `You are logged in as a resident (${user.name.split(' ')[0]}). Log out to use a ${wanted === 'provider' ? 'service partner' : 'admin'} account.`
            : role ? 'You are logged in with a different type of account. Log out first.' : 'Log in to continue.'}
        </p>
        <div className="row-actions">
          {!role && <Link className="btn btn-primary" to={loginTo}>Log in</Link>}
          {role && <button className="btn btn-primary" onClick={logout}>Log out</button>}
        </div>
      </Empty>
    </div>
  );
}
