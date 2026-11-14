/** The few react-native APIs the shared store uses, implemented for the browser. */
type AppStateStatus = 'active' | 'background';

export const AppState = {
  get currentState(): AppStateStatus {
    return document.visibilityState === 'visible' ? 'active' : 'background';
  },
  addEventListener(_type: 'change', listener: (state: AppStateStatus) => void) {
    const handler = () => listener(document.visibilityState === 'visible' ? 'active' : 'background');
    const online = () => listener('active');
    document.addEventListener('visibilitychange', handler);
    window.addEventListener('online', online);
    return {
      remove() {
        document.removeEventListener('visibilitychange', handler);
        window.removeEventListener('online', online);
      },
    };
  },
};

export const Platform = { OS: 'web' as const, select: <T,>(o: { web?: T; default?: T }) => o.web ?? o.default };
