// Leave-arbitrage engine.
//
// Given a target trip length, it slides a window across the next 52 weeks and
// finds the start dates that maximise consecutive days off while spending the
// FEWEST company leaves — by stacking the trip onto weekends + public holidays.
//
// Required leaves for a window of N consecutive days:
//   requiredLeaves = N − (weekend days in window) − (public holidays on weekdays)
//
// Worked example from the spec: a 9-day window Sat→following-Sun containing one
// public holiday has 4 weekend days + 1 holiday = 5 free, so 4 leaves. ✓

import { addDays, isWeekend, parseISO, toISO, startOfToday } from './dates.js';

const HORIZON_DAYS = 52 * 7; // crawl 52 calendar weeks

/**
 * @param {Object}   opts
 * @param {number}   opts.length        target total days off (window size)
 * @param {Array}    opts.holidays      [{ Date: 'YYYY-MM-DD', Holiday_Name }]
 * @param {Date}     [opts.from]        first candidate start (default: today)
 * @param {number}   [opts.maxResults]  how many blocks to return (default 6)
 * @returns {Array<Block>} sorted best-first (fewest leaves, then soonest)
 */
export function optimizeLeave({
  length,
  holidays = [],
  from = startOfToday(),
  maxResults = 6,
}) {
  const N = Math.max(1, Math.round(length));
  const holidayMap = new Map(holidays.map((h) => [h.Date, h.Holiday_Name]));

  const blocks = [];
  for (let offset = 0; offset <= HORIZON_DAYS - N; offset++) {
    const start = addDays(from, offset);
    const block = analyzeWindow(start, N, holidayMap);
    blocks.push(block);
  }

  blocks.sort((a, b) => {
    // 1) fewest leaves  2) best efficiency  3) soonest
    if (a.requiredLeaves !== b.requiredLeaves)
      return a.requiredLeaves - b.requiredLeaves;
    if (b.efficiency !== a.efficiency) return b.efficiency - a.efficiency;
    return a.startISO < b.startISO ? -1 : 1;
  });

  // De-dup heavily overlapping windows so the user sees distinct options.
  const picked = [];
  for (const b of blocks) {
    if (picked.length >= maxResults) break;
    const clash = picked.some(
      (p) => Math.abs(daysApart(p.startISO, b.startISO)) < Math.ceil(N / 2)
    );
    if (!clash) picked.push(b);
  }
  return picked;
}

/** Analyse a single N-day window starting at `start` (a Date). */
export function analyzeWindow(start, N, holidayMap) {
  let weekendDays = 0;
  let holidayDays = 0; // holidays that fall on a weekday (otherwise redundant)
  const breakdown = [];

  for (let i = 0; i < N; i++) {
    const d = addDays(start, i);
    const iso = toISO(d);
    const weekend = isWeekend(d);
    const holidayName = holidayMap.get(iso);
    let kind = 'leave';
    if (weekend) {
      weekendDays++;
      kind = 'weekend';
    } else if (holidayName) {
      holidayDays++;
      kind = 'holiday';
    }
    breakdown.push({ iso, kind, holidayName: holidayName || null });
  }

  const requiredLeaves = N - weekendDays - holidayDays;
  const end = addDays(start, N - 1);
  return {
    startISO: toISO(start),
    endISO: toISO(end),
    totalDays: N,
    weekendDays,
    holidayDays,
    requiredLeaves: Math.max(0, requiredLeaves),
    // days off gained per leave burned — higher is better arbitrage
    efficiency: requiredLeaves > 0 ? +(N / requiredLeaves).toFixed(2) : N,
    breakdown,
  };
}

function daysApart(isoA, isoB) {
  return Math.round((parseISO(isoB) - parseISO(isoA)) / 86400000);
}
