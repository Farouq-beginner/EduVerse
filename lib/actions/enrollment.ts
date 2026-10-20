"use server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import type { AccessState, CourseState } from "@prisma/client";

export type JoinResult = {
  ok: boolean;
  error?: string;
  courseSlug?: string;
  already?: boolean;
};

/**
 * Siswa bergabung ke pembelajaran lewat link/token dari guru.
 *
 * Alur server:
 * 1. Verifikasi sesi siswa (harus login).
 * 2. Validasi token/join di database — bukan sekadar judul di client.
 * 3. Cek status publikasi (state) & akses (access).
 * 4. Cek enrollment ganda (unique constraint studentId+courseId).
 * 5. Buat Enrollment.
 */
export async function joinCourseByToken(input: {
  tokenOrSlug: string;
  className?: string;
}): Promise<JoinResult> {
  const key = input.tokenOrSlug.trim();
  if (!key) return { ok: false, error: "Link pembelajaran wajib diisi." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Silakan login terlebih dahulu." };

  const profile = await prisma.profile.findUnique({ where: { id: user.id } });
  if (!profile || profile.role !== "STUDENT" || !profile.isActive)
    return { ok: false, error: "Akun siswa tidak valid." };

  const course = await resolveCourse(key);
  if (!course)
    return { ok: false, error: "Link tidak valid atau sudah kedaluwarsa." };

  if (course.state === "DRAFT")
    return { ok: false, error: "Pembelajaran ini belum dipublikasikan." };
  if (course.state === "ARCHIVED")
    return { ok: false, error: "Pembelajaran ini sudah diarsipkan." };

  // Access control diterapkan di server, bukan hanya UI.
  if (course.access === "LOCKED")
    return { ok: false, error: "Akses pembelajaran sedang dikunci oleh guru." };

  // Enrollment ganda → deteksi dan jangan gandakan data.
  const existing = await prisma.enrollment.findUnique({
    where: { studentId_courseId: { studentId: user.id, courseId: course.id } },
  });
  if (existing && existing.status === "ACTIVE")
    return { ok: true, courseSlug: course.slug, already: true };

  if (input.className && input.className !== profile.className) {
    await prisma.profile.update({
      where: { id: user.id },
      data: { className: input.className },
    });
  }

  await prisma.enrollment.upsert({
    where: { studentId_courseId: { studentId: user.id, courseId: course.id } },
    update: { status: "ACTIVE" },
    create: { studentId: user.id, courseId: course.id, status: "ACTIVE" },
  });

  return { ok: true, courseSlug: course.slug, already: Boolean(existing) };
}

/** Keluar/sembunyikan pembelajaran dari dashboard siswa tanpa menghapus riwayat. */
export async function leaveCourse(courseId: string): Promise<JoinResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sesi berakhir. Silakan login." };

  const enrollment = await prisma.enrollment.findUnique({
    where: { studentId_courseId: { studentId: user.id, courseId } },
  });
  if (!enrollment) return { ok: false, error: "Kamu belum bergabung ke pembelajaran ini." };

  // Sembunyikan tampilan, TANPA menghapus riwayat belajar (retensi untuk guru).
  await prisma.enrollment.update({
    where: { id: enrollment.id },
    data: { status: "HIDDEN" },
  });

  return { ok: true };
}

/**
 * Resolusi satu key (link lengkap, slug, atau join token) → course di database.
 * Dipakai bersama oleh joinCourseByToken dan validateJoinToken agar keduanya
 * memakai aturan pencocokan yang sama (tidak ada lagi link valid yang ditolak
 * hanya karena salah satu jalur tidak mengenali formatnya).
 */
async function resolveCourse(key: string) {
  const cleanedKey = key.trim().split("?")[0].split("#")[0].replace(/\/+$/, "");
  const slugFromUrl = extractSlug(cleanedKey);
  const candidateKeys = Array.from(
    new Set([cleanedKey, slugFromUrl, key.trim()].filter(Boolean) as string[])
  );

  // Cocokkan persis: joinToken atau slug.
  let course = await prisma.course.findFirst({
    where: {
      OR: candidateKeys.flatMap((k) => [{ joinToken: k }, { slug: k }]),
    },
    include: { owner: { select: { fullName: true } } },
  });
  if (course) return course;

  // Link classroom ber-token: slug berisi token guru, mis.
  // "operasi-bilangan-bulat-a8f3" → cocokkan course yang slug-nya jadi prefix.
  if (slugFromUrl) {
    const allCourses = await prisma.course.findMany({
      select: {
        id: true,
        slug: true,
        joinToken: true,
        state: true,
        access: true,
        title: true,
        owner: { select: { fullName: true } },
      },
    });
    const match = allCourses.find(
      (c) => slugFromUrl.startsWith(c.slug) || (c.joinToken && slugFromUrl.includes(c.joinToken))
    );
    if (match) return match;
  }

  return null;
}

/** Ambil slug dari URL link lengkap, mis. /learn/operasi-bilangan-bulat-a8f3. */
function extractSlug(raw: string): string | null {
  try {
    const input = raw.trim();
    if (/^https?:\/\//i.test(input)) {
      const url = new URL(input);
      const parts = url.pathname.split("/").filter(Boolean);
      const idx = parts.indexOf("learn");
      if (idx >= 0 && parts[idx + 1]) return parts[idx + 1];
    }
    if (input.includes("/learn/")) {
      const afterLearn = input.split("/learn/")[1];
      if (afterLearn) {
        return afterLearn.split("/")[0].split("?")[0].split("#")[0];
      }
    }
    if (input.startsWith("learn/")) {
      const parts = input.split("/").filter(Boolean);
      if (parts[1]) return parts[1].split("?")[0].split("#")[0];
    }
  } catch {
    /* abaikan URL rusak */
  }
  return null;
}

/** Validasi token join dipakai oleh endpoint QR/link preview. */
export async function validateJoinToken(token: string): Promise<{
  valid: boolean;
  state?: CourseState;
  access?: AccessState;
  title?: string;
  slug?: string;
  ownerName?: string;
}> {
  const key = token.trim();
  if (!key) return { valid: false };
  const course = await resolveCourse(key);
  if (!course) return { valid: false };
  return {
    valid: true,
    state: course.state,
    access: course.access,
    title: course.title,
    slug: course.slug,
    ownerName: course.owner?.fullName,
  };
}
