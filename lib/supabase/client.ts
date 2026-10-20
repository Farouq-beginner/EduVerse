import { createBrowserClient } from "@supabase/ssr";

// Client Supabase untuk komponen client-side (browser).
// Hanya memakai anon key — aman diekspos ke browser karena dilindungi RLS.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY!
  );
}
