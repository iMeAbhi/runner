import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from 'react';
import * as idb from '../db/idb.js';
import * as api from '../api/api.js';
import { DEFAULT_HOLIDAYS, parseHolidayText } from '../data/holidays.js';
import { processNewVectorLeg } from '../utils/vectors.js';
import { tripDistanceKm } from '../utils/insights.js';

/** Read a File as base64 (no data: prefix) for the ticket-parse upload. */
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const s = String(r.result);
      resolve({ base64: s.slice(s.indexOf(',') + 1), mime: file.type || 'image/jpeg' });
    };
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

const AppContext = createContext(null);
export const useApp = () => useContext(AppContext);

// Material-Mood accent presets (the four travel accents from the style guide).
export const ACCENTS = {
  aviation: { name: 'Aviation Blue', accent: '80 168 255', accent2: '130 220 255' },
  nomad: { name: 'Nomad Green', accent: '76 200 140', accent2: '150 230 170' },
  sunset: { name: 'Sunset Orange', accent: '255 138 76', accent2: '255 190 120' },
  violet: { name: 'Twilight Violet', accent: '160 110 255', accent2: '200 160 255' },
};

const DEFAULT_SETTINGS = {
  appsScriptUrl: '',
  apiKey: '', // shared secret; must match SHARED_SECRET in Code.gs

  homeLocation: '', // where "home" really is (e.g. Kolkata) — drives "been home" insights
  currentLocation: '', // where you currently live/base out of (e.g. Hyderabad)
  birthday: '', // YYYY-MM-DD; only month/day are used for insights
  driveFolderUrl: '', // master Drive folder; trip sub-folders are created inside it
  theme: 'amoled', // amoled | light | mood | sky
  accent: 'aviation',
  moodBase: 'dark', // Material Mood base canvas: 'light' | 'dark'
  holidayText: '', // pasted corporate list (overrides defaults when present)
  leaves: { Casual: 12, Privilege: 18, Sick: 12 },
  leavesUsed: { Casual: 0, Privilege: 0, Sick: 0 },
};

/** Extract a Drive folder ID from a folder URL (…/folders/<ID>), else ''. */
export function parseFolderId(url = '') {
  const m = String(url).match(/folders\/([A-Za-z0-9_-]+)/);
  return m ? m[1] : '';
}

/** Map the local clock to one of the four Sky-Dynamic windows. */
export function timeBand(date = new Date()) {
  const h = date.getHours();
  if (h >= 6 && h < 11) return 'morning';
  if (h >= 11 && h < 17) return 'afternoon';
  if (h >= 17 && h < 19) return 'evening';
  return 'night';
}

export function AppProvider({ children }) {
  const [ready, setReady] = useState(false);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [trips, setTrips] = useState([]);
  const [online, setOnline] = useState(navigator.onLine);
  const [syncing, setSyncing] = useState(false);
  const [band, setBand] = useState(timeBand());
  const [uploads, setUploads] = useState({ active: false, done: 0, total: 0 });
  const [toast, setToast] = useState(null);

  const notify = useCallback((msg, kind = 'info') => {
    setToast({ msg, kind, id: Date.now() });
    setTimeout(() => setToast(null), 3200);
  }, []);

  // ── Hydrate from IndexedDB on boot ─────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const [savedSettings, savedTrips] = await Promise.all([
        idb.getMeta('settings'),
        idb.getAllTrips(),
      ]);
      if (savedSettings) setSettings({ ...DEFAULT_SETTINGS, ...savedSettings });
      if (savedTrips) setTrips(savedTrips);
      setReady(true);
    })();
  }, []);

  // ── Persist settings on change ─────────────────────────────────────────────
  useEffect(() => {
    if (ready) idb.setMeta('settings', settings);
  }, [settings, ready]);

  // ── Theme engine: reflect theme + accent + time-of-day onto <html> ─────────
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', settings.theme);
    if (settings.theme === 'sky') root.setAttribute('data-time', band);
    else root.removeAttribute('data-time');

    // Material Mood can run on a light or dark base canvas.
    if (settings.theme === 'mood') root.setAttribute('data-mood-base', settings.moodBase || 'dark');
    else root.removeAttribute('data-mood-base');

    // Mood theme drives its accent from the chosen travel accent.
    if (settings.theme === 'mood' || settings.theme === 'amoled') {
      const a = ACCENTS[settings.accent] || ACCENTS.aviation;
      if (settings.theme === 'mood') {
        root.style.setProperty('--accent', a.accent);
        root.style.setProperty('--accent-2', a.accent2);
      } else {
        root.style.removeProperty('--accent');
        root.style.removeProperty('--accent-2');
      }
    } else {
      root.style.removeProperty('--accent');
      root.style.removeProperty('--accent-2');
    }
  }, [settings.theme, settings.accent, settings.moodBase, band]);

  // ── Sky clock: re-evaluate the band every minute ───────────────────────────
  useEffect(() => {
    const id = setInterval(() => setBand(timeBand()), 60000);
    return () => clearInterval(id);
  }, []);

  // ── Online/offline tracking ────────────────────────────────────────────────
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);

  // Active holiday set: custom pasted list fully overrides the defaults.
  const activeHolidays = useMemo(() => {
    const custom = parseHolidayText(settings.holidayText);
    return custom.length ? custom : DEFAULT_HOLIDAYS;
  }, [settings.holidayText]);

  const usingCustomHolidays = useMemo(
    () => parseHolidayText(settings.holidayText).length > 0,
    [settings.holidayText]
  );

  // ── Settings mutators ──────────────────────────────────────────────────────
  const updateSettings = useCallback(
    (patch) => setSettings((s) => ({ ...s, ...patch })),
    []
  );

  // ── Pull master sheet → IndexedDB ──────────────────────────────────────────
  const refreshFromSheet = useCallback(async () => {
    if (!settings.appsScriptUrl) {
      notify('Set your Apps Script URL in Settings first', 'warn');
      return;
    }
    setSyncing(true);
    try {
      const { trips: remoteTrips } = await api.fetchAll(settings.appsScriptUrl, settings.apiKey);
      await idb.clearTrips();
      await idb.putTrips(remoteTrips);
      setTrips(remoteTrips);
      await idb.setMeta('lastSync', Date.now());
      notify('Synced from Google Sheet', 'ok');
    } catch (e) {
      notify(`Sync failed: ${e.message}`, 'error');
    } finally {
      setSyncing(false);
    }
  }, [settings.appsScriptUrl, settings.apiKey, notify]);

  // ── Manual calendar import (Timeline "📅 Calendar" button) ─────────────────
  // Triggers the Apps Script crawl, then re-pulls the sheet so imported trips show.
  const syncCalendar = useCallback(async () => {
    if (!settings.appsScriptUrl) {
      notify('Set your Apps Script URL in Settings first', 'warn');
      return;
    }
    setSyncing(true);
    try {
      const res = await api.syncCalendar(settings.appsScriptUrl, settings.apiKey);
      if (res.error) throw new Error(res.error);
      const { trips: remoteTrips } = await api.fetchAll(settings.appsScriptUrl, settings.apiKey);
      await idb.clearTrips();
      await idb.putTrips(remoteTrips);
      setTrips(remoteTrips);
      await idb.setMeta('lastSync', Date.now());
      notify(`Calendar synced — ${res.imported || 0} trip(s) imported`, 'ok');
    } catch (e) {
      notify(`Calendar sync failed: ${e.message}`, 'error');
    } finally {
      setSyncing(false);
    }
  }, [settings.appsScriptUrl, settings.apiKey, notify]);

  // ── Verify URL + key without side effects (Settings "Verify" button) ───────
  const verifyConnection = useCallback(async () => {
    if (!settings.appsScriptUrl) {
      notify('Paste your Apps Script URL first', 'warn');
      return;
    }
    try {
      await api.ping(settings.appsScriptUrl, settings.apiKey);
      notify('Connected — key accepted ✓', 'ok');
    } catch (e) {
      notify(
        /unauthorized/i.test(e.message)
          ? 'Key mismatch — check the API key matches your sheet'
          : `Could not reach backend: ${e.message}`,
        'error'
      );
    }
  }, [settings.appsScriptUrl, settings.apiKey, notify]);

  // ── Flush the offline outbox sequentially when back online ─────────────────
  const flushOutbox = useCallback(async () => {
    if (!online || !settings.appsScriptUrl) return;
    const items = (await idb.getOutbox()) || [];
    for (const item of items) {
      try {
        if (item.type === 'saveTrip') await api.saveTrip(settings.appsScriptUrl, item.trip, settings.apiKey);
        if (item.type === 'deleteTrip') await api.removeTrip(settings.appsScriptUrl, item.id, settings.apiKey);
        await idb.dequeue(item.queueId);
      } catch {
        break; // stop on first failure; retry on next online event
      }
    }
  }, [online, settings.appsScriptUrl, settings.apiKey]);

  useEffect(() => {
    if (online) flushOutbox();
  }, [online, flushOutbox]);

  // ── Save a trip: write to IDB immediately (offline-first), then sync ───────
  // Persist one row to the backend (or enqueue when offline / on failure).
  const persistRow = useCallback(
    async (row) => {
      if (online && settings.appsScriptUrl) {
        try {
          await api.saveTrip(settings.appsScriptUrl, row, settings.apiKey);
          return;
        } catch {
          /* fall through to enqueue */
        }
      }
      await idb.enqueue({ type: 'saveTrip', trip: row });
    },
    [online, settings.appsScriptUrl, settings.apiKey]
  );

  const saveTrip = useCallback(
    async (trip, photoFiles = []) => {
      const isNew = !trip.ID;
      let record = {
        ...trip,
        ID: trip.ID || `t_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      };

      // Auto-fill straight-line distance when not supplied.
      if (!record.Distance_KM) {
        const km = tripDistanceKm(record);
        if (km > 0) record.Distance_KM = String(km);
      }

      // Implicit reset: a brand-new leg departing from home may need to
      // auto-close a still-open earlier trip.
      let closed = null;
      if (isNew) {
        const res = processNewVectorLeg(record, trips, settings.homeLocation);
        record = res.leg;
        closed = res.closed;
      }
      if (closed) {
        await idb.putTrip(closed);
        setTrips((prev) => prev.map((t) => (t.ID === closed.ID ? closed : t)));
        await persistRow(closed);
        notify(`Auto-closed your open ${closed.City} trip`, 'info');
      }

      await idb.putTrip(record);
      setTrips((prev) => {
        const i = prev.findIndex((t) => t.ID === record.ID);
        if (i === -1) return [...prev, record];
        const next = [...prev];
        next[i] = record;
        return next;
      });

      await persistRow(record);

      // Sequentially stream any photos (one HTTP request per file).
      if (photoFiles.length && online && settings.appsScriptUrl) {
        await uploadPhotos(record, photoFiles);
      } else if (photoFiles.length) {
        notify('Photos will upload when back online', 'warn');
      }
      return record;
    },
    [online, settings.appsScriptUrl, settings.apiKey, settings.homeLocation, trips, persistRow, notify]
  );

  // ── Ticket parsing: sequential queue, one HTTP request per file ────────────
  const parseTickets = useCallback(
    async (files) => {
      if (!settings.appsScriptUrl) {
        notify('Set your Apps Script URL first', 'warn');
        return [{ error: 'No backend configured' }];
      }
      const results = [];
      for (const file of files) {
        try {
          const { base64, mime } = await fileToBase64(file);
          const data = await api.parseTicket(
            settings.appsScriptUrl,
            { base64, mime, filename: file.name },
            settings.apiKey
          );
          results.push(data.parsed || data);
        } catch (e) {
          results.push({ error: e.message });
        }
      }
      return results;
    },
    [settings.appsScriptUrl, settings.apiKey, notify]
  );

  // Sequential streaming queue — strictly one file per request.
  const uploadPhotos = useCallback(
    async (record, compressedFiles) => {
      setUploads({ active: true, done: 0, total: compressedFiles.length });
      const urls = [];
      for (let i = 0; i < compressedFiles.length; i++) {
        const f = compressedFiles[i];
        try {
          const { url } = await api.uploadImage(
            settings.appsScriptUrl,
            {
              tripId: record.ID,
              city: record.City,
              startDate: record.Start_Date,
              base64: f.base64,
              mime: f.mime,
              rootFolderId: parseFolderId(settings.driveFolderUrl),
            },
            settings.apiKey
          );
          if (url) urls.push(url);
        } catch (e) {
          notify(`Image ${i + 1} failed: ${e.message}`, 'error');
        }
        setUploads({ active: true, done: i + 1, total: compressedFiles.length });
      }
      setUploads({ active: false, done: 0, total: 0 });

      if (urls.length) {
        const existing = (record.Photo_URLs || '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
        const merged = [...existing, ...urls].join(', ');
        const updated = { ...record, Photo_URLs: merged };
        await idb.putTrip(updated);
        setTrips((prev) => prev.map((t) => (t.ID === updated.ID ? updated : t)));
        // Persist the URL list back to the sheet row.
        if (online) {
          try {
            await api.saveTrip(settings.appsScriptUrl, updated, settings.apiKey);
          } catch {
            await idb.enqueue({ type: 'saveTrip', trip: updated });
          }
        }
        notify(`${urls.length} photo(s) uploaded`, 'ok');
      }
    },
    [settings.appsScriptUrl, settings.apiKey, online, notify]
  );

  const deleteTrip = useCallback(
    async (id) => {
      await idb.deleteTrip(id);
      setTrips((prev) => prev.filter((t) => t.ID !== id));
      if (online && settings.appsScriptUrl) {
        try {
          await api.removeTrip(settings.appsScriptUrl, id, settings.apiKey);
        } catch {
          await idb.enqueue({ type: 'deleteTrip', id });
        }
      } else {
        await idb.enqueue({ type: 'deleteTrip', id });
      }
    },
    [online, settings.appsScriptUrl, settings.apiKey]
  );

  // ── Refresh a trip's gallery from its Drive folder ─────────────────────────
  // Picks up photos the user added to the folder by hand and makes them public.
  // Returns the live URL list (also persisted to IDB + the sheet row).
  const syncTripFolder = useCallback(
    async (trip) => {
      if (!online || !settings.appsScriptUrl) return null;
      try {
        const { urls } = await api.syncFolder(
          settings.appsScriptUrl,
          {
            id: trip.ID,
            folderUrl: trip.Drive_Folder_URL,
            rootFolderId: parseFolderId(settings.driveFolderUrl),
            city: trip.City,
            startDate: trip.Start_Date,
          },
          settings.apiKey
        );
        if (!urls) return null;
        const merged = urls.join(', ');
        if (merged !== (trip.Photo_URLs || '')) {
          const updated = { ...trip, Photo_URLs: merged };
          await idb.putTrip(updated);
          setTrips((prev) => prev.map((t) => (t.ID === updated.ID ? updated : t)));
        }
        return urls;
      } catch {
        return null; // offline / transient — keep showing whatever we have
      }
    },
    [online, settings.appsScriptUrl, settings.apiKey, settings.driveFolderUrl]
  );

  // ── Manual JSON backup export ──────────────────────────────────────────────
  const exportBackup = useCallback(() => {
    const blob = new Blob(
      [JSON.stringify({ exportedAt: new Date().toISOString(), settings, trips }, null, 2)],
      { type: 'application/json' }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `travel-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [settings, trips]);

  const value = {
    ready,
    settings,
    updateSettings,
    trips,
    online,
    syncing,
    band,
    uploads,
    toast,
    notify,
    activeHolidays,
    usingCustomHolidays,
    refreshFromSheet,
    syncCalendar,
    verifyConnection,
    parseTickets,
    saveTrip,
    uploadPhotos,
    deleteTrip,
    syncTripFolder,
    exportBackup,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
