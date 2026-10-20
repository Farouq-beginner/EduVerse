import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const EMAIL = process.env.ADMIN_EMAIL ?? "admin@eduverse.id";
const PASSWORD = process.env.ADMIN_PASSWORD ?? "";
const FULLNAME = process.env.ADMIN_NAME ?? "Admin EduVerse";

async function main() {
  if (!SUPABASE_URL || !SERVICE_KEY) throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY belum di-set di .env");
  if (!PASSWORD || PASSWORD.length < 10)
    throw new Error("Set ADMIN_PASSWORD (min 10 karakter) di .env sebelum menjalankan bootstrap ini.");

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Cek apakah sudah ada ADMIN (bootstrap hanya sekali, lalu lanjutkan via rute Admin).
  const existingAdmins = await prisma.profile.count({ where: { role: "ADMIN" } });
  if (existingAdmins > 0) {
    console.log(`Sudah ada ${existingAdmins} Admin. Tidak membuat baru (bootstrap hanya sekali).`);
    return;
  }

  // 1. Buat user auth (email di-confirmed langsung).
  const { data: created, error } = await admin.auth.admin.createUser({
    email: EMAIL,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { fullName: FULLNAME, role: "ADMIN" },
  });

  if (error) {
    if (/already/i.test(error.message)) {
      console.log("Email admin sudah terdaftar di Auth; memastikan baris Profile Admin...");
      const { data: users } = await admin.auth.admin.listUsers();
      const u = users?.users.find((x) => x.email === EMAIL);
      if (!u) throw new Error("Email sudah dipakai tapi user tidak ditemukan: " + error.message);
      await prisma.profile.upsert({
        where: { id: u.id },
        update: { fullName: FULLNAME, role: "ADMIN", isActive: true },
        create: { id: u.id, fullName: FULLNAME, role: "ADMIN", isActive: true },
      });
      console.log("Profile Admin siap untuk", EMAIL);
      return;
    }
    throw new Error("Gagal membuat user Auth: " + error.message);
  }

  const uid = created.user?.id;
  if (!uid) throw new Error("User Auth dibuat tapi id kosong.");

  // 2. Buat/upsert Profile Admin. (Trigger handle_new_user mungkin sudah membuatnya sbg STUDENT.)
  await prisma.profile.upsert({
    where: { id: uid },
    update: { fullName: FULLNAME, role: "ADMIN", isActive: true },
    create: { id: uid, fullName: FULLNAME, role: "ADMIN", isActive: true },
  });

  console.log("ADMIN BERHASIL DIBUAT:", EMAIL, "(id:", uid + ")");
}

main()
  .catch((e) => {
    console.error("BOOTSTRAP GAGAL:", e?.message ?? e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
