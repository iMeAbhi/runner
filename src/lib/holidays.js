// Public holiday dataset + parser.
//
// A sensible default Indian national holiday calendar ships with the app.
// The moment a user pastes a custom company holiday schedule in Settings the
// default is fully overridden (see resolveHolidays / AppContext).

// Default national holidays. Kept deliberately conservative (gazetted nationals)
// because regional holidays vary; users override with their corporate list.
export const DEFAULT_HOLIDAYS_2026 = [
  { date: '2026-01-01', name: "New Year's Day" },
  { date: '2026-01-26', name: 'Republic Day' },
  { date: '2026-03-04', name: 'Holi' },
  { date: '2026-03-21', name: 'Eid al-Fitr' },
  { date: '2026-04-03', name: 'Good Friday' },
  { date: '2026-05-01', name: 'May Day' },
  { date: '2026-05-27', name: 'Eid al-Adha' },
  { date: '2026-08-15', name: 'Independence Day' },
  { date: '2026-08-26', name: 'Janmashtami' },
  { date: '2026-10-02', name: 'Gandhi Jayanti' },
  { date: '2026-10-20', name: 'Dussehra' },
  { date: '2026-11-08', name: 'Diwali' },
  { date: '2026-12-25', name: 'Christmas Day' },
];

export const DEFAULT_HOLIDAYS_2027 = [
  { date: '2027-01-01', name: "New Year's Day" },
  { date: '2027-01-26', name: 'Republic Day' },
  { date: '2027-08-15', name: 'Independence Day' },
  { date: '2027-10-02', name: 'Gandhi Jayanti' },
  { date: '2027-12-25', name: 'Christmas Day' },
];

export const DEFAULT_HOLIDAYS = [...DEFAULT_HOLIDAYS_2026, ...DEFAULT_HOLIDAYS_2027];

/**
 * Parse a pasted custom holiday list into a normalized array.
 * Accepts flexible one-per-line formats:
 *   2026-01-26, Republic Day
 *   2026-01-26 Republic Day
 *   26/01/2026 - Republic Day
 *   Jan 26 2026 | Republic Day
 *
 * @param {string} text raw textarea content
 * @returns {{date:string,name:string}[]} ISO-dated, de-duplicated, sorted
 */
export function parseHolidayText(text) {
  if (!text || !text.trim()) return [];
  const out = [];
  const seen = new Set();

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    // Split date portion from name on the first comma / pipe / dash-with-spaces.
    const m = line.match(/^(.+?)\s*(?:,|\||\s[-–]\s|\t)\s*(.+)$/);
    let datePart = m ? m[1].trim() : line;
    let name = m ? m[2].trim() : 'Holiday';

    const iso = toISODate(datePart);
    if (!iso) continue;
    if (seen.has(iso)) continue;
    seen.add(iso);
    out.push({ date: iso, name });
  }

  out.sort((a, b) => a.date.localeCompare(b.date));
  return out;
}

/** Best-effort conversion of a date token to YYYY-MM-DD. Returns null on failure. */
export function toISODate(token) {
  if (!token) return null;
  const t = token.trim();

  // Already ISO
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return `${m[1]}-${pad(m[2])}-${pad(m[3])}`;

  // DD/MM/YYYY or DD-MM-YYYY (day-first, common in India)
  m = t.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
  if (m) return `${m[3]}-${pad(m[2])}-${pad(m[1])}`;

  // Fallback: let the Date engine try (e.g. "Jan 26 2026")
  const d = new Date(t);
  if (!isNaN(d.getTime())) {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  return null;
}

function pad(n) {
  return String(n).padStart(2, '0');
}

/**
 * Resolve the active holiday set: custom list wins entirely when present.
 * @param {{date,name}[]} custom parsed custom holidays
 * @returns {{date,name}[]}
 */
export function resolveHolidays(custom) {
  return custom && custom.length ? custom : DEFAULT_HOLIDAYS;
}

/** Build a quick lookup Set of ISO holiday dates. */
export function holidaySet(holidays) {
  return new Set(holidays.map((h) => h.date));
}
