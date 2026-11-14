import { useRef, useState } from 'react';
import {
  addMonths,
  formatDigits,
  frequencyUnit,
  GOAL_CATEGORIES,
  goalProgress,
  parseVndExpression,
  todayKey,
  type Goal,
  type GoalCategoryId,
  type GoalFrequency,
  type GoalType,
} from '@shared/finance';
import { usePrefs } from '@shared/prefs';
import { newId, useStore } from '@shared/store';
import { useMoney } from '../hooks';
import { accountOptions, walletOptions } from './options';
import { useToast } from './Toast';
import { AmountInput, Chips, DateInput, Field, Modal, Segmented } from './ui';

const TYPES: { id: GoalType; label: string }[] = [
  { id: 'recurring', label: 'Góp định kỳ' },
  { id: 'target_amount', label: 'Số tiền mục tiêu' },
];
const FREQUENCIES: { id: GoalFrequency; label: string }[] = [
  { id: 'weekly', label: 'Hàng tuần' },
  { id: 'monthly', label: 'Hàng tháng' },
  { id: 'quarterly', label: 'Hàng quý' },
];
const DURATIONS = [
  { id: '6', label: '6 tháng' },
  { id: '12', label: '1 năm' },
  { id: '24', label: '2 năm' },
  { id: '36', label: '3 năm' },
  { id: '60', label: '5 năm' },
];

/** How many contributions fit in a number of months. */
function periodsIn(months: number, frequency: GoalFrequency): number {
  if (frequency === 'weekly') return Math.round(months * (52 / 12));
  if (frequency === 'quarterly') return Math.max(1, Math.round(months / 3));
  return months;
}

export function GoalForm({ goal, onClose }: { goal: Goal | null; onClose: () => void }) {
  const { assets, saveGoal, deleteGoal } = useStore();
  const toast = useToast();
  const format = useMoney();
  const [goalType, setGoalType] = useState<GoalType>(goal?.type ?? 'recurring');
  const [category, setCategory] = useState<GoalCategoryId>(goal?.category ?? 'saving');
  const [name, setName] = useState(goal?.name ?? '');
  const [recurringAmount, setRecurringAmount] = useState(goal?.recurringAmount ? formatDigits(goal.recurringAmount) : '');
  const [frequency, setFrequency] = useState<GoalFrequency>(goal?.frequency ?? 'monthly');
  const [durationMonths, setDurationMonths] = useState(goal ? 0 : 12);
  const [target, setTarget] = useState(goal ? formatDigits(goal.target) : '');
  /** Once the user types a target for a recurring plan it stops following amount × periods. */
  const [customTarget, setCustomTarget] = useState(!!goal);
  const [saved, setSaved] = useState(goal?.saved ? formatDigits(goal.saved) : '');
  const [deadline, setDeadline] = useState(goal?.deadline ?? addMonths(12));
  const [assetId, setAssetId] = useState(goal?.assetId ?? '');
  const [error, setError] = useState('');

  /** Keeps the target of a recurring plan equal to amount × periods until the user overrides it. */
  const follow = (amountText: string, months: number, freq: GoalFrequency) => {
    const value = parseVndExpression(amountText);
    if (!customTarget && value && months > 0) setTarget(formatDigits(value * periodsIn(months, freq)));
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

  return (
    <Modal
      title={goal ? 'Sửa mục tiêu' : 'Thêm mục tiêu'}
      onClose={onClose}
      onSave={save}
      onDelete={goal ? remove : undefined}
      confirmDelete="Mục tiêu và lịch sử góp của nó sẽ bị xoá."
      error={error}
    >
      <Segmented options={TYPES} value={goalType} onChange={setGoalType} />
      <Field label="Phân loại">
        <Chips options={GOAL_CATEGORIES.map((c) => ({ id: c.id, label: c.label, color: c.color }))} value={category} onChange={(id) => setCategory(id as GoalCategoryId)} />
      </Field>
      <Field label="Tên mục tiêu">
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ví dụ: Quỹ dự phòng 6 tháng" maxLength={80} />
      </Field>
      {goalType === 'recurring' ? (
        <>
          <Field label="Chu kỳ góp">
            <Segmented
              options={FREQUENCIES}
              value={frequency}
              onChange={(id) => {
                setFrequency(id);
                follow(recurringAmount, durationMonths, id);
              }}
            />
          </Field>
          <Field label={`Số tiền góp mỗi ${unit} (VND)`}>
            <AmountInput
              value={recurringAmount}
              onChange={(text) => {
                setRecurringAmount(text);
                follow(text, durationMonths, frequency);
              }}
              placeholder="Ví dụ: 500k"
              large={false}
            />
          </Field>
          <Field label="Thời gian tích luỹ">
            <Chips
              options={DURATIONS}
              value={String(durationMonths)}
              onChange={(id) => {
                const months = Number(id);
                setDurationMonths(months);
                setDeadline(addMonths(months));
                follow(recurringAmount, months, frequency);
              }}
            />
          </Field>
          <Field label="Tổng số tiền mục tiêu (VND)" hint={planned && total ? `Góp ${format(planned)} mỗi ${unit} để đạt ${format(total)}.` : undefined}>
            <AmountInput
              value={target}
              onChange={(t) => {
                setTarget(t);
                setCustomTarget(true);
              }}
              placeholder="Ví dụ: 100tr"
              large={false}
            />
          </Field>
        </>
      ) : (
        <Field label="Số tiền cần có (VND)">
          <AmountInput value={target} onChange={setTarget} placeholder="Ví dụ: 100tr" />
        </Field>
      )}
      <Field label="Hạn hoàn thành">
        <DateInput
          value={deadline}
          onChange={(d) => {
            setDeadline(d);
            setDurationMonths(0);
          }}
        />
      </Field>
      <Field label="Đã có sẵn (VND, tuỳ chọn)">
        <AmountInput value={saved} onChange={setSaved} placeholder="Ví dụ: 5tr" large={false} />
      </Field>
      <Field label="Tiền của mục tiêu nằm ở đâu (tuỳ chọn)" hint="Gắn với một tài khoản để mỗi lần góp từ ví sẽ tự chuyển tiền vào tài khoản đó.">
        <Chips options={[...accountOptions(assets, assetId), { id: '', label: 'Chưa gắn' }]} value={assetId} onChange={setAssetId} />
      </Field>
    </Modal>
  );
}

export function ContributeForm({ goal, onClose }: { goal: Goal; onClose: () => void }) {
  const { assets, contribute, removeContribution, contributions } = useStore();
  const { prefs } = usePrefs();
  const toast = useToast();
  const format = useMoney();
  const p = goalProgress(goal);
  const [amount, setAmount] = useState(p.periodAmount > 0 ? formatDigits(Math.min(p.periodAmount, p.remaining || p.periodAmount)) : '');
  const [date, setDate] = useState(todayKey());
  const [wallet, setWallet] = useState(goal.assetId && prefs.lastAccountId && prefs.lastAccountId !== goal.assetId ? prefs.lastAccountId : '');
  const [error, setError] = useState('');

  const target = goal.assetId ? assets.find((a) => a.id === goal.assetId) : undefined;
  const wallets = walletOptions(assets, wallet).filter((o) => o.id !== goal.assetId);

  // Read the contributions as they are when Undo is pressed, not as they were when the toast opened.
  const latest = useRef(contributions);
  latest.current = contributions;

  const save = () => {
    const value = parseVndExpression(amount);
    if (!value || value <= 0) return setError('Số tiền không hợp lệ. Ví dụ: 400k hoặc 2tr.');
    const before = new Set(contributions.map((c) => c.id));
    contribute(goal.id, value, { accountId: wallet || undefined, date });
    onClose();
    toast.show({
      message: `Đã góp ${format(value)} vào "${goal.name}".`,
      tone: 'success',
      actionLabel: 'Hoàn tác',
      onAction: () => {
        const added = latest.current.find((c) => c.goalId === goal.id && !before.has(c.id));
        if (added) removeContribution(added.id);
      },
    });
  };

  return (
    <Modal title={`Góp vào "${goal.name}"`} onClose={onClose} onSave={save} saveLabel="Góp" error={error}>
      <Field label="Số tiền">
        <AmountInput value={amount} onChange={setAmount} placeholder="Ví dụ: 400k" autoFocus />
      </Field>
      <Field label="Ngày góp">
        <DateInput value={date} onChange={setDate} />
      </Field>
      <Field
        label="Lấy tiền từ ví"
        hint={
          target
            ? `Chọn ví để chuyển tiền thật sang "${target.name}". Không chọn thì chỉ ghi nhận tiến độ.`
            : 'Mục tiêu chưa gắn với tài khoản nào nên lần góp này chỉ ghi nhận tiến độ.'
        }
      >
        <Chips options={wallets} value={wallet} onChange={setWallet} />
      </Field>
    </Modal>
  );
}
