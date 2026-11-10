import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { StyleSheet, useColorScheme } from 'react-native';
import { formatVnd } from './finance';
import { usePrefs } from './prefs';

/** Colours by role, so screens never hard-code a hex value. */
export type Palette = {
  background: string;
  /** Cards, sheets and bars. */
  card: string;
  /** Insets inside a card: summaries, input rows. */
  surfaceAlt: string;
  text: string;
  /** Secondary text. */
  muted: string;
  border: string;
  borderSubtle: string;
  primary: string;
  /** Tinted background for selected items. */
  primaryLight: string;
  /** Text and icons on top of `primary`. */
  onPrimary: string;
  income: string;
  incomeSoft: string;
  expense: string;
  expenseSoft: string;
  warning: string;
  warningSoft: string;
  /** Dim layer behind sheets. */
  overlay: string;
};

const light: Palette = {
  background: '#F4F6F8',
  card: '#FFFFFF',
  surfaceAlt: '#F8FAFC',
  text: '#0F172A',
  muted: '#566377',
  border: '#DCE3EC',
  borderSubtle: '#EEF2F6',
  primary: '#0F766E',
  primaryLight: '#E6F6F3',
  onPrimary: '#FFFFFF',
  income: '#15803D',
  incomeSoft: '#DCFCE7',
  expense: '#B91C1C',
  expenseSoft: '#FEE2E2',
  warning: '#B45309',
  warningSoft: '#FEF3C7',
  overlay: 'rgba(15, 23, 42, 0.45)',
};

const dark: Palette = {
  background: '#0B1220',
  card: '#151E2E',
  surfaceAlt: '#1B2637',
  text: '#E8EEF6',
  muted: '#9AA8BC',
  border: '#2B3850',
  borderSubtle: '#212D41',
  primary: '#2DD4BF',
  primaryLight: '#123733',
  onPrimary: '#04211D',
  income: '#4ADE80',
  incomeSoft: '#133522',
  expense: '#F87171',
  expenseSoft: '#3F1D1D',
  warning: '#FBBF24',
  warningSoft: '#3B2F10',
  overlay: 'rgba(0, 0, 0, 0.6)',
};

/** Spacing scale in points. */
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const;
/** Corner radii. */
export const radius = { sm: 8, md: 12, lg: 16, pill: 999 } as const;
/** Type scale. Nothing in the app is smaller than `caption`. */
export const font = { caption: 12, body: 14, bodyLarge: 16, title: 18, headline: 22, display: 30 } as const;
/** Smallest comfortable touch target. */
export const TOUCH = 44;

function makeUi(colors: Palette) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    content: { padding: space.md, paddingBottom: 96, gap: space.md },
    card: {
      backgroundColor: colors.card,
      borderRadius: radius.md,
      padding: space.lg,
      gap: space.sm,
      borderWidth: 1,
      borderColor: colors.border,
    },
    title: { fontSize: font.title, fontWeight: '700', color: colors.text, letterSpacing: -0.2 },
    heading: { fontSize: font.bodyLarge, fontWeight: '700', color: colors.text, letterSpacing: -0.1 },
    label: { fontSize: font.caption, color: colors.muted },
    text: { fontSize: font.body, color: colors.text },
    big: { fontSize: font.display, fontWeight: '800', color: colors.text, letterSpacing: -0.6 },
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.sm,
      paddingHorizontal: space.md,
      paddingVertical: 10,
      minHeight: TOUCH,
      fontSize: font.bodyLarge,
      color: colors.text,
      backgroundColor: colors.card,
    },
    chip: {
      paddingHorizontal: space.md,
      paddingVertical: 7,
      minHeight: 36,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
    },
    dot: { width: 10, height: 10, borderRadius: 5 },
    divider: { height: 1, backgroundColor: colors.borderSubtle },
  });
}

/** Mixes a hex colour with white; used to keep category colours readable on dark surfaces. */
function lighten(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const mix = (c: number) => Math.round(c + (255 - c) * amount);
  const [r, g, b] = [mix((n >> 16) & 255), mix((n >> 8) & 255), mix(n & 255)];
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

export type Theme = {
  dark: boolean;
  colors: Palette;
  ui: ReturnType<typeof makeUi>;
  /** A category colour adjusted for the current scheme. */
  tone: (color: string) => string;
};

const lightTheme: Theme = { dark: false, colors: light, ui: makeUi(light), tone: (c) => c };
const darkTheme: Theme = {
  dark: true,
  colors: dark,
  ui: makeUi(dark),
  tone: (c) => (/^#[0-9a-f]{6}$/i.test(c) ? lighten(c, 0.38) : c),
};

const ThemeContext = createContext<Theme>(lightTheme);

/** Follows the system colour scheme unless the user picked light or dark in Settings. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const { prefs } = usePrefs();
  const isDark = prefs.themeMode === 'dark' || (prefs.themeMode === 'system' && system === 'dark');
  return <ThemeContext.Provider value={isDark ? darkTheme : lightTheme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}

export const HIDDEN_AMOUNT = '••••••';

/** Formats amounts as VND, or as dots when the user chose to hide balances. */
export function useMoney(): (amount: number) => string {
  const { prefs } = usePrefs();
  return useMemo(() => (prefs.hideBalance ? () => HIDDEN_AMOUNT : formatVnd), [prefs.hideBalance]);
}
