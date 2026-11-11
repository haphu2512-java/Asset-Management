import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  goalProgress,
  mergeCategories,
  parseVndExpression,
  periodKey,
  summarizeMonth,
  type Asset,
  type Goal,
  type Transaction,
} from './finance.ts';
import {
  adjustmentFor,
  applyTransactionChange,
  filterTransactions,
  foldText,
  suggestNotes,
} from './ledger.ts';

const asset = (id: string, category: Asset['category'], amount: number, over: Partial<Asset> = {}): Asset => ({
  id,
  name: id,
  category,
  amount,
  updatedAt: '2026-11-01T00:00:00.000Z',
  ...over,
});

const tx = (over: Partial<Transaction>): Transaction => ({
  id: 't1',
  kind: 'expense',
  category: 'food',
  amount: 50_000,
  note: '',
  date: '2026-11-10',
  ...over,
});

const amounts = (assets: Asset[]) => Object.fromEntries(assets.map((a) => [a.id, a.amount]));

test('an expense lowers its wallet and an income raises it', () => {
  const assets = [asset('cash', 'cash', 500_000), asset('bank', 'bank', 1_000_000)];
  const spent = applyTransactionChange(assets, null, tx({ accountId: 'cash' }));
  assert.deepEqual(amounts(spent), { cash: 450_000, bank: 1_000_000 });
  const paid = applyTransactionChange(spent, null, tx({ id: 't2', kind: 'income', amount: 200_000, accountId: 'bank' }));
  assert.deepEqual(amounts(paid), { cash: 450_000, bank: 1_200_000 });
});

test('editing or deleting a transaction undoes its old effect first', () => {
  const assets = [asset('cash', 'cash', 450_000), asset('bank', 'bank', 1_000_000)];
  const before = tx({ accountId: 'cash' });
  // Same expense, now 80k and paid from the bank account.
  const edited = applyTransactionChange(assets, before, tx({ amount: 80_000, accountId: 'bank' }));
  assert.deepEqual(amounts(edited), { cash: 500_000, bank: 920_000 });
  const removed = applyTransactionChange(assets, before, null);
  assert.deepEqual(amounts(removed), { cash: 500_000, bank: 1_000_000 });
});

test('a transfer moves money without changing the total, and wallets may go negative', () => {
  const assets = [asset('cash', 'cash', 100_000), asset('bank', 'bank', 0)];
  const moved = applyTransactionChange(
    assets,
    null,
    tx({ kind: 'transfer', category: '', amount: 300_000, accountId: 'cash', toAccountId: 'bank' }),
  );
  assert.deepEqual(amounts(moved), { cash: -200_000, bank: 300_000 });
});

test('money flowing into a debt reduces it, and spending from it increases it', () => {
  const assets = [asset('cash', 'cash', 5_000_000), asset('card', 'debt', 2_000_000)];
  const repaid = applyTransactionChange(
    assets,
    null,
    tx({ kind: 'transfer', category: '', amount: 500_000, accountId: 'cash', toAccountId: 'card' }),
  );
  assert.deepEqual(amounts(repaid), { cash: 4_500_000, card: 1_500_000 });
  const swiped = applyTransactionChange(assets, null, tx({ amount: 300_000, accountId: 'card' }));
  assert.deepEqual(amounts(swiped), { cash: 5_000_000, card: 2_300_000 });
});

test('holdings valued by price are not touched by transfers', () => {
  const assets = [
    asset('cash', 'cash', 10_000_000),
    asset('fpt', 'stock', 8_000_000, { symbol: 'FPT', quantity: 100 }),
  ];
  const bought = applyTransactionChange(
    assets,
    null,
    tx({ kind: 'transfer', category: '', amount: 8_000_000, accountId: 'cash', toAccountId: 'fpt' }),
  );
  assert.deepEqual(amounts(bought), { cash: 2_000_000, fpt: 8_000_000 });
});

test('adjustmentFor builds the one-sided transfer that reaches the real balance', () => {
  const cash = asset('cash', 'cash', 450_000);
  const up = adjustmentFor(cash, 500_000, 'a1', '2026-11-10')!;
  assert.deepEqual([up.amount, up.toAccountId, up.accountId], [50_000, 'cash', undefined]);
  assert.equal(applyTransactionChange([cash], null, up)[0].amount, 500_000);

  const debt = asset('card', 'debt', 2_000_000);
  const more = adjustmentFor(debt, 2_300_000, 'a2', '2026-11-10')!;
  assert.equal(applyTransactionChange([debt], null, more)[0].amount, 2_300_000);
  assert.equal(adjustmentFor(cash, 450_000, 'a3', '2026-11-10'), null);
});

test('summaries ignore transfers and roll sub-categories up into their parent', () => {
  const categories = mergeCategories([
    { id: 'coffee', kind: 'expense', label: 'Cà phê', color: '#000000', parentId: 'food' },
    { id: 'food', kind: 'expense', label: 'Ăn & uống', color: '#111111' },
  ]);
  const s = summarizeMonth(
    [
      tx({ id: 'a', category: 'coffee', amount: 35_000 }),
      tx({ id: 'b', category: 'food', amount: 100_000 }),
      tx({ id: 'c', kind: 'transfer', category: '', amount: 9_000_000, accountId: 'x', toAccountId: 'y' }),
    ],
    '2026-11',
    categories,
  );
  assert.equal(s.expense, 135_000);
  assert.deepEqual(
    s.expenseByCategory.map((c) => [c.category.id, c.category.label, c.amount]),
    [['food', 'Ăn & uống', 135_000]],
  );
});

test('mergeCategories drops parents that would nest more than one level', () => {
  const categories = mergeCategories([
    { id: 'coffee', kind: 'expense', label: 'Cà phê', color: '#000000', parentId: 'food' },
    { id: 'latte', kind: 'expense', label: 'Latte', color: '#000000', parentId: 'coffee' },
    { id: 'side', kind: 'income', label: 'Việc phụ', color: '#000000', parentId: 'food' },
  ]);
  const parent = (id: string) => categories.find((c) => c.id === id)?.parentId;
  assert.equal(parent('coffee'), 'food');
  assert.equal(parent('latte'), undefined);
  assert.equal(parent('side'), undefined);
});

test('parseVndExpression adds and subtracts shorthand amounts', () => {
  assert.equal(parseVndExpression('35k+20k'), 55_000);
  assert.equal(parseVndExpression('1tr - 200k'), 800_000);
  assert.equal(parseVndExpression('50.000'), 50_000);
  assert.equal(parseVndExpression('20k-50k'), null);
  assert.equal(parseVndExpression('35k+'), null);
  assert.equal(parseVndExpression(''), null);
});

test('recurring goals track their own period instead of always the month', () => {
  const goal = (over: Partial<Goal>): Goal => ({
    id: 'g',
    name: 'ETF',
    target: 10_000_000,
    saved: 1_000_000,
    deadline: '2027-11-10',
    type: 'recurring',
    recurringAmount: 300_000,
    ...over,
  });
  // Wednesday 11 Nov 2026; the contribution was on Monday of the week before.
  const now = new Date(2026, 10, 11);
  const weekly = goalProgress(goal({ frequency: 'weekly', lastContributedAt: '2026-11-02' }), now);
  assert.equal(weekly.contributedThisPeriod, false);
  assert.equal(weekly.periodUnit, 'tuần');
  assert.equal(weekly.periodAmount, 300_000);
  assert.equal(weekly.monthlyNeeded, 1_300_000);
  assert.equal(goalProgress(goal({ frequency: 'weekly', lastContributedAt: '2026-11-09' }), now).contributedThisPeriod, true);

  // A quarterly plan paid in October is done until the end of December.
  const quarterly = goalProgress(goal({ frequency: 'quarterly', lastContributedAt: '2026-10-03' }), now);
  assert.equal(quarterly.contributedThisPeriod, true);
  assert.equal(quarterly.monthlyNeeded, 100_000);
  assert.equal(quarterly.currentPeriodLabel, 'quý 4/2026');

  // Without a planned amount the goal falls back to what is needed, not to a made-up number.
  const open = goalProgress(goal({ recurringAmount: undefined }), now);
  assert.equal(open.periodAmount, 818_182);
  assert.equal(periodKey('2026-11-15', 'weekly'), '2026-11-09');
});

test('filterTransactions searches without diacritics and by account, amount and category', () => {
  const assets = [asset('w1', 'cash', 0, { name: 'Tiền mặt' }), asset('w2', 'bank', 0, { name: 'Vietcombank' })];
  const categories = mergeCategories([
    { id: 'coffee', kind: 'expense', label: 'Cà phê', color: '#000000', parentId: 'food' },
  ]);
  const list = [
    tx({ id: 'a', note: 'Cà phê với bạn', category: 'coffee', accountId: 'w1', amount: 35_000 }),
    tx({ id: 'b', note: 'Đổ xăng', category: 'transport', accountId: 'w2', amount: 80_000, date: '2026-11-09' }),
    tx({ id: 'c', kind: 'income', category: 'salary', accountId: 'w2', amount: 20_000_000, date: '2026-11-05' }),
  ];
  const ids = (f: Parameters<typeof filterTransactions>[1]) =>
    filterTransactions(list, f, categories, assets).map((t) => t.id);
  assert.equal(foldText('Đổ xăng'), 'do xang');
  assert.deepEqual(ids({ query: 'ca phe' }), ['a']);
  assert.deepEqual(ids({ query: 'vietcom' }), ['b', 'c']);
  assert.deepEqual(ids({ categoryIds: ['food'] }), ['a']);
  assert.deepEqual(ids({ min: 50_000, max: 100_000 }), ['b']);
  assert.deepEqual(ids({ from: '2026-11-06', to: '2026-11-09' }), ['b']);
  assert.deepEqual(ids({ kind: 'income', accountId: 'w2' }), ['c']);
});

test('suggestNotes offers the most used notes of a category', () => {
  const list = [
    tx({ id: 'a', note: 'Cơm trưa' }),
    tx({ id: 'b', note: 'Cơm trưa' }),
    tx({ id: 'c', note: 'Phở' }),
    tx({ id: 'd', note: 'Grab', category: 'transport' }),
  ];
  assert.deepEqual(suggestNotes(list, 'food'), ['Cơm trưa', 'Phở']);
});
