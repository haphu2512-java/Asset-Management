import { isMarketPriced, type Asset } from './finance.ts';

type Fetch = typeof fetch;

/** Prices older than this are refreshed automatically when the Assets tab opens. */
export const PRICE_MAX_AGE_MS = 15 * 60 * 1000;

/**
 * Latest close for a Vietnamese stock (HOSE/HNX/UPCOM) in VND, from VNDirect's chart API.
 * The API quotes prices in thousands of VND.
 */
export async function fetchStockPrice(symbol: string, fetcher: Fetch = fetch): Promise<number | null> {
  const to = Math.floor(Date.now() / 1000);
  const from = to - 14 * 24 * 3600;
  const url =
    'https://dchart-api.vndirect.com.vn/dchart/history?resolution=D' +
    `&symbol=${encodeURIComponent(symbol.toUpperCase())}&from=${from}&to=${to}`;
  const res = await fetcher(url);
  if (!res.ok) return null;
  const data = (await res.json()) as { s?: string; c?: number[] };
  const close = data.s === 'ok' ? data.c?.[data.c.length - 1] : undefined;
  return typeof close === 'number' && close > 0 ? Math.round(close * 1000) : null;
}

/** Prices in VND for crypto symbols such as BTC or ETH, from CoinGecko. Keys are upper-case symbols. */
export async function fetchCryptoPrices(
  symbols: string[],
  fetcher: Fetch = fetch,
): Promise<Record<string, number>> {
  if (symbols.length === 0) return {};
  const list = [...new Set(symbols.map((s) => s.toLowerCase()))].join(',');
  const res = await fetcher(
    `https://api.coingecko.com/api/v3/simple/price?vs_currencies=vnd&symbols=${encodeURIComponent(list)}`,
  );
  if (!res.ok) return {};
  const data = (await res.json()) as Record<string, { vnd?: number }>;
  const prices: Record<string, number> = {};
  for (const [key, value] of Object.entries(data)) {
    if (typeof value?.vnd === 'number' && value.vnd > 0) prices[key.toUpperCase()] = value.vnd;
  }
  return prices;
}

export type PriceRefresh = {
  /** Assets whose price was updated, with amount recomputed. */
  updated: Asset[];
  /** Symbols no price could be found for. */
  missing: string[];
};

/** Looks up market prices for every stock/crypto asset that has a symbol and quantity. */
export async function refreshPrices(assets: Asset[], fetcher: Fetch = fetch): Promise<PriceRefresh> {
  const priced = assets.filter(isMarketPriced);
  const cryptoSymbols = priced.filter((a) => a.category === 'crypto').map((a) => a.symbol!);
  const stockSymbols = [...new Set(priced.filter((a) => a.category === 'stock').map((a) => a.symbol!.toUpperCase()))];

  const [crypto, stockEntries] = await Promise.all([
    fetchCryptoPrices(cryptoSymbols, fetcher).catch(() => ({}) as Record<string, number>),
    Promise.all(
      stockSymbols.map(async (s) => [s, await fetchStockPrice(s, fetcher).catch(() => null)] as const),
    ),
  ]);
  const stock = Object.fromEntries(stockEntries);

  const now = new Date().toISOString();
  const updated: Asset[] = [];
  const missing = new Set<string>();
  for (const asset of priced) {
    const symbol = asset.symbol!.toUpperCase();
    const price = asset.category === 'crypto' ? crypto[symbol] : stock[symbol];
    if (!price) {
      missing.add(symbol);
      continue;
    }
    updated.push({
      ...asset,
      price,
      priceUpdatedAt: now,
      amount: Math.round(price * asset.quantity!),
      updatedAt: now,
    });
  }
  return { updated, missing: [...missing] };
}

/** True when any market-priced asset has no price yet or a price older than PRICE_MAX_AGE_MS. */
export function pricesAreStale(assets: Asset[], now = Date.now()): boolean {
  return assets
    .filter(isMarketPriced)
    .some((a) => !a.priceUpdatedAt || now - Date.parse(a.priceUpdatedAt) > PRICE_MAX_AGE_MS);
}
