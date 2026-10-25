import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { CategoryBadge, getCategoryIcon, Icon } from '../components/Icon';
import { QuickEntryBar } from '../components/QuickEntryBar';
import { TransactionForm } from '../components/TransactionForm';
import {
  formatDay,
  formatMonth,
  formatVnd,
  getTransactionCategory,
  monthKey,
  shiftDay,
  shiftMonth,
  summarizeDay,
  summarizeMonth,
  todayKey,
  type Transaction,
} from '../finance';
import { useStore } from '../store';
import { colors, ui } from '../theme';

type ViewMode = 'day' | 'month';

export function TransactionsScreen() {
  const { transactions, saveTransaction, deleteTransaction } = useStore();
  const today = todayKey();
  const [viewMode, setViewMode] = useState<ViewMode>('day');
  const [selectedDay, setSelectedDay] = useState(today);
  const [selectedMonth, setSelectedMonth] = useState(monthKey(today));
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  // Summaries
  const daySummary = useMemo(
    () => summarizeDay(transactions, selectedDay),
    [transactions, selectedDay],
  );
  const monthSummary = useMemo(
    () => summarizeMonth(transactions, selectedMonth),
    [transactions, selectedMonth],
  );

  // Day items
  const dayItems = useMemo(
    () =>
      transactions
        .filter((t) => t.date === selectedDay)
        .sort((a, b) => b.id.localeCompare(a.id)),
    [transactions, selectedDay],
  );

  // Month items grouped by date
  const monthGrouped = useMemo(() => {
    const inMonth = transactions
      .filter((t) => monthKey(t.date) === selectedMonth)
      .sort((a, b) => b.date.localeCompare(a.date));

    const groups: { date: string; items: Transaction[]; dayIncome: number; dayExpense: number }[] = [];
    for (const t of inMonth) {
      let g = groups.find((grp) => grp.date === t.date);
      if (!g) {
        g = { date: t.date, items: [], dayIncome: 0, dayExpense: 0 };
        groups.push(g);
      }
      g.items.push(t);
      if (t.kind === 'income') g.dayIncome += t.amount;
      else g.dayExpense += t.amount;
    }
    return groups;
  }, [transactions, selectedMonth]);

  const open = (tx: Transaction | null) => {
    if (tx) {
      setEditing(tx);
    } else {
      // Pre-fill date with currently selected day if adding new
      setEditing({
        id: '',
        kind: 'expense',
        category: 'food',
        amount: 0,
        note: '',
        date: viewMode === 'day' ? selectedDay : today,
      });
    }
    setFormOpen(true);
  };

  const isToday = selectedDay === today;

  return (
    <View style={ui.screen}>
      <ScrollView contentContainerStyle={ui.content} keyboardShouldPersistTaps="handled">
        {/* Quick entry bar (offline + AI photo receipt) */}
        <QuickEntryBar onSave={saveTransaction} />

        {/* View Mode Switcher: Theo ngày | Theo tháng */}
        <View
          style={{
            flexDirection: 'row',
            backgroundColor: colors.card,
            padding: 4,
            borderRadius: 6,
            borderWidth: 1,
            borderColor: colors.border,
            gap: 6,
          }}
        >
          <Pressable
            onPress={() => setViewMode('day')}
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              paddingVertical: 7,
              borderRadius: 4,
              backgroundColor: viewMode === 'day' ? colors.primary : 'transparent',
            }}
          >
            <Icon
              name="calendar"
              size={14}
              color={viewMode === 'day' ? '#FFFFFF' : colors.muted}
            />
            <Text
              style={{
                fontSize: 13,
                fontWeight: viewMode === 'day' ? '700' : '500',
                color: viewMode === 'day' ? '#FFFFFF' : colors.text,
              }}
            >
              Theo ngày
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setViewMode('month')}
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              paddingVertical: 7,
              borderRadius: 4,
              backgroundColor: viewMode === 'month' ? colors.primary : 'transparent',
            }}
          >
            <Icon
              name="overview"
              size={14}
              color={viewMode === 'month' ? '#FFFFFF' : colors.muted}
            />
            <Text
              style={{
                fontSize: 13,
                fontWeight: viewMode === 'month' ? '700' : '500',
                color: viewMode === 'month' ? '#FFFFFF' : colors.text,
              }}
            >
              Theo tháng
            </Text>
          </Pressable>
        </View>

        {/* Navigation Bar (Day or Month) */}
        {viewMode === 'day' ? (
          <View style={[ui.card, ui.row, { paddingVertical: 8, paddingHorizontal: 12 }]}>
            <Pressable
              onPress={() => setSelectedDay(shiftDay(selectedDay, -1))}
              hitSlop={12}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                paddingHorizontal: 8,
                paddingVertical: 5,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 4,
                backgroundColor: '#FFFFFF',
              }}
            >
              <Icon name="chevron-left" size={13} color={colors.text} />
              <Text style={{ fontSize: 12, color: colors.text, fontWeight: '600' }}>Hôm trước</Text>
            </Pressable>

            <Pressable
              onPress={() => !isToday && setSelectedDay(today)}
              style={{ alignItems: 'center', gap: 2 }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <Icon name="calendar" size={14} color={colors.primary} />
                <Text style={[ui.heading, { fontSize: 13 }]}>{formatDay(selectedDay)}</Text>
              </View>
              {!isToday ? (
                <Text style={{ fontSize: 11, color: colors.primary, fontWeight: '600' }}>
                  [Về hôm nay]
                </Text>
              ) : null}
            </Pressable>

            <Pressable
              onPress={() => setSelectedDay(shiftDay(selectedDay, 1))}
              hitSlop={12}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                paddingHorizontal: 8,
                paddingVertical: 5,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 4,
                backgroundColor: '#FFFFFF',
              }}
            >
              <Text style={{ fontSize: 12, color: colors.text, fontWeight: '600' }}>Hôm sau</Text>
              <Icon name="chevron-right" size={13} color={colors.text} />
            </Pressable>
          </View>
        ) : (
          <View style={[ui.card, ui.row, { paddingVertical: 8, paddingHorizontal: 12 }]}>
            <Pressable
              onPress={() => setSelectedMonth(shiftMonth(selectedMonth, -1))}
              hitSlop={12}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                paddingHorizontal: 8,
                paddingVertical: 5,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 4,
                backgroundColor: '#FFFFFF',
              }}
            >
              <Icon name="chevron-left" size={13} color={colors.text} />
              <Text style={{ fontSize: 12, color: colors.text, fontWeight: '600' }}>Tháng trước</Text>
            </Pressable>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Icon name="calendar" size={15} color={colors.primary} />
              <Text style={[ui.heading, { fontSize: 14 }]}>{formatMonth(selectedMonth)}</Text>
            </View>

            <Pressable
              onPress={() => setSelectedMonth(shiftMonth(selectedMonth, 1))}
              hitSlop={12}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                paddingHorizontal: 8,
                paddingVertical: 5,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 4,
                backgroundColor: '#FFFFFF',
              }}
            >
              <Text style={{ fontSize: 12, color: colors.text, fontWeight: '600' }}>Tháng sau</Text>
              <Icon name="chevron-right" size={13} color={colors.text} />
            </Pressable>
          </View>
        )}

        {/* Cash Flow Summary Breakdown (Day or Month) */}
        {viewMode === 'day' ? (
          <View style={[ui.card, { flexDirection: 'row', paddingVertical: 10 }]}>
            <View style={{ flex: 1, borderRightWidth: 1, borderRightColor: colors.borderSubtle, paddingRight: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Icon name="trending-up" size={12} color={colors.income} />
                <Text style={ui.label}>THU TRONG NGÀY</Text>
              </View>
              <Text style={[ui.text, { color: colors.income, fontWeight: '700', marginTop: 2 }]}>
                +{formatVnd(daySummary.income)}
              </Text>
            </View>
            <View style={{ flex: 1, borderRightWidth: 1, borderRightColor: colors.borderSubtle, paddingHorizontal: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Icon name="trending-down" size={12} color={colors.expense} />
                <Text style={ui.label}>CHI TRONG NGÀY</Text>
              </View>
              <Text style={[ui.text, { color: colors.expense, fontWeight: '700', marginTop: 2 }]}>
                -{formatVnd(daySummary.expense)}
              </Text>
            </View>
            <View style={{ flex: 1, paddingLeft: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Icon name="wallet" size={12} color={colors.muted} />
                <Text style={ui.label}>CÒN LẠI</Text>
              </View>
              <Text
                style={[
                  ui.text,
                  {
                    fontWeight: '700',
                    marginTop: 2,
                    color: daySummary.balance < 0 ? colors.expense : colors.text,
                  },
                ]}
              >
                {formatVnd(daySummary.balance)}
              </Text>
            </View>
          </View>
        ) : (
          <View style={[ui.card, { flexDirection: 'row', paddingVertical: 10 }]}>
            <View style={{ flex: 1, borderRightWidth: 1, borderRightColor: colors.borderSubtle, paddingRight: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Icon name="trending-up" size={12} color={colors.income} />
                <Text style={ui.label}>TỔNG THU THÁNG</Text>
              </View>
              <Text style={[ui.text, { color: colors.income, fontWeight: '700', marginTop: 2 }]}>
                +{formatVnd(monthSummary.income)}
              </Text>
            </View>
            <View style={{ flex: 1, borderRightWidth: 1, borderRightColor: colors.borderSubtle, paddingHorizontal: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Icon name="trending-down" size={12} color={colors.expense} />
                <Text style={ui.label}>TỔNG CHI THÁNG</Text>
              </View>
              <Text style={[ui.text, { color: colors.expense, fontWeight: '700', marginTop: 2 }]}>
                -{formatVnd(monthSummary.expense)}
              </Text>
            </View>
            <View style={{ flex: 1, paddingLeft: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Icon name="wallet" size={12} color={colors.muted} />
                <Text style={ui.label}>CÒN LẠI</Text>
              </View>
              <Text
                style={[
                  ui.text,
                  {
                    fontWeight: '700',
                    marginTop: 2,
                    color: monthSummary.balance < 0 ? colors.expense : colors.text,
                  },
                ]}
              >
                {formatVnd(monthSummary.balance)}
              </Text>
            </View>
          </View>
        )}

        {/* Transaction Log Section */}
        {viewMode === 'day' ? (
          /* Day View List */
          <View style={ui.card}>
            <View style={[ui.row, { paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: colors.borderSubtle }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Icon name="transactions" size={14} color={colors.muted} />
                <Text style={[ui.label, { fontWeight: '700' }]}>GIAO DỊCH TRONG NGÀY</Text>
              </View>
              <Text style={ui.label}>{dayItems.length} mục</Text>
            </View>

            {dayItems.length === 0 ? (
              <View style={{ paddingVertical: 20, alignItems: 'center', gap: 6 }}>
                <Icon name="clock" size={24} color={colors.muted} />
                <Text style={[ui.label, { textAlign: 'center' }]}>
                  Không có giao dịch nào trong ngày này.
                </Text>
              </View>
            ) : (
              dayItems.map((t, idx) => {
                const category = getTransactionCategory(t.category);
                const isIncome = t.kind === 'income';
                return (
                  <Pressable
                    key={t.id}
                    onPress={() => open(t)}
                    style={[
                      ui.row,
                      {
                        paddingVertical: 10,
                        borderTopWidth: idx > 0 ? 1 : 0,
                        borderTopColor: colors.borderSubtle,
                        gap: 10,
                      },
                    ]}
                  >
                    <CategoryBadge
                      icon={getCategoryIcon(t.category)}
                      color={category.color}
                      size={34}
                      iconSize={16}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={[ui.text, { fontWeight: '600', fontSize: 14 }]}>
                        {t.note || category.label}
                      </Text>
                      <Text style={[ui.label, { marginTop: 1 }]}>
                        {category.label}
                      </Text>
                    </View>
                    <Text
                      style={[
                        ui.text,
                        {
                          fontWeight: '700',
                          fontSize: 14,
                          color: isIncome ? colors.income : colors.expense,
                        },
                      ]}
                    >
                      {isIncome ? '+' : '-'}
                      {formatVnd(t.amount)}
                    </Text>
                  </Pressable>
                );
              })
            )}
          </View>
        ) : (
          /* Month View List (Grouped by Day) */
          <View style={ui.card}>
            <View style={[ui.row, { paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: colors.borderSubtle }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Icon name="transactions" size={14} color={colors.muted} />
                <Text style={[ui.label, { fontWeight: '700' }]}>DANH SÁCH THEO NGÀY TRONG THÁNG</Text>
              </View>
              <Text style={ui.label}>{monthGrouped.reduce((s, g) => s + g.items.length, 0)} mục</Text>
            </View>

            {monthGrouped.length === 0 ? (
              <View style={{ paddingVertical: 20, alignItems: 'center', gap: 6 }}>
                <Icon name="calendar" size={24} color={colors.muted} />
                <Text style={[ui.label, { textAlign: 'center' }]}>
                  Chưa có giao dịch nào trong tháng này.
                </Text>
              </View>
            ) : (
              monthGrouped.map((group, grpIdx) => (
                <View
                  key={group.date}
                  style={{
                    borderTopWidth: grpIdx > 0 ? 1 : 0,
                    borderTopColor: colors.borderSubtle,
                    paddingTop: grpIdx > 0 ? 10 : 4,
                    paddingBottom: 4,
                  }}
                >
                  {/* Day group header */}
                  <Pressable
                    onPress={() => {
                      setSelectedDay(group.date);
                      setViewMode('day');
                    }}
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      backgroundColor: colors.background,
                      paddingVertical: 4,
                      paddingHorizontal: 8,
                      borderRadius: 4,
                      marginBottom: 6,
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                      <Icon name="calendar" size={12} color={colors.primary} />
                      <Text style={{ fontSize: 12, fontWeight: '700', color: colors.text }}>
                        {formatDay(group.date)}
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      {group.dayIncome > 0 ? (
                        <Text style={{ fontSize: 11, fontWeight: '600', color: colors.income }}>
                          +{formatVnd(group.dayIncome)}
                        </Text>
                      ) : null}
                      {group.dayExpense > 0 ? (
                        <Text style={{ fontSize: 11, fontWeight: '600', color: colors.expense }}>
                          -{formatVnd(group.dayExpense)}
                        </Text>
                      ) : null}
                      <Icon name="chevron-right" size={11} color={colors.muted} />
                    </View>
                  </Pressable>

                  {/* Day transactions */}
                  {group.items.map((t, idx) => {
                    const category = getTransactionCategory(t.category);
                    const isIncome = t.kind === 'income';
                    return (
                      <Pressable
                        key={t.id}
                        onPress={() => open(t)}
                        style={[
                          ui.row,
                          {
                            paddingVertical: 7,
                            paddingHorizontal: 4,
                            borderTopWidth: idx > 0 ? 1 : 0,
                            borderTopColor: colors.borderSubtle,
                            gap: 10,
                          },
                        ]}
                      >
                        <CategoryBadge
                          icon={getCategoryIcon(t.category)}
                          color={category.color}
                          size={30}
                          iconSize={14}
                        />
                        <View style={{ flex: 1 }}>
                          <Text style={[ui.text, { fontWeight: '500', fontSize: 13 }]}>
                            {t.note || category.label}
                          </Text>
                          <Text style={ui.label}>{category.label}</Text>
                        </View>
                        <Text
                          style={[
                            ui.text,
                            {
                              fontWeight: '600',
                              fontSize: 13,
                              color: isIncome ? colors.income : colors.expense,
                            },
                          ]}
                        >
                          {isIncome ? '+' : '-'}
                          {formatVnd(t.amount)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              ))
            )}
          </View>
        )}
      </ScrollView>

      {/* Floating Add Action Button */}
      <Pressable style={ui.fab} onPress={() => open(null)} accessibilityLabel="Thêm giao dịch">
        <Icon name="plus" size={22} color="#FFFFFF" strokeWidth={2.5} />
      </Pressable>

      <TransactionForm
        visible={formOpen}
        transaction={editing}
        onClose={() => setFormOpen(false)}
        onSave={saveTransaction}
        onDelete={deleteTransaction}
      />
    </View>
  );
}
