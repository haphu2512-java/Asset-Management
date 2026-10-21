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
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.35)' }}
      >
        <View
          style={{
            backgroundColor: colors.background,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            maxHeight: '90%',
          }}
        >
          <ScrollView contentContainerStyle={{ padding: 20, gap: 14 }} keyboardShouldPersistTaps="handled">
            <View style={ui.row}>
              <Text style={ui.title}>{title}</Text>
              <Pressable onPress={onClose} hitSlop={12}>
                <Text style={[ui.text, { color: colors.muted }]}>Đóng</Text>
              </Pressable>
            </View>
            {children}
            {error ? <Text style={{ color: colors.expense }}>{error}</Text> : null}
            <Pressable style={ui.button} onPress={onSave}>
              <Text style={ui.buttonText}>Lưu</Text>
            </Pressable>
            {onDelete ? (
              <Pressable onPress={onDelete} style={{ alignItems: 'center', paddingVertical: 8 }}>
                <Text style={{ color: colors.expense, fontSize: 15 }}>Xoá</Text>
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
    <View style={{ gap: 6 }}>
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
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {options.map((o) => {
        const selected = o.id === value;
        return (
          <Pressable
            key={o.id}
            onPress={() => onChange(o.id)}
            style={[ui.chip, selected && { backgroundColor: o.color, borderColor: o.color }]}
          >
            <Text style={{ color: selected ? '#FFFFFF' : colors.text }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
