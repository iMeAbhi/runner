import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '../../context/AppContext.jsx';
import {
  computeStats,
  filterByMonths,
  filterByRange,
  placeVisits,
  newYearInsight,
  birthdayInsight,
  distanceTotals,
  topOperators,
  longestTrips,
  topDestinations,
} from '../../utils/insights.js';
import { fmtRange } from '../../utils/dates.js';
import LeaderboardModal from '../LeaderboardModal.jsx';

const FILTERS = [
  { id: '1m', label: '1 Month', months: 1 },
  { id: '2m', label: '2 Months', months: 2 },
  { id: '3m', label: '3 Months', months: 3 },
  { id: '6m', label: '6 Months', months: 6 },
  { id: '1y', label: '1 Year', months: 12 },
  { id: 'all', label: 'All time', months: 0 },
  { id: 'custom', label: 'Custom', months: null },
];

export default function Analytics() {
  const { trips, settings } = useApp();
  const [filter, setFilter] = useState('1y');
  const [range, setRange] = useState({ start: '', end: '' });

  const filtered = useMemo(() => {
    if (filter === 'custom') {
      if (!range.start || !range.end) return trips;
      return filterByRange(trips, range.start, range.end);
    }
    const f = FILTERS.find((x) => x.id === filter);
    return filterByMonths(trips, f.months);
  }, [trips, filter, range]);

  const stats = useMemo(() => computeStats(filtered), [filtered]);
  const distance = useMemo(() => distanceTotals(filtered), [filtered]);
  const [modal, setModal] = useState(null); // { title, items } | null

  // Life-moment insights are inherently lifetime, so they ignore the date filter.
  const home = useMemo(() => placeVisits(trips, settings.homeLocation), [trips, settings.homeLocation]);
  const current = useMemo(() => placeVisits(trips, settings.currentLocation), [trips, settings.currentLocation]);
  const newYear = useMemo(() => newYearInsight(trips, settings), [trips, settings]);
  const bday = useMemo(() => birthdayInsight(trips, settings), [trips, settings]);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-3xl font-black">Insights</h1>
        <p className="text-sm text-ink-dim">Your travel, by the numbers.</p>
      </header>

      {/* Horizontal filter rail */}
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className="pill glass shrink-0"
            style={
              filter === f.id
                ? { background: 'rgb(var(--accent) / 0.28)', color: 'rgb(var(--ink))' }
                : { color: 'rgb(var(--ink-dim))' }
            }
          >
            {f.label}
          </button>
        ))}
      </div>

      <AnimatePresence>
        {filter === 'custom' && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="flex gap-3 overflow-hidden">
            <input type="date" value={range.start} onChange={(e) => setRange((r) => ({ ...r, start: e.target.value }))} className="glass flex-1 rounded-3xl px-3 py-2 text-sm text-ink outline-none" />
            <input type="date" value={range.end} onChange={(e) => setRange((r) => ({ ...r, end: e.target.value }))} className="glass flex-1 rounded-3xl px-3 py-2 text-sm text-ink outline-none" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Distance traveled — Air / Rail / Ground */}
      <div className="space-y-2">
        <DistanceBar label="Air distance ✈️" km={distance.air} max={distance.total} />
        <DistanceBar label="Rail distance 🚆" km={distance.rail} max={distance.total} />
        <DistanceBar label="Ground distance 🚗" km={distance.ground} max={distance.total} />
      </div>

      {/* Top-5 leaderboards */}
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        <LbButton onClick={() => setModal({ title: 'Top flight operators', items: topOperators(filtered) })}>✈️ Operators</LbButton>
        <LbButton onClick={() => setModal({ title: 'Longest trips', items: longestTrips(filtered) })}>⏳ Longest trips</LbButton>
        <LbButton onClick={() => setModal({ title: 'Most-visited destinations', items: topDestinations(filtered) })}>📍 Destinations</LbButton>
      </div>

      {/* Metrics grid — re-animates whenever the filter morphs the dataset */}
      <motion.div key={filter + filtered.length} initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="grid grid-cols-2 gap-3">
        <Stat big value={stats.uniqueCities} label="Cities" />
        <Stat big value={stats.uniqueStates} label="Indian States & UTs" />
        <Stat value={stats.uniqueCountries} label="Countries 🌍" />
        <Stat value={stats.hotels} label="Hotel stays 🏨" />
        <Stat value={stats.flights} label="Flights ✈️" />
        <Stat value={stats.trains} label="Trains 🚆" />
        <Stat value={stats.cabs} label="Road trips 🚗" />
        <Stat
          value={stats.topMode ? stats.topMode.count : 0}
          label={stats.topMode ? `Most used · ${stats.topMode.label}` : 'Most-used ride'}
        />
      </motion.div>

      {/* Duration + frequency */}
      <div className="grid grid-cols-1 gap-3">
        <div className="glass rounded-4xl p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-dim">Longest trip</p>
          {stats.longest ? (
            <p className="mt-1 text-lg font-bold text-ink">
              {stats.longest.trip.City} · {stats.longest.days} days
              <span className="block text-xs font-normal text-ink-dim">{fmtRange(stats.longest.trip.Start_Date, stats.longest.trip.End_Date)}</span>
            </p>
          ) : (
            <p className="mt-1 text-sm text-ink-dim">No trips in range</p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="glass rounded-4xl p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-dim">Most-visited hub</p>
            <p className="mt-1 text-lg font-bold text-ink">{stats.topCity ? `${stats.topCity.name}` : '—'}</p>
            {stats.topCity && <p className="text-xs text-ink-dim">{stats.topCity.count} visits</p>}
          </div>
          <div className="glass rounded-4xl p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-dim">Top region</p>
            <p className="mt-1 text-lg font-bold text-ink">{stats.topRegion ? stats.topRegion.name : '—'}</p>
            {stats.topRegion && <p className="text-xs text-ink-dim">{stats.topRegion.count} trips</p>}
          </div>
        </div>
      </div>

      {/* Life moments — home base, New Year's & birthday (lifetime, not filtered) */}
      {(home || current || newYear.celebrations.length > 0 || bday) && (
        <div className="space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wide text-ink-dim">Life moments</h2>

          {(home || current) && (
            <div className="grid grid-cols-2 gap-3">
              {home && (
                <Moment
                  title={`🏠 Home · ${home.place}`}
                  big={`${home.visits} trip${home.visits === 1 ? '' : 's'} home`}
                  sub={
                    home.daysSince == null
                      ? 'No home visits logged yet'
                      : home.daysSince === 0
                      ? 'You’re home right now 💛'
                      : `Last home ${home.daysSince} day${home.daysSince === 1 ? '' : 's'} ago`
                  }
                />
              )}
              {current && (
                <Moment
                  title={`📍 Based in · ${current.place}`}
                  big={`${current.visits} logged stay${current.visits === 1 ? '' : 's'}`}
                  sub={current.totalDays ? `${current.totalDays} nights tracked here` : 'Your current base'}
                />
              )}
            </div>
          )}

          {newYear.celebrations.length > 0 && (
            <Moment
              title="🎆 New Year’s Eve"
              big={
                newYear.awayCount > 0
                  ? `${newYear.awayCount} New Year${newYear.awayCount === 1 ? '' : 's'} away`
                  : 'Always close to base'
              }
              sub={
                newYear.topAwayCity
                  ? `Favourite NYE escape: ${newYear.topAwayCity.name}${newYear.topAwayCity.count > 1 ? ` (${newYear.topAwayCity.count}×)` : ''}`
                  : `Logged ${newYear.celebrations.length} New Year${newYear.celebrations.length === 1 ? '' : 's'} in ${newYear.celebrations[0].city}`
              }
            />
          )}

          {bday && (
            <Moment
              title="🎂 Birthday"
              big={bday.daysUntil === 0 ? 'Happy birthday! 🎉' : `${bday.daysUntil} day${bday.daysUntil === 1 ? '' : 's'} to go`}
              sub={
                bday.awayCount > 0
                  ? `You’ve spent ${bday.awayCount} birthday${bday.awayCount === 1 ? '' : 's'} away${bday.topAwayCity ? `, most in ${bday.topAwayCity.name}` : ''}. Plan a trip?`
                  : 'No birthdays away from home yet — plan one?'
              }
            />
          )}
        </div>
      )}

      <LeaderboardModal
        isOpen={!!modal}
        onClose={() => setModal(null)}
        title={modal?.title || ''}
        items={modal?.items || []}
      />
    </div>
  );
}

function DistanceBar({ label, km, max }) {
  const pct = max > 0 ? Math.round((km / max) * 100) : 0;
  return (
    <div className="glass rounded-3xl px-4 py-3">
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-xs font-semibold text-ink-dim">{label}</span>
        <span className="text-sm font-black text-ink">{km.toLocaleString()} km</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/10">
        <motion.div
          className="h-full rounded-full"
          style={{ background: 'linear-gradient(90deg, rgb(var(--accent)), rgb(var(--accent-2)))' }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
}

function LbButton({ children, onClick }) {
  return (
    <button onClick={onClick} className="pill glass shrink-0" style={{ color: 'rgb(var(--ink))' }}>
      {children}
    </button>
  );
}

function Moment({ title, big, sub }) {
  return (
    <div className="glass rounded-4xl p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-dim">{title}</p>
      <p className="mt-1 text-lg font-bold text-ink">{big}</p>
      {sub && <p className="text-xs text-ink-dim">{sub}</p>}
    </div>
  );
}

function Stat({ value, label, big }) {
  return (
    <div className="glass rounded-3xl p-4">
      <p className={`font-black text-accent ${big ? 'text-4xl' : 'text-3xl'}`}>{value}</p>
      <p className="text-xs font-semibold text-ink-dim">{label}</p>
    </div>
  );
}

