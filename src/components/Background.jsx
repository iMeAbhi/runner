import { motion } from 'framer-motion';

// Ambient fluid-gradient backdrop. The actual colors come from --bg-image
// (theme + time-of-day driven in index.css); we layer two slowly drifting
// accent blooms on top for organic "liquid" motion.
export default function Background() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden" style={{ backgroundImage: 'var(--bg-image)', backgroundSize: '200% 200%' }}>
      <div className="absolute inset-0 animate-fluid-shift" style={{ backgroundImage: 'var(--bg-image)', backgroundSize: '200% 200%', opacity: 0.9 }} />
      <motion.div
        className="absolute -top-32 -left-24 h-96 w-96 rounded-full blur-3xl"
        style={{ background: 'rgb(var(--accent) / 0.35)' }}
        animate={{ x: [0, 40, -20, 0], y: [0, 30, 60, 0] }}
        transition={{ duration: 26, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute bottom-0 right-0 h-[28rem] w-[28rem] rounded-full blur-3xl"
        style={{ background: 'rgb(var(--accent-2) / 0.28)' }}
        animate={{ x: [0, -30, 20, 0], y: [0, -40, -10, 0] }}
        transition={{ duration: 32, repeat: Infinity, ease: 'easeInOut' }}
      />
    </div>
  );
}
