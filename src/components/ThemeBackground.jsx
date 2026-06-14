import { useApp } from '../context/AppContext.jsx';
import { themeAnimatesBackdrop } from '../lib/theme.js';

/**
 * Fixed full-bleed backdrop layer. Reads the active theme to decide whether the
 * gradient should slowly drift (Sky Dynamic / Material Mood). The gradient
 * itself is driven entirely by CSS variables set in theme.js.
 */
export default function ThemeBackground() {
  const { settings } = useApp();
  const animate = themeAnimatesBackdrop(settings.theme);
  return (
    <>
      <div className="app-backdrop" data-animate={animate} aria-hidden="true" />
      {/* Soft floating accent orbs for liquid depth (decorative). */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
        <div className="animate-float-slow absolute -left-24 top-10 h-72 w-72 rounded-full bg-accent/20 blur-3xl" />
        <div className="animate-float-slow absolute -right-20 top-1/3 h-80 w-80 rounded-full bg-accent-2/15 blur-3xl [animation-delay:2s]" />
      </div>
    </>
  );
}
