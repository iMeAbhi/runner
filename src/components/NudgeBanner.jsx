import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useApp } from '../context/AppContext.jsx';
import { daysSinceLastTrip } from '../lib/insights.js';
import { findOptimalWindows } from '../lib/leaveOptimizer.js';
import { buildGoogleFlightsUrl } from '../lib/flights.js';
import { CompassIcon, CloseIcon } from './icons.jsx';

const NUDGE_THRESHOLD_DAYS = 90;

/**
 * Nudge mechanism: if it's been > 90 days since the last trip ended, surface an
 * interactive banner. Tapping asks for a duration, runs the leave optimizer and
 * deep-links into Google Flights with the best optimized window pre-filled.
 */
export default function NudgeBanner() {
  const { trips, holidays, settings } = useApp();
  const [dismissed, setDismissed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [dest, setDest] = useState('');
  const [duration, setDuration] = useState(7);
  const [result, setResult] = useState(null);

  const gap = daysSinceLastTrip(trips);
  const show = !dismissed && gap !== null && gap > NUDGE_THRESHOLD_DAYS;
  if (!show) return null;

  const runOptimizer = () => {
    const windows = findOptimalWindows({ tripLength: Number(duration), holidays, maxResults: 1 });
    const best = windows[0];
    if (!best) return;
    const url = buildGoogleFlightsUrl({
      origin: settings.HOME_LOCATION,
      destination: dest || 'Anywhere',
      departDate: best.startDate,
      returnDate: best.endDate,
    });
    setResult({ best, url });
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -16, height: 0 }}
        animate={{ opacity: 1, y: 0, height: 'auto' }}
        exit={{ opacity: 0, y: -16, height: 0 }}
        className="glass-strong relative overflow-hidden rounded-4xl border border-accent/30 p-4 shadow-glow"
      >
        <button onClick={() => setDismissed(true)} className="absolute right-3 top-3 text-ink-soft" aria-label="Dismiss">
          <CloseIcon className="h-4 w-4" />
        </button>

        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-3xl bg-accent/20 text-accent">
            <CompassIcon className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <h3 className="font-display text-base font-bold text-ink">Time to explore ✈️</h3>
            <p className="text-sm text-ink-soft">
              It's been over 3 months ({gap} days) since your last adventure. Choose an unvisited destination and let's
              optimize your leaves.
            </p>

            {!expanded ? (
              <button
                onClick={() => setExpanded(true)}
                className="mt-3 rounded-3xl bg-accent/90 px-4 py-2 text-sm font-semibold text-black shadow-glow active:scale-95"
              >
                Plan an escape
              </button>
            ) : (
              <div className="mt-3 space-y-3">
                <div className="flex gap-2">
                  <input
                    value={dest}
                    onChange={(e) => setDest(e.target.value)}
                    placeholder="Destination (e.g. Ladakh)"
                    className="min-w-0 flex-1 rounded-3xl bg-white/10 px-3 py-2 text-sm text-ink placeholder:text-ink-soft/60 outline-none focus:ring-2 focus:ring-accent"
                  />
                  <input
                    type="number"
                    min="1"
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    className="w-20 rounded-3xl bg-white/10 px-3 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-accent"
                    aria-label="Duration in days"
                  />
                </div>
                <button onClick={runOptimizer} className="w-full rounded-3xl bg-accent/90 py-2 text-sm font-semibold text-black shadow-glow active:scale-95">
                  Optimize {duration}-day trip
                </button>

                {result && (
                  <div className="rounded-3xl bg-white/5 p-3 text-sm">
                    <p className="text-ink">
                      Best window: <b className="text-accent">{result.best.startDate}</b> →{' '}
                      <b className="text-accent">{result.best.endDate}</b>
                    </p>
                    <p className="text-ink-soft">
                      Only <b className="text-accent-2">{result.best.requiredLeaves}</b> company leaves for{' '}
                      <b>{result.best.length}</b> days off.
                    </p>
                    <a
                      href={result.url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-block rounded-3xl bg-accent-2/20 px-4 py-2 font-semibold text-ink"
                    >
                      Open in Google Flights ↗
                    </a>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
