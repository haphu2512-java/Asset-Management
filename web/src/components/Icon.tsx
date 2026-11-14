import type { CSSProperties } from 'react';

/** Stroke icons drawn on a 24×24 grid. */
const PATHS: Record<string, string> = {
  home: 'M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10',
  wallet: 'M3 7a2 2 0 012-2h13v4M3 7v10a2 2 0 002 2h15a1 1 0 001-1V10a1 1 0 00-1-1H5a2 2 0 01-2-2zM16.5 14h.01',
  transactions: 'M7 4v16M7 20l-3-3M7 20l3-3M17 20V4M17 4l-3 3M17 4l3 3',
  goals: 'M12 21a9 9 0 100-18 9 9 0 000 18zM12 16a4 4 0 100-8 4 4 0 000 8zM12 12h.01',
  budget: 'M4 6h16M4 12h10M4 18h6M19 15v6M16 18h6',
  clock: 'M12 21a9 9 0 100-18 9 9 0 000 18zM12 7v5l3 2',
  chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  tag: 'M3 12V4h8l10 10-8 8L3 12zM7.5 8h.01',
  sparkle: 'M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3zM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15z',
  settings: 'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.6 1.6 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.6 1.6 0 00-2.7 1.1V21a2 2 0 11-4 0v-.1A1.6 1.6 0 007.5 19.4a1.6 1.6 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.6 1.6 0 00-1.1-2.7H1.7a2 2 0 110-4h.1A1.6 1.6 0 004.6 7.5a1.6 1.6 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.6 1.6 0 001.8.3H9a1.6 1.6 0 001-1.5V3a2 2 0 114 0v.1a1.6 1.6 0 002.7 1.1l.1-.1a2 2 0 112.8 2.8l-.1.1a1.6 1.6 0 00-.3 1.8V9a1.6 1.6 0 001.5 1H21a2 2 0 110 4h-.1a1.6 1.6 0 00-1.5 1z',
  plus: 'M12 5v14M5 12h14',
  close: 'M6 6l12 12M18 6L6 18',
  check: 'M5 12l5 5L20 7',
  back: 'M15 5l-7 7 7 7',
  next: 'M9 5l7 7-7 7',
  search: 'M11 19a8 8 0 100-16 8 8 0 000 16zM21 21l-4.3-4.3',
  eye: 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12zM12 15a3 3 0 100-6 3 3 0 000 6z',
  'eye-off': 'M3 3l18 18M10.6 5.1A10.6 10.6 0 0112 5c6.4 0 10 7 10 7a17 17 0 01-3.2 4M6.5 6.6A16.600 16.600 0 002 12s3.600 7 10 7c1.700 0 3.200-.5 4.500-1.200M9.900 9.900a3 3 0 004.200 4.200',
  refresh: 'M20 11a8 8 0 00-14.900-3M4 4v4h4M4 13a8 8 0 0014.900 3M20 20v-4h-4',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6',
  edit: 'M4 20h4L19 9l-4-4L4 16v4zM13.500 6.500l4 4',
  up: 'M12 19V5M5 12l7-7 7 7',
  down: 'M12 5v14M5 12l7 7 7-7',
  transfer: 'M4 8h14M14 4l4 4-4 4M20 16H6M10 12l-4 4 4 4',
  download: 'M12 4v11M7 10l5 5 5-5M4 20h16',
  upload: 'M12 16V5M7 10l5-5 5 5M4 20h16',
  sun: 'M12 16a4 4 0 100-8 4 4 0 000 8zM12 2v2M12 20v2M2 12h2M20 12h2M4.900 4.900l1.400 1.400M17.700 17.700l1.400 1.400M4.900 19.100l1.400-1.400M17.700 6.300l1.400-1.400',
  moon: 'M20 14.500A8 8 0 019.500 4 8 8 0 1020 14.500z',
  logout: 'M9 4H5v16h4M16 8l4 4-4 4M20 12H9',
  send: 'M4 12l16-8-6 16-3-7-7-1z',
  camera: 'M4 8h3l2-3h6l2 3h3v11H4V8zM12 16a3 3 0 100-6 3 3 0 000 6z',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  cloud: 'M7 18a4 4 0 01-.700-7.900 6 6 0 0111.600 1.400A3.500 3.500 0 0117.500 18H7z',
  shield: 'M12 3l8 3v6c0 5-3.500 8-8 9-4.500-1-8-4-8-9V6l8-3z',
  filter: 'M4 5h16l-6 8v6l-4-2v-4L4 5z',
  bank: 'M3 10l9-6 9 6M5 10v8M9.500 10v8M14.500 10v8M19 10v8M3 20h18',
  coins: 'M9 13a6 6 0 100-12 6 6 0 000 12zM15.500 9.200A6 6 0 1113 20.700',
  menu: 'M4 6h16M4 12h16M4 18h16',
};

export type IconName = keyof typeof PATHS | string;

export function Icon({ name, size = 20, color, style }: { name: IconName; size?: number; color?: string; style?: CSSProperties }) {
  const d = PATHS[name] ?? PATHS.tag;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color ?? 'currentColor'}
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ flexShrink: 0, ...style }}
    >
      <path d={d} />
    </svg>
  );
}

/** Icon for an asset category. */
export const ASSET_ICON: Record<string, string> = {
  cash: 'wallet',
  bank: 'bank',
  saving: 'shield',
  stock: 'chart',
  crypto: 'coins',
  gold: 'coins',
  fx: 'transfer',
  lent: 'up',
  debt: 'down',
};

/** Coloured rounded square holding a letter or an icon, for list rows. */
export function Badge({ color, icon, letter }: { color: string; icon?: string; letter?: string }) {
  return (
    <span className="badge tinted" style={{ '--c': color } as CSSProperties}>
      {icon ? <Icon name={icon} size={18} /> : <strong>{(letter ?? '?').slice(0, 1).toUpperCase()}</strong>}
    </span>
  );
}
