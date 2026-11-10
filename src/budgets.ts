import {
  shiftMonth,
  summarizeMonth,
  type MonthSummary,
  type Transaction,
  type TransactionCategory,
} from './finance.ts';

/** A monthly spending limit for one top-level expense category. */
export type Budget = {
  id: string;
  category: string;
  /** Limit per month in VND. */
  amount: number;
};

export type BudgetLevel = 'ok' | 'warn' | 'over';

export type BudgetStatus = {
  budget: Budget;
  category: TransactionCategory;
  spent: number;
  remaining: number;
  /** Share of the limit already spent; can exceed 1. */
  ratio: number;
  level: BudgetLevel;
};

/** Share of the limit at which the user is warned. */
export const BUDGET_WARN_RATIO = 0.8;

export function budgetLevel(spent: number, limit: number): BudgetLevel {
  if (limit <= 0) return 'ok';
  const ratio = spent / limit;
  return ratio >= 1 ? 'over' : ratio >= BUDGET_WARN_RATIO ? 'warn' : 'ok';
}

/** How each budget is doing in a month, most used first. Budgets of deleted categories are skipped. */
export function budgetStatuses(
  budgets: Budget[],
  summary: MonthSummary,
  categories: TransactionCategory[],
): BudgetStatus[] {
  return budgets
    .flatMap((budget): BudgetStatus[] => {
      const category = categories.find((c) => c.id === budget.category && c.kind === 'expense');
      if (!category) return [];
      const spent = summary.expenseByCategory.find((c) => c.category.id === budget.category)?.amount ?? 0;
      return [
        {
          budget,
          category,
          spent,
          remaining: budget.amount - spent,
          ratio: budget.amount > 0 ? spent / budget.amount : 0,
          level: budgetLevel(spent, budget.amount),
        },
      ];
    })
    .sort((a, b) => b.ratio - a.ratio);
}

/**
 * The warning to show after spending moved a budget from `before` to `after`:
 * only when a threshold was crossed, so the user is not nagged on every purchase.
 */
export function budgetAlert(before: BudgetStatus | undefined, after: BudgetStatus): BudgetLevel | null {
  const rank: Record<BudgetLevel, number> = { ok: 0, warn: 1, over: 2 };
  const previous = before ? rank[before.level] : 0;
  return rank[after.level] > previous ? after.level : null;
}

const roundTo = (value: number, step: number) => Math.max(step, Math.round(value / step) * step);

/** Average monthly spending per top-level category over the `months` full months before `month`. */
export function averageSpending(
  transactions: Transaction[],
  month: string,
  categories: TransactionCategory[],
  months = 3,
): { category: TransactionCategory; amount: number }[] {
  const totals = new Map<string, { category: TransactionCategory; amount: number }>();
  let counted = 0;
  for (let i = 1; i <= months; i++) {
    const s = summarizeMonth(transactions, shiftMonth(month, -i), categories);
    if (s.expense === 0 && s.income === 0) continue;
    counted += 1;
    for (const c of s.expenseByCategory) {
      const entry = totals.get(c.category.id) ?? { category: c.category, amount: 0 };
      entry.amount += c.amount;
      totals.set(c.category.id, entry);
    }
  }
  if (counted === 0) return [];
  return [...totals.values()]
    .map((t) => ({ category: t.category, amount: t.amount / counted }))
    .sort((a, b) => b.amount - a.amount);
}

/** Suggested limits: the recent monthly average of each category, rounded to 50.000 ₫. */
export function suggestBudgets(
  transactions: Transaction[],
  month: string,
  categories: TransactionCategory[],
): { category: string; amount: number }[] {
  return averageSpending(transactions, month, categories).map((a) => ({
    category: a.category.id,
    amount: roundTo(a.amount, 50_000),
  }));
}

/** Built-in categories treated as essentials by the 50/30/20 rule; everything else is a "want". */
const NEEDS = new Set(['food', 'transport', 'housing', 'bills', 'health', 'education']);

/**
 * Splits a monthly income by the 50/30/20 rule: 50% needs, 30% wants, 20% savings.
 * Within each group the money is shared in proportion to recent spending, or evenly when there is none.
 */
export function fiftyThirtyTwenty(
  income: number,
  transactions: Transaction[],
  month: string,
  categories: TransactionCategory[],
): { budgets: { category: string; amount: number }[]; savings: number } {
  const expenseRoots = categories.filter((c) => c.kind === 'expense' && !c.parentId && !c.hidden);
  const average = new Map(averageSpending(transactions, month, categories).map((a) => [a.category.id, a.amount]));
  const share = (group: TransactionCategory[], pool: number) => {
    const total = group.reduce((s, c) => s + (average.get(c.id) ?? 0), 0);
    return group.map((c) => ({
      category: c.id,
      amount: roundTo(total > 0 ? (pool * (average.get(c.id) ?? 0)) / total : pool / group.length, 50_000),
    }));
  };
  const needs = expenseRoots.filter((c) => NEEDS.has(c.id));
  const wants = expenseRoots.filter((c) => !NEEDS.has(c.id));
  return {
    budgets: [...share(needs, income * 0.5), ...share(wants, income * 0.3)].filter(
      (b) => average.size === 0 || (average.get(b.category) ?? 0) > 0,
    ),
    savings: Math.round(income * 0.2),
  };
}
