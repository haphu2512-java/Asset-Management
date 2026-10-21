import {
  formatMonth,
  formatVnd,
  monthKey,
  shiftMonth,
  summarize,
  summarizeMonth,
  todayKey,
  getTransactionCategory,
  type Asset,
  type Transaction,
} from './finance';
import { supabase } from './supabase';

/** Builds a compact plain-text snapshot of the user's finances for the model. */
export function buildFinanceSnapshot(
  assets: Asset[],
  transactions: Transaction[],
  now = new Date(),
): string {
  const lines: string[] = [];
  const s = summarize(assets);
  lines.push('TÀI SẢN');
  for (const c of s.byCategory) {
    if (c.amount > 0) lines.push(`- ${c.category.label}: ${formatVnd(c.amount)}`);
  }
  lines.push(`Tổng tài sản: ${formatVnd(s.totalAssets)}`);
  lines.push(`Tổng nợ: ${formatVnd(s.totalDebt)}`);
  lines.push(`Tài sản ròng: ${formatVnd(s.netWorth)}`);

  const current = monthKey(now);
  lines.push('', 'THU CHI 3 THÁNG GẦN NHẤT');
  for (let i = 2; i >= 0; i--) {
    const m = summarizeMonth(transactions, shiftMonth(current, -i));
    lines.push(
      `${formatMonth(m.month)}: thu ${formatVnd(m.income)}, chi ${formatVnd(m.expense)}, còn lại ${formatVnd(m.balance)}`,
    );
    for (const c of m.expenseByCategory) {
      lines.push(`  - ${c.category.label}: ${formatVnd(c.amount)}`);
    }
  }

  const recent = transactions
    .filter((t) => monthKey(t.date) === current)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 50);
  if (recent.length > 0) {
    lines.push('', `GIAO DỊCH ${formatMonth(current).toUpperCase()}`);
    for (const t of recent) {
      const sign = t.kind === 'income' ? '+' : '-';
      const note = t.note ? ` (${t.note})` : '';
      lines.push(`${t.date} ${sign}${formatVnd(t.amount)} ${getTransactionCategory(t.category).label}${note}`);
    }
  }
  return lines.join('\n');
}

/** Asks the `advisor` Edge Function (which holds the Anthropic key) for advice. */
export async function getFinancialAdvice(
  assets: Asset[],
  transactions: Transaction[],
  question?: string,
): Promise<string> {
  const { data, error } = await supabase.functions.invoke('advisor', {
    body: {
      snapshot: buildFinanceSnapshot(assets, transactions),
      question: question?.trim() ?? '',
      date: todayKey(),
    },
  });

  if (error) {
    const res = (error as { context?: Response }).context;
    const body = res ? await res.json().catch(() => null) : null;
    if (res?.status === 429) {
      throw new Error('Đang gửi quá nhiều yêu cầu. Hãy thử lại sau ít phút.');
    }
    if (res?.status === 401) {
      throw new Error('Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.');
    }
    throw new Error(body?.error ? `Lỗi AI: ${body.error}` : 'Không kết nối được cố vấn AI. Hãy thử lại.');
  }

  const text = typeof data?.text === 'string' ? data.text.trim() : '';
  if (!text) throw new Error('AI không trả về nội dung. Hãy thử lại.');
  return text;
}

/** Maps errors to a short Vietnamese message for the UI. */
export function describeAdviceError(error: unknown): string {
  return error instanceof Error ? error.message : 'Đã có lỗi xảy ra.';
}
