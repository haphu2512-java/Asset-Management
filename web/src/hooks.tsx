import { useCallback, useEffect, useState } from 'react';
import { formatVnd } from '@shared/finance';
import { usePrefs } from '@shared/prefs';

/** Formats money, hiding it when "ẩn số dư" is on. */
export function useMoney(): (amount: number) => string {
  const { prefs } = usePrefs();
  return useCallback((amount: number) => (prefs.hideBalance ? '•••••• ₫' : formatVnd(amount)), [prefs.hideBalance]);
}

/** Applies the chosen theme to <html> and returns whether dark is in effect. */
export function useAppliedTheme(): boolean {
  const { prefs } = usePrefs();
  const [systemDark, setSystemDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setSystemDark(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  const dark = prefs.themeMode === 'dark' || (prefs.themeMode === 'system' && systemDark);
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0B1220' : '#0F766E');
  }, [dark]);
  return dark;
}

export const shortDate = (date: string) => {
  const [, m, d] = date.split('-');
  return `${Number(d)}/${Number(m)}`;
};

export const fullDate = (date: string) => {
  const [y, m, d] = date.split('-');
  return `${d}/${m}/${y}`;
};
