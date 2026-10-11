import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { useMeta } from '../meta.jsx';
import { useToast } from '../components/Toast.jsx';
import { ErrorBox } from '../components/Common.jsx';
import { addDaysISO, rupees, toISO } from '../format.js';


export default function NewGroup() {
  const { user } = useAuth();
  const { services, timeSlots, minDate, maxDate, error: metaError, reload } = useMeta();
  // "today" comes from the server in India time, so the date check never drifts.
  const tomorrow = addDaysISO(minDate || toISO(new Date()), 1);
  const latest = maxDate || addDaysISO(tomorrow, 59);
  const navigate = useNavigate();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [errors, setErrors] = useState({});
  const [form, setForm] = useState({ service_id: '', scheduled_date: '', time_slot: '', target: 20, group_price: '', description: '' });
  const service = services.find((s) => String(s.id) === String(form.service_id));
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const pick = (e) => {
    const s = services.find((x) => String(x.id) === e.target.value);
    setForm((f) => ({ ...f, service_id: e.target.value, group_price: s ? Math.round((s.regular_price * 0.67) / 10) * 10 - 1 : '' }));
  };

  const validate = () => {
    const e = {};
    const target = Number(form.target), price = Number(form.group_price);
    if (!service) e.service_id = 'Choose a service.';
    if (!form.scheduled_date) e.scheduled_date = 'Pick a service date.';
    else if (form.scheduled_date < tomorrow) e.scheduled_date = 'The date must be after today.';
    else if (form.scheduled_date > latest) e.scheduled_date = 'Pick a date within the next 60 days.';
    if (!form.time_slot) e.time_slot = 'Choose when the team should arrive.';
    if (!Number.isInteger(target) || target < 5 || target > 200) e.target = 'Enter a whole number between 5 and 200.';
    if (!form.group_price) e.group_price = 'Enter the group price.';
    else if (service && (!Number.isInteger(price) || price < 50 || price >= service.regular_price)) e.group_price = `Must be below the regular price of ${rupees(service.regular_price)}.`;
    setErrors(e);
    return !Object.keys(e).length;
  };

  const submit = async (ev) => {
    ev.preventDefault();
    if (!validate()) return;
    setBusy(true); setError(null);
    try {
      const d = await api('/groups', { method: 'POST', body: { ...form, service_id: Number(form.service_id), target: Number(form.target), group_price: Number(form.group_price) } });
      toast('Group started. Share it with your neighbours.');
      navigate(`/groups/${d.id}`);
    } catch (err) { setError(err); setBusy(false); }
  };

  const saving = service && form.group_price && Number(form.group_price) < service.regular_price
    ? Math.round(((service.regular_price - form.group_price) / service.regular_price) * 100) : null;
  const fe = (k) => errors[k] && <p className="field-error" id={`${k}-err`} role="alert">{errors[k]}</p>;
  const aria = (k) => ({ 'aria-invalid': !!errors[k], 'aria-describedby': errors[k] ? `${k}-err` : undefined });

  return (
    <div className="container narrow section-pad">
      <h1>Start a group</h1>
      <p className="muted">For {user.society.name}. You join automatically as the host with flat {user.flat}.</p>
      <ErrorBox error={metaError} retry={reload} />

      <form className="card form-card" onSubmit={submit} noValidate>
        <div className="field">
          <label htmlFor="f-service">Service</label>
          <select id="f-service" value={form.service_id} onChange={pick} {...aria('service_id')}>
            <option value="" disabled>Choose a service</option>
            {services.map((s) => <option key={s.id} value={s.id}>{s.name} (regular {rupees(s.regular_price)} per {s.unit_label})</option>)}
          </select>
          {fe('service_id')}
        </div>

        <div className="two">
          <div className="field">
            <label htmlFor="f-date">Service date</label>
            <input id="f-date" type="date" min={tomorrow} max={latest} value={form.scheduled_date} onChange={set('scheduled_date')} {...aria('scheduled_date')} />
            {fe('scheduled_date')}
          </div>
          <div className="field">
            <label htmlFor="f-slot">Arrival time slot</label>
            <select id="f-slot" value={form.time_slot} onChange={set('time_slot')} {...aria('time_slot')}>
              <option value="" disabled>Choose a time slot</option>
              {timeSlots.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select>
            {fe('time_slot')}
          </div>
        </div>

        <div className="field">
          <label htmlFor="f-target">Flats needed to unlock</label>
          <input id="f-target" type="number" inputMode="numeric" value={form.target} onChange={set('target')} {...aria('target')} />
          {fe('target')}
        </div>

        <div className="field">
          <label htmlFor="f-price">Group price per {service?.unit_label || 'unit'} (₹)</label>
          <input id="f-price" type="number" inputMode="numeric" value={form.group_price} onChange={set('group_price')} {...aria('group_price')} />
          {saving ? <p className="hint">Neighbours save {saving}% compared with {rupees(service.regular_price)}.</p> : null}
          {fe('group_price')}
        </div>

        <div className="field">
          <label htmlFor="f-desc">Note for neighbours <span className="muted">(optional)</span></label>
          <textarea id="f-desc" rows="3" maxLength="400" value={form.description} onChange={set('description')} placeholder="Where the work happens, what time the team arrives, anything to prepare." />
        </div>

        <ErrorBox error={error} />
        <button className="btn btn-primary btn-lg" disabled={busy}>{busy ? 'Starting…' : 'Start group'}</button>
      </form>
    </div>
  );
}
