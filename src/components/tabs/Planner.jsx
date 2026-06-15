import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useApp } from '../../context/AppContext.jsx';
import { optimizeLeave } from '../../utils/leaveOptimizer.js';
import { annualTimeOff } from '../../utils/insights.js';
import { fmtRange, fmtNice } from '../../utils/dates.js';

const KIND_COLOR = {
  weekend: 'rgb(var(--accent-2) / 0.5)',
  holiday: 'rgb(var(--accent) / 0.7)',
  leave: 'rgba(255,255,255,0.14)',
};

export default function Planner() {
  const { trips, activeHolidays, usingCustomHolidays, settings } = useApp();
  const [location, setLocation] = useState('');
  const [length, setLength] = useState(9);
  const [results, setResults] = useState(null);

  const run = () => {
    setResults(optimizeLeave({ length: Number(length), holidays: activeHolidays, maxResults: 6 }));
  };

  const timeOff = useMemo(() => annualTimeOff(trips, activeHolidays), [trips, activeHolidays]);

  const balances = Object.entries(settings.leaves).map(([k, total]) => {
    const used = settings.leavesUsed?.[k] || 0;
    return { name: k, total, used, left: Math.max(0, total - used) };
  });

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-3xl font-black">Planner</h1>
        <p className="text-sm text-ink-dim">Arbitrage weekends + holidays into long breaks.</p>
      </header>

      {/* Annual time-off ring */}
      <div className="glass rounded-4xl p-4">
        <div className="flex items-center gap-4">
          <Ring pct={timeOff.pct} />
          <div>
            <p className="text-sm font-bold text-ink">{timeOff.pct}% of the year off</p>
            <p className="text-xs text-ink-dim">
              {timeOff.totalNonWorking} non-working days · {timeOff.weekend} weekend + {timeOff.holidays} holiday + {timeOff.tripWorkdays} trip
            </p>
          </div>
        </div>
      </div>

      {/* Leave balances */}
      <div className="grid grid-cols-3 gap-3">
        {balances.map((b) => (
          <div key={b.name} className="glass rounded-3xl p-3 text-center">
            <p className="text-2xl font-black text-accent">{b.left}</p>
            <p className="text-[11px] font-semibold text-ink-dim">{b.name} left</p>
            <p className="text-[10px] text-ink-dim/70">of {b.total}</p>
          </div>
        ))}
      </div>

      {/* Optimizer input */}
      <div className="glass rounded-4xl p-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-1 flex-col gap-1 text-xs font-semibold text-ink-dim">
            Destination
            <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Ladakh" className="glass rounded-3xl px-3 py-2 text-sm text-ink outline-none" />
          </label>
          <label className="flex w-24 flex-col gap-1 text-xs font-semibold text-ink-dim">
            Trip length
            <input type="number" min="2" max="30" value={length} onChange={(e) => setLength(e.target.value)} className="glass rounded-3xl px-3 py-2 text-sm text-ink outline-none" />
          </label>
        </div>
        <button onClick={run} className="mt-3 w-full rounded-3xl py-3 font-bold text-ink shadow-glow" style={{ background: 'rgb(var(--accent) / 0.85)' }}>
          Find best blocks
        </button>
        <p className="mt-2 text-[11px] text-ink-dim">
          Using {usingCustomHolidays ? 'your custom holiday list' : 'the default public-holiday calendar'} · crawling the next 52 weeks.
        </p>
      </div>

      {/* Results */}
      {results && (
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-ink-dim">
            Best {length}-day windows {location && `for ${location}`}
          </h2>
          {results.map((b, i) => (
            <motion.div
              key={b.startISO}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="glass rounded-4xl p-4"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold text-ink">{fmtRange(b.startISO, b.endISO)}</p>
                  <p className="text-xs text-ink-dim">{fmtNice(b.startISO)} → {fmtNice(b.endISO)}</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-black text-accent">{b.requiredLeaves}</p>
                  <p className="text-[10px] font-semibold text-ink-dim">leaves needed</p>
                </div>
              </div>

              {/* Day breakdown strip */}
              <div className="mt-3 flex gap-1">
                {b.breakdown.map((d) => (
                  <div
                    key={d.iso}
                    title={`${d.iso} · ${d.holidayName || d.kind}`}
                    className="h-7 flex-1 rounded-md"
                    style={{ background: KIND_COLOR[d.kind] }}
                  />
                ))}
              </div>
              <div className="mt-2 flex gap-3 text-[10px] text-ink-dim">
                <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-sm" style={{ background: KIND_COLOR.weekend }} />weekend</span>
                <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-sm" style={{ background: KIND_COLOR.holiday }} />holiday</span>
                <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-sm" style={{ background: KIND_COLOR.leave }} />leave</span>
                <span className="ml-auto font-bold text-accent">{b.efficiency}× value</span>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

function Ring({ pct }) {
  const r = 28;
  const c = 2 * Math.PI * r;
  return (
    <svg width="72" height="72" viewBox="0 0 72 72" className="shrink-0">
      <circle cx="36" cy="36" r={r} fill="none" stroke="rgb(var(--ink-dim) / 0.25)" strokeWidth="7" />
      <motion.circle
        cx="36"
        cy="36"
        r={r}
        fill="none"
        stroke="rgb(var(--accent))"
        strokeWidth="7"
        strokeLinecap="round"
        strokeDasharray={c}
        initial={{ strokeDashoffset: c }}
        animate={{ strokeDashoffset: c - (c * Math.min(pct, 100)) / 100 }}
        transform="rotate(-90 36 36)"
      />
      <text x="36" y="41" textAnchor="middle" className="fill-ink text-[15px] font-black">{pct}%</text>
    </svg>
  );
}
