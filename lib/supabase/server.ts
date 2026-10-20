import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Client Supabase untuk Server Components, Route Handlers, dan Server Actions.
// Menggunakan cookie sesi untuk membaca status login di server.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Dipanggil dari Server Component — aman diabaikan jika middleware
            // sudah memperbarui sesi.
          }
        },
      },
    }
  );
}
