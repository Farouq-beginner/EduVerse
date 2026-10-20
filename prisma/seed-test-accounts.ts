import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Akun test deterministik - hanya 1 guru, 1 admin, 1 siswa.
const ACCOUNTS = [
  { email: "teacher.a@eduverse.dev", password: "TeacherA!12345", fullName: "Guru Satu", role: "TEACHER" as const },
  { email: "admin.a@eduverse.dev", password: "AdminA!12345", fullName: "Admin Satu", role: "ADMIN" as const },
  { email: "student.a@eduverse.dev", password: "StudentA!12345", fullName: "Siswa Satu", role: "STUDENT" as const, className: "VII-B" },
];

async function ensureAccount(a: (typeof ACCOUNTS)[number]) {
  // Cari user di Auth
  const { data: list } = await admin.auth.admin.listUsers();
  let user = list?.users.find((u) => u.email === a.email);

  if (!user) {
    const { data: created, error } = await admin.auth.admin.createUser({
      email: a.email,
      password: a.password,
      email_confirm: true,
      user_metadata: { fullName: a.fullName, role: a.role },
    });
    if (error) return { email: a.email, ok: false, msg: "createUser: " + error.message };
    user = created.user;
  }
  if (!user) return { email: a.email, ok: false, msg: "user kosong" };

  // Sinkronkan Profile (role & isActive). Trigger mungkin membuatnya sbg STUDENT.
  await prisma.profile.upsert({
    where: { id: user.id },
    update: { fullName: a.fullName, role: a.role, isActive: true, className: (a as any).className ?? null },
    create: {
      id: user.id,
      fullName: a.fullName,
      role: a.role,
      isActive: true,
      className: (a as any).className ?? null,
    },
  });

  // Verifikasi login (credential test).
  const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error: loginErr } = await sb.auth.signInWithPassword({ email: a.email, password: a.password });
  if (loginErr) return { email: a.email, ok: false, msg: "login: " + loginErr.message };

  const prof = await prisma.profile.findUnique({ where: { id: user.id } });
  return { email: a.email, ok: true, role: prof?.role, id: user.id };
}

async function main() {
  for (const a of ACCOUNTS) {
    const r = await ensureAccount(a);
    if (r.ok) console.log(`OK   ${r.email}  role=${r.role}  id=${r.id}`);
    else console.log(`GAGAL ${r.email}  :: ${r.msg}`);
  }
}

main()
  .catch((e) => {
    console.error("ERR:", e?.message ?? e);
    process.exit(1);
  })
  .finally(async () => prisma.$disconnect());
