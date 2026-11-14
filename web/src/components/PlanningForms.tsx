import { useState } from 'react';
import type { Budget } from '@shared/budgets';
import { formatDigits, parseVndExpression, todayKey, type CustomCategory, type FlowKind, type TransactionCategory, type TransactionKind } from '@shared/finance';
import { FREQUENCY_LABEL, type Recurring, type RecurringFrequency } from '@shared/recurring';
import { newId, useStore } from '@shared/store';
import { accountOptions, walletOptions } from './options';
import { useToast } from './Toast';
import { AmountInput, Chips, DateInput, Field, Modal, Segmented, Toggle } from './ui';

export function BudgetForm({ budget, onClose }: { budget: Budget | null; onClose: () => void }) {
  const { categories, budgets, saveBudget, deleteBudget } = useStore();
  const toast = useToast();
  const taken = new Set(budgets.map((b) => b.category));
  const options = categories.filter(
    (c) => c.kind === 'expense' && !c.parentId && (budget ? c.id === budget.category : !taken.has(c.id) && !c.hidden),
  );
  const [category, setCategory] = useState(budget?.category ?? options[0]?.id ?? '');
  const [amount, setAmount] = useState(budget ? formatDigits(budget.amount) : '');
  const [error, setError] = useState('');

  const save = () => {
    const value = parseVndExpression(amount);
    if (!category) return setError('Mọi danh mục đều đã có ngân sách.');
    if (!value) return setError('Hạn mức không hợp lệ. Ví dụ: 4tr.');
    saveBudget({ id: category, category, amount: value });
    onClose();
    toast.show({ message: 'Đã lưu ngân sách.', tone: 'success' });
  };
  const remove = () => {
    if (!budget) return;
    deleteBudget(budget.id);
    onClose();
    toast.show({ message: 'Đã xoá ngân sách.', actionLabel: 'Hoàn tác', onAction: () => saveBudget(budget) });
  };

  return (
    <Modal title={budget ? 'Sửa ngân sách' : 'Thêm ngân sách'} onClose={onClose} onSave={save} onDelete={budget ? remove : undefined} error={error}>
      <Field label="Danh mục chi tiêu">
        <Chips options={options.map((c) => ({ id: c.id, label: c.label, color: c.color }))} value={category} onChange={setCategory} />
      </Field>
      <Field label="Hạn mức mỗi tháng (VND)" hint="App cảnh báo khi chi tới 80% và khi vượt hạn mức.">
        <AmountInput value={amount} onChange={setAmount} placeholder="Ví dụ: 4tr" autoFocus />
      </Field>
    </Modal>
  );
}

const KINDS: { id: TransactionKind; label: string }[] = [
  { id: 'expense', label: 'Chi tiêu' },
  { id: 'income', label: 'Thu nhập' },
  { id: 'transfer', label: 'Chuyển khoản' },
];
const FREQUENCIES = (Object.keys(FREQUENCY_LABEL) as RecurringFrequency[]).map((id) => ({ id, label: FREQUENCY_LABEL[id] }));

/** Add or edit a repeating transaction such as salary, rent or a loan instalment. */
export function RecurringForm({ rule, onClose }: { rule: Recurring | null; onClose: () => void }) {
  const { assets, categories, saveRecurring, deleteRecurring } = useStore();
  const toast = useToast();
  const firstCategory = (k: TransactionKind) => categories.find((c) => c.kind === k && !c.parentId && !c.hidden)?.id ?? '';
  const [kind, setKind] = useState<TransactionKind>(rule?.kind ?? 'expense');
  const [category, setCategory] = useState(rule?.category || firstCategory(rule?.kind ?? 'expense'));
  const [amount, setAmount] = useState(rule ? formatDigits(rule.amount) : '');
  const [note, setNote] = useState(rule?.note ?? '');
  const [accountId, setAccountId] = useState(rule?.accountId ?? '');
  const [toAccountId, setToAccountId] = useState(rule?.toAccountId ?? '');
  const [frequency, setFrequency] = useState<RecurringFrequency>(rule?.frequency ?? 'monthly');
  const [startDate, setStartDate] = useState(rule?.nextDate ?? todayKey());
  const [auto, setAuto] = useState(rule?.auto ?? true);
  const [active, setActive] = useState(rule?.active ?? true);
  const [error, setError] = useState('');

  const save = () => {
    const value = parseVndExpression(amount);
    if (!value) return setError('Số tiền không hợp lệ. Ví dụ: 5tr.');
    if (!note.trim()) return setError('Đặt tên cho khoản định kỳ, ví dụ "Tiền nhà".');
    if (kind === 'transfer') {
      if (!accountId || !toAccountId) return setError('Chọn tài khoản chuyển đi và tài khoản nhận.');
      if (accountId === toAccountId) return setError('Hai tài khoản phải khác nhau.');
    }
    // Changing the next date restarts the schedule from that day; otherwise the original anchor is kept.
    const rescheduled = !rule || startDate !== rule.nextDate || frequency !== rule.frequency;
    saveRecurring({
      id: rule?.id ?? newId(),
      kind,
      category: kind === 'transfer' ? '' : category,
      amount: value,
      note: note.trim(),
      accountId: accountId || undefined,
      toAccountId: kind === 'transfer' ? toAccountId || undefined : undefined,
      frequency,
      startDate: rescheduled ? startDate : rule.startDate,
      nextDate: startDate,
      endDate: rule?.endDate,
      auto,
      active,
    });
    onClose();
    toast.show({ message: 'Đã lưu khoản định kỳ.', tone: 'success' });
  };
  const remove = () => {
    if (!rule) return;
    deleteRecurring(rule.id);
    onClose();
    toast.show({ message: 'Đã xoá khoản định kỳ.', actionLabel: 'Hoàn tác', onAction: () => saveRecurring(rule) });
  };

  const roots = categories.filter((c) => c.kind === kind && !c.parentId && (!c.hidden || c.id === category));

  return (
    <Modal title={rule ? 'Sửa khoản định kỳ' : 'Thêm khoản định kỳ'} onClose={onClose} onSave={save} onDelete={rule ? remove : undefined} error={error}>
      <Segmented
        options={KINDS}
        value={kind}
        onChange={(k) => {
          setKind(k);
          setCategory(firstCategory(k));
        }}
      />
      <Field label="Tên">
        <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ví dụ: Tiền nhà, Lương, Netflix" maxLength={80} autoFocus={!rule} />
      </Field>
      <Field label="Số tiền mỗi kỳ (VND)">
        <AmountInput value={amount} onChange={setAmount} placeholder="Ví dụ: 5tr" />
      </Field>
      {kind !== 'transfer' ? (
        <>
          <Field label="Danh mục">
            <Chips options={roots.map((c) => ({ id: c.id, label: c.label, color: c.color }))} value={category} onChange={setCategory} />
          </Field>
          <Field label={kind === 'income' ? 'Nhận vào ví' : 'Trả từ ví'}>
            <Chips options={walletOptions(assets, accountId)} value={accountId} onChange={setAccountId} />
          </Field>
        </>
      ) : (
        <>
          <Field label="Từ tài khoản">
            <Chips options={accountOptions(assets, accountId)} value={accountId} onChange={setAccountId} />
          </Field>
          <Field label="Đến tài khoản">
            <Chips options={accountOptions(assets, toAccountId)} value={toAccountId} onChange={setToAccountId} />
          </Field>
        </>
      )}
      <Field label="Lặp lại">
        <Segmented options={FREQUENCIES} value={frequency} onChange={setFrequency} />
      </Field>
      <Field label={rule ? 'Kỳ tiếp theo' : 'Kỳ đầu tiên'}>
        <DateInput value={startDate} onChange={setStartDate} />
      </Field>
      <Toggle title="Tự động ghi khi đến hạn" hint="Tắt nếu muốn app hỏi lại trước khi ghi từng kỳ." checked={auto} onChange={setAuto} />
      <Toggle title="Đang áp dụng" hint="Tắt để tạm dừng mà không xoá." checked={active} onChange={setActive} />
    </Modal>
  );
}

const COLORS = ['#EF6C00', '#1565C0', '#6A1B9A', '#AD1457', '#F9A825', '#00897B', '#C62828', '#3949AB', '#2E7D32', '#5D4037', '#757575', '#00838F'];

/** Add a category or sub-category, or rename / recolour / hide an existing one. */
export function CategoryForm({ category, kind, onClose }: { category: TransactionCategory | null; kind: FlowKind; onClose: () => void }) {
  const { categories, customCategories, transactions, saveCategory, deleteCategory } = useStore();
  const toast = useToast();
  const [label, setLabel] = useState(category?.label ?? '');
  const [color, setColor] = useState(category?.color ?? COLORS[0]);
  const [parentId, setParentId] = useState(category?.parentId ?? '');
  const [hidden, setHidden] = useState(!!category?.hidden);
  const [error, setError] = useState('');

  const builtIn = !!category && !category.custom;
  const hasChildren = !!category && categories.some((c) => c.parentId === category.id);
  const parents = categories.filter((c) => c.kind === kind && !c.parentId && c.id !== category?.id && !c.hidden);
  const used = !!category && transactions.some((t) => t.category === category.id);

  const save = () => {
    const name = label.trim();
    if (!name) return setError('Hãy đặt tên danh mục.');
    if (categories.some((c) => c.id !== category?.id && c.kind === kind && c.label.toLowerCase() === name.toLowerCase())) {
      return setError('Đã có danh mục trùng tên.');
    }
    const next: CustomCategory = {
      id: category?.id ?? `c-${newId()}`,
      kind,
      label: name,
      color,
      icon: category?.icon ?? category?.id ?? 'tag',
      parentId: builtIn || hasChildren ? undefined : parentId || undefined,
      hidden,
    };
    saveCategory(next);
    onClose();
    toast.show({ message: 'Đã lưu danh mục.', tone: 'success' });
  };
  const remove = () => {
    if (!category) return;
    deleteCategory(category.id);
    onClose();
    toast.show({ message: builtIn ? 'Đã khôi phục danh mục mặc định.' : 'Đã xoá danh mục.' });
  };
  // A custom category still used by transactions can only be hidden, so those rows keep their name.
  const canDelete = !!category && (builtIn ? customCategories.some((c) => c.id === category.id) : !used && !hasChildren);

  return (
    <Modal title={category ? 'Sửa danh mục' : kind === 'income' ? 'Thêm danh mục thu' : 'Thêm danh mục chi'} onClose={onClose} onSave={save} onDelete={canDelete ? remove : undefined} error={error}>
      <Field label="Tên danh mục">
        <input className="input" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ví dụ: Cà phê, Thú cưng" maxLength={40} autoFocus={!category} />
      </Field>
      <Field label="Màu">
        <div className="chips">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`Màu ${c}`}
              aria-pressed={c === color}
              onClick={() => setColor(c)}
              style={{ width: 32, height: 32, borderRadius: '50%', background: c, cursor: 'pointer', border: c === color ? '3px solid var(--text)' : '3px solid transparent' }}
            />
          ))}
        </div>
      </Field>
      {!builtIn && !hasChildren ? (
        <Field label="Thuộc danh mục" hint="Danh mục con được cộng vào danh mục chính trong báo cáo và ngân sách.">
          <Chips options={[{ id: '', label: 'Danh mục chính' }, ...parents.map((c) => ({ id: c.id, label: c.label, color: c.color }))]} value={parentId} onChange={setParentId} />
        </Field>
      ) : null}
      {category ? <Toggle title="Ẩn danh mục này" hint="Không hiện khi thêm giao dịch mới. Giao dịch cũ vẫn giữ nguyên." checked={hidden} onChange={setHidden} /> : null}
      {builtIn && canDelete ? <span className="hint">Bấm Xoá để khôi phục tên và màu mặc định.</span> : null}
    </Modal>
  );
}
