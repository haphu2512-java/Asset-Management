import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { ChangeBadge } from '../components/ChangeBadge';
import { DonutChart } from '../components/DonutChart';
import { Icon } from '../components/Icon';
import { Legend } from '../components/Legend';
import {
  changeLabel,
  compareValue,
  formatDay,
  formatMonth,
  formatVnd,
  getGoalCategory,
  goalProgress,
  monthKey,
  summarize,
  summarizeDay,
  summarizeMonth,
  todayKey,
} from '../finance';
import { useStore } from '../store';
import { colors, ui } from '../theme';

type CashflowPeriod = 'day' | 'month';

export function OverviewScreen() {
  const { assets, transactions, goals, baseline } = useStore();
  const [cashflowPeriod, setCashflowPeriod] = useState<CashflowPeriod>('day');

  const today = todayKey();
  const currentMonth = monthKey(today);

  // Asset summary
  const s = useMemo(() => summarize(assets), [assets]);
  const assetItems = useMemo(
    () =>
      s.byCategory
        .filter((c) => !c.category.isLiability && c.amount > 0)
        .map((c) => ({ label: c.category.label, color: c.category.color, amount: c.amount })),
    [s],
  );

  // Change since yesterday (or the last day with a snapshot)
  const netWorthChange = baseline ? compareValue(s.netWorth, baseline.netWorth) : null;
  const assetsChange = baseline ? compareValue(s.totalAssets, baseline.totalAssets) : null;
  const debtChange = baseline ? compareValue(s.totalDebt, baseline.totalDebt) : null;

  // Daily & Monthly cash flow summaries
  const daySummary = useMemo(() => summarizeDay(transactions, today), [transactions, today]);
  const month = useMemo(() => summarizeMonth(transactions, currentMonth), [transactions, currentMonth]);

  // Daily average expenditure
  const daysPassed = Math.max(1, new Date().getDate());
  const avgDailyExpense = Math.round(month.expense / daysPassed);
  const savingsRate =
    month.income > 0 ? Math.round((month.balance / month.income) * 100) : null;

  // Active expense slices depending on period
  const activeExpenseItems = useMemo(() => {
    const list =
      cashflowPeriod === 'day' ? daySummary.expenseByCategory : month.expenseByCategory;
    return list.map((c) => ({
      label: c.category.label,
      color: c.category.color,
      amount: c.amount,
    }));
  }, [cashflowPeriod, daySummary, month]);

  const activeExpenseTotal =
    cashflowPeriod === 'day' ? daySummary.expense : month.expense;

  // Goals recurring progress summary
  const recurringGoals = useMemo(
    () => goals.filter((g) => g.type === 'recurring'),
    [goals],
  );
  const totalGoalSaved = useMemo(() => goals.reduce((acc, g) => acc + g.saved, 0), [goals]);
  const totalGoalTarget = useMemo(() => goals.reduce((acc, g) => acc + g.target, 0), [goals]);

  return (
    <ScrollView style={ui.screen} contentContainerStyle={ui.content}>
      {/* 1. Net Worth Summary Card */}
      <View style={ui.card}>
        <View style={ui.row}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Icon name="shield" size={14} color={colors.muted} />
            <Text style={ui.label}>TÀI SẢN RÒNG (NET WORTH)</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Icon name="calendar" size={12} color={colors.muted} />
            <Text style={[ui.label, { fontWeight: '600' }]}>{new Date().toLocaleDateString('vi-VN')}</Text>
          </View>
        </View>
        <Text style={[ui.big, s.netWorth < 0 && { color: colors.expense }]}>{formatVnd(s.netWorth)}</Text>
        {assets.length > 0 ? (
          <ChangeBadge change={netWorthChange} label={baseline ? changeLabel(baseline.date, today) : undefined} />
        ) : null}

        <View style={ui.divider} />

        <View style={ui.row}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Icon name="trending-up" size={13} color={colors.primary} />
            <Text style={ui.label}>Tổng tài sản</Text>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 2 }}>
            <Text style={[ui.text, { fontWeight: '600' }]}>{formatVnd(s.totalAssets)}</Text>
            {assetsChange && assetsChange.direction !== 'flat' ? (
              <ChangeBadge change={assetsChange} size="small" />
            ) : null}
          </View>
        </View>
        {s.totalDebt > 0 ? (
          <View style={ui.row}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Icon name="debt" size={13} color={colors.expense} />
              <Text style={[ui.label, { color: colors.expense }]}>Tổng nợ phải trả</Text>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 2 }}>
              <Text style={[ui.text, { color: colors.expense, fontWeight: '600' }]}>-{formatVnd(s.totalDebt)}</Text>
              {debtChange && debtChange.direction !== 'flat' ? (
                <ChangeBadge change={debtChange} size="small" inverse />
              ) : null}
            </View>
          </View>
        ) : null}
      </View>

      {/* 2. Asset Distribution */}
      <View style={ui.card}>
        <View style={ui.row}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Icon name="pie-chart" size={15} color={colors.primary} />
            <Text style={ui.heading}>Cơ cấu tài sản</Text>
          </View>
          <Text style={ui.label}>{assetItems.length} danh mục</Text>
        </View>
        {assetItems.length === 0 ? (
          <Text style={[ui.label, { paddingVertical: 12 }]}>Chưa có tài sản. Vào tab Tài sản để thêm.</Text>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 4 }}>
            <DonutChart size={100} slices={assetItems.map((i) => ({ value: i.amount, color: i.color }))} />
            <Legend items={assetItems} total={s.totalAssets} />
          </View>
        )}
      </View>

      {/* 3. Cash Flow Overview: Theo ngày & Theo tháng */}
      <View style={ui.card}>
        {/* Header with Period Switcher */}
        <View style={[ui.row, { alignItems: 'center' }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Icon name="transactions" size={15} color={colors.primary} />
            <Text style={ui.heading}>Thống kê thu chi</Text>
          </View>

          {/* Segmented control: Hôm nay | Tháng này */}
          <View
            style={{
              flexDirection: 'row',
              backgroundColor: colors.background,
              borderRadius: 6,
              padding: 2,
              borderWidth: 1,
              borderColor: colors.borderSubtle,
            }}
          >
            <Pressable
              onPress={() => setCashflowPeriod('day')}
              style={{
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 4,
                backgroundColor: cashflowPeriod === 'day' ? colors.primary : 'transparent',
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: cashflowPeriod === 'day' ? '700' : '500',
                  color: cashflowPeriod === 'day' ? '#FFFFFF' : colors.muted,
                }}
              >
                Hôm nay
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setCashflowPeriod('month')}
              style={{
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 4,
                backgroundColor: cashflowPeriod === 'month' ? colors.primary : 'transparent',
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: cashflowPeriod === 'month' ? '700' : '500',
                  color: cashflowPeriod === 'month' ? '#FFFFFF' : colors.muted,
                }}
              >
                Tháng này
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Period Subtitle */}
        <Text style={{ fontSize: 12, color: colors.muted, marginTop: -2 }}>
          {cashflowPeriod === 'day'
            ? formatDay(today)
            : `${formatMonth(month.month)} (đã qua ${daysPassed} ngày)`}
        </Text>

        {/* 3-Column Metrics (Thu - Chi - Dư) */}
        <View
          style={{
            flexDirection: 'row',
            backgroundColor: colors.background,
            paddingVertical: 10,
            paddingHorizontal: 8,
            borderRadius: 6,
            borderWidth: 1,
            borderColor: colors.borderSubtle,
            marginTop: 4,
          }}
        >
          {/* Income */}
          <View style={{ flex: 1, borderRightWidth: 1, borderRightColor: colors.border, paddingRight: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Icon name="trending-up" size={11} color={colors.income} />
              <Text style={{ fontSize: 11, color: colors.muted, fontWeight: '600' }}>
                {cashflowPeriod === 'day' ? 'THU HÔM NAY' : 'THU CẢ THÁNG'}
              </Text>
            </View>
            <Text style={{ fontSize: 14, fontWeight: '700', color: colors.income, marginTop: 2 }}>
              +{formatVnd(cashflowPeriod === 'day' ? daySummary.income : month.income)}
            </Text>
          </View>

          {/* Expense */}
          <View style={{ flex: 1, borderRightWidth: 1, borderRightColor: colors.border, paddingHorizontal: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Icon name="trending-down" size={11} color={colors.expense} />
              <Text style={{ fontSize: 11, color: colors.muted, fontWeight: '600' }}>
                {cashflowPeriod === 'day' ? 'CHI HÔM NAY' : 'CHI CẢ THÁNG'}
              </Text>
            </View>
            <Text style={{ fontSize: 14, fontWeight: '700', color: colors.expense, marginTop: 2 }}>
              -{formatVnd(cashflowPeriod === 'day' ? daySummary.expense : month.expense)}
            </Text>
          </View>

          {/* Balance */}
          <View style={{ flex: 1, paddingLeft: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Icon name="wallet" size={11} color={colors.muted} />
              <Text style={{ fontSize: 11, color: colors.muted, fontWeight: '600' }}>CÒN LẠI</Text>
            </View>
            {(() => {
              const bal = cashflowPeriod === 'day' ? daySummary.balance : month.balance;
              return (
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: '700',
                    marginTop: 2,
                    color: bal < 0 ? colors.expense : bal > 0 ? colors.income : colors.text,
                  }}
                >
                  {bal > 0 ? '+' : ''}
                  {formatVnd(bal)}
                </Text>
              );
            })()}
          </View>
        </View>

        {/* Insight & Analysis Banner */}
        {cashflowPeriod === 'day' ? (
          <View
            style={{
              paddingVertical: 6,
              paddingHorizontal: 8,
              borderRadius: 4,
              backgroundColor: daySummary.expense === 0 ? '#F0FDF4' : '#F8FAFC',
              borderWidth: 1,
              borderColor: daySummary.expense === 0 ? '#BBF7D0' : colors.borderSubtle,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Icon
              name={daySummary.expense === 0 ? 'check' : 'clock'}
              size={13}
              color={daySummary.expense === 0 ? colors.income : colors.muted}
            />
            <Text style={{ fontSize: 12, color: colors.muted, flex: 1 }}>
              {daySummary.expense === 0
                ? 'Hôm nay bạn chưa có khoản chi nào.'
                : avgDailyExpense > 0 && daySummary.expense > avgDailyExpense
                ? `Chi hôm nay cao hơn trung bình ngày (~${formatVnd(avgDailyExpense)}/ngày).`
                : `Mức chi hôm nay nằm trong kiểm soát (TB tháng: ~${formatVnd(avgDailyExpense)}/ngày).`}
            </Text>
          </View>
        ) : (
          <View
            style={{
              paddingVertical: 6,
              paddingHorizontal: 8,
              borderRadius: 4,
              backgroundColor: '#F8FAFC',
              borderWidth: 1,
              borderColor: colors.borderSubtle,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Text style={{ fontSize: 12, color: colors.muted }}>
              Chi trung bình: <Text style={{ fontWeight: '700', color: colors.text }}>~{formatVnd(avgDailyExpense)}/ngày</Text>
            </Text>
            {savingsRate !== null ? (
              <Text style={{ fontSize: 12, color: savingsRate >= 0 ? colors.income : colors.expense, fontWeight: '700' }}>
                {savingsRate >= 0 ? `Tiết kiệm ${savingsRate}% thu nhập` : 'Bội chi tháng này'}
              </Text>
            ) : null}
          </View>
        )}

        {/* Expense Category Breakdown Chart */}
        {activeExpenseItems.length > 0 ? (
          <View style={{ marginTop: 6, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.borderSubtle }}>
            <Text style={[ui.label, { fontWeight: '600', marginBottom: 6 }]}>
              {cashflowPeriod === 'day' ? 'CƠ CẤU CHI HÔM NAY' : 'CƠ CẤU CHI TRONG THÁNG'}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
              <DonutChart
                size={96}
                slices={activeExpenseItems.map((i) => ({ value: i.amount, color: i.color }))}
              />
              <Legend items={activeExpenseItems} total={activeExpenseTotal} />
            </View>
          </View>
        ) : (
          <Text style={[ui.label, { paddingVertical: 8, textAlign: 'center', color: colors.muted }]}>
            {cashflowPeriod === 'day'
              ? 'Chưa có khoản chi tiêu nào trong ngày hôm nay.'
              : 'Chưa có khoản chi tiêu nào trong tháng này.'}
          </Text>
        )}
      </View>

      {/* 4. Financial Goals Snapshot (if goals exist) */}
      {goals.length > 0 ? (
        <View style={ui.card}>
          <View style={ui.row}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Icon name="goals" size={15} color={colors.primary} />
              <Text style={ui.heading}>Mục tiêu tài chính</Text>
            </View>
            <Text style={ui.label}>{goals.length} mục tiêu</Text>
          </View>

          <View style={[ui.row, { alignItems: 'flex-end', marginTop: 2 }]}>
            <View>
              <Text style={{ fontSize: 11, color: colors.muted }}>Tổng đã tích lũy</Text>
              <Text style={{ fontSize: 18, fontWeight: '700', color: colors.primary }}>
                {formatVnd(totalGoalSaved)}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ fontSize: 11, color: colors.muted }}>Mục tiêu</Text>
              <Text style={{ fontSize: 13, fontWeight: '600' }}>
                {formatVnd(totalGoalTarget)}
              </Text>
            </View>
          </View>

          {/* Quick list of top goals */}
          <View style={{ gap: 6, marginTop: 4 }}>
            {goals.slice(0, 3).map((g) => {
              const p = goalProgress(g);
              const cat = getGoalCategory(g.category);
              return (
                <View
                  key={g.id}
                  style={{
                    padding: 8,
                    borderRadius: 4,
                    backgroundColor: colors.background,
                    borderWidth: 1,
                    borderColor: colors.borderSubtle,
                    gap: 4,
                  }}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                      <Text style={{ fontSize: 12, fontWeight: '700', color: colors.text }}>
                        {g.name}
                      </Text>
                      {g.type === 'recurring' && g.recurringAmount ? (
                        <Text style={{ fontSize: 11, color: colors.primary, fontWeight: '600' }}>
                          ({formatVnd(g.recurringAmount)}/tháng)
                        </Text>
                      ) : null}
                    </View>
                    <Text style={{ fontSize: 11, color: colors.muted, fontWeight: '600' }}>
                      {Math.round(p.ratio * 100)}%
                    </Text>
                  </View>

                  {/* Progress bar */}
                  <View style={{ height: 4, backgroundColor: colors.borderSubtle, borderRadius: 2, overflow: 'hidden' }}>
                    <View
                      style={{
                        width: `${Math.min(100, Math.round(p.ratio * 100))}%`,
                        height: '100%',
                        backgroundColor: p.remaining === 0 ? colors.income : colors.primary,
                      }}
                    />
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      ) : null}
    </ScrollView>
  );
}
