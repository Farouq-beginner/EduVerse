import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Logout terprogram: dipakai saat sesi idle atau database bermasalah. */
export async function POST(request: Request) {
  let reason: string | null = null;
  try {
    const body = (await request.json()) as { reason?: string };
    reason = body?.reason ?? null;
  } catch {
    // Body opsional; logout tetap dijalankan.
  }

  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } catch {
    // Env/sesi belum siap — anggap sudah keluar.
  }

  return NextResponse.json({ ok: true, reason });
}
