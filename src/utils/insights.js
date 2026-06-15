// Pure analytics helpers over the trip dataset. No React, no side effects —
// every function takes data in and returns plain values so they're trivial to
// test and reuse across the Timeline, Analytics and Planner tabs.

import { parseISO, isWeekend, addDays, daysBetween, startOfToday } from './dates.js';
import { matchRegion, INDIA_STATES, TOTAL_INDIA_REGIONS } from '../data/indiaStates.js';

const MODE = {
  flight: ['flight', 'plane', 'air', 'fly'],
  train: ['train', 'rail'],
  cab: ['cab', 'car', 'taxi', 'drive', 'bus', 'road'],
  walk: ['walk', 'trek', 'hike'],
};

export function classifyTransport(mode = '') {
  const m = mode.toLowerCase();
  for (const [key, words] of Object.entries(MODE)) {
    if (words.some((w) => m.includes(w))) return key;
  }
  return 'other';
}

/** Inclusive trip length in days. */
export function tripDays(trip) {
  if (!trip.Start_Date || !trip.End_Date) return 0;
  return Math.max(1, daysBetween(trip.Start_Date, trip.End_Date) + 1);
}

export function photoList(trip) {
  return (trip.Photo_URLs || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Trips whose date range intersects the last `months` months from today. */
export function filterByMonths(trips, months) {
  if (!months) return trips;
  const cutoff = addDays(startOfToday(), -Math.round(months * 30));
  return trips.filter((t) => t.End_Date && parseISO(t.End_Date) >= cutoff);
}

export function filterByRange(trips, startISO, endISO) {
  const s = parseISO(startISO);
  const e = parseISO(endISO);
  return trips.filter((t) => {
    if (!t.Start_Date || !t.End_Date) return false;
    return parseISO(t.End_Date) >= s && parseISO(t.Start_Date) <= e;
  });
}

/** Volumetric + duration + frequency metrics for a (filtered) trip set. */
export function computeStats(trips) {
  const cities = new Set();
  const countries = new Set();
  const cityCount = {};
  const regionCount = {};
  let flights = 0;
  let trains = 0;
  let cabs = 0;
  let hotels = 0;
  let longest = null;

  for (const t of trips) {
    if (t.City) {
      cities.add(t.City.trim().toLowerCase());
      cityCount[t.City.trim()] = (cityCount[t.City.trim()] || 0) + 1;
    }
    if (t.State_Country) {
      countries.add(t.State_Country.trim().toLowerCase());
      regionCount[t.State_Country.trim()] =
        (regionCount[t.State_Country.trim()] || 0) + 1;
    }
    const mode = classifyTransport(t.Transport_Mode);
    if (mode === 'flight') flights++;
    if (mode === 'train') trains++;
    if (mode === 'cab') cabs++;
    if (t.Accommodation && /hotel|resort|stay|inn|airbnb|lodge/i.test(t.Accommodation))
      hotels++;

    const len = tripDays(t);
    if (!longest || len > longest.days) longest = { trip: t, days: len };
  }

  return {
    totalTrips: trips.length,
    uniqueCities: cities.size,
    uniqueRegions: countries.size,
    flights,
    trains,
    cabs,
    hotels,
    longest,
    topCity: topEntry(cityCount),
    topRegion: topEntry(regionCount),
    totalDays: trips.reduce((a, t) => a + tripDays(t), 0),
  };
}

function topEntry(map) {
  let best = null;
  for (const [name, count] of Object.entries(map)) {
    if (!best || count > best.count) best = { name, count };
  }
  return best;
}

/**
 * Per-hub "Fun Insights": how many times a city was visited, cumulative days,
 * and what fraction of all logged travel days it represents.
 */
export function cityInsights(allTrips, city) {
  const key = (city || '').trim().toLowerCase();
  const visits = allTrips.filter((t) => (t.City || '').trim().toLowerCase() === key);
  const days = visits.reduce((a, t) => a + tripDays(t), 0);
  const totalDays = allTrips.reduce((a, t) => a + tripDays(t), 0) || 1;
  return {
    visitCount: visits.length,
    cumulativeDays: days,
    sharePct: Math.round((days / totalDays) * 100),
  };
}

/** Which of the 36 India regions are covered, and which remain. */
export function indiaCoverage(trips) {
  const covered = new Set();
  for (const t of trips) {
    const region = matchRegion(`${t.State_Country || ''} ${t.City || ''}`);
    if (region) covered.add(region);
  }
  const remaining = INDIA_STATES.filter((r) => !covered.has(r.name)).map(
    (r) => r.name
  );
  return {
    covered: [...covered],
    coveredCount: covered.size,
    total: TOTAL_INDIA_REGIONS,
    pct: Math.round((covered.size / TOTAL_INDIA_REGIONS) * 100),
    remaining,
  };
}

/**
 * Annual time-off percentage:  (Total Non-Working Days ÷ 365) × 100
 * Non-working days in the rolling year = weekends + non-weekend public holidays
 * + leave/trip days that land on an otherwise-working weekday.
 */
export function annualTimeOff(trips, holidays) {
  const today = startOfToday();
  const yearStart = addDays(today, -364);
  let weekend = 0;
  for (let i = 0; i < 365; i++) {
    if (isWeekend(addDays(yearStart, i))) weekend++;
  }
  const holidaySet = new Set(
    holidays
      .map((h) => h.Date)
      .filter((d) => {
        const dt = parseISO(d);
        return dt >= yearStart && dt <= today && !isWeekend(dt);
      })
  );
  // Count working-day trip days inside the rolling year (avoid double-counting
  // weekends/holidays already tallied).
  const tripWorkdays = new Set();
  for (const t of trips) {
    if (!t.Start_Date || !t.End_Date) continue;
    const len = tripDays(t);
    for (let i = 0; i < len; i++) {
      const d = addDays(parseISO(t.Start_Date), i);
      if (d < yearStart || d > today) continue;
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (!isWeekend(d) && !holidaySet.has(iso)) tripWorkdays.add(iso);
    }
  }
  const totalNonWorking = weekend + holidaySet.size + tripWorkdays.size;
  return {
    totalNonWorking,
    pct: Math.round((totalNonWorking / 365) * 100),
    weekend,
    holidays: holidaySet.size,
    tripWorkdays: tripWorkdays.size,
  };
}

/** Days since the most recent trip ended (null if no past trips). */
export function daysSinceLastTrip(trips) {
  const past = trips
    .filter((t) => t.End_Date && parseISO(t.End_Date) <= startOfToday())
    .sort((a, b) => (a.End_Date < b.End_Date ? 1 : -1));
  if (!past.length) return null;
  return daysBetween(past[0].End_Date, startOfToday());
}
