import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// Custom liquid-glass autocomplete, replacing the native <datalist>. Filters the
// city dictionary, animates open/close with a fade-and-scale, and is keyboard +
// pointer friendly. The dropdown surface tints from the theme canvas so it reads
// dark on dark themes and light on the Light theme automatically.
export default function CityCombobox({
  label,
  value,
  onChange,
  placeholder,
  options,
  className = '',
  max = 8,
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const wrapRef = useRef(null);

  const q = (value || '').trim().toLowerCase();
  const matches = useMemo(() => {
    if (!q) return options.slice(0, max);
    const starts = [];
    const includes = [];
    for (const o of options) {
      const lo = o.toLowerCase();
      if (lo.startsWith(q)) starts.push(o);
      else if (lo.includes(q)) includes.push(o);
    }
    return [...starts, ...includes].slice(0, max);
  }, [q, options, max]);

  // Close when clicking/tapping outside.
  useEffect(() => {
    const onDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
    };
  }, []);

  const pick = (name) => {
    onChange(name);
    setOpen(false);
  };

  return (
    <label ref={wrapRef} className={`relative flex flex-col gap-1 text-xs font-semibold text-ink-dim ${className}`}>
      {label}
      <input
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setOpen(true);
            setActive((a) => Math.min(a + 1, matches.length - 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === 'Enter' && open && matches[active]) {
            e.preventDefault();
            pick(matches[active]);
          } else if (e.key === 'Escape') {
            setOpen(false);
          }
        }}
        className="glass rounded-3xl px-3 py-2.5 text-sm font-medium text-ink outline-none transition-all placeholder:text-ink-dim/60 focus:shadow-glow"
      />

      <AnimatePresence>
        {open && matches.length > 0 && (
          <motion.ul
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }}
            style={{ transformOrigin: 'top center' }}
            className="dropdown-surface no-scrollbar absolute left-0 right-0 top-full z-50 mt-1 max-h-60 overflow-auto rounded-2xl p-1"
          >
            {matches.map((o, i) => (
              <li key={o}>
                <button
                  type="button"
                  // mousedown (not click) so it fires before the input blur closes us.
                  onMouseDown={(e) => {
                    e.preventDefault();
                    pick(o);
                  }}
                  onMouseEnter={() => setActive(i)}
                  className="w-full rounded-xl px-3 py-2 text-left text-sm font-medium text-ink transition-colors"
                  style={i === active ? { background: 'rgb(var(--accent) / 0.22)' } : undefined}
                >
                  {o}
                </button>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </label>
  );
}
