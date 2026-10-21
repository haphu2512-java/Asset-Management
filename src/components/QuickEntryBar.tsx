import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, TextInput, View } from 'react-native';
import type { Transaction } from '../finance';
import { describeEntry, parseQuickEntry, type ReceiptImage } from '../quickEntry';
import { newId } from '../store';
import { colors, ui } from '../theme';

type Props = { onSave: (transaction: Transaction) => Promise<void> };

/** Type "cafe 35k" or snap a receipt; the AI turns it into transactions that are saved right away. */
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
      await Promise.all(entries.map((e) => onSave({ id: newId(), ...e })));
      setText('');
      setMessage(
        `Đã thêm: ${entries.map(describeEntry).join('; ')}` +
          (offline ? ' (AI không phản hồi, đã tự phân loại)' : '') +
          '. Chạm vào giao dịch để sửa.',
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
      setError(source === 'camera' ? 'Cần quyền dùng camera để chụp hoá đơn.' : 'Cần quyền truy cập ảnh.');
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
    Alert.alert('Ghi từ hoá đơn', 'Chọn ảnh hoá đơn để AI đọc số tiền.', [
      { text: 'Chụp ảnh', onPress: () => pick('camera') },
      { text: 'Chọn từ thư viện', onPress: () => pick('library') },
      { text: 'Huỷ', style: 'cancel' },
    ]);
  };

  return (
    <View style={ui.card}>
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        <TextInput
          placeholderTextColor={colors.muted}
          style={[ui.input, { flex: 1, paddingVertical: 8 }]}
          value={text}
          onChangeText={setText}
          placeholder='Nhập nhanh: "cafe 35k", "lương 20tr"'
          returnKeyType="send"
          onSubmitEditing={submitText}
          editable={!busy}
        />
        {busy ? (
          <ActivityIndicator color={colors.primary} style={{ width: 40 }} />
        ) : text.trim() ? (
          <Pressable onPress={submitText} style={{ padding: 8 }} accessibilityLabel="Thêm giao dịch nhanh">
            <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 16 }}>Thêm</Text>
          </Pressable>
        ) : (
          <Pressable onPress={chooseReceipt} style={{ padding: 8 }} accessibilityLabel="Chụp hoá đơn">
            <Text style={{ fontSize: 22 }}>📷</Text>
          </Pressable>
        )}
      </View>
      {message ? <Text style={[ui.label, { color: colors.income }]}>{message}</Text> : null}
      {error ? <Text style={{ color: colors.expense, fontSize: 13 }}>{error}</Text> : null}
    </View>
  );
}
