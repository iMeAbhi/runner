// Leave Arbitrage / Optimization Engine.
//
// Uses a sliding-window scan across a 52-week horizon (104 weekend days) to
// find trip windows that maximise consecutive days off while spending the
// fewest company leaves. A "required leave" is any day inside the window that
// is neither a weekend nor a public holiday.
//
// Worked example from spec:
//   A 9-day window Sat..(next) Sun containing 1 public holiday →
//   9 days - 4 weekend days - 1 holiday = exactly 4 required company leaves.

import { holidaySet, resolveHolidays } from './holidays.js';

const DAY_MS = 24 * 60 * 60 * 1000;

/* ── Date helpers (local-time, DST-safe via noon anchoring) ───────────── */

export function toISO(d) {
  const x = new Date(d);
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
}
export function fromISO(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0); // noon avoids DST edge slips
}
export function addDays(date, n) {
  const x = new Date(date);
  x.setDate(x.getDate() + n);
  return x;
}
export function daysBetween(aIso, bIso) {
  return Math.round((fromISO(bIso) - fromISO(aIso)) / DAY_MS);
}
function pad(n) {
  return String(n).padStart(2, '0');
}

/** Default weekend = Saturday(6) & Sunday(0). Configurable for Fri/Sat weeks. */
export const DEFAULT_WEEKEND = [0, 6];

function isWeekend(date, weekend) {
  return weekend.includes(date.getDay());
}

/**
 * Analyse a single fixed window [startIso .. startIso + length - 1].
 * @returns breakdown incl. requiredLeaves and the specific leave dates.
 */
export function analyzeWindow(startIso, length, holidaysIsoSet, weekend = DEFAULT_WEEKEND) {
  const start = fromISO(startIso);
  let weekendDays = 0;
  let holidayDays = 0;
  const leaveDates = [];
  const dayBreakdown = [];

  for (let i = 0; i < length; i++) {
    const day = addDays(start, i);
    const iso = toISO(day);
    const weekendDay = isWeekend(day, weekend);
    const holiday = holidaysIsoSet.has(iso);

    let kind;
    if (holiday) {
      holidayDays++;
      kind = 'holiday';
    } else if (weekendDay) {
      weekendDays++;
      kind = 'weekend';
    } else {
      leaveDates.push(iso);
      kind = 'leave';
    }
    dayBreakdown.push({ date: iso, dow: day.getDay(), kind });
  }

  const endIso = toISO(addDays(start, length - 1));
  return {
    startDate: startIso,
    endDate: endIso,
    length,
    weekendDays,
    holidayDays,
    requiredLeaves: leaveDates.length,
    freeDays: weekendDays + holidayDays, // days off "for free"
    leaveDates,
    dayBreakdown,
    // Efficiency: total days off per leave spent (higher = better arbitrage).
    efficiency: leaveDates.length === 0 ? length : +(length / leaveDates.length).toFixed(2),
  };
}

/**
 * Slide a window of `tripLength` days across the horizon and rank options.
 *
 * @param {object}   opts
 * @param {number}   opts.tripLength      desired total trip length in days
 * @param {object[]} opts.holidays        active holiday list [{date,name}]
 * @param {Date|string} [opts.startFrom]  earliest start (default: today)
 * @param {number}   [opts.horizonWeeks]  weeks to scan ahead (default 52)
 * @param {number[]} [opts.weekend]       weekend day indices (default Sat/Sun)
 * @param {number}   [opts.maxResults]    cap on returned windows (default 12)
 * @returns {object[]} ranked window analyses (fewest leaves, then soonest)
 */
export function findOptimalWindows({
  tripLength,
  holidays,
  startFrom = new Date(),
  horizonWeeks = 52,
  weekend = DEFAULT_WEEKEND,
  maxResults = 12,
}) {
  const len = Math.max(1, Math.floor(tripLength));
  const hSet = holidaySet(resolveHolidays(holidays));
  const start = typeof startFrom === 'string' ? fromISO(startFrom) : new Date(startFrom);
  const horizonDays = horizonWeeks * 7;

  const candidates = [];
  for (let offset = 0; offset <= horizonDays; offset++) {
    const startIso = toISO(addDays(start, offset));
    candidates.push(analyzeWindow(startIso, len, hSet, weekend));
  }

  // Rank: fewest required leaves, then highest efficiency, then soonest start.
  candidates.sort(
    (a, b) =>
      a.requiredLeaves - b.requiredLeaves ||
      b.efficiency - a.efficiency ||
      a.startDate.localeCompare(b.startDate),
  );

  // De-duplicate near-identical overlapping windows to surface distinct blocks.
  const picked = [];
  for (const c of candidates) {
    const tooClose = picked.some(
      (p) => Math.abs(daysBetween(p.startDate, c.startDate)) < Math.ceil(len / 2),
    );
    if (!tooClose) picked.push(c);
    if (picked.length >= maxResults) break;
  }
  return picked;
}

/**
 * Annual time-off percentage = total non-working days / 365 * 100.
 * Non-working days = weekends in the year + holidays + leaves taken.
 *
 * @param {object} opts
 * @param {object[]} opts.holidays   active holiday list
 * @param {number}   opts.leavesTaken company leaves consumed this year
 * @param {number}   [opts.year]
 * @param {number[]} [opts.weekend]
 */
export function annualTimeOffPercent({ holidays, leavesTaken = 0, year = new Date().getFullYear(), weekend = DEFAULT_WEEKEND }) {
  const daysInYear = isLeapYear(year) ? 366 : 365;

  // Count weekend days in the year.
  let weekendCount = 0;
  const d = new Date(year, 0, 1, 12);
  while (d.getFullYear() === year) {
    if (weekend.includes(d.getDay())) weekendCount++;
    d.setDate(d.getDate() + 1);
  }

  // Count holidays that fall on a weekday (weekend holidays don't add days off).
  const active = resolveHolidays(holidays).filter((h) => h.date.startsWith(String(year)));
  let weekdayHolidays = 0;
  for (const h of active) {
    const day = fromISO(h.date);
    if (!weekend.includes(day.getDay())) weekdayHolidays++;
  }

  const totalNonWorking = weekendCount + weekdayHolidays + Math.max(0, leavesTaken);
  return {
    totalNonWorking,
    weekendCount,
    weekdayHolidays,
    leavesTaken,
    daysInYear,
    percent: +((totalNonWorking / daysInYear) * 100).toFixed(1),
  };
}

function isLeapYear(y) {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}
