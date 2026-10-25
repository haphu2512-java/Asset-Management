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
import type { Asset, CategoryId, Goal, Transaction, TransactionKind } from './finance';
import { PRICE_MAX_AGE_MS, pricesAreStale, refreshPrices } from './prices';
import { supabase } from './supabase';

/** Local cache keys are scoped per user so accounts never see each other's data. */
const cacheKey = (name: 'assets' | 'transactions' | 'goals', userId: string) => `${name}.v2:${userId}`;
/** Older versions stored the Anthropic key on the device; it now lives on the server. */
const LEGACY_KEYS = ['anthropicApiKey.v1', 'assets.v1', 'transactions.v1'];

type Store = {
  loaded: boolean;
  user: User | null;
  session: Session | null;
  assets: Asset[];
  transactions: Transaction[];
  goals: Goal[];
  /** Last failed sync with the server, shown to the user until dismissed. */
  syncError: string | null;
  dismissSyncError: () => void;
  /** Writes go to the screen at once and are rolled back if the server rejects them; resolves to success. */
  saveAsset: (asset: Asset) => Promise<boolean>;
  deleteAsset: (id: string) => Promise<boolean>;
  saveTransaction: (transaction: Transaction) => Promise<boolean>;
  deleteTransaction: (id: string) => Promise<boolean>;
  /** Fetches market prices for stock/crypto holdings; resolves to symbols with no price. */
  refreshMarketPrices: () => Promise<string[]>;
  pricesRefreshing: boolean;
  saveGoal: (goal: Goal) => Promise<boolean>;
  deleteGoal: (id: string) => Promise<boolean>;
  signOut: () => Promise<void>;
};

type Data = {
  /** User id the lists belong to; null until that user's data has been loaded. */
  owner: string | null;
  assets: Asset[];
  transactions: Transaction[];
  goals: Goal[];
};

const EMPTY: Data = { owner: null, assets: [], transactions: [], goals: [] };

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
    symbol: row.symbol ?? undefined,
    quantity: row.quantity == null ? undefined : Number(row.quantity),
    price: row.price == null ? undefined : Number(row.price),
    priceUpdatedAt: row.price_updated_at ?? undefined,
  };
}

function toGoal(row: any): Goal {
  return {
    id: row.id,
    name: row.name,
    target: Number(row.target) || 0,
    saved: Number(row.saved) || 0,
    deadline: row.deadline,
    type: row.type ?? (row.recurring_amount ? 'recurring' : 'target_amount'),
    category: row.category ?? 'saving',
    recurringAmount: row.recurring_amount != null ? Number(row.recurring_amount) : undefined,
    frequency: row.frequency ?? 'monthly',
    lastContributedAt: row.last_contributed_at ?? undefined,
    contributionsCount: row.contributions_count != null ? Number(row.contributions_count) : undefined,
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
  const [pricesRefreshing, setPricesRefreshing] = useState(false);

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

      const [cachedAssets, cachedTx, cachedGoals] = await Promise.all([
        readCache<Asset>(cacheKey('assets', id)),
        readCache<Transaction>(cacheKey('transactions', id)),
        readCache<Goal>(cacheKey('goals', id)),
      ]);
      let next: Data = { owner: id, assets: cachedAssets, transactions: cachedTx, goals: cachedGoals };

      try {
        const [assetsRes, txRes, goalsRes] = await Promise.all([
          supabase.from('assets').select('*').order('updated_at', { ascending: false }),
          supabase.from('transactions').select('*').order('date', { ascending: false }),
          supabase.from('goals').select('*').order('created_at', { ascending: true }),
        ]);
        if (assetsRes.error) throw assetsRes.error;
        if (txRes.error) throw txRes.error;
        if (goalsRes.error) throw goalsRes.error;
        next = {
          owner: id,
          assets: (assetsRes.data ?? []).map(toAsset),
          transactions: (txRes.data ?? []).map(toTransaction),
          goals: (goalsRes.data ?? []).map(toGoal),
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
    AsyncStorage.setItem(cacheKey('goals', userId), JSON.stringify(data.goals)).catch(() => {});
  }, [userId, data]);

  const fail = (message: string, error: unknown) => {
    console.error(message, error);
    setSyncError(message);
  };

  const saveAsset = useCallback(
    async (asset: Asset) => {
      if (!userId) return false;
      const prev = dataRef.current.assets.find((a) => a.id === asset.id);
      setData((d) => ({ ...d, assets: upsert(d.assets, asset) }));

      const { error } = await supabase.from('assets').upsert({
        id: asset.id,
        user_id: userId,
        name: asset.name,
        category: asset.category,
        amount: asset.amount,
        updated_at: asset.updatedAt,
        symbol: asset.symbol ?? null,
        quantity: asset.quantity ?? null,
        price: asset.price ?? null,
        price_updated_at: asset.priceUpdatedAt ?? null,
      });
      if (error) {
        setData((d) => ({
          ...d,
          assets: prev ? upsert(d.assets, prev) : d.assets.filter((a) => a.id !== asset.id),
        }));
        fail('Không lưu được tài sản. Hãy kiểm tra kết nối và thử lại.', error);
      }
      return !error;
    },
    [userId],
  );

  const deleteAsset = useCallback(
    async (id: string) => {
      if (!userId) return false;
      const prev = dataRef.current.assets.find((a) => a.id === id);
      setData((d) => ({ ...d, assets: d.assets.filter((a) => a.id !== id) }));

      const { error } = await supabase.from('assets').delete().eq('id', id);
      if (error) {
        if (prev) setData((d) => ({ ...d, assets: upsert(d.assets, prev) }));
        fail('Không xoá được tài sản. Hãy kiểm tra kết nối và thử lại.', error);
      }
      return !error;
    },
    [userId],
  );

  const saveTransaction = useCallback(
    async (tx: Transaction) => {
      if (!userId) return false;
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
      return !error;
    },
    [userId],
  );

  const deleteTransaction = useCallback(
    async (id: string) => {
      if (!userId) return false;
      const prev = dataRef.current.transactions.find((t) => t.id === id);
      setData((d) => ({ ...d, transactions: d.transactions.filter((t) => t.id !== id) }));

      const { error } = await supabase.from('transactions').delete().eq('id', id);
      if (error) {
        if (prev) setData((d) => ({ ...d, transactions: upsert(d.transactions, prev) }));
        fail('Không xoá được giao dịch. Hãy kiểm tra kết nối và thử lại.', error);
      }
      return !error;
    },
    [userId],
  );

  const refreshMarketPrices = useCallback(async () => {
    setPricesRefreshing(true);
    try {
      const { updated, missing } = await refreshPrices(dataRef.current.assets);
      // The user may have edited or deleted a holding while prices were loading:
      // apply each price to the latest version, and skip holdings that changed.
      const fresh = updated.flatMap((u) => {
        const current = dataRef.current.assets.find((a) => a.id === u.id);
        if (!current || current.symbol !== u.symbol || current.quantity !== u.quantity) return [];
        return [{ ...current, price: u.price, priceUpdatedAt: u.priceUpdatedAt, amount: u.amount, updatedAt: u.updatedAt }];
      });
      await Promise.all(fresh.map(saveAsset));
      return missing;
    } finally {
      setPricesRefreshing(false);
    }
  }, [saveAsset]);

  // Keep holdings at market value: refresh after loading, after a holding changes, and periodically.
  // Automatic refreshes are spaced out so a symbol with no price can't cause a refresh loop.
  const lastAutoRefresh = useRef(0);
  const holdingsKey = data.assets
    .filter((a) => a.symbol && a.quantity)
    .map((a) => `${a.id}:${a.symbol}:${a.quantity}`)
    .join('|');
  useEffect(() => {
    if (!loaded || !userId || data.owner !== userId) return;
    const maybeRefresh = (force: boolean) => {
      if (!pricesAreStale(dataRef.current.assets)) return;
      if (!force && Date.now() - lastAutoRefresh.current < PRICE_MAX_AGE_MS) return;
      lastAutoRefresh.current = Date.now();
      refreshMarketPrices().catch(() => {});
    };
    // A new or edited holding needs its price right away.
    maybeRefresh(true);
    const timer = setInterval(() => maybeRefresh(false), 60 * 1000);
    return () => clearInterval(timer);
  }, [loaded, userId, data.owner, holdingsKey, refreshMarketPrices]);

  const saveGoal = useCallback(
    async (goal: Goal) => {
      if (!userId) return false;
      const prev = dataRef.current.goals.find((g) => g.id === goal.id);
      setData((d) => ({ ...d, goals: upsert(d.goals, goal) }));

      const payload: any = {
        id: goal.id,
        user_id: userId,
        name: goal.name,
        target: goal.target,
        saved: goal.saved,
        deadline: goal.deadline,
      };
      if (goal.type) payload.type = goal.type;
      if (goal.category) payload.category = goal.category;
      if (goal.recurringAmount != null) payload.recurring_amount = goal.recurringAmount;
      if (goal.frequency) payload.frequency = goal.frequency;
      if (goal.lastContributedAt) payload.last_contributed_at = goal.lastContributedAt;
      if (goal.contributionsCount != null) payload.contributions_count = goal.contributionsCount;

      let { error } = await supabase.from('goals').upsert(payload);
      if (error && (error.message?.includes('column') || (error as any).code === 'PGRST204')) {
        // Fallback for remote DB before SQL migration is applied
        const basePayload = {
          id: goal.id,
          user_id: userId,
          name: goal.name,
          target: goal.target,
          saved: goal.saved,
          deadline: goal.deadline,
        };
        const retry = await supabase.from('goals').upsert(basePayload);
        error = retry.error;
      }

      if (error) {
        setData((d) => ({
          ...d,
          goals: prev ? upsert(d.goals, prev) : d.goals.filter((g) => g.id !== goal.id),
        }));
        fail('Không lưu được mục tiêu. Hãy kiểm tra kết nối và thử lại.', error);
      }
      return !error;
    },
    [userId],
  );

  const deleteGoal = useCallback(
    async (id: string) => {
      if (!userId) return false;
      const prev = dataRef.current.goals.find((g) => g.id === id);
      setData((d) => ({ ...d, goals: d.goals.filter((g) => g.id !== id) }));

      const { error } = await supabase.from('goals').delete().eq('id', id);
      if (error) {
        if (prev) setData((d) => ({ ...d, goals: upsert(d.goals, prev) }));
        fail('Không xoá được mục tiêu. Hãy kiểm tra kết nối và thử lại.', error);
      }
      return !error;
    },
    [userId],
  );

  const signOut = useCallback(async () => {
    const id = userId;
    await supabase.auth.signOut();
    // Don't leave a signed-out user's financial data on the device.
    if (id) {
      AsyncStorage.multiRemove([
        cacheKey('assets', id),
        cacheKey('transactions', id),
        cacheKey('goals', id),
      ]).catch(() => {});
    }
  }, [userId]);

  const value = useMemo<Store>(
    () => ({
      loaded,
      user,
      session,
      assets: data.assets,
      transactions: data.transactions,
      goals: data.goals,
      syncError,
      dismissSyncError: () => setSyncError(null),
      saveAsset,
      deleteAsset,
      saveTransaction,
      deleteTransaction,
      refreshMarketPrices,
      pricesRefreshing,
      saveGoal,
      deleteGoal,
      signOut,
    }),
    // `user` is tracked via userId: a refreshed token must not re-render consumers needlessly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [loaded, userId, session, data, syncError, saveAsset, deleteAsset, saveTransaction, deleteTransaction, refreshMarketPrices, pricesRefreshing, saveGoal, deleteGoal, signOut],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const store = useContext(StoreContext);
  if (!store) throw new Error('useStore must be used inside StoreProvider');
  return store;
}
