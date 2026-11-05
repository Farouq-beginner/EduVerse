"use client";

/**
 * Cache data di sisi browser untuk satu sesi tab.
 *
 * Tujuan: saat pindah route/tab — bahkan reload halaman — data yang sudah
 * pernah diambil dipakai lagi seketika. Setelah jendela "segar" lewat, client
 * hanya menanyakan revisi data ke server (satu query agregat ringan). Bila
 * revisi sama, data lama tetap dipakai; bila berbeda, baru diambil ulang.
 */

type CacheEntry = {
  data: unknown;
  revision: string | null;
  storedAt: number;
};

const store = new Map<string, CacheEntry>();
const pingLog = new Map<string, { at: number; promise: Promise<string | null> }>();

/** Naikkan versi bila bentuk data berubah, agar cache lama tidak terpakai. */
const STORAGE_PREFIX = "eduverse-cache:v2:";
const MAX_PERSIST_CHARS = 200_000;

/** Selama data masih "segar", tidak ada request apa pun ke server. */
const DEFAULT_FRESH_MS = 15_000;

/**
 * Hanya data yang seluruhnya berupa JSON aman (string/angka) yang disimpan ke
 * sessionStorage. Workspace guru sengaja tidak dipersist karena memuat objek
 * tanggal yang akan berubah menjadi string setelah dibaca ulang.
 */
const PERSIST_PREFIXES = ["builder:", "meetings:", "structure:", "progress:"];

function canPersist(key: string): boolean {
  return PERSIST_PREFIXES.some((prefix) => key.startsWith(prefix));
}

export function readCache<T>(key: string): { data: T; revision: string | null; storedAt: number } | null {
  const entry = store.get(key);
  if (entry) return entry as { data: T; revision: string | null; storedAt: number };
  if (!canPersist(key)) return null;

  try {
    const raw = window.sessionStorage.getItem(STORAGE_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEntry;
    store.set(key, parsed);
    return parsed as { data: T; revision: string | null; storedAt: number };
  } catch {
    return null;
  }
}

export function writeCache(key: string, data: unknown, revision: string | null): void {
  const entry: CacheEntry = { data, revision, storedAt: Date.now() };
  store.set(key, entry);
  if (!canPersist(key)) return;

  try {
    const serialized = JSON.stringify(entry);
    // Data terlalu besar: cukup di memori agar tidak membebani browser.
    if (serialized.length > MAX_PERSIST_CHARS) return;
    window.sessionStorage.setItem(STORAGE_PREFIX + key, serialized);
  } catch {
    // Kuota penuh / tidak bisa diserialisasi — cache memori tetap dipakai.
  }
}

/** Hapus cache tertentu, atau semua cache yang berawalan `prefix`. */
export function invalidateCache(prefix?: string): void {
  const matches = (key: string) => !prefix || key.startsWith(prefix);

  for (const key of Array.from(store.keys())) {
    if (matches(key)) store.delete(key);
  }

  try {
    for (let i = window.sessionStorage.length - 1; i >= 0; i -= 1) {
      const rawKey = window.sessionStorage.key(i);
      if (!rawKey || !rawKey.startsWith(STORAGE_PREFIX)) continue;
      if (matches(rawKey.slice(STORAGE_PREFIX.length))) window.sessionStorage.removeItem(rawKey);
    }
  } catch {
    // sessionStorage tidak tersedia (mode privat) — abaikan.
  }
}

/**
 * Satu ping dipakai bersama oleh beberapa pemanggilan yang berdekatan,
 * sehingga halaman yang butuh dua data tidak mengirim dua ping terpisah.
 */
export function sharedPing(
  key: string,
  fn: () => Promise<string | null>,
  ttlMs = 3000
): Promise<string | null> {
  const hit = pingLog.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.promise;
  const promise = fn().catch(() => null);
  pingLog.set(key, { at: Date.now(), promise });
  return promise;
}

/**
 * Ambil data dengan strategi cache + ping revisi.
 *
 * 1. Cache masih segar → langsung pakai, tanpa request.
 * 2. Cache ada tapi lewat jendela segar → ping revisi. Sama? pakai cache.
 *    Beda? ambil ulang.
 * 3. Ping gagal/null → anggap berubah agar data tidak basi diam-diam.
 */
export async function loadWithCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  ping?: () => Promise<string | null>,
  options?: { freshMs?: number }
): Promise<T> {
  const cached = readCache<T>(key);
  const freshMs = options?.freshMs ?? DEFAULT_FRESH_MS;

  if (cached) {
    if (Date.now() - cached.storedAt < freshMs) return cached.data;
    if (!ping) return cached.data;

    const revision = await ping();

    // Ping gagal (mis. koneksi database sedang putus sesaat) BUKAN berarti data
    // berubah. Pakai cache dan coba ping lagi sebentar lagi, daripada memaksa
    // get ulang penuh yang justru membebani jaringan.
    if (revision === null) {
      writeCache(key, cached.data, cached.revision);
      return cached.data;
    }

    if (cached.revision !== null && revision === cached.revision) {
      // Isi ulang waktunya supaya jendela segar berikutnya juga gratis.
      writeCache(key, cached.data, cached.revision);
      return cached.data;
    }

    const data = await fetcher();
    writeCache(key, data, revision);
    return data;
  }

  const data = await fetcher();
  const revision = ping ? await ping() : null;
  writeCache(key, data, revision);
  return data;
}
