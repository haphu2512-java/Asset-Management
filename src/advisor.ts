import Anthropic from '@anthropic-ai/sdk';
import {
  formatMonth,
  formatVnd,
  monthKey,
  shiftMonth,
  summarize,
  summarizeMonth,
  getTransactionCategory,
  type Asset,
  type Transaction,
} from './finance';

const SYSTEM_PROMPT = `Bạn là cố vấn tài chính cá nhân cho một người dùng ở Việt Nam. Bạn nhận được số liệu tài sản và thu chi của họ (đơn vị VND).

Hãy trả lời bằng tiếng Việt, ngắn gọn, thân thiện và dựa trên chính số liệu được cung cấp:
1. Nhận xét tổng quan về tình hình tài chính (tài sản ròng, cơ cấu tài sản, dòng tiền tháng này so với các tháng trước).
2. Chỉ ra 2-3 điểm đáng chú ý, ví dụ khoản chi chiếm tỷ trọng lớn, tỷ lệ tiết kiệm, mức độ rủi ro của danh mục, quỹ dự phòng.
3. Đưa ra 3-5 lời khuyên cụ thể, có con số khi có thể.

Nếu dữ liệu còn ít, hãy nói rõ và gợi ý họ nên nhập thêm gì. Không khuyên mua mã cổ phiếu hay đồng crypto cụ thể. Trình bày dạng văn bản thuần với tiêu đề ngắn và gạch đầu dòng "-", không dùng ký hiệu markdown như ** hay #.`;

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

export async function getFinancialAdvice(
  apiKey: string,
  assets: Asset[],
  transactions: Transaction[],
  question?: string,
): Promise<string> {
  // The key is the user's own and stays on their device; the app has no backend.
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
  const snapshot = buildFinanceSnapshot(assets, transactions);
  const ask = question?.trim()
    ? `Câu hỏi của tôi: ${question.trim()}`
    : 'Hãy phân tích tình hình tài chính của tôi và cho lời khuyên.';

  const response = await client.beta.messages.create({
    model: 'claude-opus-5-5',
    max_tokens: 16000,
    output_config: { effort: 'medium' },
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `Số liệu tài chính hiện tại của tôi (ngày ${now()}):\n\n${snapshot}\n\n${ask}`,
      },
    ],
  });

  if (response.stop_reason === 'refusal') {
    throw new Error('AI từ chối trả lời yêu cầu này. Hãy thử đặt câu hỏi khác.');
  }
  const text = response.content
    .flatMap((block) => (block.type === 'text' ? [block.text] : []))
    .join('\n')
    .trim();
  if (!text) throw new Error('AI không trả về nội dung. Hãy thử lại.');
  return text;
}

function now(): string {
  const d = new Date();
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
}

/** Maps SDK errors to a short Vietnamese message for the UI. */
export function describeAdviceError(error: unknown): string {
  if (error instanceof Anthropic.AuthenticationError) {
    return 'API key không hợp lệ. Hãy kiểm tra lại trong phần Cài đặt.';
  }
  if (error instanceof Anthropic.RateLimitError) {
    return 'Đang gửi quá nhiều yêu cầu. Hãy thử lại sau ít phút.';
  }
  if (error instanceof Anthropic.APIConnectionError) {
    return 'Không kết nối được tới máy chủ AI. Hãy kiểm tra mạng.';
  }
  if (error instanceof Anthropic.APIError) {
    return `Lỗi từ máy chủ AI (${error.status ?? 'không rõ'}). Hãy thử lại.`;
  }
  return error instanceof Error ? error.message : 'Đã có lỗi xảy ra.';
}
