import { Text, View } from 'react-native';
import { formatVnd } from '../finance';
import { ui } from '../theme';

type Item = { label: string; color: string; amount: number };

export function Legend({ items, total }: { items: Item[]; total: number }) {
  return (
    <View style={{ flex: 1, gap: 4 }}>
      {items.map((item) => (
        <View key={item.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={[ui.dot, { backgroundColor: item.color }]} />
          <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={[ui.text, { fontSize: 13 }]} numberOfLines={1}>
              {item.label}
              {total > 0 ? ` (${Math.round((item.amount / total) * 100)}%)` : ''}
            </Text>
            <Text style={[ui.text, { fontSize: 13, fontWeight: '600' }]}>{formatVnd(item.amount)}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}
