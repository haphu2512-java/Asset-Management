import { shiftDay, todayKey, type Transaction, type TransactionKind } from './finance.ts';

export type RecurringFrequency = 'weekly' | 'monthly' | 'yearly';

/** A transaction that repeats: salary, rent, subscriptions, loan instalments. */
export type Recurring = {
  id: string;
  kind: TransactionKind;
  category: string;
  amount: number;
  note: string;
  accountId?: string;
  toAccountId?: string;
  frequency: RecurringFrequency;
  /** First occurrence, "YYYY-MM-DD"; later ones keep its weekday / day of month. */
  startDate: string;
  /** Next occurrence that has not been recorded yet. */
  nextDate: string;
  /** Last day the rule applies, if any. */
  endDate?: string;
  /** Record occurrences automatically; otherwise they wait for the user to confirm. */
  auto: boolean;
  active: boolean;
};

export const FREQUENCY_LABEL: Record<RecurringFrequency, string> = {
  weekly: 'Hàng tuần',
  monthly: 'Hàng tháng',
  yearly: 'Hàng năm',
};

const pad = (n: number) => String(n).padStart(2, '0');

/** The n-th occurrence (0 = start). Monthly and yearly rules clamp to the end of shorter months without drifting. */
export function occurrence(startDate: string, frequency: RecurringFrequency, n: number): string {
  if (frequency === 'weekly') return shiftDay(startDate, 7 * n);
  const [y, m, d] = startDate.split('-').map(Number);
  const months = frequency === 'monthly' ? n : 12 * n;
  const first = new Date(y, m - 1 + months, 1);
  const lastDay = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  return `${first.getFullYear()}-${pad(first.getMonth() + 1)}-${pad(Math.min(d, lastDay))}`;
}

/** The first occurrence strictly after `date`. */
export function nextOccurrenceAfter(rule: Pick<Recurring, 'startDate' | 'frequency'>, date: string): string {
  // Occurrences are at most a year apart, so this loop is short even for old rules.
  for (let n = 0; ; n++) {
    const day = occurrence(rule.startDate, rule.frequency, n);
    if (day > date) return day;
  }
}

/** Safety cap so a rule left alone for years cannot flood the ledger in one go. */
const MAX_CATCH_UP = 60;

/** Occurrences from `nextDate` up to and including `until` that still need recording. */
export function dueDates(rule: Recurring, until = todayKey()): string[] {
  if (!rule.active) return [];
  const dates: string[] = [];
  let day = rule.nextDate;
  while (day <= until && (!rule.endDate || day <= rule.endDate) && dates.length < MAX_CATCH_UP) {
    dates.push(day);
    day = nextOccurrenceAfter(rule, day);
  }
  return dates;
}

/**
 * Id of the transaction for one occurrence. It is derived from the rule and the date, so two
 * devices recording the same occurrence write the same row instead of a duplicate.
 */
export function occurrenceId(ruleId: string, date: string): string {
  return `${ruleId}@${date}`;
}

export function occurrenceTransaction(rule: Recurring, date: string): Transaction {
  return {
    id: occurrenceId(rule.id, date),
    kind: rule.kind,
    category: rule.kind === 'transfer' ? '' : rule.category,
    amount: rule.amount,
    note: rule.note,
    date,
    accountId: rule.accountId,
    toAccountId: rule.kind === 'transfer' ? rule.toAccountId : undefined,
    recurringId: rule.id,
  };
}

/** The rule after its occurrences up to `recorded` were handled; it switches off once past its end date. */
export function advanceRule(rule: Recurring, recorded: string): Recurring {
  const nextDate = nextOccurrenceAfter(rule, recorded);
  return { ...rule, nextDate, active: rule.active && (!rule.endDate || nextDate <= rule.endDate) };
}

export type Upcoming = { rule: Recurring; date: string };

/** Occurrences due within the next `days` days (overdue ones included), soonest first. */
export function upcoming(rules: Recurring[], today = todayKey(), days = 7): Upcoming[] {
  const until = shiftDay(today, days);
  return rules
    .flatMap((rule) => dueDates(rule, until).map((date) => ({ rule, date })))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Monthly equivalent of a rule's amount, for "fixed costs per month" summaries. */
export function monthlyAmount(rule: Pick<Recurring, 'amount' | 'frequency'>): number {
  return rule.frequency === 'weekly'
    ? Math.round((rule.amount * 52) / 12)
    : rule.frequency === 'yearly'
      ? Math.round(rule.amount / 12)
      : rule.amount;
}
