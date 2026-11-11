import { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { getCategoryIcon } from '../components/Icon';
import { RecurringForm } from '../components/PlanningForms';
import { useToast } from '../components/Toast';
import { Button, Card, CardHeader, CategoryBadge, EmptyState, ListItem } from '../components/ui';
import { formatDay, getTransactionCategory, todayKey } from '../finance';
import { FREQUENCY_LABEL, monthlyAmount, upcoming, type Recurring } from '../recurring';
import { useStore } from '../store';
import { font, useMoney, useTheme } from '../theme';

/** Repeating transactions: what is due, and the rules behind them. */
export function RecurringScreen() {
  const { colors, ui } = useTheme();
  const { recurring, categories, assets, recordOccurrence, skipOccurrence } = useStore();
  const toast = useToast();
  const format = useMoney();
  const today = todayKey();
  const [editing, setEditing] = useState<Recurring | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const due = useMemo(() => upcoming(recurring, today, 7), [recurring, today]);
  const fixedIncome = recurring.filter((r) => r.active && r.kind === 'income').reduce((s, r) => s + monthlyAmount(r), 0);
  const fixedExpense = recurring.filter((r) => r.active && r.kind === 'expense').reduce((s, r) => s + monthlyAmount(r), 0);

  const title = (r: Recurring) =>
    r.note || (r.kind === 'transfer' ? 'Chuyển khoản' : getTransactionCategory(r.category, categories).label);
  const badge = (r: Recurring) => {
    const c = r.kind === 'transfer' ? null : getTransactionCategory(r.category, categories);
    return <CategoryBadge icon={c ? getCategoryIcon(c.icon ?? c.id) : 'transfer'} color={c?.color ?? '#546E7A'} />;
  };
  const amountText = (r: Recurring) => `${r.kind === 'income' ? '+' : r.kind === 'expense' ? '-' : ''}${format(r.amount)}`;
  const amountColor = (r: Recurring) => (r.kind === 'income' ? colors.income : r.kind === 'expense' ? colors.expense : colors.text);
  const open = (rule: Recurring | null) => {
    setEditing(rule);
    setFormOpen(true);
  };

  return (
    <View style={ui.screen}>
      <ScrollView contentContainerStyle={ui.content}>
        {recurring.length === 0 ? (
          <EmptyState
            icon="refresh"
            title="Chưa có khoản định kỳ"
            message="Thêm lương, tiền nhà, hoá đơn hay gói thuê bao. App sẽ tự ghi hoặc nhắc bạn khi đến hạn."
            actionLabel="Thêm khoản định kỳ"
            onAction={() => open(null)}
          />
        ) : (
          <>
            <Card>
              <Text style={ui.label}>Quy ra mỗi tháng</Text>
              <View style={ui.row}>
                <View>
                  <Text style={ui.label}>Thu cố định</Text>
                  <Text style={{ fontSize: font.title, fontWeight: '800', color: colors.income }}>{format(fixedIncome)}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={ui.label}>Chi cố định</Text>
                  <Text style={{ fontSize: font.title, fontWeight: '800', color: colors.expense }}>{format(fixedExpense)}</Text>
                </View>
              </View>
            </Card>

            {due.length > 0 ? (
              <Card>
                <CardHeader title="Đến hạn trong 7 ngày" icon="clock" />
                {due.map(({ rule, date }) => (
                  <View key={`${rule.id}@${date}`} style={{ gap: 6 }}>
                    <ListItem
                      leading={badge(rule)}
                      title={title(rule)}
                      subtitle={`${date < today ? 'Quá hạn · ' : ''}${formatDay(date)}`}
                      right={amountText(rule)}
                      rightColor={amountColor(rule)}
                    />
                    {date <= today ? (
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        <Button
                          small
                          label="Ghi nhận"
                          icon="check"
                          style={{ flex: 1 }}
                          accessibilityLabel={`Ghi nhận ${title(rule)} ngày ${formatDay(date)}`}
                          onPress={() => {
                            recordOccurrence(rule.id, date);
                            toast.show({ message: `Đã ghi "${title(rule)}".`, tone: 'success' });
                          }}
                        />
                        <Button
                          small
                          variant="secondary"
                          label="Bỏ qua kỳ này"
                          style={{ flex: 1 }}
                          accessibilityLabel={`Bỏ qua ${title(rule)} ngày ${formatDay(date)}`}
                          onPress={() => skipOccurrence(rule.id, date)}
                        />
                      </View>
                    ) : null}
                  </View>
                ))}
              </Card>
            ) : null}

            <Card>
              <CardHeader title="Tất cả khoản định kỳ" icon="refresh" />
              {recurring.map((r) => (
                <ListItem
                  key={r.id}
                  leading={badge(r)}
                  title={title(r)}
                  subtitle={[
                    FREQUENCY_LABEL[r.frequency],
                    r.active ? `kỳ tới ${formatDay(r.nextDate)}` : 'đang tạm dừng',
                    r.auto ? 'tự ghi' : 'hỏi trước khi ghi',
                    assets.find((a) => a.id === r.accountId)?.name,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                  right={amountText(r)}
                  rightColor={r.active ? amountColor(r) : colors.muted}
                  onPress={() => open(r)}
                  chevron
                />
              ))}
              <Button small variant="secondary" label="Thêm khoản định kỳ" icon="plus" onPress={() => open(null)} />
            </Card>
          </>
        )}
      </ScrollView>
      <RecurringForm visible={formOpen} rule={editing} onClose={() => setFormOpen(false)} />
    </View>
  );
}
