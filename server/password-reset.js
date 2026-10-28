// Forgot password, for residents and for service partners.
//
//   1. POST .../forgot  { email }                  -> a 6-digit code goes to the account's email AND mobile
//                                                     (WhatsApp, or SMS if WhatsApp is not available)
//   2. POST .../reset   { email, code, password }  -> sets the new password
//
// Safety rules, all enforced here on the server:
//  - "forgot" answers the same way whether or not the email has an account, so it cannot be used to find out
//    who is registered.
//  - a code lives 15 minutes, works once, and allows 5 wrong guesses; asking for a new code cancels the old one.
//  - at most 3 codes per account per hour, plus an IP rate limit on both routes.
//  - only a keyed hash of the code is stored, and the code text is never written to the message log.
//  - after a reset every older login session of that account stops working (see pw_version in auth()).
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { db } from './db.js';
import { APP_URL, later, send } from './notify.js';

const CODE_MINUTES = 15;
const MAX_ATTEMPTS = 5;
const MAX_CODES_PER_HOUR = 3;
const EMAIL = /^\S+@\S+\.\S+$/;
const now = () => Math.floor(Date.now() / 1000);

const ROLES = {
  customer: { table: 'users', min: 6, who: 'resident', loginPath: '/login' },
  provider: { table: 'providers', min: 8, who: 'service partner', loginPath: '/partner/login' },
};

export function registerPasswordReset(app, { bad, clean, limit, secret }) {
  const hashCode = (role, id, code) => crypto.createHmac('sha256', secret).update(`${role}:${id}:${code}`).digest('hex');

  function mount(role, base) {
    const cfg = ROLES[role];

    app.post(`${base}/forgot`, limit(6, 15 * 60_000), (req, res) => {
      const email = clean(req.body?.email, 120).toLowerCase();
      if (!EMAIL.test(email)) return bad(res, 'Enter the email address you signed up with.');
      // Same answer for every valid-looking email.
      const reply = () => res.json({ ok: true, message: 'If this email has an account, we have sent a 6-digit code to it and to the mobile number on the account. The code works for 15 minutes.' });

      const acct = db.prepare(`SELECT id, name, email, phone FROM ${cfg.table} WHERE email = ?`).get(email);
      if (!acct) return reply();
      const recent = db.prepare('SELECT COUNT(*) AS n FROM password_resets WHERE role = ? AND account_id = ? AND created_at > ?')
        .get(role, acct.id, now() - 3600).n;
      if (recent >= MAX_CODES_PER_HOUR) return reply(); // silently ignored, so an attacker cannot spam the owner

      const code = String(crypto.randomInt(100000, 1000000));
      db.transaction(() => {
        db.prepare('UPDATE password_resets SET used_at = ? WHERE role = ? AND account_id = ? AND used_at IS NULL').run(now(), role, acct.id);
        db.prepare('INSERT INTO password_resets (role, account_id, code_hash, expires_at, created_at) VALUES (?,?,?,?,?)')
          .run(role, acct.id, hashCode(role, acct.id, code), now() + CODE_MINUTES * 60, now());
      })();

      const first = acct.name.split(' ')[0];
      const text = `${code} is your Saath password reset code. It works for ${CODE_MINUTES} minutes. Do not share it with anyone.`;
      later(() => Promise.all([
        send({ kind: 'password_reset', to: { phone: acct.phone }, channels: ['whatsapp', 'sms'], mode: 'first', text, sensitive: true, otp: code }),
        send({
          kind: 'password_reset', to: { email: acct.email }, channels: ['email'], sensitive: true,
          subject: 'Your Saath password reset code',
          text: `Hi ${first},\n\nYour Saath password reset code is ${code}\n\nIt works for ${CODE_MINUTES} minutes and can be used once. Enter it here: ${APP_URL}${role === 'provider' ? '/partner/forgot-password' : '/forgot-password'}\n\nIf you did not ask for this, ignore this message. Your password has not changed.`,
        }),
      ]));
      return reply();
    });

    app.post(`${base}/reset`, limit(12, 15 * 60_000), (req, res) => {
      const email = clean(req.body?.email, 120).toLowerCase();
      const code = String(req.body?.code ?? '').replace(/\s+/g, '');
      const password = String(req.body?.password ?? '');
      if (!EMAIL.test(email)) return bad(res, 'Enter the email address you signed up with.');
      if (!/^\d{6}$/.test(code)) return bad(res, 'Enter the 6-digit code we sent you.');
      if (password.length < cfg.min) return bad(res, `Password must be at least ${cfg.min} characters.`);
      if (password.length > 72) return bad(res, 'Password must be at most 72 characters.');

      const WRONG = 'That code is not correct or has expired. Ask for a new code and try again.';
      const acct = db.prepare(`SELECT id, name, email, phone FROM ${cfg.table} WHERE email = ?`).get(email);
      if (!acct) return bad(res, WRONG);
      const row = db.prepare(
        `SELECT * FROM password_resets WHERE role = ? AND account_id = ? AND used_at IS NULL AND expires_at > ?
         ORDER BY id DESC LIMIT 1`).get(role, acct.id, now());
      if (!row || row.attempts >= MAX_ATTEMPTS) return bad(res, WRONG);

      // Count the guess first, so parallel requests cannot get extra tries.
      db.prepare('UPDATE password_resets SET attempts = attempts + 1 WHERE id = ?').run(row.id);
      const expected = Buffer.from(row.code_hash);
      const given = Buffer.from(hashCode(role, acct.id, code));
      if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return bad(res, WRONG);

      const hash = bcrypt.hashSync(password, 10);
      db.transaction(() => {
        db.prepare(`UPDATE ${cfg.table} SET password_hash = ?, pw_version = pw_version + 1 WHERE id = ?`).run(hash, acct.id);
        db.prepare('UPDATE password_resets SET used_at = ? WHERE role = ? AND account_id = ? AND used_at IS NULL').run(now(), role, acct.id);
      })();

      later(() => Promise.all([
        send({ kind: 'password_changed', to: { phone: acct.phone }, channels: ['whatsapp', 'sms'], mode: 'first', text: 'Saath: your password was just changed. If this was not you, reset it again now or contact Saath support.' }),
        send({ kind: 'password_changed', to: { email: acct.email }, channels: ['email'], subject: 'Your Saath password was changed', text: `Hi ${acct.name.split(' ')[0]},\n\nYour Saath password was just changed. If this was not you, reset it again at ${APP_URL}${role === 'provider' ? '/partner/forgot-password' : '/forgot-password'} or contact Saath support.` }),
      ]));
      return res.json({ ok: true, message: 'Your password is changed. Log in with the new password.', login_path: cfg.loginPath });
    });
  }

  mount('customer', '/api/auth');
  mount('provider', '/api/provider/auth');
}
