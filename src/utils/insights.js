// Pure analytics helpers over the trip dataset. No React, no side effects —
// every function takes data in and returns plain values so they're trivial to
// test and reuse across the Timeline, Analytics and Planner tabs.

import { parseISO, toISO, isWeekend, addDays, daysBetween, startOfToday } from './dates.js';
import { matchRegion, INDIA_STATES, TOTAL_INDIA_REGIONS } from '../data/indiaStates.js';
import { coordsForPlace, haversineKm } from '../data/geo.js';

const MODE = {
  flight: ['flight', 'plane', 'air', 'fly'],
  train: ['train', 'rail'],
  bus: ['bus', 'coach'],
  // "Cab" was renamed to "Car" — every car/road ride is treated as a road trip.
  cab: ['car', 'cab', 'taxi', 'drive', 'road'],
  walk: ['walk', 'trek', 'hike'],
};

// Human-friendly labels for each classified mode (used in the "favourite ride").
export const MODE_LABEL = {
  flight: 'Flights ✈️',
  train: 'Trains 🚆',
  bus: 'Bus trips 🚌',
  cab: 'Road trips 🚗',
  walk: 'On foot 🥾',
  other: 'Other 📍',
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

// ── Multi-vector / layover helpers ──────────────────────────────────────────

/** Parsed layover city list from the comma-separated Layovers cell. */
export function layoverList(trip) {
  return String(trip.Layovers || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Whether this trip's layovers count as real visited destinations. */
export function layoverCountsAsVisit(trip) {
  const v = trip.Layover_Count_As_Visit;
  return v === true || String(v).trim().toUpperCase() === 'TRUE';
}

/** Layover cities that should be treated as visited (toggle ON), else []. */
export function countedLayovers(trip) {
  return layoverCountsAsVisit(trip) ? layoverList(trip) : [];
}

/**
 * Distance for a trip in km. Prefers an explicit Distance_KM (e.g. from a parsed
 * ticket); otherwise sums great-circle segments Origin → layovers → Destination
 * with whatever coordinates resolve. Layover segments always count toward
 * distance regardless of the visit toggle.
 */
export function tripDistanceKm(trip, homeLocation = '') {
  const explicit = Number(trip.Distance_KM);
  if (Number.isFinite(explicit) && explicit > 0) return Math.round(explicit);
  // Legacy/parsed rows may lack an origin — fall back to HOME_LOCATION so the
  // leg still measures something instead of collapsing to 0 km.
  const origin = trip.Origin_City || homeLocation;
  const stops = [origin, ...layoverList(trip), trip.City].map((c) =>
    c ? coordsForPlace(c) : null
  );
  let total = 0;
  for (let i = 0; i < stops.length - 1; i++) {
    if (stops[i] && stops[i + 1]) total += haversineKm(stops[i], stops[i + 1]);
  }
  return total;
}

/** Air / Rail / Road distance totals (km) across a trip set. */
export function distanceTotals(trips, homeLocation = '') {
  let air = 0;
  let rail = 0;
  let ground = 0;
  for (const t of trips) {
    const km = tripDistanceKm(t, homeLocation);
    const mode = classifyTransport(t.Transport_Mode);
    if (mode === 'flight') air += km;
    else if (mode === 'train') rail += km;
    else ground += km; // car / bus / walk / other
  }
  return { air, rail, ground, total: air + rail + ground };
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
  const cityCount = {};
  const regionCount = {};
  // States/UTs and foreign countries are genuinely different things, so we
  // tally them separately rather than lumping into one "States/Countries".
  const indianRegions = new Set();
  const foreignCountries = new Set();
  const foreignOrig = {}; // lowercased key → original-cased label for listing
  const modeCounts = {};
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
      regionCount[t.State_Country.trim()] =
        (regionCount[t.State_Country.trim()] || 0) + 1;
      const region = matchRegion(`${t.State_Country} ${t.City || ''}`);
      if (region) indianRegions.add(region);
      else {
        const key = t.State_Country.trim().toLowerCase();
        foreignCountries.add(key);
        foreignOrig[key] = t.State_Country.trim();
      }
    }
    // Toggle-ON layovers are full destinations: count their city + any Indian region.
    for (const lay of countedLayovers(t)) {
      cities.add(lay.toLowerCase());
      cityCount[lay] = (cityCount[lay] || 0) + 1;
      const layRegion = matchRegion(lay);
      if (layRegion) indianRegions.add(layRegion);
    }
    const mode = classifyTransport(t.Transport_Mode);
    modeCounts[mode] = (modeCounts[mode] || 0) + 1;
    if (mode === 'flight') flights++;
    if (mode === 'train') trains++;
    if (mode === 'cab') cabs++;
    if (t.Accommodation && /hotel|resort|stay|inn|airbnb|lodge/i.test(t.Accommodation))
      hotels++;

    const len = tripDays(t);
    if (!longest || len > longest.days) longest = { trip: t, days: len };
  }

  const topModeEntry = topEntry(modeCounts);

  return {
    totalTrips: trips.length,
    uniqueCities: cities.size,
    // Distinct Indian States & UTs visited.
    uniqueStates: indianRegions.size,
    // Distinct countries: every foreign country, plus India itself if any
    // domestic (state-matched) trip exists.
    uniqueCountries: foreignCountries.size + (indianRegions.size > 0 ? 1 : 0),
    flights,
    trains,
    cabs,
    hotels,
    longest,
    topCity: topEntry(cityCount),
    topRegion: topEntry(regionCount),
    topMode: topModeEntry
      ? { ...topModeEntry, label: MODE_LABEL[topModeEntry.name] || topModeEntry.name }
      : null,
    modeCounts,
    totalDays: trips.reduce((a, t) => a + tripDays(t), 0),
    // Lists for the Insights drill-down modals (match the counts above).
    cityCounts: Object.entries(cityCount)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count),
    statesList: [...indianRegions].sort(),
    countriesList: (indianRegions.size > 0 ? ['India'] : []).concat(
      [...foreignCountries].map((k) => foreignOrig[k]).sort()
    ),
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

// ── Top-5 leaderboards ──────────────────────────────────────────────────────
// Each returns [{ name, value, sub }] ready for <LeaderboardModal />.

/** Most-flown operators/airlines/rail brands by trip count. */
export function topOperators(trips, limit = 5) {
  const counts = {};
  for (const t of trips) {
    const op = (t.Operator_Name || '').trim();
    if (op) counts[op] = (counts[op] || 0) + 1;
  }
  return Object.entries(counts)
    .map(([name, n]) => ({ name, value: `${n} trip${n === 1 ? '' : 's'}`, count: n }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

/** Longest trips by continuous duration. */
export function longestTrips(trips, limit = 5) {
  return trips
    .map((t) => ({ name: t.City || 'Trip', count: tripDays(t), sub: t.State_Country || '' }))
    .filter((x) => x.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
    .map((x) => ({ name: x.name, value: `${x.count} day${x.count === 1 ? '' : 's'}`, sub: x.sub }));
}

/** Most-visited destination cities (includes toggle-ON layovers). */
export function topDestinations(trips, limit = 5) {
  const counts = {};
  for (const t of trips) {
    if (t.City) counts[t.City.trim()] = (counts[t.City.trim()] || 0) + 1;
    for (const lay of countedLayovers(t)) counts[lay] = (counts[lay] || 0) + 1;
  }
  return Object.entries(counts)
    .map(([name, n]) => ({ name, value: `${n} visit${n === 1 ? '' : 's'}`, count: n }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

// ── Home / current-location & life-moment insights ──────────────────────────

const norm = (s) => (s || '').trim().toLowerCase();

/** Classify a trip's city relative to the user's home / current base. */
export function locationClass(city, settings = {}) {
  const c = norm(city);
  if (!c) return 'away';
  if (settings.homeLocation && c === norm(settings.homeLocation)) return 'home';
  if (settings.currentLocation && c === norm(settings.currentLocation)) return 'current';
  return 'away';
}

/** The trip whose date range contains a given ISO date (or null). */
function tripCovering(trips, dateISO) {
  const d = parseISO(dateISO);
  return (
    trips.find(
      (t) =>
        t.Start_Date &&
        t.End_Date &&
        parseISO(t.Start_Date) <= d &&
        parseISO(t.End_Date) >= d
    ) || null
  );
}

/**
 * Visit stats for a named place (matched against trip City): how many logged
 * trips went there, total nights, and how long since the last one.
 */
export function placeVisits(trips, place) {
  const key = norm(place);
  if (!key) return null;
  const matches = trips
    .filter((t) => norm(t.City) === key && t.End_Date)
    .sort((a, b) => (a.End_Date < b.End_Date ? 1 : -1));
  const past = matches.filter((t) => parseISO(t.End_Date) <= startOfToday());
  return {
    place,
    visits: matches.length,
    totalDays: matches.reduce((a, t) => a + tripDays(t), 0),
    lastDate: past[0]?.End_Date || null,
    daysSince: past[0] ? daysBetween(past[0].End_Date, startOfToday()) : null,
  };
}

/**
 * Where New Year's was spent: scans trips that span a Jan 1, tallies the city
 * for each year and highlights the years celebrated away from home/current.
 */
export function newYearInsight(trips, settings = {}) {
  const today = startOfToday();
  const seen = new Set();
  const cityCount = {};
  const celebrations = [];
  let awayCount = 0;
  for (const t of trips) {
    if (!t.Start_Date || !t.End_Date) continue;
    const s = parseISO(t.Start_Date);
    const e = parseISO(t.End_Date);
    for (let y = s.getFullYear(); y <= e.getFullYear(); y++) {
      if (seen.has(y)) continue;
      const ny = parseISO(`${y}-01-01`);
      if (ny < s || ny > e || ny > today) continue;
      seen.add(y);
      const cls = locationClass(t.City, settings);
      celebrations.push({ year: y, city: t.City, cls });
      if (cls === 'away') {
        awayCount++;
        cityCount[t.City.trim()] = (cityCount[t.City.trim()] || 0) + 1;
      }
    }
  }
  celebrations.sort((a, b) => b.year - a.year);
  return { celebrations, awayCount, topAwayCity: topEntry(cityCount) };
}

/**
 * Birthday insight: days until the next birthday, plus where past birthdays
 * were spent (highlighting the ones away from home/current).
 * Returns null until a birthday is configured.
 */
export function birthdayInsight(trips, settings = {}) {
  if (!settings.birthday) return null;
  const [, mm, dd] = settings.birthday.split('-');
  if (!mm || !dd) return null;

  const today = startOfToday();
  let next = parseISO(`${today.getFullYear()}-${mm}-${dd}`);
  if (next < today) next = parseISO(`${today.getFullYear() + 1}-${mm}-${dd}`);
  const daysUntil = daysBetween(today, next);

  const cityCount = {};
  const celebrations = [];
  let awayCount = 0;
  const years = new Set();
  for (const t of trips) {
    if (t.Start_Date) years.add(parseISO(t.Start_Date).getFullYear());
    if (t.End_Date) years.add(parseISO(t.End_Date).getFullYear());
  }
  for (const y of years) {
    const bday = parseISO(`${y}-${mm}-${dd}`);
    if (bday > today) continue;
    const trip = tripCovering(trips, `${y}-${mm}-${dd}`);
    if (!trip) continue;
    const cls = locationClass(trip.City, settings);
    celebrations.push({ year: y, city: trip.City, cls });
    if (cls === 'away') {
      awayCount++;
      cityCount[trip.City.trim()] = (cityCount[trip.City.trim()] || 0) + 1;
    }
  }
  celebrations.sort((a, b) => b.year - a.year);
  return { daysUntil, nextDate: toISO(next), awayCount, topAwayCity: topEntry(cityCount), celebrations };
}
