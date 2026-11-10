import { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useComposer } from '../components/Composer';
import { QuickEntryBar } from '../components/QuickEntryBar';
import { TransactionRow } from '../components/TransactionRow';
import { Button, Card, EmptyState, IconButton, Segmented } from '../components/ui';
import {
  formatDay,
  formatMonth,
  monthKey,
  shiftDay,
  shiftMonth,
  summarizeDay,
  summarizeMonth,
  todayKey,
  type Transaction,
} from '../finance';
import { useNav } from '../nav';
import { useStore } from '../store';
import { font, space, useMoney, useTheme } from '../theme';

type ViewMode = 'day' | 'month';

export function TransactionsScreen() {
  const { colors, ui } = useTheme();
  const { transactions, categories } = useStore();
  const nav = useNav();
  const composer = useComposer();
  const format = useMoney();
  const today = todayKey();
  const [viewMode, setViewMode] = useState<ViewMode>('day');
  const [selectedDay, setSelectedDay] = useState(today);
  const [selectedMonth, setSelectedMonth] = useState(monthKey(today));

  const summary = useMemo(
    () =>
      viewMode === 'day'
        ? summarizeDay(transactions, selectedDay, categories)
        : summarizeMonth(transactions, selectedMonth, categories),
    [transactions, viewMode, selectedDay, selectedMonth, categories],
  );

  const dayItems = useMemo(
    () => transactions.filter((t) => t.date === selectedDay).sort((a, b) => b.id.localeCompare(a.id)),
    [transactions, selectedDay],
  );

  const monthGroups = useMemo(() => {
    const groups = new Map<string, { date: string; items: Transaction[]; income: number; expense: number }>();
    for (const t of transactions) {
      if (monthKey(t.date) !== selectedMonth) continue;
      const g = groups.get(t.date) ?? { date: t.date, items: [], income: 0, expense: 0 };
      g.items.push(t);
      if (t.kind === 'income') g.income += t.amount;
      if (t.kind === 'expense') g.expense += t.amount;
      groups.set(t.date, g);
    }
    return [...groups.values()]
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((g) => ({ ...g, items: g.items.sort((a, b) => b.id.localeCompare(a.id)) }));
  }, [transactions, selectedMonth]);

  const isCurrent = viewMode === 'day' ? selectedDay === today : selectedMonth === monthKey(today);
  const step = (delta: number) =>
    viewMode === 'day' ? setSelectedDay(shiftDay(selectedDay, delta)) : setSelectedMonth(shiftMonth(selectedMonth, delta));
  const add = () => composer.open({ date: viewMode === 'day' ? selectedDay : today });
  const empty = viewMode === 'day' ? dayItems.length === 0 : monthGroups.length === 0;

  return (
    <ScrollView style={ui.screen} contentContainerStyle={ui.content} keyboardShouldPersistTaps="handled">
      <QuickEntryBar />

      <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'center' }}>
        <View style={{ flex: 1 }}>
          <Segmented
            options={[
              { id: 'day', label: 'Theo ngày', icon: 'calendar' },
              { id: 'month', label: 'Theo tháng', icon: 'chart' },
            ]}
            value={viewMode}
            onChange={setViewMode}
          />
        </View>
        <IconButton icon="search" label="Tìm và lọc giao dịch" onPress={() => nav.push({ name: 'search' })} color={colors.text} filled />
      </View>

      <Card>
        <View style={ui.row}>
          <IconButton icon="chevron-left" label={viewMode === 'day' ? 'Ngày trước' : 'Tháng trước'} onPress={() => step(-1)} color={colors.text} />
          <View style={{ alignItems: 'center', flex: 1, gap: 2 }}>
            <Text style={ui.heading} accessibilityRole="header">
              {viewMode === 'day' ? formatDay(selectedDay) : formatMonth(selectedMonth)}
            </Text>
            {!isCurrent ? (
              <Button
                small
                variant="ghost"
                label={viewMode === 'day' ? 'Về hôm nay' : 'Về tháng này'}
                onPress={() => (viewMode === 'day' ? setSelectedDay(today) : setSelectedMonth(monthKey(today)))}
              />
            ) : null}
          </View>
          <IconButton icon="chevron-right" label={viewMode === 'day' ? 'Ngày sau' : 'Tháng sau'} onPress={() => step(1)} color={colors.text} />
        </View>
        <View style={ui.divider} />
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          {[
            { label: 'Thu', value: summary.income, color: colors.income },
            { label: 'Chi', value: summary.expense, color: colors.expense },
            { label: 'Còn lại', value: summary.balance, color: summary.balance < 0 ? colors.expense : colors.text },
          ].map((item) => (
            <View key={item.label} style={{ flex: 1, gap: 2 }} accessible accessibilityLabel={`${item.label} ${format(item.value)}`}>
              <Text style={ui.label}>{item.label}</Text>
              <Text style={{ fontSize: font.body, fontWeight: '700', color: item.color }} numberOfLines={1} adjustsFontSizeToFit>
                {format(item.value)}
              </Text>
            </View>
          ))}
        </View>
      </Card>

      {empty ? (
        <Card>
          <EmptyState
            icon="transactions"
            title={viewMode === 'day' ? 'Chưa có giao dịch trong ngày' : 'Chưa có giao dịch trong tháng'}
            message='Gõ nhanh ở ô phía trên (ví dụ "ăn trưa 50k"), chụp hoá đơn, hoặc thêm thủ công.'
            actionLabel="Thêm giao dịch"
            onAction={add}
          />
        </Card>
      ) : viewMode === 'day' ? (
        <Card>
          {dayItems.map((t) => (
            <TransactionRow key={t.id} transaction={t} />
          ))}
        </Card>
      ) : (
        monthGroups.map((g) => (
          <Card key={g.date}>
            <View style={ui.row}>
              <Text style={[ui.text, { fontWeight: '700' }]}>{formatDay(g.date)}</Text>
              <Text style={ui.label}>
                {g.income > 0 ? `+${format(g.income)}` : ''}
                {g.income > 0 && g.expense > 0 ? '  ' : ''}
                {g.expense > 0 ? `-${format(g.expense)}` : ''}
              </Text>
            </View>
            {g.items.map((t) => (
              <TransactionRow key={t.id} transaction={t} />
            ))}
          </Card>
        ))
      )}
    </ScrollView>
  );
}
