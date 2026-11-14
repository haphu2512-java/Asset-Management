import { useMemo, useState } from 'react';
import { formatDay, formatMonth, isAccount, monthKey, summarizeFlows, todayKey, type Transaction } from '@shared/finance';
import { filterTransactions } from '@shared/ledger';
import { useStore } from '@shared/store';
import { DonutChart } from '../components/Charts';
import { useComposer } from '../components/Composer';
import { QuickEntryBar } from '../components/QuickEntryBar';
import { TransactionRow } from '../components/TransactionRow';
import { Button, Card, CardHeader, EmptyState, Legend, MonthNav, Segmented } from '../components/ui';
import { useMoney } from '../hooks';

type Scope = 'month' | 'all';
type Kind = 'all' | Transaction['kind'];

export function TransactionsPage() {
  const { transactions, categories, assets } = useStore();
  const composer = useComposer();
  const format = useMoney();
  const today = todayKey();
  const [scope, setScope] = useState<Scope>('month');
  const [month, setMonth] = useState(monthKey(today));
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<Kind>('all');
  const [categoryId, setCategoryId] = useState('');
  const [accountId, setAccountId] = useState('');
  const [limit, setLimit] = useState(200);

  const filtered = useMemo(() => {
    const [y, m] = month.split('-').map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    return filterTransactions(
      transactions,
      {
        query: query || undefined,
        kind: kind === 'all' ? undefined : kind,
        categoryIds: categoryId ? [categoryId] : undefined,
        accountId: accountId || undefined,
        ...(scope === 'month' ? { from: `${month}-01`, to: `${month}-${String(lastDay).padStart(2, '0')}` } : {}),
      },
      categories,
      assets,
    );
  }, [transactions, categories, assets, query, kind, categoryId, accountId, scope, month]);

  const summary = useMemo(() => summarizeFlows(filtered, categories), [filtered, categories]);
  const days = useMemo(() => {
    const groups: { date: string; items: Transaction[] }[] = [];
    for (const t of filtered.slice(0, limit)) {
      const last = groups[groups.length - 1];
      if (last && last.date === t.date) last.items.push(t);
      else groups.push({ date: t.date, items: [t] });
    }
    return groups;
  }, [filtered, limit]);

  const roots = categories.filter((c) => !c.parentId && (kind === 'all' || c.kind === kind));
  const filtering = !!query || kind !== 'all' || !!categoryId || !!accountId;
  const expenseItems = summary.expenseByCategory.map((c) => ({ label: c.category.label, color: c.category.color, amount: c.amount }));

  return (
    <>
      <Card>
        <QuickEntryBar />
      </Card>

      <div className="grid-2">
        <Card>
          <div className="row between wrap">
            <Segmented
              options={[
                { id: 'month', label: 'Theo tháng' },
                { id: 'all', label: 'Tất cả' },
              ]}
              value={scope}
              onChange={setScope}
            />
            {scope === 'month' ? <MonthNav month={month} onChange={setMonth} /> : null}
          </div>
          <div className="row">
            <div className="stat">
              <div className="label">Thu</div>
              <div className="value num income">{format(summary.income)}</div>
            </div>
            <div className="stat">
              <div className="label">Chi</div>
              <div className="value num expense">{format(summary.expense)}</div>
            </div>
            <div className="stat">
              <div className="label">Còn lại</div>
              <div className={`value num ${summary.balance < 0 ? 'expense' : ''}`}>{format(summary.balance)}</div>
            </div>
          </div>
          <input className="input" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tìm theo ghi chú, danh mục, ví…" aria-label="Tìm giao dịch" />
          <div className="row wrap">
            <select
              className="input"
              style={{ flex: 1, minWidth: 130 }}
              value={kind}
              onChange={(e) => {
                setKind(e.target.value as Kind);
                setCategoryId('');
              }}
              aria-label="Loại giao dịch"
            >
              <option value="all">Mọi loại</option>
              <option value="expense">Chi tiêu</option>
              <option value="income">Thu nhập</option>
              <option value="transfer">Chuyển khoản</option>
            </select>
            <select className="input" style={{ flex: 1, minWidth: 130 }} value={categoryId} onChange={(e) => setCategoryId(e.target.value)} aria-label="Danh mục" disabled={kind === 'transfer'}>
              <option value="">Mọi danh mục</option>
              {roots.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
            <select className="input" style={{ flex: 1, minWidth: 130 }} value={accountId} onChange={(e) => setAccountId(e.target.value)} aria-label="Ví">
              <option value="">Mọi ví</option>
              {assets.filter(isAccount).map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
          {filtering ? (
            <button
              className="link"
              style={{ alignSelf: 'flex-start' }}
              onClick={() => {
                setQuery('');
                setKind('all');
                setCategoryId('');
                setAccountId('');
              }}
            >
              Xoá bộ lọc
            </button>
          ) : null}
        </Card>

        <Card>
          <CardHeader title="Chi theo danh mục" icon="chart" right={<span className="label">{scope === 'month' ? formatMonth(month) : 'Tất cả'}</span>} />
          {expenseItems.length > 0 ? (
            <div className="row wrap" style={{ gap: 16 }}>
              <DonutChart items={expenseItems} size={120} />
              <Legend items={expenseItems.slice(0, 7)} format={format} />
            </div>
          ) : (
            <span className="label">Chưa có khoản chi nào trong phạm vi này.</span>
          )}
        </Card>
      </div>

      <Card>
        <CardHeader
          title={`${filtered.length} giao dịch`}
          icon="transactions"
          right={<Button small icon="plus" label="Thêm giao dịch" onClick={() => composer.open(scope === 'month' && month !== monthKey(today) ? { date: `${month}-01` } : undefined)} />}
        />
        {filtered.length === 0 ? (
          <EmptyState
            icon="transactions"
            title={filtering ? 'Không tìm thấy giao dịch nào' : 'Chưa có giao dịch'}
            message={filtering ? 'Thử đổi từ khoá hoặc bộ lọc.' : 'Ghi lại khoản thu chi đầu tiên để xem tiền đi đâu.'}
          />
        ) : (
          <div className="list">
            {days.map((day) => {
              const s = summarizeFlows(day.items, categories);
              return (
                <div key={day.date}>
                  <div className="day-head">
                    <span>{formatDay(day.date)}</span>
                    <span className="num">
                      {s.income > 0 ? <span className="income">+{format(s.income)} </span> : null}
                      {s.expense > 0 ? <span className="expense">-{format(s.expense)}</span> : null}
                    </span>
                  </div>
                  {day.items.map((t) => (
                    <TransactionRow key={t.id} tx={t} categories={categories} assets={assets} onClick={() => composer.open(t)} />
                  ))}
                </div>
              );
            })}
          </div>
        )}
        {filtered.length > limit ? <Button variant="secondary" label="Xem thêm" onClick={() => setLimit((l) => l + 200)} /> : null}
      </Card>
    </>
  );
}
