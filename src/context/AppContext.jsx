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
  homeLocation: 'Hyderabad',
  driveFolderUrl: '', // master Drive folder; trip sub-folders are created inside it
  theme: 'amoled', // amoled | light | mood | sky
  accent: 'aviation',
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
  }, [settings.theme, settings.accent, band]);

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
      const { trips: remoteTrips } = await api.fetchAll(settings.appsScriptUrl);
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
  }, [settings.appsScriptUrl, notify]);

  // ── Flush the offline outbox sequentially when back online ─────────────────
  const flushOutbox = useCallback(async () => {
    if (!online || !settings.appsScriptUrl) return;
    const items = (await idb.getOutbox()) || [];
    for (const item of items) {
      try {
        if (item.type === 'saveTrip') await api.saveTrip(settings.appsScriptUrl, item.trip);
        if (item.type === 'deleteTrip') await api.removeTrip(settings.appsScriptUrl, item.id);
        await idb.dequeue(item.queueId);
      } catch {
        break; // stop on first failure; retry on next online event
      }
    }
  }, [online, settings.appsScriptUrl]);

  useEffect(() => {
    if (online) flushOutbox();
  }, [online, flushOutbox]);

  // ── Save a trip: write to IDB immediately (offline-first), then sync ───────
  const saveTrip = useCallback(
    async (trip, photoFiles = []) => {
      const record = {
        ...trip,
        ID: trip.ID || `t_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      };
      await idb.putTrip(record);
      setTrips((prev) => {
        const i = prev.findIndex((t) => t.ID === record.ID);
        if (i === -1) return [...prev, record];
        const next = [...prev];
        next[i] = record;
        return next;
      });

      // Sync the row itself.
      if (online && settings.appsScriptUrl) {
        try {
          await api.saveTrip(settings.appsScriptUrl, record);
        } catch {
          await idb.enqueue({ type: 'saveTrip', trip: record });
        }
      } else {
        await idb.enqueue({ type: 'saveTrip', trip: record });
      }

      // Sequentially stream any photos (one HTTP request per file).
      if (photoFiles.length && online && settings.appsScriptUrl) {
        await uploadPhotos(record, photoFiles);
      } else if (photoFiles.length) {
        notify('Photos will upload when back online', 'warn');
      }
      return record;
    },
    [online, settings.appsScriptUrl, notify]
  );

  // Sequential streaming queue — strictly one file per request.
  const uploadPhotos = useCallback(
    async (record, compressedFiles) => {
      setUploads({ active: true, done: 0, total: compressedFiles.length });
      const urls = [];
      for (let i = 0; i < compressedFiles.length; i++) {
        const f = compressedFiles[i];
        try {
          const { url } = await api.uploadImage(settings.appsScriptUrl, {
            tripId: record.ID,
            city: record.City,
            startDate: record.Start_Date,
            base64: f.base64,
            mime: f.mime,
            rootFolderId: parseFolderId(settings.driveFolderUrl),
          });
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
            await api.saveTrip(settings.appsScriptUrl, updated);
          } catch {
            await idb.enqueue({ type: 'saveTrip', trip: updated });
          }
        }
        notify(`${urls.length} photo(s) uploaded`, 'ok');
      }
    },
    [settings.appsScriptUrl, online, notify]
  );

  const deleteTrip = useCallback(
    async (id) => {
      await idb.deleteTrip(id);
      setTrips((prev) => prev.filter((t) => t.ID !== id));
      if (online && settings.appsScriptUrl) {
        try {
          await api.removeTrip(settings.appsScriptUrl, id);
        } catch {
          await idb.enqueue({ type: 'deleteTrip', id });
        }
      } else {
        await idb.enqueue({ type: 'deleteTrip', id });
      }
    },
    [online, settings.appsScriptUrl]
  );

  // ── Refresh a trip's gallery from its Drive folder ─────────────────────────
  // Picks up photos the user added to the folder by hand and makes them public.
  // Returns the live URL list (also persisted to IDB + the sheet row).
  const syncTripFolder = useCallback(
    async (trip) => {
      if (!online || !settings.appsScriptUrl) return null;
      try {
        const { urls } = await api.syncFolder(settings.appsScriptUrl, {
          id: trip.ID,
          folderUrl: trip.Drive_Folder_URL,
          rootFolderId: parseFolderId(settings.driveFolderUrl),
          city: trip.City,
          startDate: trip.Start_Date,
        });
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
    [online, settings.appsScriptUrl, settings.driveFolderUrl]
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
    saveTrip,
    uploadPhotos,
    deleteTrip,
    syncTripFolder,
    exportBackup,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
