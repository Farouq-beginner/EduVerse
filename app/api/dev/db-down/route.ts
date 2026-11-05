import { NextResponse } from "next/server";
import { isDbSimulationOn, setDbSimulation } from "@/lib/dev-flags";

/**
 * Hanya untuk pengembangan: menyalakan simulasi database mati agar jalur
 * "logout otomatis saat database bermasalah" bisa diuji tanpa mematikan Supabase.
 * Di production route ini selalu 404.
 */
export async function GET(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ ok: false, error: "Tidak tersedia." }, { status: 404 });
  }

  const url = new URL(request.url);
  const on = url.searchParams.get("on");
  if (on !== null) setDbSimulation(on === "1" || on === "true");

  return NextResponse.json({ ok: true, simulateDbDown: isDbSimulationOn() });
}

export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ ok: false, error: "Tidak tersedia." }, { status: 404 });
  }

  let on = false;
  try {
    const body = (await request.json()) as { on?: boolean };
    on = Boolean(body?.on);
  } catch {
    on = false;
  }
  setDbSimulation(on);

  return NextResponse.json({ ok: true, simulateDbDown: isDbSimulationOn() });
}
