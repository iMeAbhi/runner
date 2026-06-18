import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useApp } from '../context/AppContext.jsx';
import { compressMany } from '../utils/imageCompress.js';
import { CITY_NAMES, regionForCity } from '../data/cities.js';
import { CloseIcon, CalendarIcon } from './Icons.jsx';
import { toISO } from '../utils/dates.js';
import CityCombobox from './CityCombobox.jsx';

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

  // Destination city changed (string from the custom combobox). Autofills the
  // State/Country when empty or still holding the last suggestion.
  const handleCity = (City) => {
    setForm((f) => {
      const region = regionForCity(City);
      const next = { ...f, City };
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

        <div className="grid grid-cols-2 gap-3">
          <CityCombobox className="col-span-2" label="From (origin)" value={form.Origin_City} onChange={(v) => setForm((f) => ({ ...f, Origin_City: v }))} options={CITY_NAMES} placeholder="e.g. Hyderabad" />
          <CityCombobox className="col-span-2" label="City (destination)" value={form.City} onChange={handleCity} options={CITY_NAMES} placeholder="Start typing… e.g. Leh" />
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

// ── DD / MM / YYYY input mask ────────────────────────────────────────────────
// Mobile-first: numeric keypad, digits auto-structure into "DD / MM / YYYY", and
// the value syncs to the DB as YYYY-MM-DD. The " / " separators are inserted as
// each group begins (so backspace stays sane), and the calendar button remains.

/** Group raw input down to <=8 digits and join with " / " → "DD / MM / YYYY". */
function maskFromDigits(raw) {
  const d = String(raw).replace(/\D/g, '').slice(0, 8);
  return [d.slice(0, 2), d.slice(2, 4), d.slice(4, 8)].filter(Boolean).join(' / ');
}

/** ISO (YYYY-MM-DD) → masked display "DD / MM / YYYY" ('' when unset). */
function maskFromIso(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return y && m && d ? `${d} / ${m} / ${y}` : '';
}

/** Masked "DD / MM / YYYY" → valid ISO YYYY-MM-DD, or '' if incomplete/invalid. */
function isoFromMask(text) {
  const d = String(text).replace(/\D/g, '');
  if (d.length !== 8) return '';
  const day = +d.slice(0, 2);
  const mon = +d.slice(2, 4);
  const yr = +d.slice(4, 8);
  if (mon < 1 || mon > 12 || day < 1 || day > 31) return '';
  const dt = new Date(yr, mon - 1, day);
  // Reject impossible calendar dates (e.g. 31 / 02).
  if (dt.getFullYear() !== yr || dt.getMonth() !== mon - 1 || dt.getDate() !== day) return '';
  return toISO(dt);
}

/**
 * Smart masked date field. Type digits (08022026 → "08 / 02 / 2026") or tap the
 * calendar (📅 → showPicker). `min` keeps the End date from preceding the Start.
 */
function DateField({ label, value, onChange, min, className = 'col-span-1' }) {
  const ref = useRef(null);
  const [text, setText] = useState(maskFromIso(value));
  // Re-sync when the canonical value changes externally (Start auto-fills End,
  // or the calendar picker sets a date).
  useEffect(() => setText(maskFromIso(value)), [value]);

  const onType = (e) => {
    const masked = maskFromDigits(e.target.value);
    setText(masked);
    const iso = isoFromMask(masked);
    if (iso) onChange(iso);
    else if (masked === '') onChange('');
  };

  return (
    <label className={`flex flex-col gap-1 text-xs font-semibold text-ink-dim ${className}`}>
      {label}
      <div className="glass flex items-center rounded-3xl px-3 py-2.5 focus-within:shadow-glow">
        <input
          type="text"
          inputMode="numeric"
          value={text}
          onChange={onType}
          placeholder="DD / MM / YYYY"
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
