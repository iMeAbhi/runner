import { motion, AnimatePresence } from 'framer-motion';
import Portal from './Portal.jsx';
import { CloseIcon } from './Icons.jsx';

// Reusable liquid-glass Top-5 leaderboard. Portal'd to body so it escapes the
// page-transition transform. `items` = [{ name, value, sub? }].
export default function LeaderboardModal({ isOpen, onClose, title, items = [] }) {
  return (
    <Portal>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
            <motion.div
              initial={{ y: 60, opacity: 0, scale: 0.97 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 60, opacity: 0, scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 320, damping: 32 }}
              className="relative z-10 w-full max-w-md rounded-t-4xl border border-white/15 bg-black/40 p-5 backdrop-blur-xl sm:rounded-4xl"
            >
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-extrabold text-ink">{title}</h2>
                <button type="button" onClick={onClose} className="glass rounded-full p-2">
                  <CloseIcon width={18} height={18} />
                </button>
              </div>

              {items.length === 0 ? (
                <p className="py-6 text-center text-sm text-ink-dim">Nothing to rank yet — log a few trips.</p>
              ) : (
                <ol className="space-y-2">
                  {items.map((it, i) => (
                    <motion.li
                      key={`${it.name}-${i}`}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="flex items-center gap-3 rounded-3xl border border-white/10 bg-white/[0.06] px-3 py-2.5"
                    >
                      <span
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-black"
                        style={
                          i === 0
                            ? { background: 'rgb(var(--accent))', color: '#000' }
                            : { background: 'rgb(var(--ink) / 0.12)', color: 'rgb(var(--ink))' }
                        }
                      >
                        {i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-ink">{it.name}</p>
                        {it.sub && <p className="truncate text-[11px] text-ink-dim">{it.sub}</p>}
                      </div>
                      <span className="shrink-0 text-sm font-semibold text-accent">{it.value}</span>
                    </motion.li>
                  ))}
                </ol>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </Portal>
  );
}
