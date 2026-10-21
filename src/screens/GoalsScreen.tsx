import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { describeAdviceError, getGoalAdvice } from '../advisor';
import { GoalForm } from '../components/GoalForm';
import { formatVnd, goalProgress, parseVnd, type Goal } from '../finance';
import { useStore } from '../store';
import { colors, ui } from '../theme';

function formatDate(date: string): string {
  const [y, m, d] = date.split('-');
  return `${Number(d)}/${Number(m)}/${y}`;
}

function GoalCard({ goal, onEdit }: { goal: Goal; onEdit: () => void }) {
  const { assets, transactions, goals, saveGoal } = useStore();
  const [contribution, setContribution] = useState('');
  const [advice, setAdvice] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const p = goalProgress(goal);
  const done = p.remaining === 0;

  const contribute = () => {
    const value = parseVnd(contribution);
    if (!value) return setError('Số tiền không hợp lệ. Ví dụ: 2tr.');
    setError('');
    setContribution('');
    saveGoal({ ...goal, saved: goal.saved + value });
  };

  const askAi = async () => {
    setLoading(true);
    setError('');
    try {
      setAdvice(await getGoalAdvice(goal, assets, transactions, goals));
    } catch (e) {
      setError(describeAdviceError(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={ui.card}>
      <Pressable onPress={onEdit} style={ui.row}>
        <Text style={[ui.heading, { flex: 1 }]}>{goal.name}</Text>
        <Text style={[ui.label, { color: colors.primary }]}>Sửa</Text>
      </Pressable>
      <Text style={ui.text}>
        {formatVnd(goal.saved)} / {formatVnd(goal.target)}
      </Text>
      <View style={{ height: 10, borderRadius: 5, backgroundColor: colors.border, overflow: 'hidden' }}>
        <View
          style={{
            width: `${Math.round(p.ratio * 100)}%`,
            height: '100%',
            backgroundColor: done ? colors.income : colors.primary,
          }}
        />
      </View>
      <View style={ui.row}>
        <Text style={ui.label}>{Math.round(p.ratio * 100)}% · hạn {formatDate(goal.deadline)}</Text>
        {done ? <Text style={[ui.label, { color: colors.income }]}>Đã đạt mục tiêu 🎉</Text> : null}
      </View>
      {!done ? (
        <Text style={[ui.text, p.overdue && { color: colors.expense }]}>
          {p.overdue
            ? `Đã quá hạn, còn thiếu ${formatVnd(p.remaining)}.`
            : `Cần để dành ${formatVnd(p.monthlyNeeded)}/tháng trong ${p.monthsLeft} tháng tới.`}
        </Text>
      ) : null}

      <View style={{ flexDirection: 'row', gap: 8 }}>
        <TextInput
          placeholderTextColor={colors.muted}
          style={[ui.input, { flex: 1, paddingVertical: 8 }]}
          value={contribution}
          onChangeText={setContribution}
          placeholder="Góp thêm, ví dụ 2tr"
          autoCapitalize="none"
          onSubmitEditing={contribute}
        />
        <Pressable style={[ui.button, { paddingHorizontal: 16, paddingVertical: 8 }]} onPress={contribute}>
          <Text style={ui.buttonText}>Góp</Text>
        </Pressable>
      </View>
      <Pressable onPress={askAi} disabled={loading} style={{ paddingVertical: 4 }}>
        {loading ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <Text style={{ color: colors.primary, fontWeight: '600' }}>✦ Hỏi AI cách đạt mục tiêu này</Text>
        )}
      </Pressable>
      {error ? <Text style={{ color: colors.expense }}>{error}</Text> : null}
      {advice ? (
        <Text style={[ui.text, { lineHeight: 22 }]} selectable>
          {advice}
        </Text>
      ) : null}
    </View>
  );
}

export function GoalsScreen() {
  const { goals, saveGoal, deleteGoal } = useStore();
  const [editing, setEditing] = useState<Goal | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const open = (goal: Goal | null) => {
    setEditing(goal);
    setFormOpen(true);
  };

  return (
    <View style={ui.screen}>
      <ScrollView contentContainerStyle={ui.content} keyboardShouldPersistTaps="handled">
        {goals.length === 0 ? (
          <View style={ui.card}>
            <Text style={ui.heading}>Chưa có mục tiêu nào</Text>
            <Text style={ui.label}>
              Bấm nút + để đặt mục tiêu, ví dụ để dành 100tr trong 1 năm. App sẽ tính số tiền cần để dành mỗi
              tháng và AI có thể gợi ý cách đạt được.
            </Text>
          </View>
        ) : null}
        {goals.map((g) => (
          <GoalCard key={g.id} goal={g} onEdit={() => open(g)} />
        ))}
      </ScrollView>
      <Pressable style={ui.fab} onPress={() => open(null)} accessibilityLabel="Thêm mục tiêu">
        <Text style={ui.fabText}>+</Text>
      </Pressable>
      <GoalForm
        visible={formOpen}
        goal={editing}
        onClose={() => setFormOpen(false)}
        onSave={saveGoal}
        onDelete={deleteGoal}
      />
    </View>
  );
}
