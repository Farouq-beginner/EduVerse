import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Diagnostik konfigurasi — hanya menampilkan status ada/tidak, tanpa nilai rahasia.
// Berguna saat login gagal: langsung terlihat apakah env terbaca di runtime.
export const dynamic = "force-dynamic";

export async function GET() {
  const supabaseUrl = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL
  );
  const supabaseAnonKey = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY
  );
  const serviceRole = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
  const databaseUrl = Boolean(process.env.DATABASE_URL);

  // `vercel env pull` menulis "[SENSITIVE]" untuk secret; nilai itu tidak bisa dipakai.
  const isPlaceholder = (value?: string) =>
    !value || /^\[?SENSITIVE\]?$/i.test(value.trim());
  const supabaseUrlValid = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL
  ) && !isPlaceholder(process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL);
  const supabaseKeyValid = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY
  ) && !isPlaceholder(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY);
  const databaseUrlValid = Boolean(process.env.DATABASE_URL) && !isPlaceholder(process.env.DATABASE_URL);

  let databaseReachable: boolean | null = null;
  if (databaseUrlValid) {
    try {
      await prisma.$queryRaw`SELECT 1`;
      databaseReachable = true;
    } catch {
      databaseReachable = false;
    }
  }

  return NextResponse.json({
    ok: supabaseUrlValid && supabaseKeyValid && databaseUrlValid && databaseReachable !== false,
    supabaseUrl,
    supabaseAnonKey,
    serviceRole,
    databaseUrl,
    supabaseUrlValid,
    supabaseKeyValid,
    databaseUrlValid,
    databaseReachable,
    note:
      supabaseUrlValid && supabaseKeyValid && databaseUrlValid
        ? "Env terbaca. Jika databaseReachable=false, periksa DATABASE_URL (host/port/password) di dashboard Supabase."
        : "Nilai env masih placeholder; isi nilai asli dari dashboard Supabase ke .env lalu restart server.",
    nodeEnv: process.env.NODE_ENV ?? null,
  });
}
