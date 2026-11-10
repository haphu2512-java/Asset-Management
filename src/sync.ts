import type { Budget } from './budgets.ts';
import type {
  Asset,
  AssetSnapshot,
  CategoryId,
  CustomCategory,
  Goal,
  GoalContribution,
  Transaction,
} from './finance.ts';
import type { Trade } from './investments.ts';
import type { Recurring } from './recurring.ts';

/** Everything the app keeps for one user, mirrored between the device cache and Supabase. */
export type Data = {
  /** User id the lists belong to; null until that user's data has been loaded. */
  owner: string | null;
  assets: Asset[];
  transactions: Transaction[];
  goals: Goal[];
  budgets: Budget[];
  recurring: Recurring[];
  /** The user's own categories and overrides of built-in ones. */
  categories: CustomCategory[];
  trades: Trade[];
  contributions: GoalContribution[];
  /** Daily snapshots, newest first. */
  snapshots: AssetSnapshot[];
};

export const EMPTY: Data = {
  owner: null,
  assets: [],
  transactions: [],
  goals: [],
  budgets: [],
  recurring: [],
  categories: [],
  trades: [],
  contributions: [],
  snapshots: [],
};

/** Lists that are synced row by row through the outbox. */
export type ListKey = 'assets' | 'transactions' | 'goals' | 'budgets' | 'recurring' | 'categories' | 'trades' | 'contributions';

export const LIST_KEYS: ListKey[] = [
  'assets',
  'transactions',
  'goals',
  'budgets',
  'recurring',
  'categories',
  'trades',
  'contributions',
];

type Row = Record<string, unknown>;
type Item<K extends ListKey> = Data[K][number];

type TableConfig<K extends ListKey> = {
  table: string;
  /** Columns that identify a row for upserts. */
  conflict: string;
  /** Column matched against the item id when deleting. */
  idColumn: string;
  /** Column to order by when loading. */
  order: string;
  toRow: (item: Item<K>, userId: string) => Row;
  fromRow: (row: any) => Item<K>;
};

const num = (value: unknown): number | undefined => (value == null ? undefined : Number(value));
const text = (value: unknown): string | undefined => (value == null || value === '' ? undefined : String(value));

export const TABLES: { [K in ListKey]: TableConfig<K> } = {
  assets: {
    table: 'assets',
    conflict: 'id',
    idColumn: 'id',
    order: 'updated_at',
    toRow: (a, userId) => ({
      id: a.id,
      user_id: userId,
      name: a.name,
      category: a.category,
      amount: a.amount,
      updated_at: a.updatedAt,
      symbol: a.symbol ?? null,
      quantity: a.quantity ?? null,
      price: a.price ?? null,
      price_updated_at: a.priceUpdatedAt ?? null,
      price_mode: a.priceMode ?? null,
      interest_rate: a.interestRate ?? null,
      start_date: a.startDate ?? null,
      due_date: a.dueDate ?? null,
      counterparty: a.counterparty ?? null,
      note: a.note ?? null,
    }),
    fromRow: (row): Asset => ({
      id: row.id,
      name: row.name,
      category: row.category as CategoryId,
      amount: Number(row.amount) || 0,
      updatedAt: row.updated_at,
      symbol: text(row.symbol),
      quantity: num(row.quantity),
      price: num(row.price),
      priceUpdatedAt: text(row.price_updated_at),
      priceMode: text(row.price_mode) as Asset['priceMode'],
      interestRate: num(row.interest_rate),
      startDate: text(row.start_date),
      dueDate: text(row.due_date),
      counterparty: text(row.counterparty),
      note: text(row.note),
    }),
  },
  transactions: {
    table: 'transactions',
    conflict: 'id',
    idColumn: 'id',
    order: 'date',
    toRow: (t, userId) => ({
      id: t.id,
      user_id: userId,
      kind: t.kind,
      category: t.category,
      amount: t.amount,
      note: t.note,
      date: t.date,
      account_id: t.accountId ?? null,
      to_account_id: t.toAccountId ?? null,
      recurring_id: t.recurringId ?? null,
    }),
    fromRow: (row): Transaction => ({
      id: row.id,
      kind: row.kind,
      category: row.category ?? '',
      amount: Number(row.amount) || 0,
      note: row.note || '',
      date: row.date,
      accountId: text(row.account_id),
      toAccountId: text(row.to_account_id),
      recurringId: text(row.recurring_id),
    }),
  },
  goals: {
    table: 'goals',
    conflict: 'id',
    idColumn: 'id',
    order: 'created_at',
    toRow: (g, userId) => ({
      id: g.id,
      user_id: userId,
      name: g.name,
      target: g.target,
      saved: g.saved,
      deadline: g.deadline,
      type: g.type ?? 'target_amount',
      category: g.category ?? 'saving',
      recurring_amount: g.recurringAmount ?? null,
      frequency: g.frequency ?? 'monthly',
      last_contributed_at: g.lastContributedAt ?? null,
      contributions_count: g.contributionsCount ?? 0,
      asset_id: g.assetId ?? null,
    }),
    fromRow: (row): Goal => ({
      id: row.id,
      name: row.name,
      target: Number(row.target) || 0,
      saved: Number(row.saved) || 0,
      deadline: row.deadline,
      type: row.type ?? (row.recurring_amount ? 'recurring' : 'target_amount'),
      category: row.category ?? 'saving',
      recurringAmount: num(row.recurring_amount),
      frequency: row.frequency ?? 'monthly',
      lastContributedAt: text(row.last_contributed_at),
      contributionsCount: num(row.contributions_count),
      assetId: text(row.asset_id),
    }),
  },
  budgets: {
    table: 'budgets',
    conflict: 'user_id,category',
    idColumn: 'category',
    order: 'category',
    toRow: (b, userId) => ({ user_id: userId, category: b.category, amount: b.amount }),
    fromRow: (row): Budget => ({ id: row.category, category: row.category, amount: Number(row.amount) || 0 }),
  },
  recurring: {
    table: 'recurring_transactions',
    conflict: 'id',
    idColumn: 'id',
    order: 'created_at',
    toRow: (r, userId) => ({
      id: r.id,
      user_id: userId,
      kind: r.kind,
      category: r.category,
      amount: r.amount,
      note: r.note,
      account_id: r.accountId ?? null,
      to_account_id: r.toAccountId ?? null,
      frequency: r.frequency,
      start_date: r.startDate,
      next_date: r.nextDate,
      end_date: r.endDate ?? null,
      auto: r.auto,
      active: r.active,
    }),
    fromRow: (row): Recurring => ({
      id: row.id,
      kind: row.kind,
      category: row.category ?? '',
      amount: Number(row.amount) || 0,
      note: row.note || '',
      accountId: text(row.account_id),
      toAccountId: text(row.to_account_id),
      frequency: row.frequency,
      startDate: row.start_date,
      nextDate: row.next_date,
      endDate: text(row.end_date),
      auto: row.auto !== false,
      active: row.active !== false,
    }),
  },
  categories: {
    table: 'categories',
    conflict: 'user_id,id',
    idColumn: 'id',
    order: 'created_at',
    toRow: (c, userId) => ({
      user_id: userId,
      id: c.id,
      kind: c.kind,
      label: c.label,
      color: c.color,
      icon: c.icon ?? null,
      parent_id: c.parentId ?? null,
      hidden: !!c.hidden,
    }),
    fromRow: (row): CustomCategory => ({
      id: row.id,
      kind: row.kind,
      label: row.label,
      color: row.color,
      icon: text(row.icon),
      parentId: text(row.parent_id),
      hidden: !!row.hidden,
    }),
  },
  trades: {
    table: 'asset_trades',
    conflict: 'id',
    idColumn: 'id',
    order: 'date',
    toRow: (t, userId) => ({
      id: t.id,
      user_id: userId,
      asset_id: t.assetId,
      side: t.side,
      date: t.date,
      quantity: t.quantity,
      price: t.price,
      fee: t.fee,
      note: t.note ?? null,
      account_id: t.accountId ?? null,
      transaction_id: t.transactionId ?? null,
    }),
    fromRow: (row): Trade => ({
      id: row.id,
      assetId: row.asset_id,
      side: row.side,
      date: row.date,
      quantity: Number(row.quantity) || 0,
      price: Number(row.price) || 0,
      fee: Number(row.fee) || 0,
      note: text(row.note),
      accountId: text(row.account_id),
      transactionId: text(row.transaction_id),
    }),
  },
  contributions: {
    table: 'goal_contributions',
    conflict: 'id',
    idColumn: 'id',
    order: 'date',
    toRow: (c, userId) => ({
      id: c.id,
      user_id: userId,
      goal_id: c.goalId,
      amount: c.amount,
      date: c.date,
      account_id: c.accountId ?? null,
      transaction_id: c.transactionId ?? null,
    }),
    fromRow: (row): GoalContribution => ({
      id: row.id,
      goalId: row.goal_id,
      amount: Number(row.amount) || 0,
      date: row.date,
      accountId: text(row.account_id),
      transactionId: text(row.transaction_id),
    }),
  },
};

/** A change waiting to be sent to the server. */
export type Op =
  | { list: ListKey; type: 'upsert'; row: Row }
  | { list: ListKey; type: 'delete'; id: string };

/** Records changes to the lists and the matching server operations in one go. */
export class Draft {
  data: Data;
  ops: Op[] = [];
  private userId: string;

  constructor(data: Data, userId: string) {
    this.data = data;
    this.userId = userId;
  }

  get<K extends ListKey>(list: K, id: string): Item<K> | undefined {
    return (this.data[list] as { id: string }[]).find((x) => x.id === id) as Item<K> | undefined;
  }

  /** Adds or replaces an item. `omit` leaves columns out of the server write (they keep their server value). */
  put<K extends ListKey>(list: K, item: Item<K>, omit: string[] = []): void {
    const items = this.data[list] as { id: string }[];
    const exists = items.some((x) => x.id === item.id);
    const next = exists ? items.map((x) => (x.id === item.id ? item : x)) : [...items, item];
    this.data = { ...this.data, [list]: next };
    const row = TABLES[list].toRow(item, this.userId);
    for (const column of omit) delete row[column];
    this.ops.push({ list, type: 'upsert', row });
  }

  remove(list: ListKey, id: string): void {
    const items = this.data[list] as { id: string }[];
    if (!items.some((x) => x.id === id)) return;
    this.data = { ...this.data, [list]: items.filter((x) => x.id !== id) };
    this.ops.push({ list, type: 'delete', id });
  }

  /** Changes the device copy only, for effects the server applies by itself (triggers, cascades). */
  local<K extends ListKey>(list: K, update: (items: Data[K]) => Data[K]): void {
    this.data = { ...this.data, [list]: update(this.data[list]) };
  }
}

/** Largest group of rows sent in one request. */
const MAX_BATCH = 100;

/**
 * The next request to send: the first operation, plus the upserts to the same table that
 * directly follow it (so an import of hundreds of rows is a handful of requests). Rows in one
 * request must have the same columns, or PostgREST would null the missing ones.
 */
export function nextBatch(queue: Op[]): Op[] {
  const first = queue[0];
  if (!first) return [];
  if (first.type === 'delete') return [first];
  const columns = Object.keys(first.row).sort().join();
  const batch: Op[] = [];
  const seen = new Set<string>();
  for (const op of queue) {
    if (batch.length >= MAX_BATCH || op.type !== 'upsert' || op.list !== first.list) break;
    if (Object.keys(op.row).sort().join() !== columns) break;
    // The same row twice in one statement is an error in Postgres; send the later version separately.
    const key = TABLES[op.list].conflict.split(',').map((c) => String(op.row[c])).join('|');
    if (seen.has(key)) break;
    seen.add(key);
    batch.push(op);
  }
  return batch;
}

export type SendResult = 'ok' | 'retry' | 'rejected';

/**
 * Whether a failed write should be retried later (no network, server down, expired session)
 * or given up on (the server understood the request and refused it).
 */
export function classifyFailure(status: number, code: string | undefined): SendResult {
  if (status === 0 || status === 401 || status === 408 || status === 429 || status >= 500) return 'retry';
  return code ? 'rejected' : 'retry';
}

/** Postgres / PostgREST codes that mean the database is missing a table, column or function. */
export function isSchemaError(code: string | undefined): boolean {
  return !!code && ['42P01', '42703', '42883', 'PGRST204', 'PGRST205', 'PGRST202'].includes(code);
}
