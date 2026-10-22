import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  addMonths,
  formatVnd,
  goalProgress,
  isValidDateKey,
  quickParse,
  parseVnd,
  shiftMonth,
  summarize,
  summarizeMonth,
  type Asset,
  type Transaction,
} from './finance.ts';

const asset = (category: Asset['category'], amount: number): Asset => ({
  id: `${category}-${amount}`,
  name: category,
  category,
  amount,
  updatedAt: '2026-10-21T00:00:00.000Z',
});

test('summarize adds assets and subtracts debt', () => {
  const s = summarize([
    asset('cash', 23_000_000),
    asset('stock', 10_000_000),
    asset('crypto', 8_000_000),
    asset('lent', 22_000_000),
  ]);
  assert.equal(s.totalAssets, 63_000_000);
  assert.equal(s.totalDebt, 0);
  assert.equal(s.netWorth, 63_000_000);

  const withDebt = summarize([asset('cash', 41_000_000), asset('debt', 22_000_000)]);
  assert.equal(withDebt.totalAssets, 41_000_000);
  assert.equal(withDebt.totalDebt, 22_000_000);
  assert.equal(withDebt.netWorth, 19_000_000);
});

test('summarize groups by category', () => {
  const s = summarize([asset('cash', 1), asset('cash', 2), asset('crypto', 5)]);
  const cash = s.byCategory.find((c) => c.category.id === 'cash');
  assert.equal(cash?.amount, 3);
});

test('formatVnd groups thousands with dots', () => {
  assert.equal(formatVnd(23_000_000), '23.000.000 ₫');
  assert.equal(formatVnd(0), '0 ₫');
  assert.equal(formatVnd(-19_000_000), '-19.000.000 ₫');
  assert.equal(formatVnd(999), '999 ₫');
});

test('parseVnd accepts plain, grouped and shorthand amounts', () => {
  assert.equal(parseVnd('23000000'), 23_000_000);
  assert.equal(parseVnd('23.000.000'), 23_000_000);
  assert.equal(parseVnd('23.000k'), 23_000_000);
  assert.equal(parseVnd('23tr'), 23_000_000);
  assert.equal(parseVnd('1,5tr'), 1_500_000);
  assert.equal(parseVnd('2 tỷ'), 2_000_000_000);
  assert.equal(parseVnd(''), null);
  assert.equal(parseVnd('abc'), null);
  assert.equal(parseVnd('-5'), null);
});

test('summarizeMonth only counts the given month', () => {
  const tx = (kind: Transaction['kind'], category: string, amount: number, date: string): Transaction => ({
    id: `${date}-${amount}`, kind, category, amount, note: '', date,
  });
  const s = summarizeMonth(
    [
      tx('income', 'salary', 20_000_000, '2026-10-01'),
      tx('expense', 'food', 3_000_000, '2026-10-05'),
      tx('expense', 'housing', 5_000_000, '2026-10-06'),
      tx('expense', 'food', 1_000_000, '2026-10-20'),
      tx('expense', 'food', 9_000_000, '2026-09-30'),
    ],
    '2026-10',
  );
  assert.equal(s.income, 20_000_000);
  assert.equal(s.expense, 9_000_000);
  assert.equal(s.balance, 11_000_000);
  assert.deepEqual(
    s.expenseByCategory.map((c) => [c.category.id, c.amount]),
    [['housing', 5_000_000], ['food', 4_000_000]],
  );
});

test('shiftMonth crosses year boundaries', () => {
  assert.equal(shiftMonth('2026-01', -1), '2025-12');
  assert.equal(shiftMonth('2026-12', 1), '2027-01');
});

test('goalProgress spreads the remainder over the months left', () => {
  const now = new Date(2026, 9, 21); // 21/10/2026
  const p = goalProgress(
    { id: 'g', name: 'Quỹ', target: 100_000_000, saved: 40_000_000, deadline: '2027-10-21' },
    now,
  );
  assert.equal(p.remaining, 60_000_000);
  assert.equal(p.monthsLeft, 12);
  assert.equal(p.monthlyNeeded, 5_000_000);
  assert.equal(p.ratio, 0.4);
  assert.equal(p.overdue, false);

  const late = goalProgress(
    { id: 'g', name: 'Quỹ', target: 10, saved: 0, deadline: '2026-01-01' },
    now,
  );
  assert.equal(late.overdue, true);
  assert.equal(late.monthsLeft, 1);

  const done = goalProgress(
    { id: 'g', name: 'Quỹ', target: 10, saved: 12, deadline: '2026-01-01' },
    now,
  );
  assert.equal(done.monthlyNeeded, 0);
  assert.equal(done.ratio, 1);
  assert.equal(done.overdue, false);
});

test('quickParse reads amount, category and note offline', () => {
  assert.deepEqual(quickParse('cafe 35k', '2026-10-21'), {
    kind: 'expense',
    category: 'food',
    amount: 35_000,
    note: 'cafe',
    date: '2026-10-21',
  });
  assert.equal(quickParse('Lương 20tr', '2026-10-21')?.kind, 'income');
  assert.equal(quickParse('đổ xăng 50.000', '2026-10-21')?.category, 'transport');
  assert.equal(quickParse('abc 12', '2026-10-21')?.category, 'other-expense');
  assert.equal(quickParse('không có số', '2026-10-21'), null);
});

test('isValidDateKey rejects dates that do not exist', () => {
  assert.equal(isValidDateKey('2026-10-21'), true);
  assert.equal(isValidDateKey('2028-02-29'), true);
  assert.equal(isValidDateKey('2026-02-31'), false);
  assert.equal(isValidDateKey('2026-13-01'), false);
  assert.equal(isValidDateKey('21/10/2026'), false);
});

test('addMonths clamps to the end of a shorter month', () => {
  assert.equal(addMonths(1, new Date(2026, 0, 31)), '2026-02-28');
  assert.equal(addMonths(12, new Date(2026, 9, 22)), '2027-10-22');
  assert.equal(addMonths(2, new Date(2026, 11, 15)), '2027-02-15');
});
