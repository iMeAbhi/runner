import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '../context/AppContext.jsx';
import { optimizeLeave } from '../utils/leaveOptimizer.js';
import { fmtRange } from '../utils/dates.js';
import { SparkIcon } from './Icons.jsx';

// Shown by the Timeline when it's been > 90 days since the last trip ended.
// Prompts for a destination + duration, runs the leave optimizer, and deep-links
// to Google Flights pre-filled from HOME_LOCATION on the optimized dates.
export default function NudgeBanner({ days }) {
  const { settings, activeHolidays } = useApp();
  const [open, setOpen] = useState(false);
  const [dest, setDest] = useState('');
  const [length, setLength] = useState(7);
  const [best, setBest] = useState(null);

  const run = () => {
    const blocks = optimizeLeave({ length: Number(length), holidays: activeHolidays, maxResults: 1 });
    setBest(blocks[0] || null);
  };

  const flightsUrl = () => {
    const home = settings.homeLocation || 'home';
    const q = `Flights from ${home} to ${dest || 'anywhere'} on ${best.startISO} returning ${best.endISO}`;
    return `https://www.google.com/travel/flights?q=${encodeURIComponent(q)}`;
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-strong mb-4 overflow-hidden rounded-4xl p-4"
      style={{ boxShadow: '0 0 28px -6px rgb(var(--accent) / 0.45)' }}
    >
      <div className="flex items-start gap-3">
        <span className="text-accent">
          <SparkIcon width={24} height={24} />
        </span>
        <div className="flex-1">
          <p className="text-sm font-bold text-ink">It's been over 3 months since your last adventure.</p>
          <p className="text-xs text-ink-dim">{days} days, to be exact. Time to explore — pick an unvisited destination.</p>
          {!open && (
            <button
              onClick={() => setOpen(true)}
              className="mt-3 rounded-full px-4 py-2 text-sm font-bold text-ink shadow-glow"
              style={{ background: 'rgb(var(--accent) / 0.85)' }}
            >
              Plan an escape →
            </button>
          )}
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="mt-4 flex flex-wrap items-end gap-3">
              <label className="flex flex-1 flex-col gap-1 text-xs font-semibold text-ink-dim">
                Destination
                <input value={dest} onChange={(e) => setDest(e.target.value)} placeholder="e.g. Ladakh" className="glass rounded-3xl px-3 py-2 text-sm text-ink outline-none" />
              </label>
              <label className="flex w-24 flex-col gap-1 text-xs font-semibold text-ink-dim">
                Days
                <input type="number" min="2" max="30" value={length} onChange={(e) => setLength(e.target.value)} className="glass rounded-3xl px-3 py-2 text-sm text-ink outline-none" />
              </label>
              <button onClick={run} className="rounded-3xl px-4 py-2 text-sm font-bold text-ink" style={{ background: 'rgb(var(--accent) / 0.3)' }}>
                Optimize
              </button>
            </div>

            {best && (
              <div className="glass mt-3 rounded-3xl p-3">
                <p className="text-sm font-bold text-ink">{fmtRange(best.startISO, best.endISO)}</p>
                <p className="text-xs text-ink-dim">
                  {best.totalDays} days off using just <b className="text-accent">{best.requiredLeaves}</b> leaves
                  ({best.weekendDays} weekend + {best.holidayDays} holiday days stacked).
                </p>
                <a href={flightsUrl()} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs font-bold text-accent">
                  Open in Google Flights ↗
                </a>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
