import {
  monthKey,
  shiftDay,
  shiftMonth,
  summarizeMonth,
  type AssetSnapshot,
  type Transaction,
  type TransactionCategory,
} from './finance.ts';

export type CategoryComparison = {
  category: TransactionCategory;
  current: number;
  previous: number;
  /** current − previous. */
  change: number;
  /** Change relative to the previous month in percent; null when there was no spending then. */
  percent: number | null;
};

/** Spending per top-level category this month against the month before, biggest movers first. */
export function compareMonths(
  transactions: Transaction[],
  month: string,
  categories: TransactionCategory[],
): CategoryComparison[] {
  const current = summarizeMonth(transactions, month, categories);
  const previous = summarizeMonth(transactions, shiftMonth(month, -1), categories);
  const ids = new Set([
    ...current.expenseByCategory.map((c) => c.category.id),
    ...previous.expenseByCategory.map((c) => c.category.id),
  ]);
  return [...ids]
    .map((id) => {
      const cur = current.expenseByCategory.find((c) => c.category.id === id);
      const prev = previous.expenseByCategory.find((c) => c.category.id === id);
      const a = cur?.amount ?? 0;
      const b = prev?.amount ?? 0;
      return {
        category: (cur ?? prev)!.category,
        current: a,
        previous: b,
        change: a - b,
        percent: b > 0 ? ((a - b) / b) * 100 : null,
      };
    })
    .sort((x, y) => Math.abs(y.change) - Math.abs(x.change));
}

export type YearReport = {
  year: number;
  income: number;
  expense: number;
  balance: number;
  /** Share of income kept, in percent; null without income. */
  savingsRate: number | null;
  /** One entry per month, January first. */
  months: { month: string; income: number; expense: number }[];
  /** Month with the highest spending; null when nothing was spent. */
  topMonth: { month: string; expense: number } | null;
  expenseByCategory: { category: TransactionCategory; amount: number }[];
};

export function yearReport(
  transactions: Transaction[],
  year: number,
  categories: TransactionCategory[],
): YearReport {
  const months = Array.from({ length: 12 }, (_, i) => {
    const month = `${year}-${String(i + 1).padStart(2, '0')}`;
    const s = summarizeMonth(transactions, month, categories);
    return { month, income: s.income, expense: s.expense, byCategory: s.expenseByCategory };
  });
  const income = months.reduce((s, m) => s + m.income, 0);
  const expense = months.reduce((s, m) => s + m.expense, 0);
  const totals = new Map<string, { category: TransactionCategory; amount: number }>();
  for (const m of months) {
    for (const c of m.byCategory) {
      const entry = totals.get(c.category.id) ?? { category: c.category, amount: 0 };
      entry.amount += c.amount;
      totals.set(c.category.id, entry);
    }
  }
  const top = months.reduce((best, m) => (m.expense > best.expense ? m : best), months[0]);
  return {
    year,
    income,
    expense,
    balance: income - expense,
    savingsRate: income > 0 ? ((income - expense) / income) * 100 : null,
    months: months.map(({ month, income, expense }) => ({ month, income, expense })),
    topMonth: top.expense > 0 ? { month: top.month, expense: top.expense } : null,
    expenseByCategory: [...totals.values()].sort((a, b) => b.amount - a.amount),
  };
}

export type SeriesPoint = { date: string; value: number };

/** Net worth per recorded day within the last `days` days, oldest first. */
export function netWorthSeries(snapshots: AssetSnapshot[], today: string, days: number): SeriesPoint[] {
  const from = shiftDay(today, -days);
  return snapshots
    .filter((s) => s.date >= from && s.date <= today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((s) => ({ date: s.date, value: s.netWorth }));
}

/** Years that have transactions, newest first; the current year is always included. */
export function reportYears(transactions: Transaction[], today: string): number[] {
  const years = new Set([Number(today.slice(0, 4))]);
  for (const t of transactions) years.add(Number(monthKey(t.date).slice(0, 4)));
  return [...years].sort((a, b) => b - a);
}

/** Compact amount for chart axes: 1,2 tỷ · 35tr · 500k. */
export function formatCompact(amount: number): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';
  const trim = (n: number) => n.toFixed(n >= 100 ? 0 : 1).replace(/\.0$/, '').replace('.', ',');
  if (abs >= 1e9) return `${sign}${trim(abs / 1e9)} tỷ`;
  if (abs >= 1e6) return `${sign}${trim(abs / 1e6)}tr`;
  if (abs >= 1e3) return `${sign}${Math.round(abs / 1e3)}k`;
  return `${sign}${Math.round(abs)}`;
}
