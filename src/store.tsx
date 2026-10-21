import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session, User } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Asset, CategoryId, Transaction, TransactionKind } from './finance';
import { supabase } from './supabase';

const KEYS = {
  assets: 'assets.v1',
  transactions: 'transactions.v1',
  apiKey: 'anthropicApiKey.v1',
};

type Store = {
  loaded: boolean;
  user: User | null;
  session: Session | null;
  assets: Asset[];
  transactions: Transaction[];
  apiKey: string;
  saveAsset: (asset: Asset) => Promise<void>;
  deleteAsset: (id: string) => Promise<void>;
  saveTransaction: (transaction: Transaction) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  setApiKey: (key: string) => void;
  signOut: () => Promise<void>;
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
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [apiKey, setApiKeyState] = useState('');

  // 1. Initial auth check & listener
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // 2. Fetch data based on user session or local storage
  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      setLoaded(false);
      try {
        const k = await AsyncStorage.getItem(KEYS.apiKey);
        if (k && isMounted) setApiKeyState(k);

        if (user) {
          // Fetch from Supabase
          const [assetsRes, txRes] = await Promise.all([
            supabase.from('assets').select('*').order('updated_at', { ascending: false }),
            supabase.from('transactions').select('*').order('date', { ascending: false }),
          ]);

          if (isMounted) {
            if (assetsRes.data) {
              const mappedAssets: Asset[] = assetsRes.data.map((row: any) => ({
                id: row.id,
                name: row.name,
                category: row.category as CategoryId,
                amount: Number(row.amount) || 0,
                updatedAt: row.updated_at,
              }));
              setAssets(mappedAssets);
              AsyncStorage.setItem(KEYS.assets, JSON.stringify(mappedAssets));
            }
            if (txRes.data) {
              const mappedTx: Transaction[] = txRes.data.map((row: any) => ({
                id: row.id,
                kind: row.kind as TransactionKind,
                category: row.category,
                amount: Number(row.amount) || 0,
                note: row.note || '',
                date: row.date,
              }));
              setTransactions(mappedTx);
              AsyncStorage.setItem(KEYS.transactions, JSON.stringify(mappedTx));
            }
          }
        } else {
          // Fallback to local storage when not logged in
          const [a, t] = await Promise.all([
            AsyncStorage.getItem(KEYS.assets),
            AsyncStorage.getItem(KEYS.transactions),
          ]);
          if (isMounted) {
            setAssets(a ? JSON.parse(a) : []);
            setTransactions(t ? JSON.parse(t) : []);
          }
        }
      } catch (err) {
        console.error('Failed to load data:', err);
      } finally {
        if (isMounted) setLoaded(true);
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, [user]);

  // Save asset
  const saveAsset = async (asset: Asset) => {
    setAssets((list) => {
      const next = upsert(list, asset);
      AsyncStorage.setItem(KEYS.assets, JSON.stringify(next));
      return next;
    });

    if (user) {
      await supabase.from('assets').upsert({
        id: asset.id,
        user_id: user.id,
        name: asset.name,
        category: asset.category,
        amount: asset.amount,
        updated_at: asset.updatedAt,
      });
    }
  };

  // Delete asset
  const deleteAsset = async (id: string) => {
    setAssets((list) => {
      const next = list.filter((a) => a.id !== id);
      AsyncStorage.setItem(KEYS.assets, JSON.stringify(next));
      return next;
    });

    if (user) {
      await supabase.from('assets').delete().eq('id', id);
    }
  };

  // Save transaction
  const saveTransaction = async (tx: Transaction) => {
    setTransactions((list) => {
      const next = upsert(list, tx);
      AsyncStorage.setItem(KEYS.transactions, JSON.stringify(next));
      return next;
    });

    if (user) {
      await supabase.from('transactions').upsert({
        id: tx.id,
        user_id: user.id,
        kind: tx.kind,
        category: tx.category,
        amount: tx.amount,
        note: tx.note,
        date: tx.date,
      });
    }
  };

  // Delete transaction
  const deleteTransaction = async (id: string) => {
    setTransactions((list) => {
      const next = list.filter((t) => t.id !== id);
      AsyncStorage.setItem(KEYS.transactions, JSON.stringify(next));
      return next;
    });

    if (user) {
      await supabase.from('transactions').delete().eq('id', id);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const value = useMemo<Store>(
    () => ({
      loaded,
      user,
      session,
      assets,
      transactions,
      apiKey,
      saveAsset,
      deleteAsset,
      saveTransaction,
      deleteTransaction,
      setApiKey: (key) => {
        setApiKeyState(key);
        AsyncStorage.setItem(KEYS.apiKey, key);
      },
      signOut,
    }),
    [loaded, user, session, assets, transactions, apiKey],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const store = useContext(StoreContext);
  if (!store) throw new Error('useStore must be used inside StoreProvider');
  return store;
}
