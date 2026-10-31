import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ||
  import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

export const configurationError =
  !supabaseUrl || !supabaseKey
    ? 'إعداد الاتصال بقاعدة البيانات غير مكتمل. يرجى إبلاغ مسؤول المنصة.'
    : null;

export const supabase = configurationError
  ? null
  : createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
    });

export function requireSupabase() {
  if (!supabase) throw new Error(configurationError);
  return supabase;
}
