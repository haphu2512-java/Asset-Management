import { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { LineChart, MonthlyBars } from '../components/Charts';
import { getCategoryIcon } from '../components/Icon';
import { Card, CardHeader, CategoryBadge, IconButton, ListItem, Segmented } from '../components/ui';
import { formatMonth, monthKey, shiftMonth, todayKey } from '../finance';
import { portfolioPerformance } from '../investments';
import { useNav } from '../nav';
import { usePrefs } from '../prefs';
import { compareMonths, netWorthSeries, reportYears, yearReport } from '../reports';
import { useStore } from '../store';
import { font, useMoney, useTheme } from '../theme';

type Range = '30' | '90' | '365';

/** Reports: net worth over time, this month against the last, the year in review, investment results. */
export function ReportsScreen() {
  const { colors, ui } = useTheme();
  const { snapshots, transactions, categories, assets, trades } = useStore();
  const { prefs } = usePrefs();
  const nav = useNav();
  const format = useMoney();
  const today = todayKey();
  const [range, setRange] = useState<Range>('90');
  const [month, setMonth] = useState(monthKey(today));
  const [year, setYear] = useState(Number(today.slice(0, 4)));

  const series = useMemo(() => netWorthSeries(snapshots, today, Number(range)), [snapshots, today, range]);
  const comparison = useMemo(() => compareMonths(transactions, month, categories), [transactions, month, categories]);
  const years = useMemo(() => reportYears(transactions, today), [transactions, today]);
  const report = useMemo(() => yearReport(transactions, year, categories), [transactions, year, categories]);
  const portfolio = useMemo(() => portfolioPerformance(assets, trades), [assets, trades]);
  const hasPortfolio = portfolio.cost > 0 || portfolio.realized !== 0 || portfolio.dividends !== 0;

  const first = series[0];
  const last = series[series.length - 1];
  const delta = first && last ? last.value - first.value : 0;
  const signed = (n: number) => `${n > 0 ? '+' : n < 0 ? '-' : ''}${format(Math.abs(n))}`;
  const pnlColor = (n: number) => (n > 0 ? colors.income : n < 0 ? colors.expense : colors.text);
  const yearIndex = years.indexOf(year);

  return (
    <ScrollView style={ui.screen} contentContainerStyle={ui.content}>
      <Card>
        <CardHeader title="Tài sản ròng theo thời gian" icon="trending-up" />
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
          <Text style={ui.label}>
            App ghi lại tài sản ròng mỗi ngày bạn mở app. Biểu đồ sẽ hiện khi có từ hai ngày dữ liệu trở lên.
          </Text>
        ) : (
          <>
            <LineChart points={series} hidden={prefs.hideBalance} />
            <View style={ui.row}>
              <Text style={ui.label}>Thay đổi trong kỳ</Text>
              <Text style={{ fontSize: font.body, fontWeight: '700', color: pnlColor(delta) }}>{signed(delta)}</Text>
            </View>
          </>
        )}
      </Card>

      <Card>
        <View style={ui.row}>
          <IconButton icon="chevron-left" label="Tháng trước" onPress={() => setMonth(shiftMonth(month, -1))} color={colors.text} />
          <Text style={ui.heading}>{formatMonth(month)} so với tháng trước</Text>
          <IconButton icon="chevron-right" label="Tháng sau" onPress={() => setMonth(shiftMonth(month, 1))} color={colors.text} />
        </View>
        {comparison.length === 0 ? (
          <Text style={ui.label}>Chưa có khoản chi nào trong hai tháng này.</Text>
        ) : (
          comparison.map((c) => (
            <ListItem
              key={c.category.id}
              leading={<CategoryBadge icon={getCategoryIcon(c.category.icon ?? c.category.id)} color={c.category.color} />}
              title={c.category.label}
              subtitle={`Tháng trước ${format(c.previous)}`}
              right={format(c.current)}
              rightSub={
                <Text style={{ fontSize: font.caption, fontWeight: '600', color: c.change > 0 ? colors.expense : c.change < 0 ? colors.income : colors.muted }}>
                  {c.change === 0 ? 'Không đổi' : `${signed(c.change)}${c.percent != null ? ` (${c.percent > 0 ? '+' : ''}${Math.round(c.percent)}%)` : ''}`}
                </Text>
              }
              onPress={() => nav.push({ name: 'category', id: c.category.id, month })}
              accessibilityLabel={`${c.category.label}: ${format(c.current)}, tháng trước ${format(c.previous)}`}
            />
          ))
        )}
      </Card>

      <Card>
        <View style={ui.row}>
          <IconButton
            icon="chevron-left"
            label="Năm trước"
            onPress={() => setYear(years[Math.min(years.length - 1, yearIndex + 1)] ?? year)}
            color={yearIndex < years.length - 1 ? colors.text : colors.border}
          />
          <Text style={ui.heading}>Tổng kết năm {year}</Text>
          <IconButton
            icon="chevron-right"
            label="Năm sau"
            onPress={() => setYear(years[Math.max(0, yearIndex - 1)] ?? year)}
            color={yearIndex > 0 ? colors.text : colors.border}
          />
        </View>
        <MonthlyBars months={report.months} />
        <View style={{ flexDirection: 'row', gap: 16 }}>
          <Text style={[ui.label, { color: colors.income }]}>■ Thu</Text>
          <Text style={[ui.label, { color: colors.expense }]}>■ Chi</Text>
        </View>
        <View style={ui.row}>
          <Text style={ui.text}>Tổng thu</Text>
          <Text style={[ui.text, { fontWeight: '700', color: colors.income }]}>{format(report.income)}</Text>
        </View>
        <View style={ui.row}>
          <Text style={ui.text}>Tổng chi</Text>
          <Text style={[ui.text, { fontWeight: '700', color: colors.expense }]}>{format(report.expense)}</Text>
        </View>
        <View style={ui.row}>
          <Text style={ui.text}>Để dành được</Text>
          <Text style={[ui.text, { fontWeight: '700', color: pnlColor(report.balance) }]}>
            {signed(report.balance)}
            {report.savingsRate != null ? ` (${Math.round(report.savingsRate)}% thu nhập)` : ''}
          </Text>
        </View>
        {report.topMonth ? (
          <Text style={ui.label}>
            Tháng chi nhiều nhất: {formatMonth(report.topMonth.month).toLowerCase()} với {format(report.topMonth.expense)}.
          </Text>
        ) : null}
        {report.expenseByCategory.slice(0, 5).map((c) => (
          <View key={c.category.id} style={ui.row}>
            <Text style={ui.label}>{c.category.label}</Text>
            <Text style={ui.label}>
              {format(c.amount)} · {report.expense > 0 ? Math.round((c.amount / report.expense) * 100) : 0}%
            </Text>
          </View>
        ))}
      </Card>

      {hasPortfolio ? (
        <Card>
          <CardHeader title="Hiệu quả đầu tư" icon="stock" />
          <View style={ui.row}>
            <Text style={ui.text}>Vốn đang đầu tư</Text>
            <Text style={[ui.text, { fontWeight: '700' }]}>{format(portfolio.cost)}</Text>
          </View>
          <View style={ui.row}>
            <Text style={ui.text}>Giá trị hiện tại</Text>
            <Text style={[ui.text, { fontWeight: '700' }]}>{format(portfolio.value)}</Text>
          </View>
          <View style={ui.row}>
            <Text style={ui.text}>Lãi/lỗ chưa chốt</Text>
            <Text style={[ui.text, { fontWeight: '700', color: pnlColor(portfolio.unrealized) }]}>
              {signed(portfolio.unrealized)}
              {portfolio.cost > 0 ? ` (${((portfolio.unrealized / portfolio.cost) * 100).toFixed(1).replace('.', ',')}%)` : ''}
            </Text>
          </View>
          <View style={ui.row}>
            <Text style={ui.text}>Lãi/lỗ đã chốt</Text>
            <Text style={[ui.text, { fontWeight: '700', color: pnlColor(portfolio.realized) }]}>{signed(portfolio.realized)}</Text>
          </View>
          <View style={ui.row}>
            <Text style={ui.text}>Cổ tức, lãi đã nhận</Text>
            <Text style={[ui.text, { fontWeight: '700', color: pnlColor(portfolio.dividends) }]}>{signed(portfolio.dividends)}</Text>
          </View>
          <Text style={ui.label}>Tính theo giá vốn bình quân, chỉ gồm tài sản có ghi lệnh mua bán.</Text>
        </Card>
      ) : null}
    </ScrollView>
  );
}
