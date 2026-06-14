import { motion } from 'framer-motion';
import { transitIcon } from './icons.jsx';
import { tripDays, tripStatus } from '../lib/insights.js';

const STATUS_STYLES = {
  active: { ring: 'ring-2 ring-accent', chip: 'bg-accent/30 text-ink', text: 'Active now' },
  upcoming: { ring: 'ring-1 ring-white/10', chip: 'bg-accent-2/25 text-ink', text: 'Upcoming' },
  past: { ring: 'ring-1 ring-white/10', chip: 'bg-white/10 text-ink-soft', text: 'Past' },
};

/**
 * Interactive "City Card" with image backdrop. Uses Framer shared-layout ids so
 * tapping pops it open seamlessly into the full-screen deep dive.
 */
export default function CityCard({ trip, onOpen }) {
  const status = tripStatus(trip);
  const s = STATUS_STYLES[status];
  const modes = Array.isArray(trip.transit) ? trip.transit : trip.transit ? [trip.transit] : [];
  const cover = (trip.photos && trip.photos[0]) || trip.coverUrl;

  return (
    <motion.button
      layoutId={`card-${trip.localId}`}
      onClick={() => onOpen(trip)}
      whileTap={{ scale: 0.97 }}
      className={`group relative h-44 w-full overflow-hidden rounded-4xl text-left shadow-glass ${s.ring}`}
    >
      {/* Backdrop image or gradient fallback */}
      <motion.div layoutId={`cover-${trip.localId}`} className="absolute inset-0">
        {cover ? (
          <img src={cover} alt={trip.city} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-accent/40 via-accent-2/20 to-black/60" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
      </motion.div>

      {/* Glass info strip */}
      <div className="absolute inset-x-0 bottom-0 p-4">
        <div className="mb-1 flex items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold backdrop-blur ${s.chip}`}>
            {s.text}
          </span>
          <div className="flex items-center gap-1 text-white/90">
            {modes.slice(0, 3).map((m, i) => {
              const Icon = transitIcon(m);
              return <Icon key={i} className="h-4 w-4" />;
            })}
          </div>
        </div>
        <motion.h3 layoutId={`title-${trip.localId}`} className="font-display text-2xl font-bold leading-tight text-white">
          {trip.city || 'Untitled'}
        </motion.h3>
        <p className="text-xs text-white/75">
          {[trip.state, trip.country].filter(Boolean).join(' · ')}
        </p>
        <p className="mt-1 text-[11px] font-medium text-white/70">
          {formatRange(trip.startDate, trip.endDate)} · {tripDays(trip)}d
        </p>
      </div>
    </motion.button>
  );
}

function formatRange(start, end) {
  if (!start) return '—';
  const opts = { month: 'short', day: 'numeric' };
  const s = new Date(start).toLocaleDateString(undefined, opts);
  if (!end || end === start) return s;
  const e = new Date(end).toLocaleDateString(undefined, opts);
  return `${s} – ${e}`;
}
