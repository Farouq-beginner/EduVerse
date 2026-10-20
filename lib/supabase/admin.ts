import { createClient } from "@supabase/supabase-js";

/**
 * Supabase Admin Client dengan privileges Service Role.
 * Hanya digunakan di server untuk operasi administratif:
 * - Mengonfirmasi email user secara otomatis saat pendaftaran
 * - Sinkronisasi akun auth tanpa terblokir proteksi email confirmation
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("SUPABASE_URL atau SUPABASE_SERVICE_ROLE_KEY belum dikonfigurasi.");
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
