import { useMemo, useState } from 'react';
import { budgetAlert, budgetStatuses } from '@shared/budgets';
import {
  formatDigits,
  isSpendable,
  monthKey,
  parseVndExpression,
  rootCategory,
  summarizeMonth,
  todayKey,
  type FlowKind,
  type Transaction,
  type TransactionKind,
} from '@shared/finance';
import { suggestNotes } from '@shared/ledger';
import { usePrefs } from '@shared/prefs';
import { newId, useStore } from '@shared/store';
import { useMoney } from '../hooks';
import { accountOptions, walletOptions } from './options';
import { useToast } from './Toast';
import { AmountInput, Chips, DateInput, Field, Modal, Segmented } from './ui';

const KINDS: { id: TransactionKind; label: string }[] = [
  { id: 'expense', label: 'Chi tiêu' },
  { id: 'income', label: 'Thu nhập' },
  { id: 'transfer', label: 'Chuyển khoản' },
];

/** Add or edit a transaction. `initial` with an id edits; without one it pre-fills a new transaction. */
export function TransactionForm({ initial, onClose }: { initial: Partial<Transaction> | null; onClose: () => void }) {
  const store = useStore();
  const { assets, categories, transactions, budgets } = store;
  const { prefs, setPrefs } = usePrefs();
  const toast = useToast();
  const format = useMoney();
  const existing = initial?.id ? (transactions.find((t) => t.id === initial.id) ?? null) : null;

  const defaultCategory = (k: TransactionKind): string => {
    if (k === 'transfer') return '';
    const remembered = prefs.lastCategory[k];
    const usable = categories.filter((c) => c.kind === k && !c.hidden);
    return (usable.find((c) => c.id === remembered) ?? usable.find((c) => !c.parentId) ?? usable[0])?.id ?? '';
  };
  const defaultAccount = (): string => {
    const wallets = assets.filter(isSpendable);
    const remembered = wallets.find((a) => a.id === prefs.lastAccountId);
    return remembered?.id ?? (wallets.length === 1 ? wallets[0].id : '');
  };

  const [kind, setKind] = useState<TransactionKind>(initial?.kind ?? 'expense');
  const [category, setCategory] = useState(initial?.category || defaultCategory(initial?.kind ?? 'expense'));
  const [amount, setAmount] = useState(initial?.amount ? formatDigits(initial.amount) : '');
  const [note, setNote] = useState(initial?.note ?? '');
  const [date, setDate] = useState(initial?.date ?? todayKey());
  const [accountId, setAccountId] = useState(
    initial?.id || initial?.accountId !== undefined ? (initial?.accountId ?? '') : defaultAccount(),
  );
  const [toAccountId, setToAccountId] = useState(initial?.toAccountId ?? '');
  const [error, setError] = useState('');

  const changeKind = (next: TransactionKind) => {
    setKind(next);
    setCategory(defaultCategory(next));
    setError('');
  };

  const flowKind: FlowKind | null = kind === 'transfer' ? null : kind;
  const root = flowKind && category ? rootCategory(category, categories) : null;
  const roots = useMemo(
    () => categories.filter((c) => c.kind === flowKind && !c.parentId && (!c.hidden || c.id === root?.id)),
    [categories, flowKind, root?.id],
  );
  const children = useMemo(
    () => (root ? categories.filter((c) => c.parentId === root.id && (!c.hidden || c.id === category)) : []),
    [categories, root, category],
  );
  const notes = useMemo(
    () => (flowKind ? suggestNotes(transactions, category).filter((n) => n !== note) : []),
    [transactions, category, flowKind, note],
  );

  const save = () => {
    const value = parseVndExpression(amount);
    if (!value) return setError('Số tiền không hợp lệ. Ví dụ: 50.000, 50k, 1,5tr hoặc 35k+20k.');
    if (kind === 'transfer') {
      if (!accountId && !toAccountId) return setError('Chọn tài khoản chuyển đi hoặc tài khoản nhận.');
      if (accountId === toAccountId) return setError('Tài khoản chuyển đi và tài khoản nhận phải khác nhau.');
    } else if (!category) {
      return setError('Hãy chọn danh mục.');
    }
    const tx: Transaction = {
      id: existing?.id ?? newId(),
      kind,
      category: kind === 'transfer' ? '' : category,
      amount: value,
      note: note.trim(),
      date,
      accountId: accountId || undefined,
      toAccountId: kind === 'transfer' ? toAccountId || undefined : undefined,
      recurringId: existing?.recurringId,
    };

    // Warn once when this expense pushes a budget past 80% or 100%.
    let warning: string | null = null;
    if (tx.kind === 'expense') {
      const month = monthKey(tx.date);
      const rootId = rootCategory(tx.category, categories).id;
      const others = transactions.filter((t) => t.id !== tx.id);
      const before = budgetStatuses(budgets, summarizeMonth(existing ? transactions : others, month, categories), categories);
      const after = budgetStatuses(budgets, summarizeMonth([...others, tx], month, categories), categories);
      const status = after.find((s) => s.budget.category === rootId);
      const level = status ? budgetAlert(before.find((s) => s.budget.category === rootId), status) : null;
      if (status && level === 'over') {
        warning = `Đã vượt ngân sách ${status.category.label}: ${format(status.spent)} / ${format(status.budget.amount)}.`;
      } else if (status && level === 'warn') {
        warning = `Đã dùng ${Math.round(status.ratio * 100)}% ngân sách ${status.category.label}, còn ${format(status.remaining)}.`;
      }
    }

    store.saveTransaction(tx);
    if (kind !== 'transfer') {
      setPrefs({
        lastCategory: { ...prefs.lastCategory, [kind]: category },
        ...(accountId ? { lastAccountId: accountId } : {}),
      });
    }
    onClose();
    toast.show(
      warning
        ? { message: warning, tone: 'warning' }
        : { message: existing ? 'Đã cập nhật giao dịch.' : 'Đã lưu giao dịch.', tone: 'success' },
    );
  };

  const remove = () => {
    if (!existing) return;
    store.deleteTransaction(existing.id);
    onClose();
    toast.show({ message: 'Đã xoá giao dịch.', actionLabel: 'Hoàn tác', onAction: () => store.saveTransaction(existing) });
  };

  return (
    <Modal title={existing ? 'Sửa giao dịch' : 'Thêm giao dịch'} onClose={onClose} onSave={save} onDelete={existing ? remove : undefined} error={error}>
      <Segmented options={KINDS} value={kind} onChange={changeKind} />
      <Field label="Số tiền (VND)">
        <AmountInput value={amount} onChange={setAmount} autoFocus={!existing && !initial?.amount} />
      </Field>
      {flowKind ? (
        <Field label="Danh mục">
          <Chips options={roots.map((c) => ({ id: c.id, label: c.label, color: c.color }))} value={root?.id ?? ''} onChange={setCategory} />
          {children.length > 0 ? (
            <div style={{ paddingLeft: 12, borderLeft: '2px solid var(--border)' }}>
              <Chips
                options={children.map((c) => ({ id: c.id, label: c.label, color: c.color }))}
                value={category}
                onChange={(id) => setCategory(id === category ? root!.id : id)}
              />
            </div>
          ) : null}
        </Field>
      ) : null}
      {kind === 'transfer' ? (
        <>
          <Field label="Từ tài khoản" hint="Để trống một bên nếu chỉ muốn điều chỉnh số dư của bên còn lại.">
            <Chips options={[...accountOptions(assets, accountId), { id: '', label: 'Không chọn' }]} value={accountId} onChange={setAccountId} />
          </Field>
          <Field label="Đến tài khoản">
            <Chips options={[...accountOptions(assets, toAccountId), { id: '', label: 'Không chọn' }]} value={toAccountId} onChange={setToAccountId} />
          </Field>
        </>
      ) : (
        <Field label={kind === 'income' ? 'Nhận vào ví' : 'Trả từ ví'} hint={assets.some(isSpendable) ? undefined : 'Thêm ví trong mục Tài sản để số dư tự cộng trừ.'}>
          <Chips options={walletOptions(assets, accountId)} value={accountId} onChange={setAccountId} />
        </Field>
      )}
      <Field label="Ngày">
        <DateInput value={date} onChange={setDate} />
      </Field>
      <Field label="Ghi chú (tuỳ chọn)">
        <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ví dụ: Cà phê với bạn" maxLength={200} />
        {notes.length > 0 ? <Chips options={notes.map((n) => ({ id: n, label: n }))} value="" onChange={setNote} /> : null}
      </Field>
    </Modal>
  );
}
