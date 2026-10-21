import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session, User } from '@supabase/supabase-js';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { Asset, CategoryId, Transaction, TransactionKind } from './finance';
import { supabase } from './supabase';

/** Local cache keys are scoped per user so accounts never see each other's data. */
const cacheKey = (name: 'assets' | 'transactions', userId: string) => `${name}.v2:${userId}`;
/** Older versions stored the Anthropic key on the device; it now lives on the server. */
const LEGACY_KEYS = ['anthropicApiKey.v1', 'assets.v1', 'transactions.v1'];

type Store = {
  loaded: boolean;
  user: User | null;
  session: Session | null;
  assets: Asset[];
  transactions: Transaction[];
  /** Last failed sync with the server, shown to the user until dismissed. */
  syncError: string | null;
  dismissSyncError: () => void;
  saveAsset: (asset: Asset) => Promise<void>;
  deleteAsset: (id: string) => Promise<void>;
  saveTransaction: (transaction: Transaction) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  signOut: () => Promise<void>;
};

type Data = {
  /** User id the lists belong to; null until that user's data has been loaded. */
  owner: string | null;
  assets: Asset[];
  transactions: Transaction[];
};

const EMPTY: Data = { owner: null, assets: [], transactions: [] };

const StoreContext = createContext<Store | null>(null);

export function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function upsert<T extends { id: string }>(list: T[], item: T): T[] {
  return list.some((x) => x.id === item.id)
    ? list.map((x) => (x.id === item.id ? item : x))
    : [...list, item];
}

function toAsset(row: any): Asset {
  return {
    id: row.id,
    name: row.name,
    category: row.category as CategoryId,
    amount: Number(row.amount) || 0,
    updatedAt: row.updated_at,
  };
}

function toTransaction(row: any): Transaction {
  return {
    id: row.id,
    kind: row.kind as TransactionKind,
    category: row.category,
    amount: Number(row.amount) || 0,
    note: row.note || '',
    date: row.date,
  };
}

async function readCache<T>(key: string): Promise<T[]> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [loaded, setLoaded] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [data, setData] = useState<Data>(EMPTY);
  const [syncError, setSyncError] = useState<string | null>(null);

  const user = session?.user ?? null;
  // Token refreshes hand out a new user object; key effects on the id so they don't reload.
  const userId = user?.id ?? null;

  const dataRef = useRef(data);
  dataRef.current = data;

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => setSession(session));
    return () => subscription.unsubscribe();
  }, []);

  // Load the signed-in user's data: cache first, then the server.
  useEffect(() => {
    if (!userId) {
      setData(EMPTY);
      setLoaded(true);
      return;
    }
    let isMounted = true;

    async function loadData(id: string) {
      setLoaded(false);
      AsyncStorage.multiRemove(LEGACY_KEYS).catch(() => {});

      const [cachedAssets, cachedTx] = await Promise.all([
        readCache<Asset>(cacheKey('assets', id)),
        readCache<Transaction>(cacheKey('transactions', id)),
      ]);
      let next: Data = { owner: id, assets: cachedAssets, transactions: cachedTx };

      try {
        const [assetsRes, txRes] = await Promise.all([
          supabase.from('assets').select('*').order('updated_at', { ascending: false }),
          supabase.from('transactions').select('*').order('date', { ascending: false }),
        ]);
        if (assetsRes.error) throw assetsRes.error;
        if (txRes.error) throw txRes.error;
        next = {
          owner: id,
          assets: (assetsRes.data ?? []).map(toAsset),
          transactions: (txRes.data ?? []).map(toTransaction),
        };
        if (isMounted) setSyncError(null);
      } catch (err) {
        console.error('Failed to load data:', err);
        if (isMounted) {
          setSyncError('Không tải được dữ liệu từ máy chủ. Đang hiển thị dữ liệu đã lưu trên máy.');
        }
      }

      if (isMounted) {
        setData(next);
        setLoaded(true);
      }
    }

    loadData(userId);
    return () => {
      isMounted = false;
    };
  }, [userId]);

  // Persist to the local cache, but only once the lists belong to the current user.
  useEffect(() => {
    if (!userId || data.owner !== userId) return;
    AsyncStorage.setItem(cacheKey('assets', userId), JSON.stringify(data.assets)).catch(() => {});
    AsyncStorage.setItem(cacheKey('transactions', userId), JSON.stringify(data.transactions)).catch(
      () => {},
    );
  }, [userId, data]);

  const fail = (message: string, error: unknown) => {
    console.error(message, error);
    setSyncError(message);
  };

  const saveAsset = useCallback(
    async (asset: Asset) => {
      if (!userId) return;
      const prev = dataRef.current.assets.find((a) => a.id === asset.id);
      setData((d) => ({ ...d, assets: upsert(d.assets, asset) }));

      const { error } = await supabase.from('assets').upsert({
        id: asset.id,
        user_id: userId,
        name: asset.name,
        category: asset.category,
        amount: asset.amount,
        updated_at: asset.updatedAt,
      });
      if (error) {
        setData((d) => ({
          ...d,
          assets: prev ? upsert(d.assets, prev) : d.assets.filter((a) => a.id !== asset.id),
        }));
        fail('Không lưu được tài sản. Hãy kiểm tra kết nối và thử lại.', error);
      }
    },
    [userId],
  );

  const deleteAsset = useCallback(
    async (id: string) => {
      if (!userId) return;
      const prev = dataRef.current.assets.find((a) => a.id === id);
      setData((d) => ({ ...d, assets: d.assets.filter((a) => a.id !== id) }));

      const { error } = await supabase.from('assets').delete().eq('id', id);
      if (error) {
        if (prev) setData((d) => ({ ...d, assets: upsert(d.assets, prev) }));
        fail('Không xoá được tài sản. Hãy kiểm tra kết nối và thử lại.', error);
      }
    },
    [userId],
  );

  const saveTransaction = useCallback(
    async (tx: Transaction) => {
      if (!userId) return;
      const prev = dataRef.current.transactions.find((t) => t.id === tx.id);
      setData((d) => ({ ...d, transactions: upsert(d.transactions, tx) }));

      const { error } = await supabase.from('transactions').upsert({
        id: tx.id,
        user_id: userId,
        kind: tx.kind,
        category: tx.category,
        amount: tx.amount,
        note: tx.note,
        date: tx.date,
      });
      if (error) {
        setData((d) => ({
          ...d,
          transactions: prev
            ? upsert(d.transactions, prev)
            : d.transactions.filter((t) => t.id !== tx.id),
        }));
        fail('Không lưu được giao dịch. Hãy kiểm tra kết nối và thử lại.', error);
      }
    },
    [userId],
  );

  const deleteTransaction = useCallback(
    async (id: string) => {
      if (!userId) return;
      const prev = dataRef.current.transactions.find((t) => t.id === id);
      setData((d) => ({ ...d, transactions: d.transactions.filter((t) => t.id !== id) }));

      const { error } = await supabase.from('transactions').delete().eq('id', id);
      if (error) {
        if (prev) setData((d) => ({ ...d, transactions: upsert(d.transactions, prev) }));
        fail('Không xoá được giao dịch. Hãy kiểm tra kết nối và thử lại.', error);
      }
    },
    [userId],
  );

  const signOut = useCallback(async () => {
    const id = userId;
    await supabase.auth.signOut();
    // Don't leave a signed-out user's financial data on the device.
    if (id) {
      AsyncStorage.multiRemove([cacheKey('assets', id), cacheKey('transactions', id)]).catch(() => {});
    }
  }, [userId]);

  const value = useMemo<Store>(
    () => ({
      loaded,
      user,
      session,
      assets: data.assets,
      transactions: data.transactions,
      syncError,
      dismissSyncError: () => setSyncError(null),
      saveAsset,
      deleteAsset,
      saveTransaction,
      deleteTransaction,
      signOut,
    }),
    // `user` is tracked via userId: a refreshed token must not re-render consumers needlessly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [loaded, userId, session, data, syncError, saveAsset, deleteAsset, saveTransaction, deleteTransaction, signOut],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const store = useContext(StoreContext);
  if (!store) throw new Error('useStore must be used inside StoreProvider');
  return store;
}
