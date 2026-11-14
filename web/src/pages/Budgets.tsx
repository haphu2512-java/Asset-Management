import { useMemo, useState } from 'react';
import { budgetStatuses, fiftyThirtyTwenty, suggestBudgets, type Budget } from '@shared/budgets';
import { formatDigits, formatMonth, getTransactionCategory, monthKey, parseVndExpression, shiftMonth, summarizeMonth, todayKey } from '@shared/finance';
import { useStore } from '@shared/store';
import { Badge } from '../components/Icon';
import { BudgetForm } from '../components/PlanningForms';
import { useToast } from '../components/Toast';
import { AmountInput, Button, Card, CardHeader, EmptyState, Field, Modal, ProgressBar } from '../components/ui';
import { useMoney } from '../hooks';

type Proposal = { title: string; note: string; budgets: { category: string; amount: number }[] };

export function BudgetsPage() {
  const { transactions, budgets, categories, saveBudgets } = useStore();
  const toast = useToast();
  const format = useMoney();
  const month = monthKey(todayKey());
  const [form, setForm] = useState<{ budget: Budget | null } | null>(null);
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

  const suggest = () => {
    const list = suggestBudgets(transactions, month, categories);
    if (list.length === 0) return toast.show({ message: 'Chưa đủ dữ liệu chi tiêu các tháng trước để gợi ý.', tone: 'warning' });
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

  const totalLevel = totalLimit > 0 && totalSpent > totalLimit ? 'over' : totalLimit > 0 && totalSpent / totalLimit >= 0.8 ? 'warn' : 'ok';

  return (
    <>
      {statuses.length === 0 ? (
        <Card>
          <EmptyState
            icon="budget"
            title="Chưa có ngân sách"
            message="Đặt hạn mức chi cho từng danh mục. App sẽ báo khi bạn dùng tới 80% và khi vượt hạn mức."
            actionLabel="Đặt ngân sách đầu tiên"
            onAction={() => setForm({ budget: null })}
          />
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader title="Tổng chi so với tổng ngân sách" icon="budget" right={<span className="label">{formatMonth(month)}</span>} />
            <div className="row between">
              <span className="medium num">{format(totalSpent)}</span>
              <span className="label num">/ {format(totalLimit)}</span>
            </div>
            <ProgressBar ratio={totalLimit > 0 ? totalSpent / totalLimit : 0} level={totalLevel} />
            <span className={`label num ${totalLevel === 'over' ? 'expense' : ''}`}>
              {totalLimit - totalSpent >= 0 ? `Còn ${format(totalLimit - totalSpent)} cho đến cuối tháng.` : `Đã vượt ${format(totalSpent - totalLimit)}.`}
            </span>
          </Card>
          <Card>
            <CardHeader title="Theo danh mục" right={<Button small icon="plus" label="Thêm ngân sách" onClick={() => setForm({ budget: null })} />} />
            <div className="list">
              {statuses.map((b) => (
                <button className="item" key={b.budget.id} onClick={() => setForm({ budget: b.budget })}>
                  <Badge color={b.category.color} letter={b.category.label} />
                  <span className="grow stack" style={{ gap: 4 }}>
                    <span className="row between">
                      <span className="title">{b.category.label}</span>
                      <span className="caption num">
                        {format(b.spent)} / {format(b.budget.amount)}
                      </span>
                    </span>
                    <ProgressBar ratio={b.ratio} level={b.level} />
                    <span className={`caption num ${b.level === 'over' ? 'expense' : b.level === 'warn' ? 'warning' : ''}`}>
                      {b.remaining >= 0 ? `Còn ${format(b.remaining)}` : `Vượt ${format(-b.remaining)}`} · {Math.round(b.ratio * 100)}%
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </Card>
        </>
      )}

      <div className="grid-2">
        {unbudgeted.length > 0 ? (
          <Card>
            <CardHeader title="Chưa đặt ngân sách" />
            <span className="label">Đã chi tháng này</span>
            <div className="list">
              {unbudgeted.map((c) => (
                <div className="item" key={c.category.id}>
                  <Badge color={c.category.color} letter={c.category.label} />
                  <span className="grow title">{c.category.label}</span>
                  <span className="right num">{format(c.amount)}</span>
                </div>
              ))}
            </div>
          </Card>
        ) : null}
        <Card>
          <CardHeader title="Gợi ý nhanh" icon="sparkle" />
          <span className="label">App đề xuất hạn mức, bạn xem lại rồi mới áp dụng.</span>
          <div className="row wrap">
            <Button small variant="secondary" label="Theo chi tiêu 3 tháng gần đây" onClick={suggest} />
            <Button
              small
              variant="secondary"
              label="Theo quy tắc 50/30/20"
              onClick={() => {
                setIncome(lastIncome > 0 ? formatDigits(lastIncome) : '');
                setRuleError('');
                setRuleOpen(true);
              }}
            />
          </div>
        </Card>
      </div>

      {form ? <BudgetForm budget={form.budget} onClose={() => setForm(null)} /> : null}
      {ruleOpen ? (
        <Modal title="Quy tắc 50/30/20" onClose={() => setRuleOpen(false)} onSave={applyRule} saveLabel="Xem gợi ý" error={ruleError}>
          <Field label="Thu nhập mỗi tháng" hint="Mặc định lấy tổng thu của tháng trước.">
            <AmountInput value={income} onChange={setIncome} placeholder="Ví dụ: 20tr" autoFocus />
          </Field>
        </Modal>
      ) : null}
      {proposal ? (
        <Modal title={proposal.title} onClose={() => setProposal(null)} onSave={accept} saveLabel="Áp dụng">
          <span className="label">{proposal.note}</span>
          <div className="list">
            {proposal.budgets.map((b) => {
              const c = getTransactionCategory(b.category, categories);
              const current = budgets.find((x) => x.category === b.category);
              return (
                <div className="item" key={b.category}>
                  <Badge color={c.color} letter={c.label} />
                  <span className="grow">
                    <span className="title" style={{ display: 'block' }}>{c.label}</span>
                    {current ? <span className="sub num" style={{ display: 'block' }}>Hiện tại {format(current.amount)}</span> : null}
                  </span>
                  <span className="right num">{format(b.amount)}</span>
                </div>
              );
            })}
          </div>
        </Modal>
      ) : null}
    </>
  );
}
