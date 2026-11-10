import { isMarketPriced, type Asset } from './finance.ts';
import { GRAMS_PER_CHI, GRAMS_PER_TROY_OUNCE } from './investments.ts';

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

/**
 * VND per unit of each foreign currency (USD, EUR, JPY...), from the open.er-api.com daily rates.
 * These are mid-market rates, so they differ slightly from a bank's buy/sell board.
 */
export async function fetchFxRates(symbols: string[], fetcher: Fetch = fetch): Promise<Record<string, number>> {
  if (symbols.length === 0) return {};
  const res = await fetcher('https://open.er-api.com/v6/latest/USD');
  if (!res.ok) return {};
  const data = (await res.json()) as { result?: string; rates?: Record<string, number> };
  const vndPerUsd = data.rates?.VND;
  if (data.result !== 'success' || !vndPerUsd) return {};
  const prices: Record<string, number> = {};
  for (const symbol of new Set(symbols.map((s) => s.toUpperCase()))) {
    const perUsd = data.rates?.[symbol];
    if (perUsd && perUsd > 0) prices[symbol] = vndPerUsd / perUsd;
  }
  return prices;
}

/**
 * World gold price in VND per "chỉ" (3,75 g), from the gold-backed token XAUT on CoinGecko
 * (1 token = 1 troy ounce). Domestic SJC gold trades at a premium over this; holdings that
 * should follow the SJC board are kept at a price typed by the user instead (priceMode 'manual').
 */
export async function fetchGoldPrice(fetcher: Fetch = fetch): Promise<number | null> {
  const perOunce = (await fetchCryptoPrices(['xaut'], fetcher)).XAUT;
  return perOunce ? Math.round((perOunce * GRAMS_PER_CHI) / GRAMS_PER_TROY_OUNCE) : null;
}

export type PriceRefresh = {
  /** Assets whose price was updated, with amount recomputed. */
  updated: Asset[];
  /** Symbols no price could be found for. */
  missing: string[];
};

/** Looks up market prices for every holding that has a symbol and quantity and follows the market. */
export async function refreshPrices(assets: Asset[], fetcher: Fetch = fetch): Promise<PriceRefresh> {
  const priced = assets.filter(isMarketPriced);
  const symbolsOf = (category: Asset['category']) =>
    [...new Set(priced.filter((a) => a.category === category).map((a) => a.symbol!.toUpperCase()))];
  const stockSymbols = symbolsOf('stock');

  const [crypto, stockEntries, fx, gold] = await Promise.all([
    fetchCryptoPrices(symbolsOf('crypto'), fetcher).catch(() => ({}) as Record<string, number>),
    Promise.all(
      stockSymbols.map(async (s) => [s, await fetchStockPrice(s, fetcher).catch(() => null)] as const),
    ),
    fetchFxRates(symbolsOf('fx'), fetcher).catch(() => ({}) as Record<string, number>),
    symbolsOf('gold').length > 0 ? fetchGoldPrice(fetcher).catch(() => null) : null,
  ]);
  const stock = Object.fromEntries(stockEntries);

  const now = new Date().toISOString();
  const updated: Asset[] = [];
  const missing = new Set<string>();
  for (const asset of priced) {
    const symbol = asset.symbol!.toUpperCase();
    const price =
      asset.category === 'crypto'
        ? crypto[symbol]
        : asset.category === 'fx'
          ? fx[symbol]
          : asset.category === 'gold'
            ? gold
            : stock[symbol];
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
