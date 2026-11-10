import { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { budgetLevel } from '../budgets';
import { getCategoryIcon } from '../components/Icon';
import { BudgetForm } from '../components/PlanningForms';
import { TransactionRow } from '../components/TransactionRow';
import { Button, Card, CardHeader, CategoryBadge, IconButton, ProgressBar } from '../components/ui';
import { formatMonth, getTransactionCategory, monthKey, rootCategory, shiftMonth } from '../finance';
import { useStore } from '../store';
import { font, useMoney, useTheme } from '../theme';

/** Spending of one expense category in a month: its budget, its sub-categories and every transaction. */
export function CategoryDetailScreen({ id, month: initialMonth }: { id: string; month: string }) {
  const { colors, ui } = useTheme();
  const { transactions, categories, budgets } = useStore();
  const format = useMoney();
  const [month, setMonth] = useState(initialMonth);
  const [budgetOpen, setBudgetOpen] = useState(false);

  const category = getTransactionCategory(id, categories);
  const items = useMemo(
    () =>
      transactions
        .filter((t) => t.kind === category.kind && monthKey(t.date) === month && rootCategory(t.category, categories).id === id)
        .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)),
    [transactions, month, id, categories, category.kind],
  );
  const total = items.reduce((s, t) => s + t.amount, 0);
  const previous = useMemo(
    () =>
      transactions
        .filter((t) => t.kind === category.kind && monthKey(t.date) === shiftMonth(month, -1) && rootCategory(t.category, categories).id === id)
        .reduce((s, t) => s + t.amount, 0),
    [transactions, month, id, categories, category.kind],
  );
  const bySub = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of items) map.set(t.category, (map.get(t.category) ?? 0) + t.amount);
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [items]);

  const budget = budgets.find((b) => b.category === id) ?? null;
  const level = budget ? budgetLevel(total, budget.amount) : 'ok';
  const barColor = level === 'over' ? colors.expense : level === 'warn' ? colors.warning : colors.primary;

  return (
    <View style={ui.screen}>
      <ScrollView contentContainerStyle={ui.content}>
        <Card>
          <View style={ui.row}>
            <IconButton icon="chevron-left" label="Tháng trước" onPress={() => setMonth(shiftMonth(month, -1))} color={colors.text} />
            <Text style={ui.heading}>{formatMonth(month)}</Text>
            <IconButton icon="chevron-right" label="Tháng sau" onPress={() => setMonth(shiftMonth(month, 1))} color={colors.text} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <CategoryBadge icon={getCategoryIcon(category.icon ?? category.id)} color={category.color} size={44} />
            <View style={{ flex: 1 }}>
              <Text style={ui.label}>{category.kind === 'expense' ? 'Đã chi' : 'Đã thu'}</Text>
              <Text style={{ fontSize: font.headline, fontWeight: '800', color: colors.text }}>{format(total)}</Text>
            </View>
          </View>
          <Text style={ui.label}>
            Tháng trước: {format(previous)}
            {previous > 0 ? ` (${total >= previous ? '+' : '-'}${Math.abs(Math.round(((total - previous) / previous) * 100))}%)` : ''}
          </Text>
          {category.kind === 'expense' ? (
            budget ? (
              <View style={{ gap: 6 }}>
                <ProgressBar ratio={total / budget.amount} color={barColor} label={`Đã dùng ${Math.round((total / budget.amount) * 100)} phần trăm ngân sách`} />
                <View style={ui.row}>
                  <Text style={[ui.label, level !== 'ok' && { color: barColor, fontWeight: '600' }]}>
                    {total <= budget.amount ? `Còn ${format(budget.amount - total)}` : `Vượt ${format(total - budget.amount)}`} · ngân sách {format(budget.amount)}
                  </Text>
                  <Button small variant="ghost" label="Sửa" onPress={() => setBudgetOpen(true)} />
                </View>
              </View>
            ) : (
              <Button small variant="secondary" label="Đặt ngân sách cho danh mục này" icon="budget" onPress={() => setBudgetOpen(true)} />
            )
          ) : null}
        </Card>

        {bySub.length > 1 ? (
          <Card>
            <CardHeader title="Chi tiết theo danh mục con" icon="pie-chart" />
            {bySub.map(([subId, amount]) => (
              <View key={subId} style={ui.row}>
                <Text style={ui.text}>{subId === id ? `${category.label} (chung)` : getTransactionCategory(subId, categories).label}</Text>
                <Text style={[ui.text, { fontWeight: '600' }]}>{format(amount)}</Text>
              </View>
            ))}
          </Card>
        ) : null}

        <Card>
          <CardHeader title="Giao dịch" icon="transactions" right={<Text style={ui.label}>{items.length} khoản</Text>} />
          {items.length === 0 ? (
            <Text style={ui.label}>Không có giao dịch nào trong tháng này.</Text>
          ) : (
            items.map((t) => <TransactionRow key={t.id} transaction={t} showDate />)
          )}
        </Card>
      </ScrollView>
      <BudgetForm visible={budgetOpen} budget={budget ?? { id, category: id, amount: 0 }} onClose={() => setBudgetOpen(false)} />
    </View>
  );
}
