/**
 * Aturan kolaborasi per pertemuan.
 *
 * Setiap penyedia hanya menerima link miliknya sendiri: link Zoom tidak bisa
 * disimpan sebagai Google Meet, dan sebaliknya. Validasi dijalankan di server
 * (sumber kebenaran) dan dipakai ulang di client untuk pesan cepat.
 *
 * Daftar penyedia mengikuti aplikasi yang benar-benar dipakai di kelas:
 * Zoom, Google Meet, Mathigon Polypad, GeoGebra, dan PhET.
 */

export type CollabProviderId = "zoom" | "meet" | "polypad" | "geogebra" | "phet";

export type CollabProvider = {
  id: CollabProviderId;
  label: string;
  short: string;
  /// Host yang diizinkan. Pencocokan juga menerima subdomain (us02web.zoom.us).
  hosts: string[];
  placeholder: string;
  hint: string;
  tone: "violet" | "teal" | "yellow" | "coral";
};

export const COLLAB_PROVIDERS: CollabProvider[] = [
  {
    id: "zoom",
    label: "Zoom",
    short: "Zoom",
    hosts: ["zoom.us", "zoom.com"],
    placeholder: "https://us02web.zoom.us/j/12345678901",
    hint: "Salin link rapat dari aplikasi Zoom (Join URL).",
    tone: "violet",
  },
  {
    id: "meet",
    label: "Google Meet",
    short: "Meet",
    hosts: ["meet.google.com"],
    placeholder: "https://meet.google.com/abc-defg-hij",
    hint: "Link Google Meet selalu berawalan meet.google.com.",
    tone: "teal",
  },
  {
    id: "polypad",
    label: "Mathigon Polypad",
    short: "Polypad",
    hosts: ["mathigon.org"],
    placeholder: "https://mathigon.org/polypad/abc123",
    hint: "Buka kanvas Polypad lalu salin link berbaginya.",
    tone: "yellow",
  },
  {
    id: "geogebra",
    label: "GeoGebra",
    short: "GeoGebra",
    hosts: ["geogebra.org"],
    placeholder: "https://www.geogebra.org/m/abcdefgh",
    hint: "Salin link applet atau aktivitas GeoGebra.",
    tone: "coral",
  },
  {
    id: "phet",
    label: "PhET",
    short: "PhET",
    hosts: ["phet.colorado.edu"],
    placeholder: "https://phet.colorado.edu/sims/html/build-an-atom/latest/build-an-atom_all.html",
    hint: "Salin link simulasi PhET yang ingin dibuka siswa.",
    tone: "violet",
  },
];

export function getCollabProvider(id: string): CollabProvider | null {
  return COLLAB_PROVIDERS.find((provider) => provider.id === id) ?? null;
}

/** Tambahkan skema https bila guru menempel link tanpa protokol. */
export function normalizeCollabUrl(raw: string): string {
  const value = raw.trim();
  if (!value) return "";
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

export type CollabValidation =
  | { ok: true; url: string }
  | { ok: false; error: string };

export function validateCollabUrl(providerId: string, raw: string): CollabValidation {
  const provider = getCollabProvider(providerId);
  if (!provider) return { ok: false, error: "Jenis kolaborasi tidak dikenal." };

  const value = normalizeCollabUrl(raw);
  if (!value) return { ok: false, error: `Link ${provider.label} belum diisi.` };

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return { ok: false, error: "Format link tidak valid. Tempel link lengkap dari aplikasi." };
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return { ok: false, error: "Link harus berupa alamat http atau https." };
  }

  const host = url.hostname.toLowerCase();
  const allowed = provider.hosts.some(
    (candidate) => host === candidate || host.endsWith(`.${candidate}`)
  );
  if (!allowed) {
    return {
      ok: false,
      error: `Link ini bukan dari ${provider.label}. Kolaborasi ${provider.label} hanya menerima link ${provider.hosts[0]}.`,
    };
  }

  return { ok: true, url: url.toString() };
}
