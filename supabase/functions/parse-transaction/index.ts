// Supabase Edge Function: turns a quick note ("cafe 35k") or a receipt photo into
// transactions using Google Gemini, so the API key stays on the server.
// Deploy with:
//   supabase secrets set GEMINI_API_KEY=AIzaSy...
//   supabase functions deploy parse-transaction

const MODEL = 'gemini-2.5-flash';
const FALLBACK_MODEL = 'gemini-1.5-flash';
const MAX_TEXT_CHARS = 500;
/** Base64 length limit for a receipt photo (~3.75 MB of image data). */
const MAX_IMAGE_CHARS = 5_000_000;
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

type Category = { id: string; label: string; kind: 'income' | 'expense' };

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'content-type': 'application/json' },
  });

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

async function callGemini(model: string, apiKey: string, sysPrompt: string, parts: unknown[]) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  return fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: sysPrompt }],
      },
      contents: [{ role: 'user', parts }],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: 'application/json',
      },
    }),
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const apiKey = Deno.env.get('GEMINI_API_KEY') || Deno.env.get('GOOGLE_API_KEY');
  if (!apiKey) return json({ error: 'Máy chủ chưa cấu hình GEMINI_API_KEY.' }, 500);

  const { text, image, today, categories } = await req.json().catch(() => ({}));
  const validCategories: Category[] = Array.isArray(categories)
    ? categories.filter(
        (c: Category) =>
          typeof c?.id === 'string' && typeof c?.label === 'string' && (c.kind === 'income' || c.kind === 'expense'),
      )
    : [];
  const hasText = typeof text === 'string' && text.trim().length > 0;
  const hasImage =
    typeof image?.data === 'string' &&
    image.data.length <= MAX_IMAGE_CHARS &&
    IMAGE_TYPES.includes(image?.mediaType);

  if (validCategories.length === 0 || (!hasText && !hasImage) || typeof today !== 'string') {
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

  const sysPrompt = systemPrompt(validCategories, today);
  let res = await callGemini(MODEL, apiKey, sysPrompt, parts);

  if (!res.ok && res.status === 404) {
    res = await callGemini(FALLBACK_MODEL, apiKey, sysPrompt, parts);
  }

  if (!res.ok) {
    const err = await res.json().catch(() => null);
    return json(
      { error: err?.error?.message ?? `Gemini ${res.status}` },
      res.status === 429 ? 429 : 502,
    );
  }

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
