// Extensible "Quests" engine. Each quest is a self-contained definition object;
// adding a new travel mission (e.g. "Metros of India", "UNESCO Sites",
// "International Borders") is just appending another object to QUESTS with its
// own milestone list + matcher. The Quests tab renders any quest generically
// from the shape returned by `compute()`.
//
// A quest's compute(trips, settings) returns:
//   {
//     pct,                         // 0-100 overall progress
//     doneCount, total,            // milestone tallies
//     summary,                     // short headline e.g. "5 of 12 cleared"
//     items: [                     // every milestone, visited or not
//       { id, name, subtitle, done, lat, lng }
//     ],
//   }

import { INDIA_STATES, matchRegion } from './indiaStates.js';
import { REGION_COORDS } from './geo.js';

const norm = (s) => (s || '').trim().toLowerCase();

/** Haystack of every place-ish field on a trip, lowercased, for keyword tests. */
function tripHaystack(t) {
  return norm(`${t.City || ''} ${t.State_Country || ''}`);
}

// ── Quest A: India coverage — all 36 States & UTs ───────────────────────────
function computeIndiaCoverage(trips) {
  const covered = new Set();
  for (const t of trips) {
    const region = matchRegion(`${t.State_Country || ''} ${t.City || ''}`);
    if (region) covered.add(region);
  }
  const items = INDIA_STATES.map((r) => {
    const [lat, lng] = REGION_COORDS[r.name] || [];
    return {
      id: r.name,
      name: r.name,
      subtitle: r.type === 'ut' ? 'Union Territory' : 'State',
      done: covered.has(r.name),
      lat,
      lng,
    };
  });
  const doneCount = covered.size;
  const total = INDIA_STATES.length;
  return {
    pct: Math.round((doneCount / total) * 100),
    doneCount,
    total,
    summary: `${doneCount} of ${total} States & UTs`,
    items,
  };
}

// ── Quest B: the 12 Jyotirlingas ────────────────────────────────────────────
// Each site lists keyword aliases; a trip "clears" it when any alias appears in
// the trip's City / State_Country fields (so logging "Ujjain" flags Mahakaleshwar).
export const JYOTIRLINGAS = [
  { id: 'somnath', name: 'Somnath', region: 'Gujarat', lat: 20.89, lng: 70.40, keys: ['somnath', 'prabhas'] },
  { id: 'mallikarjuna', name: 'Mallikarjuna', region: 'Andhra Pradesh', lat: 16.07, lng: 78.87, keys: ['mallikarjuna', 'srisailam'] },
  { id: 'mahakaleshwar', name: 'Mahakaleshwar', region: 'Madhya Pradesh', lat: 23.18, lng: 75.77, keys: ['mahakaleshwar', 'ujjain'] },
  { id: 'omkareshwar', name: 'Omkareshwar', region: 'Madhya Pradesh', lat: 22.24, lng: 76.15, keys: ['omkareshwar', 'mamleshwar'] },
  { id: 'kedarnath', name: 'Kedarnath', region: 'Uttarakhand', lat: 30.73, lng: 79.07, keys: ['kedarnath'] },
  { id: 'bhimashankar', name: 'Bhimashankar', region: 'Maharashtra', lat: 19.07, lng: 73.54, keys: ['bhimashankar'] },
  { id: 'kashi', name: 'Kashi Vishwanath', region: 'Uttar Pradesh', lat: 25.31, lng: 83.01, keys: ['kashi vishwanath', 'kashi', 'varanasi', 'banaras'] },
  { id: 'trimbakeshwar', name: 'Trimbakeshwar', region: 'Maharashtra', lat: 19.93, lng: 73.53, keys: ['trimbakeshwar', 'trimbak'] },
  { id: 'vaidyanath', name: 'Vaidyanath', region: 'Jharkhand', lat: 24.49, lng: 86.70, keys: ['vaidyanath', 'baidyanath', 'deoghar'] },
  { id: 'nageshwar', name: 'Nageshwar', region: 'Gujarat', lat: 22.27, lng: 69.08, keys: ['nageshwar', 'nageshvar', 'dwarka'] },
  { id: 'rameshwaram', name: 'Rameshwaram', region: 'Tamil Nadu', lat: 9.29, lng: 79.31, keys: ['rameshwaram', 'rameswaram', 'ramanathaswamy'] },
  { id: 'grishneshwar', name: 'Grishneshwar', region: 'Maharashtra', lat: 20.02, lng: 75.18, keys: ['grishneshwar', 'grushneshwar', 'ellora', 'verul'] },
];

function computeJyotirlingas(trips) {
  const haystacks = trips.map(tripHaystack);
  const items = JYOTIRLINGAS.map((site) => ({
    id: site.id,
    name: site.name,
    subtitle: site.region,
    lat: site.lat,
    lng: site.lng,
    done: haystacks.some((h) => site.keys.some((k) => h.includes(k))),
  }));
  const doneCount = items.filter((i) => i.done).length;
  const total = items.length;
  return {
    pct: Math.round((doneCount / total) * 100),
    doneCount,
    total,
    summary: `${doneCount} of ${total} cleared`,
    items,
  };
}

// ── Quest registry ──────────────────────────────────────────────────────────
// Append new quest objects here to extend the tab. `aura` controls the visited
// node/card glow colour; `accent` is an optional ring/line tint.
export const QUESTS = [
  {
    id: 'india',
    label: 'India Map',
    blurb: 'States & Union Territories',
    aura: 'accent',
    compute: computeIndiaCoverage,
    // India quest plots every region (visited glow, rest faint).
    showAllNodes: true,
  },
  {
    id: 'jyotirling',
    label: 'Pilgrim Circuit',
    blurb: 'The 12 sacred Jyotirlingas',
    aura: 'gold',
    compute: computeJyotirlingas,
    showAllNodes: true,
  },
];

export function questById(id) {
  return QUESTS.find((q) => q.id === id) || QUESTS[0];
}
