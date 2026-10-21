import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { describeAdviceError, getFinancialAdvice } from '../advisor';
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
        <Text style={ui.heading}>Cố vấn tài chính</Text>
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
        <Pressable style={[ui.button, loading && { opacity: 0.6 }]} onPress={ask} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={ui.buttonText}>Bắt đầu phân tích</Text>
          )}
        </Pressable>
        {error ? <Text style={{ color: colors.expense, fontSize: 13 }}>{error}</Text> : null}
      </View>

      {advice ? (
        <View style={ui.card}>
          <View style={[ui.row, { paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: colors.borderSubtle }]}>
            <Text style={[ui.label, { fontWeight: '700' }]}>KẾT QUẢ ĐÁNH GIÁ</Text>
          </View>
          <Text style={[ui.text, { fontSize: 13, lineHeight: 22 }]} selectable>
            {advice}
          </Text>
        </View>
      ) : null}
    </ScrollView>
  );
}
