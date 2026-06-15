// Minimal promise-based IndexedDB wrapper. No external deps.
//
// We use IndexedDB (not LocalStorage) so media-heavy trip records can exceed the
// ~5MB LocalStorage ceiling. Three stores:
//   trips   — keyPath "ID": the local mirror of the Trips sheet tab.
//   meta    — generic key/value (settings, last-sync, default-holiday flag).
//   outbox  — pending writes queued while offline, flushed by the sync routine.

const DB_NAME = 'travel-log';
const DB_VERSION = 1;

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('trips')) {
        db.createObjectStore('trips', { keyPath: 'ID' });
      }
      if (!db.objectStoreNames.contains('meta')) {
        db.createObjectStore('meta', { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains('outbox')) {
        db.createObjectStore('outbox', {
          keyPath: 'queueId',
          autoIncrement: true,
        });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx(store, mode, fn) {
  return openDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const t = db.transaction(store, mode);
        const s = t.objectStore(store);
        const result = fn(s);
        t.oncomplete = () => resolve(result && result.value);
        t.onerror = () => reject(t.error);
        t.onabort = () => reject(t.error);
      })
  );
}

const wrapReq = (req) => {
  const box = {};
  req.onsuccess = () => (box.value = req.result);
  return box;
};

// ── Trips ──────────────────────────────────────────────────────────────────
export const getAllTrips = () =>
  tx('trips', 'readonly', (s) => wrapReq(s.getAll()));

export const putTrip = (trip) =>
  tx('trips', 'readwrite', (s) => wrapReq(s.put(trip)));

export const putTrips = (trips) =>
  tx('trips', 'readwrite', (s) => {
    trips.forEach((t) => s.put(t));
    return { value: trips.length };
  });

export const deleteTrip = (id) =>
  tx('trips', 'readwrite', (s) => wrapReq(s.delete(id)));

export const clearTrips = () =>
  tx('trips', 'readwrite', (s) => wrapReq(s.clear()));

// ── Meta (key/value) ─────────────────────────────────────────────────────────
export const getMeta = (key) =>
  tx('meta', 'readonly', (s) => wrapReq(s.get(key))).then((r) =>
    r ? r.val : undefined
  );

export const setMeta = (key, val) =>
  tx('meta', 'readwrite', (s) => wrapReq(s.put({ key, val })));

// ── Outbox (offline write queue) ─────────────────────────────────────────────
export const enqueue = (item) =>
  tx('outbox', 'readwrite', (s) =>
    wrapReq(s.add({ ...item, ts: Date.now() }))
  );

export const getOutbox = () =>
  tx('outbox', 'readonly', (s) => wrapReq(s.getAll()));

export const dequeue = (queueId) =>
  tx('outbox', 'readwrite', (s) => wrapReq(s.delete(queueId)));

export const clearOutbox = () =>
  tx('outbox', 'readwrite', (s) => wrapReq(s.clear()));
