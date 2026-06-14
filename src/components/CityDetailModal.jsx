import { motion } from 'framer-motion';
import { useApp } from '../context/AppContext.jsx';
import { cityFunInsights, tripDays, tripStatus } from '../lib/insights.js';
import { transitIcon, CloseIcon, HotelIcon, SparkIcon } from './icons.jsx';

/**
 * Full-screen city deep-dive. Pops open from the tapped CityCard via shared
 * layout ids — the cover image and title animate seamlessly into place.
 */
export default function CityDetailModal({ trip, onClose, onEdit, onDelete }) {
  const { trips } = useApp();
  if (!trip) return null;

  const fun = cityFunInsights(trips, trip.city);
  const modes = Array.isArray(trip.transit) ? trip.transit : trip.transit ? [trip.transit] : [];
  const photos = trip.photos || [];
  const status = tripStatus(trip);

  return (
    <motion.div className="fixed inset-0 z-50 overflow-y-auto" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <motion.div
        layoutId={`card-${trip.localId}`}
        className="relative mx-auto min-h-full w-full max-w-md overflow-hidden bg-canvas shadow-glass"
      >
        {/* Hero cover */}
        <motion.div layoutId={`cover-${trip.localId}`} className="relative h-72 w-full">
          {photos[0] || trip.coverUrl ? (
            <img src={photos[0] || trip.coverUrl} alt={trip.city} className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full bg-gradient-to-br from-accent/50 via-accent-2/25 to-black" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-canvas via-black/30 to-black/20" />

          <button
            onClick={onClose}
            className="glass absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full text-ink"
            aria-label="Close"
          >
            <CloseIcon className="h-5 w-5" />
          </button>

          <div className="absolute inset-x-0 bottom-0 p-5">
            <motion.h2 layoutId={`title-${trip.localId}`} className="font-display text-4xl font-bold text-white">
              {trip.city}
            </motion.h2>
            <p className="text-sm text-white/80">{[trip.state, trip.country].filter(Boolean).join(' · ')}</p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
          className="space-y-4 p-5 pb-28"
        >
          {/* Quick facts */}
          <div className="glass flex items-center justify-between rounded-4xl p-4">
            <Fact label="Dates" value={formatRange(trip.startDate, trip.endDate)} />
            <Fact label="Duration" value={`${tripDays(trip)} days`} />
            <Fact label="Status" value={cap(status)} />
          </div>

          {/* Transit + accommodation */}
          <div className="glass rounded-4xl p-4">
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-ink-soft">Transit & Stay</h4>
            <div className="flex flex-wrap gap-2">
              {modes.length === 0 && <span className="text-sm text-ink-soft">No transit logged</span>}
              {modes.map((m, i) => {
                const Icon = transitIcon(m);
                return (
                  <span key={i} className="flex items-center gap-1.5 rounded-3xl bg-accent/15 px-3 py-1.5 text-sm text-ink">
                    <Icon className="h-4 w-4 text-accent" /> {m}
                  </span>
                );
              })}
              {trip.accommodation && (
                <span className="flex items-center gap-1.5 rounded-3xl bg-accent-2/15 px-3 py-1.5 text-sm text-ink">
                  <HotelIcon className="h-4 w-4 text-accent-2" /> {trip.accommodation}
                </span>
              )}
            </div>
            {trip.notes && <p className="mt-3 text-sm leading-relaxed text-ink-soft">{trip.notes}</p>}
          </div>

          {/* Fun Insights Box */}
          <div className="glass relative overflow-hidden rounded-4xl p-4">
            <SparkIcon className="absolute -right-3 -top-3 h-20 w-20 text-accent/15" />
            <h4 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-accent">
              <SparkIcon className="h-4 w-4" /> Fun Insights
            </h4>
            <p className="text-sm leading-relaxed text-ink">
              You've visited <b className="text-accent">{trip.city}</b> <b>{fun.visits}</b>{' '}
              {fun.visits === 1 ? 'time' : 'times'}, spending <b>{fun.cumulativeDays}</b> cumulative days here,
              accounting for <b className="text-accent-2">{fun.percentOfAnnual}%</b> of your travels this year.
            </p>
          </div>

          {/* Photo gallery (Google Drive linked) */}
          <div className="glass rounded-4xl p-4">
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-ink-soft">
              Gallery {photos.length ? `· ${photos.length}` : ''}
            </h4>
            {photos.length ? (
              <div className="grid grid-cols-3 gap-2">
                {photos.map((url, i) => (
                  <a key={i} href={url} target="_blank" rel="noreferrer" className="aspect-square overflow-hidden rounded-3xl">
                    <img src={url} alt={`${trip.city} ${i + 1}`} className="h-full w-full object-cover transition-transform active:scale-95" loading="lazy" />
                  </a>
                ))}
              </div>
            ) : (
              <p className="text-sm text-ink-soft">No photos linked yet. Add some when editing this trip.</p>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button onClick={() => onEdit(trip)} className="flex-1 rounded-4xl bg-accent/90 py-3 font-semibold text-black shadow-glow active:scale-95">
              Edit Trip
            </button>
            <button onClick={() => onDelete(trip)} className="glass rounded-4xl px-5 py-3 font-semibold text-red-300 active:scale-95">
              Delete
            </button>
          </div>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

function Fact({ label, value }) {
  return (
    <div className="text-center">
      <p className="text-[10px] uppercase tracking-wider text-ink-soft">{label}</p>
      <p className="text-sm font-semibold text-ink">{value}</p>
    </div>
  );
}
function cap(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
function formatRange(start, end) {
  if (!start) return '—';
  const opts = { month: 'short', day: 'numeric', year: 'numeric' };
  const s = new Date(start).toLocaleDateString(undefined, opts);
  if (!end || end === start) return s;
  const e = new Date(end).toLocaleDateString(undefined, opts);
  return `${s} – ${e}`;
}
