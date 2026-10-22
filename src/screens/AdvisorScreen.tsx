import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { describeAdviceError, getFinancialAdvice } from '../advisor';
import { Icon } from '../components/Icon';
import { useStore } from '../store';
import { colors, ui } from '../theme';

export function AdvisorScreen() {
  const { assets, transactions, goals } = useStore();
  const [question, setQuestion] = useState('');
  const [advice, setAdvice] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const ask = async () => {
    setLoading(true);
    setError('');
    try {
      setAdvice(await getFinancialAdvice(assets, transactions, question, goals));
    } catch (e) {
      setError(describeAdviceError(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={ui.screen} contentContainerStyle={ui.content} keyboardShouldPersistTaps="handled">
      <View style={ui.card}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Icon name="advisor" size={18} color={colors.primary} />
          <Text style={ui.heading}>Cố vấn tài chính</Text>
        </View>
        <Text style={ui.label}>
          Hệ thống tổng hợp tình hình tài sản, nợ và thu chi 3 tháng gần nhất để phân tích và đưa ra khuyến nghị thực tế.
        </Text>
        <TextInput
          placeholderTextColor={colors.muted}
          style={[ui.input, { minHeight: 60, textAlignVertical: 'top' }]}
          value={question}
          onChangeText={setQuestion}
          placeholder="Nhập câu hỏi cụ thể (ví dụ: Tỷ lệ phân bổ tiền mặt của tôi đã an toàn chưa?)"
          multiline
        />
        <Pressable
          style={[ui.button, { flexDirection: 'row', alignItems: 'center', gap: 6 }, loading && { opacity: 0.6 }]}
          onPress={ask}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <>
              <Icon name="sparkles" size={15} color="#FFFFFF" />
              <Text style={ui.buttonText}>Bắt đầu phân tích</Text>
            </>
          )}
        </Pressable>
        {error ? <Text style={{ color: colors.expense, fontSize: 13 }}>{error}</Text> : null}
      </View>

      {advice ? (
        <View style={ui.card}>
          <View style={[ui.row, { paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: colors.borderSubtle }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Icon name="check" size={14} color={colors.income} strokeWidth={2.5} />
              <Text style={[ui.label, { fontWeight: '700' }]}>KẾT QUẢ ĐÁNH GIÁ</Text>
            </View>
          </View>
          <Text style={[ui.text, { fontSize: 13, lineHeight: 22 }]} selectable>
            {advice}
          </Text>
        </View>
      ) : null}
    </ScrollView>
  );
}
