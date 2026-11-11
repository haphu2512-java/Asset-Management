import { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { budgetStatuses, fiftyThirtyTwenty, suggestBudgets, type Budget } from '../budgets';
import { getCategoryIcon } from '../components/Icon';
import { BudgetForm } from '../components/PlanningForms';
import { Field, Sheet } from '../components/Sheet';
import { useToast } from '../components/Toast';
import { AmountInput, Banner, Button, Card, CardHeader, CategoryBadge, EmptyState, ListItem, ProgressBar } from '../components/ui';
import { formatDigits, formatMonth, getTransactionCategory, monthKey, parseVndExpression, shiftMonth, summarizeMonth, todayKey } from '../finance';
import { useNav } from '../nav';
import { useStore } from '../store';
import { font, useMoney, useTheme } from '../theme';

type Proposal = { title: string; note: string; budgets: { category: string; amount: number }[] };

/** Monthly limits per expense category, with suggestions from past spending and the 50/30/20 rule. */
export function BudgetsScreen() {
  const { colors, ui } = useTheme();
  const { budgets, transactions, categories, saveBudgets } = useStore();
  const nav = useNav();
  const toast = useToast();
  const format = useMoney();
  const month = monthKey(todayKey());
  const [editing, setEditing] = useState<Budget | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [ruleOpen, setRuleOpen] = useState(false);
  const [income, setIncome] = useState('');
  const [ruleError, setRuleError] = useState('');

  const summary = useMemo(() => summarizeMonth(transactions, month, categories), [transactions, month, categories]);
  const statuses = useMemo(() => budgetStatuses(budgets, summary, categories), [budgets, summary, categories]);
  const totalLimit = statuses.reduce((s, b) => s + b.budget.amount, 0);
  const totalSpent = statuses.reduce((s, b) => s + b.spent, 0);
  const lastIncome = useMemo(() => summarizeMonth(transactions, shiftMonth(month, -1), categories).income, [transactions, month, categories]);
  const unbudgeted = summary.expenseByCategory.filter((c) => !budgets.some((b) => b.category === c.category.id));

  const open = (budget: Budget | null) => {
    setEditing(budget);
    setFormOpen(true);
  };

  const suggest = () => {
    const list = suggestBudgets(transactions, month, categories);
    if (list.length === 0) {
      return toast.show({ message: 'Chưa đủ dữ liệu chi tiêu các tháng trước để gợi ý.', tone: 'warning' });
    }
    setProposal({
      title: 'Gợi ý theo chi tiêu 3 tháng gần đây',
      note: 'Hạn mức bằng mức chi trung bình mỗi tháng của từng danh mục, làm tròn 50.000 ₫.',
      budgets: list,
    });
  };

  const applyRule = () => {
    const value = parseVndExpression(income);
    if (!value || value <= 0) return setRuleError('Hãy nhập thu nhập mỗi tháng, ví dụ 20tr.');
    const result = fiftyThirtyTwenty(value, transactions, month, categories);
    setRuleOpen(false);
    setProposal({
      title: 'Gợi ý theo quy tắc 50/30/20',
      note: `50% cho nhu cầu thiết yếu, 30% cho mong muốn và để dành 20% (${format(result.savings)}) mỗi tháng.`,
      budgets: result.budgets,
    });
  };

  const accept = () => {
    if (!proposal) return;
    const previous = budgets;
    saveBudgets(proposal.budgets.map((b) => ({ id: b.category, category: b.category, amount: b.amount })));
    setProposal(null);
    toast.show({
      message: `Đã đặt ${proposal.budgets.length} ngân sách.`,
      tone: 'success',
      actionLabel: 'Hoàn tác',
      onAction: () => saveBudgets(proposal.budgets.map((b) => previous.find((p) => p.category === b.category) ?? { id: b.category, category: b.category, amount: 0 })),
    });
  };

  return (
    <View style={ui.screen}>
      <ScrollView contentContainerStyle={ui.content}>
        {statuses.length === 0 ? (
          <EmptyState
            icon="budget"
            title="Chưa có ngân sách"
            message="Đặt hạn mức chi cho từng danh mục. App sẽ báo khi bạn dùng tới 80% và khi vượt hạn mức."
            actionLabel="Đặt ngân sách đầu tiên"
            onAction={() => open(null)}
          />
        ) : (
          <Card>
            <Text style={ui.label}>Ngân sách {formatMonth(month).toLowerCase()}</Text>
            <Text style={{ fontSize: font.headline, fontWeight: '800', color: colors.text }}>
              {format(totalSpent)} <Text style={[ui.label, { fontWeight: '400' }]}>/ {format(totalLimit)}</Text>
            </Text>
            <ProgressBar
              ratio={totalLimit > 0 ? totalSpent / totalLimit : 0}
              color={totalSpent > totalLimit ? colors.expense : colors.primary}
              label="Tổng chi so với tổng ngân sách"
            />
            <Text style={ui.label}>
              {totalSpent <= totalLimit ? `Còn ${format(totalLimit - totalSpent)} cho tháng này` : `Đã vượt ${format(totalSpent - totalLimit)}`}
            </Text>
          </Card>
        )}

        {statuses.length > 0 ? (
          <Card>
            <CardHeader title="Theo danh mục" icon="pie-chart" />
            {statuses.map((s) => {
              const barColor = s.level === 'over' ? colors.expense : s.level === 'warn' ? colors.warning : colors.primary;
              return (
                <View key={s.budget.id} style={{ gap: 4 }}>
                  <ListItem
                    leading={<CategoryBadge icon={getCategoryIcon(s.category.icon ?? s.category.id)} color={s.category.color} />}
                    title={s.category.label}
                    subtitle={s.remaining >= 0 ? `Còn ${format(s.remaining)}` : `Vượt ${format(-s.remaining)}`}
                    right={format(s.spent)}
                    rightSub={<Text style={ui.label}>/ {format(s.budget.amount)}</Text>}
                    rightColor={s.level === 'ok' ? colors.text : barColor}
                    onPress={() => open(s.budget)}
                    accessibilityLabel={`${s.category.label}: đã chi ${format(s.spent)} trên ${format(s.budget.amount)}. Chạm để sửa`}
                  />
                  <ProgressBar ratio={s.ratio} color={barColor} height={6} />
                </View>
              );
            })}
            <Button small variant="secondary" label="Thêm ngân sách" icon="plus" onPress={() => open(null)} />
          </Card>
        ) : null}

        {unbudgeted.length > 0 && statuses.length > 0 ? (
          <Card>
            <CardHeader title="Chưa đặt ngân sách" icon="info" />
            {unbudgeted.map((c) => (
              <ListItem
                key={c.category.id}
                leading={<CategoryBadge icon={getCategoryIcon(c.category.icon ?? c.category.id)} color={c.category.color} />}
                title={c.category.label}
                subtitle="Đã chi tháng này"
                right={format(c.amount)}
                chevron
                onPress={() => nav.push({ name: 'category', id: c.category.id, month })}
              />
            ))}
          </Card>
        ) : null}

        <Card>
          <CardHeader title="Gợi ý nhanh" icon="sparkles" />
          <Text style={ui.label}>App đề xuất hạn mức, bạn xem lại rồi mới áp dụng.</Text>
          <Button variant="secondary" label="Theo chi tiêu 3 tháng gần đây" icon="chart" onPress={suggest} />
          <Button
            variant="secondary"
            label="Theo quy tắc 50/30/20"
            icon="scale"
            onPress={() => {
              setIncome(lastIncome > 0 ? formatDigits(lastIncome) : '');
              setRuleError('');
              setRuleOpen(true);
            }}
          />
        </Card>
      </ScrollView>

      <BudgetForm visible={formOpen} budget={editing} onClose={() => setFormOpen(false)} />

      <Sheet visible={ruleOpen} title="Quy tắc 50/30/20" onClose={() => setRuleOpen(false)} onSave={applyRule} saveLabel="Xem gợi ý" error={ruleError}>
        <Field label="Thu nhập mỗi tháng" icon="salary" hint="Mặc định lấy tổng thu của tháng trước.">
          <AmountInput value={income} onChangeText={setIncome} placeholder="Ví dụ: 20tr" autoFocus accessibilityLabel="Thu nhập mỗi tháng" />
        </Field>
      </Sheet>

      <Sheet visible={!!proposal} title={proposal?.title ?? ''} onClose={() => setProposal(null)} onSave={accept} saveLabel="Áp dụng">
        <Banner tone="info">{proposal?.note}</Banner>
        {proposal?.budgets.map((b) => {
          const current = budgets.find((x) => x.category === b.category);
          return (
            <View key={b.category} style={ui.row}>
              <Text style={ui.text}>{getTransactionCategory(b.category, categories).label}</Text>
              <Text style={[ui.text, { fontWeight: '700' }]}>
                {format(b.amount)}
                {current ? <Text style={[ui.label, { fontWeight: '400' }]}> (đang {format(current.amount)})</Text> : null}
              </Text>
            </View>
          );
        })}
      </Sheet>
    </View>
  );
}
