import {
  TRANSACTION_CATEGORIES,
  formatVnd,
  getTransactionCategory,
  isValidDateKey,
  quickParse,
  todayKey,
  type QuickEntry,
} from './finance.ts';
import { supabase } from './supabase';

export type ReceiptImage = { data: string; mediaType: string };

export type QuickEntryResult = {
  entries: QuickEntry[];
  /** True when the AI was unreachable and the offline parser was used instead. */
  offline: boolean;
};

/** Keeps only well-formed entries whose category matches their kind. */
export function sanitizeEntries(raw: unknown, today = todayKey()): QuickEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item): QuickEntry[] => {
    const amount = Math.round(Number(item?.amount));
    const category = TRANSACTION_CATEGORIES.find((c) => c.id === item?.category);
    if (!category || !Number.isFinite(amount) || amount <= 0) return [];
    const date = typeof item?.date === 'string' && isValidDateKey(item.date) ? item.date : today;
    const note = typeof item?.note === 'string' ? item.note.trim().slice(0, 200) : '';
    return [{ kind: category.kind, category: category.id, amount, note, date }];
  });
}

/**
 * Turns "cafe 35k" or a receipt photo into transactions with the `parse-transaction`
 * Edge Function. Text input falls back to the offline parser if the AI is unavailable.
 */
export async function parseQuickEntry(input: { text?: string; image?: ReceiptImage }): Promise<QuickEntryResult> {
  const today = todayKey();
  const { data, error } = await supabase.functions.invoke('parse-transaction', {
    body: {
      text: input.text ?? '',
      image: input.image,
      today,
      categories: TRANSACTION_CATEGORIES.map(({ id, label, kind }) => ({ id, label, kind })),
    },
  });

  if (!error) {
    const entries = sanitizeEntries(data?.transactions, today);
    if (entries.length > 0 || input.image) return { entries, offline: false };
  }

  const status = error ? (error as { context?: Response }).context?.status : undefined;
  // An expired session must be reported, not hidden behind the offline parser.
  if (status === 401) throw new Error('Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.');

  if (input.text) {
    const local = quickParse(input.text, today);
    if (local) return { entries: [local], offline: true };
  }
  if (error) {
    if (status === 429) throw new Error('Đã hết lượt AI hôm nay hoặc AI đang quá tải. Hãy thử lại sau.');
    throw new Error('Không kết nối được AI. Hãy thử lại.');
  }
  throw new Error(
    input.image ? 'Không đọc được số tiền trên hoá đơn.' : 'Không tìm thấy số tiền. Ví dụ: "cafe 35k".',
  );
}

export function describeEntry(entry: QuickEntry): string {
  const label = getTransactionCategory(entry.category).label;
  const sign = entry.kind === 'income' ? '+' : '-';
  return `${entry.note || label} (${label}) ${sign}${formatVnd(entry.amount)}`;
}
