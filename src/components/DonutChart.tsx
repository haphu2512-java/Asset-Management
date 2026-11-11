import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useTheme } from '../theme';

type Slice = { value: number; color: string };

/** A ring chart; each slice's arc is proportional to its value. */
export function DonutChart({ slices, size = 132 }: { slices: Slice[]; size?: number }) {
  const { colors, tone } = useTheme();
  const stroke = size * 0.17;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const visible = slices.filter((s) => s.value > 0);
  const total = visible.reduce((s, x) => s + x.value, 0);
  // A thin gap between slices keeps neighbours apart even when their colours are close.
  const gap = visible.length > 1 ? 2 : 0;
  let offset = 0;

  return (
    <View style={{ width: size, height: size }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={radius} stroke={colors.borderSubtle} strokeWidth={stroke} fill="none" />
        {total > 0 &&
          visible.map((slice, i) => {
            const length = (slice.value / total) * circumference;
            const drawn = Math.max(1, length - gap);
            const circle = (
              <Circle
                key={i}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                stroke={tone(slice.color)}
                strokeWidth={stroke}
                fill="none"
                strokeDasharray={`${drawn} ${circumference - drawn}`}
                strokeDashoffset={-offset}
              />
            );
            offset += length;
            return circle;
          })}
      </Svg>
    </View>
  );
}
