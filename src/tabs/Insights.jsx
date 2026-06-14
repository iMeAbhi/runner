import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useApp } from '../context/AppContext.jsx';
import { computeAnalytics, filterByWindow } from '../lib/insights.js';
import { computeIndiaCoverage } from '../lib/indiaStates.js';
import GlassCard from '../components/GlassCard.jsx';
import ProgressWheel from '../components/ProgressWheel.jsx';
import { FlightIcon, TrainIcon, CabIcon, HotelIcon } from '../components/icons.jsx';

const FILTERS = [
  { id: '1m', label: '1 Month', months: 1 },
  { id: '2m', label: '2 Months', months: 2 },
  { id: '3m', label: '3 Months', months: 3 },
  { id: '6m', label: '6 Months', months: 6 },
  { id: '1y', label: '1 Year', months: 12 },
  { id: 'custom', label: 'Custom', months: null },
];

/** Tab C — interactive analytics dashboard. */
export default function Insights() {
  const { trips } = useApp();
  const [filter, setFilter] = useState('1y');
  const [range, setRange] = useState({ from: '', to: '' });

  const active = FILTERS.find((f) => f.id === filter);
  const filtered = useMemo(() => {
    if (filter === 'custom') return filterByWindow(trips, null, range.from && range.to ? range : null);
    return filterByWindow(trips, active.months);
  }, [trips, filter, active, range]);

  const stats = useMemo(() => computeAnalytics(filtered), [filtered]);
  const coverage = useMemo(() => computeIndiaCoverage(trips), [trips]); // coverage is all-time

  return (
    <div className="space-y-5">
      <header>
        <p className="text-sm text-ink-soft">Your patterns</p>
        <h1 className="font-display text-3xl font-bold text-ink">Insights</h1>
      </header>

      {/* Horizontal filter rail */}
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`relative whitespace-nowrap rounded-3xl px-4 py-2 text-sm font-medium transition ${
              filter === f.id ? 'text-black' : 'glass text-ink-soft'
            }`}
          >
            {filter === f.id && (
              <motion.span layoutId="filter-pill" className="absolute inset-0 rounded-3xl bg-accent shadow-glow" transition={{ type: 'spring', stiffness: 400, damping: 32 }} />
            )}
            <span className="relative z-10">{f.label}</span>
          </button>
        ))}
      </div>

      {filter === 'custom' && (
        <GlassCard className="flex gap-3 p-4">
          <label className="flex-1 text-xs text-ink-soft">
            From
            <input type="date" value={range.from} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} className={inputCls} />
          </label>
          <label className="flex-1 text-xs text-ink-soft">
            To
            <input type="date" value={range.to} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} className={inputCls} />
          </label>
        </GlassCard>
      )}

      {/* Volumetric metrics morph on filter change */}
      <AnimatePresence mode="wait">
        <motion.div
          key={filter + range.from + range.to}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.25 }}
          className="space-y-5"
        >
          <div className="grid grid-cols-2 gap-3">
            <Stat big value={stats.uniqueCities} label="Cities visited" />
            <Stat big value={stats.uniqueCountries} label="Countries crossed" />
          </div>

          <div className="grid grid-cols-4 gap-3">
            <IconStat Icon={FlightIcon} value={stats.flights} label="Flights" />
            <IconStat Icon={TrainIcon} value={stats.trains} label="Trains" />
            <IconStat Icon={CabIcon} value={stats.cabs} label="Cabs" />
            <IconStat Icon={HotelIcon} value={stats.hotels} label="Stays" />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Stat value={`${stats.longestTrip?.days || 0}d`} label="Longest trip" />
            <Stat value={stats.totalDays} label="Total days" />
            <Stat value={stats.tripCount} label="Trips" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <GlassCard className="p-4">
              <p className="text-xs uppercase tracking-wide text-ink-soft">Most visited</p>
              <p className="font-display text-xl font-bold text-ink">{stats.mostVisitedCity?.label || '—'}</p>
              <p className="text-xs text-ink-soft">{stats.mostVisitedCity ? `${stats.mostVisitedCity.count} visits` : 'No data'}</p>
            </GlassCard>
            <GlassCard className="p-4">
              <p className="text-xs uppercase tracking-wide text-ink-soft">Most explored hub</p>
              <p className="font-display text-xl font-bold text-ink">{stats.mostExploredHub?.label || '—'}</p>
              <p className="text-xs text-ink-soft">{stats.mostExploredHub ? `${stats.mostExploredHub.count} entries` : 'No data'}</p>
            </GlassCard>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* India coverage (all-time) */}
      <GlassCard className="flex flex-col items-center gap-4 p-5 sm:flex-row sm:items-center">
        <ProgressWheel percent={coverage.percent} label="of India" sub={`${coverage.visited.length}/36`} />
        <div className="flex-1">
          <h3 className="font-display text-lg font-bold text-ink">India Coverage</h3>
          <p className="text-xs text-ink-soft">
            {coverage.visited.length} of 36 states & UTs explored. {coverage.remaining.length} to go.
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {coverage.remaining.slice(0, 10).map((s) => (
              <span key={s} className="rounded-full bg-white/8 px-2 py-0.5 text-[10px] text-ink-soft">{s}</span>
            ))}
            {coverage.remaining.length > 10 && (
              <span className="rounded-full bg-white/8 px-2 py-0.5 text-[10px] text-ink-soft">+{coverage.remaining.length - 10} more</span>
            )}
          </div>
        </div>
      </GlassCard>
    </div>
  );
}

const inputCls = 'mt-1 w-full rounded-3xl bg-white/10 px-3 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-accent';

function Stat({ value, label, big }) {
  return (
    <GlassCard className="p-4">
      <p className={`font-display font-bold text-ink ${big ? 'text-4xl' : 'text-2xl'}`}>{value}</p>
      <p className="text-xs text-ink-soft">{label}</p>
    </GlassCard>
  );
}

function IconStat({ Icon, value, label }) {
  return (
    <GlassCard className="flex flex-col items-center gap-1 p-3">
      <Icon className="h-5 w-5 text-accent" />
      <p className="font-display text-xl font-bold text-ink">{value}</p>
      <p className="text-[10px] text-ink-soft">{label}</p>
    </GlassCard>
  );
}
