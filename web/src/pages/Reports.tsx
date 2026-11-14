import { useMemo, useState } from 'react';
import { formatMonth, monthKey, todayKey } from '@shared/finance';
import { portfolioPerformance } from '@shared/investments';
import { usePrefs } from '@shared/prefs';
import { compareMonths, netWorthSeries, reportYears, yearReport } from '@shared/reports';
import { useStore } from '@shared/store';
import { BarChart, DonutChart, LineChart } from '../components/Charts';
import { Badge } from '../components/Icon';
import { Card, CardHeader, IconButton, Legend, MonthNav, Segmented } from '../components/ui';
import { useMoney } from '../hooks';

export function ReportsPage() {
  const { transactions, categories, snapshots, assets, trades } = useStore();
  const { prefs } = usePrefs();
  const format = useMoney();
  const today = todayKey();
  const [range, setRange] = useState<'30' | '90' | '365'>('30');
  const [month, setMonth] = useState(monthKey(today));
  const years = useMemo(() => reportYears(transactions, today), [transactions, today]);
  const [year, setYear] = useState(years[0]);

  const series = useMemo(() => netWorthSeries(snapshots, today, Number(range)), [snapshots, today, range]);
  const delta = series.length >= 2 ? series[series.length - 1].value - series[0].value : 0;
  const comparison = useMemo(() => compareMonths(transactions, month, categories), [transactions, month, categories]);
  const report = useMemo(() => yearReport(transactions, year, categories), [transactions, year, categories]);
  const portfolio = useMemo(() => portfolioPerformance(assets, trades), [assets, trades]);
  const yearIndex = years.indexOf(year);
  const signed = (n: number) => `${n >= 0 ? '+' : '-'}${format(Math.abs(n))}`;
  const tone = (n: number) => (n >= 0 ? 'income' : 'expense');
  const yearItems = report.expenseByCategory.map((c) => ({ label: c.category.label, color: c.category.color, amount: c.amount }));

  return (
    <>
      <Card>
        <CardHeader title="Tài sản ròng theo thời gian" icon="chart" />
        <Segmented
          options={[
            { id: '30', label: '1 tháng' },
            { id: '90', label: '3 tháng' },
            { id: '365', label: '1 năm' },
          ]}
          value={range}
          onChange={setRange}
        />
        {series.length < 2 ? (
          <span className="label">App ghi lại tài sản ròng mỗi ngày bạn mở app. Biểu đồ sẽ hiện khi có từ hai ngày dữ liệu trở lên.</span>
        ) : (
          <>
            <LineChart points={series} height={220} hidden={prefs.hideBalance} />
            <div className="row between">
              <span className="label">Thay đổi trong kỳ</span>
              <span className={`strong num ${tone(delta)}`}>{signed(delta)}</span>
            </div>
          </>
        )}
      </Card>

      <div className="grid-2">
        <Card>
          <div className="row between">
            <h2 style={{ fontSize: 15 }}>So với tháng trước</h2>
            <MonthNav month={month} onChange={setMonth} max={monthKey(today)} />
          </div>
          {comparison.length === 0 ? (
            <span className="label">Chưa có khoản chi nào trong hai tháng này.</span>
          ) : (
            <div className="list">
              {comparison.map((c) => (
                <div className="item" key={c.category.id}>
                  <Badge color={c.category.color} letter={c.category.label} />
                  <span className="grow">
                    <span className="title" style={{ display: 'block' }}>{c.category.label}</span>
                    <span className="sub num" style={{ display: 'block' }}>Tháng trước {format(c.previous)}</span>
                  </span>
                  <span className="right num">
                    {format(c.current)}
                    <span className={`caption ${c.change > 0 ? 'expense' : c.change < 0 ? 'income' : ''}`} style={{ display: 'block', fontWeight: 600 }}>
                      {c.change === 0 ? 'Không đổi' : `${signed(c.change)}${c.percent != null ? ` (${c.percent > 0 ? '+' : ''}${Math.round(c.percent)}%)` : ''}`}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <div className="row between">
            <h2 style={{ fontSize: 15 }}>Tổng kết năm {year}</h2>
            <div className="month-nav">
              <IconButton icon="back" label="Năm trước" onClick={() => setYear(years[Math.min(years.length - 1, yearIndex + 1)] ?? year)} />
              <IconButton icon="next" label="Năm sau" onClick={() => setYear(years[Math.max(0, yearIndex - 1)] ?? year)} />
            </div>
          </div>
          <BarChart months={report.months} hidden={prefs.hideBalance} />
          <div className="row caption" style={{ justifyContent: 'center', gap: 16 }}>
            <span className="income">■ Thu</span>
            <span className="expense">■ Chi</span>
          </div>
          <div className="row">
            <div className="stat">
              <div className="label">Tổng thu</div>
              <div className="value num income">{format(report.income)}</div>
            </div>
            <div className="stat">
              <div className="label">Tổng chi</div>
              <div className="value num expense">{format(report.expense)}</div>
            </div>
          </div>
          <div className="row between">
            <span className="label">Để dành được</span>
            <span className={`strong num ${tone(report.balance)}`}>
              {signed(report.balance)}
              {report.savingsRate !== null ? ` (${Math.round(report.savingsRate)}% thu nhập)` : ''}
            </span>
          </div>
          {report.topMonth ? (
            <span className="label num">
              Chi nhiều nhất: {formatMonth(report.topMonth.month)} ({format(report.topMonth.expense)}).
            </span>
          ) : null}
          {yearItems.length > 0 ? (
            <div className="row wrap" style={{ gap: 16 }}>
              <DonutChart items={yearItems} size={120} />
              <Legend items={yearItems.slice(0, 7)} format={format} />
            </div>
          ) : null}
        </Card>
      </div>

      {portfolio.cost > 0 || portfolio.realized !== 0 || portfolio.dividends !== 0 ? (
        <Card>
          <CardHeader title="Hiệu quả đầu tư" icon="chart" />
          <div className="row wrap">
            <div className="stat">
              <div className="label">Vốn đang đầu tư</div>
              <div className="value num">{format(portfolio.cost)}</div>
            </div>
            <div className="stat">
              <div className="label">Giá trị hiện tại</div>
              <div className="value num">{format(portfolio.value)}</div>
            </div>
            <div className="stat">
              <div className="label">Lãi/lỗ chưa chốt</div>
              <div className={`value num ${tone(portfolio.unrealized)}`}>{signed(portfolio.unrealized)}</div>
            </div>
          </div>
          <div className="row between">
            <span className="label">Lãi/lỗ đã chốt</span>
            <span className={`num ${tone(portfolio.realized)}`}>{signed(portfolio.realized)}</span>
          </div>
          <div className="row between">
            <span className="label">Cổ tức, lãi đã nhận</span>
            <span className="num">{format(portfolio.dividends)}</span>
          </div>
          <span className="caption">Tính theo giá vốn bình quân, chỉ gồm tài sản có ghi lệnh mua bán.</span>
        </Card>
      ) : null}
    </>
  );
}
