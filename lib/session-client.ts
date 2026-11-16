"use client";

/**
 * Cache profil sesi di sisi browser untuk satu tab.
 *
 * AppShell dan beberapa halaman memanggil getSessionProfile saat mount. Tanpa
 * cache, setiap perpindahan halaman mengirim permintaan sesi baru ke server
 * sehingga halaman terasa lambat. Satu permintaan dipakai bersama selama
 * jendela singkat di bawah ini.
 */

import { getSessionProfile } from "@/lib/actions/dashboards";

type SessionProfile = Awaited<ReturnType<typeof getSessionProfile>>;

const FRESH_MS = 60_000;

let entry: { at: number; promise: Promise<SessionProfile> } | null = null;

export function loadSessionProfile(force = false): Promise<SessionProfile> {
  const now = Date.now();
  if (!force && entry && now - entry.at < FRESH_MS) return entry.promise;

  entry = {
    at: now,
    promise: getSessionProfile().catch(() => null),
  };
  return entry.promise;
}

export function invalidateSessionProfile(): void {
  entry = null;
}
