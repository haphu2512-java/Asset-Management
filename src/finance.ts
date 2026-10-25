export type CategoryId = 'cash' | 'bank' | 'saving' | 'stock' | 'crypto' | 'lent' | 'debt';

export type Category = {
  id: CategoryId;
  label: string;
  color: string;
  /** Debts reduce net worth instead of adding to it. */
  isLiability: boolean;
};

export const CATEGORIES: Category[] = [
  { id: 'cash', label: 'Tiền mặt', color: '#2E7D32', isLiability: false },
  { id: 'bank', label: 'Tài khoản ngân hàng', color: '#2E7D32', isLiability: false },
  { id: 'saving', label: 'Tiết kiệm', color: '#2E7D32', isLiability: false },
  { id: 'stock', label: 'Cổ phiếu', color: '#1565C0', isLiability: false },
  { id: 'crypto', label: 'Crypto', color: '#F9A825', isLiability: false },
  { id: 'lent', label: 'Cho vay', color: '#6A1B9A', isLiability: false },
  { id: 'debt', label: 'Đang nợ', color: '#C62828', isLiability: true },
];

export function getCategory(id: CategoryId): Category {
  return CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[0];
}

export type Asset = {
  id: string;
  name: string;
  category: CategoryId;
  /** Amount in VND, always a non-negative integer. */
  amount: number;
  updatedAt: string;
  /** Ticker for market-priced assets, e.g. "FPT" or "BTC". */
  symbol?: string;
  /** Units held; with a price, amount = quantity × price. */
  quantity?: number;
  /** Last market price per unit in VND. */
  price?: number;
  priceUpdatedAt?: string;
};

/** Stock and crypto holdings can follow the market when they have a symbol and quantity. */
export function isMarketPriced(asset: Pick<Asset, 'category' | 'symbol' | 'quantity'>): boolean {
  return (
    (asset.category === 'stock' || asset.category === 'crypto') &&
    !!asset.symbol &&
    (asset.quantity ?? 0) > 0
  );
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

export type TransactionKind = 'income' | 'expense';

export type TransactionCategory = {
  id: string;
  label: string;
  kind: TransactionKind;
  color: string;
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

export function getTransactionCategory(id: string): TransactionCategory {
  return (
    TRANSACTION_CATEGORIES.find((c) => c.id === id) ??
    TRANSACTION_CATEGORIES[TRANSACTION_CATEGORIES.length - 1]
  );
}

export type Transaction = {
  id: string;
  kind: TransactionKind;
  category: string;
  /** Amount in VND, always a positive integer. */
  amount: number;
  note: string;
  /** Local calendar date, "YYYY-MM-DD". */
  date: string;
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

export type DaySummary = {
  date: string;
  income: number;
  expense: number;
  balance: number;
  /** Expense categories with spending in this day, largest first. */
  expenseByCategory: { category: TransactionCategory; amount: number }[];
};

export function summarizeDay(transactions: Transaction[], date: string): DaySummary {
  const inDay = transactions.filter((t) => t.date === date);
  const sum = (kind: TransactionKind) =>
    inDay.filter((t) => t.kind === kind).reduce((s, t) => s + t.amount, 0);
  const income = sum('income');
  const expense = sum('expense');
  const expenseByCategory = TRANSACTION_CATEGORIES.filter((c) => c.kind === 'expense')
    .map((category) => ({
      category,
      amount: inDay
        .filter((t) => t.kind === 'expense' && t.category === category.id)
        .reduce((s, t) => s + t.amount, 0),
    }))
    .filter((c) => c.amount > 0)
    .sort((a, b) => b.amount - a.amount);
  return { date, income, expense, balance: income - expense, expenseByCategory };
}

export type MonthSummary = {
  month: string;
  income: number;
  expense: number;
  balance: number;
  /** Expense categories with spending, largest first. */
  expenseByCategory: { category: TransactionCategory; amount: number }[];
};

export function summarizeMonth(transactions: Transaction[], month: string): MonthSummary {
  const inMonth = transactions.filter((t) => monthKey(t.date) === month);
  const sum = (kind: TransactionKind) =>
    inMonth.filter((t) => t.kind === kind).reduce((s, t) => s + t.amount, 0);
  const income = sum('income');
  const expense = sum('expense');
  const expenseByCategory = TRANSACTION_CATEGORIES.filter((c) => c.kind === 'expense')
    .map((category) => ({
      category,
      amount: inMonth
        .filter((t) => t.kind === 'expense' && t.category === category.id)
        .reduce((s, t) => s + t.amount, 0),
    }))
    .filter((c) => c.amount > 0)
    .sort((a, b) => b.amount - a.amount);
  return { month, income, expense, balance: income - expense, expenseByCategory };
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
};

export type GoalProgress = {
  /** 0..1 share of the target already saved. */
  ratio: number;
  remaining: number;
  /** Whole months left until the deadline, at least 1 while the goal is open. */
  monthsLeft: number;
  /** What must be saved each month from now on to hit the target on time, or recurring amount. */
  monthlyNeeded: number;
  overdue: boolean;
  /** Whether the user already contributed in the current month / period */
  contributedThisPeriod: boolean;
  /** Label for current month, e.g. "tháng 10/2026" */
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

  const curMonth = monthKey(now);
  const contributedThisPeriod = !!goal.lastContributedAt && goal.lastContributedAt.startsWith(curMonth);
  const currentPeriodLabel = formatMonth(curMonth);

  const isRecurring = goal.type === 'recurring';
  const monthlyNeeded = isRecurring && goal.recurringAmount
    ? goal.recurringAmount
    : (remaining === 0 ? 0 : Math.ceil(remaining / monthsLeft));

  return {
    ratio,
    remaining,
    monthsLeft,
    monthlyNeeded,
    overdue,
    contributedThisPeriod,
    currentPeriodLabel,
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
  const kind = getTransactionCategory(category).kind;
  const note = text.replace(match[0].trim(), '').replace(/\s+/g, ' ').trim();
  return { kind, category, amount, note, date: today };
}
