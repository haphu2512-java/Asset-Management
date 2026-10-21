import { ScrollView, Text, View } from 'react-native';
import { DonutChart } from '../components/DonutChart';
import { Legend } from '../components/Legend';
import { formatMonth, formatVnd, monthKey, summarize, summarizeMonth } from '../finance';
import { useStore } from '../store';
import { colors, ui } from '../theme';

export function OverviewScreen() {
  const { assets, transactions } = useStore();
  const s = summarize(assets);
  const month = summarizeMonth(transactions, monthKey(new Date()));
  const assetItems = s.byCategory
    .filter((c) => !c.category.isLiability && c.amount > 0)
    .map((c) => ({ label: c.category.label, color: c.category.color, amount: c.amount }));
  const expenseItems = month.expenseByCategory.map((c) => ({
    label: c.category.label,
    color: c.category.color,
    amount: c.amount,
  }));

  return (
    <ScrollView style={ui.screen} contentContainerStyle={ui.content}>
      <View style={ui.card}>
        <Text style={ui.label}>Tài sản ròng</Text>
        <Text style={[ui.big, s.netWorth < 0 && { color: colors.expense }]}>{formatVnd(s.netWorth)}</Text>
        <View style={ui.row}>
          <Text style={ui.label}>Tổng tài sản: {formatVnd(s.totalAssets)}</Text>
        </View>
        {s.totalDebt > 0 ? (
          <Text style={[ui.label, { color: colors.expense }]}>Đang nợ: {formatVnd(s.totalDebt)}</Text>
        ) : null}
      </View>

      <View style={ui.card}>
        <Text style={ui.heading}>Cơ cấu tài sản</Text>
        {assetItems.length === 0 ? (
          <Text style={ui.label}>Chưa có tài sản. Vào tab Tài sản để thêm.</Text>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
            <DonutChart slices={assetItems.map((i) => ({ value: i.amount, color: i.color }))} />
            <Legend items={assetItems} total={s.totalAssets} />
          </View>
        )}
      </View>

      <View style={ui.card}>
        <Text style={ui.heading}>{formatMonth(month.month)}</Text>
        <View style={ui.row}>
          <Text style={ui.text}>Thu nhập</Text>
          <Text style={[ui.text, { color: colors.income }]}>+{formatVnd(month.income)}</Text>
        </View>
        <View style={ui.row}>
          <Text style={ui.text}>Chi tiêu</Text>
          <Text style={[ui.text, { color: colors.expense }]}>-{formatVnd(month.expense)}</Text>
        </View>
        <View style={ui.row}>
          <Text style={ui.heading}>Còn lại</Text>
          <Text style={[ui.heading, { color: month.balance < 0 ? colors.expense : colors.income }]}>
            {formatVnd(month.balance)}
          </Text>
        </View>
        {expenseItems.length > 0 ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 8 }}>
            <DonutChart size={120} slices={expenseItems.map((i) => ({ value: i.amount, color: i.color }))} />
            <Legend items={expenseItems} total={month.expense} />
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}
