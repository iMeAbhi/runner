import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useApp } from '../context/AppContext.jsx';
import CityCard from '../components/CityCard.jsx';
import CityDetailModal from '../components/CityDetailModal.jsx';
import TripForm from '../components/TripForm.jsx';
import NudgeBanner from '../components/NudgeBanner.jsx';
import { tripStatus } from '../lib/insights.js';
import { PlusIcon } from '../components/icons.jsx';

const SECTION_ORDER = ['active', 'upcoming', 'past'];
const SECTION_LABEL = { active: 'Happening now', upcoming: 'Upcoming', past: 'Past adventures' };

/** Tab A — vertical timeline feed of trips grouped by lifecycle. */
export default function Timeline() {
  const { trips } = useApp();
  const [selected, setSelected] = useState(null);
  const [editing, setEditing] = useState(null);
  const [adding, setAdding] = useState(false);

  const grouped = useMemo(() => {
    const g = { active: [], upcoming: [], past: [] };
    for (const t of trips) g[tripStatus(t)].push(t);
    // upcoming soonest-first; past most-recent-first (already reverse sorted).
    g.upcoming.sort((a, b) => a.startDate.localeCompare(b.startDate));
    return g;
  }, [trips]);

  const openEdit = (trip) => {
    setSelected(null);
    setEditing(trip);
  };

  return (
    <div className="space-y-5">
      <header className="flex items-end justify-between">
        <div>
          <p className="text-sm text-ink-soft">Your journey</p>
          <h1 className="font-display text-3xl font-bold text-ink">Timeline</h1>
        </div>
        <button
          onClick={() => setAdding(true)}
          className="flex h-12 w-12 items-center justify-center rounded-4xl bg-accent/90 text-black shadow-glow active:scale-95"
          aria-label="Add trip"
        >
          <PlusIcon className="h-6 w-6" />
        </button>
      </header>

      <NudgeBanner />

      {trips.length === 0 && (
        <div className="glass mt-10 rounded-4xl p-8 text-center">
          <p className="font-display text-xl font-bold text-ink">No trips yet</p>
          <p className="mt-1 text-sm text-ink-soft">Tap the + button to log your first adventure.</p>
        </div>
      )}

      {SECTION_ORDER.map((key) =>
        grouped[key].length ? (
          <section key={key} className="space-y-3">
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${key === 'active' ? 'bg-accent animate-pulse' : 'bg-ink-soft/40'}`} />
              <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-soft">{SECTION_LABEL[key]}</h2>
            </div>
            <div className="relative space-y-4 border-l border-white/10 pl-4">
              {grouped[key].map((trip) => (
                <motion.div key={trip.localId} layout className="relative">
                  <span className="absolute -left-[21px] top-5 h-2.5 w-2.5 rounded-full bg-accent shadow-glow" />
                  <CityCard trip={trip} onOpen={setSelected} />
                </motion.div>
              ))}
            </div>
          </section>
        ) : null,
      )}

      <AnimatePresence>
        {selected && (
          <CityDetailModal
            trip={selected}
            onClose={() => setSelected(null)}
            onEdit={openEdit}
            onDelete={(t) => {
              setSelected(null);
              setEditing({ ...t, __delete: true });
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {(adding || editing) && !editing?.__delete && (
          <TripForm
            trip={editing}
            onClose={() => {
              setAdding(false);
              setEditing(null);
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {editing?.__delete && (
          <DeleteConfirm trip={editing} onClose={() => setEditing(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}

function DeleteConfirm({ trip, onClose }) {
  const { removeTrip } = useApp();
  return (
    <motion.div className="fixed inset-0 z-[70] flex items-center justify-center p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ scale: 0.92 }} animate={{ scale: 1 }} className="glass-strong relative w-full max-w-xs rounded-4xl p-5 text-center">
        <p className="font-display text-lg font-bold text-ink">Delete “{trip.city}”?</p>
        <p className="mt-1 text-sm text-ink-soft">This removes it locally and from your sheet.</p>
        <div className="mt-4 flex gap-3">
          <button onClick={onClose} className="glass flex-1 rounded-3xl py-2.5 font-semibold text-ink">Cancel</button>
          <button
            onClick={async () => {
              await removeTrip(trip.localId);
              onClose();
            }}
            className="flex-1 rounded-3xl bg-red-500/90 py-2.5 font-semibold text-white"
          >
            Delete
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
