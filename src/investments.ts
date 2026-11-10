import type { Asset } from './finance.ts';

export type TradeSide = 'buy' | 'sell' | 'dividend' | 'bonus';

/** One event in a holding's history. */
export type Trade = {
  id: string;
  assetId: string;
  side: TradeSide;
  /** "YYYY-MM-DD". */
  date: string;
  /** Units bought, sold or received as a stock dividend; 0 for cash dividends. */
  quantity: number;
  /** Price per unit in VND; for a cash dividend, the total amount received. */
  price: number;
  /** Fees and taxes in VND. */
  fee: number;
  note?: string;
  /** Wallet that paid for a buy or received a sale / dividend. */
  accountId?: string;
  /** The transfer recorded in that wallet, removed together with the trade. */
  transactionId?: string;
};

export const TRADE_LABEL: Record<TradeSide, string> = {
  buy: 'Mua',
  sell: 'Bán',
  dividend: 'Cổ tức tiền mặt',
  bonus: 'Cổ tức cổ phiếu / thưởng',
};

export type Position = {
  quantity: number;
  /** What the units still held cost, fees included. */
  costBasis: number;
  /** Average cost per unit; 0 when nothing is held. */
  averageCost: number;
  /** Profit or loss already locked in by selling. */
  realized: number;
  /** Cash dividends received. */
  dividends: number;
};

/**
 * Replays trades in date order using the average-cost method: a sale realizes the difference
 * between its proceeds and the average cost of the units sold; bonus shares lower the average.
 */
export function positionFromTrades(trades: Trade[]): Position {
  const ordered = [...trades].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  let quantity = 0;
  let costBasis = 0;
  let realized = 0;
  let dividends = 0;
  for (const t of ordered) {
    if (t.side === 'buy') {
      quantity += t.quantity;
      costBasis += t.quantity * t.price + t.fee;
    } else if (t.side === 'sell') {
      const sold = Math.min(t.quantity, quantity);
      const average = quantity > 0 ? costBasis / quantity : 0;
      realized += sold * t.price - t.fee - sold * average;
      costBasis -= sold * average;
      quantity -= sold;
    } else if (t.side === 'bonus') {
      quantity += t.quantity;
    } else {
      dividends += t.price - t.fee;
    }
  }
  // Float noise from fractional crypto quantities must not leave a ghost position behind.
  if (quantity < 1e-9) {
    quantity = 0;
    costBasis = 0;
  }
  return {
    quantity,
    costBasis: Math.round(costBasis),
    averageCost: quantity > 0 ? costBasis / quantity : 0,
    realized: Math.round(realized),
    dividends: Math.round(dividends),
  };
}

export type Performance = Position & {
  marketValue: number;
  /** Profit or loss on the units still held. */
  unrealized: number;
  /** Unrealized change relative to cost, in percent; null without a cost basis. */
  unrealizedPercent: number | null;
  /** Unrealized + realized + dividends. */
  totalReturn: number;
};

export function performance(position: Position, marketValue: number): Performance {
  const unrealized = position.costBasis > 0 ? Math.round(marketValue - position.costBasis) : 0;
  return {
    ...position,
    marketValue,
    unrealized,
    unrealizedPercent: position.costBasis > 0 ? (unrealized / position.costBasis) * 100 : null,
    totalReturn: unrealized + position.realized + position.dividends,
  };
}

/** Cash a trade moves through the wallet: negative when paying, positive when receiving. */
export function tradeCashFlow(trade: Pick<Trade, 'side' | 'quantity' | 'price' | 'fee'>): number {
  if (trade.side === 'buy') return -Math.round(trade.quantity * trade.price + trade.fee);
  if (trade.side === 'sell') return Math.round(trade.quantity * trade.price - trade.fee);
  if (trade.side === 'dividend') return Math.round(trade.price - trade.fee);
  return 0;
}

/** Totals over all holdings that have a cost basis. */
export function portfolioPerformance(
  assets: Asset[],
  trades: Trade[],
): { cost: number; value: number; unrealized: number; realized: number; dividends: number } {
  const total = { cost: 0, value: 0, unrealized: 0, realized: 0, dividends: 0 };
  const byAsset = new Map<string, Trade[]>();
  for (const t of trades) byAsset.set(t.assetId, [...(byAsset.get(t.assetId) ?? []), t]);
  for (const [assetId, list] of byAsset) {
    const asset = assets.find((a) => a.id === assetId);
    if (!asset) continue;
    const p = performance(positionFromTrades(list), asset.amount);
    total.realized += p.realized;
    total.dividends += p.dividends;
    if (p.costBasis > 0) {
      total.cost += p.costBasis;
      total.value += p.marketValue;
      total.unrealized += p.unrealized;
    }
  }
  return total;
}

/** Grams in one "chỉ" of gold and in one troy ounce, to convert world prices. */
export const GRAMS_PER_CHI = 3.75;
export const GRAMS_PER_TROY_OUNCE = 31.1034768;

/** Whole days from `from` to `to` ("YYYY-MM-DD"); negative when `to` is earlier. */
export function daysBetween(from: string, to: string): number {
  const utc = (key: string) => {
    const [y, m, d] = key.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((utc(to) - utc(from)) / 86_400_000);
}

/** Simple interest on `principal` at `ratePercent` per year between two dates (365-day year). */
export function simpleInterest(principal: number, ratePercent: number, from: string, to: string): number {
  const days = Math.max(0, daysBetween(from, to));
  return Math.round((principal * ratePercent * days) / 36_500);
}

export type InterestInfo = {
  /** Interest earned or owed from the start date to today (capped at the due date). */
  accrued: number;
  /** Interest for the whole term; null without a due date. */
  atMaturity: number | null;
  /** Days until the due date; negative once it has passed; null without one. */
  daysLeft: number | null;
};

/** Interest for a term deposit, loan or debt that has a rate and a start date. */
export function interestInfo(asset: Asset, today: string): InterestInfo | null {
  if (!asset.interestRate || !asset.startDate) return null;
  const until = asset.dueDate && asset.dueDate < today ? asset.dueDate : today;
  return {
    accrued: simpleInterest(asset.amount, asset.interestRate, asset.startDate, until),
    atMaturity: asset.dueDate
      ? simpleInterest(asset.amount, asset.interestRate, asset.startDate, asset.dueDate)
      : null,
    daysLeft: asset.dueDate ? daysBetween(today, asset.dueDate) : null,
  };
}
