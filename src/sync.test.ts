import assert from 'node:assert/strict';
import test from 'node:test';
import type { Asset } from './finance.ts';
import { Draft, EMPTY, nextBatch, type Data } from './sync.ts';

const btc: Asset = {
  id: 'btc',
  name: 'BTC',
  category: 'crypto',
  amount: 100,
  updatedAt: '2026-11-15T00:00:00.000Z',
  symbol: 'BTC',
  quantity: 0.5,
  price: 200,
};
const data: Data = { ...EMPTY, owner: 'u', assets: [btc] };

test('a price patch writes only the named columns and only while the quantity matches', () => {
  const draft = new Draft(data, 'u');
  draft.patch('assets', { ...btc, price: 300, amount: 150, priceUpdatedAt: 'now' }, ['price', 'price_updated_at', 'amount'], ['quantity']);
  assert.equal(draft.data.assets[0].price, 300);
  assert.deepEqual(draft.ops, [
    {
      list: 'assets',
      type: 'update',
      id: 'btc',
      row: { price: 300, price_updated_at: 'now', amount: 150 },
      match: { quantity: 0.5 },
    },
  ]);
});

test('a patch never re-creates an item that is gone', () => {
  const draft = new Draft({ ...data, assets: [] }, 'u');
  draft.patch('assets', btc, ['price'], ['quantity']);
  assert.equal(draft.data.assets.length, 0);
  assert.equal(draft.ops.length, 0);
});

test('updates are sent one at a time, never folded into an upsert batch', () => {
  const draft = new Draft(data, 'u');
  draft.patch('assets', btc, ['price'], ['quantity']);
  draft.put('assets', { ...btc, id: 'eth' });
  assert.equal(nextBatch(draft.ops).length, 1);
  assert.equal(nextBatch(draft.ops)[0].type, 'update');
  assert.equal(nextBatch(draft.ops.slice(1))[0].type, 'upsert');
});
