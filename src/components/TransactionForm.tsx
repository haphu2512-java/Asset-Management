import { useEffect, useState } from 'react';
import { TextInput } from 'react-native';
import {
  TRANSACTION_CATEGORIES,
  formatDigits,
  parseVnd,
  todayKey,
  type Transaction,
  type TransactionKind,
} from '../finance';
import { newId } from '../store';
import { colors, ui } from '../theme';
import { Chips, Field, Sheet } from './Sheet';

type Props = {
  visible: boolean;
  transaction: Transaction | null;
  onClose: () => void;
  onSave: (transaction: Transaction) => void;
  onDelete: (id: string) => void;
};

const KINDS = [
  { id: 'expense', label: 'Chi tiêu', color: colors.expense },
  { id: 'income', label: 'Thu nhập', color: colors.income },
];

const defaultCategory = (kind: TransactionKind) =>
  TRANSACTION_CATEGORIES.find((c) => c.kind === kind)!.id;

export function TransactionForm({ visible, transaction, onClose, onSave, onDelete }: Props) {
  const [kind, setKind] = useState<TransactionKind>('expense');
  const [category, setCategory] = useState(defaultCategory('expense'));
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(todayKey());
  const [error, setError] = useState('');

  useEffect(() => {
    if (!visible) return;
    setKind(transaction?.kind ?? 'expense');
    setCategory(transaction?.category ?? defaultCategory('expense'));
    setAmount(transaction ? formatDigits(transaction.amount) : '');
    setNote(transaction?.note ?? '');
    setDate(transaction?.date ?? todayKey());
    setError('');
  }, [visible, transaction]);

  const changeKind = (next: TransactionKind) => {
    setKind(next);
    setCategory(defaultCategory(next));
  };

  const save = () => {
    const value = parseVnd(amount);
    if (!value) return setError('Số tiền không hợp lệ. Ví dụ: 50.000, 50k hoặc 1,5tr.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) {
      return setError('Ngày phải có dạng NNNN-TT-NN, ví dụ 2026-10-21.');
    }
    onSave({ id: transaction?.id ?? newId(), kind, category, amount: value, note: note.trim(), date });
    onClose();
  };

  return (
    <Sheet
      visible={visible}
      title={transaction ? 'Sửa giao dịch' : 'Thêm giao dịch'}
      onClose={onClose}
      onSave={save}
      onDelete={transaction ? () => (onDelete(transaction.id), onClose()) : undefined}
      error={error}
    >
      <Chips options={KINDS} value={kind} onChange={(id) => changeKind(id as TransactionKind)} />
      <Field label="Số tiền (VND)">
        <TextInput
          placeholderTextColor={colors.muted}
          style={ui.input}
          value={amount}
          onChangeText={setAmount}
          placeholder="50.000 hoặc 50k"
          autoCapitalize="none"
        />
      </Field>
      <Field label="Danh mục">
        <Chips
          options={TRANSACTION_CATEGORIES.filter((c) => c.kind === kind)}
          value={category}
          onChange={setCategory}
        />
      </Field>
      <Field label="Ghi chú">
        <TextInput
          placeholderTextColor={colors.muted}
          style={ui.input}
          value={note}
          onChangeText={setNote}
          placeholder="Ví dụ: Cà phê với bạn"
        />
      </Field>
      <Field label="Ngày (NNNN-TT-NN)">
        <TextInput
          placeholderTextColor={colors.muted}
          style={ui.input}
          value={date}
          onChangeText={setDate}
          autoCapitalize="none"
        />
      </Field>
    </Sheet>
  );
}
