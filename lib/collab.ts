/**
 * Aturan kolaborasi per pertemuan.
 *
 * Setiap penyedia hanya menerima link miliknya sendiri: link Zoom tidak bisa
 * disimpan sebagai Google Classroom, dan sebaliknya. Validasi dijalankan di
 * server (sumber kebenaran) dan dipakai ulang di client untuk pesan cepat.
 */

export type CollabProviderId = "zoom" | "meet" | "classroom" | "teams";

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
    id: "classroom",
    label: "Google Classroom",
    short: "Classroom",
    hosts: ["classroom.google.com"],
    placeholder: "https://classroom.google.com/c/ABCDEFG",
    hint: "Buka kelas di Classroom lalu salin link kelasnya.",
    tone: "yellow",
  },
  {
    id: "teams",
    label: "Microsoft Teams",
    short: "Teams",
    hosts: ["teams.microsoft.com", "teams.live.com"],
    placeholder: "https://teams.microsoft.com/l/meetup-join/...",
    hint: "Gunakan link rapat Teams, bukan link file.",
    tone: "coral",
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
