// The "implicit reset" engine: auto-closes a dangling open trip when a new leg
// departs from home. Pure function, depends only on date helpers (layover and
// distance helpers live in insights.js to avoid an import cycle).

import { parseISO, toISO, addDays, daysBetween } from './dates.js';

const norm = (s) => (s || '').trim().toLowerCase();

/** A trip with no End_Date is an "open leg" (flew out, not yet returned). */
export function isOpenLeg(trip) {
  return !!trip.Start_Date && !trip.End_Date;
}

/**
 * Implicit Reset Engine.
 * Given an incoming leg and the current trips array, decide whether a previous
 * dangling open trip must be auto-closed. Returns { leg, closed } where `closed`
 * is the updated previous trip (with End_Date + autoClosed:true) or null.
 *
 * Rule: if the new leg departs FROM home (Origin_City === homeLocation) while the
 * most recent trip is still open in a *different* city, you can't have flown out
 * of home while logically still away — so close that trip. If the gap since it
 * started exceeds a weekend sprint (> 4 days) we can't know the real return date,
 * so we close it to start + 1 day and flag it for the user to adjust; within a
 * sprint we assume the return coincided with this new departure.
 */
export function processNewVectorLeg(newLegData, currentTripsState = [], homeLocation = '') {
  const leg = { ...newLegData };
  const home = norm(homeLocation);
  if (!home || norm(leg.Origin_City) !== home) return { leg, closed: null };

  // Most recent prior trip by start date (exclude the leg itself if present).
  const prior = currentTripsState
    .filter((t) => t.ID !== leg.ID && t.Start_Date)
    .sort((a, b) => (a.Start_Date < b.Start_Date ? 1 : -1))[0];

  if (!prior || !isOpenLeg(prior) || norm(prior.City) === home) return { leg, closed: null };

  const gap = leg.Start_Date ? daysBetween(prior.Start_Date, leg.Start_Date) : 0;
  let endDate;
  let autoClosed = false;
  if (gap > 4) {
    endDate = toISO(addDays(parseISO(prior.Start_Date), 1)); // unknown return → +1 buffer
    autoClosed = true;
  } else {
    endDate = leg.Start_Date || toISO(addDays(parseISO(prior.Start_Date), gap)); // weekend sprint
  }
  const closed = { ...prior, End_Date: endDate, autoClosed };
  return { leg, closed };
}
