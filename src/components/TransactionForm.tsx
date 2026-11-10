import { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { budgetAlert, budgetStatuses } from '../budgets';
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
} from '../finance';
import { suggestNotes } from '../ledger';
import { usePrefs } from '../prefs';
import { newId, useStore } from '../store';
import { font, useMoney, useTheme } from '../theme';
import { accountOptions, walletOptions } from './accounts';
import { DateField } from './DateField';
import { Chips, Field, Sheet } from './Sheet';
import { useToast } from './Toast';
import { AmountInput, Input, Segmented } from './ui';

type Props = {
  visible: boolean;
  /** An existing transaction to edit, or values to start a new one with (no id). */
  initial: Partial<Transaction> | null;
  onClose: () => void;
};

const KINDS: { id: TransactionKind; label: string }[] = [
  { id: 'expense', label: 'Chi tiêu' },
  { id: 'income', label: 'Thu nhập' },
  { id: 'transfer', label: 'Chuyển khoản' },
];

/** Add or edit a transaction. Saves through the store and confirms with a toast. */
export function TransactionForm({ visible, initial, onClose }: Props) {
  const { colors, ui } = useTheme();
  const store = useStore();
  const { assets, categories, transactions, budgets } = store;
  const { prefs, setPrefs } = usePrefs();
  const toast = useToast();
  const format = useMoney();
  const existing = initial?.id ? (transactions.find((t) => t.id === initial.id) ?? null) : null;

  const [kind, setKind] = useState<TransactionKind>('expense');
  const [category, setCategory] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(todayKey());
  const [accountId, setAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState('');
  const [error, setError] = useState('');

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

  useEffect(() => {
    if (!visible) return;
    const k = initial?.kind ?? 'expense';
    setKind(k);
    setCategory(initial?.category || defaultCategory(k));
    setAmount(initial?.amount ? formatDigits(initial.amount) : '');
    setNote(initial?.note ?? '');
    setDate(initial?.date ?? todayKey());
    setAccountId(initial?.id || initial?.accountId !== undefined ? (initial?.accountId ?? '') : defaultAccount());
    setToAccountId(initial?.toAccountId ?? '');
    setError('');
    // Only re-initialise when the sheet opens or a different transaction is passed in.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, initial]);

  const changeKind = (next: TransactionKind) => {
    setKind(next);
    setCategory(defaultCategory(next));
    setError('');
  };

  const flowKind: FlowKind | null = kind === 'transfer' ? null : kind;
  const root = flowKind ? rootCategory(category, categories) : null;
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
    toast.show({
      message: 'Đã xoá giao dịch.',
      actionLabel: 'Hoàn tác',
      onAction: () => store.saveTransaction(existing),
    });
  };

  return (
    <Sheet
      visible={visible}
      title={existing ? 'Sửa giao dịch' : 'Thêm giao dịch'}
      onClose={onClose}
      onSave={save}
      onDelete={existing ? remove : undefined}
      error={error}
    >
      <Segmented options={KINDS} value={kind} onChange={changeKind} />

      <Field label="Số tiền (VND)">
        <AmountInput value={amount} onChangeText={setAmount} autoFocus={!existing && !initial?.amount} />
      </Field>

      {flowKind ? (
        <Field label="Danh mục">
          <Chips
            options={roots.map((c) => ({ id: c.id, label: c.label, color: c.color, icon: c.icon ?? c.id }))}
            value={root?.id ?? ''}
            onChange={setCategory}
          />
          {children.length > 0 ? (
            <View style={{ paddingLeft: 12, borderLeftWidth: 2, borderLeftColor: colors.border, gap: 6 }}>
              <Text style={ui.label}>Chi tiết hơn (tuỳ chọn)</Text>
              <Chips
                options={children.map((c) => ({ id: c.id, label: c.label, color: c.color, icon: c.icon ?? null }))}
                value={category}
                onChange={(id) => setCategory(id === category ? root!.id : id)}
              />
            </View>
          ) : null}
        </Field>
      ) : null}

      {kind === 'transfer' ? (
        <>
          <Field label="Từ tài khoản" hint="Để trống một bên nếu chỉ muốn điều chỉnh số dư của bên còn lại.">
            <Chips
              options={[...accountOptions(assets, accountId), { id: '', label: 'Không chọn', icon: null }]}
              value={accountId}
              onChange={setAccountId}
            />
          </Field>
          <Field label="Đến tài khoản">
            <Chips
              options={[...accountOptions(assets, toAccountId), { id: '', label: 'Không chọn', icon: null }]}
              value={toAccountId}
              onChange={setToAccountId}
            />
          </Field>
        </>
      ) : (
        <Field
          label={kind === 'income' ? 'Nhận vào ví' : 'Trả từ ví'}
          hint={
            assets.some(isSpendable)
              ? 'Số dư ví sẽ tự thay đổi theo giao dịch.'
              : 'Thêm ví ở tab Tài sản để số dư tự chạy theo thu chi.'
          }
        >
          <Chips options={walletOptions(assets, accountId)} value={accountId} onChange={setAccountId} />
        </Field>
      )}

      <Field label="Ghi chú">
        <Input
          value={note}
          onChangeText={setNote}
          placeholder={kind === 'transfer' ? 'Ví dụ: Rút ATM' : 'Ví dụ: Cà phê với bạn'}
          maxLength={200}
          accessibilityLabel="Ghi chú"
        />
        {notes.length > 0 ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {notes.map((n) => (
              <Pressable
                key={n}
                onPress={() => setNote(n)}
                accessibilityRole="button"
                accessibilityLabel={`Dùng ghi chú ${n}`}
                hitSlop={4}
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: 999,
                  backgroundColor: colors.surfaceAlt,
                  borderWidth: 1,
                  borderColor: colors.borderSubtle,
                }}
              >
                <Text style={{ fontSize: font.caption, color: colors.muted }}>{n}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </Field>

      <Field label="Ngày">
        <DateField value={date} onChange={setDate} shortcuts />
      </Field>
    </Sheet>
  );
}
