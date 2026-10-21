"use server";

import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

async function getViewer() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    return await prisma.profile.findUnique({ where: { id: user.id } });
  } catch {
    return null;
  }
}

/** Hapus berkas materi milik guru (mis. saat blok atau PDF diganti). */
export async function deleteStoredFile(fileId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const me = await getViewer();
    if (!me) return { ok: false, error: "Sesi berakhir." };

    const file = await prisma.storedFile.findUnique({
      where: { id: fileId },
      select: { ownerId: true, courseId: true },
    });
    if (!file) return { ok: true };

    let allowed = me.role === "ADMIN" || file.ownerId === me.id;
    if (!allowed && me.role === "TEACHER" && file.courseId) {
      const course = await prisma.course.findFirst({
        where: { id: file.courseId, ownerId: me.id },
        select: { id: true },
      });
      allowed = Boolean(course);
    }
    if (!allowed) return { ok: false, error: "Berkas ini bukan milikmu." };

    await prisma.storedFile.delete({ where: { id: fileId } });
    return { ok: true };
  } catch {
    return { ok: false, error: "Gagal menghapus berkas." };
  }
}

export type MySubmission = {
  response: string;
  fileUrl: string | null;
  fileName: string | null;
  fileType: string | null;
  score: number | null;
  maxScore: number;
  status: string;
  submittedAt: string;
};

/**
 * Jawaban siswa yang sudah tersimpan dimuat ulang saat halaman dibuka kembali,
 * supaya teks dan lampiran tidak hilang setelah refresh.
 */
export async function getMySubmission(
  courseId: string,
  blockId: string
): Promise<MySubmission | null> {
  try {
    const me = await getViewer();
    if (!me || me.role !== "STUDENT") return null;

    const row = await prisma.submission.findFirst({
      where: { studentId: me.id, courseId, blockId },
      orderBy: { submittedAt: "desc" },
    });
    if (!row) return null;

    return {
      response: row.response,
      fileUrl: row.fileUrl,
      fileName: row.fileName,
      fileType: row.fileType,
      score: row.score,
      maxScore: row.maxScore,
      status: row.status,
      submittedAt: row.submittedAt.toISOString(),
    };
  } catch {
    return null;
  }
}

/** Guru menghapus satu jawaban siswa (opsional saat materi dihapus/diganti). */
export async function deleteSubmission(submissionId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const me = await getViewer();
    if (!me || me.role !== "TEACHER") return { ok: false, error: "Hanya guru yang boleh menghapus jawaban." };

    const row = await prisma.submission.findUnique({
      where: { id: submissionId },
      select: { course: { select: { ownerId: true } } },
    });
    if (!row || row.course.ownerId !== me.id)
      return { ok: false, error: "Jawaban bukan milik course-mu." };

    await prisma.submission.delete({ where: { id: submissionId } });
    return { ok: true };
  } catch {
    return { ok: false, error: "Gagal menghapus jawaban." };
  }
}
