import { budgetStatuses, type Budget } from './budgets';
import {
  formatMonth,
  formatVnd,
  getGoalCategory,
  getTransactionCategory,
  goalProgress,
  isSpendable,
  monthKey,
  shiftMonth,
  summarize,
  summarizeMonth,
  todayKey,
  type Asset,
  type Goal,
  type Transaction,
  type TransactionCategory,
} from './finance';
import { monthlyAmount, type Recurring } from './recurring';
import { supabase, unauthorizedMessage } from './supabase';

/** Everything the advisor may look at. */
export type AdvisorData = {
  assets: Asset[];
  transactions: Transaction[];
  goals: Goal[];
  categories: TransactionCategory[];
  budgets?: Budget[];
  recurring?: Recurring[];
};

export type ChatMessage = { role: 'user' | 'model'; text: string };

export type AdviceReply = {
  text: string;
  /** Daily AI request limit, when the server reports it. */
  limit?: number;
};

/** Builds a compact plain-text snapshot of the user's finances for the model. */
export function buildFinanceSnapshot(data: AdvisorData, now = new Date()): string {
  const { assets, transactions, goals, categories, budgets = [], recurring = [] } = data;
  const lines: string[] = [];
  const s = summarize(assets);
  lines.push('TÀI SẢN');
  for (const c of s.byCategory) {
    if (c.amount > 0) lines.push(`- ${c.category.label}: ${formatVnd(c.amount)}`);
  }
  lines.push(`Tổng tài sản: ${formatVnd(s.totalAssets)}`);
  lines.push(`Tổng nợ: ${formatVnd(s.totalDebt)}`);
  lines.push(`Tài sản ròng: ${formatVnd(s.netWorth)}`);
  const liquid = assets.filter((a) => isSpendable(a) && a.category !== 'debt').reduce((sum, a) => sum + a.amount, 0);
  lines.push(`Tiền có thể tiêu ngay (tiền mặt, ngân hàng): ${formatVnd(liquid)}`);

  const current = monthKey(now);
  lines.push('', 'THU CHI 3 THÁNG GẦN NHẤT (không tính chuyển khoản giữa các ví)');
  for (let i = 2; i >= 0; i--) {
    const m = summarizeMonth(transactions, shiftMonth(current, -i), categories);
    lines.push(
      `${formatMonth(m.month)}: thu ${formatVnd(m.income)}, chi ${formatVnd(m.expense)}, còn lại ${formatVnd(m.balance)}`,
    );
    for (const c of m.expenseByCategory) {
      lines.push(`  - ${c.category.label}: ${formatVnd(c.amount)}`);
    }
  }

  const statuses = budgetStatuses(budgets, summarizeMonth(transactions, current, categories), categories);
  if (statuses.length > 0) {
    lines.push('', `NGÂN SÁCH ${formatMonth(current).toUpperCase()}`);
    for (const b of statuses) {
      lines.push(
        `- ${b.category.label}: đã chi ${formatVnd(b.spent)}/${formatVnd(b.budget.amount)}` +
          (b.level === 'over' ? ' (vượt)' : b.level === 'warn' ? ' (sắp hết)' : ''),
      );
    }
  }

  const active = recurring.filter((r) => r.active && r.kind !== 'transfer');
  if (active.length > 0) {
    lines.push('', 'KHOẢN ĐỊNH KỲ (quy ra mỗi tháng)');
    for (const r of active) {
      const sign = r.kind === 'income' ? '+' : '-';
      lines.push(`- ${r.note || getTransactionCategory(r.category, categories).label}: ${sign}${formatVnd(monthlyAmount(r))}`);
    }
  }

  const recent = transactions
    .filter((t) => t.kind !== 'transfer' && monthKey(t.date) === current)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 50);
  if (recent.length > 0) {
    lines.push('', `GIAO DỊCH ${formatMonth(current).toUpperCase()}`);
    for (const t of recent) {
      const sign = t.kind === 'income' ? '+' : '-';
      const note = t.note ? ` (${t.note})` : '';
      lines.push(`${t.date} ${sign}${formatVnd(t.amount)} ${getTransactionCategory(t.category, categories).label}${note}`);
    }
  }

  if (goals.length > 0) {
    lines.push('', 'MỤC TIÊU TÀI CHÍNH');
    for (const g of goals) {
      const p = goalProgress(g, now);
      const cat = getGoalCategory(g.category);
      if (g.type === 'recurring') {
        lines.push(
          `- [Định kỳ: ${cat.label}] ${g.name}: đã góp ${formatVnd(g.saved)}/${formatVnd(g.target)}, ` +
            `kế hoạch ${formatVnd(p.periodAmount)}/${p.periodUnit} (${p.contributedThisPeriod ? 'kỳ này đã góp' : 'kỳ này chưa góp'})`,
        );
      } else {
        lines.push(
          `- [${cat.label}] ${g.name}: đã có ${formatVnd(g.saved)}/${formatVnd(g.target)}, hạn ${g.deadline}, ` +
            `cần ${formatVnd(p.monthlyNeeded)}/tháng trong ${p.monthsLeft} tháng${p.overdue ? ' (đã quá hạn)' : ''}`,
        );
      }
    }
  }
  return lines.join('\n');
}

/**
 * Asks the `advisor` Edge Function (which holds the Gemini key) for advice.
 * `history` is the conversation so far, so follow-up questions keep their context.
 */
export async function askAdvisor(data: AdvisorData, question = '', history: ChatMessage[] = []): Promise<AdviceReply> {
  const { data: body, error } = await supabase.functions.invoke('advisor', {
    body: {
      snapshot: buildFinanceSnapshot(data),
      question: question.trim(),
      date: todayKey(),
      history: history.slice(-12),
    },
  });

  if (error) {
    const res = (error as { context?: Response }).context;
    const detail = res ? await res.json().catch(() => null) : null;
    if (res?.status === 429) {
      throw new Error(detail?.error ?? 'Đang gửi quá nhiều yêu cầu. Hãy thử lại sau ít phút.');
    }
    if (res?.status === 401) {
      throw new Error(unauthorizedMessage(detail));
    }
    if (!res) throw new Error('Không có mạng. Cố vấn AI cần kết nối Internet.');
    throw new Error(detail?.error ? `Lỗi AI: ${detail.error}` : 'Không kết nối được cố vấn AI. Hãy thử lại.');
  }

  const text = typeof body?.text === 'string' ? body.text.trim() : '';
  if (!text) throw new Error('AI không trả về nội dung. Hãy thử lại.');
  return { text, limit: typeof body?.limit === 'number' ? body.limit : undefined };
}

/** AI requests the user has made today, or null when the server cannot say. */
export async function aiUsageToday(): Promise<number | null> {
  const { data, error } = await supabase.rpc('ai_usage_today');
  return error || typeof data !== 'number' ? null : data;
}

/** Maps errors to a short Vietnamese message for the UI. */
export function describeAdviceError(error: unknown): string {
  return error instanceof Error ? error.message : 'Đã có lỗi xảy ra.';
}

/** The question sent to the advisor about one savings goal. */
export function goalQuestion(goal: Goal): string {
  const p = goalProgress(goal);
  const category = getGoalCategory(goal.category);
  const name = goal.name.slice(0, 80);
  return goal.type === 'recurring'
    ? `Tôi có kế hoạch tích lũy định kỳ "${name}" (${category.label}): góp ${formatVnd(p.periodAmount)} mỗi ${p.periodUnit}, ` +
        `mục tiêu ${formatVnd(goal.target)}, đã tích lũy ${formatVnd(goal.saved)}. ` +
        `Với thu chi hiện tại, kế hoạch này có phù hợp không và làm sao để duy trì đều đặn?`
    : `Tôi muốn đạt mục tiêu "${name}" (${category.label}): ${formatVnd(goal.target)} trước ngày ${goal.deadline}, ` +
        `hiện đã có ${formatVnd(goal.saved)}, cần để dành khoảng ${formatVnd(p.monthlyNeeded)} mỗi tháng. ` +
        `Mục tiêu này có khả thi không, nên cắt giảm khoản chi nào và giữ tiền ở đâu?`;
}
