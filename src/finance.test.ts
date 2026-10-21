import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatVnd,
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
