import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { aiUsageToday, askAdvisor, describeAdviceError, type ChatMessage } from '@shared/advisor';
import { useStore } from '@shared/store';
import { Icon } from '../components/Icon';
import { Markdown } from '../components/Markdown';
import { Banner, Button, Card, Chips, EmptyState } from '../components/ui';

const SUGGESTIONS = [
  'Phân tích tình hình tài chính của tôi',
  'Tháng này tôi chi nhiều nhất vào đâu?',
  'Tôi nên cắt giảm khoản chi nào?',
  'Quỹ dự phòng của tôi đã đủ chưa?',
  'Cơ cấu tài sản của tôi có rủi ro không?',
];

export function AdvisorPage() {
  const { assets, transactions, goals, categories, budgets, recurring } = useStore();
  const location = useLocation();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [failed, setFailed] = useState('');
  const [usage, setUsage] = useState<{ used: number | null; limit?: number }>({ used: null });
  const end = useRef<HTMLDivElement>(null);
  const history = useRef<ChatMessage[]>([]);
  history.current = messages;

  const ask = async (question: string) => {
    const q = question.trim();
    if (!q || busy) return;
    const before = history.current;
    setMessages([...before, { role: 'user', text: q }]);
    setText('');
    setError('');
    setFailed('');
    setBusy(true);
    try {
      const reply = await askAdvisor({ assets, transactions, goals, categories, budgets, recurring }, q, before);
      setMessages((m) => [...m, { role: 'model', text: reply.text }]);
      const used = await aiUsageToday();
      setUsage({ used, limit: reply.limit });
    } catch (e) {
      setError(describeAdviceError(e));
      setFailed(q);
      setMessages(before);
    } finally {
      setBusy(false);
    }
  };

  // A question handed over from another screen (overview, a goal) is asked once on arrival.
  const asked = useRef(false);
  useEffect(() => {
    const question = (location.state as { question?: string } | null)?.question;
    if (question && !asked.current) {
      asked.current = true;
      window.history.replaceState({}, '');
      ask(question);
    }
    aiUsageToday().then((used) => setUsage((u) => ({ ...u, used })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, busy]);

  return (
    <>
      <Card>
        {messages.length === 0 && !busy ? (
          <>
            <EmptyState icon="sparkle" title="Hỏi cố vấn AI về tài chính của bạn" message="AI đọc số liệu tài sản, thu chi 3 tháng gần nhất, ngân sách và mục tiêu của bạn để trả lời." />
            <Chips options={SUGGESTIONS.map((s) => ({ id: s, label: s }))} value="" onChange={ask} />
          </>
        ) : (
          <div className="chat">
            {messages.map((m, i) => (
              <div key={i} className={`bubble ${m.role}`}>
                {m.role === 'model' ? <Markdown text={m.text} /> : m.text}
              </div>
            ))}
            {busy ? <div className="bubble model label">AI đang đọc số liệu và soạn câu trả lời…</div> : null}
          </div>
        )}
        {error ? (
          <Banner tone="danger">
            <span className="grow">{error}</span>
            {failed ? (
              <button className="link" onClick={() => ask(failed)}>
                Thử lại
              </button>
            ) : null}
          </Banner>
        ) : null}
        <form
          className="row"
          onSubmit={(e) => {
            e.preventDefault();
            ask(text);
          }}
        >
          <input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Nhập câu hỏi của bạn" aria-label="Câu hỏi cho cố vấn AI" disabled={busy} maxLength={500} />
          <button type="submit" className="btn" disabled={busy || !text.trim()} aria-label="Gửi câu hỏi">
            <Icon name="send" size={18} />
          </button>
        </form>
        <div className="row between">
          <span className="caption">
            {usage.used !== null ? `Hôm nay đã dùng ${usage.used}${usage.limit ? `/${usage.limit}` : ''} lượt AI. ` : ''}
            Câu trả lời chỉ mang tính tham khảo.
          </span>
          {messages.length > 0 ? <Button small variant="ghost" label="Xoá cuộc trò chuyện" onClick={() => setMessages([])} /> : null}
        </div>
        <div ref={end} />
      </Card>
    </>
  );
}
