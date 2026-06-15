import { motion } from 'framer-motion';
import { fmtRange } from '../utils/dates.js';
import { classifyTransport, tripDays, photoList } from '../utils/insights.js';
import { TRANSPORT_ICON } from './Icons.jsx';

// Deterministic gradient per city so cards without photos still look distinct.
function hueFor(str = '') {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % 360;
  return h;
}

export default function CityCard({ trip, status, onOpen }) {
  const Icon = TRANSPORT_ICON[classifyTransport(trip.Transport_Mode)] || TRANSPORT_ICON.other;
  const photos = photoList(trip);
  const cover = photos[0];
  const hue = hueFor(trip.City);
  const days = tripDays(trip);

  return (
    <motion.button
      layoutId={`card-${trip.ID}`}
      onClick={() => onOpen(trip)}
      whileTap={{ scale: 0.98 }}
      className="glass relative w-full overflow-hidden rounded-4xl p-4 text-left"
    >
      {/* Cover */}
      <motion.div
        layoutId={`cover-${trip.ID}`}
        className="absolute inset-0 -z-10"
        style={
          cover
            ? { backgroundImage: `url(${cover})`, backgroundSize: 'cover', backgroundPosition: 'center' }
            : { background: `linear-gradient(135deg, hsl(${hue} 70% 45% / 0.55), hsl(${(hue + 60) % 360} 70% 35% / 0.5))` }
        }
      />
      <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

      <div className="flex items-start justify-between">
        <span
          className="pill text-[10px] uppercase tracking-wide"
          style={{
            background:
              status === 'active'
                ? 'rgb(var(--accent) / 0.9)'
                : status === 'upcoming'
                ? 'rgb(var(--accent-2) / 0.35)'
                : 'rgba(255,255,255,0.18)',
            color: '#fff',
          }}
        >
          {status}
        </span>
        <span className="glass rounded-full p-2 text-white">
          <Icon width={18} height={18} />
        </span>
      </div>

      <div className="mt-14 text-white">
        <motion.h3 layoutId={`title-${trip.ID}`} className="text-2xl font-extrabold drop-shadow">
          {trip.City}
        </motion.h3>
        <p className="text-sm font-medium text-white/80">{trip.State_Country}</p>
        <div className="mt-1 flex items-center gap-2 text-xs text-white/70">
          <span>{fmtRange(trip.Start_Date, trip.End_Date)}</span>
          <span>•</span>
          <span>{days} day{days > 1 ? 's' : ''}</span>
          {photos.length > 0 && (
            <>
              <span>•</span>
              <span>{photos.length} 📷</span>
            </>
          )}
        </div>
      </div>
    </motion.button>
  );
}
