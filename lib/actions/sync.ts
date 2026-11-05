"use server";

import { prisma } from "@/lib/prisma";
import { getSessionProfile } from "@/lib/actions/dashboards";

/**
 * "Ping" perubahan data: satu query agregat yang jauh lebih murah daripada
 * mengambil ulang seluruh data halaman. Hasilnya berupa sidik revisi; bila
 * nilainya sama dengan yang tersimpan di browser, client tidak perlu get ulang.
 */

type RevisionRow = { rev: string };

async function courseRevision(courseId: string): Promise<string> {
  const rows = await prisma.$queryRaw<RevisionRow[]>`
    SELECT concat_ws('|',
      COALESCE((SELECT MAX(c."updatedAt")::text FROM "Course" c WHERE c.id = ${courseId}), ''),
      COALESCE((SELECT MAX(m."updatedAt")::text FROM "Module" m WHERE m."courseId" = ${courseId}), ''),
      COALESCE((SELECT MAX(b."updatedAt")::text FROM "LessonBlock" b
                JOIN "Module" m ON m.id = b."moduleId"
                WHERE m."courseId" = ${courseId}), ''),
      COALESCE((SELECT MAX(p."updatedAt")::text FROM "Progress" p WHERE p."courseId" = ${courseId}), ''),
      (SELECT COUNT(*)::text FROM "Enrollment" e WHERE e."courseId" = ${courseId} AND e.status = 'ACTIVE'),
      COALESCE((SELECT MAX(mt."updatedAt")::text FROM "Meeting" mt WHERE mt."courseId" = ${courseId}), ''),
      COALESCE((SELECT MAX(s."submittedAt")::text FROM "Submission" s WHERE s."courseId" = ${courseId}), ''),
      COALESCE((SELECT MAX(q."submittedAt")::text FROM "QuizAttempt" q WHERE q."courseId" = ${courseId}), '')
    ) AS rev
  `;
  return rows[0]?.rev ?? "";
}

/** Revisi data satu pembelajaran (dipakai course builder & halaman materi siswa). */
export async function getCourseRevisionBySlug(slug: string): Promise<string | null> {
  try {
    const me = await getSessionProfile();
    if (!me) return null;

    const course = await prisma.course.findUnique({
      where: { slug },
      select: { id: true, ownerId: true },
    });
    if (!course) return null;
    // Guru hanya boleh memantau pembelajarannya sendiri.
    if (me.role === "TEACHER" && course.ownerId !== me.id) return null;

    return await courseRevision(course.id);
  } catch {
    return null;
  }
}

/** Revisi data satu pembelajaran berdasarkan id (workspace guru). */
export async function getCourseRevisionById(courseId: string): Promise<string | null> {
  try {
    const me = await getSessionProfile();
    if (!me) return null;

    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: { ownerId: true },
    });
    if (!course) return null;
    if (me.role === "TEACHER" && course.ownerId !== me.id) return null;

    return await courseRevision(courseId);
  } catch {
    return null;
  }
}

/** Revisi ringkasan dashboard guru: daftar pembelajaran, peserta, dan progres. */
export async function getTeacherDashboardRevision(): Promise<string | null> {
  try {
    const me = await getSessionProfile();
    if (!me || me.role !== "TEACHER" || !me.isActive) return null;

    const rows = await prisma.$queryRaw<RevisionRow[]>`
      SELECT concat_ws('|',
        COALESCE((SELECT MAX(c."updatedAt")::text FROM "Course" c WHERE c."ownerId" = ${me.id}), ''),
        (SELECT COUNT(*)::text FROM "Course" c WHERE c."ownerId" = ${me.id}),
        (SELECT COUNT(*)::text FROM "Enrollment" e
         JOIN "Course" c ON c.id = e."courseId" WHERE c."ownerId" = ${me.id}),
        COALESCE((SELECT MAX(p."updatedAt")::text FROM "Progress" p
                  JOIN "Course" c ON c.id = p."courseId" WHERE c."ownerId" = ${me.id}), '')
      ) AS rev
    `;
    return rows[0]?.rev ?? "";
  } catch {
    return null;
  }
}
