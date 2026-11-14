import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { budgetStatuses } from '@shared/budgets';
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
} from '@shared/finance';
import { usePrefs } from '@shared/prefs';
import { upcoming } from '@shared/recurring';
import { netWorthSeries } from '@shared/reports';
import { useStore } from '@shared/store';
import { DonutChart, LineChart } from '../components/Charts';
import { useComposer } from '../components/Composer';
import { Badge } from '../components/Icon';
import { TransactionRow } from '../components/TransactionRow';
import { Button, Card, CardHeader, ChangeBadge, EmptyState, Legend, ProgressBar, Segmented } from '../components/ui';
import { shortDate, useMoney } from '../hooks';

export function OverviewPage() {
  const { assets, transactions, goals, budgets, recurring, categories, baseline, snapshots, recordOccurrence, skipOccurrence } = useStore();
  const { prefs } = usePrefs();
  const navigate = useNavigate();
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
  const recent = useMemo(
    () => [...transactions].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)).slice(0, 6),
    [transactions],
  );

  const netWorthChange = baseline ? compareValue(s.netWorth, baseline.netWorth) : null;
  const assetItems = s.byCategory
    .filter((c) => !c.category.isLiability && c.amount > 0)
    .map((c) => ({ label: c.category.label, color: c.category.color, amount: c.amount }));
  const expenseItems = flow.expenseByCategory.map((c) => ({ label: c.category.label, color: c.category.color, amount: c.amount }));
  const dayOfMonth = Number(today.slice(8));
  const savingsRate = monthSummary.income > 0 ? Math.round((monthSummary.balance / monthSummary.income) * 100) : null;
  const isNew = assets.length === 0 && transactions.length === 0 && goals.length === 0;

  if (isNew) {
    return (
      <div className="grid-2">
        <Card>
          <EmptyState
            icon="wallet"
            title="Bắt đầu với ví đầu tiên"
            message="Thêm ví tiền mặt hoặc tài khoản ngân hàng với số dư hiện có. Từ đó mỗi khoản thu chi bạn ghi sẽ tự cập nhật số dư."
            actionLabel="Thêm ví"
            onAction={() => navigate('/assets')}
          />
        </Card>
        <Card>
          <EmptyState
            icon="transactions"
            title="Hoặc ghi ngay một khoản chi"
            message='Bấm nút + ở góc dưới, hoặc gõ nhanh "cafe 35k" trong trang Thu chi.'
            actionLabel="Thêm giao dịch"
            onAction={() => composer.open()}
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="masonry">
        <Card>
          <div className="row between">
            <span className="label">Tài sản ròng</span>
            <Link to="/reports" className="link">
              Báo cáo
            </Link>
          </div>
          <div className={`big num ${s.netWorth < 0 ? 'expense' : ''}`}>{format(s.netWorth)}</div>
          <ChangeBadge change={netWorthChange} label={baseline ? changeLabel(baseline.date, today) : undefined} />
          {series.length >= 2 ? <LineChart points={series} height={120} hidden={prefs.hideBalance} /> : null}
          <div className="row">
            <div className="stat">
              <div className="label">Tổng tài sản</div>
              <div className="value num">{format(s.totalAssets)}</div>
            </div>
            <div className="stat">
              <div className="label">Tổng nợ phải trả</div>
              <div className={`value num ${s.totalDebt > 0 ? 'expense' : ''}`}>{s.totalDebt > 0 ? `-${format(s.totalDebt)}` : format(0)}</div>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title="Thu chi" icon="transactions" right={<span className="label">{period === 'day' ? 'Hôm nay' : formatMonth(month)}</span>} />
          <Segmented
            options={[
              { id: 'month', label: 'Tháng này' },
              { id: 'day', label: 'Hôm nay' },
            ]}
            value={period}
            onChange={setPeriod}
          />
          <div className="row">
            <div className="stat">
              <div className="label">Thu</div>
              <div className="value num income">{format(flow.income)}</div>
            </div>
            <div className="stat">
              <div className="label">Chi</div>
              <div className="value num expense">{format(flow.expense)}</div>
            </div>
            <div className="stat">
              <div className="label">Còn lại</div>
              <div className={`value num ${flow.balance < 0 ? 'expense' : ''}`}>{format(flow.balance)}</div>
            </div>
          </div>
          {period === 'month' && monthSummary.expense > 0 ? (
            <span className="label">
              Trung bình {format(Math.round(monthSummary.expense / dayOfMonth))}/ngày
              {savingsRate !== null ? ` · Để dành được ${savingsRate}% thu nhập` : ''}
            </span>
          ) : null}
          {expenseItems.length > 0 ? (
            <div className="row wrap" style={{ gap: 16 }}>
              <DonutChart items={expenseItems} size={120} />
              <Legend items={expenseItems.slice(0, 6)} format={format} />
            </div>
          ) : (
            <span className="label">{period === 'day' ? 'Hôm nay chưa có khoản chi nào.' : 'Tháng này chưa có khoản chi nào.'}</span>
          )}
        </Card>

      {due.length > 0 ? (
        <Card>
          <CardHeader title="Sắp đến hạn" icon="clock" right={<Link to="/recurring" className="link">Tất cả</Link>} />
          <div className="list">
            {due.slice(0, 4).map(({ rule, date }) => {
              const overdue = date <= today;
              const category = rule.kind === 'transfer' ? null : getTransactionCategory(rule.category, categories);
              return (
                <div className="item" key={`${rule.id}-${date}`} style={{ flexWrap: 'wrap' }}>
                  <Badge color={category?.color ?? '#546E7A'} icon={category ? undefined : 'transfer'} letter={category?.label} />
                  <span className="grow">
                    <span className="title" style={{ display: 'block' }}>{rule.note}</span>
                    <span className="sub" style={{ display: 'block' }}>
                      {overdue ? `Đến hạn ${shortDate(date)}${rule.auto ? '' : ' · chờ bạn xác nhận'}` : `Ngày ${shortDate(date)}${rule.auto ? ' · tự động ghi' : ''}`}
                    </span>
                  </span>
                  <span className={`right num ${rule.kind === 'income' ? 'income' : rule.kind === 'expense' ? 'expense' : ''}`}>
                    {rule.kind === 'income' ? '+' : rule.kind === 'expense' ? '-' : ''}
                    {format(rule.amount)}
                  </span>
                  {overdue && !rule.auto ? (
                    <span className="row">
                      <Button small variant="secondary" label="Bỏ qua kỳ này" onClick={() => skipOccurrence(rule.id, date)} />
                      <Button small label="Ghi nhận" icon="check" onClick={() => recordOccurrence(rule.id, date)} />
                    </span>
                  ) : null}
                </div>
              );
            })}
          </div>
        </Card>
      ) : null}

        <Card>
          <CardHeader title="Ngân sách tháng này" icon="budget" right={<Link to="/budgets" className="link">{statuses.length > 0 ? 'Chi tiết' : 'Đặt ngân sách'}</Link>} />
          {statuses.length === 0 ? (
            <span className="label">Đặt hạn mức cho từng danh mục để được cảnh báo trước khi tiêu quá tay.</span>
          ) : (
            statuses.slice(0, 4).map((b) => (
              <div className="stack" style={{ gap: 4 }} key={b.budget.id}>
                <div className="row between">
                  <span className="strong">{b.category.label}</span>
                  <span className={`caption num ${b.level === 'over' ? 'expense' : b.level === 'warn' ? 'warning' : ''}`} style={{ fontWeight: 600 }}>
                    {b.remaining >= 0 ? `Còn ${format(b.remaining)}` : `Vượt ${format(-b.remaining)}`}
                  </span>
                </div>
                <ProgressBar ratio={b.ratio} level={b.level} />
              </div>
            ))
          )}
        </Card>

        <Card>
          <CardHeader title="Cơ cấu tài sản" icon="wallet" right={<Link to="/assets" className="link">Xem tài sản</Link>} />
          {assetItems.length === 0 ? (
            <span className="label">Chưa có tài sản. Thêm ví hoặc khoản đầu tư ở trang Tài sản.</span>
          ) : (
            <div className="row wrap" style={{ gap: 16 }}>
              <DonutChart items={assetItems} size={120} />
              <Legend items={assetItems} format={format} />
            </div>
          )}
        </Card>

        <Card>
          <CardHeader title="Giao dịch gần đây" icon="transactions" right={<Link to="/transactions" className="link">Tất cả</Link>} />
          {recent.length === 0 ? (
            <span className="label">Chưa có giao dịch nào.</span>
          ) : (
            <div className="list">
              {recent.map((t) => (
                <TransactionRow key={t.id} tx={t} categories={categories} assets={assets} showDate={shortDate(t.date)} onClick={() => composer.open(t)} />
              ))}
            </div>
          )}
        </Card>

          {goals.length > 0 ? (
            <Card>
              <CardHeader title="Mục tiêu" icon="goals" right={<Link to="/goals" className="link">Tất cả</Link>} />
              {goals.slice(0, 3).map((g) => {
                const p = goalProgress(g);
                return (
                  <div className="stack" style={{ gap: 4 }} key={g.id}>
                    <div className="row between">
                      <span className="strong">{g.name}</span>
                      <span className="label num">{Math.round(p.ratio * 100)}%</span>
                    </div>
                    <ProgressBar ratio={p.ratio} color={getGoalCategory(g.category).color} />
                    <span className="caption num">
                      {format(g.saved)} / {format(g.target)}
                      {g.type === 'recurring' && !p.contributedThisPeriod && p.remaining > 0 ? ` · chưa góp ${p.currentPeriodLabel}` : ''}
                    </span>
                  </div>
                );
              })}
            </Card>
          ) : null}
          <Card>
            <CardHeader title="Nhận xét từ cố vấn AI" icon="sparkle" />
            <span className="label">AI đọc số liệu tài sản, thu chi 3 tháng và mục tiêu của bạn để nhận xét và gợi ý.</span>
            <div className="row wrap">
              <Button
                small
                label="Nhận xét tháng này"
                icon="sparkle"
                onClick={() => navigate('/advisor', { state: { question: 'Nhận xét thu chi tháng này của tôi và chỉ ra chỗ tôi chi quá tay.' } })}
              />
              <Button small variant="secondary" label="Hỏi câu khác" onClick={() => navigate('/advisor')} />
            </div>
          </Card>
    </div>
  );
}
