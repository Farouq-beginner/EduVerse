// Cek cepat: apakah .env.local berisi nilai asli atau masih placeholder Vercel.
// Jalankan: node scripts/check-env.mjs
import fs from "node:fs";

const files = [".env.local", ".env", ".env.production"];
const required = [
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "DATABASE_URL",
  "DIRECT_URL",
];

function parse(file) {
  if (!fs.existsSync(file)) return {};
  const out = {};
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;
    out[match[1]] = match[2].trim().replace(/^["']|["']$/g, "");
  }
  return out;
}

const merged = {};
for (const file of files) Object.assign(merged, parse(file));

const isPlaceholder = (value) => !value || /^\[?SENSITIVE\]?$/i.test(value);

let missing = 0;
for (const key of required) {
  const value = merged[key];
  const ok = !isPlaceholder(value);
  if (!ok) missing += 1;
  const status = !value ? "KOSONG" : ok ? "OK" : "PLACEHOLDER";
  console.log(`${status.padEnd(12)} ${key}${ok ? ` (${value.length} karakter)` : ""}`);
}

console.log(
  missing === 0
    ? "Semua env wajib terbaca. Server siap dipakai login."
    : `${missing} env masih perlu diisi nilai aslinya (ambil dari dashboard Supabase, bukan dari Vercel).`
);
process.exit(missing === 0 ? 0 : 1);
