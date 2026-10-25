import { useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import {
  addMonths,
  formatDigits,
  formatVnd,
  GOAL_CATEGORIES,
  isValidDateKey,
  parseVnd,
  type Goal,
  type GoalCategoryId,
  type GoalFrequency,
  type GoalType,
} from '../finance';
import { newId } from '../store';
import { colors, ui } from '../theme';
import { Icon, type IconName } from './Icon';
import { Chips, Field, Sheet, type ChipOption } from './Sheet';

type Props = {
  visible: boolean;
  goal: Goal | null;
  onClose: () => void;
  onSave: (goal: Goal) => void;
  onDelete: (id: string) => void;
};

const GOAL_TYPES: ChipOption[] = [
  { id: 'recurring', label: 'Tích lũy định kỳ (DCA)', icon: 'refresh', color: colors.primary },
  { id: 'target_amount', label: 'Số tiền mục tiêu', icon: 'goals', color: colors.primary },
];

const FREQUENCIES: ChipOption[] = [
  { id: 'monthly', label: 'Hàng tháng' },
  { id: 'weekly', label: 'Hàng tuần' },
  { id: 'quarterly', label: 'Hàng quý' },
];

const RECURRING_PRESETS = ['200k', '400k', '500k', '1tr', '2tr', '5tr'];
const TARGET_PRESETS = ['20tr', '50tr', '100tr', '200tr', '500tr'];

const DURATIONS: ChipOption[] = [
  { id: '6', label: '6 tháng' },
  { id: '12', label: '1 năm' },
  { id: '24', label: '2 năm' },
  { id: '36', label: '3 năm' },
  { id: '60', label: '5 năm' },
];

const CATEGORY_OPTIONS: ChipOption[] = GOAL_CATEGORIES.map((c) => ({
  id: c.id,
  label: c.label,
  color: c.color,
  icon: c.icon as IconName,
}));

export function GoalForm({ visible, goal, onClose, onSave, onDelete }: Props) {
  const [goalType, setGoalType] = useState<GoalType>('recurring');
  const [category, setCategory] = useState<GoalCategoryId>('etf');
  const [name, setName] = useState('');
  const [recurringAmount, setRecurringAmount] = useState('400k');
  const [frequency, setFrequency] = useState<GoalFrequency>('monthly');
  const [durationMonths, setDurationMonths] = useState(12);
  const [target, setTarget] = useState('');
  const [customTargetActive, setCustomTargetActive] = useState(false);
  const [saved, setSaved] = useState('');
  const [deadline, setDeadline] = useState(addMonths(12));
  const [error, setError] = useState('');

  useEffect(() => {
    if (!visible) return;
    if (goal) {
      setGoalType(goal.type ?? (goal.recurringAmount ? 'recurring' : 'target_amount'));
      setCategory(goal.category ?? 'etf');
      setName(goal.name);
      setRecurringAmount(goal.recurringAmount ? formatDigits(goal.recurringAmount) : '400k');
      setFrequency(goal.frequency ?? 'monthly');
      setTarget(formatDigits(goal.target));
      setSaved(goal.saved ? formatDigits(goal.saved) : '');
      setDeadline(goal.deadline);
      setCustomTargetActive(true);
    } else {
      setGoalType('recurring');
      setCategory('etf');
      setName('');
      setRecurringAmount('400k');
      setFrequency('monthly');
      setDurationMonths(12);
      setSaved('');
      setDeadline(addMonths(12));
      setCustomTargetActive(false);
      // Auto-compute target: 400k * 12 = 4.8tr
      setTarget(formatDigits(400_000 * 12));
    }
    setError('');
  }, [visible, goal]);

  // When recurring parameters change, auto-update target if user hasn't overridden it
  const updateRecurringEstimate = (amountStr: string, months: number, freq: GoalFrequency) => {
    const val = parseVnd(amountStr);
    if (!val) return;
    // Estimate total periods
    let periods = months;
    if (freq === 'weekly') periods = Math.round(months * 4.33);
    else if (freq === 'quarterly') periods = Math.max(1, Math.round(months / 3));

    const computed = val * periods;
    if (!customTargetActive || !target) {
      setTarget(formatDigits(computed));
    }
  };

  const handleRecurringAmountChange = (text: string) => {
    setRecurringAmount(text);
    updateRecurringEstimate(text, durationMonths, frequency);
  };

  const handleDurationChange = (monthsStr: string) => {
    const months = Number(monthsStr);
    setDurationMonths(months);
    setDeadline(addMonths(months));
    updateRecurringEstimate(recurringAmount, months, frequency);
  };

  const handleFrequencyChange = (id: string) => {
    const freq = id as GoalFrequency;
    setFrequency(freq);
    updateRecurringEstimate(recurringAmount, durationMonths, freq);
  };

  const getDynamicPlaceholder = () => {
    switch (category) {
      case 'etf':
        return 'Ví dụ: Quỹ ETF VN30, Quỹ ETF Diamond, Tích sản cổ phiếu...';
      case 'saving':
        return 'Ví dụ: Sổ tiết kiệm 12 tháng, Tiết kiệm sinh lời...';
      case 'emergency':
        return 'Ví dụ: Quỹ dự phòng khẩn cấp 6 tháng chi tiêu...';
      case 'housing':
        return 'Ví dụ: Mua nhà, Mua xe ô tô...';
      case 'shopping':
        return 'Ví dụ: Mua MacBook Pro, Đổi điện thoại...';
      case 'education':
        return 'Ví dụ: Học tiếng Anh, Du lịch Nhật Bản...';
      default:
        return 'Ví dụ: Kế hoạch tài chính 2027...';
    }
  };

  const save = () => {
    if (!name.trim()) {
      return setError('Hãy đặt tên cho mục tiêu, ví dụ: "Quỹ ETF VN30".');
    }

    let parsedRecurring: number | undefined;
    if (goalType === 'recurring') {
      const rec = parseVnd(recurringAmount);
      if (!rec || rec <= 0) {
        return setError('Hãy nhập số tiền góp mỗi kỳ hợp lệ. Ví dụ: 400k.');
      }
      parsedRecurring = rec;
    }

    const targetValue = parseVnd(target);
    if (!targetValue || targetValue <= 0) {
      return setError('Số tiền mục tiêu không hợp lệ. Ví dụ: 4.8tr hoặc 100tr.');
    }

    const savedValue = saved.trim() ? parseVnd(saved) : 0;
    if (savedValue === null) return setError('Số tiền đã có không hợp lệ.');

    if (!isValidDateKey(deadline)) {
      return setError('Hạn phải có dạng NNNN-TT-NN, ví dụ 2027-10-25.');
    }

    onSave({
      id: goal?.id ?? newId(),
      name: name.trim(),
      type: goalType,
      category,
      recurringAmount: parsedRecurring,
      frequency,
      target: targetValue,
      saved: savedValue,
      deadline,
      lastContributedAt: goal?.lastContributedAt,
      contributionsCount: goal?.contributionsCount,
    });
    onClose();
  };

  const parsedRec = parseVnd(recurringAmount);
  const parsedTgt = parseVnd(target);

  return (
    <Sheet
      visible={visible}
      title={goal ? 'Sửa mục tiêu' : 'Thêm mục tiêu tài chính'}
      onClose={onClose}
      onSave={save}
      onDelete={goal ? () => (onDelete(goal.id), onClose()) : undefined}
      error={error}
    >
      {/* 1. Kiểu mục tiêu */}
      <Field label="Hình thức mục tiêu" icon="goals">
        <Chips
          options={GOAL_TYPES}
          value={goalType}
          onChange={(id) => {
            const nextType = id as GoalType;
            setGoalType(nextType);
            if (nextType === 'recurring') {
              updateRecurringEstimate(recurringAmount, durationMonths, frequency);
            }
          }}
          showIcons={true}
        />
      </Field>

      {/* 2. Danh mục mục tiêu */}
      <Field label="Phân loại" icon="pie-chart">
        <Chips
          options={CATEGORY_OPTIONS}
          value={category}
          onChange={(id) => setCategory(id as GoalCategoryId)}
          showIcons={true}
        />
      </Field>

      {/* 3. Tên mục tiêu */}
      <Field label="Tên mục tiêu" icon="edit">
        <TextInput
          placeholderTextColor={colors.muted}
          style={ui.input}
          value={name}
          onChangeText={setName}
          placeholder={getDynamicPlaceholder()}
        />
      </Field>

      {/* 4. Cấu hình theo hình thức */}
      {goalType === 'recurring' ? (
        <>
          {/* Số tiền góp mỗi kỳ */}
          <Field
            label={`Số tiền góp mỗi ${frequency === 'weekly' ? 'tuần' : frequency === 'quarterly' ? 'quý' : 'tháng'} (VND)`}
            icon="wallet"
          >
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
              {RECURRING_PRESETS.map((p) => (
                <Pressable
                  key={p}
                  onPress={() => handleRecurringAmountChange(p)}
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                    borderRadius: 4,
                    borderWidth: 1,
                    borderColor: recurringAmount === p ? colors.primary : colors.border,
                    backgroundColor: recurringAmount === p ? colors.primaryLight : '#FFFFFF',
                  }}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: '600',
                      color: recurringAmount === p ? colors.primary : colors.text,
                    }}
                  >
                    {p}
                  </Text>
                </Pressable>
              ))}
            </View>
            <TextInput
              placeholderTextColor={colors.muted}
              style={ui.input}
              value={recurringAmount}
              onChangeText={handleRecurringAmountChange}
              placeholder="Ví dụ: 400k, 500k hoặc 1tr"
              autoCapitalize="none"
            />
          </Field>

          {/* Chu kỳ */}
          <Field label="Chu kỳ đóng góp" icon="clock">
            <Chips
              options={FREQUENCIES}
              value={frequency}
              onChange={handleFrequencyChange}
              showIcons={false}
            />
          </Field>

          {/* Thời hạn dự kiến */}
          <Field label="Thời gian tích lũy dự kiến" icon="calendar">
            <Chips
              options={DURATIONS}
              value={String(durationMonths)}
              onChange={handleDurationChange}
              showIcons={false}
            />
          </Field>

          {/* Tóm tắt ước tính */}
          {parsedRec ? (
            <View
              style={{
                padding: 12,
                backgroundColor: colors.background,
                borderRadius: 6,
                borderWidth: 1,
                borderColor: colors.borderSubtle,
                gap: 4,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Icon name="sparkles" size={14} color={colors.primary} />
                <Text style={{ fontSize: 13, fontWeight: '700', color: colors.primary }}>
                  Dự kiến tích lũy: {formatVnd(parsedTgt || parsedRec * durationMonths)}
                </Text>
              </View>
              <Text style={{ fontSize: 12, color: colors.muted, lineHeight: 18 }}>
                Góp đều đặn {formatVnd(parsedRec)}/{frequency === 'weekly' ? 'tuần' : frequency === 'quarterly' ? 'quý' : 'tháng'} trong {durationMonths} tháng (hạn: {deadline}).
              </Text>
            </View>
          ) : null}

          {/* Tuỳ chỉnh mốc tổng tiền nếu muốn */}
          <Field label="Mục tiêu tổng số tiền (VND)" icon="trending-up">
            <TextInput
              placeholderTextColor={colors.muted}
              style={ui.input}
              value={target}
              onChangeText={(t) => {
                setTarget(t);
                setCustomTargetActive(true);
              }}
              placeholder="Tự động tính hoặc nhập mốc riêng (vd: 50tr)"
              autoCapitalize="none"
            />
          </Field>
        </>
      ) : (
        <>
          {/* Target Amount Mode */}
          <Field label="Số tiền cần có (VND)" icon="wallet">
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
              {TARGET_PRESETS.map((p) => (
                <Pressable
                  key={p}
                  onPress={() => setTarget(p)}
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                    borderRadius: 4,
                    borderWidth: 1,
                    borderColor: target === p ? colors.primary : colors.border,
                    backgroundColor: target === p ? colors.primaryLight : '#FFFFFF',
                  }}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: '600',
                      color: target === p ? colors.primary : colors.text,
                    }}
                  >
                    {p}
                  </Text>
                </Pressable>
              ))}
            </View>
            <TextInput
              placeholderTextColor={colors.muted}
              style={ui.input}
              value={target}
              onChangeText={setTarget}
              placeholder="Ví dụ: 100tr"
              autoCapitalize="none"
            />
          </Field>

          {/* Hạn hoàn thành */}
          <Field label="Hạn hoàn thành (NNNN-TT-NN)" icon="calendar">
            <Chips
              options={DURATIONS}
              value={String(durationMonths)}
              onChange={handleDurationChange}
              showIcons={false}
            />
            <TextInput
              placeholderTextColor={colors.muted}
              style={ui.input}
              value={deadline}
              onChangeText={setDeadline}
              autoCapitalize="none"
            />
          </Field>
        </>
      )}

      {/* Đã để dành được */}
      <Field label="Đã có sẵn (nếu có, VND)" icon="saving">
        <TextInput
          placeholderTextColor={colors.muted}
          style={ui.input}
          value={saved}
          onChangeText={setSaved}
          placeholder="0"
          autoCapitalize="none"
        />
      </Field>
    </Sheet>
  );
}
