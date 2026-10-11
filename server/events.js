// Who gets told what, and when. index.js and providers.js call these AFTER the database change has
// succeeded; every function here is safe to call without awaiting and never throws.
//
//   group reaches its flat count  -> every matching partner (popup + WhatsApp + SMS), the residents (WhatsApp, else SMS)
//   a resident joins a taken job  -> the partner who holds it
//   a partner accepts             -> the residents, with the partner's name and number
//   a partner gives a job back    -> the other matching partners
//   the host cancels the group    -> the partner who held it, and the other residents
//   a partner is approved         -> that partner
//   a partner registers           -> the Saath team (ADMIN_NOTIFY_PHONE / ADMIN_NOTIFY_EMAIL)
import { db } from './db.js';
import { APP_URL, later, once, pushInApp, send } from './notify.js';
import { groupRef } from './assignments.js';

let slotLabel = (k) => k;
export const configureEvents = (opts) => { if (opts.slotLabel) slotLabel = opts.slotLabel; };

const rs = (n) => `Rs ${Number(n).toLocaleString('en-IN')}`;
const niceDate = (d) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

const groupInfo = (id) => db.prepare(
  `SELECT g.id, g.service_id, g.scheduled_date, g.time_slot, g.target, g.group_price, g.cancelled, g.created_by,
          s.name AS service, s.unit_label, so.name AS society, so.area, so.city,
          (SELECT COUNT(*) FROM memberships m WHERE m.group_id = g.id) AS joined,
          (SELECT COALESCE(SUM(units),0) FROM memberships m WHERE m.group_id = g.id) AS units
   FROM groups g JOIN services s ON s.id = g.service_id JOIN societies so ON so.id = g.society_id WHERE g.id = ?`).get(id);

// Active partners who cover this service AND city, and have not already declined or given back the job.
function eligibleProviders(g, exceptId = null) {
  return db.prepare(
    `SELECT p.id, p.name, p.phone, p.email FROM providers p
     WHERE p.status = 'active' AND p.id != ?
       AND EXISTS (SELECT 1 FROM provider_services ps WHERE ps.provider_id = p.id AND ps.service_id = ?)
       AND EXISTS (SELECT 1 FROM provider_areas pa WHERE pa.provider_id = p.id AND pa.city = ?)
       AND NOT EXISTS (SELECT 1 FROM provider_job_events e WHERE e.group_id = ? AND e.provider_id = p.id AND e.action IN ('rejected','withdrawn'))`)
    .all(exceptId ?? 0, g.service_id, g.city, g.id);
}

const membersOf = (groupId, exceptUserId = 0) => db.prepare(
  `SELECT u.id, u.name, u.phone, u.email FROM memberships m JOIN users u ON u.id = m.user_id
   WHERE m.group_id = ? AND u.id != ?`).all(groupId, exceptUserId);

// A partner is told on every channel: the popup, WhatsApp and SMS.
function tellPartner(p, { kind, title, text, groupId }) {
  try { pushInApp(p.id, { kind, title, body: text, groupId }); } catch (e) { console.error('[notify] popup failed', e.message); }
  return send({ kind, to: { phone: p.phone, email: null }, channels: ['whatsapp', 'sms'], text: `Saath: ${text}` });
}

// A resident is told on WhatsApp, and by SMS only if WhatsApp did not go through.
const tellResident = (u, kind, text) => send({ kind, to: { phone: u.phone }, channels: ['whatsapp', 'sms'], mode: 'first', text: `Saath: ${text}` });

const jobLine = (g) => `${g.service} at ${g.society}, ${g.area}, ${g.city} on ${niceDate(g.scheduled_date)} (${slotLabel(g.time_slot)})`;

// ---- 1. a group reaches its flat count --------------------------------------------------------------
export function groupUnlocked(groupId) {
  later(async () => {
    if (!once(`unlock:${groupId}`)) return;
    const g = groupInfo(groupId);
    if (!g || g.cancelled || g.joined < g.target) return;
    const jobs = eligibleProviders(g);
    const text = `New job ${groupRef(g.id)}: ${jobLine(g)}. ${plural(g.joined, 'flat')}, ${plural(g.units, g.unit_label)}, total ${rs(g.units * g.group_price)}. First partner to accept gets it. Open ${APP_URL}/partner`;
    await Promise.all(jobs.map((p) => tellPartner(p, { kind: 'job_available', title: `New ${g.service} job in ${g.city}`, text, groupId: g.id })));
    const residents = membersOf(g.id);
    await Promise.all(residents.map((u) => tellResident(u, 'group_unlocked',
      `Good news ${u.name.split(' ')[0]}! Your ${g.service} group at ${g.society} reached ${g.target} flats, so the group price is unlocked (${niceDate(g.scheduled_date)}, ${slotLabel(g.time_slot)}). We are now finding a service partner and will message you when one confirms.`)));
  });
}

// ---- 2. a resident joins a job a partner already holds ---------------------------------------------
export function residentJoined(groupId, userId) {
  later(async () => {
    const a = db.prepare(`SELECT provider_id FROM provider_assignments WHERE group_id = ? AND status = 'accepted'`).get(groupId);
    if (!a) return;
    const g = groupInfo(groupId);
    const p = db.prepare('SELECT id, name, phone, email FROM providers WHERE id = ?').get(a.provider_id);
    if (!g || !p) return;
    await tellPartner(p, {
      kind: 'flat_joined', title: `Another flat joined ${groupRef(g.id)}`, groupId: g.id,
      text: `Another flat joined your job ${groupRef(g.id)} (${g.service}, ${g.society}). Now ${plural(g.joined, 'flat')} and ${plural(g.units, g.unit_label)}, total ${rs(g.units * g.group_price)}. Open ${APP_URL}/partner`,
    });
  });
}

// ---- 3. a partner accepts ---------------------------------------------------------------------------
export function jobAccepted(groupId, providerId) {
  later(async () => {
    const g = groupInfo(groupId);
    const p = db.prepare('SELECT name, phone FROM providers WHERE id = ?').get(providerId);
    if (!g || !p) return;
    await Promise.all(membersOf(g.id).map((u) => tellResident(u, 'job_accepted',
      `Your ${g.service} on ${niceDate(g.scheduled_date)} (${slotLabel(g.time_slot)}) is confirmed. Your service partner is ${p.name}, phone ${p.phone}.`)));
  });
}

// ---- 4. a partner gives a job back, or an admin takes it back ---------------------------------------
export function jobReopened(groupId, exceptProviderId = null) {
  later(async () => {
    const g = groupInfo(groupId);
    if (!g || g.cancelled || g.joined < g.target) return;
    const text = `Job ${groupRef(g.id)} is open again: ${jobLine(g)}, total ${rs(g.units * g.group_price)}. First partner to accept gets it. Open ${APP_URL}/partner`;
    await Promise.all(eligibleProviders(g, exceptProviderId).map((p) => tellPartner(p, { kind: 'job_available', title: `${g.service} job open again in ${g.city}`, text, groupId: g.id })));
  });
}

// ---- 5. the host cancels the group ------------------------------------------------------------------
export function groupCancelled(groupId) {
  later(async () => {
    const g = groupInfo(groupId);
    if (!g) return;
    const a = db.prepare(`SELECT provider_id FROM provider_assignments WHERE group_id = ? AND status = 'cancelled'`).get(groupId);
    if (a) {
      const p = db.prepare('SELECT id, name, phone, email FROM providers WHERE id = ?').get(a.provider_id);
      if (p) await tellPartner(p, { kind: 'job_cancelled', title: `Job ${groupRef(g.id)} cancelled`, groupId: g.id, text: `Cancelled: ${groupRef(g.id)}, ${jobLine(g)}, was cancelled by the host. Please remove it from your schedule.` });
    }
    await Promise.all(membersOf(g.id, g.created_by).map((u) => tellResident(u, 'group_cancelled',
      `The ${g.service} group at ${g.society} on ${niceDate(g.scheduled_date)} was cancelled by the host. Sorry for the trouble. You can join or start another group on ${APP_URL}`)));
  });
}

// ---- 6 and 7. partner accounts ----------------------------------------------------------------------
export function providerApproved(providerId) {
  later(async () => {
    const p = db.prepare('SELECT id, name, phone, email FROM providers WHERE id = ?').get(providerId);
    if (!p) return;
    await tellPartner(p, { kind: 'partner_approved', title: 'Your partner account is approved', text: `Your partner account is approved. You will get an alert here and on WhatsApp/SMS when a group unlocks in your cities. Open ${APP_URL}/partner` });
  });
}

export function providerRegistered(providerId) {
  later(async () => {
    const phone = process.env.ADMIN_NOTIFY_PHONE || '';
    const email = process.env.ADMIN_NOTIFY_EMAIL || '';
    if (!phone && !email) return;
    const p = db.prepare('SELECT id, name, phone, status FROM providers WHERE id = ?').get(providerId);
    if (!p) return;
    const services = db.prepare('SELECT s.name FROM provider_services ps JOIN services s ON s.id = ps.service_id WHERE ps.provider_id = ?').all(p.id).map((r) => r.name).join(', ');
    const cities = db.prepare('SELECT city FROM provider_areas WHERE provider_id = ?').all(p.id).map((r) => r.city).join(', ');
    const text = `New service partner ${p.status === 'pending' ? 'waiting for approval' : 'registered'}: ${p.name}, ${p.phone}. Services: ${services}. Cities: ${cities}. Review at ${APP_URL}/admin`;
    await Promise.all([
      phone && send({ kind: 'partner_registered', to: { phone }, channels: ['whatsapp', 'sms'], mode: 'first', text: `Saath: ${text}` }),
      email && send({ kind: 'partner_registered', to: { email }, channels: ['email'], subject: 'New Saath service partner', text }),
    ]);
  });
}
