import { motion } from 'framer-motion';

/**
 * Animated circular progress wheel (used for India coverage %).
 */
export default function ProgressWheel({ percent = 0, size = 140, stroke = 12, label, sub }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (percent / 100) * c;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgb(var(--ink) / 0.10)"
          strokeWidth={stroke}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgb(var(--accent))"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.1, ease: 'easeOut' }}
          style={{ filter: 'drop-shadow(0 0 8px rgb(var(--accent) / 0.6))' }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="font-display text-3xl font-bold text-ink">{percent}%</span>
        {label && <span className="text-xs font-medium text-ink-soft">{label}</span>}
        {sub && <span className="text-[10px] text-ink-soft/70">{sub}</span>}
      </div>
    </div>
  );
}
