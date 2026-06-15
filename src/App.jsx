import { useState } from 'react';
import { AnimatePresence, motion, LayoutGroup } from 'framer-motion';
import { useApp } from './context/AppContext.jsx';
import Background from './components/Background.jsx';
import BottomNav from './components/BottomNav.jsx';
import TimelineFeed from './components/tabs/TimelineFeed.jsx';
import Planner from './components/tabs/Planner.jsx';
import Analytics from './components/tabs/Analytics.jsx';
import Settings from './components/tabs/Settings.jsx';

const TABS = {
  timeline: TimelineFeed,
  planner: Planner,
  insights: Analytics,
  settings: Settings,
};

// Liquid slide-and-fade between tabs.
const pageVariants = {
  initial: { opacity: 0, y: 18, filter: 'blur(8px)' },
  enter: { opacity: 1, y: 0, filter: 'blur(0px)' },
  exit: { opacity: 0, y: -18, filter: 'blur(8px)' },
};

export default function App() {
  const { ready, online, syncing, uploads, toast } = useApp();
  const [tab, setTab] = useState('timeline');
  const Active = TABS[tab];

  if (!ready) {
    return (
      <div className="flex h-full items-center justify-center">
        <Background />
        <div className="glass rounded-4xl px-6 py-4 text-sm text-ink-dim">Loading…</div>
      </div>
    );
  }

  return (
    <LayoutGroup>
      <Background />

      {/* Status strip: offline / sync / upload progress */}
      <StatusStrip online={online} syncing={syncing} uploads={uploads} />

      <main className="mx-auto min-h-full max-w-md px-4 pb-32 pt-[max(env(safe-area-inset-top),1rem)]">
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            variants={pageVariants}
            initial="initial"
            animate="enter"
            exit="exit"
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
          >
            <Active />
          </motion.div>
        </AnimatePresence>
      </main>

      <BottomNav active={tab} onChange={setTab} />

      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.95 }}
            className="fixed inset-x-0 bottom-28 z-50 mx-auto w-fit max-w-[90%]"
          >
            <div
              className="glass-strong rounded-3xl px-5 py-3 text-sm font-medium"
              style={{
                color:
                  toast.kind === 'error'
                    ? '#ff8a8a'
                    : toast.kind === 'ok'
                    ? 'rgb(var(--accent-2))'
                    : 'rgb(var(--ink))',
              }}
            >
              {toast.msg}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </LayoutGroup>
  );
}

function StatusStrip({ online, syncing, uploads }) {
  const show = !online || syncing || uploads.active;
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: -40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -40, opacity: 0 }}
          className="fixed inset-x-0 top-0 z-50 flex justify-center pt-[max(env(safe-area-inset-top),0.5rem)]"
        >
          <div className="glass mt-2 rounded-full px-4 py-1.5 text-xs font-semibold text-ink">
            {!online
              ? 'Offline — changes saved locally'
              : uploads.active
              ? `Uploading photos ${uploads.done}/${uploads.total}…`
              : 'Syncing…'}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
