import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { parseVndExpression } from '../finance';
import { newId, useStore } from '../store';
import { font, radius, space, useTheme } from '../theme';
import { Icon, type IconName } from './Icon';
import { AmountInput, Button, Input, Segmented } from './ui';

const TIPS: { icon: IconName; title: string; text: string }[] = [
  { icon: 'plus', title: 'Nút + ở giữa thanh dưới', text: 'Ghi một khoản thu, chi hay chuyển khoản từ bất kỳ màn hình nào.' },
  { icon: 'sparkles', title: 'Nhập nhanh bằng câu chữ', text: 'Gõ "cà phê 35k" hoặc chụp hoá đơn, app tự điền số tiền và danh mục.' },
  { icon: 'budget', title: 'Ngân sách và mục tiêu', text: 'Đặt hạn mức chi mỗi tháng và theo dõi tiến độ để dành.' },
  { icon: 'eye-off', title: 'Ẩn số dư', text: 'Bấm biểu tượng con mắt ở góc trên khi dùng app nơi đông người.' },
];

/** First-run guide: what the app does, the first wallet, and where the main actions are. */
export function Onboarding({ onDone }: { onDone: () => void }) {
  const { colors, ui } = useTheme();
  const { saveAsset } = useStore();
  const [step, setStep] = useState(0);
  const [kind, setKind] = useState<'cash' | 'bank'>('cash');
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');

  const saveWallet = () => {
    const value = amount.trim() ? parseVndExpression(amount) : 0;
    if (value == null || value < 0) return setError('Số dư không hợp lệ. Ví dụ: 2tr hoặc 500k.');
    saveAsset({ id: newId(), name: name.trim() || (kind === 'cash' ? 'Tiền mặt' : 'Tài khoản ngân hàng'), category: kind, amount: value, updatedAt: new Date().toISOString() });
    setStep(2);
  };

  return (
    <View style={ui.screen}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: space.xl, gap: space.lg }} keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: 'row', gap: 6, justifyContent: 'center' }} accessibilityLabel={`Bước ${step + 1} trên 3`}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={{ width: i === step ? 24 : 8, height: 8, borderRadius: 4, backgroundColor: i === step ? colors.primary : colors.border }} />
          ))}
        </View>

        {step === 0 ? (
          <View style={{ gap: space.md, alignItems: 'center' }}>
            <View style={{ width: 72, height: 72, borderRadius: radius.lg, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="wallet" size={36} color={colors.primary} />
            </View>
            <Text style={{ fontSize: font.headline, fontWeight: '800', color: colors.text, textAlign: 'center' }} accessibilityRole="header">
              Chào mừng bạn đến với Asset Management
            </Text>
            <Text style={[ui.text, { textAlign: 'center', color: colors.muted, lineHeight: 21 }]}>
              Một nơi để biết bạn đang có bao nhiêu, tiền đi đâu mỗi tháng và còn cách mục tiêu bao xa. Chỉ mất một phút để bắt đầu.
            </Text>
            <Button label="Bắt đầu" onPress={() => setStep(1)} style={{ alignSelf: 'stretch' }} />
          </View>
        ) : null}

        {step === 1 ? (
          <View style={[ui.card, { gap: space.md }]}>
            <Text style={ui.title} accessibilityRole="header">
              Tạo ví đầu tiên
            </Text>
            <Text style={ui.label}>Ví là nơi bạn giữ tiền. Mỗi khoản thu chi sẽ tự cộng trừ vào số dư ví. Bạn có thể thêm ví khác sau.</Text>
            <Segmented
              options={[
                { id: 'cash', label: 'Tiền mặt', icon: 'cash' },
                { id: 'bank', label: 'Ngân hàng', icon: 'bank' },
              ]}
              value={kind}
              onChange={setKind}
            />
            <View style={{ gap: 6 }}>
              <Text style={ui.label}>Tên ví</Text>
              <Input value={name} onChangeText={setName} placeholder={kind === 'cash' ? 'Tiền mặt' : 'Ví dụ: Vietcombank'} accessibilityLabel="Tên ví" />
            </View>
            <View style={{ gap: 6 }}>
              <Text style={ui.label}>Số dư hiện có</Text>
              <AmountInput value={amount} onChangeText={setAmount} placeholder="Ví dụ: 2tr" accessibilityLabel="Số dư hiện có" />
            </View>
            {error ? <Text style={[ui.label, { color: colors.expense }]}>{error}</Text> : null}
            <Button label="Tạo ví" icon="check" onPress={saveWallet} />
            <Button variant="ghost" label="Để sau" onPress={() => setStep(2)} />
          </View>
        ) : null}

        {step === 2 ? (
          <View style={{ gap: space.md }}>
            <Text style={[ui.title, { textAlign: 'center' }]} accessibilityRole="header">
              Vài điều nên biết
            </Text>
            {TIPS.map((tip) => (
              <View key={tip.title} style={[ui.card, { flexDirection: 'row', alignItems: 'center', gap: space.md }]}>
                <Icon name={tip.icon} size={22} color={colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={ui.heading}>{tip.title}</Text>
                  <Text style={ui.label}>{tip.text}</Text>
                </View>
              </View>
            ))}
            <Button label="Vào app" onPress={onDone} />
          </View>
        ) : null}

        {step < 2 ? (
          <View style={{ alignItems: 'center' }}>
            <Button variant="ghost" small label="Bỏ qua hướng dẫn" onPress={onDone} />
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}
