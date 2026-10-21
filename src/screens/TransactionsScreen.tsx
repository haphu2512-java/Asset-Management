import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
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
      <ScrollView contentContainerStyle={ui.content}>
        <View style={[ui.card, ui.row]}>
          <Pressable onPress={() => setMonth(shiftMonth(month, -1))} hitSlop={12}>
            <Text style={[ui.heading, { color: colors.primary }]}>‹</Text>
          </Pressable>
          <Text style={ui.heading}>{formatMonth(month)}</Text>
          <Pressable onPress={() => setMonth(shiftMonth(month, 1))} hitSlop={12}>
            <Text style={[ui.heading, { color: colors.primary }]}>›</Text>
          </Pressable>
        </View>

        <View style={[ui.card, { flexDirection: 'row' }]}>
          <View style={{ flex: 1 }}>
            <Text style={ui.label}>Thu</Text>
            <Text style={[ui.text, { color: colors.income }]}>{formatVnd(summary.income)}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={ui.label}>Chi</Text>
            <Text style={[ui.text, { color: colors.expense }]}>{formatVnd(summary.expense)}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={ui.label}>Còn lại</Text>
            <Text style={ui.text}>{formatVnd(summary.balance)}</Text>
          </View>
        </View>

        <View style={ui.card}>
          {items.length === 0 ? (
            <Text style={ui.label}>Chưa có giao dịch trong tháng này. Bấm + để thêm.</Text>
          ) : (
            items.map((t) => {
              const category = getTransactionCategory(t.category);
              const isIncome = t.kind === 'income';
              return (
                <Pressable key={t.id} onPress={() => open(t)} style={[ui.row, { paddingVertical: 8, gap: 10 }]}>
                  <View style={[ui.dot, { backgroundColor: category.color }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={ui.text}>{t.note || category.label}</Text>
                    <Text style={ui.label}>
                      {category.label} · {t.date.slice(8, 10)}/{t.date.slice(5, 7)}
                    </Text>
                  </View>
                  <Text style={[ui.text, { color: isIncome ? colors.income : colors.expense }]}>
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
