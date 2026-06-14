// Clean geometric vector icons. `currentColor` driven so they inherit theme ink.

const base = {
  width: 24,
  height: 24,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

export const FlightIcon = (p) => (
  <svg {...base} {...p}><path d="M10.5 13.5 4 15l-.5-2 5-3-1-6 2-1 2.5 6 5.5-3.5a1.5 1.5 0 0 1 1.5 2.6L15 11l1 7-2 1-3-5.5Z" /></svg>
);
export const TrainIcon = (p) => (
  <svg {...base} {...p}><rect x="5" y="3" width="14" height="13" rx="3" /><path d="M5 10h14M9 16l-2 4m8-4 2 4M9.5 7h5" /><circle cx="8.5" cy="13" r=".6" fill="currentColor" /><circle cx="15.5" cy="13" r=".6" fill="currentColor" /></svg>
);
export const CabIcon = (p) => (
  <svg {...base} {...p}><path d="M5 16v3M19 16v3M3 13l1.5-5A2 2 0 0 1 6.4 6.5h11.2A2 2 0 0 1 19.5 8L21 13M3 13h18v3a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-3Z" /><circle cx="7" cy="14.5" r="1" /><circle cx="17" cy="14.5" r="1" /></svg>
);
export const WalkIcon = (p) => (
  <svg {...base} {...p}><circle cx="13" cy="4.5" r="1.6" /><path d="M13 8l-3 2 1 4-2 5m4-9 3 2 2-1m-5-1v4l2 5" /></svg>
);
export const BusIcon = (p) => (
  <svg {...base} {...p}><rect x="4" y="4" width="16" height="13" rx="3" /><path d="M4 11h16M7 17v2m10-2v2M8 4v7m8-7v7" /><circle cx="8" cy="14" r=".6" fill="currentColor" /><circle cx="16" cy="14" r=".6" fill="currentColor" /></svg>
);
export const HotelIcon = (p) => (
  <svg {...base} {...p}><path d="M3 20V6M3 12h14a4 4 0 0 1 4 4v4M3 16h18M7 9h3" /></svg>
);

export const HomeIcon = (p) => (
  <svg {...base} {...p}><path d="M4 11 12 4l8 7M6 10v9a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-9" /></svg>
);
export const CalendarIcon = (p) => (
  <svg {...base} {...p}><rect x="4" y="5" width="16" height="16" rx="3" /><path d="M8 3v4m8-4v4M4 10h16" /></svg>
);
export const ChartIcon = (p) => (
  <svg {...base} {...p}><path d="M5 19V5M5 19h14M9 16v-5m4 5V9m4 7v-3" /></svg>
);
export const SettingsIcon = (p) => (
  <svg {...base} {...p}><circle cx="12" cy="12" r="3" /><path d="M19.4 13a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.2A1.6 1.6 0 0 0 7 19.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0-1-2.7H3a2 2 0 1 1 0-4h.2A1.6 1.6 0 0 0 4.7 7l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 10 4.6V4a2 2 0 1 1 4 0v.2a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1 2.7H21a2 2 0 1 1 0 4h-.2a1.6 1.6 0 0 0-1.4 1Z" /></svg>
);
export const PlusIcon = (p) => (
  <svg {...base} {...p}><path d="M12 5v14M5 12h14" /></svg>
);
export const CloseIcon = (p) => (
  <svg {...base} {...p}><path d="M6 6l12 12M18 6 6 18" /></svg>
);
export const SparkIcon = (p) => (
  <svg {...base} {...p}><path d="M12 3v4m0 10v4M3 12h4m10 0h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" /></svg>
);
export const CompassIcon = (p) => (
  <svg {...base} {...p}><circle cx="12" cy="12" r="9" /><path d="m15 9-2 4-4 2 2-4 4-2Z" /></svg>
);

/** Map a free-text transit type to its icon component. */
export function transitIcon(type) {
  const k = (type || '').toLowerCase();
  if (k.includes('flight') || k.includes('air') || k.includes('plane')) return FlightIcon;
  if (k.includes('train') || k.includes('rail')) return TrainIcon;
  if (k.includes('bus')) return BusIcon;
  if (k.includes('cab') || k.includes('car') || k.includes('taxi')) return CabIcon;
  if (k.includes('walk')) return WalkIcon;
  return CompassIcon;
}
