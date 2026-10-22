import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, TextInput, View } from 'react-native';
import type { Transaction } from '../finance';
import { describeEntry, parseQuickEntry, type ReceiptImage } from '../quickEntry';
import { newId } from '../store';
import { colors, ui } from '../theme';
import { Icon } from './Icon';

type Props = { onSave: (transaction: Transaction) => Promise<boolean> };

/** Type "cafe 35k" or snap a receipt; the parser turns it into transactions that are saved right away. */
export function QuickEntryBar({ onSave }: Props) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const run = async (input: { text?: string; image?: ReceiptImage }) => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const { entries, offline } = await parseQuickEntry(input);
      if (entries.length === 0) throw new Error('Không đọc được giao dịch nào. Hãy thử lại.');
      const results = await Promise.all(entries.map((e) => onSave({ id: newId(), ...e })));
      const saved = entries.filter((_, i) => results[i]);
      if (saved.length === 0) throw new Error('Không lưu được giao dịch. Hãy kiểm tra kết nối và thử lại.');
      // Keep the note when something failed, so the user can retry.
      if (saved.length === entries.length) setText('');
      setMessage(
        `Đã thêm: ${saved.map(describeEntry).join('; ')}` +
          (offline ? ' (Tự phân loại)' : '') +
          (saved.length < entries.length ? ` (${entries.length - saved.length} khoản chưa lưu được)` : ''),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Đã có lỗi xảy ra.');
    } finally {
      setBusy(false);
    }
  };

  const submitText = () => {
    if (text.trim() && !busy) run({ text: text.trim() });
  };

  const pick = async (source: 'camera' | 'library') => {
    const permission =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError(source === 'camera' ? 'Cần quyền camera để chụp hoá đơn.' : 'Cần quyền truy cập ảnh.');
      return;
    }
    const options: ImagePicker.ImagePickerOptions = {
      mediaTypes: ['images'],
      base64: true,
      quality: 0.4,
      allowsEditing: true,
    };
    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);
    const asset = result.canceled ? null : result.assets[0];
    if (!asset?.base64) return;
    const mediaType = asset.mimeType && asset.mimeType !== 'image/jpg' ? asset.mimeType : 'image/jpeg';
    run({ image: { data: asset.base64, mediaType } });
  };

  const chooseReceipt = () => {
    Alert.alert('Quét hoá đơn', 'Chọn ảnh hoá đơn để trích xuất giao dịch.', [
      { text: 'Chụp ảnh', onPress: () => pick('camera') },
      { text: 'Chọn từ thư viện', onPress: () => pick('library') },
      { text: 'Huỷ', style: 'cancel' },
    ]);
  };

  return (
    <View style={ui.card}>
      <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
        <TextInput
          placeholderTextColor={colors.muted}
          style={[ui.input, { flex: 1, paddingVertical: 6, fontSize: 13 }]}
          value={text}
          onChangeText={setText}
          placeholder='Nhập nhanh: "cafe 35k", "ăn trưa 50k", "lương 20tr"...'
          returnKeyType="send"
          onSubmitEditing={submitText}
          editable={!busy}
        />
        {busy ? (
          <ActivityIndicator color={colors.primary} size="small" style={{ width: 36 }} />
        ) : text.trim() ? (
          <Pressable
            onPress={submitText}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              paddingHorizontal: 12,
              paddingVertical: 7,
              backgroundColor: colors.primary,
              borderRadius: 4,
            }}
            accessibilityLabel="Ghi nhanh"
          >
            <Icon name="check" size={13} color="#FFFFFF" strokeWidth={2.5} />
            <Text style={{ color: '#FFFFFF', fontWeight: '600', fontSize: 13 }}>Ghi</Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={chooseReceipt}
            hitSlop={6}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              paddingHorizontal: 10,
              paddingVertical: 7,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 4,
              backgroundColor: colors.background,
            }}
            accessibilityLabel="Quét hoá đơn"
          >
            <Icon name="camera" size={13} color={colors.muted} />
            <Text style={{ fontSize: 12, color: colors.muted, fontWeight: '600' }}>Hóa đơn</Text>
          </Pressable>
        )}
      </View>
      {message ? <Text style={[ui.label, { color: colors.income }]}>{message}</Text> : null}
      {error ? <Text style={{ color: colors.expense, fontSize: 12 }}>{error}</Text> : null}
    </View>
  );
}
