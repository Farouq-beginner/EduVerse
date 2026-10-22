"use server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import type { PublishedPayload } from "@/lib/actions/dashboards";

/**
 * Menyimpan progres penyelesaian satu blok materi oleh siswa yang login.
 *
 * - Idempoten: memakai eventId untuk mencegah duplikasi saat retry/offline queue.
 * - Otorisasi: hanya bisa menulis progres milik user login & enrollment aktif.
 * - Bergulir mundur bila bukan bagian dari transaksi (error → throw, client tampilkan gagal).
 */
export async function markBlockComplete(input: {
  courseId: string;
  blockId: string;
}): Promise<{ ok: boolean; error?: string }> {
  const { courseId, blockId } = input;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sesi berakhir. Silakan login." };

  // Cek enrollment aktif — siswa hanya boleh menulis progres bila bergabung.
  const enrollment = await prisma.enrollment.findUnique({
    where: { studentId_courseId: { studentId: user.id, courseId } },
  });
  if (!enrollment || enrollment.status !== "ACTIVE")
    return { ok: false, error: "Kamu belum bergabung ke pembelajaran ini." };

  // eventId ditentukan server: unik lintas siswa, deterministik per blok.
  const eventId = `${user.id}-${blockId}`;

  try {
    await prisma.progress.upsert({
      where: { studentId_blockId: { studentId: user.id, blockId } },
      update: { completed: true, completedAt: new Date() },
      create: {
        studentId: user.id,
        courseId,
        blockId,
        completed: true,
        completedAt: new Date(),
        eventId,
      },
    });
  } catch {
    // Retry dengan eventId yang sama dianggap sudah tersimpan — idempoten.
    const dupe = await prisma.progress.findFirst({
      where: { studentId: user.id, blockId },
    });
    if (!dupe) return { ok: false, error: "Gagal menyimpan progres. Coba lagi." };
  }

  await recalcEnrollmentProgress(user.id, courseId);
  return { ok: true };
}

/**
 * Menyimpan beberapa blok sekaligus (dipakai saat siswa login dan progres
 * perangkatnya perlu dipindahkan ke database). Hanya blok milik course yang
 * valid & hanya untuk siswa yang sudah bergabung.
 */
export async function syncBlockCompletions(input: {
  courseId: string;
  blockIds: string[];
}): Promise<{ ok: boolean; saved: number; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, saved: 0, error: "Sesi berakhir. Silakan login." };

  const enrollment = await prisma.enrollment.findUnique({
    where: { studentId_courseId: { studentId: user.id, courseId: input.courseId } },
  });
  if (!enrollment || enrollment.status !== "ACTIVE")
    return { ok: false, saved: 0, error: "Kamu belum bergabung ke pembelajaran ini." };

  const valid = await prisma.lessonBlock.findMany({
    where: { id: { in: input.blockIds }, module: { courseId: input.courseId } },
    select: { id: true },
  });

  let saved = 0;
  for (const block of valid) {
    try {
      await prisma.progress.upsert({
        where: { studentId_blockId: { studentId: user.id, blockId: block.id } },
        update: { completed: true, completedAt: new Date() },
        create: {
          studentId: user.id,
          courseId: input.courseId,
          blockId: block.id,
          completed: true,
          completedAt: new Date(),
          eventId: `${user.id}-${block.id}`,
        },
      });
      saved += 1;
    } catch {
      const existing = await prisma.progress.findFirst({
        where: { studentId: user.id, blockId: block.id },
      });
      if (existing) saved += 1;
    }
  }

  await recalcEnrollmentProgress(user.id, input.courseId);
  return { ok: true, saved };
}

/** Menghitung ulang progres rata-rata enrollment setelah ada perubahan blok. */
async function recalcEnrollmentProgress(studentId: string, courseId: string) {
  const [done, total] = await Promise.all([
    prisma.progress.count({
      where: { studentId, courseId, completed: true },
    }),
    prisma.lessonBlock.count({
      where: { module: { courseId } },
    }),
  ]);
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  await prisma.profile.update({
    where: { id: studentId },
    data: { lastActive: new Date() },
  });
  // Disimpan eksplisit bila model enrollment nanti menampung kolom progres;
  // untuk sekarang progres turunan dihitung dari progress di dashboard.
  return pct;
}

/** Menyimpan pengumpulan tugas/urain siswa (Submission). */
export async function submitAssignment(input: {
  courseId: string;
  blockId: string;
  response: string;
  fileUrl?: string;
  fileName?: string;
  fileType?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sesi berakhir. Silakan login." };

  const enrollment = await prisma.enrollment.findUnique({
    where: { studentId_courseId: { studentId: user.id, courseId: input.courseId } },
  });
  if (!enrollment || enrollment.status !== "ACTIVE")
    return { ok: false, error: "Kamu belum bergabung ke pembelajaran ini." };

  if (!input.response.trim() && !input.fileUrl)
    return { ok: false, error: "Jawaban atau lampiran wajib diisi." };

  // Satu jawaban per blok per siswa; pengiriman ulang memperbarui isi.
  const eventId = `${user.id}-${input.blockId}`;

  try {
    await prisma.submission.upsert({
      where: { eventId },
      update: {
        response: input.response,
        fileUrl: input.fileUrl ?? null,
        fileName: input.fileName ?? null,
        fileType: input.fileType ?? null,
        status: "SUBMITTED",
        submittedAt: new Date(),
      },
      create: {
        studentId: user.id,
        courseId: input.courseId,
        blockId: input.blockId,
        response: input.response,
        fileUrl: input.fileUrl ?? null,
        fileName: input.fileName ?? null,
        fileType: input.fileType ?? null,
        status: "SUBMITTED",
        eventId,
      },
    });
  } catch {
    return { ok: false, error: "Gagal menyimpan jawaban. Coba lagi." };
  }

  return { ok: true };
}

/**
 * Menyimpan attempt kuis. Skor dihitung server dari kunci jawaban (bukan dipercaya
 * dari client) sejauh arsitektur memungkinkan; attemptNumber dijaga unik.
 */
export async function submitQuizAttempt(input: {
  courseId: string;
  blockId: string;
  answers: Record<string, string>;
}): Promise<{ ok: boolean; score?: number; total?: number; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sesi berakhir. Silakan login." };

  const enrollment = await prisma.enrollment.findUnique({
    where: { studentId_courseId: { studentId: user.id, courseId: input.courseId } },
  });
  if (!enrollment || enrollment.status !== "ACTIVE")
    return { ok: false, error: "Kamu belum bergabung ke pembelajaran ini." };

  // Kuis yang dinilai adalah versi yang benar-benar dilihat siswa.
  const blockRow = await prisma.lessonBlock.findUnique({
    where: { id: input.blockId },
    select: {
      module: {
        select: {
          course: {
            select: { ownerId: true, publish: { select: { payload: true } } },
          },
        },
      },
    },
  });
  if (!blockRow) return { ok: false, error: "Kuis tidak ditemukan." };

  const publishedPayload = blockRow.module.course.publish?.payload as PublishedPayload | null | undefined;
  const publishedQuiz = publishedPayload?.quizzes?.[input.blockId];

  let maxAttempts: number;
  let passThreshold: number;
  let scoringQuestions: Array<{ id: string; answer: string; points: number }>;

  if (publishedQuiz) {
    // Siswa dinilai dari snapshot terbit, walau guru sedang menyunting draft.
    const liveQuiz = await prisma.quiz.findUnique({
      where: { blockId: input.blockId },
      include: { questions: true },
    });
    const liveAnswers = new Map(liveQuiz?.questions.map((q) => [q.id, q.answer]) ?? []);
    maxAttempts = publishedQuiz.maxAttempts;
    passThreshold = publishedQuiz.passThreshold;
    scoringQuestions = publishedQuiz.questions.map((q) => ({
      id: q.id,
      answer: q.answer ?? liveAnswers.get(q.id) ?? "",
      points: q.points,
    }));
  } else {
    const quiz = await prisma.quiz.findUnique({
      where: { blockId: input.blockId },
      include: { questions: true },
    });
    if (!quiz) return { ok: false, error: "Kuis tidak ditemukan." };
    maxAttempts = quiz.maxAttempts;
    passThreshold = quiz.passThreshold;
    scoringQuestions = quiz.questions.map((q) => ({ id: q.id, answer: q.answer, points: q.points }));
  }

  // Hitung skor di server dengan mencocokkan jawaban ke kunci.
  let score = 0;
  const total = scoringQuestions.reduce((sum, q) => sum + q.points, 0);
  const detail: Record<string, { given: string; correct: boolean }> = {};
  for (const q of scoringQuestions) {
    const given = input.answers[String(q.id)] ?? "";
    const correct = given.trim().toLowerCase() === q.answer.trim().toLowerCase();
    if (correct) score += q.points;
    detail[String(q.id)] = { given, correct };
  }

  const used = await prisma.quizAttempt.count({
    where: { studentId: user.id, blockId: input.blockId },
  });
  if (used >= maxAttempts)
    return { ok: false, error: `Kesempatan attempt habis (${maxAttempts}).` };

  try {
    await prisma.quizAttempt.create({
      data: {
        studentId: user.id,
        courseId: input.courseId,
        blockId: input.blockId,
        attemptNumber: used + 1,
        score,
        totalPoints: total,
        passed: total > 0 ? (score / total) * 100 >= passThreshold : false,
        answers: detail,
        // Unik per siswa + blok + percobaan (idempoten saat retry).
        eventId: `${user.id}-${input.blockId}-${used + 1}`,
      },
    });
  } catch {
    return { ok: false, error: "Gagal menyimpan hasil kuis. Coba lagi." };
  }

  return { ok: true, score, total };
}

/** Menyimpan hasil main game (bukan playtest) untuk penilaian bila diaktifkan. */
export async function saveGameAttempt(input: {
  courseId?: string;
  blockId?: string;
  gameVersionId: string;
  score: number;
  passed: boolean;
  details?: Record<string, unknown>;
}): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sesi berakhir. Silakan login." };

  await prisma.gameAttempt.create({
    data: {
      studentId: user.id,
      courseId: input.courseId,
      blockId: input.blockId,
      gameVersionId: input.gameVersionId,
      score: input.score,
      passed: input.passed,
      isPlaytest: false,
      details: (input.details ?? {}) as Prisma.InputJsonObject,
    },
  });

  return { ok: true };
}
