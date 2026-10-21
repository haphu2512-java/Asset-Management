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
      {/* Net Worth Summary Banner */}
      <View style={ui.card}>
        <View style={ui.row}>
          <Text style={ui.label}>TÀI SẢN RÒNG (NET WORTH)</Text>
          <Text style={[ui.label, { fontWeight: '600' }]}>{new Date().toLocaleDateString('vi-VN')}</Text>
        </View>
        <Text style={[ui.big, s.netWorth < 0 && { color: colors.expense }]}>{formatVnd(s.netWorth)}</Text>
        
        <View style={ui.divider} />

        <View style={ui.row}>
          <Text style={ui.label}>Tổng tài sản</Text>
          <Text style={[ui.text, { fontWeight: '600' }]}>{formatVnd(s.totalAssets)}</Text>
        </View>
        {s.totalDebt > 0 ? (
          <View style={ui.row}>
            <Text style={[ui.label, { color: colors.expense }]}>Tổng nợ phải trả</Text>
            <Text style={[ui.text, { color: colors.expense, fontWeight: '600' }]}>-{formatVnd(s.totalDebt)}</Text>
          </View>
        ) : null}
      </View>

      {/* Asset Distribution */}
      <View style={ui.card}>
        <View style={ui.row}>
          <Text style={ui.heading}>Cơ cấu tài sản</Text>
          <Text style={ui.label}>{assetItems.length} danh mục</Text>
        </View>
        {assetItems.length === 0 ? (
          <Text style={[ui.label, { paddingVertical: 12 }]}>Chưa có tài sản. Vào tab Tài sản để thêm.</Text>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 4 }}>
            <DonutChart size={100} slices={assetItems.map((i) => ({ value: i.amount, color: i.color }))} />
            <Legend items={assetItems} total={s.totalAssets} />
          </View>
        )}
      </View>

      {/* Monthly Cash Flow */}
      <View style={ui.card}>
        <View style={ui.row}>
          <Text style={ui.heading}>Thu chi {formatMonth(month.month)}</Text>
        </View>
        <View style={[ui.row, { paddingVertical: 2 }]}>
          <Text style={ui.text}>Thu nhập</Text>
          <Text style={[ui.text, { color: colors.income, fontWeight: '600' }]}>+{formatVnd(month.income)}</Text>
        </View>
        <View style={[ui.row, { paddingVertical: 2 }]}>
          <Text style={ui.text}>Chi tiêu</Text>
          <Text style={[ui.text, { color: colors.expense, fontWeight: '600' }]}>-{formatVnd(month.expense)}</Text>
        </View>
        <View style={ui.divider} />
        <View style={ui.row}>
          <Text style={[ui.heading, { fontSize: 14 }]}>Dòng tiền ròng (Còn lại)</Text>
          <Text style={[ui.heading, { fontSize: 14, color: month.balance < 0 ? colors.expense : colors.income }]}>
            {month.balance > 0 ? '+' : ''}{formatVnd(month.balance)}
          </Text>
        </View>
        {expenseItems.length > 0 ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 10 }}>
            <DonutChart size={100} slices={expenseItems.map((i) => ({ value: i.amount, color: i.color }))} />
            <Legend items={expenseItems} total={month.expense} />
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}
