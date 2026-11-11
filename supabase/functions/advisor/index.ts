// Supabase Edge Function: proxies financial-advice requests to Google Gemini
// so the API key stays safely on the server.
// Deploy with:
//   supabase secrets set GEMINI_API_KEY=AIzaSy...
//   supabase functions deploy advisor

import { authorize, CORS, DAILY_AI_LIMIT, generate, geminiError, geminiKey, json } from '../_shared/gemini.ts';

const MAX_SNAPSHOT_CHARS = 20_000;
const MAX_QUESTION_CHARS = 500;
/** Earlier turns of the conversation sent along, newest last. */
const MAX_HISTORY_TURNS = 12;
const MAX_TURN_CHARS = 4_000;

const SYSTEM_PROMPT = `Bạn là cố vấn tài chính cá nhân cho một người dùng ở Việt Nam. Bạn nhận được số liệu tài sản và thu chi của họ (đơn vị VND).

Hãy trả lời bằng tiếng Việt, ngắn gọn, thân thiện và dựa trên chính số liệu được cung cấp:
1. Nhận xét tổng quan về tình hình tài chính (tài sản ròng, cơ cấu tài sản, dòng tiền tháng này so với các tháng trước).
2. Chỉ ra 2-3 điểm đáng chú ý, ví dụ khoản chi chiếm tỷ trọng lớn, tỷ lệ tiết kiệm, mức độ rủi ro của danh mục, quỹ dự phòng.
3. Đưa ra 3-5 lời khuyên cụ thể, có con số khi có thể.

Nếu dữ liệu còn ít, hãy nói rõ và gợi ý họ nên nhập thêm gì. Không khuyên mua mã cổ phiếu hay đồng crypto cụ thể. Khi người dùng hỏi tiếp, hãy trả lời đúng câu hỏi đó dựa trên số liệu và phần trò chuyện trước, không lặp lại toàn bộ phân tích.

Trình bày bằng markdown đơn giản: tiêu đề ngắn bắt đầu bằng "## ", gạch đầu dòng "-", và **in đậm** cho con số quan trọng. Không dùng bảng, không dùng khối mã.`;

type Turn = { role: 'user' | 'model'; parts: { text: string }[] };

/** Keeps only well-formed turns, and makes sure the conversation starts with the user. */
function cleanHistory(raw: unknown): Turn[] {
  if (!Array.isArray(raw)) return [];
  const turns: Turn[] = [];
  for (const item of raw.slice(-MAX_HISTORY_TURNS)) {
    const role = item?.role === 'model' ? 'model' : item?.role === 'user' ? 'user' : null;
    const text = typeof item?.text === 'string' ? item.text.trim().slice(0, MAX_TURN_CHARS) : '';
    if (!role || !text) continue;
    // Gemini needs alternating roles; merge two turns in a row from the same side.
    const last = turns[turns.length - 1];
    if (last?.role === role) last.parts[0].text += `\n\n${text}`;
    else turns.push({ role, parts: [{ text }] });
  }
  while (turns.length > 0 && turns[0].role !== 'user') turns.shift();
  while (turns.length > 0 && turns[turns.length - 1].role !== 'model') turns.pop();
  return turns;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const apiKey = geminiKey();
  if (!apiKey) return json({ error: 'Máy chủ chưa cấu hình GEMINI_API_KEY.' }, 500);
  const denied = await authorize(req);
  if (denied) return denied;

  const { snapshot, question, date, history } = await req.json().catch(() => ({}));
  if (typeof snapshot !== 'string' || !snapshot || snapshot.length > MAX_SNAPSHOT_CHARS) {
    return json({ error: 'Dữ liệu không hợp lệ.' }, 400);
  }
  const ask =
    typeof question === 'string' && question.trim()
      ? `Câu hỏi của tôi: ${question.trim().slice(0, MAX_QUESTION_CHARS)}`
      : 'Hãy phân tích tình hình tài chính của tôi và cho lời khuyên.';

  const day = typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : '';
  const turns = cleanHistory(history);
  // The figures go first, in a turn of their own, so follow-up questions still see them.
  const figures = `Số liệu tài chính hiện tại của tôi (ngày ${day}):\n\n${snapshot}`;
  const contents: Turn[] =
    turns.length === 0
      ? [{ role: 'user', parts: [{ text: `${figures}\n\n${ask}` }] }]
      : [
          { role: 'user', parts: [{ text: `${figures}\n\n${turns[0].parts[0].text}` }] },
          ...turns.slice(1),
          { role: 'user', parts: [{ text: ask }] },
        ];

  const res = await generate(apiKey, {
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents,
    generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
  });
  if (!res.ok) return geminiError(res);

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';
  if (!text) {
    return json({ error: 'AI không trả về nội dung. Hãy thử lại.' }, 502);
  }
  return json({ text, limit: DAILY_AI_LIMIT });
});
