import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useApp } from '../context/AppContext.jsx';
import { compressMany } from '../utils/imageCompress.js';
import { CITY_NAMES, regionForCity } from '../data/cities.js';
import { CloseIcon, CalendarIcon } from './Icons.jsx';
import { parseISO, toISO } from '../utils/dates.js';

// "Car" replaces the old "Cab" — every car ride is logged as a road trip.
const MODES = ['Flight', 'Train', 'Car', 'Bus', 'Walk'];
const empty = {
  City: '',
  State_Country: '',
  Origin_City: '',
  Start_Date: '',
  End_Date: '',
  Transport_Mode: 'Flight',
  Operator_Name: '',
  Distance_KM: '',
  Layovers: '',
  Layover_Count_As_Visit: 'FALSE',
  Accommodation: '',
  Drive_Folder_URL: '', // auto-populated by the backend on photo upload
  Photo_URLs: '',
};

// Map a Gemini-parsed ticket object onto our form field names.
function mapParsedToForm(p) {
  return {
    Origin_City: p.originCity || '',
    City: p.destinationCity || '',
    Start_Date: p.departureDate || '',
    End_Date: p.arrivalDate || '',
    Transport_Mode: titleCase(p.transportMode) || 'Flight',
    Operator_Name: p.operatorName || '',
    Layovers: Array.isArray(p.layovers) ? p.layovers.join(', ') : p.layovers || '',
  };
}
const titleCase = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : '');

// Add/edit a trip. Photos are compressed client-side and handed to the
// sequential upload queue via saveTrip(record, compressedFiles).
export default function TripForm({ initial, onClose }) {
  const { saveTrip, notify, parseTickets } = useApp();
  const [form, setForm] = useState({ ...empty, ...initial });
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const [importing, setImporting] = useState(false);

  const countAsVisit = String(form.Layover_Count_As_Visit).toUpperCase() === 'TRUE';

  // Sequential ticket import: one HTTP request per file (see parseTickets).
  const onImport = async (e) => {
    const picked = [...e.target.files];
    e.target.value = '';
    if (!picked.length) return;
    setImporting(true);
    try {
      const results = await parseTickets(picked);
      const first = results.find((r) => r && !r.error);
      if (first) {
        setForm((f) => ({ ...f, ...mapParsedToForm(first) }));
        notify(`Parsed ${results.filter((r) => r && !r.error).length}/${picked.length} ticket(s)`, 'ok');
      } else {
        notify(results[0]?.error || 'Could not read the ticket', 'warn');
      }
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setImporting(false);
    }
  };
  // Track whether State/Country was auto-filled, so we can update it when the
  // city changes but never clobber a value the user typed themselves.
  const [autoRegion, setAutoRegion] = useState('');

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  // Picking a start date pre-fills the end date to the same day (when empty or
  // earlier), so the End calendar opens on the start month instead of today.
  const setStart = (iso) =>
    setForm((f) => {
      const next = { ...f, Start_Date: iso };
      if (!f.End_Date || f.End_Date < iso) next.End_Date = iso;
      return next;
    });
  const setEnd = (iso) => setForm((f) => ({ ...f, End_Date: iso }));

  const onCityChange = (e) => {
    const City = e.target.value;
    setForm((f) => {
      const region = regionForCity(City);
      const next = { ...f, City };
      // Autofill only if the field is empty or still holds the last suggestion.
      if (region && (!f.State_Country || f.State_Country === autoRegion)) {
        next.State_Country = region;
      }
      return next;
    });
    const region = regionForCity(City);
    if (region) setAutoRegion(region);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.City || !form.Start_Date || !form.End_Date) {
      notify('City and both dates are required', 'warn');
      return;
    }
    if (form.End_Date < form.Start_Date) {
      notify('End date is before start date', 'warn');
      return;
    }
    setBusy(true);
    try {
      const compressed = files.length ? await compressMany(files) : [];
      await saveTrip(form, compressed);
      notify('Trip saved', 'ok');
      onClose();
    } catch (err) {
      notify(`Could not save: ${err.message}`, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <motion.form
        onSubmit={submit}
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 60, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 320, damping: 32 }}
        className="glass-strong relative z-10 max-h-[88vh] w-full max-w-md overflow-y-auto rounded-t-4xl p-5 sm:rounded-4xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-extrabold">{initial?.ID ? 'Edit trip' : 'Log a trip'}</h2>
          <button type="button" onClick={onClose} className="glass rounded-full p-2">
            <CloseIcon width={18} height={18} />
          </button>
        </div>

        {/* Import a ticket / boarding-pass screenshot (parsed by the backend). */}
        <label className="mb-3 flex cursor-pointer items-center justify-center gap-2 rounded-3xl border border-dashed border-white/20 px-3 py-2.5 text-xs font-semibold text-ink-dim hover:text-ink">
          {importing ? 'Reading ticket(s)…' : '📄 Import from ticket / screenshot'}
          <input type="file" accept="image/*,application/pdf" multiple onChange={onImport} className="hidden" disabled={importing} />
        </label>

        {/* Suggestions for the City field; selecting one autofills State/Country. */}
        <datalist id="city-suggestions">
          {CITY_NAMES.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>

        <div className="grid grid-cols-2 gap-3">
          <Field className="col-span-2" label="From (origin)" value={form.Origin_City} onChange={set('Origin_City')} list="city-suggestions" placeholder="e.g. Hyderabad" autoComplete="off" />
          <Field className="col-span-2" label="City (destination)" value={form.City} onChange={onCityChange} list="city-suggestions" placeholder="Start typing… e.g. Leh" autoComplete="off" />
          <Field className="col-span-2" label="State / Country (auto-fills)" value={form.State_Country} onChange={set('State_Country')} placeholder="e.g. Ladakh — or any country for global trips" />
          <DateField label="Start" value={form.Start_Date} onChange={setStart} />
          <DateField label="End" value={form.End_Date} onChange={setEnd} min={form.Start_Date} />

          <label className="col-span-2 flex flex-col gap-1 text-xs font-semibold text-ink-dim">
            Transport
            <div className="flex flex-wrap gap-2">
              {MODES.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, Transport_Mode: m }))}
                  className="pill glass"
                  style={
                    form.Transport_Mode === m
                      ? { background: 'rgb(var(--accent) / 0.25)', color: 'rgb(var(--ink))' }
                      : { color: 'rgb(var(--ink-dim))' }
                  }
                >
                  {m}
                </button>
              ))}
            </div>
          </label>

          <Field className="col-span-2" label="Operator (airline / rail / bus)" value={form.Operator_Name} onChange={set('Operator_Name')} placeholder="e.g. IndiGo, Vande Bharat" />
          <Field label="Distance (km)" type="number" inputMode="numeric" value={form.Distance_KM} onChange={set('Distance_KM')} placeholder="auto" />
          <Field label="Layovers" value={form.Layovers} onChange={set('Layovers')} placeholder="comma-separated" />

          {/* Layover visit toggle — see Insights/Quests/Map treatment. */}
          <label className="col-span-2 flex items-start justify-between gap-3 rounded-3xl glass px-3 py-2.5">
            <span className="flex flex-col text-xs font-semibold text-ink-dim">
              Count layover(s) as a visited destination?
              <span className="text-[10px] font-normal">On = each layover becomes its own destination, counts in stats & Quests. Off = transit only (distance still counts).</span>
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={countAsVisit}
              onClick={() => setForm((f) => ({ ...f, Layover_Count_As_Visit: countAsVisit ? 'FALSE' : 'TRUE' }))}
              className="relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors"
              style={{ background: countAsVisit ? 'rgb(var(--accent))' : 'rgb(var(--ink-dim) / 0.35)' }}
            >
              <span
                className="absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all"
                style={{ left: countAsVisit ? '1.375rem' : '0.125rem' }}
              />
            </button>
          </label>

          <Field className="col-span-2" label="Accommodation" value={form.Accommodation} onChange={set('Accommodation')} placeholder="e.g. The Grand Dragon Hotel" />

          <label className="col-span-2 flex flex-col gap-1 text-xs font-semibold text-ink-dim">
            Photos {files.length > 0 && `(${files.length} selected)`}
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => setFiles([...e.target.files])}
              className="glass rounded-3xl p-3 text-sm text-ink file:mr-3 file:rounded-full file:border-0 file:bg-accent/30 file:px-3 file:py-1 file:text-ink"
            />
            <span className="text-[10px] text-ink-dim">Compressed on-device, then filed into your Drive folder automatically (a sub-folder per city + month).</span>
          </label>
        </div>

        <button
          type="submit"
          disabled={busy}
          className="mt-5 w-full rounded-3xl py-3 font-bold text-ink shadow-glow disabled:opacity-50"
          style={{ background: 'rgb(var(--accent) / 0.85)' }}
        >
          {busy ? 'Saving…' : 'Save trip'}
        </button>
      </motion.form>
    </motion.div>
  );
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/** Format an ISO date as a friendly, typable string e.g. "04 Jun 2023". */
function fmtTyped(iso) {
  if (!iso) return '';
  const d = parseISO(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${String(d.getDate()).padStart(2, '0')} ${MONTHS[d.getMonth()].replace(/^./, (c) => c.toUpperCase())} ${d.getFullYear()}`;
}

/**
 * Loosely parse a hand-typed date into ISO (YYYY-MM-DD), or '' if unparseable.
 * Accepts: 2023-06-04, 04/06/2023, 4-6-2023, "4 Jun 2023", "June 4 2023".
 */
function parseTyped(raw) {
  const s = (raw || '').trim().toLowerCase();
  if (!s) return '';
  // ISO first.
  const iso = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (iso) return mk(+iso[1], +iso[2], +iso[3]);
  // Month name anywhere (e.g. "4 jun 2023" or "june 4 2023").
  const monIdx = MONTHS.findIndex((m) => s.includes(m));
  if (monIdx !== -1) {
    const nums = s.match(/\d+/g) || [];
    const day = nums.find((n) => +n >= 1 && +n <= 31);
    const year = nums.find((n) => n.length === 4) || nums.find((n) => +n > 31);
    if (day && year) return mk(+year, monIdx + 1, +day);
  }
  // Numeric DD MM YYYY (day-first, common in India).
  const parts = s.split(/[-/. ]+/).filter(Boolean);
  if (parts.length === 3 && parts.every((p) => /^\d+$/.test(p))) {
    let [d, m, y] = parts.map(Number);
    if (y < 100) y += 2000;
    return mk(y, m, d);
  }
  return '';
}

function mk(y, m, d) {
  if (!y || !m || !d || m < 1 || m > 12 || d < 1 || d > 31) return '';
  return toISO(new Date(y, m - 1, d));
}

/**
 * Date input you can either type into ("4 Jun 2023") or pick from the native
 * calendar (📅 button → showPicker). Typing avoids scrolling the calendar back
 * years; the calendar respects `min` so the End date can't precede the Start.
 */
function DateField({ label, value, onChange, min, className = 'col-span-1' }) {
  const ref = useRef(null);
  const [text, setText] = useState(fmtTyped(value));
  // Re-sync the text whenever the canonical value changes from outside (e.g.
  // Start auto-filling End, or the calendar picker).
  useEffect(() => setText(fmtTyped(value)), [value]);

  const commit = () => {
    const iso = parseTyped(text);
    if (iso) onChange(iso);
    else setText(fmtTyped(value)); // revert unparseable input
  };

  return (
    <label className={`flex flex-col gap-1 text-xs font-semibold text-ink-dim ${className}`}>
      {label}
      <div className="glass flex items-center rounded-3xl px-3 py-2.5 focus-within:shadow-glow">
        <input
          type="text"
          inputMode="numeric"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commit();
            }
          }}
          placeholder="04 Jun 2023"
          className="min-w-0 flex-1 bg-transparent text-sm font-medium text-ink outline-none placeholder:text-ink-dim/60"
        />
        <button
          type="button"
          aria-label="Open calendar"
          onClick={() => {
            try {
              ref.current.showPicker();
            } catch {
              ref.current.focus();
            }
          }}
          className="ml-1 shrink-0 text-ink-dim transition-colors hover:text-ink"
        >
          <CalendarIcon width={18} height={18} />
        </button>
        {/* Visually hidden native picker; the button above opens it. */}
        <input
          ref={ref}
          type="date"
          value={value || ''}
          min={min || undefined}
          onChange={(e) => e.target.value && onChange(e.target.value)}
          tabIndex={-1}
          aria-hidden="true"
          className="pointer-events-none absolute h-0 w-0 opacity-0"
        />
      </div>
    </label>
  );
}

function Field({ label, className = '', ...props }) {
  return (
    <label className={`flex flex-col gap-1 text-xs font-semibold text-ink-dim ${className}`}>
      {label}
      <input
        {...props}
        className="glass rounded-3xl px-3 py-2.5 text-sm font-medium text-ink outline-none placeholder:text-ink-dim/60 focus:shadow-glow"
      />
    </label>
  );
}
