import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { useToast } from '../components/Toast.jsx';
import Progress from '../components/Progress.jsx';
import ServiceMedia from '../components/ServiceMedia.jsx';
import PayPanel from '../components/PayPanel.jsx';
import StatusPanel from '../components/Fulfilment.jsx';
import { AlertIcon, CalendarIcon, CheckIcon, ClockIcon, MinusIcon, PinIcon, PlusIcon, ShareIcon } from '../components/Icons.jsx';
import { ErrorBox } from '../components/Common.jsx';
import { longDate, plural, rupees, timeAgo } from '../format.js';

function Breakdown({ group: g, units, unlocked }) {
  const regular = units * g.regular_price;
  const total = units * g.group_price;
  return (
    <dl className="breakdown" aria-label="Price breakdown">
      <div><dt>{units} × {g.service.unit_label} at regular price</dt><dd><s>{rupees(regular)}</s></dd></div>
      <div><dt>{units} × {g.service.unit_label} at group price ({rupees(g.group_price)})</dt><dd>{rupees(total)}</dd></div>
      <div className="save-row"><dt>Group saving ({g.saving_pct}%)</dt><dd>− {rupees(regular - total)}</dd></div>
      <div className="total-row"><dt>{unlocked ? 'Total after service' : 'Total if the group unlocks'}</dt><dd>{rupees(total)}</dd></div>
    </dl>
  );
}

function BookingSummary({ group: g, onChange }) {
  const { user } = useAuth();
  const toast = useToast();
  const [units, setUnits] = useState(g.my_units || 1);
  const [note, setNote] = useState(g.my_note || '');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [confirmed, setConfirmed] = useState(null); // only set from a successful server response

  const unlocked = g.state === 'unlocked' || g.state === 'completed';
  const joinable = ['open', 'unlocked'].includes(g.state);
  const mine = g.my_units !== null;
  const sameSociety = user && user.society.id === g.society.id;
  useEffect(() => { if (g.my_units) setUnits(g.my_units); }, [g.my_units]);
  useEffect(() => { setNote(g.my_note || ''); }, [g.my_note]);
  const paid = g.my_payment?.status === 'paid';

  const join = async () => {
    setBusy(true); setError(null);
    try {
      const d = await api(`/groups/${g.id}/join`, { method: 'POST', body: { units, note, phone: user.phone ? undefined : phone } });
      setConfirmed({ units: d.group.my_units, unlockedNow: d.unlocked_now, state: d.group.state });
      onChange();
      toast(d.unlocked_now ? `Unlocked. Everyone now pays ${rupees(d.group.group_price)} per ${g.service.unit_label}.` : mine ? 'Your booking is updated.' : 'You are in. Share this group with your neighbours.');
    } catch (e) { setError(e); } finally { setBusy(false); }
  };

  const leave = async () => {
    setBusy(true); setError(null); setConfirmed(null);
    try {
      await api(`/groups/${g.id}/join`, { method: 'DELETE' });
      onChange();
      toast('You left the group.', 'info');
    } catch (e) { setError(e); } finally { setBusy(false); }
  };

  const share = async () => {
    const url = window.location.href;
    const text = `${g.joined} of ${g.target} flats have joined ${g.service.name} on ${longDate(g.scheduled_date)} (${g.time_slot_label}). Join and unlock ${rupees(g.group_price)} per ${g.service.unit_label}.`;
    try {
      if (navigator.share) await navigator.share({ title: 'Saath', text, url });
      else { await navigator.clipboard.writeText(`${text} ${url}`); toast('Link copied. Paste it in your society chat.'); }
    } catch { /* share sheet closed */ }
  };

  return (
    <aside className="card summary" aria-label="Booking summary">
      <h2>Booking summary</h2>

      <ol className="bk-steps">
        <li>
          <span className="bk-n">1</span>
          <div><p className="bk-label">Service</p><p><b>{g.service.name}</b></p><p className="muted small">{g.provider ? `Service partner: ${g.provider.name}` : 'Service partner: assigned when a provider accepts'}</p></div>
        </li>
        <li>
          <span className="bk-n">2</span>
          <div className="bk-grow">
            <p className="bk-label" id="units-label">Requirements</p>
            {joinable && user && sameSociety ? (
              <div className="stepper-row">
                <span>How many {g.service.unit_label}s?</span>
                <div className="stepper" role="group" aria-labelledby="units-label">
                  <button type="button" onClick={() => setUnits((u) => Math.max(1, u - 1))} aria-label={`Fewer ${g.service.unit_label}s`} disabled={units <= 1}><MinusIcon size={16} /></button>
                  <output aria-live="polite">{units}</output>
                  <button type="button" onClick={() => setUnits((u) => Math.min(6, u + 1))} aria-label={`More ${g.service.unit_label}s`} disabled={units >= 6}><PlusIcon size={16} /></button>
                </div>
              </div>
            ) : (
              <p>{mine ? plural(g.my_units, g.service.unit_label) : `Per ${g.service.unit_label}`}</p>
            )}
          </div>
        </li>
        <li>
          <span className="bk-n">3</span>
          <div>
            <p className="bk-label">Address</p>
            {user ? <p><PinIcon size={15} /> Flat {user.flat}, {user.society.name}, {user.society.area}, {user.society.city}</p>
              : <p className="muted">Your flat from your account</p>}
          </div>
        </li>
        <li>
          <span className="bk-n">4</span>
          <div>
            <p className="bk-label">Date</p>
            <p><CalendarIcon size={15} /> {longDate(g.scheduled_date)}</p>
          </div>
        </li>
        <li>
          <span className="bk-n">5</span>
          <div className="bk-grow">
            <p className="bk-label">Time slot</p>
            <p><ClockIcon size={15} /> {g.time_slot_label}</p>
            <p className="muted small">Once a service partner accepts, they arrive within this window and call you before reaching.</p>
          </div>
        </li>
      </ol>

      {joinable && user && sameSociety && (
        <div className="join-extra">
          {!user.phone && (
            <div className="field">
              <label htmlFor="j-phone">Mobile number</label>
              <input id="j-phone" inputMode="numeric" maxLength="10" placeholder="10 digits" value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))} />
            </div>
          )}
          <div className="field">
            <label htmlFor="j-note">Note for the team <span className="muted">(optional)</span></label>
            <input id="j-note" maxLength="200" placeholder="Parking bay, landmark, key with guard…" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>
      )}

      <Breakdown group={g} units={units} unlocked={unlocked} />

      <p className={`status-line${unlocked ? ' ok' : ''}`}>
        {unlocked ? <><CheckIcon size={16} /> Group price unlocked</>
          : g.state === 'open' ? `${plural(g.target - g.joined, 'more flat')} to unlock this price`
          : g.state === 'expired' ? 'This group did not reach its target'
          : g.state === 'cancelled' ? 'This group was cancelled'
          : g.service_status === 'completed' ? 'Service completed' : 'The service date has passed'}
      </p>

      {joinable && user && sameSociety && (
        <>
          <button className="btn btn-primary btn-block btn-lg" onClick={join} disabled={busy || paid || (mine && units === g.my_units && note === (g.my_note || ''))}>
            {busy ? 'Saving…' : mine ? 'Update my booking' : 'Join group'}
          </button>
          {mine && (
            <div className="alert alert-success" role="status">
              <CheckIcon size={20} />
              <div>
                <p><b>{confirmed ? 'You have joined this group' : 'You have joined'}</b></p>
                <p>Flat {user.flat} is in with {plural(g.my_units, g.service.unit_label)}. {unlocked ? (g.provider_status === 'accepted' || g.provider_status === 'completed' ? 'The group price is unlocked and a service partner has accepted.' : 'The group price is unlocked. Your service date is confirmed once a service partner accepts.') : `Waiting for ${plural(g.target - g.joined, 'more flat')}.`}</p>
                {!g.is_host && !paid && <button className="linklike" onClick={leave} disabled={busy}>Leave group</button>}
              </div>
            </div>
          )}
        </>
      )}
      {mine && user && <PayPanel group={g} units={g.my_units} onPaid={onChange} />}
      {joinable && !user && <Link className="btn btn-primary btn-block btn-lg" to="/login" state={{ from: `/groups/${g.id}` }}>Log in to join</Link>}
      {joinable && user && !sameSociety && (
        <div className="alert alert-info"><AlertIcon size={20} /><p>This group is for residents of {g.society.name}. Your account is registered with {user.society.name}. <Link to="/new">Start a group in your society</Link>.</p></div>
      )}

      <button className="btn btn-secondary btn-block" onClick={share}><ShareIcon size={18} /> Share with neighbours</button>
      <ErrorBox error={error} />
      <p className="muted small">Nothing is charged to join. If the target is not reached by the service date, the group does not go ahead and you pay nothing.</p>
    </aside>
  );
}

function Comments({ group, comments, onAdd }) {
  const { user } = useAuth();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const canPost = user && user.society.id === group.society.id;

  const submit = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true); setError(null);
    try {
      const d = await api(`/groups/${group.id}/comments`, { method: 'POST', body: { body: text } });
      onAdd(d.comment); setText('');
    } catch (err) { setError(err); } finally { setBusy(false); }
  };

  return (
    <section className="block" aria-labelledby="comments-h">
      <h2 id="comments-h">Comments</h2>
      {!comments.length && <p className="muted">No comments yet. Ask the host a question or tell your block to join.</p>}
      <ul className="comments">
        {comments.map((c) => (
          <li key={c.id}>
            <span className="avatar" aria-hidden="true">{c.name[0]}</span>
            <div>
              <p><b>{c.name}</b> <span className="muted small">Block {c.block} · {timeAgo(c.created_at)}</span></p>
              <p>{c.body}</p>
            </div>
          </li>
        ))}
      </ul>
      {canPost ? (
        <form className="comment-form" onSubmit={submit}>
          <label className="sr" htmlFor="c-body">Write a comment</label>
          <input id="c-body" value={text} onChange={(e) => setText(e.target.value)} placeholder="Write a comment" maxLength={300} />
          <button className="btn btn-primary" disabled={busy || !text.trim()}>Post</button>
        </form>
      ) : (
        <p className="muted">{user ? 'Only residents of this society can comment.' : <><Link to="/login" state={{ from: `/groups/${group.id}` }}>Log in</Link> to comment.</>}</p>
      )}
      <ErrorBox error={error} />
    </section>
  );
}

export default function GroupDetail() {
  const { id } = useParams();
  const { user, ready } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    setError(null);
    return api(`/groups/${id}`).then(setData).catch(setError);
  }, [id]);
  useEffect(() => { if (ready) { setData(null); load(); } }, [ready, load, user?.id]);

  if (error) return <div className="container section-pad"><ErrorBox error={error} retry={load} /></div>;
  if (!data) return <div className="container section-pad"><div className="detail-grid"><div className="skel skel-block" /><div className="skel skel-block" /></div></div>;

  const { group: g, members, comments } = data;
  const unlocked = g.state === 'unlocked' || g.state === 'completed';

  const cancel = async () => {
    if (!window.confirm('Cancel this group for everyone who joined?')) return;
    try { await api(`/groups/${g.id}`, { method: 'DELETE' }); toast('Group cancelled.', 'info'); navigate('/groups'); }
    catch (e) { toast(e.message, 'error'); }
  };

  return (
    <div className="container section-pad">
      <p className="crumbs"><Link to="/groups">Groups</Link> / {g.service.name}</p>
      <div className="detail-grid">
        <div>
          <ServiceMedia service={{ slug: g.service.slug, name: g.service.name }} iconSize={56} className="media-hero short" />
          <h1 className="mt">{g.service.name}</h1>
          <p className="lead-sm">
            {longDate(g.scheduled_date)}, {g.time_slot_label}, at {g.society.name}, {g.society.area}, {g.society.city}. Started by {g.host}.
          </p>

          <div className="card progress-card">
            <div className="pc-top">
              <p><strong>{g.joined}</strong> of {g.target} flats joined</p>
              <span className={`pill${unlocked ? ' pill-ok' : ''}`}>{unlocked ? 'Price unlocked' : `${plural(Math.max(0, g.target - g.joined), 'more flat')} to unlock`}</span>
            </div>
            <Progress joined={g.joined} target={g.target} />
            <p className="muted small">{plural(g.total_units, g.service.unit_label)} booked in total. Group price {rupees(g.group_price)} per {g.service.unit_label} instead of {rupees(g.regular_price)}.</p>
          </div>

          <StatusPanel group={g} />

          {g.description && <p className="desc">{g.description}</p>}

          <section className="block" aria-labelledby="inc-h">
            <h2 id="inc-h">What is included</h2>
            <ul className="ticks">{g.service.includes.map((i) => <li key={i}><CheckIcon size={18} /> {i}</li>)}</ul>
          </section>

          <section className="block" aria-labelledby="mem-h">
            <h2 id="mem-h">Who has joined</h2>
            <ul className="members">
              {members.map((m, i) => <li key={i}>{m.name}, block {m.block}<span>{plural(m.units, g.service.unit_label)}</span></li>)}
            </ul>
          </section>

          <Comments group={g} comments={comments} onAdd={(c) => setData((d) => ({ ...d, comments: [...d.comments, c] }))} />

          {g.is_host && ['open', 'unlocked'].includes(g.state) && (
            <p className="host-zone muted">You started this group. <button className="linklike danger" onClick={cancel}>Cancel group</button></p>
          )}
        </div>

        <div className="sticky-col"><BookingSummary group={g} onChange={load} /></div>
      </div>
    </div>
  );
}
