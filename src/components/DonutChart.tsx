import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { colors } from '../theme';

type Slice = { value: number; color: string };

/** A ring chart; each slice's arc is proportional to its value. */
export function DonutChart({ slices, size = 140 }: { slices: Slice[]; size?: number }) {
  const stroke = size * 0.16;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = slices.reduce((s, x) => s + x.value, 0);
  let offset = 0;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={colors.border}
          strokeWidth={stroke}
          fill="none"
        />
        {total > 0 &&
          slices
            .filter((s) => s.value > 0)
            .map((slice, i) => {
              const length = (slice.value / total) * circumference;
              const circle = (
                <Circle
                  key={i}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  stroke={slice.color}
                  strokeWidth={stroke}
                  fill="none"
                  strokeDasharray={`${length} ${circumference - length}`}
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
