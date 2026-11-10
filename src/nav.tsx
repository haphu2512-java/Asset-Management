import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { BackHandler } from 'react-native';

export type TabId = 'overview' | 'assets' | 'transactions' | 'goals';

/** Screens that open on top of the tabs, with a back button. */
export type Route =
  | { name: 'settings' }
  | { name: 'asset'; id: string }
  | { name: 'category'; id: string; month: string }
  | { name: 'budgets' }
  | { name: 'recurring' }
  | { name: 'categories' }
  | { name: 'reports' }
  | { name: 'search'; accountId?: string }
  | { name: 'advisor'; question?: string }
  | { name: 'data' };

type NavContextValue = {
  tab: TabId;
  setTab: (tab: TabId) => void;
  /** Screens opened on top of the current tab, last one showing. */
  stack: Route[];
  push: (route: Route) => void;
  pop: () => void;
  /** Back to the tabs. */
  popToRoot: () => void;
};

const NavContext = createContext<NavContextValue | null>(null);

/**
 * A small stack-over-tabs navigator: tabs at the root, detail screens pushed on top.
 * The Android back button closes the top screen, then returns to the first tab, then leaves the app.
 */
export function NavProvider({ children }: { children: ReactNode }) {
  const [tab, setTabState] = useState<TabId>('overview');
  const [stack, setStack] = useState<Route[]>([]);

  const push = useCallback((route: Route) => setStack((s) => [...s, route]), []);
  const pop = useCallback(() => setStack((s) => s.slice(0, -1)), []);
  const popToRoot = useCallback(() => setStack([]), []);
  const setTab = useCallback((next: TabId) => {
    setStack([]);
    setTabState(next);
  }, []);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (stack.length > 0) {
        pop();
        return true;
      }
      if (tab !== 'overview') {
        setTabState('overview');
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [stack.length, tab, pop]);

  const value = useMemo(() => ({ tab, setTab, stack, push, pop, popToRoot }), [tab, setTab, stack, push, pop, popToRoot]);
  return <NavContext.Provider value={value}>{children}</NavContext.Provider>;
}

export function useNav(): NavContextValue {
  const nav = useContext(NavContext);
  if (!nav) throw new Error('useNav must be used inside NavProvider');
  return nav;
}
