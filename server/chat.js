// Saath assistant: POST /api/chat
//
// - With ANTHROPIC_API_KEY set, replies come from Claude (any language, free-form questions).
// - Without a key, or if the AI call fails, a built-in knowledge base answers in English, Hindi
//   (Devanagari) or Hinglish, so the chat always works.
//
// Mount it with one line in index.js:  registerChat(app, { db });
import { detectLang, match, detectService, TOPICS, GENERAL, tokenize } from './chat/knowledge.js';

const API_KEY = process.env.ANTHROPIC_API_KEY || '';
const API_URL = process.env.ANTHROPIC_API_URL || 'https://api.anthropic.com/v1/messages';
const MODEL = process.env.CHAT_MODEL || 'claude-haiku-5-5';
const SUPPORT = process.env.SUPPORT_EMAIL || 'support@saath.in';
const MAX_MESSAGES = 10;      // history sent with each question
const MAX_CHARS = 600;        // per message

const hits = new Map();
function allowed(ip) {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter((t) => now - t < 10 * 60_000);
  if (arr.length >= 40) return false;
  arr.push(now); hits.set(ip, arr);
  return true;
}
setInterval(() => { const now = Date.now(); for (const [k, v] of hits) if (v.every((t) => now - t > 3_600_000)) hits.delete(k); }, 600_000).unref();

const stripMarkdown = (s) => s.replace(/\*\*(.+?)\*\*/g, '$1').replace(/^#{1,6}\s+/gm, '').replace(/`/g, '').trim();

function systemPrompt(services) {
  const list = services.map((s) => `- ${s.slug}: ${s.name}. ${s.tagline} Regular price Rs ${s.regular_price} per ${s.unit_label}. Includes: ${JSON.parse(s.includes).join(', ')}.`).join('\n');
  return `You are the Saath assistant, a friendly helper on the Saath website. Saath lets neighbours in a housing society in Uttar Pradesh book home and car services together; when enough flats join a group, everyone gets a lower group price. Joining is free. Payment can be online (UPI, card, netbanking) or after the service. Each group has a date and an arrival time slot.

Services:
${list}

How to answer:
- Reply in the same language and script the user wrote in: Hindi in Devanagari, English, or Hinglish (Hindi written in English letters). If the user mixes, follow their latest message.
- Help with home problems (for example "AC is leaking water", "RO water tastes bad", "cockroaches in kitchen"). Give the likely causes and 2 to 4 safe things they can try right now, then say when a technician is needed.
- Safety first: for sparks, burning smell, smoke, electric shock, or a gas smell, tell them to switch the appliance off at the MCB, move away, and call 112 if there is fire or smoke. Never tell people to open an outdoor AC unit, handle refrigerant gas, repair wiring, or mix cleaning chemicals.
- Keep replies short and plain: under 120 words, no markdown, no bold, no headings. Use simple numbered lines when listing steps.
- Only quote prices from the list above (regular price). The group price depends on the group and is shown on the group page. Never invent prices, discounts, offers, phone numbers or partner names.
- If a service fits the user's problem, end your reply with a single tag on its own line: [[service:SLUG]] using the slug from the list (for example [[service:ac-repair]]). Use at most one tag, and none for greetings, emergencies or general questions.
- For anything about accounts, refunds or complaints you cannot solve, point to support at ${SUPPORT}.
- If asked about something unrelated to Saath or home services, politely say you can only help with Saath and home service questions.
- You are an AI assistant. Do not claim to be a human.`;
}

async function askClaude(services, history, signal) {
  const res = await fetch(API_URL, {
    method: 'POST', signal,
    headers: { 'content-type': 'application/json', 'x-api-key': API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: MODEL, max_tokens: 600, system: systemPrompt(services), messages: history }),
  });
  if (!res.ok) throw new Error(`Anthropic API ${res.status}`);
  const data = await res.json();
  const text = (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n');
  if (!text.trim()) throw new Error('empty reply');
  return text;
}

function builtIn(services, history) {
  const users = history.filter((m) => m.role === 'user').map((m) => m.content);
  const last = users[users.length - 1] || '';
  const prev = users[users.length - 2] || '';
  const prevLang = prev ? detectLang(prev, 'en') : 'en';
  const lang = detectLang(last, prevLang);
  let m = match(last);
  let slug = detectService(last);
  // short follow-ups ("and the price?") borrow the topic of the previous message
  if (m.kind === 'fallback' && prev) { m = match(`${prev} ${last}`); slug = slug || detectService(prev); }
  if ((m.kind === 'price' || m.kind === 'book') && !slug) slug = detectService(prev);

  const bySlug = Object.fromEntries(services.map((s) => [s.slug, s]));
  let reply; let service = null;
  if (m.kind === 'topic') {
    reply = m.topic[lang].replace('{{support}}', SUPPORT); service = m.topic.service || null;
  } else if (m.kind === 'price') {
    if (slug && bySlug[slug]) { reply = GENERAL.price.one[lang](bySlug[slug]); service = slug; }
    else {
      const list = services.map((s) => `- ${s.name}: ₹${s.regular_price} / ${s.unit_label}`).join('\n');
      reply = GENERAL.price.all[lang](list);
    }
  } else if (m.kind === 'book') {
    reply = GENERAL.book[lang]; service = slug;
  } else {
    reply = GENERAL[m.kind][lang];
  }
  if (service && !bySlug[service]) service = null;
  return { reply, service, lang };
}

export function registerChat(app, { db }) {
  app.get('/api/chat/status', (_req, res) => res.json({ ai: Boolean(API_KEY), model: API_KEY ? MODEL : null }));

  app.post('/api/chat', async (req, res) => {
    if (!allowed(req.ip)) return res.status(429).json({ error: 'Too many messages. Please wait a few minutes.' });
    const raw = Array.isArray(req.body?.messages) ? req.body.messages : [];
    const history = raw
      .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
      .map((m) => ({ role: m.role, content: m.content.trim().slice(0, MAX_CHARS) }))
      .slice(-MAX_MESSAGES);
    while (history.length && history[0].role !== 'user') history.shift();
    if (!history.length || history[history.length - 1].role !== 'user') {
      return res.status(400).json({ error: 'Type a message first.' });
    }

    const services = db.prepare('SELECT slug, name, tagline, unit_label, regular_price, includes FROM services ORDER BY id').all();
    const slugs = new Set(services.map((s) => s.slug));

    if (API_KEY) {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), 20_000);
      try {
        const text = await askClaude(services, history, ctl.signal);
        const tag = text.match(/\[\[service:([a-z-]+)\]\]/);
        const reply = stripMarkdown(text.replace(/\[\[service:[a-z-]+\]\]/g, ''));
        return res.json({ reply, service: tag && slugs.has(tag[1]) ? tag[1] : null, source: 'ai' });
      } catch (e) {
        console.warn('[chat] AI call failed, using built-in answers:', e.message);
      } finally { clearTimeout(timer); }
    }
    const out = builtIn(services, history);
    res.json({ reply: out.reply, service: out.service, source: 'builtin', lang: out.lang });
  });
}

export { TOPICS, tokenize, builtIn };
