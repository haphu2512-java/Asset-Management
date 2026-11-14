import { createClient } from '@supabase/supabase-js';

declare const __SUPABASE_URL__: string;
declare const __SUPABASE_ANON_KEY__: string;

export const SUPABASE_URL = __SUPABASE_URL__;
export const SUPABASE_ANON_KEY = __SUPABASE_ANON_KEY__;
/** False when the deployment has no Supabase settings; the app then shows how to add them. */
export const isConfigured = !!SUPABASE_URL && !!SUPABASE_ANON_KEY;

export const supabase = createClient(SUPABASE_URL || 'https://missing.supabase.co', SUPABASE_ANON_KEY || 'missing', {
  auth: {
    storage: window.localStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});

/**
 * Message for a 401 from an Edge Function. Our functions explain themselves in `error`;
 * anything else came from the gateway, which means the functions need redeploying.
 */
export function unauthorizedMessage(body: { error?: unknown } | null): string {
  return typeof body?.error === 'string'
    ? body.error
    : 'Máy chủ AI từ chối yêu cầu (401). Hãy deploy lại Edge Function theo docs/SETUP.md.';
}
