// Offline-first local database (IndexedDB via Dexie).
//
// Trips are written here instantly — even mid-travel with no connectivity —
// and a background sync worker reconciles them with the master Google Sheet
// when the network returns. `syncState` tracks each row's reconciliation.

import Dexie from 'dexie';

export const db = new Dexie('voyage_travel_db');

db.version(1).stores({
  // localId: client-generated uuid (offline-safe primary key)
  // remoteId: row id assigned by the Google Sheet backend (once synced)
  // syncState: 'synced' | 'pending' | 'error'
  trips: '&localId, remoteId, city, state, country, startDate, endDate, syncState, updatedAt',
  // Outbound queue of mutations awaiting the backend.
  outbox: '++id, type, localId, createdAt, attempts',
  // Cached media descriptors keyed by their trip.
  media: '++id, localId, name, synced',
  // Key/value app metadata (last sync time, etc.).
  meta: '&key',
});

/* ── Trip helpers ─────────────────────────────────────────────────────── */

export function uuid() {
  if (crypto?.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export async function getAllTrips() {
  return db.trips.orderBy('startDate').reverse().toArray();
}

/** Insert or update a trip locally and enqueue it for sync. */
export async function upsertTripLocal(trip) {
  const now = new Date().toISOString();
  const record = {
    ...trip,
    localId: trip.localId || uuid(),
    syncState: 'pending',
    updatedAt: now,
  };
  await db.trips.put(record);
  await db.outbox.add({
    type: 'upsertTrip',
    localId: record.localId,
    createdAt: now,
    attempts: 0,
  });
  return record;
}

export async function deleteTripLocal(localId) {
  const trip = await db.trips.get(localId);
  await db.trips.delete(localId);
  await db.outbox.add({
    type: 'deleteTrip',
    localId,
    remoteId: trip?.remoteId || null,
    createdAt: new Date().toISOString(),
    attempts: 0,
  });
}

export async function markSynced(localId, remoteId) {
  await db.trips.update(localId, { syncState: 'synced', remoteId });
}

export async function setMeta(key, value) {
  await db.meta.put({ key, value });
}
export async function getMeta(key) {
  return (await db.meta.get(key))?.value;
}

/**
 * Replace the local trip cache with the authoritative backend snapshot,
 * preserving any rows still pending local sync.
 */
export async function hydrateFromRemote(remoteTrips) {
  await db.transaction('rw', db.trips, async () => {
    const pending = await db.trips.where('syncState').notEqual('synced').toArray();
    const pendingIds = new Set(pending.map((t) => t.localId));
    for (const r of remoteTrips) {
      const localId = r.localId || `remote-${r.remoteId}`;
      if (pendingIds.has(localId)) continue; // keep unsynced local edits
      await db.trips.put({ ...r, localId, syncState: 'synced' });
    }
  });
}

/** Export the entire local dataset for the manual backup feature. */
export async function exportAll() {
  const [trips, media, meta] = await Promise.all([
    db.trips.toArray(),
    db.media.toArray(),
    db.meta.toArray(),
  ]);
  return { exportedAt: new Date().toISOString(), trips, media, meta };
}
