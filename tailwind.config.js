/** @type {import('tailwindcss').Config} */

// "Liquid Material" design system.
//
// Colors are driven by CSS custom properties (defined in src/index.css and
// swapped at runtime by the theme engine in AppContext) so a single set of
// utility classes serves all four theme profiles: AMOLED, Light, Mood, Sky.
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // rgb(var(--x) / <alpha>) lets us tune opacity per-utility while the
        // hue is theme-controlled.
        accent: 'rgb(var(--accent) / <alpha-value>)',
        'accent-2': 'rgb(var(--accent-2) / <alpha-value>)',
        canvas: 'rgb(var(--canvas) / <alpha-value>)',
        ink: 'rgb(var(--ink) / <alpha-value>)',
        'ink-dim': 'rgb(var(--ink-dim) / <alpha-value>)',
      },
      borderRadius: {
        // Spec: strict boxy-curved grid, 20–24px radii.
        '3xl': '20px',
        '4xl': '24px',
      },
      backdropBlur: {
        xl: '24px',
        '2xl': '40px',
      },
      boxShadow: {
        // Polished liquid-glass blocks: soft outer lift + inner sheen.
        glass:
          '0 8px 32px -8px rgba(0,0,0,0.45), inset 0 1px 0 0 rgba(255,255,255,0.12)',
        'glass-lg':
          '0 24px 64px -16px rgba(0,0,0,0.6), inset 0 1px 0 0 rgba(255,255,255,0.15)',
        glow: '0 0 24px -2px rgb(var(--accent) / 0.55)',
      },
      keyframes: {
        'fluid-shift': {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
      },
      animation: {
        'fluid-shift': 'fluid-shift 18s ease infinite',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
