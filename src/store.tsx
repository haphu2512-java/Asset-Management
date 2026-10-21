import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Asset, Transaction } from './finance';

const KEYS = {
  assets: 'assets.v1',
  transactions: 'transactions.v1',
  apiKey: 'anthropicApiKey.v1',
};

type Store = {
  loaded: boolean;
  assets: Asset[];
  transactions: Transaction[];
  apiKey: string;
  saveAsset: (asset: Asset) => void;
  deleteAsset: (id: string) => void;
  saveTransaction: (transaction: Transaction) => void;
  deleteTransaction: (id: string) => void;
  setApiKey: (key: string) => void;
};

const StoreContext = createContext<Store | null>(null);

export function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function upsert<T extends { id: string }>(list: T[], item: T): T[] {
  return list.some((x) => x.id === item.id)
    ? list.map((x) => (x.id === item.id ? item : x))
    : [...list, item];
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [loaded, setLoaded] = useState(false);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [apiKey, setApiKeyState] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [a, t, k] = await Promise.all([
          AsyncStorage.getItem(KEYS.assets),
          AsyncStorage.getItem(KEYS.transactions),
          AsyncStorage.getItem(KEYS.apiKey),
        ]);
        if (a) setAssets(JSON.parse(a));
        if (t) setTransactions(JSON.parse(t));
        if (k) setApiKeyState(k);
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  // Persist after the initial load so we never overwrite saved data with empty state.
  useEffect(() => {
    if (loaded) AsyncStorage.setItem(KEYS.assets, JSON.stringify(assets));
  }, [loaded, assets]);
  useEffect(() => {
    if (loaded) AsyncStorage.setItem(KEYS.transactions, JSON.stringify(transactions));
  }, [loaded, transactions]);

  const value = useMemo<Store>(
    () => ({
      loaded,
      assets,
      transactions,
      apiKey,
      saveAsset: (asset) => setAssets((list) => upsert(list, asset)),
      deleteAsset: (id) => setAssets((list) => list.filter((a) => a.id !== id)),
      saveTransaction: (tx) => setTransactions((list) => upsert(list, tx)),
      deleteTransaction: (id) => setTransactions((list) => list.filter((t) => t.id !== id)),
      setApiKey: (key) => {
        setApiKeyState(key);
        AsyncStorage.setItem(KEYS.apiKey, key);
      },
    }),
    [loaded, assets, transactions, apiKey],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const store = useContext(StoreContext);
  if (!store) throw new Error('useStore must be used inside StoreProvider');
  return store;
}
