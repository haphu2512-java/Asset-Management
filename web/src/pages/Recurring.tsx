import { useMemo, useState } from 'react';
import { getTransactionCategory, todayKey } from '@shared/finance';
import { FREQUENCY_LABEL, monthlyAmount, upcoming, type Recurring } from '@shared/recurring';
import { useStore } from '@shared/store';
import { Badge } from '../components/Icon';
import { RecurringForm } from '../components/PlanningForms';
import { Button, Card, CardHeader, EmptyState } from '../components/ui';
import { fullDate, shortDate, useMoney } from '../hooks';

export function RecurringPage() {
  const { recurring, categories, assets, recordOccurrence, skipOccurrence } = useStore();
  const format = useMoney();
  const today = todayKey();
  const [form, setForm] = useState<{ rule: Recurring | null } | null>(null);

  const due = useMemo(() => upcoming(recurring, today, 7), [recurring, today]);
  const fixedIncome = recurring.filter((r) => r.active && r.kind === 'income').reduce((s, r) => s + monthlyAmount(r), 0);
  const fixedExpense = recurring.filter((r) => r.active && r.kind === 'expense').reduce((s, r) => s + monthlyAmount(r), 0);

  const title = (r: Recurring) => r.note || (r.kind === 'transfer' ? 'Chuyển khoản' : getTransactionCategory(r.category, categories).label);
  const badge = (r: Recurring) => {
    const c = r.kind === 'transfer' ? null : getTransactionCategory(r.category, categories);
    return <Badge color={c?.color ?? '#546E7A'} icon={c ? undefined : 'transfer'} letter={c?.label} />;
  };
  const amount = (r: Recurring) => (
    <span className={`right num ${r.kind === 'income' ? 'income' : r.kind === 'expense' ? 'expense' : ''}`}>
      {r.kind === 'income' ? '+' : r.kind === 'expense' ? '-' : ''}
      {format(r.amount)}
    </span>
  );

  if (recurring.length === 0) {
    return (
      <>
        <Card>
          <EmptyState
            icon="refresh"
            title="Chưa có khoản định kỳ"
            message="Thêm lương, tiền nhà, hoá đơn hay gói thuê bao. App sẽ tự ghi hoặc nhắc bạn khi đến hạn."
            actionLabel="Thêm khoản định kỳ"
            onAction={() => setForm({ rule: null })}
          />
        </Card>
        {form ? <RecurringForm rule={form.rule} onClose={() => setForm(null)} /> : null}
      </>
    );
  }

  return (
    <>
      <Card>
        <span className="label">Quy ra mỗi tháng</span>
        <div className="row">
          <div className="stat">
            <div className="label">Thu cố định</div>
            <div className="value num income">{format(fixedIncome)}</div>
          </div>
          <div className="stat">
            <div className="label">Chi cố định</div>
            <div className="value num expense">{format(fixedExpense)}</div>
          </div>
          <div className="stat">
            <div className="label">Còn lại</div>
            <div className="value num">{format(fixedIncome - fixedExpense)}</div>
          </div>
        </div>
      </Card>

      {due.length > 0 ? (
        <Card>
          <CardHeader title="Đến hạn trong 7 ngày" icon="clock" />
          <div className="list">
            {due.map(({ rule, date }) => {
              const overdue = date <= today;
              return (
                <div className="item" key={`${rule.id}@${date}`} style={{ flexWrap: 'wrap' }}>
                  {badge(rule)}
                  <span className="grow">
                    <span className="title" style={{ display: 'block' }}>{title(rule)}</span>
                    <span className="sub" style={{ display: 'block' }}>
                      {overdue ? `Đến hạn ${shortDate(date)}${rule.auto ? '' : ' · chờ bạn xác nhận'}` : `Ngày ${shortDate(date)}${rule.auto ? ' · tự động ghi' : ''}`}
                    </span>
                  </span>
                  {amount(rule)}
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
        <CardHeader title="Tất cả khoản định kỳ" icon="refresh" right={<Button small icon="plus" label="Thêm" onClick={() => setForm({ rule: null })} />} />
        <div className="list">
          {recurring.map((r) => {
            const wallet = assets.find((a) => a.id === r.accountId)?.name;
            return (
              <button className="item" key={r.id} onClick={() => setForm({ rule: r })} style={r.active ? undefined : { opacity: 0.55 }}>
                {badge(r)}
                <span className="grow">
                  <span className="title" style={{ display: 'block' }}>{title(r)}</span>
                  <span className="sub" style={{ display: 'block' }}>
                    {[FREQUENCY_LABEL[r.frequency], r.active ? `kỳ tới ${fullDate(r.nextDate)}` : 'đang tạm dừng', r.auto ? 'tự động ghi' : 'hỏi trước khi ghi', wallet].filter(Boolean).join(' · ')}
                  </span>
                </span>
                {amount(r)}
              </button>
            );
          })}
        </div>
      </Card>
      {form ? <RecurringForm rule={form.rule} onClose={() => setForm(null)} /> : null}
    </>
  );
}
