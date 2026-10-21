import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { QuickEntryBar } from '../components/QuickEntryBar';
import { TransactionForm } from '../components/TransactionForm';
import {
  formatMonth,
  formatVnd,
  getTransactionCategory,
  monthKey,
  shiftMonth,
  summarizeMonth,
  type Transaction,
} from '../finance';
import { useStore } from '../store';
import { colors, ui } from '../theme';

export function TransactionsScreen() {
  const { transactions, saveTransaction, deleteTransaction } = useStore();
  const [month, setMonth] = useState(monthKey(new Date()));
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const summary = summarizeMonth(transactions, month);
  const items = transactions
    .filter((t) => monthKey(t.date) === month)
    .sort((a, b) => b.date.localeCompare(a.date));

  const open = (tx: Transaction | null) => {
    setEditing(tx);
    setFormOpen(true);
  };

  return (
    <View style={ui.screen}>
      <ScrollView contentContainerStyle={ui.content} keyboardShouldPersistTaps="handled">
        {/* Quick entry bar */}
        <QuickEntryBar onSave={saveTransaction} />

        {/* Month selector */}
        <View style={[ui.card, ui.row, { paddingVertical: 10 }]}>
          <Pressable
            onPress={() => setMonth(shiftMonth(month, -1))}
            hitSlop={12}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 4,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 4,
            }}
          >
            <Text style={{ fontSize: 13, color: colors.text, fontWeight: '600' }}>‹ Tháng trước</Text>
          </Pressable>

          <Text style={[ui.heading, { fontSize: 14 }]}>{formatMonth(month)}</Text>

          <Pressable
            onPress={() => setMonth(shiftMonth(month, 1))}
            hitSlop={12}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 4,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 4,
            }}
          >
            <Text style={{ fontSize: 13, color: colors.text, fontWeight: '600' }}>Tháng sau ›</Text>
          </Pressable>
        </View>

        {/* Month cash flow summary breakdown */}
        <View style={[ui.card, { flexDirection: 'row', paddingVertical: 10 }]}>
          <View style={{ flex: 1, borderRightWidth: 1, borderRightColor: colors.borderSubtle, paddingRight: 8 }}>
            <Text style={ui.label}>TỔNG THU</Text>
            <Text style={[ui.text, { color: colors.income, fontWeight: '700', marginTop: 2 }]}>
              +{formatVnd(summary.income)}
            </Text>
          </View>
          <View style={{ flex: 1, borderRightWidth: 1, borderRightColor: colors.borderSubtle, paddingHorizontal: 8 }}>
            <Text style={ui.label}>TỔNG CHI</Text>
            <Text style={[ui.text, { color: colors.expense, fontWeight: '700', marginTop: 2 }]}>
              -{formatVnd(summary.expense)}
            </Text>
          </View>
          <View style={{ flex: 1, paddingLeft: 8 }}>
            <Text style={ui.label}>CÒN LẠI</Text>
            <Text
              style={[
                ui.text,
                {
                  fontWeight: '700',
                  marginTop: 2,
                  color: summary.balance < 0 ? colors.expense : colors.text,
                },
              ]}
            >
              {formatVnd(summary.balance)}
            </Text>
          </View>
        </View>

        {/* Transaction log */}
        <View style={ui.card}>
          <View style={[ui.row, { paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: colors.borderSubtle }]}>
            <Text style={[ui.label, { fontWeight: '700' }]}>DANH SÁCH GIAO DỊCH</Text>
            <Text style={ui.label}>{items.length} mục</Text>
          </View>

          {items.length === 0 ? (
            <Text style={[ui.label, { paddingVertical: 14, textAlign: 'center' }]}>
              Chưa có giao dịch trong tháng này.
            </Text>
          ) : (
            items.map((t, idx) => {
              const category = getTransactionCategory(t.category);
              const isIncome = t.kind === 'income';
              return (
                <Pressable
                  key={t.id}
                  onPress={() => open(t)}
                  style={[
                    ui.row,
                    {
                      paddingVertical: 8,
                      borderTopWidth: idx > 0 ? 1 : 0,
                      borderTopColor: colors.borderSubtle,
                      gap: 8,
                    },
                  ]}
                >
                  <View style={[ui.dot, { backgroundColor: category.color }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={[ui.text, { fontWeight: '500' }]}>{t.note || category.label}</Text>
                    <Text style={ui.label}>
                      {category.label} · {t.date.slice(8, 10)}/{t.date.slice(5, 7)}
                    </Text>
                  </View>
                  <Text
                    style={[
                      ui.text,
                      {
                        fontWeight: '600',
                        color: isIncome ? colors.income : colors.expense,
                      },
                    ]}
                  >
                    {isIncome ? '+' : '-'}
                    {formatVnd(t.amount)}
                  </Text>
                </Pressable>
              );
            })
          )}
        </View>
      </ScrollView>

      <Pressable style={ui.fab} onPress={() => open(null)} accessibilityLabel="Thêm giao dịch">
        <Text style={ui.fabText}>+</Text>
      </Pressable>

      <TransactionForm
        visible={formOpen}
        transaction={editing}
        onClose={() => setFormOpen(false)}
        onSave={saveTransaction}
        onDelete={deleteTransaction}
      />
    </View>
  );
}
