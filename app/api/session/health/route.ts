import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { isDbSimulationOn } from "@/lib/dev-flags";

/** Cek database dengan batas waktu, agar request tidak menggantung. */
async function pingDatabase(): Promise<boolean> {
  try {
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise((_, reject) => setTimeout(() => reject(new Error("db timeout")), 6000)),
    ]);
    return true;
  } catch {
    return false;
  }
}

/**
 * Dua percobaan sebelum menyimpulkan database bermasalah. Gangguan jaringan
 * sesaat (pooler timeout) tidak boleh langsung mengeluarkan pengguna.
 */
async function databaseAlive(): Promise<boolean> {
  if (isDbSimulationOn()) return false;
  if (await pingDatabase()) return true;
  await new Promise((resolve) => setTimeout(resolve, 1200));
  return pingDatabase();
}

/**
 * Dipanggil berkala oleh SessionGuard di sisi browser.
 * Bila database bermasalah, sesi langsung diakhiri (cookie login dibersihkan)
 * supaya pengguna tidak stuck di halaman yang datanya tidak bisa dimuat.
 */
export async function GET() {
  const alive = await databaseAlive();
  if (alive) {
    return NextResponse.json({ ok: true, db: true, loggedOut: false });
  }

  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } catch {
    // Sesi mungkin sudah tidak ada — tidak perlu menghentikan respons.
  }

  return NextResponse.json({ ok: false, db: false, loggedOut: true });
}
