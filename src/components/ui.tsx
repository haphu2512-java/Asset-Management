import { type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  Switch,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { parseVndExpression } from '../finance';
import { font, radius, space, TOUCH, useMoney, useTheme } from '../theme';
import { Icon, type IconName } from './Icon';

type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  /** Compact buttons sit inside cards and rows. */
  small?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  loading,
  disabled,
  small,
  style,
  accessibilityLabel,
}: ButtonProps) {
  const { colors } = useTheme();
  const filled = variant === 'primary';
  const foreground = filled ? colors.onPrimary : variant === 'danger' ? colors.expense : variant === 'ghost' ? colors.primary : colors.text;
  const inactive = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      hitSlop={small ? 6 : 0}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          minHeight: small ? 36 : TOUCH + 2,
          paddingHorizontal: small ? space.md : space.lg,
          paddingVertical: small ? 6 : 10,
          borderRadius: radius.sm,
          backgroundColor: filled ? colors.primary : 'transparent',
          borderWidth: variant === 'secondary' || variant === 'danger' ? 1 : 0,
          borderColor: variant === 'danger' ? colors.expense : colors.border,
          opacity: inactive ? 0.55 : pressed ? 0.8 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={foreground} />
      ) : icon ? (
        <Icon name={icon} size={small ? 15 : 17} color={foreground} strokeWidth={2.2} />
      ) : null}
      <Text style={{ color: foreground, fontSize: small ? font.body : font.bodyLarge, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}

/** A round icon-only button; always needs a label for screen readers. */
export function IconButton({
  icon,
  label,
  onPress,
  color,
  size = 20,
  filled,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  color?: string;
  size?: number;
  filled?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      style={({ pressed }) => ({
        width: TOUCH,
        height: TOUCH,
        borderRadius: TOUCH / 2,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: filled ? colors.surfaceAlt : 'transparent',
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <Icon name={icon} size={size} color={color ?? colors.muted} />
    </Pressable>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { ui } = useTheme();
  return <View style={[ui.card, style]}>{children}</View>;
}

/** Card heading with an optional icon and a trailing action or note. */
export function CardHeader({ title, icon, right }: { title: string; icon?: IconName; right?: ReactNode }) {
  const { colors, ui } = useTheme();
  return (
    <View style={ui.row}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
        {icon ? <Icon name={icon} size={18} color={colors.primary} /> : null}
        <Text style={ui.heading} accessibilityRole="header">
          {title}
        </Text>
      </View>
      {right}
    </View>
  );
}

/** A small text link, e.g. "Xem tất cả". */
export function LinkText({ label, onPress }: { label: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} hitSlop={10} accessibilityRole="button" accessibilityLabel={label}>
      <Text style={{ color: colors.primary, fontSize: font.body, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}

export function Input(props: TextInputProps) {
  const { colors, ui } = useTheme();
  return <TextInput placeholderTextColor={colors.muted} {...props} style={[ui.input, props.style]} />;
}

const AMOUNT_KEYS = ['000', 'k', 'tr', '+', '-'];

/**
 * Amount field with one-tap helpers for thousands and millions and simple sums ("35k+20k").
 * Shows what the text adds up to while typing.
 */
export function AmountInput({
  value,
  onChangeText,
  placeholder = '50.000 hoặc 50k',
  autoFocus,
  accessibilityLabel = 'Số tiền',
}: {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  accessibilityLabel?: string;
}) {
  const { colors, ui } = useTheme();
  const format = useMoney();
  const parsed = parseVndExpression(value);
  const showPreview = value.trim() !== '' && /[^\d.,\s]/.test(value);
  return (
    <View style={{ gap: 6 }}>
      <TextInput
        placeholderTextColor={colors.muted}
        style={[ui.input, { fontSize: font.title, fontWeight: '600' }]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        keyboardType="numbers-and-punctuation"
        autoCapitalize="none"
        autoCorrect={false}
        autoFocus={autoFocus}
        accessibilityLabel={accessibilityLabel}
      />
      <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        {AMOUNT_KEYS.map((key) => (
          <Pressable
            key={key}
            onPress={() => onChangeText(value + key)}
            accessibilityRole="button"
            accessibilityLabel={key === '+' ? 'Cộng' : key === '-' ? 'Trừ' : `Thêm ${key}`}
            hitSlop={4}
            style={({ pressed }) => ({
              minWidth: 44,
              minHeight: 36,
              paddingHorizontal: 10,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: radius.sm,
              backgroundColor: colors.surfaceAlt,
              borderWidth: 1,
              borderColor: colors.border,
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <Text style={{ color: colors.text, fontSize: font.body, fontWeight: '600' }}>{key === '-' ? '−' : key}</Text>
          </Pressable>
        ))}
        {showPreview ? (
          <Text
            style={{ marginLeft: 'auto', fontSize: font.body, fontWeight: '700', color: parsed ? colors.primary : colors.muted }}
          >
            {parsed ? `= ${format(parsed)}` : '…'}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

/** A coloured round badge holding a category icon. */
export function CategoryBadge({
  icon,
  color,
  size = 36,
}: {
  icon: IconName;
  color: string;
  size?: number;
}) {
  const { tone } = useTheme();
  const c = tone(color);
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: `${c}26`,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Icon name={icon} size={Math.round(size * 0.5)} color={c} strokeWidth={2.2} />
    </View>
  );
}

/** One line of a list: leading badge, title + subtitle, trailing value. The whole row is tappable. */
export function ListItem({
  leading,
  title,
  subtitle,
  right,
  rightSub,
  rightColor,
  onPress,
  accessibilityLabel,
  chevron,
}: {
  leading?: ReactNode;
  title: string;
  subtitle?: string;
  right?: string;
  rightSub?: ReactNode;
  rightColor?: string;
  onPress?: () => void;
  accessibilityLabel?: string;
  chevron?: boolean;
}) {
  const { colors } = useTheme();
  const body = (
    <>
      {leading}
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontSize: font.body, fontWeight: '600', color: colors.text }} numberOfLines={2}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={{ fontSize: font.caption, color: colors.muted }} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right || rightSub ? (
        <View style={{ alignItems: 'flex-end', gap: 2, maxWidth: '50%' }}>
          {right ? (
            <Text style={{ fontSize: font.body, fontWeight: '700', color: rightColor ?? colors.text }}>{right}</Text>
          ) : null}
          {typeof rightSub === 'string' ? (
            <Text style={{ fontSize: font.caption, color: colors.muted }}>{rightSub}</Text>
          ) : (
            rightSub
          )}
        </View>
      ) : null}
      {chevron ? <Icon name="chevron-right" size={16} color={colors.muted} /> : null}
    </>
  );
  const style = { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: TOUCH + 4, paddingVertical: 6 } as const;
  if (!onPress) return <View style={style}>{body}</View>;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? [title, subtitle, right].filter(Boolean).join(', ')}
      style={({ pressed }) => [style, { opacity: pressed ? 0.6 : 1 }]}
    >
      {body}
    </Pressable>
  );
}

/** What an empty screen shows: what belongs here and the button that adds the first item. */
export function EmptyState({
  icon,
  title,
  message,
  actionLabel,
  onAction,
}: {
  icon: IconName;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ alignItems: 'center', paddingVertical: space.xl, paddingHorizontal: space.lg, gap: space.sm }}>
      <View
        style={{
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: colors.primaryLight,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name={icon} size={26} color={colors.primary} />
      </View>
      <Text style={{ fontSize: font.bodyLarge, fontWeight: '700', color: colors.text, textAlign: 'center' }}>{title}</Text>
      <Text style={{ fontSize: font.body, color: colors.muted, textAlign: 'center', lineHeight: 20 }}>{message}</Text>
      {actionLabel && onAction ? (
        <Button label={actionLabel} onPress={onAction} icon="plus" style={{ marginTop: space.sm, alignSelf: 'center' }} />
      ) : null}
    </View>
  );
}

export function ProgressBar({
  ratio,
  color,
  height = 8,
  label,
}: {
  /** 0..1; values above 1 fill the bar. */
  ratio: number;
  color?: string;
  height?: number;
  label?: string;
}) {
  const { colors } = useTheme();
  const clamped = Math.max(0, Math.min(1, ratio));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
      style={{ height, borderRadius: height / 2, backgroundColor: colors.borderSubtle, overflow: 'hidden' }}
    >
      <View style={{ width: `${clamped * 100}%`, height, borderRadius: height / 2, backgroundColor: color ?? colors.primary }} />
    </View>
  );
}

/** Two to four mutually exclusive options shown side by side. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { id: T; label: string; icon?: IconName }[];
  value: T;
  onChange: (id: T) => void;
}) {
  const { colors } = useTheme();
  return (
    <View
      accessibilityRole="tablist"
      style={{
        flexDirection: 'row',
        backgroundColor: colors.surfaceAlt,
        padding: 4,
        borderRadius: radius.sm,
        borderWidth: 1,
        borderColor: colors.border,
        gap: 4,
      }}
    >
      {options.map((o) => {
        const selected = o.id === value;
        return (
          <Pressable
            key={o.id}
            onPress={() => onChange(o.id)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={o.label}
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              minHeight: 38,
              paddingHorizontal: 6,
              borderRadius: radius.sm - 2,
              backgroundColor: selected ? colors.primary : 'transparent',
            }}
          >
            {o.icon ? <Icon name={o.icon} size={15} color={selected ? colors.onPrimary : colors.muted} /> : null}
            <Text
              style={{ fontSize: font.body, fontWeight: selected ? '700' : '500', color: selected ? colors.onPrimary : colors.text }}
              numberOfLines={1}
            >
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** A coloured note inside a screen: info, warning or error. */
export function Banner({
  tone = 'info',
  children,
  onPress,
  icon,
}: {
  tone?: 'info' | 'warning' | 'danger' | 'success';
  children: ReactNode;
  onPress?: () => void;
  icon?: IconName;
}) {
  const { colors } = useTheme();
  const [fg, bg] =
    tone === 'danger'
      ? [colors.expense, colors.expenseSoft]
      : tone === 'warning'
        ? [colors.warning, colors.warningSoft]
        : tone === 'success'
          ? [colors.income, colors.incomeSoft]
          : [colors.primary, colors.primaryLight];
  const content = (
    <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start', padding: space.md, borderRadius: radius.sm, backgroundColor: bg }}>
      <Icon name={icon ?? (tone === 'info' ? 'info' : tone === 'success' ? 'check' : 'alert')} size={16} color={fg} style={{ marginTop: 2 }} />
      <Text style={{ flex: 1, fontSize: font.body, color: fg, lineHeight: 20 }}>{children}</Text>
    </View>
  );
  return onPress ? (
    <Pressable onPress={onPress} accessibilityRole="button">
      {content}
    </Pressable>
  ) : (
    <View accessibilityRole="alert">{content}</View>
  );
}

/** A settings row with a switch. */
export function ToggleRow({
  title,
  subtitle,
  value,
  onChange,
  icon,
}: {
  title: string;
  subtitle?: string;
  value: boolean;
  onChange: (value: boolean) => void;
  icon?: IconName;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: TOUCH + 8, paddingVertical: 4 }}>
      {icon ? <Icon name={icon} size={20} color={colors.muted} /> : null}
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontSize: font.body, fontWeight: '600', color: colors.text }}>{title}</Text>
        {subtitle ? <Text style={{ fontSize: font.caption, color: colors.muted, lineHeight: 17 }}>{subtitle}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        accessibilityLabel={title}
        trackColor={{ true: colors.primary, false: colors.border }}
      />
    </View>
  );
}

/** A settings row that opens something. */
export function NavRow({
  title,
  subtitle,
  icon,
  onPress,
  value,
  danger,
}: {
  title: string;
  subtitle?: string;
  icon: IconName;
  onPress: () => void;
  value?: string;
  danger?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={[title, value].filter(Boolean).join(', ')}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
        minHeight: TOUCH + 8,
        paddingVertical: 4,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <Icon name={icon} size={20} color={danger ? colors.expense : colors.muted} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontSize: font.body, fontWeight: '600', color: danger ? colors.expense : colors.text }}>{title}</Text>
        {subtitle ? <Text style={{ fontSize: font.caption, color: colors.muted, lineHeight: 17 }}>{subtitle}</Text> : null}
      </View>
      {value ? <Text style={{ fontSize: font.body, color: colors.muted }}>{value}</Text> : null}
      <Icon name="chevron-right" size={16} color={colors.muted} />
    </Pressable>
  );
}

/** Amount text that follows the "hide balances" setting. */
export function Money({ amount, style, sign }: { amount: number; style?: StyleProp<TextStyle>; sign?: boolean }) {
  const format = useMoney();
  const prefix = sign && amount > 0 ? '+' : '';
  return <Text style={style}>{prefix + format(amount)}</Text>;
}

export function Divider() {
  const { ui } = useTheme();
  return <View style={ui.divider} />;
}
