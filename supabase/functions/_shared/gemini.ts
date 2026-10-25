// Shared helpers for the Edge Functions that call Google Gemini.
import { createClient } from 'npm:@supabase/supabase-js@2';

const CANDIDATE_MODELS = [
  'gemini-3.8-flash',
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
  'gemini-3.5-flash-lite',
];
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
 * The functions are deployed with verify_jwt = false (see supabase/config.toml): the gateway
 * check accepts the public anon key as a user and rejects tokens signed with the newer
 * asymmetric JWT keys, so the user is verified here against the Auth server instead.
 * Returns an error response to send back, or null when the request may go ahead.
 */
export async function authorize(req: Request): Promise<Response | null> {
  const authorization = req.headers.get('authorization') ?? '';
  const token = authorization.replace(/^Bearer\s+/i, '');
  const url = Deno.env.get('SUPABASE_URL');
  // Use the key the app itself sent, so this works with legacy anon keys and sb_publishable_ keys alike.
  const apiKey = req.headers.get('apikey') || Deno.env.get('SUPABASE_ANON_KEY');
  if (!url || !apiKey) return json({ error: 'Máy chủ chưa cấu hình Supabase.' }, 500);
  if (!token || token === apiKey) return json({ error: 'Bạn cần đăng nhập.' }, 401);

  const supabase = createClient(url, apiKey, {
    // Capital A matters: auth-js adds its own `Authorization` header, and a lowercase key here
    // would be sent alongside it as "Bearer x, Bearer x", which the Auth server rejects with HTML.
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    console.error('getUser failed:', error?.status, error?.message);
    return json({ error: 'Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.' }, 401);
  }

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

/** Calls Gemini, trying available Flash models in order if one is unavailable or restricted. */
export async function generate(apiKey: string, body: Record<string, unknown>): Promise<Response> {
  let lastRes: Response | null = null;
  for (const model of CANDIDATE_MODELS) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify(body),
    });
    if (res.ok) return res;
    lastRes = res;
    // Only fallback if the model doesn't exist (404) or is temporarily unavailable (503)
    if (res.status !== 404 && res.status !== 503) {
      break;
    }
  }
  return lastRes!;
}

/** Maps a failed Gemini response to a clear, actionable error for the client. */
export async function geminiError(res: Response): Promise<Response> {
  const detail = await res.text().catch(() => '');
  console.error(`Gemini ${res.status}:`, detail);

  let errorMessage = 'AI tạm thời không phản hồi. Hãy thử lại sau.';
  try {
    const parsed = JSON.parse(detail);
    const msg = parsed.error?.message || '';
    if (res.status === 429) {
      errorMessage = 'AI đang quá tải hoặc hết hạn mức phút này. Hãy thử lại sau ít phút.';
    } else if (msg.includes('API_KEY_INVALID') || msg.includes('API key not valid')) {
      errorMessage = 'GEMINI_API_KEY không hợp lệ. Hãy kiểm tra lại key trên Google AI Studio.';
    } else if (msg.includes('PERMISSION_DENIED') || res.status === 403) {
      errorMessage = 'Key Gemini chưa có quyền truy cập Generative Language API hoặc bị chặn khu vực.';
    } else if (msg) {
      errorMessage = `Lỗi Gemini: ${msg}`;
    }
  } catch {
    if (res.status === 429) {
      errorMessage = 'AI đang quá tải. Hãy thử lại sau ít phút.';
    }
  }

  return json({ error: errorMessage }, res.status >= 400 && res.status < 500 ? res.status : 502);
}
