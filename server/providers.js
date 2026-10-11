// Service Partner (provider) and admin routes. Mounted from index.js, which supplies the shared
// helpers (auth middleware, rate limiter, validators) so login and JWT behave exactly as for customers.
import bcrypt from 'bcryptjs';
import { db } from './db.js';
import { addDays } from './dates.js';
import { listInApp, markInAppRead } from './notify.js';
import * as events from './events.js';
import {
  HttpError, listJobs, acceptJob, rejectJob, withdrawJob, completeJob, releaseJob,
  providerCoverage, groupRef, jobsOutsideAreas,
} from './assignments.js';

const PHONE = /^[6-9]\d{9}$/;
const EMAIL = /^\S+@\S+\.\S+$/;
// Compared against when an email is unknown, so "no such account" takes as long as "wrong password".
const DUMMY_HASH = bcrypt.hashSync('saath-not-a-real-password', 10);

export function publicProvider(p) {
  const { services, areas } = providerCoverage(p.id);
  return {
    id: p.id, name: p.name, email: p.email, phone: p.phone, status: p.status,
    is_demo: Boolean(p.is_demo), services, areas,
  };
}

export function publicAdmin(a) {
  return { id: a.id, name: a.name, email: a.email };
}

export function registerProviderRoutes(app, { auth, bad, clean, limit, signToken, slotLabel, today, flags }) {
  // Turn an HttpError thrown by the assignment rules into a normal JSON error.
  const run = (fn) => (req, res, next) => {
    try { return fn(req, res, next); } catch (e) {
      if (e instanceof HttpError) return bad(res, e.message, e.status);
      return next(e);
    }
  };
  const groupIdOf = (req) => {
    const id = Number(req.params.groupId);
    return Number.isInteger(id) && id > 0 ? id : null;
  };
  const withLabels = (list) => list.map((j) => ({ ...j, time_slot_label: slotLabel(j.time_slot) }));

  // ======================= provider accounts =======================================================
  app.post('/api/provider/auth/register', limit(10, 10 * 60_000), run((req, res) => {
    const body = req.body || {};
    const name = clean(body.name, 80);
    const email = clean(body.email, 120).toLowerCase();
    const phone = clean(body.phone, 15);
    const password = String(body.password ?? '');
    const slugs = [...new Set((Array.isArray(body.services) ? body.services : []).map((s) => clean(s, 40)))];
    const cities = [...new Set((Array.isArray(body.areas) ? body.areas : []).map((c) => clean(c, 60)))];

    if (name.length < 2) return bad(res, 'Enter your full name or business name.');
    if (!EMAIL.test(email)) return bad(res, 'Enter a valid email address.');
    if (!PHONE.test(phone)) return bad(res, 'Enter a valid 10-digit mobile number. Customers and the Saath team call on this number.');
    if (password.length < 8) return bad(res, 'Password must be at least 8 characters.');
    if (password.length > 72) return bad(res, 'Password must be at most 72 characters.');
    if (!slugs.length) return bad(res, 'Choose at least one service you provide.');
    if (!cities.length) return bad(res, 'Choose at least one city you work in.');
    if (cities.length > 30) return bad(res, 'Too many cities selected.');

    const serviceRows = slugs.map((slug) => db.prepare('SELECT id FROM services WHERE slug = ?').get(slug));
    if (serviceRows.some((s) => !s)) return bad(res, 'One of the services you chose does not exist.');
    const knownCities = new Set(db.prepare('SELECT DISTINCT city FROM societies').all().map((r) => r.city));
    if (cities.some((c) => !knownCities.has(c))) return bad(res, 'One of the cities you chose is not on Saath yet.');
    if (db.prepare('SELECT 1 FROM providers WHERE email = ?').get(email)) return bad(res, 'This email already has a partner account. Log in instead.', 409);

    const hash = bcrypt.hashSync(password, 10);
    const id = db.transaction(() => {
      const info = db.prepare('INSERT INTO providers (name, email, password_hash, phone, status, is_demo) VALUES (?,?,?,?,?,?)')
        .run(name, email, hash, phone, flags.autoApprove ? 'active' : 'pending', flags.demo ? 1 : 0);
      const pid = info.lastInsertRowid;
      for (const s of serviceRows) db.prepare('INSERT INTO provider_services (provider_id, service_id) VALUES (?,?)').run(pid, s.id);
      for (const c of cities) db.prepare('INSERT INTO provider_areas (provider_id, city) VALUES (?,?)').run(pid, c);
      return pid;
    })();
    const provider = db.prepare('SELECT * FROM providers WHERE id = ?').get(id);
    events.providerRegistered(id); // tells the Saath team (ADMIN_NOTIFY_PHONE / ADMIN_NOTIFY_EMAIL), if set
    res.status(201).json({ token: signToken('provider', provider.id), provider: publicProvider(provider) });
  }));

  app.post('/api/provider/auth/login', limit(20, 10 * 60_000), run((req, res) => {
    const email = clean(req.body?.email, 120).toLowerCase();
    const provider = db.prepare('SELECT * FROM providers WHERE email = ?').get(email);
    const ok = bcrypt.compareSync(String(req.body?.password ?? ''), provider ? provider.password_hash : DUMMY_HASH);
    if (!provider || !ok) return bad(res, 'Email or password is incorrect.', 401);
    res.json({ token: signToken('provider', provider.id), provider: publicProvider(provider) });
  }));

  app.get('/api/provider/auth/me', auth(true, 'provider'), (req, res) => res.json({ provider: publicProvider(req.provider) }));

  // A partner can change the services and cities they cover at any time after signing up.
  app.put('/api/provider/coverage', auth(true, 'provider'), limit(30, 10 * 60_000), run((req, res) => {
    const body = req.body || {};
    const slugs = [...new Set((Array.isArray(body.services) ? body.services : []).map((s) => clean(s, 40)))];
    const cities = [...new Set((Array.isArray(body.areas) ? body.areas : []).map((c) => clean(c, 60)))];
    if (!slugs.length) return bad(res, 'Choose at least one service you provide.');
    if (!cities.length) return bad(res, 'Choose at least one city you work in.');
    if (cities.length > 30) return bad(res, 'Too many cities selected.');
    const serviceRows = slugs.map((slug) => db.prepare('SELECT id FROM services WHERE slug = ?').get(slug));
    if (serviceRows.some((s) => !s)) return bad(res, 'One of the services you chose does not exist.');
    const knownCities = new Set(db.prepare('SELECT DISTINCT city FROM societies').all().map((r) => r.city));
    if (cities.some((c) => !knownCities.has(c))) return bad(res, 'One of the cities you chose is not on Saath yet.');
    const id = req.provider.id;
    db.transaction(() => {
      db.prepare('DELETE FROM provider_services WHERE provider_id = ?').run(id);
      db.prepare('DELETE FROM provider_areas WHERE provider_id = ?').run(id);
      for (const s of serviceRows) db.prepare('INSERT INTO provider_services (provider_id, service_id) VALUES (?,?)').run(id, s.id);
      for (const c of cities) db.prepare('INSERT INTO provider_areas (provider_id, city) VALUES (?,?)').run(id, c);
    })();
    res.json({ provider: publicProvider(db.prepare('SELECT * FROM providers WHERE id = ?').get(id)) });
  }));

  // ======================= provider dashboard ======================================================
  app.get('/api/provider/jobs', auth(true, 'provider'), run((req, res) => {
    const p = req.provider;
    const empty = { available: [], upcoming: [], completed: [], cancelled: [] };
    const jobs = p.status === 'active' ? listJobs(p.id, today()) : empty;
    res.json({
      provider: publicProvider(p),
      available: withLabels(jobs.available),
      upcoming: withLabels(jobs.upcoming),
      completed: withLabels(jobs.completed),
      cancelled: withLabels(jobs.cancelled),
      notice: p.status === 'pending' ? 'Your account is waiting for approval by the Saath team. You will see jobs here once it is approved.'
        : p.status === 'suspended' ? 'Your account is suspended. Contact Saath support.' : null,
      outside_areas: p.status === 'active' ? jobsOutsideAreas(p.id, today()) : [],
      rules: { early_complete: flags.earlyComplete },
    });
  }));

  const jobAction = (name, fn) => app.post(`/api/provider/jobs/:groupId/${name}`, auth(true, 'provider'), limit(60, 10 * 60_000), run((req, res) => {
    const groupId = groupIdOf(req);
    if (!groupId) return bad(res, 'Unknown job.', 404);
    fn(req.provider.id, groupId, req);
    res.json({ ok: true });
  }));
  jobAction('accept', (pid, gid) => { acceptJob(pid, gid, today()); events.jobAccepted(gid, pid); });
  jobAction('reject', (pid, gid, req) => rejectJob(pid, gid, today(), clean(req.body?.note, 200)));
  jobAction('withdraw', (pid, gid, req) => { withdrawJob(pid, gid, clean(req.body?.note, 200)); events.jobReopened(gid, pid); });
  jobAction('complete', (pid, gid) => completeJob(pid, gid, today(), { allowEarly: flags.earlyComplete }));

  // ======================= popup alerts for the partner ============================================
  // The dashboard polls this every few seconds while it is open. Only the caller's own alerts are returned.
  app.get('/api/provider/notifications', auth(true, 'provider'), (req, res) => {
    res.json(listInApp(req.provider.id, { unreadOnly: req.query.all !== '1' }));
  });
  app.post('/api/provider/notifications/read', auth(true, 'provider'), limit(120, 10 * 60_000), (req, res) => {
    const ids = req.body?.ids === 'all' ? 'all' : (Array.isArray(req.body?.ids) ? req.body.ids.slice(0, 50) : []);
    markInAppRead(req.provider.id, ids);
    res.json({ ok: true });
  });

  // ======================= administrators ==========================================================
  // Admin accounts are created from the command line (`npm run create-admin`), never by sign-up.
  app.post('/api/admin/auth/login', limit(10, 10 * 60_000), run((req, res) => {
    const email = clean(req.body?.email, 120).toLowerCase();
    const admin = db.prepare('SELECT * FROM admins WHERE email = ?').get(email);
    const ok = bcrypt.compareSync(String(req.body?.password ?? ''), admin ? admin.password_hash : DUMMY_HASH);
    if (!admin || !ok) return bad(res, 'Email or password is incorrect.', 401);
    res.json({ token: signToken('admin', admin.id, '8h'), admin: publicAdmin(admin) });
  }));

  app.get('/api/admin/overview', auth(true, 'admin'), run((req, res) => {
    const providers = db.prepare(
      `SELECT p.*,
         (SELECT COUNT(*) FROM provider_assignments a WHERE a.provider_id = p.id AND a.status = 'accepted')  AS open_jobs,
         (SELECT COUNT(*) FROM provider_assignments a WHERE a.provider_id = p.id AND a.status = 'completed') AS done_jobs
       FROM providers p ORDER BY p.id DESC`).all()
      .map((p) => ({ ...publicProvider(p), open_jobs: p.open_jobs, done_jobs: p.done_jobs, created_at: p.created_at }));

    const since = addDays(today(), -14);
    const jobs = db.prepare(
      `SELECT g.id, g.scheduled_date, g.time_slot, g.target, g.cancelled, s.name AS service_name,
              so.name AS society_name, so.city AS society_city,
              (SELECT COUNT(*) FROM memberships m WHERE m.group_id = g.id) AS joined,
              a.status AS a_status, p.id AS provider_id, p.name AS provider_name, p.is_demo AS provider_is_demo
       FROM groups g JOIN services s ON s.id = g.service_id JOIN societies so ON so.id = g.society_id
       LEFT JOIN provider_assignments a ON a.group_id = g.id
       LEFT JOIN providers p ON p.id = a.provider_id
       WHERE g.cancelled = 0 AND g.scheduled_date >= ? ORDER BY g.scheduled_date ASC, g.id ASC`).all(since)
      .filter((g) => g.joined >= g.target)
      .map((g) => ({
        group_id: g.id, reference: groupRef(g.id), service: g.service_name, society: `${g.society_name}, ${g.society_city}`,
        scheduled_date: g.scheduled_date, time_slot_label: slotLabel(g.time_slot), flats: g.joined, target: g.target,
        assignment: g.a_status || 'unassigned',
        provider: g.provider_id ? { id: g.provider_id, name: g.provider_name, is_demo: Boolean(g.provider_is_demo) } : null,
      }));
    res.json({ providers, jobs });
  }));

  app.post('/api/admin/providers/:id/status', auth(true, 'admin'), run((req, res) => {
    const id = Number(req.params.id);
    const status = String(req.body?.status || '');
    if (!['active', 'suspended'].includes(status)) return bad(res, 'Status must be active or suspended.');
    const before = db.prepare('SELECT status FROM providers WHERE id = ?').get(id);
    const info = db.prepare('UPDATE providers SET status = ? WHERE id = ?').run(status, id);
    if (!info.changes) return bad(res, 'Provider not found.', 404);
    if (status === 'active' && before?.status === 'pending') events.providerApproved(id); // "you are approved" alert
    res.json({ ok: true });
  }));

  app.post('/api/admin/jobs/:groupId/release', auth(true, 'admin'), run((req, res) => {
    const groupId = groupIdOf(req);
    if (!groupId) return bad(res, 'Unknown job.', 404);
    const holder = db.prepare(`SELECT provider_id FROM provider_assignments WHERE group_id = ? AND status = 'accepted'`).get(groupId);
    releaseJob(groupId, clean(req.body?.note, 200));
    events.jobReopened(groupId, holder?.provider_id ?? null);
    res.json({ ok: true });
  }));
}
