// Small set of timezone-safe date helpers. All work on local-midnight Date
// objects and ISO YYYY-MM-DD strings to avoid UTC drift bugs.

export function parseISO(iso) {
  // Construct at local midnight (not UTC) so day-of-week is correct locally.
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function toISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

export function isWeekend(date) {
  const day = date.getDay();
  return day === 0 || day === 6; // Sun | Sat
}

/** Whole-day diff (b - a), ignoring time-of-day. */
export function daysBetween(a, b) {
  const ms = parseDay(b) - parseDay(a);
  return Math.round(ms / 86400000);
}

function parseDay(x) {
  const d = x instanceof Date ? new Date(x) : parseISO(x);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

const FMT = { day: 'numeric', month: 'short' };
export function fmtRange(startISO, endISO) {
  const s = parseISO(startISO);
  const e = parseISO(endISO);
  const sameYear = s.getFullYear() === e.getFullYear();
  const sStr = s.toLocaleDateString(undefined, FMT);
  const eStr = e.toLocaleDateString(undefined, {
    ...FMT,
    year: 'numeric',
  });
  return `${sStr}${sameYear ? '' : ' ' + s.getFullYear()} – ${eStr}`;
}

export function fmtNice(iso) {
  return parseISO(iso).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
