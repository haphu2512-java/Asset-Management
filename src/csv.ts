import {
  getTransactionCategory,
  isValidDateKey,
  parseVnd,
  type Asset,
  type Transaction,
  type TransactionCategory,
  type TransactionKind,
} from './finance.ts';
import { foldText } from './ledger.ts';

export const CSV_HEADER = ['Ngày', 'Loại', 'Danh mục', 'Số tiền', 'Ghi chú', 'Ví', 'Ví nhận'];

const KIND_LABEL: Record<TransactionKind, string> = { income: 'Thu', expense: 'Chi', transfer: 'Chuyển khoản' };

const escapeCell = (value: string) => (/[",\n\r;]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);

/** Transactions as CSV, oldest first. Starts with a BOM so Excel reads the Vietnamese text as UTF-8. */
export function toCsv(transactions: Transaction[], categories: TransactionCategory[], assets: Asset[]): string {
  const name = (id?: string) => assets.find((a) => a.id === id)?.name ?? '';
  const rows = [...transactions]
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))
    .map((t) => [
      t.date,
      KIND_LABEL[t.kind],
      t.kind === 'transfer' ? '' : getTransactionCategory(t.category, categories).label,
      String(t.amount),
      t.note,
      name(t.accountId),
      name(t.toAccountId),
    ]);
  return '﻿' + [CSV_HEADER, ...rows].map((row) => row.map(escapeCell).join(',')).join('\r\n') + '\r\n';
}

/** Splits CSV text into rows of cells. Handles quotes, escaped quotes, CRLF and `;` as separator. */
export function parseCsv(text: string): string[][] {
  const input = text.replace(/^﻿/, '');
  const firstLine = input.split(/\r?\n/, 1)[0] ?? '';
  const separator = firstLine.split(';').length > firstLine.split(',').length ? ';' : ',';
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (quoted) {
      if (ch === '"' && input[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === separator) {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && input[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  if (cell !== '' || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

/** Column names (folded) each field may appear under, so files from other apps and Excel import too. */
const COLUMNS: Record<string, string[]> = {
  date: ['ngay', 'date'],
  kind: ['loai', 'type', 'kind'],
  category: ['danh muc', 'category', 'nhom'],
  amount: ['so tien', 'amount', 'gia tri'],
  note: ['ghi chu', 'note', 'mo ta', 'description'],
  account: ['vi', 'tai khoan', 'account', 'wallet'],
  toAccount: ['vi nhan', 'to account', 'den'],
};

/** "21/10/2026", "21-10-2026" or "2026-10-21" → "2026-10-21"; null when it is not a real date. */
export function parseDateCell(value: string): string | null {
  const text = value.trim();
  const iso = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  const vn = text.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/);
  const [y, m, d] = iso ? [iso[1], iso[2], iso[3]] : vn ? [vn[3], vn[2], vn[1]] : [];
  if (!y) return null;
  const key = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  return isValidDateKey(key) ? key : null;
}

export type CsvImport = {
  /** Transactions ready to save, without ids. */
  entries: Omit<Transaction, 'id'>[];
  /** One message per row that was skipped. */
  errors: string[];
};

/**
 * Reads transactions from CSV text. Needs at least a date and an amount column. A negative
 * amount means an expense; unknown categories fall back to "Chi khác" / "Thu khác".
 */
export function importCsv(text: string, categories: TransactionCategory[], assets: Asset[]): CsvImport {
  const rows = parseCsv(text);
  if (rows.length < 2) return { entries: [], errors: ['File không có dòng dữ liệu nào.'] };
  const header = rows[0].map((h) => foldText(h.trim()));
  const column = (field: string) => header.findIndex((h) => COLUMNS[field].includes(h));
  const idx = {
    date: column('date'),
    kind: column('kind'),
    category: column('category'),
    amount: column('amount'),
    note: column('note'),
    account: column('account'),
    toAccount: column('toAccount'),
  };
  if (idx.date < 0 || idx.amount < 0) {
    return { entries: [], errors: ['Thiếu cột "Ngày" hoặc "Số tiền" ở dòng tiêu đề.'] };
  }

  const cell = (row: string[], i: number) => (i >= 0 ? (row[i] ?? '').trim() : '');
  const accountId = (name: string) =>
    name ? assets.find((a) => foldText(a.name) === foldText(name))?.id : undefined;
  // When the file marks expenses with a minus sign, an unsigned amount without other hints is income.
  const signed = idx.kind < 0 && rows.slice(1).some((r) => cell(r, idx.amount).trim().startsWith('-'));
  const entries: CsvImport['entries'] = [];
  const errors: string[] = [];

  rows.slice(1).forEach((row, i) => {
    const line = i + 2;
    const date = parseDateCell(cell(row, idx.date));
    if (!date) return void errors.push(`Dòng ${line}: ngày không hợp lệ.`);
    const rawAmount = cell(row, idx.amount).replace(/[₫đ\s]/gi, '');
    const negative = rawAmount.startsWith('-');
    const amount = parseVnd(rawAmount.replace(/^[+-]/, ''));
    if (!amount) return void errors.push(`Dòng ${line}: số tiền không hợp lệ.`);

    const kindText = foldText(cell(row, idx.kind));
    const categoryText = foldText(cell(row, idx.category));
    const matched = categoryText ? categories.find((c) => foldText(c.label) === categoryText) : undefined;
    const kind: TransactionKind = /chuyen|transfer/.test(kindText)
      ? 'transfer'
      : /thu|income/.test(kindText)
        ? 'income'
        : /chi|expense/.test(kindText)
          ? 'expense'
          : (matched?.kind ?? (!negative && signed ? 'income' : 'expense'));

    const from = accountId(cell(row, idx.account));
    const to = accountId(cell(row, idx.toAccount));
    if (kind === 'transfer') {
      if (!from && !to) return void errors.push(`Dòng ${line}: chuyển khoản cần tên ví có trong app.`);
      entries.push({ kind, category: '', amount, note: cell(row, idx.note), date, accountId: from, toAccountId: to });
      return;
    }
    const category =
      matched && matched.kind === kind ? matched.id : kind === 'income' ? 'other-income' : 'other-expense';
    entries.push({ kind, category, amount, note: cell(row, idx.note).slice(0, 200), date, accountId: from });
  });
  return { entries, errors };
}
