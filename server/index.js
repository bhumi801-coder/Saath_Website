import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { db } from './db.js';
import { seedIfEmpty } from './seed.js';
import { UP_CITIES } from './data/up-societies.js';
import { todayIST, addDays, isRealDate } from './dates.js';
import {
  assignmentOf, fulfilmentOf, providerForCustomer, paymentDisplay, paidViaDemo, cancelAssignmentForGroup,
} from './assignments.js';
import { registerProviderRoutes, publicProvider, publicAdmin } from './providers.js';
import { registerPasswordReset } from './password-reset.js';
import { warnIfNotConfigured } from './notify.js';
import { registerChat } from './chat.js';
import * as events from './events.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 4000;
const PROD = process.env.NODE_ENV === 'production';

const JWT_SECRET = process.env.JWT_SECRET || 'saath-dev-secret-change-me';
if (!process.env.JWT_SECRET) {
  if (PROD) { console.error('[saath] JWT_SECRET is required in production. Exiting.'); process.exit(1); }
  console.warn('[saath] JWT_SECRET not set, using a dev secret. Set it before deploying.');
}

// ---- payments config -----------------------------------------------------------
const RZP_KEY_ID = process.env.RAZORPAY_KEY_ID || '';
const RZP_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || '';
const RZP_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || '';
const RAZORPAY_ON = Boolean(RZP_KEY_ID && RZP_KEY_SECRET);
// Fake "demo" checkout is only available when no real keys exist AND we are not in production
// (or the owner explicitly allows it). It must never be reachable on a live site.
const DEMO_PAYMENTS = !RAZORPAY_ON && (!PROD || process.env.ALLOW_DEMO_PAYMENTS === '1');
const payMode = RAZORPAY_ON ? 'razorpay' : DEMO_PAYMENTS ? 'demo' : 'off';

// ---- service partner (provider) settings -----------------------------------------------------
// Like demo payments, these default to "demo friendly" outside production and to "real world safe" in it.
//  - demoProviders: partner accounts made here are flagged as test accounts, and customers see a
//    "Demo partner" tag, so a test acceptance is never mistaken for a real booking.
//  - autoApprove:   new partners can accept jobs immediately. In production they start as "pending"
//    until an administrator approves them, because accepting a job reveals residents' phone numbers.
//  - earlyComplete: lets a partner mark a job done before its service date (so you can demo the whole
//    flow today). In production a job can only be completed on or after its service date.
const envFlag = (name, fallback) => (process.env[name] === undefined || process.env[name] === '' ? fallback : process.env[name] === '1');
const partnerFlags = {
  demo: envFlag('ALLOW_DEMO_PROVIDERS', !PROD),
  autoApprove: envFlag('PROVIDER_AUTO_APPROVE', !PROD),
  earlyComplete: envFlag('ALLOW_EARLY_COMPLETE', !PROD),
};

// ---- time slots (arrival windows) ----------------------------------------------
export const TIME_SLOTS = [
  { key: '6-9', label: '6 AM to 9 AM' },
  { key: '9-12', label: '9 AM to 12 noon' },
  { key: '12-3', label: '12 noon to 3 PM' },
  { key: '3-6', label: '3 PM to 6 PM' },
  { key: '6-8', label: '6 PM to 8 PM' },
];
const slotLabel = (k) => TIME_SLOTS.find((s) => s.key === k)?.label || 'Time to be confirmed';

seedIfEmpty();
events.configureEvents({ slotLabel });
warnIfNotConfigured();

const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(cors());
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});
app.use(express.json({ limit: '50kb', verify: (req, _res, buf) => { req.rawBody = buf; } }));

// ---------- helpers ---------------------------------------------------------
const today = todayIST;
const bad = (res, msg, code = 400) => res.status(code).json({ error: msg });
const clean = (v, max = 200) => String(v ?? '').trim().replace(/\s+/g, ' ').slice(0, max);

// tiny in-memory rate limiter
const hits = new Map();
function limit(max, windowMs) {
  return (req, res, next) => {
    const key = req.ip + req.path;
    const now = Date.now();
    const arr = (hits.get(key) || []).filter((t) => now - t < windowMs);
    if (arr.length >= max) return bad(res, 'Too many attempts. Try again in a few minutes.', 429);
    arr.push(now);
    hits.set(key, arr);
    next();
  };
}
setInterval(() => { const now = Date.now(); for (const [k, v] of hits) if (v.every((t) => now - t > 3_600_000)) hits.delete(k); }, 600_000).unref();

// Tokens carry a role. Tokens issued before roles existed have no role and are customer tokens.
const signToken = (role, id, expiresIn = '14d') => {
  // `pv` = the account's password version. A password reset raises it, which invalidates older tokens.
  const pv = role === 'admin' ? 0 : (db.prepare(`SELECT pw_version FROM ${ACCOUNT_TABLE[role]} WHERE id = ?`).get(id)?.pw_version || 0);
  return jwt.sign({ id, role, pv }, JWT_SECRET, { expiresIn });
};

const ACCOUNT_TABLE = { customer: 'users', provider: 'providers', admin: 'admins' };
const REQ_KEY = { customer: 'user', provider: 'provider', admin: 'admin' };
const WRONG_ROLE = {
  customer: 'This is a resident action. Log out of your partner or admin account and log in as a resident.',
  provider: 'This area is for Saath service partners only.',
  admin: 'This area is for administrators only.',
};

// auth(required, role): the token must belong to `role`. Existing routes keep calling auth() and
// auth(false), which means "a customer", so a provider or admin token never works on customer routes.
function auth(required = true, role = 'customer') {
  return (req, res, next) => {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return required ? bad(res, 'Log in to continue.', 401) : next();
    let payload;
    try { payload = jwt.verify(token, JWT_SECRET); } catch {
      return required ? bad(res, 'Your session expired. Log in again.', 401) : next();
    }
    if ((payload.role || 'customer') !== role) return required ? bad(res, WRONG_ROLE[role], 403) : next();
    const account = db.prepare(`SELECT * FROM ${ACCOUNT_TABLE[role]} WHERE id = ?`).get(payload.id);
    if (!account) return required ? bad(res, 'Your session expired. Log in again.', 401) : next();
    // A password reset logs out every session that was started before it.
    if ((payload.pv || 0) !== (account.pw_version || 0)) return required ? bad(res, 'Your password was changed. Log in again.', 401) : next();
    req[REQ_KEY[role]] = account;
    next();
  };
}

const publicUser = (u) => {
  const s = db.prepare('SELECT id, name, area, city FROM societies WHERE id = ?').get(u.society_id);
  return { id: u.id, name: u.name, email: u.email, phone: u.phone, flat: u.flat, society: s };
};
const firstName = (n) => n.split(' ')[0];

// A group's state is derived from its data, never stored.
function stateOf(g, joined) {
  if (g.cancelled) return 'cancelled';
  const past = g.scheduled_date < today();
  if (joined >= g.target) return past ? 'completed' : 'unlocked';
  return past ? 'expired' : 'open';
}

const GROUP_SELECT = `
  SELECT g.*, s.slug AS service_slug, s.name AS service_name, s.unit_label, s.partner,
         s.regular_price, s.includes, s.tagline,
         so.name AS society_name, so.area AS society_area, so.city AS society_city, so.flats AS society_flats,
         u.name AS host_name,
         (SELECT COUNT(*) FROM memberships m WHERE m.group_id = g.id) AS joined,
         (SELECT COALESCE(SUM(units),0) FROM memberships m WHERE m.group_id = g.id) AS total_units
  FROM groups g
  JOIN services s   ON s.id = g.service_id
  JOIN societies so ON so.id = g.society_id
  JOIN users u      ON u.id = g.created_by
`;

function shapeGroup(g, userId) {
  const mine = userId
    ? db.prepare('SELECT id, units, note, payment_method, payment_status, amount_paid FROM memberships WHERE group_id = ? AND user_id = ?').get(g.id, userId)
    : null;
  const state = stateOf(g, g.joined);
  // Provider fields. Everyone sees the status; only residents who joined see who the provider is.
  const assignment = assignmentOf(g.id);
  const fulfilment = fulfilmentOf(g, assignment, today());
  return {
    id: g.id,
    state,
    service: { slug: g.service_slug, name: g.service_name, tagline: g.tagline, unit_label: g.unit_label,
      partner: g.partner, includes: JSON.parse(g.includes) },
    society: { id: g.society_id, name: g.society_name, area: g.society_area, city: g.society_city, flats: g.society_flats },
    description: g.description,
    scheduled_date: g.scheduled_date,
    time_slot: g.time_slot,
    time_slot_label: slotLabel(g.time_slot),
    target: g.target,
    joined: g.joined,
    total_units: g.total_units,
    regular_price: g.regular_price,
    group_price: g.group_price,
    saving_pct: Math.round(((g.regular_price - g.group_price) / g.regular_price) * 100),
    host: firstName(g.host_name),
    is_host: userId === g.created_by,
    my_units: mine ? mine.units : null,
    my_note: mine ? mine.note : '',
    my_payment: mine ? { method: mine.payment_method, status: mine.payment_status, amount_paid: mine.amount_paid, display: paymentDisplay(mine), demo: paidViaDemo(mine) } : null,
    provider_status: fulfilment.provider_status,   // not_open | awaiting | accepted | completed | cancelled | missed
    service_status: fulfilment.service_status,     // pending | confirmed | completed | cancelled | not_fulfilled | expired
    completed_at: assignment?.status === 'completed' ? assignment.completed_at : null,
    provider: mine ? providerForCustomer(assignment) : null,
    created_at: g.created_at,
  };
}

// ---------- meta ------------------------------------------------------------
app.get('/api/meta', (_req, res) => {
  const societies = db.prepare('SELECT id, name, area, city, state, flats FROM societies ORDER BY city, name').all();
  const services = db.prepare('SELECT * FROM services ORDER BY id').all()
    .map((s) => ({ ...s, includes: JSON.parse(s.includes) }));
  res.json({
    societies, services,
    time_slots: TIME_SLOTS,
    cities: UP_CITIES,
    payments: { mode: payMode, key_id: RAZORPAY_ON ? RZP_KEY_ID : null },
    partners: { demo: partnerFlags.demo, auto_approve: partnerFlags.autoApprove },
    today: today(), max_date: addDays(today(), 60),
  });
});

// Residents can add their own society if it is missing from the list.
app.post('/api/societies', limit(15, 60 * 60_000), (req, res) => {
  const name = clean(req.body.name, 100);
  const area = clean(req.body.area, 80);
  const city = clean(req.body.city, 60);
  if (name.length < 3) return bad(res, 'Enter the society name (at least 3 letters).');
  if (area.length < 2) return bad(res, 'Enter the area or sector, for example Sector 74.');
  if (city.length < 2) return bad(res, 'Choose or enter the city.');
  const existing = db.prepare('SELECT * FROM societies WHERE lower(name) = lower(?) AND lower(city) = lower(?) AND lower(area) = lower(?)').get(name, city, area);
  if (existing) return res.json({ society: existing, existed: true });
  const info = db.prepare('INSERT INTO societies (name, area, city, state, flats, added_by_resident) VALUES (?,?,?,?,0,1)').run(name, area, city, 'Uttar Pradesh');
  const society = db.prepare('SELECT id, name, area, city, state, flats FROM societies WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ society, existed: false });
});

// ---------- auth ------------------------------------------------------------
app.post('/api/auth/register', limit(10, 10 * 60_000), (req, res) => {
  const name = clean(req.body.name, 80);
  const email = clean(req.body.email, 120).toLowerCase();
  const password = String(req.body.password ?? '');
  const flat = clean(req.body.flat, 20);
  const phone = clean(req.body.phone, 15);
  const society_id = Number(req.body.society_id);

  if (name.length < 2) return bad(res, 'Enter your full name.');
  if (!/^\S+@\S+\.\S+$/.test(email)) return bad(res, 'Enter a valid email address.');
  if (password.length < 6) return bad(res, 'Password must be at least 6 characters.');
  if (!flat) return bad(res, 'Enter your flat number, for example B-402.');
  if (!/^[6-9]\d{9}$/.test(phone)) return bad(res, 'Enter a valid 10-digit mobile number. The service team calls on this number.');
  if (!db.prepare('SELECT 1 FROM societies WHERE id = ?').get(society_id)) return bad(res, 'Choose your society.');
  if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) return bad(res, 'This email already has an account. Log in instead.', 409);

  const info = db.prepare(
    'INSERT INTO users (name, email, password_hash, phone, society_id, flat) VALUES (?,?,?,?,?,?)'
  ).run(name, email, bcrypt.hashSync(password, 10), phone, society_id, flat);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ token: signToken('customer', user.id), user: publicUser(user) });
});

app.post('/api/auth/login', limit(20, 10 * 60_000), (req, res) => {
  const email = clean(req.body.email, 120).toLowerCase();
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !bcrypt.compareSync(String(req.body.password ?? ''), user.password_hash)) {
    return bad(res, 'Email or password is incorrect.', 401);
  }
  res.json({ token: signToken('customer', user.id), user: publicUser(user) });
});

app.get('/api/auth/me', auth(), (req, res) => res.json({ user: publicUser(req.user) }));

// ---------- groups ----------------------------------------------------------
app.get('/api/groups', auth(false), (req, res) => {
  const where = ['g.cancelled = 0'];
  const params = [];
  if (req.query.society_id) { where.push('g.society_id = ?'); params.push(Number(req.query.society_id)); }
  if (req.query.city) { where.push('so.city = ?'); params.push(clean(req.query.city, 60)); }
  if (req.query.service) { where.push('s.slug = ?'); params.push(clean(req.query.service, 40)); }
  const rows = db.prepare(`${GROUP_SELECT} WHERE ${where.join(' AND ')} ORDER BY g.scheduled_date ASC, g.id DESC`).all(...params);
  const groups = rows.map((g) => shapeGroup(g, req.user?.id)).filter((g) => g.state !== 'expired');
  if (req.query.state) return res.json({ groups: groups.filter((g) => g.state === req.query.state) });
  res.json({ groups });
});

app.get('/api/groups/:id', auth(false), (req, res) => {
  const row = db.prepare(`${GROUP_SELECT} WHERE g.id = ?`).get(Number(req.params.id));
  if (!row) return bad(res, 'This group does not exist.', 404);
  const group = shapeGroup(row, req.user?.id);

  // Neighbours see first names and flat blocks only, never full flat numbers.
  const members = db.prepare(`
    SELECT u.name, u.flat, m.units, m.created_at FROM memberships m
    JOIN users u ON u.id = m.user_id WHERE m.group_id = ? ORDER BY m.id ASC`).all(row.id)
    .map((m) => ({ name: firstName(m.name), block: m.flat.split('-')[0], units: m.units, joined_at: m.created_at }));
  const comments = db.prepare(`
    SELECT c.id, c.body, c.created_at, u.name, u.flat FROM comments c
    JOIN users u ON u.id = c.user_id WHERE c.group_id = ? ORDER BY c.id ASC`).all(row.id)
    .map((c) => ({ id: c.id, body: c.body, created_at: c.created_at, name: c.name, block: c.flat.split('-')[0] }));
  res.json({ group, members, comments });
});

app.post('/api/groups', auth(), (req, res) => {
  const service = db.prepare('SELECT * FROM services WHERE id = ?').get(Number(req.body.service_id));
  if (!service) return bad(res, 'Choose a service.');
  const target = Number(req.body.target);
  const group_price = Number(req.body.group_price);
  const date = clean(req.body.scheduled_date, 10);
  const slot = clean(req.body.time_slot, 10);
  if (!isRealDate(date)) return bad(res, 'Pick a valid service date.');
  if (date <= today()) return bad(res, 'Pick a service date after today.');
  if (date > addDays(today(), 60)) return bad(res, 'Pick a date within the next 60 days.');
  if (!TIME_SLOTS.some((s) => s.key === slot)) return bad(res, 'Choose a time slot for the visit.');
  if (!Number.isInteger(target) || target < 5 || target > 200) return bad(res, 'Flats needed must be between 5 and 200.');
  if (!Number.isInteger(group_price) || group_price < 50 || group_price >= service.regular_price) {
    return bad(res, `Group price must be below the regular price of ₹${service.regular_price}.`);
  }
  const dup = db.prepare(`SELECT 1 FROM groups WHERE society_id = ? AND service_id = ? AND scheduled_date = ? AND cancelled = 0`)
    .get(req.user.society_id, service.id, date);
  if (dup) return bad(res, 'Your society already has a group for this service on that date. Join it instead.', 409);

  const create = db.transaction(() => {
    const info = db.prepare(`INSERT INTO groups (society_id, service_id, description, scheduled_date, time_slot, target, group_price, created_by)
      VALUES (?,?,?,?,?,?,?,?)`).run(req.user.society_id, service.id, clean(req.body.description, 400), date, slot, target, group_price, req.user.id);
    db.prepare('INSERT INTO memberships (group_id, user_id, units) VALUES (?,?,1)').run(info.lastInsertRowid, req.user.id);
    return info.lastInsertRowid;
  });
  res.status(201).json({ id: create() });
});

app.delete('/api/groups/:id', auth(), (req, res) => {
  const g = db.prepare('SELECT * FROM groups WHERE id = ?').get(Number(req.params.id));
  if (!g) return bad(res, 'This group does not exist.', 404);
  if (g.created_by !== req.user.id) return bad(res, 'Only the host can cancel this group.', 403);
  db.transaction(() => {
    db.prepare('UPDATE groups SET cancelled = 1 WHERE id = ?').run(g.id);
    // anyone who already paid online is owed a refund
    db.prepare(`UPDATE memberships SET payment_status = 'refund_due' WHERE group_id = ? AND payment_status = 'paid'`).run(g.id);
    cancelAssignmentForGroup(g.id); // a provider who had accepted sees the job as cancelled
  })();
  events.groupCancelled(g.id); // tell the partner who held the job and the other residents
  res.json({ ok: true });
});

app.post('/api/groups/:id/join', auth(), (req, res) => {
  const row = db.prepare(`${GROUP_SELECT} WHERE g.id = ?`).get(Number(req.params.id));
  if (!row) return bad(res, 'This group does not exist.', 404);
  const before = stateOf(row, row.joined);
  if (!['open', 'unlocked'].includes(before)) return bad(res, 'This group is closed.', 409);
  if (row.society_id !== req.user.society_id) return bad(res, `This group is only for residents of ${row.society_name}.`, 403);
  const units = Math.min(Math.max(parseInt(req.body.units, 10) || 1, 1), 6);
  const note = clean(req.body.note, 200);

  const existing = db.prepare('SELECT * FROM memberships WHERE group_id = ? AND user_id = ?').get(row.id, req.user.id);
  if (existing?.payment_status === 'paid' && existing.units !== units) {
    return bad(res, 'You have already paid online for this booking, so the quantity cannot be changed. Contact support to change it.', 409);
  }

  const phone = clean(req.body.phone, 15);
  if (!req.user.phone) {
    if (!/^[6-9]\d{9}$/.test(phone)) return bad(res, 'Add a 10-digit mobile number so the service team can reach you.');
    db.prepare('UPDATE users SET phone = ? WHERE id = ?').run(phone, req.user.id);
  }

  db.prepare(`INSERT INTO memberships (group_id, user_id, units, note) VALUES (?,?,?,?)
    ON CONFLICT(group_id, user_id) DO UPDATE SET units = excluded.units, note = excluded.note`).run(row.id, req.user.id, units, note);

  const after = db.prepare(`${GROUP_SELECT} WHERE g.id = ?`).get(row.id);
  const group = shapeGroup(after, req.user.id);
  const unlockedNow = before === 'open' && group.state === 'unlocked';
  // Alerts go out after the join is saved. They never delay or break the join itself.
  if (unlockedNow) events.groupUnlocked(row.id);                 // tell every matching partner and the residents
  else if (!existing) events.residentJoined(row.id, req.user.id); // tell the partner who already holds this job
  res.json({ group, unlocked_now: unlockedNow });
});

app.delete('/api/groups/:id/join', auth(), (req, res) => {
  const row = db.prepare(`${GROUP_SELECT} WHERE g.id = ?`).get(Number(req.params.id));
  if (!row) return bad(res, 'This group does not exist.', 404);
  if (row.created_by === req.user.id) return bad(res, 'You are the host. Cancel the group instead of leaving it.', 409);
  if (row.scheduled_date <= today()) return bad(res, 'You cannot leave a group on or after the service date.', 409);
  const m = db.prepare('SELECT payment_status FROM memberships WHERE group_id = ? AND user_id = ?').get(row.id, req.user.id);
  // Once a partner has accepted, do not let the group silently fall below its target.
  if (row.joined - 1 < row.target && assignmentOf(row.id)?.status === 'accepted') {
    return bad(res, 'A service partner has already accepted this group. Leaving now would drop it below its target. Contact support to change your booking.', 409);
  }
  if (m?.payment_status === 'paid') return bad(res, 'You have paid online for this booking. Contact support to cancel and get a refund.', 409);
  db.prepare('DELETE FROM memberships WHERE group_id = ? AND user_id = ?').run(row.id, req.user.id);
  const after = db.prepare(`${GROUP_SELECT} WHERE g.id = ?`).get(row.id);
  res.json({ group: shapeGroup(after, req.user.id) });
});

app.post('/api/groups/:id/comments', auth(), (req, res) => {
  const g = db.prepare('SELECT * FROM groups WHERE id = ?').get(Number(req.params.id));
  if (!g) return bad(res, 'This group does not exist.', 404);
  if (g.society_id !== req.user.society_id) return bad(res, 'Only residents of this society can comment.', 403);
  const body = clean(req.body.body, 300);
  if (!body) return bad(res, 'Write a comment first.');
  const info = db.prepare('INSERT INTO comments (group_id, user_id, body) VALUES (?,?,?)').run(g.id, req.user.id, body);
  res.status(201).json({
    comment: { id: info.lastInsertRowid, body, created_at: new Date().toISOString(), name: req.user.name, block: req.user.flat.split('-')[0] },
  });
});

// ---------- payments --------------------------------------------------------
// Online payment opens only once the group price is unlocked, so the amount is final.
// "Pay after service" (UPI/cash to the partner) is always available.
function markPaid(orderId, paymentId) {
  const p = db.prepare('SELECT * FROM payments WHERE provider_order_id = ?').get(orderId);
  if (!p) return false;
  if (p.status === 'paid') return true;
  db.transaction(() => {
    db.prepare(`UPDATE payments SET status = 'paid', provider_payment_id = ?, paid_at = datetime('now') WHERE id = ?`).run(paymentId, p.id);
    db.prepare(`UPDATE memberships SET payment_method = 'online', payment_status = 'paid', amount_paid = ?, paid_at = datetime('now') WHERE id = ?`).run(p.amount, p.membership_id);
  })();
  return true;
}

app.post('/api/groups/:id/pay-method', auth(), (req, res) => {
  const method = req.body.method === 'online' ? 'online' : 'on_service';
  const m = db.prepare('SELECT * FROM memberships WHERE group_id = ? AND user_id = ?').get(Number(req.params.id), req.user.id);
  if (!m) return bad(res, 'Join the group first.', 404);
  if (m.payment_status === 'paid') return bad(res, 'This booking is already paid.', 409);
  db.prepare('UPDATE memberships SET payment_method = ? WHERE id = ?').run(method, m.id);
  res.json({ ok: true, method });
});

app.post('/api/payments/order', auth(), limit(20, 10 * 60_000), async (req, res) => {
  if (payMode === 'off') return bad(res, 'Online payment is not switched on yet. Choose pay after service.', 503);
  const groupId = Number(req.body.group_id);
  const row = db.prepare(`${GROUP_SELECT} WHERE g.id = ?`).get(groupId);
  if (!row) return bad(res, 'This group does not exist.', 404);
  const m = db.prepare('SELECT * FROM memberships WHERE group_id = ? AND user_id = ?').get(groupId, req.user.id);
  if (!m) return bad(res, 'Join the group before paying.', 404);
  if (m.payment_status === 'paid') return bad(res, 'This booking is already paid.', 409);
  if (stateOf(row, row.joined) !== 'unlocked') return bad(res, 'You can pay online once the group price is unlocked.', 409);

  const amount = m.units * row.group_price; // rupees, always computed on the server
  try {
    let orderId;
    if (payMode === 'razorpay') {
      const r = await fetch('https://api.razorpay.com/v1/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${Buffer.from(`${RZP_KEY_ID}:${RZP_KEY_SECRET}`).toString('base64')}`,
        },
        body: JSON.stringify({ amount: amount * 100, currency: 'INR', receipt: `saath_${m.id}_${Date.now()}`, notes: { group_id: String(groupId), user_id: String(req.user.id) } }),
      });
      const data = await r.json();
      if (!r.ok) { console.error('[razorpay]', data); return bad(res, 'Payment provider is not reachable right now. Try again, or choose pay after service.', 502); }
      orderId = data.id;
    } else {
      orderId = `demo_${crypto.randomBytes(8).toString('hex')}`;
    }
    db.prepare('INSERT INTO payments (membership_id, user_id, provider, provider_order_id, amount) VALUES (?,?,?,?,?)')
      .run(m.id, req.user.id, payMode, orderId, amount);
    res.json({
      mode: payMode, order_id: orderId, amount, currency: 'INR', key_id: RAZORPAY_ON ? RZP_KEY_ID : null,
      name: 'Saath', description: `${row.service_name} on ${row.scheduled_date}`,
      prefill: { name: req.user.name, email: req.user.email, contact: req.user.phone || '' },
    });
  } catch (e) {
    console.error(e);
    bad(res, 'Could not start the payment. Try again.', 502);
  }
});

app.post('/api/payments/verify', auth(), (req, res) => {
  const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = req.body || {};
  if (payMode !== 'razorpay') return bad(res, 'Online payment is not switched on.', 503);
  if (!orderId || !paymentId || !signature) return bad(res, 'Missing payment details.');
  const p = db.prepare('SELECT * FROM payments WHERE provider_order_id = ? AND user_id = ?').get(String(orderId), req.user.id);
  if (!p) return bad(res, 'Unknown payment.', 404);
  const expected = crypto.createHmac('sha256', RZP_KEY_SECRET).update(`${orderId}|${paymentId}`).digest('hex');
  const a = Buffer.from(expected), b = Buffer.from(String(signature));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    db.prepare(`UPDATE payments SET status = 'failed' WHERE id = ? AND status = 'created'`).run(p.id);
    return bad(res, 'Payment could not be verified. If money was deducted it will be refunded by your bank.', 400);
  }
  markPaid(orderId, String(paymentId));
  res.json({ ok: true });
});

// Safety net: Razorpay calls this even if the customer closes the tab right after paying.
app.post('/api/payments/webhook', (req, res) => {
  if (!RAZORPAY_ON || !RZP_WEBHOOK_SECRET) return res.status(404).end();
  const sig = String(req.headers['x-razorpay-signature'] || '');
  const expected = crypto.createHmac('sha256', RZP_WEBHOOK_SECRET).update(req.rawBody || '').digest('hex');
  const a = Buffer.from(expected), b = Buffer.from(sig);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return res.status(400).end();
  const ev = req.body?.event;
  const pay = req.body?.payload?.payment?.entity;
  if ((ev === 'payment.captured' || ev === 'order.paid') && pay?.order_id) markPaid(pay.order_id, pay.id);
  res.json({ ok: true });
});

// Demo checkout (development only, see DEMO_PAYMENTS).
app.post('/api/payments/demo-confirm', auth(), (req, res) => {
  if (payMode !== 'demo') return bad(res, 'Not available.', 404);
  const p = db.prepare('SELECT * FROM payments WHERE provider_order_id = ? AND user_id = ? AND provider = ?').get(String(req.body.order_id), req.user.id, 'demo');
  if (!p) return bad(res, 'Unknown payment.', 404);
  markPaid(p.provider_order_id, `demo_pay_${Date.now()}`);
  res.json({ ok: true });
});

// ---------- my bookings -----------------------------------------------------
app.get('/api/me/bookings', auth(), (req, res) => {
  const ids = db.prepare('SELECT group_id, units FROM memberships WHERE user_id = ? ORDER BY id DESC').all(req.user.id);
  const bookings = ids.map(({ group_id, units }) => {
    const row = db.prepare(`${GROUP_SELECT} WHERE g.id = ?`).get(group_id);
    const group = shapeGroup(row, req.user.id);
    const unlocked = ['unlocked', 'completed'].includes(group.state);
    return {
      group, units,
      amount: units * (unlocked ? group.group_price : group.regular_price),
      amount_if_unlocked: units * group.group_price,
      unlocked,                                  // the group price is unlocked (flat count reached)
      confirmed: ['confirmed', 'completed'].includes(group.service_status), // a real provider has accepted
    };
  }).filter((b) => b.group.state !== 'cancelled' || b.group.my_payment?.status === 'refund_due');
  res.json({ bookings });
});

// Who is logged in, whatever their role. The client calls this once on load.
app.get('/api/session', (req, res) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.json({ role: null });
  let payload;
  try { payload = jwt.verify(token, JWT_SECRET); } catch { return bad(res, 'Your session expired. Log in again.', 401); }
  const role = payload.role || 'customer';
  const account = ACCOUNT_TABLE[role] && db.prepare(`SELECT * FROM ${ACCOUNT_TABLE[role]} WHERE id = ?`).get(payload.id);
  if (!account || (payload.pv || 0) !== (account.pw_version || 0)) return bad(res, 'Your session expired. Log in again.', 401);
  const profile = role === 'customer' ? publicUser(account) : role === 'provider' ? publicProvider(account) : publicAdmin(account);
  res.json({ role, profile });
});

// ---------- service partners and admins ---------------------------------------
registerProviderRoutes(app, { auth, bad, clean, limit, signToken, slotLabel, today, flags: partnerFlags });
registerPasswordReset(app, { bad, clean, limit, secret: JWT_SECRET });

registerChat(app, { db });

app.get('/api/health', (_req, res) => res.json({ ok: true, payments: payMode }));

// ---------- static client (after `npm run build`) -----------------------------
const dist = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist, { maxAge: '7d', setHeaders: (r, p) => { if (p.endsWith('index.html')) r.setHeader('Cache-Control', 'no-cache'); } }));
  app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

app.use('/api', (_req, res) => bad(res, 'Not found.', 404));
app.use((err, _req, res, _next) => {
  console.error(err);
  bad(res, 'Something went wrong on our side. Try again.', 500);
});

app.listen(PORT, () => console.log(`Saath running on http://localhost:${PORT} (payments: ${payMode})`));
