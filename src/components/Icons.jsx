// Clean geometric vector icons. `currentColor` so they inherit theme ink/accent.
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
  <svg {...base} {...p}>
    <path d="M10.2 9.5 3 11l2 2.5 3-.5 2.5 4 1.8-.6-1-4.4 4.2-1.2c1.2-.3 2-.9 2.3-1.8.3-.9-.2-1.6-1.2-1.4l-3.6.9-4.2-3.3-1.8.6 2.1 3.7Z" />
  </svg>
);
export const TrainIcon = (p) => (
  <svg {...base} {...p}>
    <rect x="6" y="3" width="12" height="13" rx="3" />
    <path d="M6 10h12M9 19l-2 2m8-2 2 2" />
    <circle cx="9" cy="13" r="1" />
    <circle cx="15" cy="13" r="1" />
  </svg>
);
export const CabIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M5 16v-3l1.8-4.2A2 2 0 0 1 8.6 7.5h6.8a2 2 0 0 1 1.8 1.3L19 13v3" />
    <path d="M4 16h16M6.5 16v2M17.5 16v2" />
    <circle cx="8" cy="13.5" r="1" />
    <circle cx="16" cy="13.5" r="1" />
  </svg>
);
export const WalkIcon = (p) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="4.5" r="1.6" />
    <path d="M12 7v5l-2 5m2-5 2 2 2 1m-6-3-2 1-1 3" />
  </svg>
);
export const HotelIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M4 19V7m0 8h16m0 4v-6a3 3 0 0 0-3-3H9v5" />
    <circle cx="6.5" cy="10.5" r="1.2" />
  </svg>
);
export const PinIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11Z" />
    <circle cx="12" cy="10" r="2.4" />
  </svg>
);
export const HomeIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M4 11 12 4l8 7M6 9.5V20h12V9.5" />
  </svg>
);
export const CalendarIcon = (p) => (
  <svg {...base} {...p}>
    <rect x="4" y="5" width="16" height="16" rx="3" />
    <path d="M4 9h16M8 3v4M16 3v4" />
  </svg>
);
export const ChartIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M5 19V5M19 19V11M12 19V8M5 19h15" />
  </svg>
);
export const GearIcon = (p) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2v3m0 14v3M4.2 4.2l2.1 2.1m11.4 11.4 2.1 2.1M2 12h3m14 0h3M4.2 19.8l2.1-2.1m11.4-11.4 2.1-2.1" />
  </svg>
);
export const PlusIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);
export const CloseIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);
export const SparkIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M12 3v4m0 10v4M3 12h4m10 0h4M6 6l2.5 2.5M18 6l-2.5 2.5M6 18l2.5-2.5M18 18l-2.5-2.5" />
  </svg>
);

export const TRANSPORT_ICON = {
  flight: FlightIcon,
  train: TrainIcon,
  bus: CabIcon, // no dedicated bus glyph yet; reuse the road-vehicle icon
  cab: CabIcon,
  walk: WalkIcon,
  other: PinIcon,
};
