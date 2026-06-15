import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useApp } from '../context/AppContext.jsx';
import { fmtRange, fmtNice } from '../utils/dates.js';
import { classifyTransport, tripDays, photoList, cityInsights } from '../utils/insights.js';
import { TRANSPORT_ICON, HotelIcon, PinIcon, CloseIcon, SparkIcon } from './Icons.jsx';

// Full-screen deep dive. Uses the SAME layoutId as CityCard so Framer Motion
// pops it open seamlessly from the thumbnail (shared layout animation).
export default function CityDetail({ trip, onClose, onEdit }) {
  const { trips, deleteTrip, syncTripFolder, notify } = useApp();
  const Icon = TRANSPORT_ICON[classifyTransport(trip.Transport_Mode)] || PinIcon;
  const days = tripDays(trip);
  const insight = cityInsights(trips, trip.City);

  // Gallery mirrors the trip's Drive folder. Seed with whatever we already have,
  // then refresh from the folder on open so hand-added photos show up too.
  const [photos, setPhotos] = useState(() => photoList(trip));
  const [refreshing, setRefreshing] = useState(false);
  const cover = photos[0];

  useEffect(() => {
    let alive = true;
    (async () => {
      setRefreshing(true);
      const urls = await syncTripFolder(trip);
      if (alive && urls) setPhotos(urls);
      if (alive) setRefreshing(false);
    })();
    return () => {
      alive = false;
    };
    // Re-run only when the trip identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trip.ID]);

  const remove = async () => {
    await deleteTrip(trip.ID);
    notify('Trip deleted', 'ok');
    onClose();
  };

  return (
    <motion.div
      className="fixed inset-0 z-50 overflow-y-auto"
      initial={{ backgroundColor: 'rgba(0,0,0,0)' }}
      animate={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
      exit={{ backgroundColor: 'rgba(0,0,0,0)' }}
    >
      <motion.div
        layoutId={`card-${trip.ID}`}
        className="relative mx-auto min-h-full max-w-md overflow-hidden bg-canvas"
      >
        {/* Hero */}
        <motion.div
          layoutId={`cover-${trip.ID}`}
          className="absolute inset-x-0 top-0 h-72"
          style={
            cover
              ? { backgroundImage: `url(${cover})`, backgroundSize: 'cover', backgroundPosition: 'center' }
              : { background: 'linear-gradient(135deg, rgb(var(--accent) / 0.6), rgb(var(--accent-2) / 0.5))' }
          }
        />
        <div className="absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-black/40 to-canvas" />

        <div className="relative px-5 pb-28 pt-4">
          <div className="flex justify-between">
            <button onClick={onClose} className="glass-strong rounded-full p-2.5 text-white">
              <CloseIcon width={20} height={20} />
            </button>
            <span className="glass-strong rounded-full p-2.5 text-white">
              <Icon width={20} height={20} />
            </span>
          </div>

          <div className="mt-40 text-white">
            <motion.h1 layoutId={`title-${trip.ID}`} className="text-4xl font-black drop-shadow">
              {trip.City}
            </motion.h1>
            <p className="text-base font-medium text-white/85">{trip.State_Country}</p>
          </div>

          {/* Facts */}
          <div className="mt-5 grid grid-cols-2 gap-3">
            <Fact label="Dates" value={fmtRange(trip.Start_Date, trip.End_Date)} />
            <Fact label="Duration" value={`${days} day${days > 1 ? 's' : ''}`} />
            <Fact label="Transport" value={trip.Transport_Mode || '—'} icon={<Icon width={16} height={16} />} />
            <Fact label="Stay" value={trip.Accommodation || '—'} icon={<HotelIcon width={16} height={16} />} />
          </div>

          <p className="mt-2 text-xs text-ink-dim">
            {fmtNice(trip.Start_Date)} → {fmtNice(trip.End_Date)}
          </p>

          {/* Fun insights */}
          <div className="glass mt-5 rounded-4xl p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-bold text-accent">
              <SparkIcon width={18} height={18} /> Fun insights
            </div>
            <p className="text-sm leading-relaxed text-ink">
              You've visited <b>{trip.City}</b> <b>{insight.visitCount}</b>{' '}
              time{insight.visitCount > 1 ? 's' : ''}, spending{' '}
              <b>{insight.cumulativeDays}</b> cumulative day
              {insight.cumulativeDays > 1 ? 's' : ''} here — about{' '}
              <b>{insight.sharePct}%</b> of all your logged travel.
            </p>
          </div>

          {/* Gallery */}
          <div className="mt-5">
            <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-ink-dim">
              Gallery
              {refreshing && <span className="text-[11px] font-normal text-accent">syncing Drive…</span>}
            </h3>
            {photos.length === 0 ? (
              <div className="glass rounded-4xl p-6 text-center text-sm text-ink-dim">
                {refreshing ? 'Checking your Drive folder…' : 'No photos yet. Add some via Edit, or drop them into this trip’s Drive folder.'}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {photos.map((url, i) => (
                  <a key={i} href={url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-3xl">
                    <img src={url} loading="lazy" alt={`${trip.City} ${i + 1}`} className="aspect-square w-full object-cover" />
                  </a>
                ))}
              </div>
            )}
            {trip.Drive_Folder_URL && (
              <a href={trip.Drive_Folder_URL} target="_blank" rel="noreferrer" className="mt-3 block text-center text-xs font-semibold text-accent">
                Open Drive folder ↗
              </a>
            )}
          </div>

          <div className="mt-6 flex gap-3">
            <button onClick={() => onEdit(trip)} className="glass flex-1 rounded-3xl py-3 font-bold text-ink">
              Edit
            </button>
            <button onClick={remove} className="rounded-3xl px-5 py-3 font-bold text-white" style={{ background: 'rgba(255,90,90,0.85)' }}>
              Delete
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function Fact({ label, value, icon }) {
  return (
    <div className="glass rounded-3xl p-3">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-dim">
        {icon}
        {label}
      </div>
      <div className="mt-1 truncate text-sm font-bold text-ink">{value}</div>
    </div>
  );
}
