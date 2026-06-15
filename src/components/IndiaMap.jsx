import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { projectPoint, INDIA_OUTLINE } from '../data/geo.js';

// Minimalist interactive transit map. Draws a stylised India silhouette, plots
// destination nodes, and radiates animated vectors from the user's origin
// (home / current location) to every visited node. Pure SVG + Framer Motion —
// no mapping libraries. Reused by every Quest.
//
// Props:
//   nodes  : [{ id, name, subtitle, lat, lng, done }]
//   origin : { lat, lng, label } | null
//   aura   : 'accent' | 'gold'  — visited-node glow palette
//   showAll: also render unvisited nodes as faint dots (default true)
const W = 300;
const H = 330;
const PAD = 16;

const AURAS = {
  accent: { core: 'rgb(var(--accent))', glow: 'rgb(var(--accent) / 0.55)', line: 'rgb(var(--accent-2))' },
  gold: { core: '#f5c451', glow: 'rgba(245,196,81,0.55)', line: '#ffe9a8' },
};

export default function IndiaMap({ nodes = [], origin = null, aura = 'accent', showAll = true }) {
  const palette = AURAS[aura] || AURAS.accent;
  const [selected, setSelected] = useState(null);

  // Project everything once into SVG space.
  const outlinePath = useMemo(() => {
    const pts = INDIA_OUTLINE.map(([lat, lng]) => projectPoint(lat, lng, { w: W, h: H, pad: PAD }));
    return pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ') + ' Z';
  }, []);

  const placed = useMemo(
    () =>
      nodes
        .filter((n) => n.lat != null && n.lng != null)
        .map((n) => ({ ...n, ...projectPoint(n.lat, n.lng, { w: W, h: H, pad: PAD }) })),
    [nodes]
  );

  const originPt = useMemo(
    () => (origin && origin.lat != null ? { ...origin, ...projectPoint(origin.lat, origin.lng, { w: W, h: H, pad: PAD }) } : null),
    [origin]
  );

  const visited = placed.filter((n) => n.done);

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Travel transit map of India">
        <defs>
          <linearGradient id="map-fill" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="rgb(var(--accent) / 0.10)" />
            <stop offset="1" stopColor="rgb(var(--accent) / 0.02)" />
          </linearGradient>
        </defs>

        {/* India silhouette — draws itself in on mount */}
        <motion.path
          d={outlinePath}
          fill="url(#map-fill)"
          stroke="rgb(var(--ink-dim) / 0.45)"
          strokeWidth="1"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 1.1, ease: 'easeInOut' }}
        />

        {/* Transit vectors: origin → each visited node */}
        {originPt &&
          visited.map((n, i) => (
            <motion.line
              key={`vec-${n.id}`}
              x1={originPt.x}
              y1={originPt.y}
              x2={n.x}
              y2={n.y}
              stroke={palette.line}
              strokeWidth="1"
              strokeLinecap="round"
              strokeOpacity="0.5"
              strokeDasharray="3 4"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 0.5 }}
              transition={{ duration: 0.7, delay: 0.5 + i * 0.05, ease: 'easeOut' }}
            />
          ))}

        {/* Unvisited nodes — faint dots for context */}
        {showAll &&
          placed
            .filter((n) => !n.done)
            .map((n) => (
              <circle
                key={`dot-${n.id}`}
                cx={n.x}
                cy={n.y}
                r={selected?.id === n.id ? 3.4 : 2.2}
                fill="rgb(var(--ink-dim) / 0.55)"
                className="cursor-pointer transition-all"
                onClick={() => setSelected(n)}
              >
                <title>{n.name}</title>
              </circle>
            ))}

        {/* Visited nodes — glowing neon markers with a pulsing halo */}
        {visited.map((n, i) => (
          <g key={`node-${n.id}`} className="cursor-pointer" onClick={() => setSelected(n)}>
            <title>{n.name}</title>
            <motion.circle
              cx={n.x}
              cy={n.y}
              r="9"
              fill={palette.glow}
              initial={{ scale: 0.4, opacity: 0 }}
              animate={{ scale: [0.9, 1.5, 0.9], opacity: [0.5, 0, 0.5] }}
              transition={{ duration: 2.4, repeat: Infinity, delay: i * 0.12, ease: 'easeInOut' }}
              style={{ transformOrigin: `${n.x}px ${n.y}px` }}
            />
            <motion.circle
              cx={n.x}
              cy={n.y}
              r={selected?.id === n.id ? 5 : 3.6}
              fill={palette.core}
              stroke="rgb(var(--canvas, 0 0 0))"
              strokeWidth="0.6"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.5 + i * 0.05, type: 'spring', stiffness: 320, damping: 18 }}
              style={{ filter: `drop-shadow(0 0 4px ${palette.glow})` }}
            />
          </g>
        ))}

        {/* Origin marker (home / current) */}
        {originPt && (
          <g className="cursor-pointer" onClick={() => setSelected({ id: '__origin', name: originPt.label })}>
            <title>{originPt.label}</title>
            <motion.circle
              cx={originPt.x}
              cy={originPt.y}
              r="5.5"
              fill="rgb(var(--ink))"
              stroke={palette.core}
              strokeWidth="1.6"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 16 }}
            />
          </g>
        )}
      </svg>

      {/* Interactive caption — updates as the user taps nodes */}
      <div className="mt-1 flex items-center justify-center gap-2 text-center text-xs">
        {selected ? (
          <span className="font-semibold text-ink">
            {selected.name}
            {selected.subtitle ? <span className="font-normal text-ink-dim"> · {selected.subtitle}</span> : null}
          </span>
        ) : (
          <span className="text-ink-dim">
            {originPt ? `Routes from ${originPt.label}` : 'Set a home / current location to map your routes'} · tap a node
          </span>
        )}
      </div>
    </div>
  );
}
