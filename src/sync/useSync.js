// Background synchronization worker (hook form).
//
// Drains the outbox queue to the Apps Script endpoint whenever the network is
// available, without blocking the UI thread. Trips written offline stay in
// IndexedDB and are reconciled the moment connectivity returns.

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api/client.js';
import { db, hydrateFromRemote, markSynced, setMeta } from '../db/db.js';

const POLL_MS = 20000; // gentle background poll while online

export function useSync(settings) {
  const [status, setStatus] = useState('idle'); // idle | syncing | offline | error | ok
  const [lastSync, setLastSync] = useState(null);
  const running = useRef(false);

  const configured = Boolean(settings?.APPS_SCRIPT_URL && settings?.SECURE_TOKEN);

  /** Push queued mutations, then pull the authoritative snapshot. */
  const flush = useCallback(async () => {
    if (!configured || running.current) return;
    if (!navigator.onLine) {
      setStatus('offline');
      return;
    }
    running.current = true;
    setStatus('syncing');
    try {
      // 1) Drain outbox in FIFO order.
      const queued = await db.outbox.orderBy('createdAt').toArray();
      for (const item of queued) {
        try {
          if (item.type === 'upsertTrip') {
            const trip = await db.trips.get(item.localId);
            if (!trip) {
              await db.outbox.delete(item.id);
              continue;
            }
            const res = await api.upsertTrip(settings, serializeTrip(trip));
            await markSynced(trip.localId, res.remoteId);
          } else if (item.type === 'deleteTrip') {
            if (item.remoteId) await api.deleteTrip(settings, item.remoteId);
          }
          await db.outbox.delete(item.id);
        } catch (err) {
          await db.outbox.update(item.id, { attempts: (item.attempts || 0) + 1, lastError: String(err) });
          // Stop draining on the first hard failure; retry next cycle.
          throw err;
        }
      }

      // 2) Pull fresh snapshot from the sheet.
      const remote = await api.getTrips(settings);
      await hydrateFromRemote(remote.trips || []);

      const ts = new Date().toISOString();
      await setMeta('lastSync', ts);
      setLastSync(ts);
      setStatus('ok');
    } catch (err) {
      console.warn('[sync] failed:', err);
      setStatus('error');
    } finally {
      running.current = false;
    }
  }, [configured, settings]);

  // Poll while online + react to connectivity changes.
  useEffect(() => {
    if (!configured) {
      setStatus('idle');
      return;
    }
    flush();
    const id = setInterval(flush, POLL_MS);
    const onOnline = () => flush();
    const onOffline = () => setStatus('offline');
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      clearInterval(id);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [configured, flush]);

  return { status, lastSync, syncNow: flush, configured };
}

/** Shape a local trip into the backend's expected row contract. */
function serializeTrip(trip) {
  return {
    localId: trip.localId,
    remoteId: trip.remoteId || '',
    city: trip.city || '',
    state: trip.state || '',
    country: trip.country || '',
    startDate: trip.startDate || '',
    endDate: trip.endDate || '',
    transit: Array.isArray(trip.transit) ? trip.transit.join(',') : trip.transit || '',
    accommodation: trip.accommodation || '',
    notes: trip.notes || '',
    photos: Array.isArray(trip.photos) ? trip.photos.join(',') : trip.photos || '',
    driveFolder: trip.driveFolder || '',
    updatedAt: trip.updatedAt || new Date().toISOString(),
  };
}
