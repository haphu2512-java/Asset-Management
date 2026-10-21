export type CategoryId = 'cash' | 'stock' | 'crypto' | 'lent' | 'debt';

export type Category = {
  id: CategoryId;
  label: string;
  color: string;
  /** Debts reduce net worth instead of adding to it. */
  isLiability: boolean;
};

export const CATEGORIES: Category[] = [
  { id: 'cash', label: 'Tiền mặt', color: '#2E7D32', isLiability: false },
  { id: 'stock', label: 'Cổ phiếu', color: '#1565C0', isLiability: false },
  { id: 'crypto', label: 'Crypto', color: '#F9A825', isLiability: false },
  { id: 'lent', label: 'Cho vay', color: '#6A1B9A', isLiability: false },
  { id: 'debt', label: 'Đang nợ', color: '#C62828', isLiability: true },
];

export function getCategory(id: CategoryId): Category {
  return CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[0];
}

export type Asset = {
  id: string;
  name: string;
  category: CategoryId;
  /** Amount in VND, always a non-negative integer. */
  amount: number;
  updatedAt: string;
};

export type Summary = {
  totalAssets: number;
  totalDebt: number;
  netWorth: number;
  byCategory: { category: Category; amount: number }[];
};

export function summarize(assets: Asset[]): Summary {
  const byCategory = CATEGORIES.map((category) => ({
    category,
    amount: assets
      .filter((a) => a.category === category.id)
      .reduce((sum, a) => sum + a.amount, 0),
  }));
  const totalAssets = byCategory
    .filter((c) => !c.category.isLiability)
    .reduce((sum, c) => sum + c.amount, 0);
  const totalDebt = byCategory
    .filter((c) => c.category.isLiability)
    .reduce((sum, c) => sum + c.amount, 0);
  return { totalAssets, totalDebt, netWorth: totalAssets - totalDebt, byCategory };
}

/** Formats 23000000 as "23.000.000 ₫" (Vietnamese grouping). */
export function formatVnd(amount: number): string {
  return `${formatDigits(amount)} ₫`;
}

/** Groups digits with dots, keeping a leading minus sign. */
export function formatDigits(amount: number): string {
  const sign = amount < 0 ? '-' : '';
  const digits = Math.round(Math.abs(amount)).toString();
  return sign + digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/**
 * Parses user input into VND. Accepts "23.000.000", "23000000",
 * and shorthand suffixes: "23000k" or "23tr" / "23m" (millions), "1ty" / "1b" (billions).
 * Returns null when the input is not a valid amount.
 */
export function parseVnd(input: string): number | null {
  const text = input.trim().toLowerCase().replace(/\s+/g, '');
  const match = text.match(/^([\d.,]+)(k|tr|m|ty|tỷ|b)?$/);
  if (!match) return null;
  const [, numberPart, suffix] = match;
  const multiplier =
    suffix === 'k' ? 1e3 : suffix === 'tr' || suffix === 'm' ? 1e6 : suffix ? 1e9 : 1;

  let value: number;
  if (suffix) {
    // With a suffix, a lone separator not followed by exactly three digits is a
    // decimal point ("1,5tr" = 1.500.000), otherwise it groups thousands ("23.000k").
    const isDecimal = /^\d+[.,](\d{1,2}|\d{4,})$/.test(numberPart);
    value = isDecimal
      ? Number(numberPart.replace(',', '.'))
      : Number(numberPart.replace(/[.,]/g, ''));
  } else {
    value = Number(numberPart.replace(/[.,]/g, ''));
  }
  if (!Number.isFinite(value) || numberPart.replace(/[.,]/g, '') === '') return null;
  return Math.round(value * multiplier);
}

export type TransactionKind = 'income' | 'expense';

export type TransactionCategory = {
  id: string;
  label: string;
  kind: TransactionKind;
  color: string;
};

export const TRANSACTION_CATEGORIES: TransactionCategory[] = [
  { id: 'salary', label: 'Lương', kind: 'income', color: '#2E7D32' },
  { id: 'bonus', label: 'Thưởng', kind: 'income', color: '#558B2F' },
  { id: 'investment', label: 'Đầu tư', kind: 'income', color: '#00838F' },
  { id: 'other-income', label: 'Thu khác', kind: 'income', color: '#5D4037' },
  { id: 'food', label: 'Ăn uống', kind: 'expense', color: '#EF6C00' },
  { id: 'transport', label: 'Đi lại', kind: 'expense', color: '#1565C0' },
  { id: 'housing', label: 'Nhà ở', kind: 'expense', color: '#6A1B9A' },
  { id: 'bills', label: 'Hoá đơn', kind: 'expense', color: '#AD1457' },
  { id: 'shopping', label: 'Mua sắm', kind: 'expense', color: '#F9A825' },
  { id: 'entertainment', label: 'Giải trí', kind: 'expense', color: '#00897B' },
  { id: 'health', label: 'Sức khoẻ', kind: 'expense', color: '#C62828' },
  { id: 'education', label: 'Học tập', kind: 'expense', color: '#3949AB' },
  { id: 'other-expense', label: 'Chi khác', kind: 'expense', color: '#757575' },
];

export function getTransactionCategory(id: string): TransactionCategory {
  return (
    TRANSACTION_CATEGORIES.find((c) => c.id === id) ??
    TRANSACTION_CATEGORIES[TRANSACTION_CATEGORIES.length - 1]
  );
}

export type Transaction = {
  id: string;
  kind: TransactionKind;
  category: string;
  /** Amount in VND, always a positive integer. */
  amount: number;
  note: string;
  /** Local calendar date, "YYYY-MM-DD". */
  date: string;
};

/** "YYYY-MM" for a "YYYY-MM-DD" date or a Date. */
export function monthKey(date: string | Date): string {
  if (typeof date === 'string') return date.slice(0, 7);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function todayKey(now = new Date()): string {
  return `${monthKey(now)}-${String(now.getDate()).padStart(2, '0')}`;
}

/** Shifts a "YYYY-MM" key by a number of months. */
export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  return monthKey(new Date(y, m - 1 + delta, 1));
}

export function formatMonth(month: string): string {
  const [y, m] = month.split('-');
  return `Tháng ${Number(m)}/${y}`;
}

export type MonthSummary = {
  month: string;
  income: number;
  expense: number;
  balance: number;
  /** Expense categories with spending, largest first. */
  expenseByCategory: { category: TransactionCategory; amount: number }[];
};

export function summarizeMonth(transactions: Transaction[], month: string): MonthSummary {
  const inMonth = transactions.filter((t) => monthKey(t.date) === month);
  const sum = (kind: TransactionKind) =>
    inMonth.filter((t) => t.kind === kind).reduce((s, t) => s + t.amount, 0);
  const income = sum('income');
  const expense = sum('expense');
  const expenseByCategory = TRANSACTION_CATEGORIES.filter((c) => c.kind === 'expense')
    .map((category) => ({
      category,
      amount: inMonth
        .filter((t) => t.kind === 'expense' && t.category === category.id)
        .reduce((s, t) => s + t.amount, 0),
    }))
    .filter((c) => c.amount > 0)
    .sort((a, b) => b.amount - a.amount);
  return { month, income, expense, balance: income - expense, expenseByCategory };
}
