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
import { AppState } from 'react-native';
import type { Budget } from './budgets';
import {
  isHolding,
  mergeCategories,
  previousSnapshot,
  sameSnapshot,
  takeSnapshot,
  todayKey,
  type Asset,
  type AssetSnapshot,
  type CustomCategory,
  type Goal,
  type GoalContribution,
  type Transaction,
  type TransactionCategory,
} from './finance';
import { positionFromTrades, tradeCashFlow, type Trade } from './investments';
import { adjustmentFor, applyTransactionChange } from './ledger';
import { PRICE_MAX_AGE_MS, pricesAreStale, refreshPrices } from './prices';
import { advanceRule, dueDates, occurrenceTransaction, type Recurring } from './recurring';
import { supabase } from './supabase';
import {
  classifyFailure,
  Draft,
  EMPTY,
  isSchemaError,
  LIST_KEYS,
  nextBatch,
  TABLES,
  type Data,
  type ListKey,
  type Op,
} from './sync';

/** Local cache keys are scoped per user so accounts never see each other's data. */
const cacheKey = (name: ListKey | 'snapshots' | 'outbox', userId: string) => `${name}.v3:${userId}`;
/** Keys written by older versions of the app. */
const legacyKeys = (userId: string) => [
  'anthropicApiKey.v1',
  'assets.v1',
  'transactions.v1',
  ...['assets', 'transactions', 'goals', 'snapshots'].map((n) => `${n}.v2:${userId}`),
];
/** Days of snapshots kept, enough for the one-year net worth chart. */
const SNAPSHOT_DAYS = 400;
/** Price refreshes save holdings one by one; wait for them to settle before writing today's snapshot. */
const SNAPSHOT_DELAY_MS = 2000;
/** Rows per request when loading a table; PostgREST returns at most 1000 by default. */
const PAGE_SIZE = 1000;
/** How often pending changes are retried while the app is open. */
const RETRY_MS = 30_000;
/** Returning to the app after this long reloads from the server. */
const RELOAD_AFTER_MS = 5 * 60_000;

export const SCHEMA_OUTDATED_MESSAGE =
  'Cơ sở dữ liệu chưa được cập nhật cho phiên bản này. Hãy chạy các file migration mới trong supabase/migrations (xem docs/SETUP.md).';

type ContributeOptions = { accountId?: string; date?: string };

type Store = {
  loaded: boolean;
  user: User | null;
  session: Session | null;
  assets: Asset[];
  transactions: Transaction[];
  goals: Goal[];
  budgets: Budget[];
  recurring: Recurring[];
  /** Built-in categories with the user's changes, plus the user's own categories. */
  categories: TransactionCategory[];
  customCategories: CustomCategory[];
  trades: Trade[];
  contributions: GoalContribution[];
  /** Daily net worth snapshots, newest first. */
  snapshots: AssetSnapshot[];
  /** Snapshot from the last day before today, to show change since yesterday; null when there is none yet. */
  baseline: AssetSnapshot | null;
  /** Changes saved on the device that have not reached the server yet. */
  pendingCount: number;
  /** Last problem talking to the server, shown to the user until dismissed. */
  syncError: string | null;
  dismissSyncError: () => void;
  /** Sends pending changes and reloads from the server. */
  syncNow: () => Promise<void>;

  /**
   * Changes show on screen at once and are kept on the device until the server has them,
   * so nothing typed without a connection is lost.
   */
  saveAsset: (asset: Asset) => void;
  deleteAsset: (id: string) => void;
  /** Records the transfer that brings an account to its real balance. */
  adjustBalance: (assetId: string, target: number) => void;
  saveTransaction: (transaction: Transaction) => void;
  saveTransactions: (transactions: Transaction[]) => void;
  deleteTransaction: (id: string) => void;
  saveGoal: (goal: Goal) => void;
  deleteGoal: (id: string) => void;
  /** Adds money to a goal; with an account and a linked asset the money is transferred for real. */
  contribute: (goalId: string, amount: number, options?: ContributeOptions) => void;
  removeContribution: (id: string) => void;
  saveBudget: (budget: Budget) => void;
  saveBudgets: (budgets: Budget[]) => void;
  deleteBudget: (id: string) => void;
  saveRecurring: (rule: Recurring) => void;
  deleteRecurring: (id: string) => void;
  /** Records one occurrence of a rule and moves the rule on. */
  recordOccurrence: (ruleId: string, date: string) => void;
  /** Moves the rule on without recording the occurrence. */
  skipOccurrence: (ruleId: string, date: string) => void;
  saveCategory: (category: CustomCategory) => void;
  deleteCategory: (id: string) => void;
  /** Adds or edits a trade, updates the holding's quantity and moves the cash when a wallet is given. */
  saveTrade: (trade: Trade) => void;
  deleteTrade: (id: string) => void;

  /** Fetches market prices for holdings; resolves to symbols with no price. */
  refreshMarketPrices: () => Promise<string[]>;
  pricesRefreshing: boolean;
  signOut: () => Promise<void>;
  /** Deletes the account and everything stored for it on the server; resolves to an error message or null. */
  deleteAccount: () => Promise<string | null>;
};

const StoreContext = createContext<Store | null>(null);

export function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Merges snapshot lists by date (later lists win) and keeps the most recent days. */
function mergeSnapshots(...lists: AssetSnapshot[][]): AssetSnapshot[] {
  const byDate = new Map<string, AssetSnapshot>();
  for (const list of lists) for (const snap of list) byDate.set(snap.date, snap);
  return [...byDate.values()].sort((a, b) => b.date.localeCompare(a.date)).slice(0, SNAPSHOT_DAYS);
}

function toSnapshot(row: any): AssetSnapshot {
  const amounts: Record<string, number> = {};
  for (const [id, amount] of Object.entries(row.amounts ?? {})) amounts[id] = Number(amount) || 0;
  return {
    date: row.date,
    netWorth: Number(row.net_worth) || 0,
    totalAssets: Number(row.total_assets) || 0,
    totalDebt: Number(row.total_debt) || 0,
    amounts,
  };
}

async function readCache<T>(key: string): Promise<T[]> {
  try {
    const raw = await AsyncStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

/** Loads every row of a table, page by page. */
async function fetchAll<K extends ListKey>(list: K): Promise<Data[K]> {
  const config = TABLES[list];
  const rows: unknown[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from(config.table)
      .select('*')
      .order(config.order, { ascending: false })
      .order(config.idColumn, { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if ((data ?? []).length < PAGE_SIZE) break;
  }
  return rows.map(config.fromRow) as Data[K];
}

/** Rebuilds a holding from its trades: quantity from the history, value from the last known price. */
function withPosition(asset: Asset, trades: Trade[]): Asset {
  const own = trades.filter((t) => t.assetId === asset.id);
  if (own.length === 0) return asset;
  const { quantity } = positionFromTrades(own);
  return {
    ...asset,
    quantity,
    amount: asset.price ? Math.round(asset.price * quantity) : asset.amount,
    updatedAt: new Date().toISOString(),
  };
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [loaded, setLoaded] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [data, setData] = useState<Data>(EMPTY);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [pricesRefreshing, setPricesRefreshing] = useState(false);

  const user = session?.user ?? null;
  // Token refreshes hand out a new user object; key effects on the id so they don't reload.
  const userId = user?.id ?? null;

  const dataRef = useRef(data);
  const outbox = useRef<Op[]>([]);
  const flushing = useRef<Promise<boolean> | null>(null);
  const lastLoad = useRef(0);
  const reload = useRef<(() => Promise<void>) | null>(null);

  const apply = useCallback((next: Data) => {
    dataRef.current = next;
    setData(next);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => setSession(session));
    return () => subscription.unsubscribe();
  }, []);

  const persistOutbox = useCallback((id: string) => {
    setPendingCount(outbox.current.length);
    AsyncStorage.setItem(cacheKey('outbox', id), JSON.stringify(outbox.current)).catch(() => {});
  }, []);

  /** Sends one request for the first operations in the outbox. */
  const send = useCallback(async (batch: Op[]) => {
    const first = batch[0];
    const config = TABLES[first.list];
    const { error, status } =
      first.type === 'delete'
        ? await supabase.from(config.table).delete().eq(config.idColumn, first.id)
        : await supabase
            .from(config.table)
            .upsert(batch.map((op) => (op as Extract<Op, { type: 'upsert' }>).row), { onConflict: config.conflict });
    if (!error) return { result: 'ok' as const, error: null };
    return { result: classifyFailure(status, error.code), error };
  }, []);

  /**
   * Sends pending changes in order. Stops at the first one that cannot be delivered right now;
   * a change the server refuses is dropped and reported. Resolves to true when nothing is left.
   */
  const flush = useCallback(
    (id: string): Promise<boolean> => {
      if (flushing.current) return flushing.current;
      const run = (async () => {
        let rejected = false;
        while (outbox.current.length > 0) {
          const batch = nextBatch(outbox.current);
          const { result, error } = await send(batch);
          if (result === 'retry') break;
          // Changes queued while the request was in flight are behind the batch, so this is safe.
          outbox.current = outbox.current.slice(batch.length);
          persistOutbox(id);
          if (result === 'rejected') {
            rejected = true;
            console.error('Change rejected by the server:', batch[0].list, error);
            setSyncError(
              isSchemaError(error?.code)
                ? SCHEMA_OUTDATED_MESSAGE
                : 'Máy chủ từ chối một thay đổi nên nó đã được hoàn lại. Hãy kiểm tra và nhập lại.',
            );
          }
        }
        return { empty: outbox.current.length === 0, rejected };
      })();
      const done = run
        .then(({ empty, rejected }) => {
          flushing.current = null;
          // The device copy no longer matches the server after a refusal: take the server's version.
          if (rejected && empty) reload.current?.();
          return empty;
        })
        .catch(() => {
          flushing.current = null;
          return false;
        });
      flushing.current = done;
      return done;
    },
    [persistOutbox, send],
  );

  /** Applies a change on the device and queues it for the server. */
  const commit = useCallback(
    (build: (draft: Draft) => void) => {
      const current = dataRef.current;
      if (!userId || current.owner !== userId) return;
      const draft = new Draft(current, userId);
      build(draft);
      if (draft.data === current) return;
      apply(draft.data);
      if (draft.ops.length === 0) return;
      outbox.current = [...outbox.current, ...draft.ops];
      persistOutbox(userId);
      flush(userId);
    },
    [userId, apply, persistOutbox, flush],
  );

  /** Records every occurrence of automatic recurring rules that has fallen due. */
  const runRecurring = useCallback(() => {
    const today = todayKey();
    commit((d) => {
      for (const rule of d.data.recurring) {
        if (!rule.auto) continue;
        const dates = dueDates(rule, today);
        if (dates.length === 0) continue;
        for (const date of dates) {
          const tx = occurrenceTransaction(rule, date);
          if (d.get('transactions', tx.id)) continue;
          d.local('assets', (assets) => applyTransactionChange(assets, null, tx));
          d.put('transactions', tx);
        }
        d.put('recurring', advanceRule(rule, dates[dates.length - 1]));
      }
    });
  }, [commit]);

  // Load the signed-in user's data: cache first, then the server.
  useEffect(() => {
    if (!userId) {
      apply(EMPTY);
      outbox.current = [];
      setPendingCount(0);
      setLoaded(true);
      reload.current = null;
      return;
    }
    let isMounted = true;
    const id = userId;

    async function fromServer() {
      // Pending changes go first: loading before them would overwrite what the user typed offline.
      const sent = await flush(id);
      if (!isMounted) return;
      if (!sent) {
        setSyncError('Chưa kết nối được máy chủ. Thay đổi của bạn được lưu trên máy và sẽ tự đồng bộ khi có mạng.');
        return;
      }
      try {
        const [assets, transactions, goals] = await Promise.all([
          fetchAll('assets'),
          fetchAll('transactions'),
          fetchAll('goals'),
        ]);
        let next: Data = { ...dataRef.current, owner: id, assets, transactions, goals };
        let schemaOutdated = false;
        // Tables added by later migrations: without them the app still shows the basics.
        const extra = await Promise.all(
          (['budgets', 'recurring', 'categories', 'trades', 'contributions'] as const).map(async (list) => {
            try {
              return [list, await fetchAll(list)] as const;
            } catch (err) {
              if (isSchemaError((err as { code?: string }).code)) schemaOutdated = true;
              else throw err;
              return null;
            }
          }),
        );
        for (const entry of extra) if (entry) next = { ...next, [entry[0]]: entry[1] };

        const snapRes = await supabase
          .from('asset_snapshots')
          .select('*')
          .order('date', { ascending: false })
          .limit(SNAPSHOT_DAYS);
        if (snapRes.error) console.warn('Failed to load asset snapshots:', snapRes.error);
        else next = { ...next, snapshots: mergeSnapshots(next.snapshots, (snapRes.data ?? []).map(toSnapshot)) };

        if (!isMounted) return;
        // Anything queued while loading is newer than what was just fetched; keep the device copy then.
        if (outbox.current.length === 0) apply(next);
        lastLoad.current = Date.now();
        setSyncError(schemaOutdated ? SCHEMA_OUTDATED_MESSAGE : null);
      } catch (err) {
        console.error('Failed to load data:', err);
        if (isMounted) {
          setSyncError('Không tải được dữ liệu từ máy chủ. Đang hiển thị dữ liệu đã lưu trên máy.');
        }
      }
    }

    async function load() {
      setLoaded(false);
      AsyncStorage.multiRemove(legacyKeys(id)).catch(() => {});
      const lists = await Promise.all(LIST_KEYS.map((key) => readCache(cacheKey(key, id))));
      const cached: Data = { ...EMPTY, owner: id };
      LIST_KEYS.forEach((key, i) => ((cached as Record<string, unknown>)[key] = lists[i]));
      cached.snapshots = mergeSnapshots(await readCache<AssetSnapshot>(cacheKey('snapshots', id)));
      outbox.current = await readCache<Op>(cacheKey('outbox', id));
      if (!isMounted) return;
      setPendingCount(outbox.current.length);
      apply(cached);
      // With a cache the app is usable right away; a first sign-in waits for the server.
      const hasCache = cached.assets.length + cached.transactions.length + cached.goals.length > 0;
      if (hasCache) setLoaded(true);
      await fromServer();
      if (!isMounted) return;
      setLoaded(true);
      runRecurring();
    }

    reload.current = async () => {
      await fromServer();
      if (isMounted) runRecurring();
    };
    load();
    return () => {
      isMounted = false;
    };
    // runRecurring changes identity with commit; the load itself only depends on the user.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // Retry pending changes while the app is open, and catch up when it comes back to the front.
  useEffect(() => {
    if (!userId) return;
    const timer = setInterval(() => {
      if (outbox.current.length > 0) flush(userId);
    }, RETRY_MS);
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      if (Date.now() - lastLoad.current > RELOAD_AFTER_MS) reload.current?.();
      else if (outbox.current.length > 0) flush(userId);
      else runRecurring();
    });
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [userId, flush, runRecurring]);

  // Persist to the local cache, but only once the lists belong to the current user.
  const persisted = useRef<Data>(EMPTY);
  useEffect(() => {
    if (!userId || data.owner !== userId) return;
    for (const key of [...LIST_KEYS, 'snapshots'] as const) {
      if (persisted.current[key] === data[key] && persisted.current.owner === userId) continue;
      AsyncStorage.setItem(cacheKey(key, userId), JSON.stringify(data[key])).catch(() => {});
    }
    persisted.current = data;
  }, [userId, data]);

  // Keep today's snapshot in step with the assets; tomorrow it becomes the baseline.
  useEffect(() => {
    if (!loaded || !userId || data.owner !== userId || data.assets.length === 0) return;
    const timer = setTimeout(() => {
      const snap = takeSnapshot(dataRef.current.assets, todayKey());
      const current = dataRef.current.snapshots.find((s) => s.date === snap.date);
      if (current && sameSnapshot(current, snap)) return;
      if (dataRef.current.owner !== userId) return;
      apply({ ...dataRef.current, snapshots: mergeSnapshots(dataRef.current.snapshots, [snap]) });
      supabase
        .from('asset_snapshots')
        .upsert({
          user_id: userId,
          date: snap.date,
          net_worth: snap.netWorth,
          total_assets: snap.totalAssets,
          total_debt: snap.totalDebt,
          amounts: snap.amounts,
          updated_at: new Date().toISOString(),
        })
        .then(({ error }) => {
          if (error) console.warn('Failed to save asset snapshot:', error);
        });
    }, SNAPSHOT_DELAY_MS);
    return () => clearTimeout(timer);
  }, [loaded, userId, data.owner, data.assets, apply]);

  const putTransaction = (d: Draft, tx: Transaction) => {
    const prev = d.get('transactions', tx.id) ?? null;
    d.local('assets', (assets) => applyTransactionChange(assets, prev, tx));
    d.put('transactions', tx);
  };

  const dropTransaction = (d: Draft, id: string | undefined) => {
    const prev = id ? d.get('transactions', id) : undefined;
    if (!prev) return;
    d.local('assets', (assets) => applyTransactionChange(assets, prev, null));
    d.remove('transactions', prev.id);
  };

  const saveAsset = useCallback(
    (asset: Asset) =>
      commit((d) => {
        const prev = d.get('assets', asset.id);
        // The balance of an existing account only moves through transactions (the server applies
        // them itself), so it is left out of the write instead of overwriting the server's value.
        const keepServerAmount = !!prev && !isHolding(prev) && !isHolding(asset);
        if (keepServerAmount && prev.amount !== asset.amount) {
          const adjustment = adjustmentFor(prev, asset.amount, newId(), todayKey());
          d.put('assets', { ...asset, amount: prev.amount }, ['amount']);
          if (adjustment) putTransaction(d, adjustment);
        } else {
          d.put('assets', asset, keepServerAmount ? ['amount'] : []);
        }
      }),
    [commit],
  );

  const deleteAsset = useCallback(
    (id: string) =>
      commit((d) => {
        d.remove('assets', id);
        // The server clears these links through its foreign keys; mirror that on the device.
        const unlink = <T extends { accountId?: string; toAccountId?: string }>(items: T[]) =>
          items.map((x) =>
            x.accountId === id || x.toAccountId === id
              ? {
                  ...x,
                  accountId: x.accountId === id ? undefined : x.accountId,
                  toAccountId: x.toAccountId === id ? undefined : x.toAccountId,
                }
              : x,
          );
        d.local('transactions', unlink);
        d.local('recurring', unlink);
        d.local('contributions', unlink);
        d.local('trades', (trades) => unlink(trades.filter((t) => t.assetId !== id)));
        d.local('goals', (goals) => goals.map((g) => (g.assetId === id ? { ...g, assetId: undefined } : g)));
      }),
    [commit],
  );

  const adjustBalance = useCallback(
    (assetId: string, target: number) =>
      commit((d) => {
        const asset = d.get('assets', assetId);
        const adjustment = asset && adjustmentFor(asset, target, newId(), todayKey());
        if (adjustment) putTransaction(d, adjustment);
      }),
    [commit],
  );

  const saveTransaction = useCallback(
    (tx: Transaction) => commit((d) => putTransaction(d, tx)),
    [commit],
  );

  const saveTransactions = useCallback(
    (list: Transaction[]) => commit((d) => list.forEach((tx) => putTransaction(d, tx))),
    [commit],
  );

  const deleteTransaction = useCallback(
    (id: string) =>
      commit((d) => {
        dropTransaction(d, id);
        // A transfer that belonged to a trade or contribution is gone; forget the link.
        d.local('trades', (trades) => trades.map((t) => (t.transactionId === id ? { ...t, transactionId: undefined } : t)));
        d.local('contributions', (list) =>
          list.map((c) => (c.transactionId === id ? { ...c, transactionId: undefined } : c)),
        );
      }),
    [commit],
  );

  const saveGoal = useCallback((goal: Goal) => commit((d) => d.put('goals', goal)), [commit]);

  const deleteGoal = useCallback(
    (id: string) =>
      commit((d) => {
        d.remove('goals', id);
        d.local('contributions', (list) => list.filter((c) => c.goalId !== id));
      }),
    [commit],
  );

  const contribute = useCallback(
    (goalId: string, amount: number, options: ContributeOptions = {}) =>
      commit((d) => {
        const goal = d.get('goals', goalId);
        if (!goal || amount <= 0) return;
        const date = options.date ?? todayKey();
        const from = options.accountId;
        // Real money only moves when the goal has an account to receive it.
        const moves = !!from && !!goal.assetId && from !== goal.assetId && !!d.get('assets', goal.assetId);
        const transactionId = moves ? newId() : undefined;
        if (moves) {
          putTransaction(d, {
            id: transactionId!,
            kind: 'transfer',
            category: '',
            amount,
            note: `Góp mục tiêu: ${goal.name}`,
            date,
            accountId: from,
            toAccountId: goal.assetId,
          });
        }
        d.put('contributions', { id: newId(), goalId, amount, date, accountId: moves ? from : undefined, transactionId });
        d.put('goals', {
          ...goal,
          saved: goal.saved + amount,
          lastContributedAt:
            goal.lastContributedAt && goal.lastContributedAt > date ? goal.lastContributedAt : date,
          contributionsCount: (goal.contributionsCount ?? 0) + 1,
        });
      }),
    [commit],
  );

  const removeContribution = useCallback(
    (id: string) =>
      commit((d) => {
        const item = d.get('contributions', id);
        if (!item) return;
        d.remove('contributions', id);
        dropTransaction(d, item.transactionId);
        const goal = d.get('goals', item.goalId);
        if (!goal) return;
        const rest = d.data.contributions.filter((c) => c.goalId === goal.id);
        d.put('goals', {
          ...goal,
          saved: Math.max(0, goal.saved - item.amount),
          contributionsCount: Math.max(0, (goal.contributionsCount ?? 1) - 1),
          lastContributedAt: rest.reduce<string | undefined>((latest, c) => (!latest || c.date > latest ? c.date : latest), undefined),
        });
      }),
    [commit],
  );

  const saveBudget = useCallback((budget: Budget) => commit((d) => d.put('budgets', budget)), [commit]);
  const saveBudgets = useCallback(
    (budgets: Budget[]) => commit((d) => budgets.forEach((b) => d.put('budgets', b))),
    [commit],
  );
  const deleteBudget = useCallback((id: string) => commit((d) => d.remove('budgets', id)), [commit]);

  const saveRecurring = useCallback(
    (rule: Recurring) => {
      commit((d) => d.put('recurring', rule));
      runRecurring();
    },
    [commit, runRecurring],
  );
  const deleteRecurring = useCallback((id: string) => commit((d) => d.remove('recurring', id)), [commit]);

  const recordOccurrence = useCallback(
    (ruleId: string, date: string) =>
      commit((d) => {
        const rule = d.get('recurring', ruleId);
        if (!rule) return;
        const tx = occurrenceTransaction(rule, date);
        if (!d.get('transactions', tx.id)) putTransaction(d, tx);
        if (date >= rule.nextDate) d.put('recurring', advanceRule(rule, date));
      }),
    [commit],
  );

  const skipOccurrence = useCallback(
    (ruleId: string, date: string) =>
      commit((d) => {
        const rule = d.get('recurring', ruleId);
        if (rule && date >= rule.nextDate) d.put('recurring', advanceRule(rule, date));
      }),
    [commit],
  );

  const saveCategory = useCallback(
    (category: CustomCategory) => commit((d) => d.put('categories', category)),
    [commit],
  );
  const deleteCategory = useCallback((id: string) => commit((d) => d.remove('categories', id)), [commit]);

  /** Writes the cash side of a trade (or removes it) and returns the trade with its transaction link. */
  const syncTradeCash = (d: Draft, trade: Trade, asset: Asset): Trade => {
    const flow = tradeCashFlow(trade);
    const wallet = trade.accountId ? d.get('assets', trade.accountId) : undefined;
    if (!wallet || flow === 0) {
      dropTransaction(d, trade.transactionId);
      return { ...trade, transactionId: undefined };
    }
    const id = trade.transactionId ?? newId();
    const label = trade.side === 'buy' ? 'Mua' : trade.side === 'sell' ? 'Bán' : 'Cổ tức';
    putTransaction(d, {
      id,
      kind: 'transfer',
      category: '',
      amount: Math.abs(flow),
      note: `${label} ${asset.symbol ?? asset.name}`,
      date: trade.date,
      ...(flow < 0 ? { accountId: wallet.id, toAccountId: asset.id } : { accountId: asset.id, toAccountId: wallet.id }),
    });
    return { ...trade, transactionId: id };
  };

  const saveTrade = useCallback(
    (trade: Trade) =>
      commit((d) => {
        const asset = d.get('assets', trade.assetId);
        if (!asset) return;
        const existing = d.data.trades.filter((t) => t.assetId === asset.id);
        // A holding entered before trades existed keeps its units as an opening purchase.
        if (existing.length === 0 && (asset.quantity ?? 0) > 0) {
          d.put('trades', {
            id: newId(),
            assetId: asset.id,
            side: 'buy',
            date: trade.date < todayKey() ? trade.date : todayKey(),
            quantity: asset.quantity!,
            price: asset.price ?? 0,
            fee: 0,
            note: 'Số dư ban đầu',
          });
        }
        d.put('trades', syncTradeCash(d, trade, asset));
        d.put('assets', withPosition(d.get('assets', asset.id)!, d.data.trades));
      }),
    [commit],
  );

  const deleteTrade = useCallback(
    (id: string) =>
      commit((d) => {
        const trade = d.get('trades', id);
        if (!trade) return;
        dropTransaction(d, trade.transactionId);
        d.remove('trades', id);
        const asset = d.get('assets', trade.assetId);
        const rest = d.data.trades.filter((t) => t.assetId === trade.assetId);
        if (asset && rest.length > 0) d.put('assets', withPosition(asset, d.data.trades));
      }),
    [commit],
  );

  const refreshMarketPrices = useCallback(async () => {
    setPricesRefreshing(true);
    try {
      const { updated, missing } = await refreshPrices(dataRef.current.assets);
      commit((d) => {
        // The user may have edited or deleted a holding while prices were loading:
        // apply each price to the latest version, and skip holdings that changed.
        for (const u of updated) {
          const current = d.get('assets', u.id);
          if (!current || current.symbol !== u.symbol || current.quantity !== u.quantity) continue;
          d.put('assets', {
            ...current,
            price: u.price,
            priceUpdatedAt: u.priceUpdatedAt,
            amount: u.amount,
            updatedAt: u.updatedAt,
          });
        }
      });
      return missing;
    } finally {
      setPricesRefreshing(false);
    }
  }, [commit]);

  // Keep holdings at market value: refresh after loading, after a holding changes, and periodically.
  // Automatic refreshes are spaced out so a symbol with no price can't cause a refresh loop.
  const lastAutoRefresh = useRef(0);
  const holdingsKey = data.assets
    .filter((a) => a.symbol && a.quantity)
    .map((a) => `${a.id}:${a.symbol}:${a.quantity}:${a.priceMode ?? ''}`)
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

  const clearDevice = useCallback((id: string) => {
    AsyncStorage.multiRemove([...LIST_KEYS, 'snapshots' as const, 'outbox' as const].map((k) => cacheKey(k, id))).catch(
      () => {},
    );
  }, []);

  const signOut = useCallback(async () => {
    const id = userId;
    if (id) await flush(id).catch(() => false);
    await supabase.auth.signOut();
    // Don't leave a signed-out user's financial data on the device.
    if (id) clearDevice(id);
  }, [userId, flush, clearDevice]);

  const deleteAccount = useCallback(async () => {
    const id = userId;
    if (!id) return 'Bạn chưa đăng nhập.';
    const { error } = await supabase.rpc('delete_my_account');
    if (error) {
      console.error('delete_my_account failed:', error);
      return isSchemaError(error.code)
        ? SCHEMA_OUTDATED_MESSAGE
        : 'Không xoá được tài khoản. Hãy kiểm tra kết nối và thử lại.';
    }
    outbox.current = [];
    clearDevice(id);
    await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
    return null;
  }, [userId, clearDevice]);

  const syncNow = useCallback(async () => {
    await reload.current?.();
  }, []);

  const today = todayKey();
  const baseline = useMemo(() => previousSnapshot(data.snapshots, today), [data.snapshots, today]);
  const categories = useMemo(() => mergeCategories(data.categories), [data.categories]);

  const value = useMemo<Store>(
    () => ({
      loaded,
      user,
      session,
      assets: data.assets,
      transactions: data.transactions,
      goals: data.goals,
      budgets: data.budgets,
      recurring: data.recurring,
      categories,
      customCategories: data.categories,
      trades: data.trades,
      contributions: data.contributions,
      snapshots: data.snapshots,
      baseline,
      pendingCount,
      syncError,
      dismissSyncError: () => setSyncError(null),
      syncNow,
      saveAsset,
      deleteAsset,
      adjustBalance,
      saveTransaction,
      saveTransactions,
      deleteTransaction,
      saveGoal,
      deleteGoal,
      contribute,
      removeContribution,
      saveBudget,
      saveBudgets,
      deleteBudget,
      saveRecurring,
      deleteRecurring,
      recordOccurrence,
      skipOccurrence,
      saveCategory,
      deleteCategory,
      saveTrade,
      deleteTrade,
      refreshMarketPrices,
      pricesRefreshing,
      signOut,
      deleteAccount,
    }),
    // `user` is tracked via userId: a refreshed token must not re-render consumers needlessly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      loaded,
      userId,
      session,
      data,
      categories,
      baseline,
      pendingCount,
      syncError,
      syncNow,
      saveAsset,
      deleteAsset,
      adjustBalance,
      saveTransaction,
      saveTransactions,
      deleteTransaction,
      saveGoal,
      deleteGoal,
      contribute,
      removeContribution,
      saveBudget,
      saveBudgets,
      deleteBudget,
      saveRecurring,
      deleteRecurring,
      recordOccurrence,
      skipOccurrence,
      saveCategory,
      deleteCategory,
      saveTrade,
      deleteTrade,
      refreshMarketPrices,
      pricesRefreshing,
      signOut,
      deleteAccount,
    ],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const store = useContext(StoreContext);
  if (!store) throw new Error('useStore must be used inside StoreProvider');
  return store;
}
