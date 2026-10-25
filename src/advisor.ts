import {
  formatMonth,
  formatVnd,
  monthKey,
  shiftMonth,
  summarize,
  summarizeMonth,
  todayKey,
  getTransactionCategory,
  getGoalCategory,
  goalProgress,
  type Asset,
  type Goal,
  type Transaction,
} from './finance';
import { supabase, unauthorizedMessage } from './supabase';

/** Builds a compact plain-text snapshot of the user's finances for the model. */
export function buildFinanceSnapshot(
  assets: Asset[],
  transactions: Transaction[],
  goals: Goal[] = [],
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
  if (goals.length > 0) {
    lines.push('', 'MỤC TIÊU TÀI CHÍNH');
    for (const g of goals) {
      const p = goalProgress(g, now);
      const cat = getGoalCategory(g.category);
      if (g.type === 'recurring') {
        lines.push(
          `- [Định kỳ: ${cat.label}] ${g.name}: đã góp ${formatVnd(g.saved)}/${formatVnd(g.target)}, ` +
            `định kỳ ${formatVnd(g.recurringAmount || p.monthlyNeeded)}/tháng (${p.contributedThisPeriod ? 'kỳ này đã góp' : 'kỳ này chưa góp'})`,
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

/** Asks the `advisor` Edge Function (which holds the Gemini key) for advice. */
export async function getFinancialAdvice(
  assets: Asset[],
  transactions: Transaction[],
  question?: string,
  goals: Goal[] = [],
): Promise<string> {
  const { data, error } = await supabase.functions.invoke('advisor', {
    body: {
      snapshot: buildFinanceSnapshot(assets, transactions, goals),
      question: question?.trim() ?? '',
      date: todayKey(),
    },
  });

  if (error) {
    const res = (error as { context?: Response }).context;
    const body = res ? await res.json().catch(() => null) : null;
    if (res?.status === 429) {
      throw new Error(body?.error ?? 'Đang gửi quá nhiều yêu cầu. Hãy thử lại sau ít phút.');
    }
    if (res?.status === 401) {
      throw new Error(unauthorizedMessage(body));
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

/** Asks the advisor how to reach one savings goal, given the user's current cash flow. */
export function getGoalAdvice(
  goal: Goal,
  assets: Asset[],
  transactions: Transaction[],
  goals: Goal[],
): Promise<string> {
  const p = goalProgress(goal);
  const isRecurring = goal.type === 'recurring';
  const category = getGoalCategory(goal.category);
  const question = isRecurring
    ? `Tôi có kế hoạch tích lũy định kỳ "${goal.name.slice(0, 80)}" (loại: ${category.label}): ` +
      `góp ${formatVnd(goal.recurringAmount || p.monthlyNeeded)}/tháng, mục tiêu tích lũy ${formatVnd(goal.target)}. ` +
      `Hiện đã tích lũy được ${formatVnd(goal.saved)}. ` +
      `Với dòng tiền thu chi hiện tại, kế hoạch góp định kỳ này có phù hợp không? ` +
      `Làm sao để duy trì kỷ luật đóng góp đều đặn hàng tháng và tối ưu hóa việc đầu tư này? Trả lời ngắn gọn, thực tế.`
    : `Tôi muốn đạt mục tiêu "${goal.name.slice(0, 80)}" (loại: ${category.label}): ${formatVnd(goal.target)} trước ngày ${goal.deadline}, ` +
      `hiện đã có ${formatVnd(goal.saved)}. Theo tính toán cần để dành ${formatVnd(p.monthlyNeeded)}/tháng. ` +
      `Với thu chi hiện tại, mục tiêu này có khả thi không? Mỗi tháng tôi nên để dành bao nhiêu, ` +
      `cắt giảm khoản chi nào, và nên giữ khoản tiết kiệm ở đâu? Trả lời ngắn gọn.`;
  return getFinancialAdvice(assets, transactions, question, goals);
}
