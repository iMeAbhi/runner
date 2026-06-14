import { motion } from 'framer-motion';
import { CalendarIcon, ChartIcon, HomeIcon, SettingsIcon } from './icons.jsx';

const TABS = [
  { id: 'timeline', label: 'Timeline', Icon: HomeIcon },
  { id: 'planner', label: 'Planner', Icon: CalendarIcon },
  { id: 'insights', label: 'Insights', Icon: ChartIcon },
  { id: 'settings', label: 'Settings', Icon: SettingsIcon },
];

/** Sticky glassmorphic bottom navigation with a sliding accent pill. */
export default function BottomNav({ active, onChange }) {
  return (
    <nav className="pb-safe fixed inset-x-0 bottom-0 z-40 flex justify-center px-4">
      <div className="glass-strong mx-auto flex w-full max-w-md items-center justify-between rounded-4xl px-2 py-2 shadow-glass">
        {TABS.map(({ id, label, Icon }) => {
          const isActive = active === id;
          return (
            <button
              key={id}
              onClick={() => onChange(id)}
              className="relative flex flex-1 flex-col items-center gap-0.5 rounded-3xl px-2 py-2 outline-none"
              aria-label={label}
              aria-current={isActive ? 'page' : undefined}
            >
              {isActive && (
                <motion.span
                  layoutId="nav-pill"
                  transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                  className="absolute inset-0 rounded-3xl bg-accent/20 shadow-glow"
                />
              )}
              <Icon
                className={`relative z-10 h-6 w-6 transition-colors ${
                  isActive ? 'text-accent' : 'text-ink-soft'
                }`}
              />
              <span
                className={`relative z-10 text-[10px] font-medium transition-colors ${
                  isActive ? 'text-ink' : 'text-ink-soft'
                }`}
              >
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
