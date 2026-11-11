export type CategoryId = 'cash' | 'bank' | 'saving' | 'stock' | 'crypto' | 'gold' | 'fx' | 'lent' | 'debt';

export type Category = {
  id: CategoryId;
  label: string;
  color: string;
  /** Debts reduce net worth instead of adding to it. */
  isLiability: boolean;
};

/** Each category has its own hue so slices stay distinguishable on the donut chart. */
export const CATEGORIES: Category[] = [
  { id: 'cash', label: 'Tiền mặt', color: '#2E7D32', isLiability: false },
  { id: 'bank', label: 'Tài khoản ngân hàng', color: '#0277BD', isLiability: false },
  { id: 'saving', label: 'Tiết kiệm', color: '#00897B', isLiability: false },
  { id: 'stock', label: 'Cổ phiếu', color: '#5E35B1', isLiability: false },
  { id: 'crypto', label: 'Crypto', color: '#EF6C00', isLiability: false },
  { id: 'gold', label: 'Vàng', color: '#C49000', isLiability: false },
  { id: 'fx', label: 'Ngoại tệ', color: '#6D4C41', isLiability: false },
  { id: 'lent', label: 'Cho vay', color: '#AD1457', isLiability: false },
  { id: 'debt', label: 'Đang nợ', color: '#C62828', isLiability: true },
];

export function getCategory(id: CategoryId): Category {
  return CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[0];
}

/** Categories whose value can follow a market price (quantity × price). */
export const MARKET_CATEGORIES: CategoryId[] = ['stock', 'crypto', 'gold', 'fx'];

export type Asset = {
  id: string;
  name: string;
  category: CategoryId;
  /** Amount in VND. Wallets may go below zero when more was spent than recorded. */
  amount: number;
  updatedAt: string;
  /** Ticker for market-priced assets, e.g. "FPT", "BTC", "USD" or "XAU". */
  symbol?: string;
  /** Units held; with a price, amount = quantity × price. Gold is counted in "chỉ". */
  quantity?: number;
  /** Last price per unit in VND. */
  price?: number;
  priceUpdatedAt?: string;
  /** 'manual' keeps the price the user typed (e.g. SJC gold) instead of refreshing it. */
  priceMode?: 'market' | 'manual';
  /** Yearly interest rate in percent, for savings, loans and debts. */
  interestRate?: number;
  /** Deposit / loan start date, "YYYY-MM-DD". */
  startDate?: string;
  /** Maturity date of a term deposit, or due date of a loan/debt, "YYYY-MM-DD". */
  dueDate?: string;
  /** Who the money was lent to or borrowed from. */
  counterparty?: string;
  note?: string;
};

/** Holdings valued as quantity × price (auto-refreshed or typed by hand). */
export function isHolding(asset: Pick<Asset, 'category' | 'symbol' | 'quantity'>): boolean {
  return MARKET_CATEGORIES.includes(asset.category) && !!asset.symbol && (asset.quantity ?? 0) > 0;
}

/** Holdings whose price is refreshed from the market. */
export function isMarketPriced(
  asset: Pick<Asset, 'category' | 'symbol' | 'quantity' | 'priceMode'>,
): boolean {
  return isHolding(asset) && asset.priceMode !== 'manual';
}

/** Cash-like accounts a purchase can be paid from. Debts count too (credit cards). */
export function isSpendable(asset: Pick<Asset, 'category'>): boolean {
  return asset.category === 'cash' || asset.category === 'bank' || asset.category === 'debt';
}

/** Accounts money can be moved into or out of: everything that is not valued by quantity × price. */
export function isAccount(asset: Pick<Asset, 'category' | 'symbol' | 'quantity'>): boolean {
  return !isHolding(asset);
}

export type Summary = {
  totalAssets: number;
  totalDebt: number;
  netWorth: number;
  byCategory: { category: Category; amount: number }[];
};

export function summarize(assets: Asset[]): Summary {
  const byCategory = CATEGORIES.map((category) => ({
    category,
    amount: assets
      .filter((a) => a.category === category.id)
      .reduce((sum, a) => sum + a.amount, 0),
  }));
  const totalAssets = byCategory
    .filter((c) => !c.category.isLiability)
    .reduce((sum, c) => sum + c.amount, 0);
  const totalDebt = byCategory
    .filter((c) => c.category.isLiability)
    .reduce((sum, c) => sum + c.amount, 0);
  return { totalAssets, totalDebt, netWorth: totalAssets - totalDebt, byCategory };
}

/** Formats 23000000 as "23.000.000 ₫" (Vietnamese grouping). */
export function formatVnd(amount: number): string {
  return `${formatDigits(amount)} ₫`;
}

/** Groups digits with dots, keeping a leading minus sign. */
export function formatDigits(amount: number): string {
  const sign = amount < 0 ? '-' : '';
  const digits = Math.round(Math.abs(amount)).toString();
  return sign + digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/**
 * Parses user input into VND. Accepts "23.000.000", "23000000",
 * and shorthand suffixes: "23000k" or "23tr" / "23m" (millions), "1ty" / "1b" (billions).
 * Returns null when the input is not a valid amount.
 */
export function parseVnd(input: string): number | null {
  const text = input.trim().toLowerCase().replace(/\s+/g, '');
  const match = text.match(/^([\d.,]+)(k|tr|m|ty|tỷ|b)?$/);
  if (!match) return null;
  const [, numberPart, suffix] = match;
  const multiplier =
    suffix === 'k' ? 1e3 : suffix === 'tr' || suffix === 'm' ? 1e6 : suffix ? 1e9 : 1;

  let value: number;
  if (suffix) {
    // With a suffix, a lone separator not followed by exactly three digits is a
    // decimal point ("1,5tr" = 1.500.000), otherwise it groups thousands ("23.000k").
    const isDecimal = /^\d+[.,](\d{1,2}|\d{4,})$/.test(numberPart);
    value = isDecimal
      ? Number(numberPart.replace(',', '.'))
      : Number(numberPart.replace(/[.,]/g, ''));
  } else {
    value = Number(numberPart.replace(/[.,]/g, ''));
  }
  if (!Number.isFinite(value) || numberPart.replace(/[.,]/g, '') === '') return null;
  return Math.round(value * multiplier);
}

/**
 * Like parseVnd, but also adds and subtracts: "35k+20k" = 55.000, "1tr-200k" = 800.000.
 * Returns null when any part is invalid or the result is not positive.
 */
export function parseVndExpression(input: string): number | null {
  const text = input.replace(/\s+/g, '');
  if (!text) return null;
  const parts = text.split(/(?=[+-])/);
  let total = 0;
  for (const [i, part] of parts.entries()) {
    const negative = part.startsWith('-');
    const body = part.replace(/^[+-]/, '');
    if (i === 0 && negative) return null;
    const value = parseVnd(body);
    if (value === null) return null;
    total += negative ? -value : value;
  }
  return total > 0 ? total : null;
}

export type TransactionKind = 'income' | 'expense' | 'transfer';
/** Kinds that have categories and count towards income/expense reports. */
export type FlowKind = 'income' | 'expense';

export type TransactionCategory = {
  id: string;
  label: string;
  kind: FlowKind;
  color: string;
  /** Icon name; defaults to the id for built-in categories. */
  icon?: string;
  /** Sub-categories roll up into their parent in reports and budgets. */
  parentId?: string;
  /** Hidden categories stay on old transactions but are not offered for new ones. */
  hidden?: boolean;
  /** True for categories the user added. */
  custom?: boolean;
};

export const TRANSACTION_CATEGORIES: TransactionCategory[] = [
  { id: 'salary', label: 'Lương', kind: 'income', color: '#2E7D32' },
  { id: 'bonus', label: 'Thưởng', kind: 'income', color: '#558B2F' },
  { id: 'investment', label: 'Đầu tư', kind: 'income', color: '#00838F' },
  { id: 'other-income', label: 'Thu khác', kind: 'income', color: '#5D4037' },
  { id: 'food', label: 'Ăn uống', kind: 'expense', color: '#EF6C00' },
  { id: 'transport', label: 'Đi lại', kind: 'expense', color: '#1565C0' },
  { id: 'housing', label: 'Nhà ở', kind: 'expense', color: '#6A1B9A' },
  { id: 'bills', label: 'Hoá đơn', kind: 'expense', color: '#AD1457' },
  { id: 'shopping', label: 'Mua sắm', kind: 'expense', color: '#F9A825' },
  { id: 'entertainment', label: 'Giải trí', kind: 'expense', color: '#00897B' },
  { id: 'health', label: 'Sức khoẻ', kind: 'expense', color: '#C62828' },
  { id: 'education', label: 'Học tập', kind: 'expense', color: '#3949AB' },
  { id: 'other-expense', label: 'Chi khác', kind: 'expense', color: '#757575' },
];

/** A category row saved by the user: a new category, or an override of a built-in one (same id). */
export type CustomCategory = {
  id: string;
  kind: FlowKind;
  label: string;
  color: string;
  icon?: string;
  parentId?: string;
  hidden?: boolean;
};

/** Built-in categories with the user's overrides applied, followed by the user's own categories. */
export function mergeCategories(custom: CustomCategory[]): TransactionCategory[] {
  const byId = new Map(custom.map((c) => [c.id, c]));
  const builtIn = TRANSACTION_CATEGORIES.map((c) => {
    const o = byId.get(c.id);
    // A built-in category keeps its kind, so old transactions stay on the right side of the ledger.
    return o ? { ...c, label: o.label, color: o.color, icon: o.icon ?? c.icon, hidden: o.hidden } : c;
  });
  const builtInIds = new Set(TRANSACTION_CATEGORIES.map((c) => c.id));
  const own = custom
    .filter((c) => !builtInIds.has(c.id))
    .map((c) => ({ ...c, custom: true }));
  // A parent must exist, be of the same kind and be a top-level category.
  const all = [...builtIn, ...own];
  return all.map((c) => {
    const parent = c.parentId ? all.find((p) => p.id === c.parentId) : undefined;
    return parent && parent.kind === c.kind && !parent.parentId && parent.id !== c.id
      ? c
      : { ...c, parentId: undefined };
  });
}

export function getTransactionCategory(
  id: string,
  categories: TransactionCategory[] = TRANSACTION_CATEGORIES,
): TransactionCategory {
  return (
    categories.find((c) => c.id === id) ??
    TRANSACTION_CATEGORIES.find((c) => c.id === id) ??
    TRANSACTION_CATEGORIES[TRANSACTION_CATEGORIES.length - 1]
  );
}

/** The top-level category a (sub-)category reports under. */
export function rootCategory(
  id: string,
  categories: TransactionCategory[] = TRANSACTION_CATEGORIES,
): TransactionCategory {
  const c = getTransactionCategory(id, categories);
  return c.parentId ? getTransactionCategory(c.parentId, categories) : c;
}

export type Transaction = {
  id: string;
  kind: TransactionKind;
  /** Category id for income/expense; empty for transfers. */
  category: string;
  /** Amount in VND, always a positive integer. */
  amount: number;
  note: string;
  /** Local calendar date, "YYYY-MM-DD". */
  date: string;
  /** Wallet the money came from (expense, transfer) or went to (income). */
  accountId?: string;
  /** Destination of a transfer. A transfer with only one side is a balance adjustment. */
  toAccountId?: string;
  /** Recurring rule that created this transaction. */
  recurringId?: string;
};

/** "YYYY-MM" for a "YYYY-MM-DD" date or a Date. */
export function monthKey(date: string | Date): string {
  if (typeof date === 'string') return date.slice(0, 7);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function todayKey(now = new Date()): string {
  return `${monthKey(now)}-${String(now.getDate()).padStart(2, '0')}`;
}

/** True for a real calendar date "YYYY-MM-DD"; rejects dates like "2026-02-31" that Date.parse rolls over. */
export function isValidDateKey(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const [y, m, d] = date.split('-').map(Number);
  return todayKey(new Date(y, m - 1, d)) === date;
}

/** The date `months` months after `from`, clamped to the end of a shorter month (31/1 + 1 → 28/2). */
export function addMonths(months: number, from = new Date()): string {
  const target = new Date(from.getFullYear(), from.getMonth() + months, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(from.getDate(), lastDay));
  return todayKey(target);
}

/** Shifts a "YYYY-MM" key by a number of months. */
export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  return monthKey(new Date(y, m - 1 + delta, 1));
}

export function formatMonth(month: string): string {
  const [y, m] = month.split('-');
  return `Tháng ${Number(m)}/${y}`;
}

/** Shifts a "YYYY-MM-DD" calendar date key by `deltaDays` days. */
export function shiftDay(date: string, deltaDays: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(y, m - 1, d + deltaDays);
  return todayKey(dt);
}

/**
 * Formats a "YYYY-MM-DD" date into a friendly Vietnamese string,
 * e.g. "Hôm nay, 25/10", "Hôm qua, 24/10", "Thứ Bảy, 25/10/2026".
 */
export function formatDay(date: string, now = new Date()): string {
  const today = todayKey(now);
  const yesterday = shiftDay(today, -1);
  const tomorrow = shiftDay(today, 1);
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(y, m - 1, d);

  const daysOfWeek = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
  const dayName = daysOfWeek[dt.getDay()];
  const formatted = `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;

  if (date === today) return `Hôm nay, ${formatted}`;
  if (date === yesterday) return `Hôm qua, ${formatted}`;
  if (date === tomorrow) return `Ngày mai, ${formatted}`;
  return `${dayName}, ${formatted}`;
}

export type FlowSummary = {
  income: number;
  expense: number;
  balance: number;
  /** Top-level expense categories with spending, largest first. Sub-categories are rolled up. */
  expenseByCategory: { category: TransactionCategory; amount: number }[];
};

/** Income, expense and spending per top-level category for a list of transactions. Transfers are ignored. */
export function summarizeFlows(
  transactions: Transaction[],
  categories: TransactionCategory[] = TRANSACTION_CATEGORIES,
): FlowSummary {
  let income = 0;
  let expense = 0;
  const byRoot = new Map<string, { category: TransactionCategory; amount: number }>();
  for (const t of transactions) {
    if (t.kind === 'income') income += t.amount;
    if (t.kind !== 'expense') continue;
    expense += t.amount;
    const root = rootCategory(t.category, categories);
    const entry = byRoot.get(root.id) ?? { category: root, amount: 0 };
    entry.amount += t.amount;
    byRoot.set(root.id, entry);
  }
  const expenseByCategory = [...byRoot.values()].sort((a, b) => b.amount - a.amount);
  return { income, expense, balance: income - expense, expenseByCategory };
}

export type DaySummary = FlowSummary & { date: string };

export function summarizeDay(
  transactions: Transaction[],
  date: string,
  categories: TransactionCategory[] = TRANSACTION_CATEGORIES,
): DaySummary {
  return { date, ...summarizeFlows(transactions.filter((t) => t.date === date), categories) };
}

export type MonthSummary = FlowSummary & { month: string };

export function summarizeMonth(
  transactions: Transaction[],
  month: string,
  categories: TransactionCategory[] = TRANSACTION_CATEGORIES,
): MonthSummary {
  return { month, ...summarizeFlows(transactions.filter((t) => monthKey(t.date) === month), categories) };
}

export type GoalType = 'target_amount' | 'recurring';
export type GoalFrequency = 'monthly' | 'weekly' | 'quarterly';
export type GoalCategoryId =
  | 'etf'
  | 'stock'
  | 'saving'
  | 'emergency'
  | 'housing'
  | 'shopping'
  | 'education'
  | 'other';

export type GoalCategory = {
  id: GoalCategoryId;
  label: string;
  icon: string;
  color: string;
};

export const GOAL_CATEGORIES: GoalCategory[] = [
  { id: 'etf', label: 'Quỹ ETF / Đầu tư', icon: 'stock', color: '#00838F' },
  { id: 'saving', label: 'Tiết kiệm tích lũy', icon: 'saving', color: '#2E7D32' },
  { id: 'emergency', label: 'Quỹ khẩn cấp', icon: 'shield', color: '#1565C0' },
  { id: 'housing', label: 'Mua nhà / Mua xe', icon: 'housing', color: '#6A1B9A' },
  { id: 'shopping', label: 'Mua sắm lớn', icon: 'shopping', color: '#F9A825' },
  { id: 'education', label: 'Du lịch / Học tập', icon: 'education', color: '#AD1457' },
  { id: 'other', label: 'Khác', icon: 'goals', color: '#757575' },
];

export function getGoalCategory(id?: string): GoalCategory {
  return GOAL_CATEGORIES.find((c) => c.id === id) ?? GOAL_CATEGORIES[0];
}

export type Goal = {
  id: string;
  name: string;
  /** Target amount in VND. */
  target: number;
  /** Amount already put aside in VND. */
  saved: number;
  /** Target date, "YYYY-MM-DD". */
  deadline: string;
  /** Goal mode: recurring (góp định kỳ ETF/tiết kiệm) or target_amount (mục tiêu số tiền lớn) */
  type?: GoalType;
  /** Category of the goal */
  category?: GoalCategoryId;
  /** Planned contribution per period (e.g. 400.000đ/tháng) */
  recurringAmount?: number;
  /** Contribution frequency. Default: 'monthly' */
  frequency?: GoalFrequency;
  /** Date of last contribution: "YYYY-MM-DD" */
  lastContributedAt?: string;
  /** Total number of contributions made */
  contributionsCount?: number;
  /** Account that holds this goal's money; contributions from a wallet are transferred into it. */
  assetId?: string;
};

/** One payment into a goal. */
export type GoalContribution = {
  id: string;
  goalId: string;
  amount: number;
  /** "YYYY-MM-DD". */
  date: string;
  /** Wallet the money was taken from, when the contribution moved real money. */
  accountId?: string;
  /** The transfer recorded for this contribution, removed together with it. */
  transactionId?: string;
};

const FREQUENCY_UNIT: Record<GoalFrequency, string> = { weekly: 'tuần', monthly: 'tháng', quarterly: 'quý' };

/** "tuần", "tháng" or "quý". */
export function frequencyUnit(frequency: GoalFrequency = 'monthly'): string {
  return FREQUENCY_UNIT[frequency];
}

/** Contribution periods in one month, used to compare schedules of different frequencies. */
export function periodsPerMonth(frequency: GoalFrequency = 'monthly'): number {
  return frequency === 'weekly' ? 52 / 12 : frequency === 'quarterly' ? 1 / 3 : 1;
}

/** Monday of the week a date falls in, "YYYY-MM-DD". */
export function weekStart(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const day = new Date(y, m - 1, d).getDay();
  return shiftDay(date, -((day + 6) % 7));
}

/** Identifies the contribution period a date falls in: the week's Monday, "YYYY-MM" or "YYYY-Qn". */
export function periodKey(date: string, frequency: GoalFrequency = 'monthly'): string {
  if (frequency === 'weekly') return weekStart(date);
  if (frequency === 'quarterly') {
    const [y, m] = date.split('-').map(Number);
    return `${y}-Q${Math.floor((m - 1) / 3) + 1}`;
  }
  return monthKey(date);
}

/** "tuần này", "tháng 10/2026" or "quý 4/2026". */
export function periodLabel(date: string, frequency: GoalFrequency = 'monthly'): string {
  if (frequency === 'weekly') return 'tuần này';
  if (frequency === 'quarterly') {
    const [y, q] = periodKey(date, 'quarterly').split('-Q');
    return `quý ${q}/${y}`;
  }
  return formatMonth(monthKey(date)).toLowerCase();
}

export type GoalProgress = {
  /** 0..1 share of the target already saved. */
  ratio: number;
  remaining: number;
  /** Whole months left until the deadline, at least 1 while the goal is open. */
  monthsLeft: number;
  /** What must be saved each month from now on (recurring plans: the plan's monthly equivalent). */
  monthlyNeeded: number;
  /** Planned or needed contribution for one period of the goal's frequency. */
  periodAmount: number;
  /** "tuần", "tháng" or "quý". */
  periodUnit: string;
  overdue: boolean;
  /** Whether the user already contributed in the current week / month / quarter. */
  contributedThisPeriod: boolean;
  /** Label for the current period, e.g. "tháng 10/2026". */
  currentPeriodLabel: string;
};

export function goalProgress(goal: Goal, now = new Date()): GoalProgress {
  const remaining = Math.max(0, goal.target - goal.saved);
  const ratio = goal.target > 0 ? Math.min(1, goal.saved / goal.target) : 0;
  const [y, m, d] = goal.deadline.split('-').map(Number);
  let months = (y - now.getFullYear()) * 12 + (m - 1 - now.getMonth());
  if (d < now.getDate()) months -= 1;
  const overdue = remaining > 0 && new Date(y, m - 1, d) < new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const monthsLeft = Math.max(1, months);

  const frequency = goal.frequency ?? 'monthly';
  const today = todayKey(now);
  const contributedThisPeriod =
    !!goal.lastContributedAt && periodKey(goal.lastContributedAt, frequency) === periodKey(today, frequency);

  const neededPerMonth = remaining === 0 ? 0 : Math.ceil(remaining / monthsLeft);
  const planned = goal.type === 'recurring' && goal.recurringAmount ? goal.recurringAmount : null;
  const perMonth = periodsPerMonth(frequency);
  const monthlyNeeded = planned ? Math.round(planned * perMonth) : neededPerMonth;
  const periodAmount = planned ?? Math.ceil(neededPerMonth / perMonth);

  return {
    ratio,
    remaining,
    monthsLeft,
    monthlyNeeded,
    periodAmount,
    periodUnit: frequencyUnit(frequency),
    overdue,
    contributedThisPeriod,
    currentPeriodLabel: periodLabel(today, frequency),
  };
}

/** Keywords for the offline quick-entry fallback; the AI handles everything else. */
const QUICK_KEYWORDS: [string, string[]][] = [
  ['salary', ['lương', 'luong', 'salary']],
  ['bonus', ['thưởng', 'thuong', 'bonus']],
  ['transport', ['xăng', 'xang', 'grab', 'be', 'taxi', 'gửi xe', 'gui xe', 'vé xe', 've xe', 'xe buýt', 'bus']],
  [
    'food',
    ['cafe', 'cà phê', 'ca phe', 'cf', 'trà sữa', 'tra sua', 'ăn', 'cơm', 'com', 'phở', 'pho', 'bún', 'bun',
      'bánh', 'banh', 'nhậu', 'nhau', 'đi chợ', 'di cho', 'food'],
  ],
  ['housing', ['tiền nhà', 'tien nha', 'thuê nhà', 'thue nha', 'nhà trọ', 'nha tro']],
  ['bills', ['điện', 'dien', 'nước', 'nuoc', 'internet', 'wifi', 'điện thoại', '4g', 'hoá đơn', 'hóa đơn', 'hoa don']],
  ['shopping', ['mua', 'quần áo', 'quan ao', 'áo', 'giày', 'giay', 'shopee', 'lazada', 'tiki']],
  ['entertainment', ['phim', 'game', 'du lịch', 'du lich', 'karaoke', 'netflix', 'spotify']],
  ['health', ['thuốc', 'thuoc', 'bệnh viện', 'benh vien', 'khám', 'kham', 'gym']],
  ['education', ['sách', 'sach', 'học', 'hoc', 'khoá học', 'khoa hoc']],
];

/** Whole-word match, so "ăn" does not match inside "xăng". */
const hasWord = (text: string, word: string) =>
  new RegExp(`(^|[^\\p{L}\\p{N}])${word}($|[^\\p{L}\\p{N}])`, 'u').test(text);

export type QuickEntry = Omit<Transaction, 'id'>;

/**
 * Offline parser for quick entries like "cafe 35k" or "lương 20tr".
 * Returns null when no amount can be found.
 */
export function quickParse(text: string, today = todayKey()): QuickEntry | null {
  const lower = text.normalize('NFC').trim().toLowerCase();
  const match = lower.match(/(\d[\d.,]*\s*(?:k|tr|m|tỷ|ty|b)?)(?![\p{L}\d])/u);
  if (!match) return null;
  const amount = parseVnd(match[1]);
  if (!amount) return null;
  const words = (lower.slice(0, match.index) + ' ' + lower.slice(match.index! + match[0].length)).trim();
  const category =
    QUICK_KEYWORDS.find(([, keywords]) => keywords.some((k) => hasWord(words, k)))?.[0] ?? 'other-expense';
  const kind: TransactionKind = getTransactionCategory(category).kind;
  const note = text.replace(match[0].trim(), '').replace(/\s+/g, ' ').trim();
  return { kind, category, amount, note, date: today };
}

/** End-of-day picture of the user's assets, used to show change since the previous day. */
export type AssetSnapshot = {
  /** Local calendar date, "YYYY-MM-DD". */
  date: string;
  netWorth: number;
  totalAssets: number;
  totalDebt: number;
  /** Amount of each asset by id, so single holdings can be compared too. */
  amounts: Record<string, number>;
};

export function takeSnapshot(assets: Asset[], date: string): AssetSnapshot {
  const s = summarize(assets);
  return {
    date,
    netWorth: s.netWorth,
    totalAssets: s.totalAssets,
    totalDebt: s.totalDebt,
    amounts: Object.fromEntries(assets.map((a) => [a.id, a.amount])),
  };
}

export function sameSnapshot(a: AssetSnapshot, b: AssetSnapshot): boolean {
  const aIds = Object.keys(a.amounts);
  return (
    a.date === b.date &&
    a.netWorth === b.netWorth &&
    a.totalAssets === b.totalAssets &&
    a.totalDebt === b.totalDebt &&
    aIds.length === Object.keys(b.amounts).length &&
    aIds.every((id) => a.amounts[id] === b.amounts[id])
  );
}

/** The latest snapshot from before `today`: yesterday's, or the last day the app was used. */
export function previousSnapshot(snapshots: AssetSnapshot[], today: string): AssetSnapshot | null {
  return snapshots
    .filter((s) => s.date < today)
    .reduce<AssetSnapshot | null>((best, s) => (!best || s.date > best.date ? s : best), null);
}

export type Change = {
  amount: number;
  /** Change relative to the previous value; null when the previous value was 0. */
  percent: number | null;
  direction: 'up' | 'down' | 'flat';
};

export function compareValue(current: number, previous: number): Change {
  const amount = Math.round(current - previous);
  return {
    amount,
    percent: previous === 0 ? null : (amount / Math.abs(previous)) * 100,
    direction: amount > 0 ? 'up' : amount < 0 ? 'down' : 'flat',
  };
}

/** Formats a change as "+1.250.000 ₫ (+2,35%)". */
export function formatChange(change: Change): string {
  const sign = change.amount > 0 ? '+' : change.amount < 0 ? '-' : '';
  const money = `${sign}${formatVnd(Math.abs(change.amount))}`;
  if (change.percent === null) return money;
  const pct = Math.abs(change.percent).toFixed(2).replace('.', ',');
  return `${money} (${sign}${pct}%)`;
}

/** "so với hôm qua", or the baseline date when the app was not opened yesterday. */
export function changeLabel(baselineDate: string, today: string): string {
  if (baselineDate === shiftDay(today, -1)) return 'so với hôm qua';
  const [, m, d] = baselineDate.split('-');
  return `so với ${d}/${m}`;
}
