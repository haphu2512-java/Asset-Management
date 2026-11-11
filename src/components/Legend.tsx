import { Pressable, Text, View } from 'react-native';
import { font, useMoney, useTheme } from '../theme';

type Item = { id?: string; label: string; color: string; amount: number };

/** Colour key for a chart: label, share of the total and amount. Rows open a detail when `onPress` is given. */
export function Legend({ items, total, onPress }: { items: Item[]; total: number; onPress?: (id: string) => void }) {
  const { colors, ui, tone } = useTheme();
  const format = useMoney();
  return (
    <View style={{ flex: 1, gap: 2 }}>
      {items.map((item) => {
        const percent = total > 0 ? Math.round((item.amount / total) * 100) : 0;
        const row = (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 30 }}>
            <View style={[ui.dot, { backgroundColor: tone(item.color) }]} />
            <Text style={{ flex: 1, fontSize: font.body, color: colors.text }} numberOfLines={1}>
              {item.label}
              <Text style={{ color: colors.muted }}>{total > 0 ? `  ${percent}%` : ''}</Text>
            </Text>
            <Text style={{ fontSize: font.body, fontWeight: '600', color: colors.text }}>{format(item.amount)}</Text>
          </View>
        );
        return onPress && item.id ? (
          <Pressable
            key={item.label}
            onPress={() => onPress(item.id!)}
            accessibilityRole="button"
            accessibilityLabel={`${item.label}, ${percent} phần trăm, ${format(item.amount)}`}
          >
            {row}
          </Pressable>
        ) : (
          <View key={item.label} accessible accessibilityLabel={`${item.label}, ${percent} phần trăm, ${format(item.amount)}`}>
            {row}
          </View>
        );
      })}
    </View>
  );
}
