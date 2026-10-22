import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    'Thiếu biến môi trường EXPO_PUBLIC_SUPABASE_URL hoặc EXPO_PUBLIC_SUPABASE_ANON_KEY trong file .env!',
  );
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
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
