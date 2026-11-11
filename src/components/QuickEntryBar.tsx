import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { ActivityIndicator, Alert, Text, View } from 'react-native';
import { isSpendable } from '../finance';
import { usePrefs } from '../prefs';
import { describeEntry, parseQuickEntry, type ReceiptImage } from '../quickEntry';
import { newId, useStore } from '../store';
import { font, useTheme } from '../theme';
import { useToast } from './Toast';
import { Card, IconButton, Input } from './ui';

/** Type "cafe 35k" or snap a receipt; the parser turns it into transactions that are saved right away. */
export function QuickEntryBar() {
  const { colors } = useTheme();
  const { assets, categories, saveTransactions, deleteTransaction } = useStore();
  const { prefs } = usePrefs();
  const toast = useToast();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const run = async (input: { text?: string; image?: ReceiptImage }) => {
    setBusy(true);
    setError('');
    try {
      const { entries, offline } = await parseQuickEntry(input, categories);
      if (entries.length === 0) throw new Error('Không đọc được giao dịch nào. Hãy thử lại.');
      // Quick entries go to the wallet used last, like the full form does.
      const wallet = assets.find((a) => a.id === prefs.lastAccountId && isSpendable(a));
      const saved = entries.map((e) => ({ id: newId(), ...e, accountId: wallet?.id }));
      saveTransactions(saved);
      setText('');
      toast.show({
        message:
          `Đã thêm: ${entries.map((e) => describeEntry(e, categories)).join('; ')}` +
          (wallet ? ` · ${wallet.name}` : '') +
          (offline ? ' (tự phân loại, chưa qua AI)' : ''),
        tone: 'success',
        actionLabel: 'Hoàn tác',
        onAction: () => saved.forEach((t) => deleteTransaction(t.id)),
      });
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
    Alert.alert('Quét hoá đơn', 'Chọn ảnh hoá đơn để AI đọc số tiền và ngày.', [
      { text: 'Chụp ảnh', onPress: () => pick('camera') },
      { text: 'Chọn từ thư viện', onPress: () => pick('library') },
      { text: 'Huỷ', style: 'cancel' },
    ]);
  };

  return (
    <Card style={{ paddingVertical: 10, paddingHorizontal: 12 }}>
      <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
        <Input
          style={{ flex: 1 }}
          value={text}
          onChangeText={setText}
          placeholder='Nhập nhanh: "cafe 35k, xăng 50k"'
          returnKeyType="send"
          onSubmitEditing={submitText}
          editable={!busy}
          accessibilityLabel="Nhập nhanh giao dịch"
          accessibilityHint="Ví dụ: cafe 35k. Bấm gửi để ghi."
        />
        {busy ? (
          <ActivityIndicator color={colors.primary} size="small" style={{ width: 44 }} />
        ) : text.trim() ? (
          <IconButton icon="send" label="Ghi nhanh" onPress={submitText} color={colors.primary} filled />
        ) : (
          <IconButton icon="camera" label="Quét hoá đơn" onPress={chooseReceipt} color={colors.primary} filled />
        )}
      </View>
      {error ? (
        <Text accessibilityRole="alert" style={{ color: colors.expense, fontSize: font.caption }}>
          {error}
        </Text>
      ) : null}
    </Card>
  );
}
