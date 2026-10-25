import type { ReactNode } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, ui } from '../theme';
import { Icon, getCategoryIcon, type IconName } from './Icon';

type Props = {
  visible: boolean;
  title: string;
  onClose: () => void;
  onSave: () => void;
  onDelete?: () => void;
  error?: string;
  children: ReactNode;
};

/** Bottom sheet used by the add/edit forms. */
export function Sheet({ visible, title, onClose, onSave, onDelete, error, children }: Props) {
  const insets = useSafeAreaInsets();
  // Ensure enough bottom clearance for system navigation bar (3-button / gesture bar) or notch / home indicator.
  const bottomInset = Platform.OS === 'android'
    ? Math.max(insets.bottom, 44)
    : insets.bottom;
  const paddingBottom = 16 + bottomInset;

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15, 23, 42, 0.45)' }}
      >
        <View
          style={{
            backgroundColor: colors.card,
            borderTopLeftRadius: 8,
            borderTopRightRadius: 8,
            borderTopWidth: 1,
            borderTopColor: colors.border,
            maxHeight: '90%',
          }}
        >
          <ScrollView
            contentContainerStyle={{ padding: 16, paddingBottom, gap: 12 }}
            keyboardShouldPersistTaps="handled"
          >
            <View style={[ui.row, { paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: colors.borderSubtle }]}>
              <Text style={ui.heading}>{title}</Text>
              <Pressable
                onPress={onClose}
                hitSlop={12}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                  borderRadius: 4,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Icon name="close" size={12} color={colors.muted} />
                <Text style={{ fontSize: 12, color: colors.muted }}>Đóng</Text>
              </Pressable>
            </View>

            {children}

            {error ? <Text style={{ color: colors.expense, fontSize: 13 }}>{error}</Text> : null}

            <Pressable
              style={[ui.button, { flexDirection: 'row', gap: 6, alignItems: 'center' }]}
              onPress={onSave}
            >
              <Icon name="check" size={15} color="#FFFFFF" strokeWidth={2.5} />
              <Text style={ui.buttonText}>Lưu thay đổi</Text>
            </Pressable>

            {onDelete ? (
              <Pressable
                onPress={() =>
                  Alert.alert('Xoá mục này?', 'Dữ liệu đã xoá không thể khôi phục.', [
                    { text: 'Huỷ', style: 'cancel' },
                    { text: 'Xoá', style: 'destructive', onPress: onDelete },
                  ])
                }
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 5,
                  paddingVertical: 8,
                  marginTop: -4,
                }}
              >
                <Icon name="trash" size={13} color={colors.expense} />
                <Text style={{ color: colors.expense, fontSize: 13, fontWeight: '500' }}>Xoá mục này</Text>
              </Pressable>
            ) : null}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function Field({
  label,
  icon,
  children,
}: {
  label: string;
  icon?: IconName;
  children: ReactNode;
}) {
  return (
    <View style={{ gap: 4 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
        {icon ? <Icon name={icon} size={12} color={colors.muted} /> : null}
        <Text style={ui.label}>{label}</Text>
      </View>
      {children}
    </View>
  );
}

export type ChipOption = {
  id: string;
  label: string;
  color?: string;
  icon?: IconName;
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
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
      {options.map((o) => {
        const selected = o.id === value;
        const iconName = o.icon || (showIcons ? getCategoryIcon(o.id) : undefined);
        return (
          <Pressable
            key={o.id}
            onPress={() => onChange(o.id)}
            style={[
              ui.chip,
              { flexDirection: 'row', alignItems: 'center', gap: 5 },
              selected
                ? { backgroundColor: colors.primary, borderColor: colors.primary }
                : { backgroundColor: '#FFFFFF', borderColor: colors.border },
            ]}
          >
            {iconName ? (
              <Icon
                name={iconName}
                size={13}
                color={selected ? '#FFFFFF' : (o.color || colors.muted)}
                strokeWidth={2.2}
              />
            ) : null}
            <Text
              style={{
                fontSize: 13,
                fontWeight: selected ? '600' : '400',
                color: selected ? '#FFFFFF' : colors.text,
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

