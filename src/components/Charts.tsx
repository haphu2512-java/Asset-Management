import { useState } from 'react';
import { Text, View } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { formatCompact, type SeriesPoint } from '../reports';
import { font, useTheme } from '../theme';

const dayLabel = (date: string) => {
  const [, m, d] = date.split('-');
  return `${Number(d)}/${Number(m)}`;
};

/** Line chart of a value over time, with min / max guides and the first and last dates. */
export function LineChart({ points, height = 150, hidden }: { points: SeriesPoint[]; height?: number; hidden?: boolean }) {
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);
  if (points.length < 2) return null;

  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || Math.max(1, Math.abs(max)) * 0.1;
  const padX = 6;
  const padY = 10;
  const x = (i: number) => padX + (i / (points.length - 1)) * (width - padX * 2);
  const y = (v: number) => padY + (1 - (v - min) / span) * (height - padY * 2);
  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)} ${y(p.value).toFixed(1)}`).join(' ');
  const area = `${line} L${x(points.length - 1).toFixed(1)} ${height} L${x(0).toFixed(1)} ${height} Z`;
  const last = points[points.length - 1];
  const rising = last.value >= points[0].value;
  const stroke = rising ? colors.income : colors.expense;

  return (
    <View
      accessible
      accessibilityLabel={`Biểu đồ từ ${dayLabel(points[0].date)} đến ${dayLabel(last.date)}, ${rising ? 'tăng' : 'giảm'}`}
    >
      {hidden ? null : (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ fontSize: font.caption, color: colors.muted }}>Cao nhất {formatCompact(max)}</Text>
          <Text style={{ fontSize: font.caption, color: colors.muted }}>Thấp nhất {formatCompact(min)}</Text>
        </View>
      )}
      <View style={{ height }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {width > 0 ? (
          <Svg width={width} height={height}>
            <Line x1={0} y1={padY} x2={width} y2={padY} stroke={colors.borderSubtle} strokeWidth={1} />
            <Line x1={0} y1={height - padY} x2={width} y2={height - padY} stroke={colors.borderSubtle} strokeWidth={1} />
            <Path d={area} fill={stroke} opacity={0.12} />
            <Path d={line} stroke={stroke} strokeWidth={2.5} fill="none" strokeLinejoin="round" strokeLinecap="round" />
            <Circle cx={x(points.length - 1)} cy={y(last.value)} r={4} fill={stroke} />
          </Svg>
        ) : null}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ fontSize: font.caption, color: colors.muted }}>{dayLabel(points[0].date)}</Text>
        <Text style={{ fontSize: font.caption, color: colors.muted }}>{dayLabel(last.date)}</Text>
      </View>
    </View>
  );
}

/** Twelve pairs of bars: income and expense for each month of a year. */
export function MonthlyBars({
  months,
  height = 120,
}: {
  months: { month: string; income: number; expense: number }[];
  height?: number;
}) {
  const { colors } = useTheme();
  const max = Math.max(1, ...months.flatMap((m) => [m.income, m.expense]));
  return (
    <View accessible accessibilityLabel="Biểu đồ thu chi theo từng tháng">
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', height, gap: 4 }}>
        {months.map((m) => (
          <View key={m.month} style={{ flex: 1, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 1 }}>
            <View style={{ flex: 1, height: Math.max(m.income > 0 ? 2 : 0, (m.income / max) * height), backgroundColor: colors.income, borderRadius: 2 }} />
            <View style={{ flex: 1, height: Math.max(m.expense > 0 ? 2 : 0, (m.expense / max) * height), backgroundColor: colors.expense, borderRadius: 2 }} />
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: 4, marginTop: 4 }}>
        {months.map((m) => (
          <Text key={m.month} style={{ flex: 1, textAlign: 'center', fontSize: font.caption, color: colors.muted }}>
            {Number(m.month.slice(5))}
          </Text>
        ))}
      </View>
    </View>
  );
}
