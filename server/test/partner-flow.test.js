// End-to-end test of the service partner workflow against the REAL server (express, bcrypt, JWT,
// better-sqlite3). It starts the server on a throwaway database, so your real data is never touched.
//   npm test            (from the project root or from server/)
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const PORT = 4300 + Math.floor(Math.random() * 400);
const BASE = `http://127.0.0.1:${PORT}/api`;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'saath-test-'));
let server;

const call = async (method, url, { token, body } = {}) => {
  const res = await fetch(BASE + url, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
};

before(async () => {
  server = spawn('node', ['index.js'], {
    cwd: path.join(here, '..'),
    env: { ...process.env, NODE_ENV: 'development', PORT: String(PORT), DB_FILE: path.join(tmp, 'test.db'), JWT_SECRET: 'test-secret', ALLOW_EARLY_COMPLETE: '1' },
    stdio: 'pipe',
  });
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(`${BASE}/health`)).ok) return; } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('server did not start');
});
after(() => { server?.kill(); fs.rmSync(tmp, { recursive: true, force: true }); });

const partner = async (name, services, areas) => {
  const r = await call('POST', '/provider/auth/register', {
    body: { name, email: `${name.toLowerCase().replace(/\W/g, '')}@partner.test`, phone: '9811100000', password: 'partnerpass1', services, areas },
  });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  return r.body.token;
};

test('provider flow: unlock -> accept (only one) -> customer sees provider -> complete; payment untouched', async () => {
  const demo = (await call('POST', '/auth/login', { body: { email: 'demo@saath.in', password: 'demo1234' } })).body.token;
  assert.ok(demo, 'demo customer can log in');

  const groups = (await call('GET', '/groups', { token: demo })).body.groups;
  const g = groups.find((x) => x.service.slug === 'car-wash' && x.society.city === 'Noida');
  assert.equal(g.state, 'unlocked', 'seeded car-wash group is already unlocked');
  assert.equal((await call('POST', `/groups/${g.id}/join`, { token: demo, body: { units: 2 } })).status, 200);

  // before anyone accepts
  let view = (await call('GET', `/groups/${g.id}`, { token: demo })).body.group;
  assert.equal(view.provider_status, 'awaiting');
  assert.equal(view.provider, null);
  assert.equal(view.my_payment.display, 'unpaid');

  const a = await partner('Alpha Wash', ['car-wash'], ['Noida']);
  const b = await partner('Beta Wash', ['car-wash'], ['Noida']);
  const wrongArea = await partner('Far Wash', ['car-wash'], ['Lucknow']);

  // roles
  assert.equal((await call('GET', '/provider/jobs', { token: demo })).status, 403, 'customer blocked from provider API');
  assert.equal((await call('GET', '/me/bookings', { token: a })).status, 403, 'provider blocked from customer API');
  assert.equal((await call('GET', '/admin/overview', { token: a })).status, 403, 'provider blocked from admin API');

  // visibility
  assert.ok((await call('GET', '/provider/jobs', { token: a })).body.available.some((j) => j.group_id === g.id));
  assert.ok(!(await call('GET', '/provider/jobs', { token: wrongArea })).body.available.some((j) => j.group_id === g.id));

  // only one provider can accept
  const [r1, r2] = await Promise.all([
    call('POST', `/provider/jobs/${g.id}/accept`, { token: a }),
    call('POST', `/provider/jobs/${g.id}/accept`, { token: b }),
  ]);
  assert.deepEqual([r1.status, r2.status].sort(), [200, 409], 'exactly one accept wins');

  // customer sees the assigned provider, payment is still unpaid
  view = (await call('GET', `/groups/${g.id}`, { token: demo })).body.group;
  assert.equal(view.provider_status, 'accepted');
  assert.equal(view.service_status, 'confirmed');
  assert.ok(view.provider.name.endsWith('Wash'));
  assert.equal(view.provider.is_demo, true, 'test partner is flagged as demo');
  assert.equal(view.my_payment.status, 'pending', 'acceptance does not mark anything paid');

  // demo payment still works, independently
  const order = await call('POST', '/payments/order', { token: demo, body: { group_id: g.id } });
  assert.equal(order.status, 200);
  assert.equal((await call('POST', '/payments/demo-confirm', { token: demo, body: { order_id: order.body.order_id } })).status, 200);
  view = (await call('GET', `/groups/${g.id}`, { token: demo })).body.group;
  assert.equal(view.my_payment.display, 'paid');

  // completion by the holder only
  const winner = r1.status === 200 ? a : b;
  const loser = r1.status === 200 ? b : a;
  assert.equal((await call('POST', `/provider/jobs/${g.id}/complete`, { token: loser })).status, 404);
  assert.equal((await call('POST', `/provider/jobs/${g.id}/complete`, { token: winner })).status, 200);
  assert.equal((await call('POST', `/provider/jobs/${g.id}/complete`, { token: winner })).status, 409);
  view = (await call('GET', `/groups/${g.id}`, { token: demo })).body.group;
  assert.equal(view.service_status, 'completed');
});
