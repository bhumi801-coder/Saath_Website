// End-to-end test of job alerts (popup + WhatsApp + SMS) and forgot password, against the REAL server on a
// throwaway database. No WhatsApp / SMS / email account is needed: with no keys set, the server prints
// each message in its console, and this test reads the messages from there.
//   npm test
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const PORT = 4700 + Math.floor(Math.random() * 400);
const BASE = `http://127.0.0.1:${PORT}/api`;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'saath-notify-'));
let server;
let consoleText = '';

const call = async (method, url, { token, body } = {}) => {
  const res = await fetch(BASE + url, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
};
const until = async (fn, ms = 4000) => {
  const end = Date.now() + ms;
  for (;;) {
    const v = fn();
    if (v) return v;
    if (Date.now() > end) return null;
    await new Promise((r) => setTimeout(r, 50));
  }
};
const lastResetCode = () => [...consoleText.matchAll(/(\d{6}) is your Saath password reset code/g)].pop()?.[1] || null;

before(async () => {
  server = spawn('node', ['index.js'], {
    cwd: path.join(here, '..'),
    env: { ...process.env, NODE_ENV: 'development', PORT: String(PORT), DB_FILE: path.join(tmp, 'test.db'), JWT_SECRET: 'test-secret', APP_URL: 'https://saath.test',
      TWILIO_ACCOUNT_SID: '', RESEND_API_KEY: '' },
    stdio: 'pipe',
  });
  server.stdout.on('data', (d) => { consoleText += d.toString(); });
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(`${BASE}/health`)).ok) return; } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('server did not start');
});
after(() => { server?.kill(); fs.rmSync(tmp, { recursive: true, force: true }); });

test('forgot password: resident gets a code, resets, old password and old sessions stop working', async () => {
  const old = (await call('POST', '/auth/login', { body: { email: 'demo@saath.in', password: 'demo1234' } })).body.token;
  assert.ok(old);

  const known = await call('POST', '/auth/forgot', { body: { email: 'demo@saath.in' } });
  const unknown = await call('POST', '/auth/forgot', { body: { email: 'nobody@example.com' } });
  assert.equal(known.status, 200);
  assert.equal(known.body.message, unknown.body.message, 'the answer does not reveal whether the email exists');

  const code = await until(lastResetCode);
  assert.match(code, /^\d{6}$/, 'a 6-digit code was sent');

  assert.equal((await call('POST', '/auth/reset', { body: { email: 'demo@saath.in', code: code === '000000' ? '111111' : '000000', password: 'brandnew1' } })).status, 400, 'wrong code');
  assert.equal((await call('POST', '/auth/reset', { body: { email: 'demo@saath.in', code, password: 'abc' } })).status, 400, 'password too short');
  assert.equal((await call('POST', '/auth/reset', { body: { email: 'demo@saath.in', code, password: 'brandnew1' } })).status, 200);
  assert.equal((await call('POST', '/auth/reset', { body: { email: 'demo@saath.in', code, password: 'another1' } })).status, 400, 'a code works once');

  assert.equal((await call('POST', '/auth/login', { body: { email: 'demo@saath.in', password: 'demo1234' } })).status, 401, 'old password rejected');
  assert.equal((await call('POST', '/auth/login', { body: { email: 'demo@saath.in', password: 'brandnew1' } })).status, 200, 'new password works');
  assert.equal((await call('GET', '/auth/me', { token: old })).status, 401, 'a session from before the reset is logged out');
});

test('forgot password: service partner flow, and codes are not interchangeable between roles', async () => {
  const email = 'resetme@partner.test';
  const reg = await call('POST', '/provider/auth/register', { body: { name: 'Reset Me', email, phone: '9811100000', password: 'partnerpass1', services: ['car-wash'], areas: ['Noida'] } });
  assert.equal(reg.status, 201);

  await call('POST', '/provider/auth/forgot', { body: { email } });
  const code = await until(() => { const c = lastResetCode(); return c && consoleText.includes('9811100000') ? c : null; });
  assert.match(code, /^\d{6}$/);

  assert.equal((await call('POST', '/provider/auth/reset', { body: { email: 'demo@saath.in', code, password: 'partnerpass2' } })).status, 400, 'a resident email does not work on the partner route');
  assert.equal((await call('POST', '/provider/auth/reset', { body: { email, code, password: 'short' } })).status, 400, 'partner passwords need 8 characters');
  assert.equal((await call('POST', '/provider/auth/reset', { body: { email, code, password: 'partnerpass2' } })).status, 200);
  assert.equal((await call('POST', '/provider/auth/login', { body: { email, password: 'partnerpass1' } })).status, 401);
  assert.equal((await call('POST', '/provider/auth/login', { body: { email, password: 'partnerpass2' } })).status, 200);
});

// Note: these three tests run in order and share one server (the resident's password is changed by the first).
test('job alerts: unlocking a group pops up for matching partners and goes out on WhatsApp and SMS', async () => {
  const reg = (name, areas) => call('POST', '/provider/auth/register', {
    body: { name, email: `${name.toLowerCase().replace(/\W/g, '')}@alerts.test`, phone: name === 'Near Wash' ? '9822200001' : '9833300002', password: 'partnerpass1', services: ['car-wash'], areas },
  });
  const near = (await reg('Near Wash', ['Noida'])).body.token;
  const far = (await reg('Far Wash', ['Lucknow'])).body.token;
  assert.ok(near && far);

  const meta = (await call('GET', '/meta')).body;
  const service = meta.services.find((s) => s.slug === 'car-wash');
  const d = new Date(`${meta.today}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + 40);
  const date = d.toISOString().slice(0, 10);

  // a resident starts a group that needs 5 flats; four neighbours join
  const host = (await call('POST', '/auth/login', { body: { email: 'demo@saath.in', password: 'brandnew1' } })).body.token;
  const made = await call('POST', '/groups', { token: host, body: { service_id: service.id, target: 5, group_price: 399, scheduled_date: date, time_slot: '9-12' } });
  assert.equal(made.status, 201, JSON.stringify(made.body));
  const gid = made.body.id;

  assert.equal((await call('GET', '/provider/notifications', { token: near })).body.unread, 0, 'nothing before the group unlocks');

  let unlocked = null;
  for (const email of ['priya0@example.com', 'rahul1@example.com', 'sneha2@example.com', 'vikram3@example.com']) {
    const t = (await call('POST', '/auth/login', { body: { email, password: 'demo1234' } })).body.token;
    const j = await call('POST', `/groups/${gid}/join`, { token: t, body: { units: 1, phone: '9876511111' } });
    assert.equal(j.status, 200, JSON.stringify(j.body));
    unlocked = j.body.unlocked_now;
  }
  assert.equal(unlocked, true, 'the 5th flat unlocks the group');

  // popup for the partner in Noida, nothing for the partner in Lucknow
  let popup = null;
  for (let i = 0; i < 60 && !popup; i++) {
    const r = (await call('GET', '/provider/notifications', { token: near })).body;
    if (r.unread) popup = r; else await new Promise((x) => setTimeout(x, 50));
  }
  assert.ok(popup, 'the Noida partner got a popup');
  assert.equal(popup.notifications[0].kind, 'job_available');
  assert.match(popup.notifications[0].body, /Car wash/i);
  assert.equal((await call('GET', '/provider/notifications', { token: far })).body.unread, 0, 'a partner in another city is not alerted');

  // the same alert went out on WhatsApp and on SMS
  assert.ok(await until(() => /\[notify:whatsapp\] to \+919822200001/.test(consoleText)), 'WhatsApp alert to the partner');
  assert.ok(await until(() => /\[notify:sms\] to \+919822200001/.test(consoleText)), 'SMS alert to the partner');
  assert.ok(!/\[notify:\w+\] to \+919833300002/.test(consoleText), 'no message to the partner in another city');
  // residents are told too, on WhatsApp only (SMS is the backup)
  assert.ok(await until(() => /\[notify:whatsapp\] to \+919876511111\s*\(group_unlocked\)/.test(consoleText)), 'residents told that the price unlocked');

  // partner closes the popup
  await call('POST', '/provider/notifications/read', { token: near, body: { ids: 'all' } });
  assert.equal((await call('GET', '/provider/notifications', { token: near })).body.unread, 0);

  // when the partner accepts, residents are told who is coming
  assert.equal((await call('POST', `/provider/jobs/${gid}/accept`, { token: near })).status, 200);
  assert.ok(await until(() => /\(job_accepted\)[\s\S]{0,300}Near Wash/.test(consoleText)), 'residents told who accepted');

  // a partner cannot read or clear another partner's alerts, and customers cannot use the endpoint
  assert.equal((await call('GET', '/provider/notifications', { token: host })).status, 403);
});
