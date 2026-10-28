// Notifications: WhatsApp, SMS and email, plus the popup a service partner sees on the website.
//
//  - WhatsApp and SMS go through Twilio (one account, two channels). Email goes through Resend.
//  - A channel whose keys are not set is simply "off". Outside production its messages are printed in
//    the server console instead (so you can see exactly what would be sent). In production they are
//    recorded as "skipped" and a warning is printed once at start-up.
//  - Sending never throws and never blocks the request that caused it. A failed message is recorded in
//    `notification_log` and nothing else happens.
//  - Reset codes are sent through here too, but their text is never stored in the log.
import { db } from './db.js';

const env = process.env;
const PROD = env.NODE_ENV === 'production';

const TW_SID = env.TWILIO_ACCOUNT_SID || '';
const TW_TOKEN = env.TWILIO_AUTH_TOKEN || '';
const TW_SMS_FROM = env.TWILIO_SMS_FROM || '';          // e.g. +1415XXXXXXX or a Twilio Messaging Service SID (MG...)
const TW_WA_FROM = env.TWILIO_WHATSAPP_FROM || '';      // e.g. +14155238886 (sandbox) or your approved WhatsApp sender
const F2S_KEY = env.FAST2SMS_API_KEY || '';             // India SMS for reset codes (fast2sms.com, OTP route)
const RESEND_KEY = env.RESEND_API_KEY || '';
const MAIL_FROM = env.MAIL_FROM || '';                  // e.g. "Saath <no-reply@yourdomain.in>"

export const live = {
  sms: Boolean((TW_SID && TW_TOKEN && TW_SMS_FROM) || F2S_KEY),
  whatsapp: Boolean(TW_SID && TW_TOKEN && TW_WA_FROM),
  email: Boolean(RESEND_KEY && MAIL_FROM),
};

export const APP_URL = (env.APP_URL || `http://localhost:${env.PORT || 4000}`).replace(/\/+$/, '');

export function warnIfNotConfigured() {
  if (!PROD) return;
  const off = Object.entries(live).filter(([, on]) => !on).map(([c]) => c);
  if (off.length) {
    console.warn(`[saath] Notifications are OFF for: ${off.join(', ')}. Set the keys in .env.example (Twilio / Resend). Until then those messages are not delivered.`);
  }
}

// 10-digit Indian mobile -> +91XXXXXXXXXX. Anything that already starts with + is kept.
export function e164(phone) {
  const d = String(phone || '').replace(/[^\d+]/g, '');
  if (/^\+\d{8,15}$/.test(d)) return d;
  if (/^[6-9]\d{9}$/.test(d)) return `+91${d}`;
  if (/^91[6-9]\d{9}$/.test(d)) return `+${d}`;
  return null;
}

const FETCH_TIMEOUT = 12_000;

async function twilio(to, from, body) {
  const form = new URLSearchParams({ To: to, Body: body });
  // A Messaging Service SID is passed differently from a phone number.
  if (/^MG[0-9a-f]{32}$/i.test(from)) form.set('MessagingServiceSid', from); else form.set('From', from);
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TW_SID}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${TW_SID}:${TW_TOKEN}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form,
    signal: AbortSignal.timeout(FETCH_TIMEOUT),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(`Twilio ${res.status}: ${data.message || 'request failed'}`);
  }
}

// Fast2SMS OTP route: sends the standard text "Your OTP: <code>" to a 10-digit Indian mobile number.
async function fast2sms(to, code) {
  const res = await fetch('https://www.fast2sms.com/dev/bulkV2', {
    method: 'POST',
    headers: { authorization: F2S_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ route: 'otp', variables_values: String(code), numbers: String(to).replace(/^\+91/, '') }),
    signal: AbortSignal.timeout(FETCH_TIMEOUT),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.return !== true) throw new Error(`Fast2SMS ${res.status}: ${[].concat(data.message || 'request failed').join(' ')}`);
}

const TWILIO_SMS_ON = Boolean(TW_SID && TW_TOKEN && TW_SMS_FROM);

const senders = {
  sms: (to, { text, otp }) => {
    if (F2S_KEY && otp) return fast2sms(to, otp);                 // reset codes go through Fast2SMS
    if (TWILIO_SMS_ON) return twilio(to, TW_SMS_FROM, text);       // other texts need Twilio (or a DLT template)
    return Promise.reject(new Error('Fast2SMS sends only OTP codes. Add Twilio (or a DLT template) for other SMS.'));
  },
  whatsapp: (to, { text }) => twilio(`whatsapp:${to}`, TW_WA_FROM.startsWith('whatsapp:') ? TW_WA_FROM : `whatsapp:${TW_WA_FROM}`, text),
  email: async (to, { subject, text }) => {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: MAIL_FROM, to: [to], subject, text }),
      signal: AbortSignal.timeout(FETCH_TIMEOUT),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(`Resend ${res.status}: ${data.message || 'request failed'}`);
    }
  },
};

const logRow = (kind, channel, to, status, error, body) => {
  try {
    db.prepare('INSERT INTO notification_log (kind, channel, to_addr, status, error, body) VALUES (?,?,?,?,?,?)')
      .run(kind, channel, to, status, String(error || '').slice(0, 300), body);
  } catch (e) { console.error('[notify] could not write log', e.message); }
};

// One channel, one recipient. Returns 'sent' | 'console' | 'failed' | 'skipped'.
async function deliver(channel, to, { kind, subject, text, sensitive, otp }) {
  const stored = sensitive ? '(hidden: contains a secret code)' : text;
  if (!live[channel]) {
    if (!PROD) {
      // Printed on purpose, so a developer can read the reset code or the job alert without any account.
      console.log(`[notify:${channel}] to ${to} (${kind})${subject ? ` subject: ${subject}` : ''}\n${text}`);
      logRow(kind, channel, to, 'console', '', stored);
      return 'console';
    }
    logRow(kind, channel, to, 'skipped', `${channel} is not configured`, stored);
    return 'skipped';
  }
  try {
    await senders[channel](to, { subject, text, otp });
    logRow(kind, channel, to, 'sent', '', stored);
    return 'sent';
  } catch (e) {
    console.error(`[notify:${channel}] failed for ${to}: ${e.message}`);
    logRow(kind, channel, to, 'failed', e.message, stored);
    return 'failed';
  }
}

// send({ kind, to: { phone, email }, channels, mode, subject, text, sensitive })
//   channels: any of 'whatsapp' | 'sms' | 'email'.
//   mode 'all'   (default): try every channel listed.
//   mode 'first'          : try them in order and stop at the first that works (WhatsApp, then SMS as backup).
export async function send({ kind, to = {}, channels, mode = 'all', subject = '', text, sensitive = false, otp = '' }) {
  const results = {};
  try {
    const phone = e164(to.phone);
    const addr = { sms: phone, whatsapp: phone, email: to.email || null };
    const list = channels.filter((c) => addr[c]);
    if (mode === 'first') {
      for (let i = 0; i < list.length; i++) {
        const c = list[i];
        // If this channel is not set up but a later one is (WhatsApp off, SMS on), go straight to the later one.
        if (!live[c] && list.slice(i + 1).some((x) => live[x])) continue;
        results[c] = await deliver(c, addr[c], { kind, subject, text, sensitive, otp });
        if (results[c] === 'sent' || results[c] === 'console') break;
      }
    } else {
      await Promise.all(list.map(async (c) => { results[c] = await deliver(c, addr[c], { kind, subject, text, sensitive, otp }); }));
    }
  } catch (e) { console.error('[notify] unexpected error', e); }
  return results;
}

// Run a notification job after the response has been sent. Errors are logged, never raised.
export const later = (fn) => setImmediate(() => { Promise.resolve().then(fn).catch((e) => console.error('[notify]', e)); });

// True the first time a key is seen, false after. Used so a group's "unlocked" alert goes out once.
export function once(key) {
  return db.prepare('INSERT OR IGNORE INTO notify_sent (key) VALUES (?)').run(key).changes === 1;
}

// ---- the popup inside the website (service partners) --------------------------------------------
export function pushInApp(providerId, { kind, title, body, groupId = null }) {
  db.prepare('INSERT INTO provider_notifications (provider_id, kind, title, body, group_id) VALUES (?,?,?,?,?)')
    .run(providerId, kind, title, body, groupId);
}

export function listInApp(providerId, { unreadOnly = true, limit = 20 } = {}) {
  const rows = db.prepare(
    `SELECT id, kind, title, body, group_id, created_at, read_at FROM provider_notifications
     WHERE provider_id = ? ${unreadOnly ? 'AND read_at IS NULL' : ''} ORDER BY id DESC LIMIT ?`).all(providerId, limit);
  const unread = db.prepare('SELECT COUNT(*) AS n FROM provider_notifications WHERE provider_id = ? AND read_at IS NULL').get(providerId).n;
  return { notifications: rows, unread };
}

// ids: array of notification ids, or 'all'. Only ever touches the caller's own rows.
export function markInAppRead(providerId, ids) {
  if (ids === 'all') {
    db.prepare(`UPDATE provider_notifications SET read_at = datetime('now') WHERE provider_id = ? AND read_at IS NULL`).run(providerId);
    return;
  }
  const mark = db.prepare(`UPDATE provider_notifications SET read_at = datetime('now') WHERE id = ? AND provider_id = ? AND read_at IS NULL`);
  for (const id of ids) mark.run(Number(id), providerId);
}
