import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { aiUsageToday, askAdvisor, describeAdviceError, type ChatMessage } from '../advisor';
import { Markdown } from '../components/Markdown';
import { Banner, Button, IconButton, Input } from '../components/ui';
import { useStore } from '../store';
import { radius, space, useTheme } from '../theme';

const SUGGESTIONS = [
  'Phân tích tình hình tài chính của tôi',
  'Tháng này tôi chi nhiều nhất vào đâu?',
  'Tôi nên cắt giảm khoản chi nào?',
  'Quỹ dự phòng của tôi đã đủ chưa?',
  'Cơ cấu tài sản của tôi có rủi ro không?',
];
const MAX_SAVED = 40;
const MAX_QUESTION = 500;

/** A conversation with the AI advisor about the user's own figures. Kept on the device between visits. */
export function AdvisorScreen({ question: initialQuestion }: { question?: string }) {
  const { colors, ui } = useTheme();
  const { user, assets, transactions, goals, categories, budgets, recurring } = useStore();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [ready, setReady] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [usage, setUsage] = useState<{ used: number | null; limit: number | null }>({ used: null, limit: null });
  const scroll = useRef<ScrollView>(null);
  const asked = useRef(false);
  const key = `advisor.chat.v1:${user?.id ?? ''}`;

  const persist = useCallback(
    (next: ChatMessage[]) => {
      AsyncStorage.setItem(key, JSON.stringify(next.slice(-MAX_SAVED))).catch(() => {});
    },
    [key],
  );

  const send = useCallback(
    async (text: string, history: ChatMessage[]) => {
      const question = text.trim().slice(0, MAX_QUESTION);
      if (!question || loading) return;
      const withQuestion: ChatMessage[] = [...history, { role: 'user', text: question }];
      setMessages(withQuestion);
      setInput('');
      setError('');
      setLoading(true);
      try {
        const reply = await askAdvisor({ assets, transactions, goals, categories, budgets, recurring }, question, history);
        const next: ChatMessage[] = [...withQuestion, { role: 'model', text: reply.text }];
        setMessages(next);
        persist(next);
        const used = await aiUsageToday();
        setUsage((u) => ({ used, limit: reply.limit ?? u.limit }));
      } catch (e) {
        // Keep the question on screen so the user can retry it.
        setError(describeAdviceError(e));
        persist(withQuestion);
      } finally {
        setLoading(false);
      }
    },
    [assets, transactions, goals, categories, budgets, recurring, loading, persist],
  );

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(key)
      .then((raw) => {
        if (cancelled) return;
        const saved = raw ? (JSON.parse(raw) as ChatMessage[]) : [];
        setMessages(Array.isArray(saved) ? saved : []);
      })
      .catch(() => {})
      .finally(() => !cancelled && setReady(true));
    aiUsageToday().then((used) => !cancelled && setUsage((u) => ({ ...u, used })));
    return () => {
      cancelled = true;
    };
  }, [key]);

  // A question passed in (for example from a goal) is asked once, after the saved chat has loaded.
  useEffect(() => {
    if (!ready || !initialQuestion || asked.current) return;
    asked.current = true;
    void send(initialQuestion, messages);
  }, [ready, initialQuestion, messages, send]);

  const clear = () => {
    setMessages([]);
    setError('');
    AsyncStorage.removeItem(key).catch(() => {});
  };
  const last = messages[messages.length - 1];
  const canRetry = !!error && last?.role === 'user';

  return (
    <KeyboardAvoidingView style={ui.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <ScrollView
        ref={scroll}
        contentContainerStyle={[ui.content, { paddingBottom: space.lg }]}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}
      >
        {messages.length === 0 && !loading ? (
          <View style={{ gap: space.sm }}>
            <Text style={ui.heading}>Hỏi cố vấn AI về tài chính của bạn</Text>
            <Text style={ui.label}>
              AI đọc số liệu tài sản, thu chi, ngân sách và mục tiêu trong app để trả lời. Đây là gợi ý tham khảo, không phải lời
              khuyên đầu tư.
            </Text>
            {SUGGESTIONS.map((s) => (
              <Pressable
                key={s}
                onPress={() => send(s, messages)}
                accessibilityRole="button"
                style={({ pressed }) => [ui.card, { paddingVertical: space.md, opacity: pressed ? 0.7 : 1 }]}
              >
                <Text style={[ui.text, { color: colors.primary, fontWeight: '600' }]}>{s}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        {messages.map((m, i) =>
          m.role === 'user' ? (
            <View
              key={i}
              style={{
                alignSelf: 'flex-end',
                maxWidth: '88%',
                backgroundColor: colors.primary,
                borderRadius: radius.lg,
                borderBottomRightRadius: 4,
                paddingHorizontal: space.md,
                paddingVertical: space.sm,
              }}
            >
              <Text style={{ color: colors.onPrimary, fontSize: 14, lineHeight: 20 }}>{m.text}</Text>
            </View>
          ) : (
            <View key={i} style={[ui.card, { alignSelf: 'flex-start', maxWidth: '96%', borderBottomLeftRadius: 4 }]}>
              <Markdown text={m.text} />
            </View>
          ),
        )}

        {loading ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }} accessibilityLiveRegion="polite">
            <ActivityIndicator color={colors.primary} />
            <Text style={ui.label}>AI đang đọc số liệu và soạn câu trả lời…</Text>
          </View>
        ) : null}
        {error ? (
          <Banner tone="danger" icon="alert">
            {error}
          </Banner>
        ) : null}
        {canRetry && !loading ? (
          <Button small variant="secondary" icon="refresh" label="Thử lại" onPress={() => send(last.text, messages.slice(0, -1))} />
        ) : null}
        {messages.length > 0 && !loading ? (
          <Button small variant="ghost" icon="trash" label="Xoá cuộc trò chuyện" onPress={clear} />
        ) : null}
      </ScrollView>

      <View
        style={{
          borderTopWidth: 1,
          borderTopColor: colors.border,
          backgroundColor: colors.card,
          paddingHorizontal: space.md,
          paddingVertical: space.sm,
          gap: 4,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: space.sm }}>
          <View style={{ flex: 1 }}>
            <Input
              value={input}
              onChangeText={setInput}
              placeholder="Nhập câu hỏi của bạn"
              multiline
              maxLength={MAX_QUESTION}
              accessibilityLabel="Câu hỏi cho cố vấn AI"
              style={{ maxHeight: 110 }}
            />
          </View>
          <IconButton icon="send" label="Gửi câu hỏi" filled onPress={() => send(input, messages)} color={input.trim() && !loading ? undefined : colors.muted} />
        </View>
        {usage.used != null ? (
          <Text style={ui.label}>
            Hôm nay đã dùng {usage.used}
            {usage.limit ? `/${usage.limit}` : ''} lượt AI (tính chung cả nhập nhanh bằng AI).
          </Text>
        ) : null}
      </View>
    </KeyboardAvoidingView>
  );
}
