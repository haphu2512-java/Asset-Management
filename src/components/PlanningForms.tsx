import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { Budget } from '../budgets';
import {
  formatDigits,
  parseVndExpression,
  todayKey,
  type CustomCategory,
  type FlowKind,
  type TransactionCategory,
  type TransactionKind,
} from '../finance';
import { FREQUENCY_LABEL, type Recurring, type RecurringFrequency } from '../recurring';
import { newId, useStore } from '../store';
import { useTheme } from '../theme';
import { accountOptions, walletOptions } from './accounts';
import { DateField } from './DateField';
import { CATEGORY_ICONS, Icon } from './Icon';
import { Chips, Field, Sheet } from './Sheet';
import { useToast } from './Toast';
import { AmountInput, Input, Segmented, ToggleRow } from './ui';

/** Set or change the monthly limit of one expense category. */
export function BudgetForm({
  visible,
  budget,
  onClose,
}: {
  visible: boolean;
  budget: Budget | null;
  onClose: () => void;
}) {
  const { categories, budgets, saveBudget, deleteBudget } = useStore();
  const toast = useToast();
  const [category, setCategory] = useState('');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');

  const taken = new Set(budgets.map((b) => b.category));
  const options = categories.filter(
    (c) => c.kind === 'expense' && !c.parentId && (budget ? c.id === budget.category : !taken.has(c.id) && !c.hidden),
  );

  useEffect(() => {
    if (!visible) return;
    setCategory(budget?.category ?? options[0]?.id ?? '');
    setAmount(budget ? formatDigits(budget.amount) : '');
    setError('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, budget]);

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
    <Sheet
      visible={visible}
      title={budget ? 'Sửa ngân sách' : 'Thêm ngân sách'}
      onClose={onClose}
      onSave={save}
      onDelete={budget ? remove : undefined}
      error={error}
    >
      <Field label="Danh mục chi tiêu">
        <Chips
          options={options.map((c) => ({ id: c.id, label: c.label, color: c.color, icon: c.icon ?? c.id }))}
          value={category}
          onChange={setCategory}
        />
      </Field>
      <Field label="Hạn mức mỗi tháng (VND)" hint="App cảnh báo khi chi tới 80% và khi vượt hạn mức.">
        <AmountInput value={amount} onChangeText={setAmount} placeholder="Ví dụ: 4tr" autoFocus={!budget} />
      </Field>
    </Sheet>
  );
}

const KINDS: { id: TransactionKind; label: string }[] = [
  { id: 'expense', label: 'Chi tiêu' },
  { id: 'income', label: 'Thu nhập' },
  { id: 'transfer', label: 'Chuyển khoản' },
];

const FREQUENCIES = (['weekly', 'monthly', 'yearly'] as RecurringFrequency[]).map((id) => ({
  id,
  label: FREQUENCY_LABEL[id],
  icon: null,
}));

/** Add or edit a repeating transaction such as salary, rent or a loan instalment. */
export function RecurringForm({
  visible,
  rule,
  onClose,
}: {
  visible: boolean;
  rule: Recurring | null;
  onClose: () => void;
}) {
  const { assets, categories, saveRecurring, deleteRecurring } = useStore();
  const toast = useToast();
  const [kind, setKind] = useState<TransactionKind>('expense');
  const [category, setCategory] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [accountId, setAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState('');
  const [frequency, setFrequency] = useState<RecurringFrequency>('monthly');
  const [startDate, setStartDate] = useState(todayKey());
  const [auto, setAuto] = useState(true);
  const [active, setActive] = useState(true);
  const [error, setError] = useState('');

  const firstCategory = (k: TransactionKind) =>
    categories.find((c) => c.kind === k && !c.parentId && !c.hidden)?.id ?? '';

  useEffect(() => {
    if (!visible) return;
    const k = rule?.kind ?? 'expense';
    setKind(k);
    setCategory(rule?.category || firstCategory(k));
    setAmount(rule ? formatDigits(rule.amount) : '');
    setNote(rule?.note ?? '');
    setAccountId(rule?.accountId ?? '');
    setToAccountId(rule?.toAccountId ?? '');
    setFrequency(rule?.frequency ?? 'monthly');
    setStartDate(rule?.nextDate ?? todayKey());
    setAuto(rule?.auto ?? true);
    setActive(rule?.active ?? true);
    setError('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, rule]);

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
    const next: Recurring = {
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
    };
    saveRecurring(next);
    onClose();
    toast.show({ message: 'Đã lưu khoản định kỳ.', tone: 'success' });
  };

  const remove = () => {
    if (!rule) return;
    deleteRecurring(rule.id);
    onClose();
    toast.show({
      message: 'Đã xoá khoản định kỳ. Các giao dịch đã ghi vẫn được giữ.',
      actionLabel: 'Hoàn tác',
      // Occurrences have ids derived from the rule and date, so restoring cannot record one twice.
      onAction: () => saveRecurring(rule),
    });
  };

  return (
    <Sheet
      visible={visible}
      title={rule ? 'Sửa khoản định kỳ' : 'Thêm khoản định kỳ'}
      onClose={onClose}
      onSave={save}
      onDelete={rule ? remove : undefined}
      error={error}
    >
      <Segmented
        options={KINDS}
        value={kind}
        onChange={(k) => {
          setKind(k);
          setCategory(firstCategory(k));
        }}
      />
      <Field label="Tên">
        <Input value={note} onChangeText={setNote} placeholder="Ví dụ: Tiền nhà, Lương, Netflix" maxLength={100} accessibilityLabel="Tên khoản định kỳ" />
      </Field>
      <Field label="Số tiền mỗi kỳ (VND)">
        <AmountInput value={amount} onChangeText={setAmount} placeholder="Ví dụ: 5tr" />
      </Field>
      {kind !== 'transfer' ? (
        <>
          <Field label="Danh mục">
            <Chips
              options={categories
                .filter((c) => c.kind === kind && (!c.hidden || c.id === category))
                .map((c) => ({ id: c.id, label: c.label, color: c.color, icon: c.icon ?? c.id }))}
              value={category}
              onChange={setCategory}
            />
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
          <Field label="Đến tài khoản" hint='Chọn một khoản "Đang nợ" để trả góp: mỗi kỳ dư nợ sẽ giảm.'>
            <Chips options={accountOptions(assets, toAccountId, accountId)} value={toAccountId} onChange={setToAccountId} />
          </Field>
        </>
      )}
      <Field label="Lặp lại">
        <Chips options={FREQUENCIES} value={frequency} onChange={(id) => setFrequency(id as RecurringFrequency)} showIcons={false} />
      </Field>
      <Field label={rule ? 'Kỳ tiếp theo' : 'Bắt đầu từ ngày'}>
        <DateField value={startDate} onChange={setStartDate} accessibilityLabel="Ngày của kỳ tiếp theo" />
      </Field>
      <ToggleRow
        title="Tự động ghi khi đến hạn"
        subtitle="Tắt nếu muốn app hỏi lại trước khi ghi từng kỳ."
        value={auto}
        onChange={setAuto}
      />
      {rule ? <ToggleRow title="Đang áp dụng" subtitle="Tắt để tạm dừng mà không xoá." value={active} onChange={setActive} /> : null}
    </Sheet>
  );
}

const COLORS = ['#EF6C00', '#1565C0', '#6A1B9A', '#AD1457', '#F9A825', '#00897B', '#C62828', '#3949AB', '#2E7D32', '#5D4037', '#757575', '#00838F'];

/** Add a category or sub-category, or rename / recolour / hide an existing one. */
export function CategoryForm({
  visible,
  category,
  kind,
  onClose,
}: {
  visible: boolean;
  /** The category being edited (built-in or custom); null to add one. */
  category: TransactionCategory | null;
  kind: FlowKind;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const { categories, customCategories, transactions, saveCategory, deleteCategory } = useStore();
  const toast = useToast();
  const [label, setLabel] = useState('');
  const [color, setColor] = useState(COLORS[0]);
  const [icon, setIcon] = useState<string>('tag');
  const [parentId, setParentId] = useState('');
  const [hidden, setHidden] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!visible) return;
    setLabel(category?.label ?? '');
    setColor(category?.color ?? COLORS[0]);
    setIcon(category?.icon ?? category?.id ?? 'tag');
    setParentId(category?.parentId ?? '');
    setHidden(!!category?.hidden);
    setError('');
  }, [visible, category]);

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
      icon,
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
    <Sheet
      visible={visible}
      title={category ? 'Sửa danh mục' : kind === 'expense' ? 'Thêm danh mục chi' : 'Thêm danh mục thu'}
      onClose={onClose}
      onSave={save}
      onDelete={canDelete ? remove : undefined}
      deleteLabel={builtIn ? 'Khôi phục mặc định' : 'Xoá'}
      error={error}
    >
      <Field label="Tên danh mục">
        <Input value={label} onChangeText={setLabel} placeholder="Ví dụ: Cà phê, Con cái, Thú cưng" maxLength={40} autoFocus={!category} accessibilityLabel="Tên danh mục" />
      </Field>
      {!builtIn && !hasChildren && parents.length > 0 ? (
        <Field label="Thuộc danh mục" hint="Danh mục con được cộng vào danh mục cha trong báo cáo và ngân sách.">
          <Chips
            options={[{ id: '', label: 'Danh mục chính', icon: null }, ...parents.map((c) => ({ id: c.id, label: c.label, color: c.color, icon: c.icon ?? c.id }))]}
            value={parentId}
            onChange={setParentId}
          />
        </Field>
      ) : null}
      <Field label="Màu">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }} accessibilityRole="radiogroup">
          {COLORS.map((c, i) => (
            <Pressable
              key={c}
              onPress={() => setColor(c)}
              accessibilityRole="radio"
              accessibilityState={{ selected: c === color }}
              accessibilityLabel={`Màu ${i + 1}`}
              hitSlop={4}
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: c,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: c === color ? 3 : 0,
                borderColor: colors.text,
              }}
            >
              {c === color ? <Icon name="check" size={16} color="#FFFFFF" strokeWidth={3} /> : null}
            </Pressable>
          ))}
        </View>
      </Field>
      <Field label="Biểu tượng">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }} accessibilityRole="radiogroup">
          {CATEGORY_ICONS.map((name) => {
            const selected = name === icon;
            return (
              <Pressable
                key={name}
                onPress={() => setIcon(name)}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={`Biểu tượng ${name}`}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 10,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 1,
                  borderColor: selected ? colors.primary : colors.border,
                  backgroundColor: selected ? colors.primaryLight : colors.card,
                }}
              >
                <Icon name={name} size={20} color={selected ? colors.primary : colors.muted} />
              </Pressable>
            );
          })}
        </View>
      </Field>
      {category ? (
        <ToggleRow
          title="Ẩn danh mục này"
          subtitle="Không hiện khi thêm giao dịch mới. Giao dịch cũ vẫn giữ nguyên."
          value={hidden}
          onChange={setHidden}
        />
      ) : null}
      {category && !canDelete && !builtIn ? (
        <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 17 }}>
          {hasChildren ? 'Danh mục này có danh mục con nên không xoá được.' : 'Danh mục đang được dùng trong giao dịch nên chỉ có thể ẩn.'}
        </Text>
      ) : null}
    </Sheet>
  );
}
