// Default public-holiday dataset (India national holidays).
//
// Per spec, this default calendar is used ONLY until the user pastes a custom
// corporate holiday list in Settings — at which point the custom list fully
// overrides this one (see AppContext.activeHolidays).
//
// Dates are ISO YYYY-MM-DD. Update yearly as needed.
export const DEFAULT_HOLIDAYS = [
  // 2026
  { Date: '2026-01-01', Holiday_Name: "New Year's Day" },
  { Date: '2026-01-14', Holiday_Name: 'Makar Sankranti / Pongal' },
  { Date: '2026-01-26', Holiday_Name: 'Republic Day' },
  { Date: '2026-03-04', Holiday_Name: 'Holi' },
  { Date: '2026-03-21', Holiday_Name: 'Eid-ul-Fitr' },
  { Date: '2026-04-03', Holiday_Name: 'Good Friday' },
  { Date: '2026-05-01', Holiday_Name: 'May Day' },
  { Date: '2026-05-27', Holiday_Name: 'Eid-ul-Adha' },
  { Date: '2026-08-15', Holiday_Name: 'Independence Day' },
  { Date: '2026-08-26', Holiday_Name: 'Janmashtami' },
  { Date: '2026-09-14', Holiday_Name: 'Ganesh Chaturthi' },
  { Date: '2026-10-02', Holiday_Name: 'Gandhi Jayanti' },
  { Date: '2026-10-20', Holiday_Name: 'Dussehra' },
  { Date: '2026-11-08', Holiday_Name: 'Diwali' },
  { Date: '2026-11-24', Holiday_Name: 'Guru Nanak Jayanti' },
  { Date: '2026-12-25', Holiday_Name: 'Christmas' },
  // 2027 (lookahead so the 52-week optimizer window stays populated)
  { Date: '2027-01-01', Holiday_Name: "New Year's Day" },
  { Date: '2027-01-26', Holiday_Name: 'Republic Day' },
  { Date: '2027-03-22', Holiday_Name: 'Holi' },
  { Date: '2027-08-15', Holiday_Name: 'Independence Day' },
  { Date: '2027-10-02', Holiday_Name: 'Gandhi Jayanti' },
  { Date: '2027-10-29', Holiday_Name: 'Diwali' },
  { Date: '2027-12-25', Holiday_Name: 'Christmas' },
];

/**
 * Parse a pasted corporate holiday list into the canonical
 * { Date, Holiday_Name } shape. Accepts flexible lines such as:
 *   2026-08-15, Independence Day
 *   2026-08-15  Independence Day
 *   15/08/2026 - Independence Day
 * Lines that don't yield a valid ISO date are skipped.
 */
export function parseHolidayText(text = '') {
  const out = [];
  const lines = text.split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    // Split on the first comma / tab / dash / multi-space separator.
    const m = line.match(/^(.+?)\s*[,\t]\s*(.+)$|^(\S+)\s+[-–]\s+(.+)$|^(\S+)\s{2,}(.+)$/);
    let datePart, namePart;
    if (m) {
      datePart = (m[1] || m[3] || m[5] || '').trim();
      namePart = (m[2] || m[4] || m[6] || '').trim();
    } else {
      const parts = line.split(/\s+/);
      datePart = parts.shift();
      namePart = parts.join(' ');
    }
    const iso = toISO(datePart);
    if (iso) out.push({ Date: iso, Holiday_Name: namePart || 'Holiday' });
  }
  return out;
}

function toISO(s = '') {
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // DD/MM/YYYY or DD-MM-YYYY
  const m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (m) {
    const [, d, mo, y] = m;
    return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return null;
}
