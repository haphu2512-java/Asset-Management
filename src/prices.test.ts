import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Asset } from './finance.ts';
import { pricesAreStale, refreshPrices } from './prices.ts';

const respond = (body: unknown) =>
  ({ ok: true, json: async () => body }) as unknown as Response;

const fakeFetch = (async (url: string) => {
  if (url.includes('coingecko')) return respond({ btc: { vnd: 2_500_000_000 } });
  if (url.includes('symbol=FPT')) return respond({ s: 'ok', c: [80.5, 86.087] });
  return respond({ s: 'no_data' });
}) as typeof fetch;

const asset = (over: Partial<Asset>): Asset => ({
  id: over.symbol ?? 'x',
  name: 'x',
  category: 'stock',
  amount: 0,
  updatedAt: '2026-10-01T00:00:00.000Z',
  ...over,
});

test('refreshPrices recomputes amount from quantity × price', async () => {
  const { updated, missing } = await refreshPrices(
    [
      asset({ category: 'crypto', symbol: 'btc', quantity: 0.01 }),
      asset({ category: 'stock', symbol: 'FPT', quantity: 100 }),
      asset({ category: 'stock', symbol: 'ZZZ', quantity: 5 }),
      asset({ category: 'cash', amount: 5 }),
    ],
    fakeFetch,
  );
  assert.deepEqual(
    updated.map((a) => [a.symbol, a.price, a.amount]),
    [
      ['btc', 2_500_000_000, 25_000_000],
      ['FPT', 86_087, 8_608_700],
    ],
  );
  assert.deepEqual(missing, ['ZZZ']);
});

test('pricesAreStale only looks at market-priced assets', () => {
  const now = Date.parse('2026-10-21T10:00:00.000Z');
  assert.equal(pricesAreStale([asset({ category: 'cash' })], now), false);
  assert.equal(pricesAreStale([asset({ symbol: 'FPT', quantity: 1 })], now), true);
  assert.equal(
    pricesAreStale([asset({ symbol: 'FPT', quantity: 1, priceUpdatedAt: '2026-10-21T09:55:00.000Z' })], now),
    false,
  );
});
