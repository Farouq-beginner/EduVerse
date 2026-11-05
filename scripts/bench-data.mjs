// Benchmark: biaya "ping revisi" dibanding mengambil ulang data penuh.
// Jalankan: node scripts/bench-data.mjs
import fs from "node:fs";
import { PrismaClient } from "@prisma/client";

for (const line of fs.readFileSync(".env", "utf8").split(/\r?\n/)) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const m = t.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
  if (!m) continue;
  if (!process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL || process.env.DIRECT_URL } },
});

const REVISION_SQL = `SELECT concat_ws('|',
  COALESCE((SELECT MAX(c."updatedAt")::text FROM "Course" c WHERE c.id = $1), ''),
  COALESCE((SELECT MAX(m."updatedAt")::text FROM "Module" m WHERE m."courseId" = $1), ''),
  COALESCE((SELECT MAX(b."updatedAt")::text FROM "LessonBlock" b JOIN "Module" m ON m.id = b."moduleId" WHERE m."courseId" = $1), ''),
  COALESCE((SELECT MAX(pr."updatedAt")::text FROM "Progress" pr WHERE pr."courseId" = $1), ''),
  (SELECT COUNT(*)::text FROM "Enrollment" e WHERE e."courseId" = $1 AND e.status = 'ACTIVE'),
  COALESCE((SELECT MAX(mt."updatedAt")::text FROM "Meeting" mt WHERE mt."courseId" = $1), '')
) AS rev`;

async function time(label, fn) {
  const runs = [];
  for (let i = 0; i < 7; i += 1) {
    const started = process.hrtime.bigint();
    await fn();
    runs.push(Number(process.hrtime.bigint() - started) / 1e6);
  }
  runs.sort((a, b) => a - b);
  console.log(
    `${label}: median ${runs[3].toFixed(1)}ms (min ${runs[0].toFixed(1)}ms, max ${runs[6].toFixed(1)}ms)`
  );
}

const course = await prisma.course.findFirst({
  where: { slug: "operasi-bilangan-bulat" },
  select: { id: true, slug: true },
});

if (!course) {
  console.log("Course contoh tidak ditemukan.");
  await prisma.$disconnect();
  process.exit(0);
}

await time("PING revisi (6 agregat)", () =>
  prisma.$queryRawUnsafe(REVISION_SQL, course.id)
);

await time("GET struktur penuh (owner+publish+modules+blocks)", () =>
  prisma.course.findUnique({
    where: { slug: course.slug },
    include: {
      owner: { select: { fullName: true } },
      publish: { select: { payload: true, publishedAt: true } },
      modules: {
        orderBy: { order: "asc" },
        include: { blocks: { orderBy: { order: "asc" } } },
      },
    },
  })
);

await time("GET data workspace guru (peserta+progres+kuis+jawaban)", async () => {
  await prisma.enrollment.findMany({
    where: { courseId: course.id, status: "ACTIVE" },
    include: {
      student: { select: { id: true, fullName: true, className: true, lastActive: true } },
      course: { select: { modules: { select: { _count: { select: { blocks: true } } } } } },
    },
  });
  await prisma.progress.findMany({ where: { courseId: course.id, completed: true } });
  await prisma.quizAttempt.findMany({ where: { courseId: course.id } });
  await prisma.submission.findMany({ where: { courseId: course.id } });
});

await prisma.$disconnect();
