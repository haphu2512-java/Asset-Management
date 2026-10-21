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
        <Text style={ui.heading}>Cố vấn tài chính AI</Text>
        <Text style={ui.label}>
          AI đọc số liệu tài sản và thu chi 3 tháng gần nhất của bạn, rồi đưa ra nhận xét và lời khuyên. Số liệu (kể cả ghi chú giao dịch) được gửi tới Anthropic để phân tích khi bạn bấm Phân tích.
        </Text>
        <TextInput
          placeholderTextColor={colors.muted}
          style={[ui.input, { minHeight: 70, textAlignVertical: 'top' }]}
          value={question}
          onChangeText={setQuestion}
          placeholder="Câu hỏi riêng (tuỳ chọn), ví dụ: Tôi nên tiết kiệm bao nhiêu mỗi tháng?"
          multiline
        />
        <Pressable style={[ui.button, loading && { opacity: 0.6 }]} onPress={ask} disabled={loading}>
          {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={ui.buttonText}>Phân tích</Text>}
        </Pressable>
        {error ? <Text style={{ color: colors.expense }}>{error}</Text> : null}
      </View>

      {advice ? (
        <View style={ui.card}>
          <Text style={[ui.text, { lineHeight: 22 }]} selectable>
            {advice}
          </Text>
        </View>
      ) : null}
    </ScrollView>
  );
}
