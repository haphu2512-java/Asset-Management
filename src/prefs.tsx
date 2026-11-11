import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type ThemeMode = 'system' | 'light' | 'dark';

/** Settings kept on this device only. */
export type Prefs = {
  themeMode: ThemeMode;
  /** Show •••••• instead of amounts, for use in public. */
  hideBalance: boolean;
  /** Ask for fingerprint / Face ID / device PIN when the app opens. */
  appLock: boolean;
  /** Daily reminder to write down the day's spending. */
  reminder: { enabled: boolean; hour: number; minute: number };
  /** Reminders for goal contributions, due debts, maturing deposits and recurring transactions. */
  eventReminders: boolean;
  /** Users who finished (or skipped) the first-run guide. */
  onboarded: Record<string, true>;
  /** Last wallet and categories used, offered first next time. */
  lastAccountId?: string;
  lastCategory: { income?: string; expense?: string };
};

const DEFAULTS: Prefs = {
  themeMode: 'system',
  hideBalance: false,
  appLock: false,
  reminder: { enabled: false, hour: 21, minute: 0 },
  eventReminders: false,
  onboarded: {},
  lastCategory: {},
};

const KEY = 'prefs.v1';

type PrefsContextValue = {
  prefs: Prefs;
  /** False until the saved settings have been read. */
  ready: boolean;
  setPrefs: (patch: Partial<Prefs>) => void;
};

const PrefsContext = createContext<PrefsContextValue>({ prefs: DEFAULTS, ready: false, setPrefs: () => {} });

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [prefs, setState] = useState<Prefs>(DEFAULTS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => {
        if (raw) setState({ ...DEFAULTS, ...(JSON.parse(raw) as Partial<Prefs>) });
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  const setPrefs = useCallback((patch: Partial<Prefs>) => {
    setState((current) => {
      const next = { ...current, ...patch };
      AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const value = useMemo(() => ({ prefs, ready, setPrefs }), [prefs, ready, setPrefs]);
  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>;
}

export function usePrefs(): PrefsContextValue {
  return useContext(PrefsContext);
}
