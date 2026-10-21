import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { describeAdviceError, getFinancialAdvice } from '../advisor';
import { useStore } from '../store';
import { colors, ui } from '../theme';

export function AdvisorScreen() {
  const { assets, transactions, apiKey, setApiKey } = useStore();
  const [keyDraft, setKeyDraft] = useState(apiKey);
  const [showSettings, setShowSettings] = useState(!apiKey);
  const [question, setQuestion] = useState('');
  const [advice, setAdvice] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setKeyDraft(apiKey);
    if (apiKey) setShowSettings(false);
  }, [apiKey]);

  const ask = async () => {
    if (!apiKey) {
      setShowSettings(true);
      return setError('Hãy nhập API key trước.');
    }
    setLoading(true);
    setError('');
    try {
      setAdvice(await getFinancialAdvice(apiKey, assets, transactions, question));
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
          AI đọc số liệu tài sản và thu chi 3 tháng gần nhất của bạn, rồi đưa ra nhận xét và lời khuyên.
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

      <View style={ui.card}>
        <Pressable onPress={() => setShowSettings((v) => !v)} style={ui.row}>
          <Text style={ui.heading}>Cài đặt API key</Text>
          <Text style={ui.label}>{apiKey ? 'Đã lưu' : 'Chưa có'}</Text>
        </Pressable>
        {showSettings ? (
          <>
            <Text style={ui.label}>
              Tạo API key tại console.anthropic.com. Key chỉ được lưu trên điện thoại này và gửi thẳng tới
              Anthropic khi bạn bấm Phân tích.
            </Text>
            <TextInput
              placeholderTextColor={colors.muted}
              style={ui.input}
              value={keyDraft}
              onChangeText={setKeyDraft}
              placeholder="sk-ant-..."
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
            />
            <Pressable style={ui.button} onPress={() => setApiKey(keyDraft.trim())}>
              <Text style={ui.buttonText}>Lưu key</Text>
            </Pressable>
          </>
        ) : null}
      </View>
    </ScrollView>
  );
}
