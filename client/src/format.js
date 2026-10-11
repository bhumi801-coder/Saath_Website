const inr = new Intl.NumberFormat('en-IN');
export const rupees = (n) => `₹${inr.format(n)}`;

export function parseDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}
export const longDate = (iso) =>
  parseDate(iso).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
export const shortDate = (iso) =>
  parseDate(iso).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
export const dayNumber = (iso) => parseDate(iso).getDate();
export const monthShort = (iso) => parseDate(iso).toLocaleDateString('en-IN', { month: 'short' });
export const weekdayShort = (iso) => parseDate(iso).toLocaleDateString('en-IN', { weekday: 'short' });

export function daysFromToday(iso) {
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  return Math.round((parseDate(iso) - t) / 86400000);
}
export function whenLabel(iso) {
  const n = daysFromToday(iso);
  if (n === 0) return 'Today';
  if (n === 1) return 'Tomorrow';
  if (n > 1 && n < 7) return `In ${n} days`;
  return shortDate(iso);
}

export function timeAgo(sqlDate) {
  const t = new Date(sqlDate.includes('T') ? sqlDate : sqlDate.replace(' ', 'T') + 'Z');
  const s = Math.max(1, Math.round((Date.now() - t.getTime()) / 1000));
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
}

export const plural = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`;

const pad = (n) => String(n).padStart(2, '0');
export const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export function addDaysISO(iso, n) {
  const d = parseDate(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
}
