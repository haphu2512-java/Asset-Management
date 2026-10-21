import { Text, View } from 'react-native';
import { formatVnd } from '../finance';
import { ui } from '../theme';

type Item = { label: string; color: string; amount: number };

export function Legend({ items, total }: { items: Item[]; total: number }) {
  return (
    <View style={{ flex: 1, gap: 6 }}>
      {items.map((item) => (
        <View key={item.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={[ui.dot, { backgroundColor: item.color }]} />
          <View style={{ flex: 1 }}>
            <Text style={ui.text} numberOfLines={1}>
              {item.label}
              {total > 0 ? ` · ${Math.round((item.amount / total) * 100)}%` : ''}
            </Text>
            <Text style={ui.label}>{formatVnd(item.amount)}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}
