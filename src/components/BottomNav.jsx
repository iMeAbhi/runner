import { motion } from 'framer-motion';
import { HomeIcon, CalendarIcon, QuestIcon, ChartIcon, GearIcon } from './Icons.jsx';

const TABS = [
  { id: 'timeline', label: 'Timeline', Icon: HomeIcon },
  { id: 'planner', label: 'Planner', Icon: CalendarIcon },
  { id: 'quests', label: 'Quests', Icon: QuestIcon },
  { id: 'insights', label: 'Insights', Icon: ChartIcon },
  { id: 'settings', label: 'Settings', Icon: GearIcon },
];

export default function BottomNav({ active, onChange }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex justify-center pb-[max(env(safe-area-inset-bottom),0.75rem)] px-4">
      <div className="glass-strong flex w-full max-w-md items-center justify-around rounded-4xl px-2 py-2">
        {TABS.map(({ id, label, Icon }) => {
          const isActive = active === id;
          return (
            <button
              key={id}
              onClick={() => onChange(id)}
              className="relative flex flex-1 flex-col items-center gap-1 rounded-3xl py-2 text-[11px] font-semibold"
              aria-current={isActive}
            >
              {isActive && (
                <motion.span
                  layoutId="nav-pill"
                  className="absolute inset-0 rounded-3xl"
                  style={{ background: 'rgb(var(--accent) / 0.18)', boxShadow: '0 0 18px -4px rgb(var(--accent) / 0.6)' }}
                  transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                />
              )}
              <Icon
                className="relative z-10"
                width={22}
                height={22}
                style={{ color: isActive ? 'rgb(var(--accent))' : 'rgb(var(--ink-dim))' }}
              />
              <span
                className="relative z-10"
                style={{ color: isActive ? 'rgb(var(--ink))' : 'rgb(var(--ink-dim))' }}
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
