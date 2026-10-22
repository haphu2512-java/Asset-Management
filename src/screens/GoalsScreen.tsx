import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { describeAdviceError, getGoalAdvice } from '../advisor';
import { GoalForm } from '../components/GoalForm';
import { Icon } from '../components/Icon';
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
      <View style={ui.row}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
          <Icon name="goals" size={16} color={colors.primary} />
          <Text style={[ui.heading, { flex: 1 }]}>{goal.name}</Text>
        </View>
        <Pressable
          onPress={onEdit}
          hitSlop={8}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            paddingHorizontal: 8,
            paddingVertical: 3,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 4,
          }}
        >
          <Icon name="edit" size={12} color={colors.muted} />
          <Text style={{ fontSize: 12, color: colors.muted, fontWeight: '500' }}>Sửa</Text>
        </Pressable>
      </View>

      <View style={ui.row}>
        <Text style={[ui.text, { fontWeight: '700' }]}>{formatVnd(goal.saved)}</Text>
        <Text style={ui.label}>Mục tiêu: {formatVnd(goal.target)}</Text>
      </View>

      {/* Clean flat progress line */}
      <View style={{ height: 6, backgroundColor: colors.borderSubtle, borderRadius: 3, overflow: 'hidden' }}>
        <View
          style={{
            width: `${Math.min(100, Math.round(p.ratio * 100))}%`,
            height: '100%',
            backgroundColor: done ? colors.income : colors.primary,
          }}
        />
      </View>

      <View style={ui.row}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <Icon name="calendar" size={12} color={colors.muted} />
          <Text style={ui.label}>
            {Math.round(p.ratio * 100)}% hoàn thành · Hạn {formatDate(goal.deadline)}
          </Text>
        </View>
        {done ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
            <Icon name="check" size={12} color={colors.income} strokeWidth={2.5} />
            <Text style={[ui.label, { color: colors.income, fontWeight: '600' }]}>Đã đạt</Text>
          </View>
        ) : null}
      </View>

      {!done ? (
        <Text style={[ui.label, { color: p.overdue ? colors.expense : colors.muted }]}>
          {p.overdue
            ? `Đã quá hạn, còn thiếu ${formatVnd(p.remaining)}.`
            : `Cần tích lũy ~${formatVnd(p.monthlyNeeded)}/tháng trong ${p.monthsLeft} tháng tới.`}
        </Text>
      ) : null}

      <View style={ui.divider} />

      {/* Input contribution row */}
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        <TextInput
          placeholderTextColor={colors.muted}
          style={[ui.input, { flex: 1, paddingVertical: 6 }]}
          value={contribution}
          onChangeText={setContribution}
          placeholder="Nhập số tiền góp (ví dụ: 2tr)"
          autoCapitalize="none"
          onSubmitEditing={contribute}
        />
        <Pressable
          style={[ui.button, { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 7, paddingHorizontal: 12 }]}
          onPress={contribute}
        >
          <Icon name="plus" size={13} color="#FFFFFF" strokeWidth={2.5} />
          <Text style={[ui.buttonText, { fontSize: 13 }]}>Góp tiền</Text>
        </Pressable>
      </View>

      {/* AI Action button */}
      <Pressable
        onPress={askAi}
        disabled={loading}
        style={{
          marginTop: 2,
          paddingVertical: 4,
          alignSelf: 'flex-start',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 5,
        }}
      >
        {loading ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <>
            <Icon name="sparkles" size={14} color={colors.primary} />
            <Text style={{ color: colors.primary, fontWeight: '600', fontSize: 13 }}>
              Tư vấn cách đạt mục tiêu
            </Text>
          </>
        )}
      </Pressable>

      {error ? <Text style={{ color: colors.expense, fontSize: 12 }}>{error}</Text> : null}

      {advice ? (
        <View style={{ marginTop: 4, padding: 10, backgroundColor: colors.background, borderRadius: 4, borderWidth: 1, borderColor: colors.border }}>
          <Text style={[ui.text, { fontSize: 13, lineHeight: 20 }]} selectable>
            {advice}
          </Text>
        </View>
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
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Icon name="goals" size={18} color={colors.primary} />
              <Text style={ui.heading}>Chưa có mục tiêu</Text>
            </View>
            <Text style={ui.label}>
              Bấm nút [+] để lập kế hoạch tài chính (ví dụ: Mua nhà, Mua xe, Quỹ dự phòng). Hệ thống sẽ tính số tiền cần tích lũy mỗi tháng.
            </Text>
          </View>
        ) : null}
        {goals.map((g) => (
          <GoalCard key={g.id} goal={g} onEdit={() => open(g)} />
        ))}
      </ScrollView>

      <Pressable style={ui.fab} onPress={() => open(null)} accessibilityLabel="Thêm mục tiêu">
        <Icon name="plus" size={22} color="#FFFFFF" strokeWidth={2.5} />
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

