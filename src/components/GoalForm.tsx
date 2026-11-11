import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import {
  addMonths,
  formatDigits,
  frequencyUnit,
  GOAL_CATEGORIES,
  parseVndExpression,
  type Goal,
  type GoalCategoryId,
  type GoalFrequency,
  type GoalType,
} from '../finance';
import { newId, useStore } from '../store';
import { font, radius, useMoney, useTheme } from '../theme';
import { accountOptions } from './accounts';
import { DateField } from './DateField';
import { Icon } from './Icon';
import { Chips, Field, Sheet, type ChipOption } from './Sheet';
import { useToast } from './Toast';
import { AmountInput, Input, Segmented } from './ui';

type Props = {
  visible: boolean;
  goal: Goal | null;
  onClose: () => void;
};

const GOAL_TYPES: { id: GoalType; label: string }[] = [
  { id: 'recurring', label: 'Góp định kỳ' },
  { id: 'target_amount', label: 'Số tiền mục tiêu' },
];

const FREQUENCIES: ChipOption[] = [
  { id: 'monthly', label: 'Hàng tháng', icon: null },
  { id: 'weekly', label: 'Hàng tuần', icon: null },
  { id: 'quarterly', label: 'Hàng quý', icon: null },
];

const RECURRING_PRESETS = ['200k', '500k', '1tr', '2tr', '5tr'];
const TARGET_PRESETS = ['20tr', '50tr', '100tr', '200tr', '500tr'];

const DURATIONS: ChipOption[] = [
  { id: '6', label: '6 tháng', icon: null },
  { id: '12', label: '1 năm', icon: null },
  { id: '24', label: '2 năm', icon: null },
  { id: '36', label: '3 năm', icon: null },
  { id: '60', label: '5 năm', icon: null },
];

const CATEGORY_OPTIONS: ChipOption[] = GOAL_CATEGORIES.map((c) => ({ id: c.id, label: c.label, color: c.color, icon: c.icon }));

const PLACEHOLDER: Record<string, string> = {
  etf: 'Ví dụ: Quỹ ETF VN30, Tích sản cổ phiếu',
  saving: 'Ví dụ: Sổ tiết kiệm 12 tháng',
  emergency: 'Ví dụ: Quỹ dự phòng 6 tháng chi tiêu',
  housing: 'Ví dụ: Mua nhà, Mua xe',
  shopping: 'Ví dụ: Đổi điện thoại',
  education: 'Ví dụ: Du lịch Nhật Bản, Học tiếng Anh',
};

/** How many contributions fit in a number of months. */
function periodsIn(months: number, frequency: GoalFrequency): number {
  if (frequency === 'weekly') return Math.round(months * (52 / 12));
  if (frequency === 'quarterly') return Math.max(1, Math.round(months / 3));
  return months;
}

export function GoalForm({ visible, goal, onClose }: Props) {
  const { colors } = useTheme();
  const { assets, saveGoal, deleteGoal } = useStore();
  const toast = useToast();
  const format = useMoney();

  const [goalType, setGoalType] = useState<GoalType>('recurring');
  const [category, setCategory] = useState<GoalCategoryId>('saving');
  const [name, setName] = useState('');
  const [recurringAmount, setRecurringAmount] = useState('');
  const [frequency, setFrequency] = useState<GoalFrequency>('monthly');
  const [durationMonths, setDurationMonths] = useState(12);
  const [target, setTarget] = useState('');
  /** Once the user types a target for a recurring plan it stops following amount × periods. */
  const [customTarget, setCustomTarget] = useState(false);
  const [saved, setSaved] = useState('');
  const [deadline, setDeadline] = useState(addMonths(12));
  const [assetId, setAssetId] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!visible) return;
    setGoalType(goal?.type ?? 'recurring');
    setCategory(goal?.category ?? 'saving');
    setName(goal?.name ?? '');
    setRecurringAmount(goal?.recurringAmount ? formatDigits(goal.recurringAmount) : '');
    setFrequency(goal?.frequency ?? 'monthly');
    setDurationMonths(goal ? 0 : 12);
    setTarget(goal ? formatDigits(goal.target) : '');
    setCustomTarget(!!goal);
    setSaved(goal?.saved ? formatDigits(goal.saved) : '');
    setDeadline(goal?.deadline ?? addMonths(12));
    setAssetId(goal?.assetId ?? '');
    setError('');
  }, [visible, goal]);

  const plannedTotal = (amountText: string, months: number, freq: GoalFrequency): number | null => {
    const value = parseVndExpression(amountText);
    return value && months > 0 ? value * periodsIn(months, freq) : null;
  };

  /** Keeps the target of a recurring plan equal to amount × periods until the user overrides it. */
  const follow = (amountText: string, months: number, freq: GoalFrequency) => {
    const total = plannedTotal(amountText, months, freq);
    if (!customTarget && total) setTarget(formatDigits(total));
  };

  const changeDuration = (id: string) => {
    const months = Number(id);
    setDurationMonths(months);
    setDeadline(addMonths(months));
    follow(recurringAmount, months, frequency);
  };

  const save = () => {
    if (!name.trim()) return setError('Hãy đặt tên cho mục tiêu, ví dụ "Quỹ dự phòng".');
    let planned: number | undefined;
    if (goalType === 'recurring') {
      const value = parseVndExpression(recurringAmount);
      if (!value) return setError('Nhập số tiền góp mỗi kỳ, ví dụ 500k.');
      planned = value;
    }
    const targetValue = parseVndExpression(target);
    if (!targetValue) return setError('Số tiền mục tiêu không hợp lệ. Ví dụ: 100tr.');
    const savedValue = saved.trim() ? parseVndExpression(saved) : 0;
    if (savedValue === null) return setError('Số tiền đã có không hợp lệ.');

    saveGoal({
      id: goal?.id ?? newId(),
      name: name.trim(),
      type: goalType,
      category,
      recurringAmount: planned,
      frequency,
      target: targetValue,
      saved: savedValue,
      deadline,
      lastContributedAt: goal?.lastContributedAt,
      contributionsCount: goal?.contributionsCount,
      assetId: assetId || undefined,
    });
    onClose();
    toast.show({ message: goal ? 'Đã cập nhật mục tiêu.' : 'Đã thêm mục tiêu.', tone: 'success' });
  };

  const remove = () => {
    if (!goal) return;
    deleteGoal(goal.id);
    onClose();
    toast.show({ message: `Đã xoá mục tiêu ${goal.name}.` });
  };

  const unit = frequencyUnit(frequency);
  const planned = parseVndExpression(recurringAmount);
  const total = parseVndExpression(target);

  const presets = (values: string[], current: string, pick: (v: string) => void) => (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
      {values.map((p) => {
        const selected = current === p;
        return (
          <Pressable
            key={p}
            onPress={() => pick(p)}
            accessibilityRole="button"
            accessibilityLabel={`Chọn ${p}`}
            hitSlop={4}
            style={{
              paddingHorizontal: 12,
              minHeight: 36,
              justifyContent: 'center',
              borderRadius: radius.sm,
              borderWidth: 1,
              borderColor: selected ? colors.primary : colors.border,
              backgroundColor: selected ? colors.primaryLight : colors.card,
            }}
          >
            <Text style={{ fontSize: font.body, fontWeight: '600', color: selected ? colors.primary : colors.text }}>{p}</Text>
          </Pressable>
        );
      })}
    </View>
  );

  return (
    <Sheet
      visible={visible}
      title={goal ? 'Sửa mục tiêu' : 'Thêm mục tiêu'}
      onClose={onClose}
      onSave={save}
      onDelete={goal ? remove : undefined}
      confirmDelete={goal ? 'Mục tiêu và lịch sử góp của nó sẽ bị xoá. Tiền trong các tài khoản không thay đổi.' : undefined}
      error={error}
    >
      <Segmented
        options={GOAL_TYPES}
        value={goalType}
        onChange={(next) => {
          setGoalType(next);
          if (next === 'recurring') follow(recurringAmount, durationMonths, frequency);
        }}
      />

      <Field label="Phân loại">
        <Chips options={CATEGORY_OPTIONS} value={category} onChange={(id) => setCategory(id as GoalCategoryId)} />
      </Field>

      <Field label="Tên mục tiêu">
        <Input value={name} onChangeText={setName} placeholder={PLACEHOLDER[category] ?? 'Ví dụ: Kế hoạch tài chính 2027'} accessibilityLabel="Tên mục tiêu" />
      </Field>

      {goalType === 'recurring' ? (
        <>
          <Field label="Chu kỳ góp">
            <Chips
              options={FREQUENCIES}
              value={frequency}
              onChange={(id) => {
                setFrequency(id as GoalFrequency);
                follow(recurringAmount, durationMonths, id as GoalFrequency);
              }}
              showIcons={false}
            />
          </Field>
          <Field label={`Số tiền góp mỗi ${unit} (VND)`}>
            {presets(RECURRING_PRESETS, recurringAmount, (p) => {
              setRecurringAmount(p);
              follow(p, durationMonths, frequency);
            })}
            <AmountInput
              value={recurringAmount}
              onChangeText={(text) => {
                setRecurringAmount(text);
                follow(text, durationMonths, frequency);
              }}
              placeholder="Ví dụ: 500k"
            />
          </Field>
          <Field label="Thời gian tích luỹ">
            <Chips options={DURATIONS} value={String(durationMonths)} onChange={changeDuration} showIcons={false} />
            <DateField value={deadline} onChange={(d) => (setDeadline(d), setDurationMonths(0))} accessibilityLabel="Hạn hoàn thành" />
          </Field>
          {planned && total ? (
            <View
              style={{ padding: 12, backgroundColor: colors.primaryLight, borderRadius: radius.sm, flexDirection: 'row', gap: 8 }}
            >
              <Icon name="sparkles" size={16} color={colors.primary} />
              <Text style={{ flex: 1, fontSize: font.body, color: colors.primary, lineHeight: 20 }}>
                Góp {format(planned)} mỗi {unit} để tích luỹ {format(total)}.
              </Text>
            </View>
          ) : null}
          <Field label="Tổng số tiền mục tiêu (VND)" hint="Tự tính từ số tiền góp và thời gian; sửa nếu bạn có mốc riêng.">
            <AmountInput
              value={target}
              onChangeText={(t) => {
                setTarget(t);
                setCustomTarget(true);
              }}
              placeholder="Ví dụ: 50tr"
              accessibilityLabel="Tổng số tiền mục tiêu"
            />
          </Field>
        </>
      ) : (
        <>
          <Field label="Số tiền cần có (VND)">
            {presets(TARGET_PRESETS, target, setTarget)}
            <AmountInput value={target} onChangeText={setTarget} placeholder="Ví dụ: 100tr" />
          </Field>
          <Field label="Hạn hoàn thành">
            <Chips options={DURATIONS} value={String(durationMonths)} onChange={changeDuration} showIcons={false} />
            <DateField value={deadline} onChange={(d) => (setDeadline(d), setDurationMonths(0))} accessibilityLabel="Hạn hoàn thành" />
          </Field>
        </>
      )}

      <Field label="Đã có sẵn (VND, tuỳ chọn)">
        <AmountInput value={saved} onChangeText={setSaved} placeholder="0" accessibilityLabel="Số tiền đã có" />
      </Field>

      <Field
        label="Tiền của mục tiêu nằm ở đâu (tuỳ chọn)"
        hint="Chọn tài khoản giữ khoản này, ví dụ sổ tiết kiệm. Khi góp từ một ví, tiền sẽ được chuyển sang tài khoản đó."
      >
        <Chips
          options={[...accountOptions(assets.filter((a) => a.category !== 'debt' && a.category !== 'lent'), assetId), { id: '', label: 'Chưa gắn', icon: null }]}
          value={assetId}
          onChange={setAssetId}
        />
      </Field>
    </Sheet>
  );
}
