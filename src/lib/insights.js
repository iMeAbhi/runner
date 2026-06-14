// Analytics computations for the Insights dashboard and per-city Fun Insights.

import { daysBetween, fromISO, toISO } from './leaveOptimizer.js';

/** Inclusive day count for a trip (start & end same day = 1). */
export function tripDays(trip) {
  if (!trip.startDate) return 0;
  const end = trip.endDate || trip.startDate;
  return Math.max(1, daysBetween(trip.startDate, end) + 1);
}

/** Trip lifecycle status relative to `now`. */
export function tripStatus(trip, now = new Date()) {
  const todayIso = toISO(now);
  const start = trip.startDate;
  const end = trip.endDate || trip.startDate;
  if (todayIso < start) return 'upcoming';
  if (todayIso > end) return 'past';
  return 'active';
}

/** Filter trips whose date range intersects the last N months window. */
export function filterByWindow(trips, months, customRange = null) {
  if (customRange?.from && customRange?.to) {
    return trips.filter((t) => {
      const s = t.startDate;
      const e = t.endDate || t.startDate;
      return e >= customRange.from && s <= customRange.to;
    });
  }
  if (!months) return trips;
  const from = new Date();
  from.setMonth(from.getMonth() - months);
  const fromIso = toISO(from);
  return trips.filter((t) => (t.endDate || t.startDate) >= fromIso);
}

/** Days since the most recent completed/active trip ended. */
export function daysSinceLastTrip(trips, now = new Date()) {
  const ended = trips
    .map((t) => t.endDate || t.startDate)
    .filter(Boolean)
    .sort();
  if (!ended.length) return null;
  const last = ended[ended.length - 1];
  return daysBetween(last, toISO(now));
}

/** Mode counts a string field across trips (case-insensitive), returns sorted. */
function frequency(trips, field) {
  const map = new Map();
  for (const t of trips) {
    const v = (t[field] || '').toString().trim();
    if (!v) continue;
    const key = v.toLowerCase();
    const e = map.get(key) || { label: v, count: 0 };
    e.count++;
    map.set(key, e);
  }
  return [...map.values()].sort((a, b) => b.count - a.count);
}

/**
 * Full dashboard metric bundle for a set of (already filtered) trips.
 */
export function computeAnalytics(trips) {
  const cities = frequency(trips, 'city');
  const states = frequency(trips, 'state');
  const countries = frequency(trips, 'country');

  // Volumetric transit counts. Each trip may carry a `transit` array of types.
  let flights = 0;
  let trains = 0;
  let cabs = 0;
  let hotels = 0;
  for (const t of trips) {
    const modes = Array.isArray(t.transit) ? t.transit : t.transit ? [t.transit] : [];
    for (const m of modes) {
      const k = m.toString().toLowerCase();
      if (k.includes('flight') || k.includes('air') || k.includes('plane')) flights++;
      else if (k.includes('train') || k.includes('rail')) trains++;
      else if (k.includes('cab') || k.includes('car') || k.includes('taxi') || k.includes('bus')) cabs++;
    }
    if (t.accommodation && t.accommodation.toString().trim()) hotels++;
  }

  // Longest continuous trip.
  let longest = null;
  for (const t of trips) {
    const d = tripDays(t);
    if (!longest || d > longest.days) longest = { trip: t, days: d };
  }

  const totalDays = trips.reduce((sum, t) => sum + tripDays(t), 0);

  return {
    tripCount: trips.length,
    uniqueCities: cities.length,
    uniqueStates: states.length,
    uniqueCountries: countries.length,
    flights,
    trains,
    cabs,
    hotels,
    totalDays,
    longestTrip: longest,
    mostVisitedCity: cities[0] || null,
    mostVisitedState: states[0] || null,
    // "Most explored hub" = area with the most distinct sub-entries logged.
    mostExploredHub: states[0] || cities[0] || null,
    cityRanking: cities,
    stateRanking: states,
  };
}

/**
 * Fun Insights for a single city deep-dive:
 * "Visited X times, Y cumulative days, Z% of your annual travels."
 */
export function cityFunInsights(allTrips, cityName) {
  const key = (cityName || '').trim().toLowerCase();
  const here = allTrips.filter((t) => (t.city || '').trim().toLowerCase() === key);
  const visits = here.length;
  const cumulativeDays = here.reduce((s, t) => s + tripDays(t), 0);

  // % of annual travels — share of this year's total travel days spent here.
  const year = new Date().getFullYear();
  const thisYearTrips = allTrips.filter((t) => (t.startDate || '').startsWith(String(year)));
  const yearDays = thisYearTrips.reduce((s, t) => s + tripDays(t), 0);
  const hereYearDays = here
    .filter((t) => (t.startDate || '').startsWith(String(year)))
    .reduce((s, t) => s + tripDays(t), 0);
  const percentOfAnnual = yearDays ? Math.round((hereYearDays / yearDays) * 100) : 0;

  return { visits, cumulativeDays, percentOfAnnual };
}
