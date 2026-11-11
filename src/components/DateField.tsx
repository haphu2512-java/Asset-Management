import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { formatDay, monthKey, shiftDay, shiftMonth, todayKey } from '../finance';
import { font, radius, space, TOUCH, useTheme } from '../theme';
import { Icon } from './Icon';
import { IconButton } from './ui';

const WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
const pad = (n: number) => String(n).padStart(2, '0');

/** Day keys of a month laid out in weeks that start on Monday; null pads the first and last week. */
export function monthGrid(month: string): (string | null)[][] {
  const [y, m] = month.split('-').map(Number);
  const days = new Date(y, m, 0).getDate();
  const lead = (new Date(y, m - 1, 1).getDay() + 6) % 7;
  const cells: (string | null)[] = [
    ...Array<null>(lead).fill(null),
    ...Array.from({ length: days }, (_, i) => `${month}-${pad(i + 1)}`),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, w) => cells.slice(w * 7, w * 7 + 7));
}

type Props = {
  /** "YYYY-MM-DD". */
  value: string;
  onChange: (date: string) => void;
  /** Show the "Hôm nay" / "Hôm qua" shortcuts (for dates in the past, like transactions). */
  shortcuts?: boolean;
  accessibilityLabel?: string;
};

/** Shows the chosen day and opens a month calendar to pick another; no typing of dates. */
export function DateField({ value, onChange, shortcuts, accessibilityLabel = 'Ngày' }: Props) {
  const { colors, ui } = useTheme();
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(monthKey(value));
  const today = todayKey();
  const yesterday = shiftDay(today, -1);

  const pick = (date: string) => {
    onChange(date);
    setMonth(monthKey(date));
    setOpen(false);
  };

  const [year, monthNumber] = month.split('-').map(Number);

  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <Pressable
          onPress={() => {
            setMonth(monthKey(value));
            setOpen((o) => !o);
          }}
          accessibilityRole="button"
          accessibilityLabel={`${accessibilityLabel}: ${formatDay(value)}. Chạm để đổi`}
          accessibilityState={{ expanded: open }}
          style={[ui.input, { flex: 1, minWidth: 180, flexDirection: 'row', alignItems: 'center', gap: 8 }]}
        >
          <Icon name="calendar" size={16} color={colors.primary} />
          <Text style={{ flex: 1, fontSize: font.bodyLarge, color: colors.text }}>{formatDay(value)}</Text>
          <Icon name={open ? 'arrow-up' : 'arrow-down'} size={14} color={colors.muted} />
        </Pressable>
        {shortcuts
          ? [
              { label: 'Hôm nay', date: today },
              { label: 'Hôm qua', date: yesterday },
            ].map((s) => {
              const selected = value === s.date;
              return (
                <Pressable
                  key={s.label}
                  onPress={() => pick(s.date)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={s.label}
                  style={[
                    ui.chip,
                    { justifyContent: 'center', minHeight: TOUCH },
                    selected && { backgroundColor: colors.primaryLight, borderColor: colors.primary },
                  ]}
                >
                  <Text style={{ fontSize: font.body, fontWeight: '600', color: selected ? colors.primary : colors.text }}>
                    {s.label}
                  </Text>
                </Pressable>
              );
            })
          : null}
      </View>

      {open ? (
        <View
          style={{
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: radius.md,
            padding: space.sm,
            backgroundColor: colors.surfaceAlt,
          }}
        >
          <View style={[ui.row, { marginBottom: 4 }]}>
            <IconButton icon="chevron-left" label="Tháng trước" onPress={() => setMonth(shiftMonth(month, -1))} color={colors.text} />
            <Text style={{ fontSize: font.bodyLarge, fontWeight: '700', color: colors.text }} accessibilityRole="header">
              Tháng {monthNumber}/{year}
            </Text>
            <IconButton icon="chevron-right" label="Tháng sau" onPress={() => setMonth(shiftMonth(month, 1))} color={colors.text} />
          </View>
          <View style={{ flexDirection: 'row' }}>
            {WEEKDAYS.map((d) => (
              <Text key={d} style={{ flex: 1, textAlign: 'center', fontSize: font.caption, color: colors.muted, fontWeight: '600' }}>
                {d}
              </Text>
            ))}
          </View>
          {monthGrid(month).map((week, w) => (
            <View key={w} style={{ flexDirection: 'row' }}>
              {week.map((day, i) => {
                if (!day) return <View key={i} style={{ flex: 1, height: 42 }} />;
                const selected = day === value;
                const isToday = day === today;
                return (
                  <Pressable
                    key={day}
                    onPress={() => pick(day)}
                    accessibilityRole="button"
                    accessibilityLabel={formatDay(day)}
                    accessibilityState={{ selected }}
                    style={{ flex: 1, height: 42, alignItems: 'center', justifyContent: 'center' }}
                  >
                    <View
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 18,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: selected ? colors.primary : 'transparent',
                        borderWidth: isToday && !selected ? 1.5 : 0,
                        borderColor: colors.primary,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: font.body,
                          fontWeight: selected || isToday ? '700' : '400',
                          color: selected ? colors.onPrimary : colors.text,
                        }}
                      >
                        {Number(day.slice(8))}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}
