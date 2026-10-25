import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { describeAdviceError, getGoalAdvice } from '../advisor';
import { GoalForm } from '../components/GoalForm';
import { Icon, type IconName } from '../components/Icon';
import {
  formatDigits,
  formatVnd,
  getGoalCategory,
  goalProgress,
  parseVnd,
  todayKey,
  type Goal,
  type GoalCategoryId,
} from '../finance';
import { newId, useStore } from '../store';
import { colors, ui } from '../theme';

function formatDate(date: string): string {
  const [y, m, d] = date.split('-');
  return `${Number(d)}/${Number(m)}/${y}`;
}

function GoalCard({ goal, onEdit }: { goal: Goal; onEdit: () => void }) {
  const { assets, transactions, goals, saveGoal, saveTransaction } = useStore();
  const [contribution, setContribution] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [recordExpense, setRecordExpense] = useState(false);
  const [advice, setAdvice] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const p = goalProgress(goal);
  const done = p.remaining === 0;
  const cat = getGoalCategory(goal.category);
  const isRecurring = goal.type === 'recurring';

  const doContribute = (amount: number) => {
    setError('');
    const nextSaved = goal.saved + amount;
    const nextCount = (goal.contributionsCount || 0) + 1;
    saveGoal({
      ...goal,
      saved: nextSaved,
      lastContributedAt: todayKey(),
      contributionsCount: nextCount,
    });

    if (recordExpense) {
      saveTransaction({
        id: newId(),
        kind: 'expense',
        category: goal.category === 'etf' || goal.category === 'stock' ? 'investment' : 'other-expense',
        amount,
        note: `Tích lũy mục tiêu: ${goal.name}`,
        date: todayKey(),
      });
    }

    setContribution('');
    setShowCustomInput(false);
  };

  const handleCustomContribute = () => {
    const value = parseVnd(contribution);
    if (!value || value <= 0) {
      return setError('Số tiền không hợp lệ. Ví dụ: 400k hoặc 2tr.');
    }
    doContribute(value);
  };

  const handleQuickRecurring = () => {
    const amount = goal.recurringAmount || 400_000;
    doContribute(amount);
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
      {/* 1. Header: Category badge, Title & Edit button */}
      <View style={ui.row}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
          <View
            style={{
              width: 32,
              height: 32,
              borderRadius: 6,
              backgroundColor: `${cat.color}15`,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name={cat.icon as IconName} size={16} color={cat.color} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[ui.heading, { fontSize: 15 }]}>{goal.name}</Text>
            <Text style={{ fontSize: 11, color: cat.color, fontWeight: '600', marginTop: 1 }}>
              {cat.label}
            </Text>
          </View>
        </View>

        <Pressable
          onPress={onEdit}
          hitSlop={8}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 4,
            backgroundColor: '#FFFFFF',
          }}
        >
          <Icon name="edit" size={12} color={colors.muted} />
          <Text style={{ fontSize: 12, color: colors.muted, fontWeight: '500' }}>Sửa</Text>
        </Pressable>
      </View>

      {/* 2. Mode & Schedule Pill */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        {isRecurring && goal.recurringAmount ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 5,
              paddingHorizontal: 8,
              paddingVertical: 3,
              borderRadius: 4,
              backgroundColor: colors.primaryLight,
            }}
          >
            <Icon name="refresh" size={12} color={colors.primary} />
            <Text style={{ fontSize: 12, fontWeight: '700', color: colors.primary }}>
              Định kỳ: {formatVnd(goal.recurringAmount)} / {goal.frequency === 'weekly' ? 'tuần' : goal.frequency === 'quarterly' ? 'quý' : 'tháng'}
            </Text>
          </View>
        ) : null}

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            paddingHorizontal: 8,
            paddingVertical: 3,
            borderRadius: 4,
            backgroundColor: colors.background,
            borderWidth: 1,
            borderColor: colors.borderSubtle,
          }}
        >
          <Icon name="calendar" size={11} color={colors.muted} />
          <Text style={{ fontSize: 11, color: colors.muted }}>
            Hạn: {formatDate(goal.deadline)}
          </Text>
        </View>

        {goal.contributionsCount ? (
          <Text style={{ fontSize: 11, color: colors.muted }}>
            · Đã góp {goal.contributionsCount} kỳ
          </Text>
        ) : null}
      </View>

      {/* 3. Amounts & Progress Bar */}
      <View style={[ui.row, { marginTop: 2 }]}>
        <View>
          <Text style={{ fontSize: 11, color: colors.muted }}>Đã tích lũy</Text>
          <Text style={[ui.text, { fontSize: 16, fontWeight: '700', color: colors.primary }]}>
            {formatVnd(goal.saved)}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ fontSize: 11, color: colors.muted }}>Mục tiêu tổng</Text>
          <Text style={[ui.text, { fontSize: 15, fontWeight: '600' }]}>
            {formatVnd(goal.target)}
          </Text>
        </View>
      </View>

      {/* Progress line */}
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
        <Text style={ui.label}>{Math.round(p.ratio * 100)}% hoàn thành</Text>
        {done ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
            <Icon name="check" size={12} color={colors.income} strokeWidth={2.5} />
            <Text style={[ui.label, { color: colors.income, fontWeight: '600' }]}>Đã hoàn thành</Text>
          </View>
        ) : (
          <Text style={ui.label}>Còn thiếu {formatVnd(p.remaining)}</Text>
        )}
      </View>

      {/* 4. Recurring Period Status Banner */}
      {isRecurring && !done ? (
        <View
          style={{
            padding: 10,
            borderRadius: 6,
            borderWidth: 1,
            backgroundColor: p.contributedThisPeriod ? '#F0FDF4' : '#FFFBEB',
            borderColor: p.contributedThisPeriod ? '#BBF7D0' : '#FDE68A',
            gap: 8,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
              <Icon
                name={p.contributedThisPeriod ? 'check' : 'clock'}
                size={14}
                color={p.contributedThisPeriod ? colors.income : '#B45309'}
                strokeWidth={2.2}
              />
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '600',
                  color: p.contributedThisPeriod ? colors.income : '#B45309',
                  flex: 1,
                }}
              >
                {p.contributedThisPeriod
                  ? `Đã hoàn thành góp cho ${p.currentPeriodLabel}`
                  : `Chưa góp cho ${p.currentPeriodLabel} (${formatVnd(goal.recurringAmount || 400_000)})`}
              </Text>
            </View>

            {/* Quick 1-tap contribution button if not contributed yet */}
            {!p.contributedThisPeriod ? (
              <Pressable
                onPress={handleQuickRecurring}
                style={{
                  backgroundColor: colors.primary,
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                  borderRadius: 4,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <Icon name="plus" size={12} color="#FFFFFF" strokeWidth={2.5} />
                <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '700' }}>
                  Góp {formatVnd(goal.recurringAmount || 400_000)}
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : null}

      {!isRecurring && !done ? (
        <Text style={[ui.label, { color: p.overdue ? colors.expense : colors.muted }]}>
          {p.overdue
            ? `Đã quá hạn, còn thiếu ${formatVnd(p.remaining)}.`
            : `Cần tích lũy ~${formatVnd(p.monthlyNeeded)}/tháng trong ${p.monthsLeft} tháng tới.`}
        </Text>
      ) : null}

      <View style={ui.divider} />

      {/* 5. Contribution actions area */}
      {!showCustomInput && isRecurring && p.contributedThisPeriod ? (
        <Pressable
          onPress={() => setShowCustomInput(true)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 5,
            alignSelf: 'flex-start',
            paddingVertical: 2,
          }}
        >
          <Icon name="plus" size={13} color={colors.primary} />
          <Text style={{ fontSize: 13, color: colors.primary, fontWeight: '600' }}>
            Góp thêm vào mục tiêu này
          </Text>
        </Pressable>
      ) : (
        <View style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <TextInput
              placeholderTextColor={colors.muted}
              style={[ui.input, { flex: 1, paddingVertical: 6 }]}
              value={contribution}
              onChangeText={setContribution}
              placeholder={
                isRecurring && goal.recurringAmount
                  ? `Nhập số tiền khác (hoặc ${formatDigits(goal.recurringAmount)})`
                  : 'Nhập số tiền góp (ví dụ: 400k, 2tr)'
              }
              autoCapitalize="none"
              onSubmitEditing={handleCustomContribute}
            />
            <Pressable
              style={[
                ui.button,
                {
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 5,
                  paddingVertical: 7,
                  paddingHorizontal: 12,
                },
              ]}
              onPress={handleCustomContribute}
            >
              <Icon name="plus" size={13} color="#FFFFFF" strokeWidth={2.5} />
              <Text style={[ui.buttonText, { fontSize: 13 }]}>Góp tiền</Text>
            </Pressable>
          </View>

          {/* Optional checkbox to record as transaction */}
          <Pressable
            onPress={() => setRecordExpense((v) => !v)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
          >
            <View
              style={{
                width: 16,
                height: 16,
                borderRadius: 3,
                borderWidth: 1.5,
                borderColor: recordExpense ? colors.primary : colors.muted,
                backgroundColor: recordExpense ? colors.primary : '#FFFFFF',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {recordExpense ? <Icon name="check" size={10} color="#FFFFFF" strokeWidth={3} /> : null}
            </View>
            <Text style={{ fontSize: 12, color: colors.muted }}>
              Đồng thời ghi vào Thu chi (khoản đầu tư/tiết kiệm)
            </Text>
          </Pressable>
        </View>
      )}

      {/* 6. AI Action button */}
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
              Tư vấn chiến lược đạt mục tiêu
            </Text>
          </>
        )}
      </Pressable>

      {error ? <Text style={{ color: colors.expense, fontSize: 12 }}>{error}</Text> : null}

      {advice ? (
        <View
          style={{
            marginTop: 4,
            padding: 10,
            backgroundColor: colors.background,
            borderRadius: 4,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
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
  const [selectedFilter, setSelectedFilter] = useState<GoalCategoryId | 'all'>('all');
  const [editing, setEditing] = useState<Goal | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const open = (goal: Goal | null) => {
    setEditing(goal);
    setFormOpen(true);
  };

  const totalSaved = goals.reduce((s, g) => s + g.saved, 0);
  const totalTarget = goals.reduce((s, g) => s + g.target, 0);
  const totalMonthlyRecurring = goals
    .filter((g) => g.type === 'recurring' && g.recurringAmount)
    .reduce((s, g) => s + (g.recurringAmount || 0), 0);

  const filteredGoals =
    selectedFilter === 'all'
      ? goals
      : goals.filter((g) => (g.category ?? 'saving') === selectedFilter);

  return (
    <View style={ui.screen}>
      <ScrollView contentContainerStyle={ui.content} keyboardShouldPersistTaps="handled">
        {/* 1. Summary Overview Card */}
        {goals.length > 0 ? (
          <View style={[ui.card, { padding: 14 }]}>
            <View style={[ui.row, { marginBottom: 6 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Icon name="goals" size={16} color={colors.primary} />
                <Text style={[ui.label, { fontWeight: '700', letterSpacing: 0.5 }]}>
                  TỔNG QUAN MỤC TIÊU
                </Text>
              </View>
              <Text style={{ fontSize: 12, color: colors.muted }}>
                {goals.length} mục tiêu
              </Text>
            </View>

            <View style={[ui.row, { alignItems: 'flex-end' }]}>
              <View>
                <Text style={{ fontSize: 12, color: colors.muted }}>Tổng đã tích lũy</Text>
                <Text style={{ fontSize: 20, fontWeight: '800', color: colors.primary }}>
                  {formatVnd(totalSaved)}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ fontSize: 11, color: colors.muted }}>Mục tiêu tổng</Text>
                <Text style={{ fontSize: 14, fontWeight: '600' }}>
                  {formatVnd(totalTarget)}
                </Text>
              </View>
            </View>

            {totalMonthlyRecurring > 0 ? (
              <View
                style={{
                  marginTop: 10,
                  paddingTop: 8,
                  borderTopWidth: 1,
                  borderTopColor: colors.borderSubtle,
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <Icon name="refresh" size={13} color={colors.primary} />
                  <Text style={{ fontSize: 12, color: colors.muted }}>
                    Kế hoạch định kỳ hàng tháng:
                  </Text>
                </View>
                <Text style={{ fontSize: 13, fontWeight: '700', color: colors.primary }}>
                  {formatVnd(totalMonthlyRecurring)}/tháng
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* 2. Empty state card */}
        {goals.length === 0 ? (
          <View style={ui.card}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Icon name="goals" size={18} color={colors.primary} />
              <Text style={ui.heading}>Chưa có mục tiêu</Text>
            </View>
            <Text style={ui.label}>
              Bấm nút [+] để lập kế hoạch tài chính. Bạn có thể chọn góp định kỳ hàng tháng (như 400k vào quỹ ETF) hoặc đặt mục tiêu số tiền lớn (Mua nhà, Mua xe, Quỹ dự phòng).
            </Text>
          </View>
        ) : null}

        {/* 3. Goals list */}
        {filteredGoals.map((g) => (
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
