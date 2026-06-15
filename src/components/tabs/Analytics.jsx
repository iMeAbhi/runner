import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '../../context/AppContext.jsx';
import {
  computeStats,
  filterByMonths,
  filterByRange,
  indiaCoverage,
} from '../../utils/insights.js';
import { fmtRange } from '../../utils/dates.js';

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
  const { trips } = useApp();
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
  const coverage = useMemo(() => indiaCoverage(trips), [trips]); // coverage is lifetime

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

      {/* Metrics grid — re-animates whenever the filter morphs the dataset */}
      <motion.div key={filter + filtered.length} initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="grid grid-cols-2 gap-3">
        <Stat big value={stats.uniqueCities} label="Cities" />
        <Stat big value={stats.uniqueRegions} label="States / Countries" />
        <Stat value={stats.flights} label="Flights ✈️" />
        <Stat value={stats.trains} label="Trains 🚆" />
        <Stat value={stats.cabs} label="Road trips 🚗" />
        <Stat value={stats.hotels} label="Hotel stays 🏨" />
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

      {/* India coverage wheel */}
      <div className="glass rounded-4xl p-4">
        <div className="flex items-center gap-4">
          <CoverageWheel pct={coverage.pct} />
          <div>
            <p className="text-sm font-bold text-ink">India coverage</p>
            <p className="text-xs text-ink-dim">{coverage.coveredCount} of {coverage.total} States & UTs</p>
          </div>
        </div>
        {coverage.remaining.length > 0 && (
          <div className="mt-3">
            <p className="mb-1 text-xs font-semibold text-ink-dim">Still to explore</p>
            <div className="flex flex-wrap gap-1.5">
              {coverage.remaining.map((r) => (
                <span key={r} className="rounded-full bg-white/5 px-2.5 py-1 text-[11px] text-ink-dim">{r}</span>
              ))}
            </div>
          </div>
        )}
      </div>
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

function CoverageWheel({ pct }) {
  const r = 30;
  const c = 2 * Math.PI * r;
  return (
    <svg width="84" height="84" viewBox="0 0 84 84" className="shrink-0">
      <defs>
        <linearGradient id="cov" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="rgb(var(--accent))" />
          <stop offset="1" stopColor="rgb(var(--accent-2))" />
        </linearGradient>
      </defs>
      <circle cx="42" cy="42" r={r} fill="none" stroke="rgb(var(--ink-dim) / 0.22)" strokeWidth="8" />
      <motion.circle
        cx="42" cy="42" r={r} fill="none" stroke="url(#cov)" strokeWidth="8" strokeLinecap="round"
        strokeDasharray={c}
        initial={{ strokeDashoffset: c }}
        animate={{ strokeDashoffset: c - (c * Math.min(pct, 100)) / 100 }}
        transition={{ duration: 0.9, ease: 'easeOut' }}
        transform="rotate(-90 42 42)"
      />
      <text x="42" y="47" textAnchor="middle" className="fill-ink text-[16px] font-black">{pct}%</text>
    </svg>
  );
}
