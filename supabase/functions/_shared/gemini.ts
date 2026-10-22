// Shared helpers for the Edge Functions that call Google Gemini.
import { createClient } from 'npm:@supabase/supabase-js@2';

const MODEL = 'gemini-2.5-flash';
const FALLBACK_MODEL = 'gemini-2.5-flash-lite';
/** AI requests each user may make per day, across all AI features. */
const DAILY_AI_LIMIT = 50;

export const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
};

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'content-type': 'application/json' },
  });

/**
 * Rejects requests that don't come from a signed-in user and enforces the daily quota.
 * The gateway accepts the public anon key as a valid JWT, so the user must be checked here.
 * Returns an error response to send back, or null when the request may go ahead.
 */
export async function authorize(req: Request): Promise<Response | null> {
  const authorization = req.headers.get('authorization') ?? '';
  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!url || !anonKey) return json({ error: 'Máy chủ chưa cấu hình Supabase.' }, 500);

  const supabase = createClient(url, anonKey, {
    global: { headers: { authorization } },
    auth: { persistSession: false },
  });
  const token = authorization.replace(/^Bearer\s+/i, '');
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return json({ error: 'Bạn cần đăng nhập.' }, 401);

  const { data: allowed, error: quotaError } = await supabase.rpc('consume_ai_quota', {
    daily_limit: DAILY_AI_LIMIT,
  });
  if (quotaError) {
    console.error('consume_ai_quota failed:', quotaError);
    return json({ error: 'Không kiểm tra được hạn mức AI. Hãy thử lại.' }, 500);
  }
  if (!allowed) return json({ error: `Bạn đã dùng hết ${DAILY_AI_LIMIT} lượt AI hôm nay.` }, 429);
  return null;
}

export function geminiKey(): string | undefined {
  return Deno.env.get('GEMINI_API_KEY') || Deno.env.get('GOOGLE_API_KEY');
}

/** Calls Gemini, retrying once with a lighter model if the main one is unavailable. */
export async function generate(apiKey: string, body: Record<string, unknown>): Promise<Response> {
  const call = (model: string) =>
    fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      // The key goes in a header so it never shows up in URLs or request logs.
      headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify(body),
    });
  const res = await call(MODEL);
  return !res.ok && (res.status === 404 || res.status === 503) ? call(FALLBACK_MODEL) : res;
}

/** Maps a failed Gemini response to a client-safe error; details stay in the server log. */
export async function geminiError(res: Response): Promise<Response> {
  const detail = await res.text().catch(() => '');
  console.error(`Gemini ${res.status}:`, detail);
  return res.status === 429
    ? json({ error: 'AI đang quá tải. Hãy thử lại sau ít phút.' }, 429)
    : json({ error: 'AI tạm thời không phản hồi. Hãy thử lại.' }, 502);
}
