// Supabase Edge Function: proxies financial-advice requests to Anthropic so the
// API key stays on the server. Deploy with:
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
//   supabase functions deploy advisor
// JWT verification is on by default, so only signed-in users can call it.

const MODEL = 'claude-sonnet-5-5';
const MAX_SNAPSHOT_CHARS = 20_000;
const MAX_QUESTION_CHARS = 500;

const SYSTEM_PROMPT = `Bạn là cố vấn tài chính cá nhân cho một người dùng ở Việt Nam. Bạn nhận được số liệu tài sản và thu chi của họ (đơn vị VND).

Hãy trả lời bằng tiếng Việt, ngắn gọn, thân thiện và dựa trên chính số liệu được cung cấp:
1. Nhận xét tổng quan về tình hình tài chính (tài sản ròng, cơ cấu tài sản, dòng tiền tháng này so với các tháng trước).
2. Chỉ ra 2-3 điểm đáng chú ý, ví dụ khoản chi chiếm tỷ trọng lớn, tỷ lệ tiết kiệm, mức độ rủi ro của danh mục, quỹ dự phòng.
3. Đưa ra 3-5 lời khuyên cụ thể, có con số khi có thể.

Nếu dữ liệu còn ít, hãy nói rõ và gợi ý họ nên nhập thêm gì. Không khuyên mua mã cổ phiếu hay đồng crypto cụ thể. Trình bày dạng văn bản thuần với tiêu đề ngắn và gạch đầu dòng "-", không dùng ký hiệu markdown như ** hay #.`;

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'content-type': 'application/json' },
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) return json({ error: 'Máy chủ chưa cấu hình ANTHROPIC_API_KEY.' }, 500);

  const { snapshot, question, date } = await req.json().catch(() => ({}));
  if (typeof snapshot !== 'string' || !snapshot || snapshot.length > MAX_SNAPSHOT_CHARS) {
    return json({ error: 'Dữ liệu không hợp lệ.' }, 400);
  }
  const ask =
    typeof question === 'string' && question.trim()
      ? `Câu hỏi của tôi: ${question.trim().slice(0, MAX_QUESTION_CHARS)}`
      : 'Hãy phân tích tình hình tài chính của tôi và cho lời khuyên.';

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Số liệu tài chính hiện tại của tôi (ngày ${String(date ?? '')}):\n\n${snapshot}\n\n${ask}`,
        },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => null);
    return json({ error: err?.error?.message ?? `Anthropic ${res.status}` }, res.status === 429 ? 429 : 502);
  }

  const data = await res.json();
  if (data.stop_reason === 'refusal') {
    return json({ error: 'AI từ chối trả lời yêu cầu này. Hãy thử đặt câu hỏi khác.' }, 422);
  }
  const text = (data.content ?? [])
    .filter((b: { type: string }) => b.type === 'text')
    .map((b: { text: string }) => b.text)
    .join('\n')
    .trim();
  return json({ text });
});
