import { Text, View } from 'react-native';
import { formatChange, type Change } from '../finance';
import { usePrefs } from '../prefs';
import { font, useTheme } from '../theme';
import { Icon } from './Icon';

type Props = {
  /** null when there is nothing to compare with yet: shown as a neutral note. */
  change: Change | null;
  /** e.g. "so với hôm qua"; omitted on compact rows. */
  label?: string;
  /** For debts a rise is bad news, so the colours swap. */
  inverse?: boolean;
  /** Text shown when there is nothing to compare with. */
  emptyText?: string;
};

/** Green up arrow when value rises, red down arrow when it falls, grey when flat or unknown. */
export function ChangeBadge({ change, label, inverse = false, emptyText = 'Chưa có dữ liệu hôm qua để so sánh' }: Props) {
  const { colors } = useTheme();
  const { prefs } = usePrefs();
  const fontSize = font.caption;
  if (!change) {
    return <Text style={{ fontSize, color: colors.muted }}>{emptyText}</Text>;
  }

  const good = inverse ? change.direction === 'down' : change.direction === 'up';
  const color = change.direction === 'flat' ? colors.muted : good ? colors.income : colors.expense;
  const background = change.direction === 'flat' ? colors.borderSubtle : good ? colors.incomeSoft : colors.expenseSoft;
  const icon = change.direction === 'up' ? 'arrow-up' : change.direction === 'down' ? 'arrow-down' : 'minus';
  // With balances hidden only the percentage is shown.
  const percent =
    change.percent === null ? '' : `${change.amount > 0 ? '+' : change.amount < 0 ? '-' : ''}${Math.abs(change.percent).toFixed(2).replace('.', ',')}%`;
  const text = prefs.hideBalance ? percent || '•••' : formatChange(change);
  const spoken = change.direction === 'up' ? 'Tăng' : change.direction === 'down' ? 'Giảm' : 'Không đổi';

  return (
    <View
      style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}
      accessible
      accessibilityLabel={`${spoken} ${text.replace(/^[+-]/, '')} ${label ?? ''}`}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 3,
          backgroundColor: background,
          paddingHorizontal: 7,
          paddingVertical: 2,
          borderRadius: 10,
        }}
      >
        <Icon name={icon} size={fontSize} color={color} strokeWidth={2.5} />
        <Text style={{ fontSize, fontWeight: '700', color }}>{text}</Text>
      </View>
      {label ? <Text style={{ fontSize, color: colors.muted }}>{label}</Text> : null}
    </View>
  );
}
