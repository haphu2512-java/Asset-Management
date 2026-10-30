import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  changeLabel,
  compareValue,
  formatChange,
  previousSnapshot,
  sameSnapshot,
  takeSnapshot,
  type Asset,
} from './finance.ts';

const asset = (id: string, category: Asset['category'], amount: number): Asset => ({
  id,
  name: id,
  category,
  amount,
  updatedAt: '2026-10-30T00:00:00.000Z',
});

test('takeSnapshot records totals and per-asset amounts', () => {
  const snap = takeSnapshot([asset('a', 'cash', 10_000_000), asset('d', 'debt', 4_000_000)], '2026-10-30');
  assert.equal(snap.totalAssets, 10_000_000);
  assert.equal(snap.totalDebt, 4_000_000);
  assert.equal(snap.netWorth, 6_000_000);
  assert.deepEqual(snap.amounts, { a: 10_000_000, d: 4_000_000 });
});

test('sameSnapshot detects changed amounts', () => {
  const a = takeSnapshot([asset('a', 'cash', 1)], '2026-10-30');
  assert.ok(sameSnapshot(a, takeSnapshot([asset('a', 'cash', 1)], '2026-10-30')));
  assert.ok(!sameSnapshot(a, takeSnapshot([asset('a', 'cash', 2)], '2026-10-30')));
  assert.ok(!sameSnapshot(a, takeSnapshot([asset('a', 'cash', 1), asset('b', 'cash', 0)], '2026-10-30')));
});

test('previousSnapshot picks the latest day before today', () => {
  const snaps = ['2026-10-27', '2026-10-30', '2026-10-29', '2026-10-25'].map((date) => takeSnapshot([], date));
  assert.equal(previousSnapshot(snaps, '2026-10-30')?.date, '2026-10-29');
  assert.equal(previousSnapshot(snaps, '2026-10-25'), null);
  assert.equal(previousSnapshot([], '2026-10-30'), null);
});

test('compareValue gives amount, percent and direction', () => {
  assert.deepEqual(compareValue(110, 100), { amount: 10, percent: 10, direction: 'up' });
  assert.deepEqual(compareValue(90, 100), { amount: -10, percent: -10, direction: 'down' });
  assert.deepEqual(compareValue(100, 100), { amount: 0, percent: 0, direction: 'flat' });
  assert.equal(compareValue(50, 0).percent, null);
  // A negative net worth that improves is still an increase.
  assert.deepEqual(compareValue(-50, -100), { amount: 50, percent: 50, direction: 'up' });
});

test('formatChange shows sign, VND and percent', () => {
  assert.equal(formatChange(compareValue(51_250_000, 50_000_000)), '+1.250.000 ₫ (+2,50%)');
  assert.equal(formatChange(compareValue(49_000_000, 50_000_000)), '-1.000.000 ₫ (-2,00%)');
  assert.equal(formatChange(compareValue(0, 0)), '0 ₫');
  assert.equal(formatChange(compareValue(5_000, 0)), '+5.000 ₫');
});

test('changeLabel names yesterday or the baseline date', () => {
  assert.equal(changeLabel('2026-10-29', '2026-10-30'), 'so với hôm qua');
  assert.equal(changeLabel('2026-10-31', '2026-11-01'), 'so với hôm qua');
  assert.equal(changeLabel('2026-10-25', '2026-10-30'), 'so với 25/10');
});
