import type { ReactNode } from 'react';
import { Modal, Platform, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { confirm } from '../confirm';
import { font, radius, space, useTheme } from '../theme';
import { Icon, getCategoryIcon, type IconName } from './Icon';
import { KeyboardAwareScrollView } from './Keyboard';
import { Button, IconButton } from './ui';

type Props = {
  visible: boolean;
  title: string;
  onClose: () => void;
  /** Omit for sheets that only show information. */
  onSave?: () => void;
  saveLabel?: string;
  onDelete?: () => void;
  /** Ask before deleting; leave off when the caller offers an undo instead. */
  confirmDelete?: string;
  deleteLabel?: string;
  error?: string;
  children: ReactNode;
};

/** Bottom sheet used by the add/edit forms. */
export function Sheet({
  visible,
  title,
  onClose,
  onSave,
  saveLabel = 'Lưu',
  onDelete,
  confirmDelete,
  deleteLabel = 'Xoá',
  error,
  children,
}: Props) {
  const { colors, ui } = useTheme();
  const insets = useSafeAreaInsets();
  // Ensure enough bottom clearance for system navigation bar (3-button / gesture bar) or notch / home indicator.
  const bottomInset = Platform.OS === 'android' ? Math.max(insets.bottom, 44) : insets.bottom;

  const remove = () => {
    if (!onDelete) return;
    if (!confirmDelete) return onDelete();
    confirm({ title: `${deleteLabel}?`, message: confirmDelete, confirmLabel: deleteLabel, destructive: true, onConfirm: onDelete });
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay }}>
        <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel="Đóng" accessibilityRole="button" />
        <View
          accessibilityViewIsModal
          style={{
            backgroundColor: colors.card,
            borderTopLeftRadius: radius.lg,
            borderTopRightRadius: radius.lg,
            maxHeight: '92%',
          }}
        >
          <View style={[ui.row, { paddingLeft: space.lg, paddingRight: 6, paddingTop: 6 }]}>
            <Text style={ui.title} accessibilityRole="header">
              {title}
            </Text>
            <IconButton icon="close" label="Đóng" onPress={onClose} />
          </View>
          <KeyboardAwareScrollView
            contentContainerStyle={{ padding: space.lg, paddingTop: space.sm, paddingBottom: 16 + bottomInset, gap: space.md }}
          >
            {children}

            {error ? (
              <Text accessibilityRole="alert" style={{ color: colors.expense, fontSize: font.body }}>
                {error}
              </Text>
            ) : null}

            {onSave ? <Button label={saveLabel} icon="check" onPress={onSave} /> : null}
            {onDelete ? <Button label={deleteLabel} icon="trash" variant="danger" onPress={remove} /> : null}
          </KeyboardAwareScrollView>
        </View>
      </View>
    </Modal>
  );
}

export function Field({
  label,
  icon,
  hint,
  children,
}: {
  label: string;
  icon?: IconName;
  hint?: string;
  children: ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        {icon ? <Icon name={icon} size={14} color={colors.muted} /> : null}
        <Text style={{ fontSize: font.body, fontWeight: '600', color: colors.text }}>{label}</Text>
      </View>
      {children}
      {hint ? <Text style={{ fontSize: font.caption, color: colors.muted, lineHeight: 17 }}>{hint}</Text> : null}
    </View>
  );
}

export type ChipOption = {
  id: string;
  label: string;
  color?: string;
  /** Icon name; `null` shows no icon. Defaults to the icon for the id. */
  icon?: string | null;
};

export function Chips({
  options,
  value,
  onChange,
  showIcons = true,
}: {
  options: ChipOption[];
  value: string;
  onChange: (id: string) => void;
  showIcons?: boolean;
}) {
  const { colors, ui, tone } = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }} accessibilityRole="radiogroup">
      {options.map((o) => {
        const selected = o.id === value;
        const iconName = !showIcons || o.icon === null ? undefined : getCategoryIcon(o.icon ?? o.id);
        return (
          <Pressable
            key={o.id}
            onPress={() => onChange(o.id)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={o.label}
            style={[
              ui.chip,
              { flexDirection: 'row', alignItems: 'center', gap: 6 },
              selected && { backgroundColor: colors.primary, borderColor: colors.primary },
            ]}
          >
            {iconName ? (
              <Icon
                name={iconName}
                size={15}
                color={selected ? colors.onPrimary : o.color ? tone(o.color) : colors.muted}
                strokeWidth={2.2}
              />
            ) : null}
            <Text
              style={{
                fontSize: font.body,
                fontWeight: selected ? '700' : '500',
                color: selected ? colors.onPrimary : colors.text,
              }}
            >
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
