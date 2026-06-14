import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useApp } from './context/AppContext.jsx';
import ThemeBackground from './components/ThemeBackground.jsx';
import BottomNav from './components/BottomNav.jsx';
import Timeline from './tabs/Timeline.jsx';
import Planner from './tabs/Planner.jsx';
import Insights from './tabs/Insights.jsx';
import Settings from './tabs/Settings.jsx';

const TABS = {
  timeline: Timeline,
  planner: Planner,
  insights: Insights,
  settings: Settings,
};

// Liquid slide-and-fade between tabs.
const variants = {
  enter: { opacity: 0, y: 18, filter: 'blur(6px)' },
  center: { opacity: 1, y: 0, filter: 'blur(0px)' },
  exit: { opacity: 0, y: -18, filter: 'blur(6px)' },
};

export default function App() {
  const [tab, setTab] = useState('timeline');
  const { sync, settings } = useApp();
  const Active = TABS[tab];

  const needsSetup = !settings.APPS_SCRIPT_URL || !settings.SECURE_TOKEN;

  return (
    <div className="relative min-h-screen">
      <ThemeBackground />

      {/* Offline / setup ribbon */}
      {sync.status === 'offline' && (
        <div className="pt-safe fixed inset-x-0 top-0 z-30 bg-amber-500/15 py-1 text-center text-[11px] font-medium text-amber-200 backdrop-blur">
          Offline — changes saved locally and will sync automatically.
        </div>
      )}

      <main className="pt-safe mx-auto min-h-screen w-full max-w-md px-4 pb-32 pt-6">
        {needsSetup && tab !== 'settings' && (
          <button
            onClick={() => setTab('settings')}
            className="glass mb-4 w-full rounded-4xl border border-accent/30 p-3 text-left text-sm text-ink shadow-glow"
          >
            👋 Finish setup — connect your Google Sheet backend in <b className="text-accent">Settings</b>.
          </button>
        )}

        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
          >
            <Active />
          </motion.div>
        </AnimatePresence>
      </main>

      <BottomNav active={tab} onChange={setTab} />
    </div>
  );
}
