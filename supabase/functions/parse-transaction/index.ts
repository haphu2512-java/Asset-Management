// Supabase Edge Function: turns a quick note ("cafe 35k") or a receipt photo into
// transactions using Google Gemini, so the API key stays on the server.
// Deploy with:
//   supabase secrets set GEMINI_API_KEY=AIzaSy...
//   supabase functions deploy parse-transaction

import { authorize, CORS, generate, geminiError, geminiKey, json } from '../_shared/gemini.ts';

const MAX_TEXT_CHARS = 500;
/** Base64 length limit for a receipt photo (~3.75 MB of image data). */
const MAX_IMAGE_CHARS = 5_000_000;
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_CATEGORIES = 30;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

type Category = { id: string; label: string; kind: 'income' | 'expense' };

function systemPrompt(categories: Category[], today: string): string {
  const list = categories.map((c) => `- ${c.id}: ${c.label} (${c.kind === 'income' ? 'thu' : 'chi'})`).join('\n');
  return `Bạn ghi sổ thu chi cá nhân cho một người dùng ở Việt Nam. Hôm nay là ${today}.

Từ ghi chú ngắn hoặc ảnh hoá đơn, hãy trích ra các giao dịch dưới dạng JSON có cấu trúc {"transactions": [...]}:
Mỗi giao dịch gồm các trường:
- amount: số tiền VND, số nguyên dương. "35k" = 35000, "1tr2" hay "1,2tr" = 1200000, "2 lít" không phải tiền.
- kind: "expense" (chi) hoặc "income" (thu). Mặc định là chi nếu không rõ.
- category: một id trong danh sách dưới, khớp với kind.
- note: mô tả ngắn bằng tiếng Việt, ví dụ "Cà phê", "Đổ xăng", hoặc tên cửa hàng trên hoá đơn.
- date: dạng YYYY-MM-DD. Dùng ngày trên hoá đơn hoặc ngày được nhắc tới ("hôm qua"), nếu không có thì dùng hôm nay (${today}).

Ghi chú có nhiều khoản (ví dụ "cafe 35k, xăng 50k") thì trả về nhiều giao dịch trong mảng. Một hoá đơn thì trả về một giao dịch với số tiền phải trả cuối cùng (sau giảm giá, gồm thuế). Nếu không tìm thấy số tiền nào, trả về mảng rỗng {"transactions": []}.

Chỉ trả về JSON thuần hợp lệ theo định dạng {"transactions": [...]}, không kèm bất kỳ giải thích nào.

Danh mục:
${list}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const apiKey = geminiKey();
  if (!apiKey) return json({ error: 'Máy chủ chưa cấu hình GEMINI_API_KEY.' }, 500);
  const denied = await authorize(req);
  if (denied) return denied;

  const { text, image, today, categories } = await req.json().catch(() => ({}));
  const validCategories: Category[] = Array.isArray(categories)
    ? categories.filter(
        (c: Category) =>
          typeof c?.id === 'string' &&
          c.id.length <= 40 &&
          typeof c?.label === 'string' &&
          c.label.length <= 60 &&
          (c.kind === 'income' || c.kind === 'expense'),
      ).slice(0, MAX_CATEGORIES)
    : [];
  const hasText = typeof text === 'string' && text.trim().length > 0;
  const hasImage =
    typeof image?.data === 'string' &&
    image.data.length <= MAX_IMAGE_CHARS &&
    IMAGE_TYPES.includes(image?.mediaType);

  if (validCategories.length === 0 || (!hasText && !hasImage) || typeof today !== 'string' || !DATE_RE.test(today)) {
    return json({ error: 'Dữ liệu không hợp lệ.' }, 400);
  }

  const parts: unknown[] = [];
  if (hasImage) {
    parts.push({
      inlineData: {
        mimeType: image.mediaType,
        data: image.data,
      },
    });
  }
  parts.push({
    text: hasText ? `Ghi chú: ${text.trim().slice(0, MAX_TEXT_CHARS)}` : 'Đây là ảnh hoá đơn.',
  });

  const res = await generate(apiKey, {
    systemInstruction: { parts: [{ text: systemPrompt(validCategories, today) }] },
    contents: [{ role: 'user', parts }],
    generationConfig: { temperature: 0.1, responseMimeType: 'application/json' },
  });
  if (!res.ok) return geminiError(res);

  const data = await res.json();
  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  let parsed: { transactions?: unknown[] };
  try {
    parsed = JSON.parse(raw);
  } catch {
    return json({ error: 'AI trả về dữ liệu không đọc được. Hãy thử lại.' }, 502);
  }
  return json({ transactions: parsed.transactions ?? [] });
});
