/** @type {import('tailwindcss').Config} */

// "Liquid Material" design system — Material You dynamic color + Liquid Glass depth.
// Theme palettes are driven at runtime through CSS variables (see src/index.css and
// src/lib/theme.js); Tailwind only maps the utility surface so JSX stays declarative.
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Bridge to runtime CSS variables so a single <html data-theme> swap
        // re-skins the entire app without re-rendering React.
        accent: 'rgb(var(--accent) / <alpha-value>)',
        'accent-2': 'rgb(var(--accent-2) / <alpha-value>)',
        canvas: 'rgb(var(--canvas) / <alpha-value>)',
        ink: 'rgb(var(--ink) / <alpha-value>)',
        'ink-soft': 'rgb(var(--ink-soft) / <alpha-value>)',
      },
      borderRadius: {
        // Boxy-curved grid: 20px–24px corner language.
        '3xl': '1.25rem', // 20px
        '4xl': '1.5rem', // 24px
        '5xl': '2rem',
      },
      backdropBlur: {
        xl: '24px',
        '2xl': '40px',
      },
      boxShadow: {
        // Polished liquid-glass blocks: soft outer lift + inner sheen.
        glass: '0 8px 32px 0 rgba(0,0,0,0.37), inset 0 1px 0 0 rgba(255,255,255,0.10)',
        'glass-sm': '0 4px 18px 0 rgba(0,0,0,0.30), inset 0 1px 0 0 rgba(255,255,255,0.08)',
        glow: '0 0 24px 0 rgb(var(--accent) / 0.45)',
        'glow-lg': '0 0 48px 4px rgb(var(--accent) / 0.40)',
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'Inter', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      keyframes: {
        'sky-drift': {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        'float-slow': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
      },
      animation: {
        'sky-drift': 'sky-drift 18s ease-in-out infinite',
        'float-slow': 'float-slow 6s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
