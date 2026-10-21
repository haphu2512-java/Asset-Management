import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { colors, ui } from '../theme';

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
          <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }} keyboardShouldPersistTaps="handled">
            <View style={[ui.row, { paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: colors.borderSubtle }]}>
              <Text style={ui.heading}>{title}</Text>
              <Pressable
                onPress={onClose}
                hitSlop={12}
                style={{
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                  borderRadius: 4,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Text style={{ fontSize: 12, color: colors.muted }}>Đóng</Text>
              </Pressable>
            </View>

            {children}

            {error ? <Text style={{ color: colors.expense, fontSize: 13 }}>{error}</Text> : null}

            <Pressable style={ui.button} onPress={onSave}>
              <Text style={ui.buttonText}>Lưu thay đổi</Text>
            </Pressable>

            {onDelete ? (
              <Pressable
                onPress={onDelete}
                style={{
                  alignItems: 'center',
                  paddingVertical: 8,
                  marginTop: -4,
                }}
              >
                <Text style={{ color: colors.expense, fontSize: 13, fontWeight: '500' }}>Xoá mục này</Text>
              </Pressable>
            ) : null}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={{ gap: 4 }}>
      <Text style={ui.label}>{label}</Text>
      {children}
    </View>
  );
}

type ChipOption = { id: string; label: string; color: string };

export function Chips({
  options,
  value,
  onChange,
}: {
  options: ChipOption[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
      {options.map((o) => {
        const selected = o.id === value;
        return (
          <Pressable
            key={o.id}
            onPress={() => onChange(o.id)}
            style={[
              ui.chip,
              selected
                ? { backgroundColor: colors.primary, borderColor: colors.primary }
                : { backgroundColor: '#FFFFFF', borderColor: colors.border },
            ]}
          >
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
