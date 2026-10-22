// Supabase Edge Function: proxies financial-advice requests to Google Gemini
// so the API key stays safely on the server.
// Deploy with:
//   supabase secrets set GEMINI_API_KEY=AIzaSy...
//   supabase functions deploy advisor

const MODEL = 'gemini-2.5-flash';
const FALLBACK_MODEL = 'gemini-1.5-flash';
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

async function callGemini(model: string, apiKey: string, prompt: string) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  return fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: SYSTEM_PROMPT }],
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2048,
      },
    }),
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const apiKey = Deno.env.get('GEMINI_API_KEY') || Deno.env.get('GOOGLE_API_KEY');
  if (!apiKey) return json({ error: 'Máy chủ chưa cấu hình GEMINI_API_KEY.' }, 500);

  const { snapshot, question, date } = await req.json().catch(() => ({}));
  if (typeof snapshot !== 'string' || !snapshot || snapshot.length > MAX_SNAPSHOT_CHARS) {
    return json({ error: 'Dữ liệu không hợp lệ.' }, 400);
  }
  const ask =
    typeof question === 'string' && question.trim()
      ? `Câu hỏi của tôi: ${question.trim().slice(0, MAX_QUESTION_CHARS)}`
      : 'Hãy phân tích tình hình tài chính của tôi và cho lời khuyên.';

  const prompt = `Số liệu tài chính hiện tại của tôi (ngày ${String(date ?? '')}):\n\n${snapshot}\n\n${ask}`;

  let res = await callGemini(MODEL, apiKey, prompt);

  // Fallback to gemini-1.5-flash if MODEL is unavailable
  if (!res.ok && res.status === 404) {
    res = await callGemini(FALLBACK_MODEL, apiKey, prompt);
  }

  if (!res.ok) {
    const err = await res.json().catch(() => null);
    return json(
      { error: err?.error?.message ?? `Gemini ${res.status}` },
      res.status === 429 ? 429 : 502,
    );
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';
  if (!text) {
    return json({ error: 'AI không trả về nội dung. Hãy thử lại.' }, 502);
  }
  return json({ text });
});
