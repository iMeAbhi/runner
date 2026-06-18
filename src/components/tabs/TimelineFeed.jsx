import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useApp } from '../../context/AppContext.jsx';
import { parseISO, startOfToday } from '../../utils/dates.js';
import { daysSinceLastTrip } from '../../utils/insights.js';
import CityCard from '../CityCard.jsx';
import CityDetail from '../CityDetail.jsx';
import TripForm from '../TripForm.jsx';
import NudgeBanner from '../NudgeBanner.jsx';
import Portal from '../Portal.jsx';
import { PlusIcon } from '../Icons.jsx';

// Classify a trip as past / active / upcoming relative to today.
function statusOf(trip) {
  const today = startOfToday();
  const start = parseISO(trip.Start_Date);
  const end = parseISO(trip.End_Date);
  if (end < today) return 'past';
  if (start > today) return 'upcoming';
  return 'active';
}

export default function TimelineFeed() {
  const { trips, refreshFromSheet, syncCalendar, syncing } = useApp();
  const [selected, setSelected] = useState(null);
  const [editing, setEditing] = useState(null);
  const [adding, setAdding] = useState(false);

  // Newest first; group by status for the vertical timeline.
  const sorted = useMemo(
    () => [...trips].filter((t) => t.Start_Date).sort((a, b) => (a.Start_Date < b.Start_Date ? 1 : -1)),
    [trips]
  );
  const gap = daysSinceLastTrip(trips);

  const openEdit = (trip) => {
    setSelected(null);
    setEditing(trip);
  };

  return (
    <div>
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black">Timeline</h1>
          <p className="text-sm text-ink-dim">{trips.length} trips logged</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={syncCalendar} className="glass rounded-full px-3 py-2 text-xs font-bold text-ink" disabled={syncing} aria-label="Sync calendar">
            📅 Calendar
          </button>
          <button onClick={refreshFromSheet} className="glass rounded-full px-4 py-2 text-xs font-bold text-ink" disabled={syncing}>
            {syncing ? 'Syncing…' : 'Sync'}
          </button>
        </div>
      </header>

      {gap !== null && gap > 90 && <NudgeBanner days={gap} />}

      {sorted.length === 0 ? (
        <div className="glass rounded-4xl p-8 text-center">
          <p className="text-lg font-bold">No trips yet</p>
          <p className="mt-1 text-sm text-ink-dim">Tap + to log your first adventure, or Sync to pull from your sheet.</p>
        </div>
      ) : (
        <div className="relative space-y-4 pl-4">
          {/* Timeline rail */}
          <div className="absolute bottom-2 left-1 top-2 w-0.5 rounded-full" style={{ background: 'rgb(var(--accent) / 0.3)' }} />
          {sorted.map((trip) => (
            <div key={trip.ID} className="relative">
              <span className="absolute -left-[13px] top-6 h-2.5 w-2.5 rounded-full ring-4 ring-canvas" style={{ background: 'rgb(var(--accent))' }} />
              <CityCard trip={trip} status={statusOf(trip)} onOpen={setSelected} />
            </div>
          ))}
        </div>
      )}

      {/* Floating add button + modals are portaled to <body> so `position: fixed`
          anchors to the viewport, not the transformed page-transition wrapper. */}
      <Portal>
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => setAdding(true)}
          className="fixed bottom-28 right-5 z-30 flex h-14 w-14 items-center justify-center rounded-full text-white shadow-glow"
          style={{ background: 'rgb(var(--accent))' }}
          aria-label="Log a trip"
        >
          <PlusIcon width={26} height={26} />
        </motion.button>

        <AnimatePresence>
          {selected && <CityDetail key="detail" trip={selected} onClose={() => setSelected(null)} onEdit={openEdit} />}
          {adding && <TripForm key="add" onClose={() => setAdding(false)} />}
          {editing && <TripForm key="edit" initial={editing} onClose={() => setEditing(null)} />}
        </AnimatePresence>
      </Portal>
    </div>
  );
}
