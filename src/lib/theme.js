// Theme engine helpers for the "Liquid Material" design system.
// Handles the 4 layout themes, Material Mood accent palettes, and the
// time-of-day "Contextual Sky Dynamic" gradient.

export const THEMES = [
  { id: 'amoled', label: 'AMOLED Dark', hint: 'Pitch black + neon glow' },
  { id: 'light', label: 'Clean Light', hint: 'Frosted milk glass' },
  { id: 'mood', label: 'Material Mood', hint: 'Accent-driven palette' },
  { id: 'sky', label: 'Sky Dynamic', hint: 'Time-of-day gradient' },
];

// Material Mood accent presets. Each maps to RGB triplets used by CSS vars.
export const MOOD_ACCENTS = [
  { id: 'aviation', label: 'Aviation Blue', accent: '99 179 237', accent2: '56 232 196', g1: '#0b2a4a', g2: '#0a1626' },
  { id: 'nomad', label: 'Earthy Nomad Green', accent: '120 200 140', accent2: '210 190 120', g1: '#16301f', g2: '#0c1a12' },
  { id: 'sunset', label: 'Sunset Orange', accent: '255 150 90', accent2: '255 90 120', g1: '#3a1810', g2: '#1c0c0c' },
  { id: 'violet', label: 'Cosmic Violet', accent: '170 130 255', accent2: '90 160 255', g1: '#241640', g2: '#120a24' },
];

// Phase definitions for the Sky Dynamic theme (local clock driven).
export const SKY_PHASES = [
  {
    id: 'morning',
    label: 'Morning',
    range: [6, 11],
    accent: '255 190 120',
    accent2: '255 150 110',
    gradient: 'linear-gradient(160deg, #ffd9a0 0%, #ffb98a 40%, #f7c6d9 100%)',
  },
  {
    id: 'afternoon',
    label: 'Afternoon',
    range: [11, 17],
    accent: '90 190 255',
    accent2: '56 232 196',
    gradient: 'linear-gradient(160deg, #7ec8ff 0%, #43c6e6 50%, #aef0e6 100%)',
  },
  {
    id: 'evening',
    label: 'Evening',
    range: [17, 19],
    accent: '255 140 90',
    accent2: '150 110 255',
    gradient: 'linear-gradient(160deg, #4b2a6b 0%, #b5462f 55%, #ff8a3d 100%)',
  },
  {
    id: 'night',
    label: 'Night',
    range: [19, 6],
    accent: '130 150 255',
    accent2: '90 200 230',
    gradient: 'radial-gradient(130% 120% at 70% 10%, #1a1f3a 0%, #06060f 60%, #000008 100%)',
  },
];

/** Return the active sky phase for a given hour (0-23). */
export function getSkyPhase(hour = new Date().getHours()) {
  for (const phase of SKY_PHASES) {
    const [start, end] = phase.range;
    if (start < end) {
      if (hour >= start && hour < end) return phase;
    } else {
      // wraps midnight (night phase)
      if (hour >= start || hour < end) return phase;
    }
  }
  return SKY_PHASES[3];
}

/**
 * Apply a theme to <html>. Mutates CSS variables directly so re-skinning is
 * instant and does not trigger a React re-render.
 *
 * @param {string} themeId   one of THEMES ids
 * @param {string} moodId    accent preset id (for the "mood" theme)
 */
export function applyTheme(themeId, moodId = 'aviation') {
  const root = document.documentElement;
  root.setAttribute('data-theme', themeId);

  if (themeId === 'mood') {
    const m = MOOD_ACCENTS.find((x) => x.id === moodId) || MOOD_ACCENTS[0];
    root.style.setProperty('--accent', m.accent);
    root.style.setProperty('--accent-2', m.accent2);
    root.style.setProperty(
      '--backdrop',
      `radial-gradient(130% 120% at 50% -10%, ${m.g1} 0%, ${m.g2} 60%, #000 100%)`,
    );
  } else if (themeId === 'sky') {
    const phase = getSkyPhase();
    root.style.setProperty('--accent', phase.accent);
    root.style.setProperty('--accent-2', phase.accent2);
    root.style.setProperty('--backdrop', phase.gradient);
  } else {
    // amoled / light reset to their stylesheet defaults; pick a clean accent.
    root.style.setProperty('--accent', themeId === 'light' ? '37 99 235' : '99 179 237');
    root.style.setProperty('--accent-2', themeId === 'light' ? '13 148 136' : '56 232 196');
    root.style.removeProperty('--backdrop');
  }

  // Keep the browser chrome colour in sync.
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', themeId === 'light' ? '#f7f4ef' : '#000000');
}

/** Whether the active theme uses the animated drifting backdrop. */
export function themeAnimatesBackdrop(themeId) {
  return themeId === 'sky' || themeId === 'mood';
}
