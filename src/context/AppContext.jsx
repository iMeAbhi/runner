// Global state provider: settings (localStorage), trips (IndexedDB), theme
// engine, holiday resolution, leave balances, and the sync worker. This is the
// single source of truth the four tabs read from.

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  db,
  deleteTripLocal,
  exportAll,
  upsertTripLocal,
} from '../db/db.js';
import { useSync } from '../sync/useSync.js';
import { applyTheme } from '../lib/theme.js';
import { parseHolidayText, resolveHolidays } from '../lib/holidays.js';

const STORAGE_KEY = 'voyage.settings.v1';

const DEFAULT_SETTINGS = {
  APPS_SCRIPT_URL: '',
  HOME_LOCATION: 'Hyderabad',
  // Annual leave allocation base limits.
  ANNUAL_LEAVES: { casual: 12, privilege: 18, sick: 12 },
  // Company-specific holiday list (raw pasted text); overrides defaults.
  customHolidaysText: '',
  // UI
  theme: 'amoled',
  moodAccent: 'aviation',
  // Leaves consumed so far this year (for annual % + balances).
  leavesUsed: { casual: 0, privilege: 0, sick: 0 },
};

function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      ANNUAL_LEAVES: { ...DEFAULT_SETTINGS.ANNUAL_LEAVES, ...(parsed.ANNUAL_LEAVES || {}) },
      leavesUsed: { ...DEFAULT_SETTINGS.leavesUsed, ...(parsed.leavesUsed || {}) },
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [settings, setSettings] = useState(loadSettings);

  // Persist settings to localStorage on every change.
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  // Apply the active theme whenever it changes; re-tick the Sky Dynamic theme
  // every 10 minutes so the gradient tracks the local clock.
  useEffect(() => {
    applyTheme(settings.theme, settings.moodAccent);
    if (settings.theme !== 'sky') return;
    const id = setInterval(() => applyTheme('sky', settings.moodAccent), 10 * 60 * 1000);
    return () => clearInterval(id);
  }, [settings.theme, settings.moodAccent]);

  // Live trip list from IndexedDB (reactively updates the whole app).
  const trips = useLiveQuery(() => db.trips.orderBy('startDate').reverse().toArray(), [], []);

  // Resolved holiday calendar — custom company list fully overrides defaults.
  const customHolidays = useMemo(
    () => parseHolidayText(settings.customHolidaysText),
    [settings.customHolidaysText],
  );
  const holidays = useMemo(() => resolveHolidays(customHolidays), [customHolidays]);
  const usingCustomHolidays = customHolidays.length > 0;

  // Background sync worker.
  const sync = useSync(settings);

  /* ── Mutators ──────────────────────────────────────────────────────── */

  const updateSettings = (patch) => setSettings((s) => ({ ...s, ...patch }));

  const updateNested = (key, patch) =>
    setSettings((s) => ({ ...s, [key]: { ...s[key], ...patch } }));

  const saveTrip = async (trip) => {
    const saved = await upsertTripLocal(trip);
    sync.syncNow();
    return saved;
  };

  const removeTrip = async (localId) => {
    await deleteTripLocal(localId);
    sync.syncNow();
  };

  /** Manual backup export → triggers a JSON file download. */
  const exportBackup = async () => {
    const data = await exportAll();
    data.settings = settings;
    downloadFile(
      `voyage-backup-${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify(data, null, 2),
      'application/json',
    );
  };

  /** Manual backup export → CSV of trips. */
  const exportCsv = async () => {
    const rows = trips || [];
    const cols = ['city', 'state', 'country', 'startDate', 'endDate', 'transit', 'accommodation', 'notes'];
    const head = cols.join(',');
    const body = rows
      .map((t) =>
        cols
          .map((c) => {
            const v = Array.isArray(t[c]) ? t[c].join('|') : t[c] ?? '';
            return `"${String(v).replace(/"/g, '""')}"`;
          })
          .join(','),
      )
      .join('\n');
    downloadFile(`voyage-trips-${new Date().toISOString().slice(0, 10)}.csv`, `${head}\n${body}`, 'text/csv');
  };

  const value = {
    settings,
    updateSettings,
    updateNested,
    trips: trips || [],
    holidays,
    usingCustomHolidays,
    customHolidays,
    saveTrip,
    removeTrip,
    exportBackup,
    exportCsv,
    sync,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within <AppProvider>');
  return ctx;
}

/* ── helpers ──────────────────────────────────────────────────────────── */

function downloadFile(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
