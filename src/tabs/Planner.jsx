import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useApp } from '../context/AppContext.jsx';
import { annualTimeOffPercent, findOptimalWindows } from '../lib/leaveOptimizer.js';
import { buildGoogleFlightsUrl } from '../lib/flights.js';
import GlassCard from '../components/GlassCard.jsx';

/** Tab B — Leave & Trip Planner: arbitrage engine + live balances. */
export default function Planner() {
  const { holidays, usingCustomHolidays, settings } = useApp();
  const [location, setLocation] = useState('');
  const [length, setLength] = useState(9);
  const [windows, setWindows] = useState(null);

  const optimize = () => {
    setWindows(findOptimalWindows({ tripLength: Number(length) || 1, holidays, maxResults: 8 }));
  };

  // Live remaining balances per category.
  const balances = useMemo(() => {
    const base = settings.ANNUAL_LEAVES || {};
    const used = settings.leavesUsed || {};
    return Object.keys(base).map((k) => ({
      key: k,
      total: base[k] || 0,
      used: used[k] || 0,
      remaining: Math.max(0, (base[k] || 0) - (used[k] || 0)),
    }));
  }, [settings.ANNUAL_LEAVES, settings.leavesUsed]);

  const totalLeavesUsed = balances.reduce((s, b) => s + b.used, 0);
  const annual = useMemo(
    () => annualTimeOffPercent({ holidays, leavesTaken: totalLeavesUsed }),
    [holidays, totalLeavesUsed],
  );

  return (
    <div className="space-y-5">
      <header>
        <p className="text-sm text-ink-soft">Maximise every leave</p>
        <h1 className="font-display text-3xl font-bold text-ink">Leave Optimizer</h1>
      </header>

      {/* Arbitrage input */}
      <GlassCard className="space-y-3 p-4">
        <div className="grid grid-cols-3 gap-3">
          <label className="col-span-2 block">
            <span className="mb-1 block text-xs font-medium text-ink-soft">Destination</span>
            <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Ladakh" className={inputCls} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-ink-soft">Days</span>
            <input type="number" min="1" value={length} onChange={(e) => setLength(e.target.value)} className={inputCls} />
          </label>
        </div>
        <button onClick={optimize} className="w-full rounded-3xl bg-accent/90 py-3 font-semibold text-black shadow-glow active:scale-95">
          Find optimal windows
        </button>
        <p className="text-[11px] text-ink-soft">
          Scans 52 weeks ahead using {usingCustomHolidays ? 'your company' : 'the default'} holiday calendar
          {usingCustomHolidays ? '' : ' (override it in Settings)'}.
        </p>
      </GlassCard>

      {/* Results */}
      {windows && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-soft">
            Best blocks for a {length}-day trip
          </h2>
          {windows.length === 0 && <p className="text-sm text-ink-soft">No windows found.</p>}
          {windows.map((w, i) => (
            <motion.div
              key={w.startDate}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
            >
              <GlassCard className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-display text-lg font-bold text-ink">
                      {fmt(w.startDate)} → {fmt(w.endDate)}
                    </p>
                    <p className="text-xs text-ink-soft">
                      {w.length} days off · {w.weekendDays} weekend · {w.holidayDays} holiday
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-display text-2xl font-bold text-accent">{w.requiredLeaves}</p>
                    <p className="text-[10px] uppercase tracking-wide text-ink-soft">leaves</p>
                  </div>
                </div>

                {/* Day strip */}
                <div className="mt-3 flex gap-1">
                  {w.dayBreakdown.map((d) => (
                    <span
                      key={d.date}
                      title={`${d.date} (${d.kind})`}
                      className={`h-2 flex-1 rounded-full ${
                        d.kind === 'leave' ? 'bg-accent' : d.kind === 'holiday' ? 'bg-accent-2' : 'bg-white/15'
                      }`}
                    />
                  ))}
                </div>

                <div className="mt-3 flex items-center justify-between">
                  <span className="text-xs text-ink-soft">
                    Efficiency: <b className="text-ink">{w.efficiency}×</b> days/leave
                  </span>
                  <a
                    href={buildGoogleFlightsUrl({
                      origin: settings.HOME_LOCATION,
                      destination: location || 'anywhere',
                      departDate: w.startDate,
                      returnDate: w.endDate,
                    })}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-3xl bg-accent-2/20 px-3 py-1.5 text-xs font-semibold text-ink"
                  >
                    Flights ↗
                  </a>
                </div>
              </GlassCard>
            </motion.div>
          ))}
        </section>
      )}

      {/* Live balances */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-soft">Leave balances</h2>
        <div className="grid grid-cols-2 gap-3">
          {balances.map((b) => (
            <GlassCard key={b.key} className="p-4">
              <p className="text-xs uppercase tracking-wide text-ink-soft">{b.key}</p>
              <p className="font-display text-2xl font-bold text-ink">
                {b.remaining}
                <span className="text-sm font-normal text-ink-soft">/{b.total}</span>
              </p>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-accent" style={{ width: `${b.total ? (b.remaining / b.total) * 100 : 0}%` }} />
              </div>
            </GlassCard>
          ))}
        </div>

        <GlassCard className="p-4">
          <p className="text-xs uppercase tracking-wide text-ink-soft">Annual time-off</p>
          <p className="font-display text-3xl font-bold text-accent">{annual.percent}%</p>
          <p className="text-xs text-ink-soft">
            {annual.totalNonWorking} non-working days / {annual.daysInYear}
            {'  '}· {annual.weekendCount} weekend, {annual.weekdayHolidays} holiday, {annual.leavesTaken} leave
          </p>
        </GlassCard>
      </section>
    </div>
  );
}

const inputCls =
  'w-full rounded-3xl bg-white/10 px-3 py-2.5 text-sm text-ink placeholder:text-ink-soft/60 outline-none focus:ring-2 focus:ring-accent';

function fmt(iso) {
  return new Date(iso).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}
