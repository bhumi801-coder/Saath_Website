// All service dates are calendar dates in India (IST). Using toISOString() would give the UTC
// date, which is "yesterday" between midnight and 5:30 am IST and broke date validation.
const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' });

export const todayIST = () => fmt.format(new Date()); // YYYY-MM-DD

export function addDays(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}

export const weekdayOf = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
};

export function nextWeekday(weekday, minDaysAhead = 2) {
  let d = addDays(todayIST(), minDaysAhead);
  while (weekdayOf(d) !== weekday) d = addDays(d, 1);
  return d;
}

export const isRealDate = (iso) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const [y, m, d] = iso.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
};
