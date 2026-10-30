import { Text, View } from 'react-native';
import { formatChange, type Change } from '../finance';
import { colors } from '../theme';
import { Icon } from './Icon';

type Props = {
  /** null when there is nothing to compare with yet: shown as a neutral note. */
  change: Change | null;
  /** e.g. "so với hôm qua"; omitted on compact rows. */
  label?: string;
  /** For debts a rise is bad news, so the colours swap. */
  inverse?: boolean;
  size?: 'small' | 'regular';
};

/** Green up arrow when value rises, red down arrow when it falls, grey when flat or unknown. */
export function ChangeBadge({ change, label, inverse = false, size = 'regular' }: Props) {
  const fontSize = size === 'small' ? 11 : 12;
  if (!change) {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <Icon name="minus" size={fontSize} color={colors.muted} />
        <Text style={{ fontSize, color: colors.muted }}>Chưa có dữ liệu hôm qua để so sánh</Text>
      </View>
    );
  }

  const good = inverse ? change.direction === 'down' : change.direction === 'up';
  const color = change.direction === 'flat' ? colors.muted : good ? colors.income : colors.expense;
  const background =
    change.direction === 'flat' ? colors.borderSubtle : good ? '#DCFCE7' : '#FEE2E2';
  const icon = change.direction === 'up' ? 'arrow-up' : change.direction === 'down' ? 'arrow-down' : 'minus';

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 3,
          backgroundColor: background,
          paddingHorizontal: size === 'small' ? 5 : 7,
          paddingVertical: size === 'small' ? 1 : 2,
          borderRadius: 10,
        }}
      >
        <Icon name={icon} size={fontSize} color={color} strokeWidth={2.5} />
        <Text style={{ fontSize, fontWeight: '700', color }}>{formatChange(change)}</Text>
      </View>
      {label ? <Text style={{ fontSize, color: colors.muted }}>{label}</Text> : null}
    </View>
  );
}
