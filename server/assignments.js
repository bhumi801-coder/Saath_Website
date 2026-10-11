// Provider assignment logic. Everything that decides who may do what to a job lives here, so the
// rules are enforced in one place on the server and never rely on the browser.
//
// A "job" is a group (one society, one service, one date). Group unlocking stays derived from the
// member count exactly as before (see stateOf in index.js). This module adds a separate layer:
//
//   group unlocked --(a provider accepts)--> provider assigned --(provider finishes)--> completed
//
// Only `provider_assignments` records who holds a job. Its UNIQUE(group_id) constraint means two
// providers can never hold the same job, even if both press Accept at the same instant.
import { db } from './db.js';

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
const fail = (status, message) => { throw new HttpError(status, message); };

// Run `fn` in a write transaction that takes the database write lock up front (BEGIN IMMEDIATE),
// so the "is it still free?" check and the insert cannot be interleaved with another writer.
const inTx = (fn) => (...args) => db.transaction(fn).immediate(...args);

export const groupRef = (id) => `SG-${String(id).padStart(5, '0')}`;

const JOB_COLS = `
  g.id, g.service_id, g.society_id, g.description, g.scheduled_date, g.time_slot, g.target, g.group_price, g.cancelled,
  s.slug AS service_slug, s.name AS service_name, s.unit_label,
  so.name AS society_name, so.area AS society_area, so.city AS society_city,
  (SELECT COUNT(*) FROM memberships m WHERE m.group_id = g.id) AS joined,
  (SELECT COALESCE(SUM(units),0) FROM memberships m WHERE m.group_id = g.id) AS total_units`;
const JOB_FROM = `
  FROM groups g
  JOIN services s   ON s.id  = g.service_id
  JOIN societies so ON so.id = g.society_id`;

const isUnlocked = (g) => !g.cancelled && g.joined >= g.target;

export function providerCoverage(providerId) {
  const services = db.prepare(
    `SELECT s.id, s.slug, s.name FROM provider_services ps JOIN services s ON s.id = ps.service_id
     WHERE ps.provider_id = ? ORDER BY s.id`).all(providerId);
  const areas = db.prepare('SELECT city FROM provider_areas WHERE provider_id = ? ORDER BY city').all(providerId).map((r) => r.city);
  return { services, areas };
}

const eligible = (providerId, g) => Boolean(db.prepare(
  `SELECT 1 FROM provider_services ps JOIN provider_areas pa ON pa.provider_id = ps.provider_id
   WHERE ps.provider_id = ? AND ps.service_id = ? AND pa.city = ?`).get(providerId, g.service_id, g.society_city));

const hasDeclined = (providerId, groupId) => Boolean(db.prepare(
  `SELECT 1 FROM provider_job_events WHERE group_id = ? AND provider_id = ? AND action IN ('rejected','withdrawn')`).get(groupId, providerId));

const logEvent = (groupId, providerId, action, note = '') =>
  db.prepare('INSERT INTO provider_job_events (group_id, provider_id, action, note) VALUES (?,?,?,?)').run(groupId, providerId, action, note);

function shapeJob(g, status, extra = {}) {
  return {
    group_id: g.id,
    reference: groupRef(g.id),
    status,
    service: { slug: g.service_slug, name: g.service_name, unit_label: g.unit_label },
    society: { name: g.society_name, area: g.society_area, city: g.society_city },
    scheduled_date: g.scheduled_date,
    time_slot: g.time_slot,
    flats: g.joined,
    target: g.target,
    total_units: g.total_units,
    group_price: g.group_price,
    total_amount: g.total_units * g.group_price,
    description: g.description,
    ...extra,
  };
}

// Contact details of the residents. Only ever returned to the provider who holds the job, and only
// while it is still to be done (the phone numbers are given to residents' service partner for the visit).
function customersOf(g) {
  return db.prepare(
    `SELECT u.name, u.flat, u.phone, m.units, m.note, m.payment_status
     FROM memberships m JOIN users u ON u.id = m.user_id WHERE m.group_id = ? ORDER BY m.id`).all(g.id)
    .map((m) => ({
      name: m.name, flat: m.flat, phone: m.phone, units: m.units, note: m.note,
      payment_status: m.payment_status,
      amount_due: m.payment_status === 'paid' ? 0 : m.units * g.group_price, // for pay-after-service collection
    }));
}

// ---- what a provider sees ---------------------------------------------------------------------
export function listJobs(providerId, today) {
  const available = db.prepare(
    `SELECT ${JOB_COLS} ${JOB_FROM}
     WHERE g.cancelled = 0 AND g.scheduled_date >= ?
       AND g.service_id IN (SELECT service_id FROM provider_services WHERE provider_id = ?)
       AND so.city IN (SELECT city FROM provider_areas WHERE provider_id = ?)
       AND NOT EXISTS (SELECT 1 FROM provider_assignments a WHERE a.group_id = g.id)
       AND NOT EXISTS (SELECT 1 FROM provider_job_events e WHERE e.group_id = g.id AND e.provider_id = ? AND e.action IN ('rejected','withdrawn'))
     ORDER BY g.scheduled_date ASC, g.id ASC`).all(today, providerId, providerId, providerId)
    .filter(isUnlocked)
    .map((g) => shapeJob(g, 'available'));

  const mine = db.prepare(
    `SELECT ${JOB_COLS}, a.status AS a_status, a.accepted_at, a.completed_at, a.cancelled_at
     ${JOB_FROM} JOIN provider_assignments a ON a.group_id = g.id
     WHERE a.provider_id = ? ORDER BY g.scheduled_date ASC, g.id ASC`).all(providerId);

  const upcoming = [], completed = [], cancelled = [];
  for (const g of mine) {
    const extra = { accepted_at: g.accepted_at, completed_at: g.completed_at, cancelled_at: g.cancelled_at };
    if (g.a_status === 'accepted') upcoming.push(shapeJob(g, 'accepted', { ...extra, overdue: g.scheduled_date < today, customers: customersOf(g) }));
    else if (g.a_status === 'completed') completed.push(shapeJob(g, 'completed', extra));
    else cancelled.push(shapeJob(g, 'cancelled', extra));
  }
  completed.reverse(); cancelled.reverse(); // newest first
  return { available, upcoming, completed: completed.slice(0, 50), cancelled: cancelled.slice(0, 50) };
}

// Unlocked, still-unassigned jobs for the provider's services in cities they do NOT cover yet.
// Shown as a hint ("1 job in Noida") so a partner knows why their list is empty.
export function jobsOutsideAreas(providerId, today) {
  const rows = db.prepare(
    `SELECT ${JOB_COLS} ${JOB_FROM}
     WHERE g.cancelled = 0 AND g.scheduled_date >= ?
       AND g.service_id IN (SELECT service_id FROM provider_services WHERE provider_id = ?)
       AND so.city NOT IN (SELECT city FROM provider_areas WHERE provider_id = ?)
       AND NOT EXISTS (SELECT 1 FROM provider_assignments a WHERE a.group_id = g.id)`).all(today, providerId, providerId)
    .filter(isUnlocked);
  const byCity = new Map();
  for (const g of rows) byCity.set(g.society_city, (byCity.get(g.society_city) || 0) + 1);
  return [...byCity.entries()].map(([city, count]) => ({ city, count })).sort((a, b) => b.count - a.count);
}

// ---- transitions (all validated here, all atomic) ---------------------------------------------
function loadActiveProvider(providerId) {
  const p = db.prepare('SELECT * FROM providers WHERE id = ?').get(providerId);
  if (!p) fail(401, 'Your session expired. Log in again.');
  if (p.status !== 'active') {
    fail(403, p.status === 'pending'
      ? 'Your partner account is waiting for approval. You can accept jobs once it is approved.'
      : 'Your partner account is suspended. Contact Saath support.');
  }
  return p;
}

function loadJobFor(providerId, groupId) {
  const g = db.prepare(`SELECT ${JOB_COLS} ${JOB_FROM} WHERE g.id = ?`).get(groupId);
  if (!g || !eligible(providerId, g)) fail(404, 'This job is not available to you.');
  return g;
}

// available -> accepted
export const acceptJob = inTx((providerId, groupId, today) => {
  loadActiveProvider(providerId);
  const g = loadJobFor(providerId, groupId);
  const held = db.prepare('SELECT provider_id, status FROM provider_assignments WHERE group_id = ?').get(groupId);
  if (held) {
    if (held.provider_id === providerId) fail(409, 'You have already taken this job.');
    fail(409, 'Another service partner has already accepted this job.');
  }
  if (g.cancelled) fail(409, 'This group was cancelled.');
  if (!isUnlocked(g)) fail(409, 'This group has not unlocked yet, so it cannot be accepted.');
  if (g.scheduled_date < today) fail(409, 'The service date for this group has already passed.');
  if (hasDeclined(providerId, groupId)) fail(409, 'You declined this job earlier, so it cannot be accepted by you now.');
  try {
    db.prepare(`INSERT INTO provider_assignments (group_id, provider_id, status) VALUES (?,?, 'accepted')`).run(groupId, providerId);
  } catch (e) {
    // Backstop: UNIQUE(group_id) fired because another writer got there first.
    if (String(e.code || '').startsWith('SQLITE_CONSTRAINT')) fail(409, 'Another service partner has already accepted this job.');
    throw e;
  }
  logEvent(groupId, providerId, 'accepted');
  return { ok: true };
});

// available -> (hidden from this provider, stays available for everyone else)
export const rejectJob = inTx((providerId, groupId, today, note = '') => {
  loadActiveProvider(providerId);
  const g = loadJobFor(providerId, groupId);
  if (db.prepare('SELECT 1 FROM provider_assignments WHERE group_id = ?').get(groupId)) fail(409, 'This job has already been accepted, so it cannot be declined.');
  if (!isUnlocked(g) || g.scheduled_date < today) fail(409, 'This job is no longer open.');
  if (hasDeclined(providerId, groupId)) fail(409, 'You have already declined this job.');
  logEvent(groupId, providerId, 'rejected', note);
  return { ok: true };
});

// accepted -> available again (the provider cannot make it)
export const withdrawJob = inTx((providerId, groupId, note = '') => {
  loadActiveProvider(providerId);
  const a = db.prepare('SELECT * FROM provider_assignments WHERE group_id = ?').get(groupId);
  if (!a || a.provider_id !== providerId) fail(404, 'You do not have this job.');
  if (a.status !== 'accepted') fail(409, `A ${a.status} job cannot be given back.`);
  db.prepare('DELETE FROM provider_assignments WHERE id = ?').run(a.id);
  logEvent(groupId, providerId, 'withdrawn', note);
  return { ok: true };
});

// accepted -> completed
export const completeJob = inTx((providerId, groupId, today, { allowEarly = false } = {}) => {
  loadActiveProvider(providerId);
  const a = db.prepare('SELECT * FROM provider_assignments WHERE group_id = ?').get(groupId);
  if (!a || a.provider_id !== providerId) fail(404, 'You do not have this job.');
  if (a.status === 'completed') fail(409, 'This job is already marked as completed.');
  if (a.status !== 'accepted') fail(409, 'This job was cancelled.');
  const g = db.prepare(`SELECT ${JOB_COLS} ${JOB_FROM} WHERE g.id = ?`).get(groupId);
  if (g.cancelled) fail(409, 'This group was cancelled.');
  if (!allowEarly && g.scheduled_date > today) fail(409, 'You can mark a job as completed on the service date or after it.');
  db.prepare(`UPDATE provider_assignments SET status = 'completed', completed_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`).run(a.id);
  logEvent(groupId, providerId, 'completed');
  return { ok: true };
});

// Called inside the host's "cancel group" transaction.
export function cancelAssignmentForGroup(groupId) {
  const a = db.prepare(`SELECT * FROM provider_assignments WHERE group_id = ? AND status = 'accepted'`).get(groupId);
  if (!a) return;
  db.prepare(`UPDATE provider_assignments SET status = 'cancelled', cancelled_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`).run(a.id);
  logEvent(groupId, a.provider_id, 'cancelled', 'Group cancelled by the host');
}

// Admin: take a job back from a provider (unreliable, suspended, asked by phone...). accepted -> available.
export const releaseJob = inTx((groupId, note = '') => {
  const a = db.prepare('SELECT * FROM provider_assignments WHERE group_id = ?').get(groupId);
  if (!a) fail(404, 'No provider holds this job.');
  if (a.status !== 'accepted') fail(409, `A ${a.status} job cannot be released.`);
  db.prepare('DELETE FROM provider_assignments WHERE id = ?').run(a.id);
  logEvent(groupId, a.provider_id, 'released', note || 'Released by an administrator');
  return { ok: true };
});

// ---- what a customer sees ---------------------------------------------------------------------
export function assignmentOf(groupId) {
  return db.prepare(
    `SELECT a.status, a.accepted_at, a.completed_at, p.name AS provider_name, p.phone AS provider_phone, p.is_demo AS provider_is_demo
     FROM provider_assignments a JOIN providers p ON p.id = a.provider_id WHERE a.group_id = ?`).get(groupId);
}

// Group unlocking, provider acceptance and service completion are three separate facts.
// `g` needs: cancelled, joined, target, scheduled_date.
export function fulfilmentOf(g, a, today) {
  if (g.cancelled || a?.status === 'cancelled') return { provider_status: 'cancelled', service_status: 'cancelled' };
  if (a?.status === 'completed') return { provider_status: 'completed', service_status: 'completed' };
  if (a?.status === 'accepted') return { provider_status: 'accepted', service_status: 'confirmed' };
  const past = g.scheduled_date < today;
  if (g.joined >= g.target) {
    return past ? { provider_status: 'missed', service_status: 'not_fulfilled' }
      : { provider_status: 'awaiting', service_status: 'pending' };
  }
  return { provider_status: 'not_open', service_status: past ? 'expired' : 'pending' };
}

// Name and phone of the provider, for residents who belong to the group only.
export function providerForCustomer(a) {
  if (!a || !['accepted', 'completed'].includes(a.status)) return null;
  return { name: a.provider_name, phone: a.provider_phone, is_demo: Boolean(a.provider_is_demo), accepted_at: a.accepted_at };
}

// True when a booking was marked paid through the demo checkout (no real money moved).
export const paidViaDemo = (m) => m.payment_status === 'paid' && Boolean(db.prepare(
  `SELECT 1 FROM payments WHERE membership_id = ? AND provider = 'demo' AND status = 'paid'`).get(m.id));

// Payment label for the customer. Never influenced by provider acceptance.
export function paymentDisplay(m) {
  if (m.payment_status === 'paid') return 'paid';
  if (m.payment_status === 'refund_due') return 'refund_due';
  if (m.payment_status === 'refunded') return 'refunded';
  const open = db.prepare(
    `SELECT 1 FROM payments WHERE membership_id = ? AND status = 'created' AND created_at > datetime('now','-30 minutes')`).get(m.id);
  return open ? 'pending' : 'unpaid';
}
