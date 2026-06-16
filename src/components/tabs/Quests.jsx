import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '../../context/AppContext.jsx';
import { QUESTS } from '../../data/quests.js';
import { coordsForPlace } from '../../data/geo.js';
import { layoverList, layoverCountsAsVisit } from '../../utils/insights.js';
import IndiaMap from '../IndiaMap.jsx';

export default function Quests() {
  const { trips, settings } = useApp();
  const [activeId, setActiveId] = useState(QUESTS[0].id);
  const quest = QUESTS.find((q) => q.id === activeId) || QUESTS[0];

  const result = useMemo(() => quest.compute(trips, settings), [quest, trips, settings]);

  // Origin for the transit vectors: prefer home town, fall back to current base.
  const origin = useMemo(() => {
    const home = coordsForPlace(settings.homeLocation);
    if (home) return { ...home, label: settings.homeLocation };
    const cur = coordsForPlace(settings.currentLocation);
    if (cur) return { ...cur, label: settings.currentLocation };
    return null;
  }, [settings.homeLocation, settings.currentLocation]);

  // Trip routes (Origin → layovers → Destination) for the India transit map.
  const routes = useMemo(() => {
    if (quest.id !== 'india') return [];
    return trips
      .map((t) => {
        const stops = [];
        const o = coordsForPlace(t.Origin_City);
        if (o) stops.push({ ...o, kind: 'origin' });
        const counted = layoverCountsAsVisit(t);
        for (const lay of layoverList(t)) {
          const c = coordsForPlace(lay);
          if (c) stops.push({ ...c, kind: 'layover', counted, label: lay });
        }
        const d = coordsForPlace(t.City);
        if (d) stops.push({ ...d, kind: 'dest', label: t.City });
        return stops.length >= 2 ? { stops } : null;
      })
      .filter(Boolean);
  }, [quest.id, trips]);

  const visited = result.items.filter((i) => i.done);
  const remaining = result.items.filter((i) => !i.done);
  const auraCore = quest.aura === 'gold' ? '#f5c451' : 'rgb(var(--accent))';

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-3xl font-black">Quests</h1>
        <p className="text-sm text-ink-dim">Travel missions, mapped and checked off.</p>
      </header>

      {/* Sticky sub-navigation — morph between quests */}
      <div className="sticky top-0 z-20 -mx-4 bg-canvas/60 px-4 py-2 backdrop-blur-xl">
        <div className="no-scrollbar flex gap-2 overflow-x-auto">
          {QUESTS.map((q) => {
            const on = q.id === activeId;
            return (
              <button
                key={q.id}
                onClick={() => setActiveId(q.id)}
                className="pill glass relative shrink-0"
                style={on ? { color: 'rgb(var(--ink))' } : { color: 'rgb(var(--ink-dim))' }}
              >
                {on && (
                  <motion.span
                    layoutId="quest-pill"
                    className="absolute inset-0 rounded-full"
                    style={{ background: 'rgb(var(--accent) / 0.26)', boxShadow: '0 0 16px -4px rgb(var(--accent) / 0.7)' }}
                    transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                  />
                )}
                <span className="relative z-10">{q.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={quest.id}
          initial={{ opacity: 0, y: 14, filter: 'blur(6px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          exit={{ opacity: 0, y: -14, filter: 'blur(6px)' }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="space-y-5"
        >
          {/* Progress wheel + headline */}
          <div className="glass rounded-4xl p-4">
            <div className="flex items-center gap-4">
              <ProgressRing pct={result.pct} aura={quest.aura} />
              <div>
                <p className="text-sm font-bold text-ink">{quest.label}</p>
                <p className="text-xs text-ink-dim">{quest.blurb}</p>
                <p className="mt-1 text-xs font-semibold" style={{ color: auraCore }}>
                  {result.summary}
                </p>
              </div>
            </div>

            {/* Interactive transit map */}
            <div className="mt-3 rounded-3xl bg-black/10 p-2">
              <IndiaMap nodes={result.items} routes={routes} origin={origin} aura={quest.aura} showAll={quest.showAllNodes} />
            </div>
          </div>

          {/* Checklist — visited */}
          {visited.length > 0 && (
            <section>
              <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-dim">
                Visited · {visited.length}
              </h2>
              <div className="grid grid-cols-2 gap-2">
                {visited.map((item) => (
                  <QuestCard key={item.id} item={item} aura={quest.aura} done />
                ))}
              </div>
            </section>
          )}

          {/* Checklist — still to explore */}
          {remaining.length > 0 && (
            <section>
              <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-dim">
                Still to explore · {remaining.length}
              </h2>
              <div className="flex flex-wrap gap-1.5">
                {remaining.map((item) => (
                  <span
                    key={item.id}
                    className="rounded-full bg-white/5 px-2.5 py-1 text-[11px] text-ink-dim"
                  >
                    {item.name}
                  </span>
                ))}
              </div>
            </section>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function QuestCard({ item, aura, done }) {
  const glow = aura === 'gold' ? '0 0 18px -6px rgba(245,196,81,0.8)' : '0 0 18px -6px rgb(var(--accent) / 0.8)';
  const ring = aura === 'gold' ? '#f5c451' : 'rgb(var(--accent))';
  return (
    <div
      className="glass flex flex-col gap-0.5 rounded-3xl p-3"
      style={done ? { boxShadow: glow, border: `1px solid ${aura === 'gold' ? 'rgba(245,196,81,0.4)' : 'rgb(var(--accent) / 0.4)'}` } : undefined}
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-ink">{item.name}</p>
        {done && (
          <span
            className="flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-black text-black"
            style={{ background: ring }}
          >
            ✓
          </span>
        )}
      </div>
      {item.subtitle && <p className="text-[11px] text-ink-dim">{item.subtitle}</p>}
    </div>
  );
}

function ProgressRing({ pct, aura }) {
  const r = 30;
  const c = 2 * Math.PI * r;
  const gold = aura === 'gold';
  return (
    <svg width="84" height="84" viewBox="0 0 84 84" className="shrink-0">
      <defs>
        <linearGradient id={`ring-${aura}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={gold ? '#f5c451' : 'rgb(var(--accent))'} />
          <stop offset="1" stopColor={gold ? '#ffe9a8' : 'rgb(var(--accent-2))'} />
        </linearGradient>
      </defs>
      <circle cx="42" cy="42" r={r} fill="none" stroke="rgb(var(--ink-dim) / 0.22)" strokeWidth="8" />
      <motion.circle
        cx="42"
        cy="42"
        r={r}
        fill="none"
        stroke={`url(#ring-${aura})`}
        strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray={c}
        initial={{ strokeDashoffset: c }}
        animate={{ strokeDashoffset: c - (c * Math.min(pct, 100)) / 100 }}
        transition={{ duration: 0.9, ease: 'easeOut' }}
        transform="rotate(-90 42 42)"
      />
      <text x="42" y="47" textAnchor="middle" className="fill-ink text-[16px] font-black">
        {pct}%
      </text>
    </svg>
  );
}
