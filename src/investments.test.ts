import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Asset, AssetSnapshot, Transaction } from './finance.ts';
import { TRANSACTION_CATEGORIES } from './finance.ts';
import {
  interestInfo,
  performance,
  portfolioPerformance,
  positionFromTrades,
  simpleInterest,
  tradeCashFlow,
  type Trade,
} from './investments.ts';
import { fetchFxRates, fetchGoldPrice, refreshPrices } from './prices.ts';
import { compareMonths, formatCompact, netWorthSeries, yearReport } from './reports.ts';
import { importCsv, parseCsv, parseDateCell, toCsv } from './csv.ts';

const trade = (over: Partial<Trade>): Trade => ({
  id: 't',
  assetId: 'fpt',
  side: 'buy',
  date: '2026-01-10',
  quantity: 100,
  price: 80_000,
  fee: 0,
  ...over,
});

test('positionFromTrades keeps an average cost and realizes profit on sales', () => {
  const trades = [
    trade({ id: '1', quantity: 100, price: 80_000, fee: 12_000 }),
    trade({ id: '2', date: '2026-03-01', quantity: 100, price: 100_000, fee: 15_000 }),
    trade({ id: '3', date: '2026-06-01', side: 'sell', quantity: 50, price: 120_000, fee: 9_000 }),
    trade({ id: '4', date: '2026-07-01', side: 'dividend', quantity: 0, price: 300_000 }),
  ];
  const p = positionFromTrades(trades);
  assert.equal(p.quantity, 150);
  // Cost 18.027.000 for 200 shares → 90.135 each; 50 sold leave 13.520.250.
  assert.equal(p.costBasis, 13_520_250);
  assert.equal(Math.round(p.averageCost), 90_135);
  assert.equal(p.realized, 50 * 120_000 - 9_000 - 50 * 90_135);
  assert.equal(p.dividends, 300_000);

  const perf = performance(p, 150 * 110_000);
  assert.equal(perf.unrealized, 16_500_000 - 13_520_250);
  assert.equal(perf.totalReturn, perf.unrealized + p.realized + 300_000);
  assert.equal(Math.round(perf.unrealizedPercent! * 100) / 100, 22.04);
});

test('bonus shares lower the average cost and selling everything clears the position', () => {
  const p = positionFromTrades([
    trade({ id: '1', quantity: 100, price: 60_000 }),
    trade({ id: '2', date: '2026-02-01', side: 'bonus', quantity: 20, price: 0 }),
  ]);
  assert.deepEqual([p.quantity, p.costBasis, p.averageCost], [120, 6_000_000, 50_000]);

  const closed = positionFromTrades([
    trade({ id: '1', assetId: 'btc', quantity: 0.1, price: 2_000_000_000 }),
    trade({ id: '2', assetId: 'btc', date: '2026-02-01', quantity: 0.2, price: 2_300_000_000 }),
    trade({ id: '3', assetId: 'btc', date: '2026-03-01', side: 'sell', quantity: 0.3, price: 2_500_000_000 }),
  ]);
  assert.deepEqual([closed.quantity, closed.costBasis], [0, 0]);
  assert.equal(closed.realized, 90_000_000);
  assert.equal(performance(closed, 0).unrealizedPercent, null);
});

test('tradeCashFlow and portfolioPerformance', () => {
  assert.equal(tradeCashFlow(trade({ fee: 12_000 })), -8_012_000);
  assert.equal(tradeCashFlow(trade({ side: 'sell', fee: 12_000 })), 7_988_000);
  assert.equal(tradeCashFlow(trade({ side: 'bonus' })), 0);
  const assets: Asset[] = [
    { id: 'fpt', name: 'FPT', category: 'stock', amount: 9_000_000, updatedAt: '', symbol: 'FPT', quantity: 100 },
  ];
  assert.deepEqual(portfolioPerformance(assets, [trade({})]), {
    cost: 8_000_000,
    value: 9_000_000,
    unrealized: 1_000_000,
    realized: 0,
    dividends: 0,
  });
});

test('interest on a term deposit accrues daily and stops at maturity', () => {
  assert.equal(simpleInterest(100_000_000, 6, '2026-01-01', '2027-01-01'), 6_000_000);
  const deposit: Asset = {
    id: 's',
    name: 'Sổ 6 tháng',
    category: 'saving',
    amount: 100_000_000,
    updatedAt: '',
    interestRate: 5.5,
    startDate: '2026-06-01',
    dueDate: '2026-12-01',
  };
  const info = interestInfo(deposit, '2026-11-10')!;
  assert.equal(info.daysLeft, 21);
  assert.equal(info.accrued, Math.round((100_000_000 * 5.5 * 162) / 36_500));
  assert.equal(info.atMaturity, Math.round((100_000_000 * 5.5 * 183) / 36_500));
  assert.equal(interestInfo(deposit, '2027-03-01')!.accrued, info.atMaturity);
  assert.equal(interestInfo({ ...deposit, interestRate: undefined }, '2026-11-10'), null);
});

const respond = (body: unknown) => ({ ok: true, json: async () => body }) as unknown as Response;
const fakeFetch = (async (url: string) => {
  if (url.includes('er-api')) return respond({ result: 'success', rates: { USD: 1, VND: 26_000, EUR: 0.8 } });
  if (url.includes('coingecko')) return respond({ xaut: { vnd: 103_678_256 } });
  return respond({});
}) as typeof fetch;

test('foreign currencies and gold are priced in VND', async () => {
  assert.deepEqual(await fetchFxRates(['usd', 'EUR', 'XXX'], fakeFetch), { USD: 26_000, EUR: 32_500 });
  // 103.678.256 ₫ per troy ounce → 12.500.000 ₫ per chỉ.
  assert.equal(await fetchGoldPrice(fakeFetch), 12_500_000);

  const holding = (over: Partial<Asset>): Asset => ({ id: 'x', name: 'x', category: 'fx', amount: 0, updatedAt: '', ...over });
  const { updated, missing } = await refreshPrices(
    [
      holding({ id: 'usd', symbol: 'USD', quantity: 1_000 }),
      holding({ id: 'gold', category: 'gold', symbol: 'XAU', quantity: 5 }),
      holding({ id: 'sjc', category: 'gold', symbol: 'SJC', quantity: 10, priceMode: 'manual', price: 15_000_000 }),
      holding({ id: 'xxx', symbol: 'XXX', quantity: 1 }),
    ],
    fakeFetch,
  );
  assert.deepEqual(updated.map((a) => [a.id, a.amount]), [
    ['usd', 26_000_000],
    ['gold', 62_500_000],
  ]);
  assert.deepEqual(missing, ['XXX']);
});

const tx = (id: string, category: string, amount: number, date: string, kind: Transaction['kind'] = 'expense'): Transaction => ({
  id,
  kind,
  category,
  amount,
  note: '',
  date,
});

test('compareMonths and yearReport', () => {
  const list = [
    tx('a', 'food', 3_000_000, '2026-10-05'),
    tx('b', 'food', 3_600_000, '2026-11-05'),
    tx('c', 'shopping', 2_000_000, '2026-10-06'),
    tx('d', 'health', 500_000, '2026-11-07'),
    tx('e', 'salary', 20_000_000, '2026-11-01', 'income'),
    tx('f', 'salary', 20_000_000, '2026-10-01', 'income'),
  ];
  assert.deepEqual(
    compareMonths(list, '2026-11', TRANSACTION_CATEGORIES).map((c) => [c.category.id, c.change, c.percent]),
    [
      ['shopping', -2_000_000, -100],
      ['food', 600_000, 20],
      ['health', 500_000, null],
    ],
  );
  const year = yearReport(list, 2026, TRANSACTION_CATEGORIES);
  assert.deepEqual([year.income, year.expense, year.balance], [40_000_000, 9_100_000, 30_900_000]);
  assert.equal(year.savingsRate, 77.25);
  assert.deepEqual(year.topMonth, { month: '2026-10', expense: 5_000_000 });
  assert.equal(year.months.length, 12);
  assert.equal(yearReport([], 2025, TRANSACTION_CATEGORIES).topMonth, null);
});

test('netWorthSeries keeps the range in date order and formatCompact shortens amounts', () => {
  const snap = (date: string, netWorth: number): AssetSnapshot => ({ date, netWorth, totalAssets: netWorth, totalDebt: 0, amounts: {} });
  const series = netWorthSeries([snap('2026-11-10', 3), snap('2026-08-01', 1), snap('2026-10-20', 2)], '2026-11-10', 30);
  assert.deepEqual(series, [
    { date: '2026-10-20', value: 2 },
    { date: '2026-11-10', value: 3 },
  ]);
  assert.deepEqual(
    [1_250_000_000, 35_000_000, 1_500_000, 500_000, -2_000_000, 900].map(formatCompact),
    ['1,3 tỷ', '35tr', '1,5tr', '500k', '-2tr', '900'],
  );
});

test('CSV export round-trips through import', () => {
  const assets: Asset[] = [
    { id: 'w1', name: 'Tiền mặt', category: 'cash', amount: 0, updatedAt: '' },
    { id: 'w2', name: 'Vietcombank', category: 'bank', amount: 0, updatedAt: '' },
  ];
  const list: Transaction[] = [
    { id: 'a', kind: 'expense', category: 'food', amount: 35_000, note: 'Cà phê, "sữa"', date: '2026-11-10', accountId: 'w1' },
    { id: 'b', kind: 'income', category: 'salary', amount: 20_000_000, note: '', date: '2026-11-01', accountId: 'w2' },
    { id: 'c', kind: 'transfer', category: '', amount: 2_000_000, note: 'Rút ATM', date: '2026-11-02', accountId: 'w2', toAccountId: 'w1' },
  ];
  const csv = toCsv(list, TRANSACTION_CATEGORIES, assets);
  assert.ok(csv.startsWith('﻿Ngày,Loại,Danh mục,Số tiền,Ghi chú,Ví,Ví nhận\r\n'));
  assert.ok(csv.includes('"Cà phê, ""sữa"""'));

  const { entries, errors } = importCsv(csv, TRANSACTION_CATEGORIES, assets);
  assert.deepEqual(errors, []);
  const strip = ({ id: _id, ...rest }: Transaction) => rest;
  const clean = (o: object) => JSON.parse(JSON.stringify(o));
  assert.deepEqual(
    entries.map(clean),
    [...list].sort((x, y) => x.date.localeCompare(y.date)).map(strip).map(clean),
  );
});

test('CSV import accepts other layouts and reports bad rows', () => {
  assert.deepEqual(parseCsv('a;b\r\n"x;1";2\n'), [
    ['a', 'b'],
    ['x;1', '2'],
  ]);
  assert.equal(parseDateCell('5/11/2026'), '2026-11-05');
  assert.equal(parseDateCell('31/02/2026'), null);

  const text = 'Date;Amount;Description;Category\n05/11/2026;-45.000;Bún chả;Ăn uống\n06/11/2026;1,5tr;Bán đồ cũ;\nabc;10k;x;\n07/11/2026;;y;\n';
  const { entries, errors } = importCsv(text, TRANSACTION_CATEGORIES, []);
  assert.deepEqual(
    entries.map((e) => [e.date, e.kind, e.category, e.amount, e.note]),
    [
      ['2026-11-05', 'expense', 'food', 45_000, 'Bún chả'],
      ['2026-11-06', 'income', 'other-income', 1_500_000, 'Bán đồ cũ'],
    ],
  );
  assert.deepEqual(errors, ['Dòng 4: ngày không hợp lệ.', 'Dòng 5: số tiền không hợp lệ.']);
  assert.deepEqual(importCsv('x,y\n1,2\n', TRANSACTION_CATEGORIES, []).errors, ['Thiếu cột "Ngày" hoặc "Số tiền" ở dòng tiêu đề.']);
});
