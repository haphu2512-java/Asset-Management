import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TRANSACTION_CATEGORIES, summarizeMonth, type Transaction } from './finance.ts';
import { budgetAlert, budgetStatuses, fiftyThirtyTwenty, suggestBudgets } from './budgets.ts';
import {
  advanceRule,
  dueDates,
  monthlyAmount,
  nextOccurrenceAfter,
  occurrence,
  occurrenceTransaction,
  upcoming,
  type Recurring,
} from './recurring.ts';

const tx = (id: string, category: string, amount: number, date: string, kind: Transaction['kind'] = 'expense'): Transaction => ({
  id,
  kind,
  category,
  amount,
  note: '',
  date,
});

test('budgetStatuses reports spending against each limit and flags 80% and 100%', () => {
  const summary = summarizeMonth(
    [tx('a', 'food', 3_300_000, '2026-11-03'), tx('b', 'shopping', 2_500_000, '2026-11-04'), tx('c', 'transport', 100_000, '2026-11-05')],
    '2026-11',
  );
  const statuses = budgetStatuses(
    [
      { id: '1', category: 'food', amount: 4_000_000 },
      { id: '2', category: 'shopping', amount: 2_000_000 },
      { id: '3', category: 'transport', amount: 1_000_000 },
      { id: '4', category: 'deleted-category', amount: 1 },
    ],
    summary,
    TRANSACTION_CATEGORIES,
  );
  assert.deepEqual(
    statuses.map((s) => [s.category.id, s.level, s.remaining]),
    [
      ['shopping', 'over', -500_000],
      ['food', 'warn', 700_000],
      ['transport', 'ok', 900_000],
    ],
  );
});

test('budgetAlert only fires when a threshold is crossed', () => {
  const status = (spent: number) =>
    budgetStatuses(
      [{ id: '1', category: 'food', amount: 1_000_000 }],
      summarizeMonth([tx('a', 'food', spent, '2026-11-03')], '2026-11'),
      TRANSACTION_CATEGORIES,
    )[0];
  assert.equal(budgetAlert(status(500_000), status(700_000)), null);
  assert.equal(budgetAlert(status(700_000), status(850_000)), 'warn');
  assert.equal(budgetAlert(status(850_000), status(900_000)), null);
  assert.equal(budgetAlert(status(900_000), status(1_000_000)), 'over');
  assert.equal(budgetAlert(undefined, status(1_200_000)), 'over');
});

test('suggestBudgets averages the months that have data', () => {
  const history = [
    tx('a', 'food', 3_000_000, '2026-10-03'),
    tx('b', 'food', 4_020_000, '2026-09-03'),
    tx('c', 'bills', 620_000, '2026-10-10'),
    tx('d', 'salary', 20_000_000, '2026-09-01', 'income'),
  ];
  // August has no data, so the average is over two months, rounded to 50k.
  assert.deepEqual(suggestBudgets(history, '2026-11', TRANSACTION_CATEGORIES), [
    { category: 'food', amount: 3_500_000 },
    { category: 'bills', amount: 300_000 },
  ]);
});

test('fiftyThirtyTwenty splits income into needs, wants and savings', () => {
  const history = [
    tx('a', 'food', 3_000_000, '2026-10-03'),
    tx('b', 'housing', 5_000_000, '2026-10-03'),
    tx('c', 'shopping', 1_000_000, '2026-10-03'),
    tx('d', 'entertainment', 1_000_000, '2026-10-03'),
  ];
  const plan = fiftyThirtyTwenty(20_000_000, history, '2026-11', TRANSACTION_CATEGORIES);
  assert.equal(plan.savings, 4_000_000);
  assert.deepEqual(plan.budgets, [
    { category: 'food', amount: 3_750_000 },
    { category: 'housing', amount: 6_250_000 },
    { category: 'shopping', amount: 3_000_000 },
    { category: 'entertainment', amount: 3_000_000 },
  ]);
});

const rule = (over: Partial<Recurring> = {}): Recurring => ({
  id: 'r1',
  kind: 'expense',
  category: 'housing',
  amount: 5_000_000,
  note: 'Tiền nhà',
  accountId: 'bank',
  frequency: 'monthly',
  startDate: '2026-01-31',
  nextDate: '2026-01-31',
  auto: true,
  active: true,
  ...over,
});

test('monthly rules clamp to short months without drifting off their day', () => {
  assert.equal(occurrence('2026-01-31', 'monthly', 1), '2026-02-28');
  assert.equal(occurrence('2026-01-31', 'monthly', 2), '2026-03-31');
  assert.equal(occurrence('2024-02-29', 'yearly', 1), '2025-02-28');
  assert.equal(occurrence('2026-11-02', 'weekly', 3), '2026-11-23');
  assert.equal(nextOccurrenceAfter(rule(), '2026-02-28'), '2026-03-31');
});

test('dueDates catches up on every missed occurrence up to today', () => {
  assert.deepEqual(dueDates(rule({ nextDate: '2026-02-28' }), '2026-04-30'), ['2026-02-28', '2026-03-31', '2026-04-30']);
  assert.deepEqual(dueDates(rule({ nextDate: '2026-02-28', endDate: '2026-03-31' }), '2026-04-30'), ['2026-02-28', '2026-03-31']);
  assert.deepEqual(dueDates(rule({ active: false }), '2026-04-30'), []);
  assert.deepEqual(dueDates(rule({ nextDate: '2026-05-31' }), '2026-04-30'), []);
});

test('an occurrence has a stable id and advancing a rule past its end switches it off', () => {
  const t = occurrenceTransaction(rule(), '2026-02-28');
  assert.deepEqual([t.id, t.recurringId, t.amount, t.accountId, t.date], ['r1@2026-02-28', 'r1', 5_000_000, 'bank', '2026-02-28']);
  const next = advanceRule(rule({ endDate: '2026-03-15' }), '2026-02-28');
  assert.deepEqual([next.nextDate, next.active], ['2026-03-31', false]);
  assert.equal(advanceRule(rule(), '2026-02-28').active, true);
});

test('upcoming lists what falls due within a week and monthlyAmount normalises frequencies', () => {
  const rules = [
    rule({ id: 'rent', nextDate: '2026-11-30' }),
    rule({ id: 'gym', frequency: 'weekly', startDate: '2026-11-02', nextDate: '2026-11-16', amount: 100_000 }),
    rule({ id: 'net', startDate: '2026-01-12', nextDate: '2026-11-12', amount: 200_000 }),
  ];
  assert.deepEqual(
    upcoming(rules, '2026-11-10').map((u) => [u.rule.id, u.date]),
    [
      ['net', '2026-11-12'],
      ['gym', '2026-11-16'],
    ],
  );
  assert.equal(monthlyAmount({ amount: 120_000, frequency: 'weekly' }), 520_000);
  assert.equal(monthlyAmount({ amount: 1_200_000, frequency: 'yearly' }), 100_000);
});
