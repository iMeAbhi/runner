import { useState } from 'react';
import { motion } from 'framer-motion';
import { useApp } from '../context/AppContext.jsx';
import { compressMany } from '../utils/imageCompress.js';
import { CITY_NAMES, regionForCity } from '../data/cities.js';
import { CloseIcon } from './Icons.jsx';

const MODES = ['Flight', 'Train', 'Cab', 'Bus', 'Walk'];
const empty = {
  City: '',
  State_Country: '',
  Start_Date: '',
  End_Date: '',
  Transport_Mode: 'Flight',
  Accommodation: '',
  Drive_Folder_URL: '', // auto-populated by the backend on photo upload
  Photo_URLs: '',
};

// Add/edit a trip. Photos are compressed client-side and handed to the
// sequential upload queue via saveTrip(record, compressedFiles).
export default function TripForm({ initial, onClose }) {
  const { saveTrip, notify } = useApp();
  const [form, setForm] = useState({ ...empty, ...initial });
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  // Track whether State/Country was auto-filled, so we can update it when the
  // city changes but never clobber a value the user typed themselves.
  const [autoRegion, setAutoRegion] = useState('');

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

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

        {/* Suggestions for the City field; selecting one autofills State/Country. */}
        <datalist id="city-suggestions">
          {CITY_NAMES.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>

        <div className="grid grid-cols-2 gap-3">
          <Field className="col-span-2" label="City" value={form.City} onChange={onCityChange} list="city-suggestions" placeholder="Start typing… e.g. Leh" autoComplete="off" />
          <Field className="col-span-2" label="State / Country (auto-fills)" value={form.State_Country} onChange={set('State_Country')} placeholder="e.g. Ladakh" />
          <Field type="date" label="Start" value={form.Start_Date} onChange={set('Start_Date')} />
          <Field type="date" label="End" value={form.End_Date} onChange={set('End_Date')} />

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
