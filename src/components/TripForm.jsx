import { useState } from 'react';
import { motion } from 'framer-motion';
import { useApp } from '../context/AppContext.jsx';
import { api } from '../api/client.js';
import { prepareImages } from '../lib/imageCompress.js';
import { CloseIcon, PlusIcon } from './icons.jsx';

const TRANSIT_OPTIONS = ['Flight', 'Train', 'Cab', 'Bus', 'Walking'];

/**
 * Add / edit trip sheet. Photos are compressed client-side immediately (so they
 * preview offline) and pushed to Drive via Apps Script when connectivity allows.
 */
export default function TripForm({ trip, onClose }) {
  const { saveTrip, settings, sync } = useApp();
  const editing = Boolean(trip?.localId);

  const [form, setForm] = useState(() => ({
    localId: trip?.localId,
    remoteId: trip?.remoteId,
    city: trip?.city || '',
    state: trip?.state || '',
    country: trip?.country || 'India',
    startDate: trip?.startDate || '',
    endDate: trip?.endDate || '',
    transit: Array.isArray(trip?.transit) ? trip.transit : trip?.transit ? [trip.transit] : [],
    accommodation: trip?.accommodation || '',
    notes: trip?.notes || '',
    photos: trip?.photos || [],
    driveFolder: trip?.driveFolder || '',
  }));
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const toggleTransit = (t) =>
    setForm((f) => ({
      ...f,
      transit: f.transit.includes(t) ? f.transit.filter((x) => x !== t) : [...f.transit, t],
    }));

  const handleFiles = async (e) => {
    const files = e.target.files;
    if (!files?.length) return;
    setUploading(true);
    try {
      const prepared = await prepareImages(files, { city: form.city, date: form.startDate });
      // Optimistic local previews (data URLs) — usable fully offline.
      set('photos', [...form.photos, ...prepared.map((p) => p.previewUrl)]);

      // Try to push each to Drive now; ignore failures (sync retries later).
      if (sync.configured && navigator.onLine) {
        const urls = [];
        for (const img of prepared) {
          try {
            const res = await api.uploadMedia(settings, { localId: form.localId || 'new', image: img });
            if (res.url) urls.push(res.url);
          } catch (err) {
            console.warn('media upload deferred:', err);
          }
        }
        if (urls.length) {
          // Replace the just-added previews with their Drive URLs.
          setForm((f) => ({
            ...f,
            photos: [...f.photos.filter((p) => !p.startsWith('data:')), ...urls],
          }));
        }
      }
    } finally {
      setUploading(false);
    }
  };

  const submit = async () => {
    if (!form.city || !form.startDate) return;
    setSaving(true);
    try {
      await saveTrip({ ...form, endDate: form.endDate || form.startDate });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div className="fixed inset-0 z-[60] flex items-end justify-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 320, damping: 34 }}
        className="glass-strong relative max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-5xl p-5 pb-28"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-2xl font-bold text-ink">{editing ? 'Edit Trip' : 'New Trip'}</h2>
          <button onClick={onClose} className="glass flex h-9 w-9 items-center justify-center rounded-full text-ink">
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3">
          <Field label="City *">
            <input value={form.city} onChange={(e) => set('city', e.target.value)} placeholder="e.g. Leh" className={inputCls} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="State / UT">
              <input value={form.state} onChange={(e) => set('state', e.target.value)} placeholder="Ladakh" className={inputCls} />
            </Field>
            <Field label="Country">
              <input value={form.country} onChange={(e) => set('country', e.target.value)} className={inputCls} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Start date *">
              <input type="date" value={form.startDate} onChange={(e) => set('startDate', e.target.value)} className={inputCls} />
            </Field>
            <Field label="End date">
              <input type="date" value={form.endDate} onChange={(e) => set('endDate', e.target.value)} className={inputCls} />
            </Field>
          </div>

          <Field label="Transit">
            <div className="flex flex-wrap gap-2">
              {TRANSIT_OPTIONS.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => toggleTransit(t)}
                  className={`rounded-3xl px-3 py-1.5 text-sm transition ${
                    form.transit.includes(t) ? 'bg-accent/90 text-black' : 'bg-white/10 text-ink-soft'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Accommodation">
            <input value={form.accommodation} onChange={(e) => set('accommodation', e.target.value)} placeholder="Hotel / homestay name" className={inputCls} />
          </Field>

          <Field label="Notes">
            <textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={2} placeholder="Highlights, memories…" className={inputCls} />
          </Field>

          {/* Photos — unlimited, compressed client-side */}
          <Field label={`Photos${form.photos.length ? ` · ${form.photos.length}` : ''}`}>
            <div className="grid grid-cols-4 gap-2">
              {form.photos.map((p, i) => (
                <div key={i} className="relative aspect-square overflow-hidden rounded-3xl">
                  <img src={p} alt="" className="h-full w-full object-cover" />
                  <button
                    onClick={() => set('photos', form.photos.filter((_, x) => x !== i))}
                    className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white"
                  >
                    <CloseIcon className="h-3 w-3" />
                  </button>
                </div>
              ))}
              <label className="flex aspect-square cursor-pointer items-center justify-center rounded-3xl border border-dashed border-white/20 text-ink-soft">
                {uploading ? <span className="text-xs">…</span> : <PlusIcon className="h-6 w-6" />}
                <input type="file" accept="image/*" multiple className="hidden" onChange={handleFiles} />
              </label>
            </div>
          </Field>
        </div>

        <button
          onClick={submit}
          disabled={saving || !form.city || !form.startDate}
          className="mt-5 w-full rounded-4xl bg-accent/90 py-3.5 font-semibold text-black shadow-glow transition active:scale-95 disabled:opacity-40"
        >
          {saving ? 'Saving…' : editing ? 'Save changes' : 'Add trip'}
        </button>
      </motion.div>
    </motion.div>
  );
}

const inputCls =
  'w-full rounded-3xl bg-white/10 px-3 py-2.5 text-sm text-ink placeholder:text-ink-soft/60 outline-none focus:ring-2 focus:ring-accent';

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-ink-soft">{label}</span>
      {children}
    </label>
  );
}
