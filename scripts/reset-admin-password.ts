import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { PrismaClient } from "@prisma/client";

/**
 * Setel ulang password satu akun (default: Admin).
 * Pemakaian: npx tsx scripts/reset-admin-password.ts email@admin "PasswordBaru123!"
 * Password bisa juga diberikan lewat env ADMIN_NEW_PASSWORD.
 */
const prisma = new PrismaClient();

async function main() {
  const email = (process.argv[2] ?? process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
  const password = process.argv[3] ?? process.env.ADMIN_NEW_PASSWORD ?? "";

  if (!email.includes("@")) throw new Error("Sertakan email: npx tsx scripts/reset-admin-password.ts email@admin");
  if (password.length < 8) throw new Error("Password minimal 8 karakter.");

  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY belum disetel di .env");

  const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (error) throw new Error(error.message);

  const user = data.users.find((item) => (item.email ?? "").toLowerCase() === email);
  if (!user) throw new Error(`Akun ${email} tidak ditemukan di Supabase Auth.`);

  const updated = await admin.auth.admin.updateUserById(user.id, {
    password,
    email_confirm: true,
  });
  if (updated.error) throw new Error(updated.error.message);

  const profile = await prisma.profile.findUnique({ where: { id: user.id } });
  console.log(
    `Password ${email} diperbarui. Peran: ${profile?.role ?? "tidak ada profil"}${profile ? "" : " (buat profil lewat bootstrap-admin)"}`
  );
}

main()
  .catch((error) => {
    console.error("GAGAL:", error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
