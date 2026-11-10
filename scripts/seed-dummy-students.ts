/**
 * Tujuh akun siswa dummy untuk menguji kelompok (room tugas).
 *
 * Jalankan: npx tsx scripts/seed-dummy-students.ts
 * Idempoten: akun yang sudah ada hanya diperbarui (password, profil, enrollment).
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const PASSWORD = "SiswaDummy2026!";
const CLASS_NAME = "VII-B";

const STUDENTS = [
  { email: "siswa1@eduverse.id", fullName: "Dewi Anggraini" },
  { email: "siswa2@eduverse.id", fullName: "Bagas Pratama" },
  { email: "siswa3@eduverse.id", fullName: "Citra Lestari" },
  { email: "siswa4@eduverse.id", fullName: "Fajar Nugroho" },
  { email: "siswa5@eduverse.id", fullName: "Gita Maharani" },
  { email: "siswa6@eduverse.id", fullName: "Hendra Saputra" },
  { email: "siswa7@eduverse.id", fullName: "Intan Permata" },
];

async function findUserByEmail(email: string) {
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const found = data.users.find((user) => user.email?.toLowerCase() === email.toLowerCase());
    if (found) return found;
    if (data.users.length < 200) break;
  }
  return null;
}

async function main() {
  const course =
    (await prisma.course.findUnique({ where: { slug: "operasi-bilangan-bulat" } })) ??
    (await prisma.course.findFirst({ orderBy: { createdAt: "asc" } }));

  const rows: string[] = [];

  for (const student of STUDENTS) {
    const existing = await findUserByEmail(student.email);
    let userId: string;

    if (existing) {
      userId = existing.id;
      const { error } = await admin.auth.admin.updateUserById(userId, {
        password: PASSWORD,
        email_confirm: true,
        user_metadata: { fullName: student.fullName },
      });
      if (error) throw error;
    } else {
      const { data, error } = await admin.auth.admin.createUser({
        email: student.email,
        password: PASSWORD,
        email_confirm: true,
        user_metadata: { fullName: student.fullName },
      });
      if (error) throw error;
      userId = data.user.id;
    }

    await prisma.profile.upsert({
      where: { id: userId },
      update: {
        fullName: student.fullName,
        role: "STUDENT",
        className: CLASS_NAME,
        isActive: true,
        isLocked: false,
      },
      create: {
        id: userId,
        fullName: student.fullName,
        role: "STUDENT",
        className: CLASS_NAME,
        isActive: true,
      },
    });

    if (course) {
      await prisma.enrollment.upsert({
        where: { studentId_courseId: { studentId: userId, courseId: course.id } },
        update: { status: "ACTIVE" },
        create: { studentId: userId, courseId: course.id },
      });
    }

    rows.push(`${student.email}  ${PASSWORD}  ${student.fullName}  ${CLASS_NAME}`);
  }

  console.log(`Siswa dummy siap: ${STUDENTS.length} akun.`);
  console.log("email | password | nama | kelas");
  rows.forEach((row) => console.log(row));
  if (course) {
    console.log(`Semua terdaftar di "${course.title}" (${course.slug}).`);
  } else {
    console.log("Tidak ada pembelajaran di database; enrollment dilewati.");
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
