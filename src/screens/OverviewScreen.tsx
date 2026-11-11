import { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { budgetStatuses } from '../budgets';
import { ChangeBadge } from '../components/ChangeBadge';
import { LineChart } from '../components/Charts';
import { useComposer } from '../components/Composer';
import { DonutChart } from '../components/DonutChart';
import { getCategoryIcon } from '../components/Icon';
import { Legend } from '../components/Legend';
import { Button, Card, CardHeader, CategoryBadge, EmptyState, LinkText, ListItem, ProgressBar, Segmented } from '../components/ui';
import {
  changeLabel,
  compareValue,
  formatMonth,
  getGoalCategory,
  getTransactionCategory,
  goalProgress,
  monthKey,
  summarize,
  summarizeDay,
  summarizeMonth,
  todayKey,
} from '../finance';
import { useNav } from '../nav';
import { usePrefs } from '../prefs';
import { upcoming } from '../recurring';
import { netWorthSeries } from '../reports';
import { useStore } from '../store';
import { font, space, useMoney, useTheme } from '../theme';

const shortDate = (date: string) => {
  const [, m, d] = date.split('-');
  return `${Number(d)}/${Number(m)}`;
};

export function OverviewScreen() {
  const { colors, ui } = useTheme();
  const { assets, transactions, goals, budgets, recurring, categories, baseline, snapshots, recordOccurrence, skipOccurrence } =
    useStore();
  const { prefs } = usePrefs();
  const nav = useNav();
  const composer = useComposer();
  const format = useMoney();
  const [period, setPeriod] = useState<'day' | 'month'>('month');

  const today = todayKey();
  const month = monthKey(today);
  const s = useMemo(() => summarize(assets), [assets]);
  const monthSummary = useMemo(() => summarizeMonth(transactions, month, categories), [transactions, month, categories]);
  const daySummary = useMemo(() => summarizeDay(transactions, today, categories), [transactions, today, categories]);
  const flow = period === 'day' ? daySummary : monthSummary;
  const statuses = useMemo(() => budgetStatuses(budgets, monthSummary, categories), [budgets, monthSummary, categories]);
  const due = useMemo(() => upcoming(recurring, today, 7), [recurring, today]);
  const series = useMemo(() => netWorthSeries(snapshots, today, 30), [snapshots, today]);

  const netWorthChange = baseline ? compareValue(s.netWorth, baseline.netWorth) : null;
  const assetItems = s.byCategory
    .filter((c) => !c.category.isLiability && c.amount > 0)
    .map((c) => ({ label: c.category.label, color: c.category.color, amount: c.amount }));
  const expenseItems = flow.expenseByCategory.map((c) => ({
    id: c.category.id,
    label: c.category.label,
    color: c.category.color,
    amount: c.amount,
  }));

  const dayOfMonth = Number(today.slice(8));
  const savingsRate = monthSummary.income > 0 ? Math.round((monthSummary.balance / monthSummary.income) * 100) : null;
  const isNew = assets.length === 0 && transactions.length === 0 && goals.length === 0;

  if (isNew) {
    return (
      <ScrollView style={ui.screen} contentContainerStyle={ui.content}>
        <Card>
          <EmptyState
            icon="wallet"
            title="Bắt đầu với ví đầu tiên"
            message="Thêm ví tiền mặt hoặc tài khoản ngân hàng với số dư hiện có. Từ đó mỗi khoản thu chi bạn ghi sẽ tự cập nhật số dư."
            actionLabel="Thêm ví"
            onAction={() => nav.setTab('assets')}
          />
        </Card>
        <Card>
          <EmptyState
            icon="transactions"
            title="Hoặc ghi ngay một khoản chi"
            message='Bấm nút + ở thanh dưới, hoặc gõ nhanh "cafe 35k" trong tab Thu chi.'
            actionLabel="Thêm giao dịch"
            onAction={() => composer.open()}
          />
        </Card>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={ui.screen} contentContainerStyle={ui.content}>
      {/* Net worth */}
      <Card>
        <View style={ui.row}>
          <Text style={ui.label}>Tài sản ròng</Text>
          <LinkText label="Báo cáo" onPress={() => nav.push({ name: 'reports' })} />
        </View>
        <Text style={[ui.big, s.netWorth < 0 && { color: colors.expense }]} accessibilityLabel={`Tài sản ròng ${format(s.netWorth)}`}>
          {format(s.netWorth)}
        </Text>
        <ChangeBadge change={netWorthChange} label={baseline ? changeLabel(baseline.date, today) : undefined} />
        {series.length >= 2 ? <LineChart points={series} height={90} hidden={prefs.hideBalance} /> : null}
        <View style={ui.divider} />
        <View style={ui.row}>
          <Text style={ui.label}>Tổng tài sản</Text>
          <Text style={[ui.text, { fontWeight: '600' }]}>{format(s.totalAssets)}</Text>
        </View>
        {s.totalDebt > 0 ? (
          <View style={ui.row}>
            <Text style={ui.label}>Tổng nợ phải trả</Text>
            <Text style={[ui.text, { color: colors.expense, fontWeight: '600' }]}>-{format(s.totalDebt)}</Text>
          </View>
        ) : null}
      </Card>

      {/* Recurring transactions falling due */}
      {due.length > 0 ? (
        <Card>
          <CardHeader title="Sắp đến hạn" icon="clock" right={<LinkText label="Tất cả" onPress={() => nav.push({ name: 'recurring' })} />} />
          {due.slice(0, 4).map(({ rule, date }) => {
            const overdue = date <= today;
            const category = rule.kind === 'transfer' ? null : getTransactionCategory(rule.category, categories);
            return (
              <View key={`${rule.id}-${date}`} style={{ gap: 6 }}>
                <ListItem
                  leading={<CategoryBadge icon={category ? getCategoryIcon(category.icon ?? category.id) : 'transfer'} color={category?.color ?? '#546E7A'} />}
                  title={rule.note}
                  subtitle={overdue ? `Đến hạn ${shortDate(date)}${rule.auto ? '' : ' · chờ bạn xác nhận'}` : `Ngày ${shortDate(date)}${rule.auto ? ' · tự động ghi' : ''}`}
                  right={`${rule.kind === 'income' ? '+' : rule.kind === 'expense' ? '-' : ''}${format(rule.amount)}`}
                  rightColor={rule.kind === 'income' ? colors.income : rule.kind === 'expense' ? colors.expense : colors.text}
                />
                {overdue && !rule.auto ? (
                  <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'flex-end' }}>
                    <Button small variant="secondary" label="Bỏ qua kỳ này" onPress={() => skipOccurrence(rule.id, date)} />
                    <Button small label="Ghi nhận" icon="check" onPress={() => recordOccurrence(rule.id, date)} />
                  </View>
                ) : null}
              </View>
            );
          })}
        </Card>
      ) : null}

      {/* Income and spending */}
      <Card>
        <CardHeader title="Thu chi" icon="transactions" right={<Text style={ui.label}>{period === 'day' ? 'Hôm nay' : formatMonth(month)}</Text>} />
        <Segmented
          options={[
            { id: 'month', label: 'Tháng này' },
            { id: 'day', label: 'Hôm nay' },
          ]}
          value={period}
          onChange={setPeriod}
        />
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          {[
            { label: 'Thu', value: flow.income, color: colors.income },
            { label: 'Chi', value: flow.expense, color: colors.expense },
            { label: 'Còn lại', value: flow.balance, color: flow.balance < 0 ? colors.expense : colors.text },
          ].map((item) => (
            <View key={item.label} style={{ flex: 1, gap: 2 }} accessible accessibilityLabel={`${item.label} ${format(item.value)}`}>
              <Text style={ui.label}>{item.label}</Text>
              <Text style={{ fontSize: font.body, fontWeight: '700', color: item.color }} numberOfLines={1} adjustsFontSizeToFit>
                {format(item.value)}
              </Text>
            </View>
          ))}
        </View>
        {period === 'month' && monthSummary.expense > 0 ? (
          <Text style={ui.label}>
            Trung bình {format(Math.round(monthSummary.expense / dayOfMonth))}/ngày
            {savingsRate !== null ? ` · Để dành được ${savingsRate}% thu nhập` : ''}
          </Text>
        ) : null}
        {expenseItems.length > 0 ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.lg, flexWrap: 'wrap' }}>
            <DonutChart slices={expenseItems.map((i) => ({ value: i.amount, color: i.color }))} size={112} />
            <View style={{ flex: 1, minWidth: 180 }}>
              <Legend items={expenseItems.slice(0, 6)} total={flow.expense} onPress={(id) => nav.push({ name: 'category', id, month })} />
            </View>
          </View>
        ) : (
          <Text style={ui.label}>
            {period === 'day' ? 'Hôm nay chưa có khoản chi nào.' : 'Tháng này chưa có khoản chi nào.'}
          </Text>
        )}
      </Card>

      {/* Budgets */}
      <Card>
        <CardHeader
          title="Ngân sách tháng này"
          icon="budget"
          right={<LinkText label={statuses.length > 0 ? 'Chi tiết' : 'Đặt ngân sách'} onPress={() => nav.push({ name: 'budgets' })} />}
        />
        {statuses.length === 0 ? (
          <Text style={ui.label}>Đặt hạn mức cho từng danh mục để được cảnh báo trước khi tiêu quá tay.</Text>
        ) : (
          statuses.slice(0, 3).map((b) => {
            const color = b.level === 'over' ? colors.expense : b.level === 'warn' ? colors.warning : colors.primary;
            return (
              <View key={b.budget.id} style={{ gap: 4 }}>
                <View style={ui.row}>
                  <Text style={[ui.text, { fontWeight: '600' }]}>{b.category.label}</Text>
                  <Text style={{ fontSize: font.caption, color: b.level === 'ok' ? colors.muted : color, fontWeight: '600' }}>
                    {b.remaining >= 0 ? `Còn ${format(b.remaining)}` : `Vượt ${format(-b.remaining)}`}
                  </Text>
                </View>
                <ProgressBar ratio={b.ratio} color={color} label={`${b.category.label}: đã dùng ${Math.round(b.ratio * 100)} phần trăm ngân sách`} />
              </View>
            );
          })
        )}
      </Card>

      {/* Asset allocation */}
      <Card>
        <CardHeader title="Cơ cấu tài sản" icon="pie-chart" right={<LinkText label="Xem tài sản" onPress={() => nav.setTab('assets')} />} />
        {assetItems.length === 0 ? (
          <Text style={ui.label}>Chưa có tài sản. Thêm ví hoặc khoản đầu tư ở tab Tài sản.</Text>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.lg, flexWrap: 'wrap' }}>
            <DonutChart slices={assetItems.map((i) => ({ value: i.amount, color: i.color }))} size={112} />
            <View style={{ flex: 1, minWidth: 180 }}>
              <Legend items={assetItems} total={s.totalAssets} />
            </View>
          </View>
        )}
      </Card>

      {/* Goals */}
      {goals.length > 0 ? (
        <Card>
          <CardHeader title="Mục tiêu" icon="goals" right={<LinkText label="Tất cả" onPress={() => nav.setTab('goals')} />} />
          {goals.slice(0, 3).map((g) => {
            const p = goalProgress(g);
            const cat = getGoalCategory(g.category);
            return (
              <View key={g.id} style={{ gap: 4 }}>
                <View style={ui.row}>
                  <Text style={[ui.text, { fontWeight: '600', flex: 1 }]} numberOfLines={1}>
                    {g.name}
                  </Text>
                  <Text style={ui.label}>{Math.round(p.ratio * 100)}%</Text>
                </View>
                <ProgressBar ratio={p.ratio} color={cat.color} label={`${g.name}: đạt ${Math.round(p.ratio * 100)} phần trăm`} />
                <Text style={ui.label}>
                  {format(g.saved)} / {format(g.target)}
                  {g.type === 'recurring' && !p.contributedThisPeriod && p.remaining > 0 ? ` · chưa góp ${p.currentPeriodLabel}` : ''}
                </Text>
              </View>
            );
          })}
        </Card>
      ) : null}

      {/* AI */}
      <Card>
        <CardHeader title="Nhận xét từ cố vấn AI" icon="sparkles" />
        <Text style={ui.label}>AI đọc số liệu tài sản, thu chi 3 tháng và mục tiêu của bạn để nhận xét và gợi ý.</Text>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          <Button
            small
            label="Nhận xét tháng này"
            icon="sparkles"
            onPress={() => nav.push({ name: 'advisor', question: 'Nhận xét thu chi tháng này của tôi và chỉ ra chỗ tôi chi quá tay.' })}
          />
          <Button small variant="secondary" label="Hỏi câu khác" onPress={() => nav.push({ name: 'advisor' })} />
        </View>
      </Card>
    </ScrollView>
  );
}
