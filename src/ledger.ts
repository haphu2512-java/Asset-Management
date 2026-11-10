import {
  getCategory,
  getTransactionCategory,
  isHolding,
  type Asset,
  type Transaction,
  type TransactionCategory,
} from './finance.ts';

/**
 * Money flowing into (+) or out of (−) each account because of one transaction.
 * The database applies the same rule in the `apply_transaction_to_accounts` trigger.
 */
export function transactionFlows(tx: Transaction): Record<string, number> {
  const flows: Record<string, number> = {};
  const add = (id: string | undefined, amount: number) => {
    if (id) flows[id] = (flows[id] ?? 0) + amount;
  };
  if (tx.kind === 'income') add(tx.accountId, tx.amount);
  else if (tx.kind === 'expense') add(tx.accountId, -tx.amount);
  else {
    add(tx.accountId, -tx.amount);
    add(tx.toAccountId, tx.amount);
  }
  return flows;
}

/**
 * Account balances after replacing transaction `prev` with `next` (either may be null for
 * add / delete). Money flowing into a debt reduces it; holdings valued by price are left alone.
 */
export function applyTransactionChange(
  assets: Asset[],
  prev: Transaction | null,
  next: Transaction | null,
): Asset[] {
  const net: Record<string, number> = {};
  for (const [id, flow] of Object.entries(prev ? transactionFlows(prev) : {})) net[id] = (net[id] ?? 0) - flow;
  for (const [id, flow] of Object.entries(next ? transactionFlows(next) : {})) net[id] = (net[id] ?? 0) + flow;
  return assets.map((a) => {
    const flow = net[a.id];
    if (!flow || isHolding(a)) return a;
    const sign = getCategory(a.category).isLiability ? -1 : 1;
    return { ...a, amount: a.amount + sign * flow };
  });
}

/** True for a transfer with only one side: a manual correction of a wallet's balance. */
export function isAdjustment(tx: Transaction): boolean {
  return tx.kind === 'transfer' && (!tx.accountId || !tx.toAccountId);
}

/** The transfer that brings an account from its current balance to `target`; null when nothing changes. */
export function adjustmentFor(
  asset: Asset,
  target: number,
  id: string,
  date: string,
): Transaction | null {
  const diff = Math.round(target - asset.amount);
  if (diff === 0) return null;
  // For a debt, a higher balance means money flowed out of the account.
  const inflow = getCategory(asset.category).isLiability ? -diff : diff;
  return {
    id,
    kind: 'transfer',
    category: '',
    amount: Math.abs(diff),
    note: 'Điều chỉnh số dư',
    date,
    ...(inflow > 0 ? { toAccountId: asset.id } : { accountId: asset.id }),
  };
}

/** Short title of a transaction for lists: its note, or what kind of movement it is. */
export function transactionTitle(
  tx: Transaction,
  assets: Asset[],
  categories?: TransactionCategory[],
): string {
  if (tx.note) return tx.note;
  if (tx.kind !== 'transfer') return getTransactionCategory(tx.category, categories).label;
  if (isAdjustment(tx)) return 'Điều chỉnh số dư';
  const to = assets.find((a) => a.id === tx.toAccountId);
  return to ? `Chuyển đến ${to.name}` : 'Chuyển khoản';
}

/** "Tiền mặt → Vietcombank" for transfers, the wallet name otherwise; empty when no account is set. */
export function transactionAccounts(tx: Transaction, assets: Asset[]): string {
  const name = (id?: string) => assets.find((a) => a.id === id)?.name;
  const from = name(tx.accountId);
  const to = name(tx.toAccountId);
  if (tx.kind === 'transfer') return from && to ? `${from} → ${to}` : (from ?? to ?? '');
  return from ?? '';
}

/** Transactions that touch an account, newest first. */
export function accountTransactions(transactions: Transaction[], accountId: string): Transaction[] {
  return transactions
    .filter((t) => t.accountId === accountId || t.toAccountId === accountId)
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
}

/** Signed effect of a transaction on one account's money (+ in, − out). */
export function flowFor(tx: Transaction, accountId: string): number {
  return transactionFlows(tx)[accountId] ?? 0;
}

/** Lower-cases and strips Vietnamese diacritics, so "ca phe" finds "Cà phê". */
export function foldText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

export type TransactionFilter = {
  /** Matches the note, the category label and the account names. */
  query?: string;
  kind?: Transaction['kind'];
  /** Top-level or sub-category ids; a parent id also matches its sub-categories. */
  categoryIds?: string[];
  accountId?: string;
  min?: number;
  max?: number;
  /** Inclusive "YYYY-MM-DD" bounds. */
  from?: string;
  to?: string;
};

export function filterTransactions(
  transactions: Transaction[],
  filter: TransactionFilter,
  categories: TransactionCategory[],
  assets: Asset[] = [],
): Transaction[] {
  const query = filter.query ? foldText(filter.query.trim()) : '';
  const wanted = filter.categoryIds?.length ? new Set(filter.categoryIds) : null;
  return transactions
    .filter((t) => {
      if (filter.kind && t.kind !== filter.kind) return false;
      if (filter.accountId && t.accountId !== filter.accountId && t.toAccountId !== filter.accountId) return false;
      if (filter.min != null && t.amount < filter.min) return false;
      if (filter.max != null && t.amount > filter.max) return false;
      if (filter.from && t.date < filter.from) return false;
      if (filter.to && t.date > filter.to) return false;
      const category = t.kind === 'transfer' ? null : getTransactionCategory(t.category, categories);
      if (wanted && !(category && (wanted.has(category.id) || (category.parentId && wanted.has(category.parentId))))) {
        return false;
      }
      if (query) {
        const haystack = foldText(
          [t.note, category?.label ?? 'chuyển khoản', transactionAccounts(t, assets)].join(' '),
        );
        if (!haystack.includes(query)) return false;
      }
      return true;
    })
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
}

/** Notes used most often for a category, to offer as one-tap suggestions. */
export function suggestNotes(transactions: Transaction[], category: string, limit = 4): string[] {
  const counts = new Map<string, number>();
  for (const t of transactions) {
    if (t.category !== category || !t.note || t.recurringId) continue;
    counts.set(t.note, (counts.get(t.note) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([note]) => note);
}
