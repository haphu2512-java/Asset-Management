import { useEffect, useState } from 'react';
import { TextInput } from 'react-native';
import { formatDigits, parseVnd, todayKey, type Goal } from '../finance';
import { newId } from '../store';
import { colors, ui } from '../theme';
import { Chips, Field, Sheet } from './Sheet';

type Props = {
  visible: boolean;
  goal: Goal | null;
  onClose: () => void;
  onSave: (goal: Goal) => void;
  onDelete: (id: string) => void;
};

const DURATIONS = [
  { id: '6', label: '6 tháng', color: colors.primary },
  { id: '12', label: '1 năm', color: colors.primary },
  { id: '24', label: '2 năm', color: colors.primary },
  { id: '60', label: '5 năm', color: colors.primary },
];

function addMonths(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return todayKey(d);
}

export function GoalForm({ visible, goal, onClose, onSave, onDelete }: Props) {
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [saved, setSaved] = useState('');
  const [deadline, setDeadline] = useState(addMonths(12));
  const [error, setError] = useState('');

  useEffect(() => {
    if (!visible) return;
    setName(goal?.name ?? '');
    setTarget(goal ? formatDigits(goal.target) : '');
    setSaved(goal ? formatDigits(goal.saved) : '');
    setDeadline(goal?.deadline ?? addMonths(12));
    setError('');
  }, [visible, goal]);

  const save = () => {
    if (!name.trim()) return setError('Hãy đặt tên cho mục tiêu, ví dụ "Quỹ dự phòng".');
    const targetValue = parseVnd(target);
    if (!targetValue) return setError('Số tiền mục tiêu không hợp lệ. Ví dụ: 100tr.');
    const savedValue = saved.trim() ? parseVnd(saved) : 0;
    if (savedValue === null) return setError('Số tiền đã có không hợp lệ.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(deadline) || Number.isNaN(Date.parse(deadline))) {
      return setError('Hạn phải có dạng NNNN-TT-NN, ví dụ 2027-10-21.');
    }
    onSave({ id: goal?.id ?? newId(), name: name.trim(), target: targetValue, saved: savedValue, deadline });
    onClose();
  };

  return (
    <Sheet
      visible={visible}
      title={goal ? 'Sửa mục tiêu' : 'Thêm mục tiêu'}
      onClose={onClose}
      onSave={save}
      onDelete={goal ? () => (onDelete(goal.id), onClose()) : undefined}
      error={error}
    >
      <Field label="Tên mục tiêu" icon="goals">
        <TextInput
          placeholderTextColor={colors.muted}
          style={ui.input}
          value={name}
          onChangeText={setName}
          placeholder="Ví dụ: Quỹ dự phòng, Mua xe, Du lịch Nhật"
        />
      </Field>
      <Field label="Số tiền cần có (VND)" icon="wallet">
        <TextInput
          placeholderTextColor={colors.muted}
          style={ui.input}
          value={target}
          onChangeText={setTarget}
          placeholder="100tr"
          autoCapitalize="none"
        />
      </Field>
      <Field label="Đã để dành được (VND)" icon="saving">
        <TextInput
          placeholderTextColor={colors.muted}
          style={ui.input}
          value={saved}
          onChangeText={setSaved}
          placeholder="0"
          autoCapitalize="none"
        />
      </Field>
      <Field label="Hạn hoàn thành (NNNN-TT-NN)" icon="calendar">
        <Chips options={DURATIONS} value="" onChange={(id) => setDeadline(addMonths(Number(id)))} showIcons={false} />
        <TextInput
          placeholderTextColor={colors.muted}
          style={ui.input}
          value={deadline}
          onChangeText={setDeadline}
          autoCapitalize="none"
        />
      </Field>
    </Sheet>
  );
}
