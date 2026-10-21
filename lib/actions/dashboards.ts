"use server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

/** Ambil ID user login + profilnya dari server. Aman saat DB/auth belum aktif. */
export async function getSessionProfile() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    return await prisma.profile.findUnique({ where: { id: user.id } });
  } catch {
    // DB/auth belum terkonfigurasi — anggap belum login, jangan crash.
    return null;
  }
}

export type ParticipantRow = {
  id: string;
  name: string;
  className: string;
  email: string | null;
  progress: number;
  score: number | null;
  status: "Aktif" | "Selesai" | "Baru";
  lastActive: string;
  activities: number;
  joinedAt: string;
};

/**
 * Daftar peserta sebuah course, milik guru yang login.
 * Bergantung pada enrollment di database — siswa yang join lewat link langsung muncul,
 * tanpa impor manual. Hanya mengembalikan course yang dimiliki guru tsb.
 */
type ViewerProfile = Awaited<ReturnType<typeof getSessionProfile>>;

export async function getCourseParticipants(
  courseId: string,
  viewer?: ViewerProfile
): Promise<{
  ok: boolean;
  rows?: ParticipantRow[];
  error?: string;
}> {
  try {
    const me = viewer ?? (await getSessionProfile());
    if (!me || me.role !== "TEACHER" || !me.isActive)
      return { ok: false, error: "Hanya guru yang boleh melihat peserta." };

  // Pastikan course benar milik guru ini (otorisasi di server).
  const course = await prisma.course.findFirst({
    where: { id: courseId, ownerId: me.id },
    select: { id: true },
  });
  if (!course) return { ok: false, error: "Pembelajaran tidak ditemukan atau bukan milikmu." };

  const enrollments = await prisma.enrollment.findMany({
    where: { courseId, status: "ACTIVE" },
    include: {
      student: { select: { id: true, fullName: true, className: true, lastActive: true } },
      course: {
        select: {
          modules: { select: { _count: { select: { blocks: true } } } },
        },
      },
    },
    orderBy: { joinedAt: "desc" },
  });

  const totalBlocks = enrollments[0]?.course.modules.reduce((s, m) => s + m._count.blocks, 0) ?? 0;

  const rows: ParticipantRow[] = await Promise.all(
    enrollments.map(async (e) => {
      const doneBlocks = await prisma.progress.count({
        where: { studentId: e.studentId, courseId, completed: true },
      });
      const progress = totalBlocks > 0 ? Math.round((doneBlocks / totalBlocks) * 100) : 0;

      const graded = await prisma.quizAttempt.findMany({
        where: { studentId: e.studentId, courseId },
        orderBy: { submittedAt: "desc" },
      });
      const score = graded.length
        ? Math.round(
            graded.reduce((s, a) => s + (a.totalPoints ? (a.score / a.totalPoints) * 100 : 0), 0) /
              graded.length
          )
        : null;

      const activities = await prisma.progress.count({
        where: { studentId: e.studentId, courseId, completed: true },
      });

      return {
        id: e.studentId,
        name: e.student.fullName,
        className: e.student.className ?? "—",
        email: null,
        progress,
        score,
        status: progress >= 100 ? "Selesai" : progress > 0 ? "Aktif" : "Baru",
        lastActive: formatRelative(e.student.lastActive),
        activities,
        joinedAt: e.joinedAt.toISOString(),
      };
    })
  );

  return { ok: true, rows };
  } catch {
    return { ok: false, error: "DATABASE_UNAVAILABLE" };
  }
}

export type StudentCourseCard = {
  courseId: string;
  slug: string;
  title: string;
  shortTitle: string;
  description: string;
  subject: string;
  grade: string;
  teacherName: string;
  state: string;
  access: string;
  progress: number;
  joinedAt: string;
};

/**
 * Semua pembelajaran yang diikuti siswa dari enrollment database.
 * Saat login di perangkat lain, daftar ini dimuat dari server, bukan browser lama.
 */
export async function getMyEnrollments(): Promise<StudentCourseCard[]> {
  try {
    const me = await getSessionProfile();
    if (!me) return [];

  const enrollments = await prisma.enrollment.findMany({
    where: { studentId: me.id, status: "ACTIVE" },
    include: {
      course: {
        include: {
          owner: { select: { fullName: true } },
          modules: { select: { _count: { select: { blocks: true } } } },
        },
      },
    },
    orderBy: { joinedAt: "desc" },
  });

  return Promise.all(
    enrollments.map(async (e) => {
      const totalBlocks = e.course.modules.reduce((s, m) => s + m._count.blocks, 0);
      const done = await prisma.progress.count({
        where: { studentId: me.id, courseId: e.courseId, completed: true },
      });
      return {
        courseId: e.courseId,
        slug: e.course.slug,
        title: e.course.title,
        shortTitle: e.course.shortTitle,
        description: e.course.description,
        subject: e.course.subject,
        grade: e.course.grade,
        teacherName: e.course.owner.fullName,
        state: e.course.state,
        access: e.course.access,
        progress: totalBlocks > 0 ? Math.round((done / totalBlocks) * 100) : 0,
        joinedAt: e.joinedAt.toISOString(),
      };
    })
  );
  } catch {
    return [];
  }
}

export type PublishedCourseCard = {
  slug: string;
  title: string;
  shortTitle: string;
  description: string;
  subject: string;
  grade: string;
  duration: string;
  teacherName: string;
  moduleCount: number;
  blockCount: number;
  accent: string;
  joined: boolean;
};

/**
 * Katalog pembelajaran yang sudah dipublikasikan guru — dipakai halaman
 * "Pilih Pembelajaran" untuk siswa. Hanya course PUBLISHED yang tampil, dan
 * course yang sudah diikuti siswa ditandai supaya bisa langsung melanjutkan.
 */
export async function getPublishedCourses(): Promise<PublishedCourseCard[]> {
  try {
    const me = await getSessionProfile();
    const courses = await prisma.course.findMany({
      where: { state: "PUBLISHED" },
      include: {
        owner: { select: { fullName: true } },
        modules: { select: { accent: true, _count: { select: { blocks: true } } } },
      },
      orderBy: { updatedAt: "desc" },
    });

    const joinedIds = new Set<string>();
    if (me?.role === "STUDENT") {
      const rows = await prisma.enrollment.findMany({
        where: { studentId: me.id, status: "ACTIVE" },
        select: { courseId: true },
      });
      rows.forEach((row) => joinedIds.add(row.courseId));
    }

    const accents = ["violet", "teal", "yellow", "coral"];
    return courses.map((course, index) => ({
      slug: course.slug,
      title: course.title,
      shortTitle: course.shortTitle,
      description: course.description,
      subject: course.subject,
      grade: course.grade,
      duration: course.duration,
      teacherName: course.owner.fullName,
      moduleCount: course.modules.length,
      blockCount: course.modules.reduce((sum, m) => sum + m._count.blocks, 0),
      accent: course.modules[0]?.accent || accents[index % accents.length],
      joined: joinedIds.has(course.id),
    }));
  } catch {
    // Database belum aktif — katalog kosong, halaman tetap bisa dibuka.
    return [];
  }
}

/** Cari ID course by slug milik guru yang login (untuk halaman teacher). */
export async function getTeacherCourseIdBySlug(slug: string): Promise<string | null> {
  try {
    const me = await getSessionProfile();
    if (!me || me.role !== "TEACHER") return null;
    const course = await prisma.course.findFirst({
      where: { slug, ownerId: me.id },
      select: { id: true },
    });
    return course?.id ?? null;
  } catch {
    return null;
  }
}

/** Ambil courseId untuk slug bila siswa yang login punya enrollment ACTIVE. */
export async function getEnrolledCourseIdBySlug(slug: string): Promise<string | null> {
  try {
    const me = await getSessionProfile();
    if (!me || me.role !== "STUDENT") return null;
    const course = await prisma.course.findFirst({
      where: { slug },
      select: { id: true },
    });
    if (!course) return null;
    const enrollment = await prisma.enrollment.findUnique({
      where: { studentId_courseId: { studentId: me.id, courseId: course.id } },
      select: { status: true },
    });
    return enrollment && enrollment.status === "ACTIVE" ? course.id : null;
  } catch {
    return null;
  }
}

/** Statistik guru yang dihitung dari database, bukan angka statis. */
export async function getTeacherStats() {
  try {
    const me = await getSessionProfile();
    if (!me || me.role !== "TEACHER") return null;

  const courses = await prisma.course.findMany({
    where: { ownerId: me.id },
    select: { id: true },
  });
  const courseIds = courses.map((c) => c.id);

  const [uniqueStudents, enrollCount, doneBlocks, avgScoreAgg] = await Promise.all([
    prisma.enrollment.findMany({
      where: { courseId: { in: courseIds }, status: "ACTIVE" },
      distinct: ["studentId"],
      select: { studentId: true },
    }),
    prisma.enrollment.count({ where: { courseId: { in: courseIds }, status: "ACTIVE" } }),
    prisma.progress.count({
      where: { courseId: { in: courseIds }, completed: true },
    }),
    prisma.quizAttempt.aggregate({
      where: { courseId: { in: courseIds } },
      _avg: { score: true },
    }),
  ]);

  const totalBlocks = await prisma.lessonBlock.count({
    where: { module: { courseId: { in: courseIds } } },
  });

  return {
    courseCount: courses.length,
    uniqueStudents: uniqueStudents.length,
    enrollCount,
    completedActivities: doneBlocks,
    avgScore: avgScoreAgg._avg.score != null ? Math.round(avgScoreAgg._avg.score) : 0,
    avgProgress:
      uniqueStudents.length > 0 && totalBlocks > 0
        ? Math.round((doneBlocks / (uniqueStudents.length * totalBlocks)) * 100)
        : 0,
  };
  } catch {
    return null;
  }
}

export type TeacherCourseCard = {
  id: string;
  slug: string;
  joinToken: string;
  title: string;
  shortTitle: string;
  description: string;
  subject: string;
  grade: string;
  state: string;
  access: string;
  accent: string;
  moduleCount: number;
  blockCount: number;
  studentCount: number;
  averageProgress: number;
  updatedAt: string;
};

/**
 * Semua pembelajaran milik guru yang login — tidak ada data demo dan tidak ada
 * course milik guru lain. Guru baru menerima array kosong sehingga halamannya
 * benar-benar kosong sampai ia membuat pembelajaran sendiri.
 */
export async function getMyCourses(): Promise<TeacherCourseCard[]> {
  try {
    const me = await getSessionProfile();
    if (!me || me.role !== "TEACHER" || !me.isActive) return [];

    const courses = await prisma.course.findMany({
      where: { ownerId: me.id },
      include: {
        modules: {
          orderBy: { order: "asc" },
          select: { accent: true, _count: { select: { blocks: true } } },
        },
        _count: { select: { enrollments: { where: { status: "ACTIVE" } } } },
      },
      orderBy: { updatedAt: "desc" },
    });
    if (courses.length === 0) return [];

    const done = await prisma.progress.groupBy({
      by: ["courseId"],
      where: { courseId: { in: courses.map((c) => c.id) }, completed: true },
      _count: { _all: true },
    });
    const doneByCourse = new Map(done.map((row) => [row.courseId, row._count._all]));

    return courses.map((course) => {
      const blockCount = course.modules.reduce((sum, m) => sum + m._count.blocks, 0);
      const studentCount = course._count.enrollments;
      const completed = doneByCourse.get(course.id) ?? 0;
      return {
        id: course.id,
        slug: course.slug,
        joinToken: course.joinToken,
        title: course.title,
        shortTitle: course.shortTitle,
        description: course.description,
        subject: course.subject,
        grade: course.grade,
        state: course.state,
        access: course.access,
        accent: course.modules[0]?.accent || "violet",
        moduleCount: course.modules.length,
        blockCount,
        studentCount,
        averageProgress:
          studentCount > 0 && blockCount > 0
            ? Math.round((completed / (studentCount * blockCount)) * 100)
            : 0,
        updatedAt: course.updatedAt.toISOString(),
      };
    });
  } catch {
    return [];
  }
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/** Guru membuat pembelajaran baru; hanya course miliknya yang dibuat di database. */
export async function createTeacherCourse(input: {
  title: string;
  subject?: string;
  grade?: string;
  description?: string;
}): Promise<{ ok: boolean; error?: string; course?: TeacherCourseCard }> {
  try {
    const me = await getSessionProfile();
    if (!me || me.role !== "TEACHER" || !me.isActive)
      return { ok: false, error: "Hanya guru yang boleh membuat pembelajaran." };

    const title = input.title.trim();
    if (!title) return { ok: false, error: "Judul pembelajaran wajib diisi." };

    const base = slugify(title) || "pembelajaran";
    let slug = `${base}-${Math.random().toString(36).slice(2, 6)}`;
    while (await prisma.course.findUnique({ where: { slug }, select: { id: true } })) {
      slug = `${base}-${Math.random().toString(36).slice(2, 6)}`;
    }

    const created = await prisma.course.create({
      data: {
        slug,
        title,
        shortTitle: title.length > 34 ? `${title.slice(0, 32)}…` : title,
        description: input.description?.trim() || "Pembelajaran baru — tambahkan modul dan materi.",
        subject: input.subject?.trim() || "Matematika",
        grade: input.grade?.trim() || "Kelas VII",
        state: "DRAFT",
        access: "OPEN",
        ownerId: me.id,
      },
    });

    return {
      ok: true,
      course: {
        id: created.id,
        slug: created.slug,
        joinToken: created.joinToken,
        title: created.title,
        shortTitle: created.shortTitle,
        description: created.description,
        subject: created.subject,
        grade: created.grade,
        state: created.state,
        access: created.access,
        accent: "violet",
        moduleCount: 0,
        blockCount: 0,
        studentCount: 0,
        averageProgress: 0,
        updatedAt: created.updatedAt.toISOString(),
      },
    };
  } catch {
    return { ok: false, error: "Gagal membuat pembelajaran baru." };
  }
}

/** Simpan judul/deskripsi pembelajaran dari course builder. */
export async function updateCourseMeta(
  courseId: string,
  input: { title?: string; description?: string; subject?: string; grade?: string }
): Promise<{ ok: boolean; error?: string }> {
  try {
    const me = await getSessionProfile();
    if (!me || me.role !== "TEACHER") return { ok: false, error: "Hanya guru yang boleh mengubah pembelajaran." };
    const course = await prisma.course.findFirst({
      where: { id: courseId, ownerId: me.id },
      select: { id: true },
    });
    if (!course) return { ok: false, error: "Pembelajaran bukan milikmu." };

    const title = input.title?.trim();
    await prisma.course.update({
      where: { id: courseId },
      data: {
        ...(title ? { title, shortTitle: title.length > 34 ? `${title.slice(0, 32)}…` : title } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.subject ? { subject: input.subject } : {}),
        ...(input.grade ? { grade: input.grade } : {}),
      },
    });
    return { ok: true };
  } catch {
    return { ok: false, error: "Gagal menyimpan identitas pembelajaran." };
  }
}

/**
 * Satu pintu data workspace guru: profil dibaca sekali, lalu peserta, modul,
 * analitik, jawaban, dan aktivitas diambil paralel untuk course miliknya.
 * Mengurangi lonjakan koneksi database saat halaman dibuka.
 */
export async function getTeacherWorkspace(courseId: string, slug: string) {
  try {
    const me = await getSessionProfile();
    if (!me || me.role !== "TEACHER" || !me.isActive) return null;

    const [participants, structure, analytics, submissions, activity] = await Promise.all([
      getCourseParticipants(courseId, me),
      getCourseStructure(slug, { teacherOnly: true, viewerId: me.id, viewerRole: me.role }),
      getCourseAnalytics(courseId, me),
      getCourseSubmissions(courseId, undefined, me),
      getTeacherCourseActivity(courseId, me),
    ]);

    return {
      participants: participants.ok && participants.rows ? participants.rows : [],
      structure,
      analytics,
      submissions,
      activity,
    };
  } catch {
    return null;
  }
}

/** Data course builder + profil guru dalam satu request (milik guru yang login). */
export async function getTeacherCourseBuilder(
  slug: string
): Promise<{ structure: DbCourse; teacherName: string } | null> {
  try {
    const me = await getSessionProfile();
    if (!me || me.role !== "TEACHER" || !me.isActive) return null;
    const structure = await getCourseStructure(slug, {
      teacherOnly: true,
      viewerId: me.id,
      viewerRole: me.role,
    });
    if (!structure) return null;
    return { structure, teacherName: me.fullName };
  } catch {
    return null;
  }
}

export type TeacherAccountRow = {
  id: string;
  name: string;
  courseCount: number;
  status: "Aktif" | "Nonaktif";
};

/**
 * Statistik platform untuk Admin — dihitung dari database, bukan angka statis.
 * Hanya Admin yang boleh memanggil; lainnya ditolak di server.
 */
export async function getAdminStats(): Promise<{
  ok: boolean;
  teacherCount?: number;
  studentCount?: number;
  courseCount?: number;
  enrollCount?: number;
  error?: string;
}> {
  try {
    const me = await getSessionProfile();
    if (!me || me.role !== "ADMIN" || !me.isActive)
      return { ok: false, error: "Hanya Admin yang boleh melihat statistik platform." };

    const [teacherCount, studentCount, courseCount, enrollCount] = await Promise.all([
      prisma.profile.count({ where: { role: "TEACHER" } }),
      prisma.profile.count({ where: { role: "STUDENT" } }),
      prisma.course.count(),
      prisma.enrollment.count({ where: { status: "ACTIVE" } }),
    ]);

    return { ok: true, teacherCount, studentCount, courseCount, enrollCount };
  } catch {
    return { ok: false, error: "DATABASE_UNAVAILABLE" };
  }
}

/** Daftar akun guru (dengan jumlah pembelajaran) untuk Admin. */
export async function getTeacherAccounts(): Promise<TeacherAccountRow[]> {
  try {
    const me = await getSessionProfile();
    if (!me || me.role !== "ADMIN") return [];

    const teachers = await prisma.profile.findMany({
      where: { role: "TEACHER" },
      include: { _count: { select: { coursesOwned: true } } },
      orderBy: { fullName: "asc" },
    });

    return teachers.map((t) => ({
      id: t.id,
      name: t.fullName,
      courseCount: t._count.coursesOwned,
      status: t.isActive ? "Aktif" : "Nonaktif",
    }));
  } catch {
    return [];
  }
}

/** Admin menonaktifkan/mengaktifkan akun guru. Dinonaktifkan memblokir login. */
export async function setTeacherActive(teacherId: string, active: boolean): Promise<{ ok: boolean; error?: string }> {
  try {
    const me = await getSessionProfile();
    if (!me || me.role !== "ADMIN") return { ok: false, error: "Hanya Admin yang boleh mengubah status akun." };

    const target = await prisma.profile.findUnique({ where: { id: teacherId } });
    if (!target || target.role !== "TEACHER") return { ok: false, error: "Akun guru tidak ditemukan." };

    await prisma.profile.update({ where: { id: teacherId }, data: { isActive: active } });
    await prisma.auditLog.create({
      data: {
        actorId: me.id,
        action: active ? "teacher.activated" : "teacher.deactivated",
        target: teacherId,
      },
    });
    return { ok: true };
  } catch {
    return { ok: false, error: "DATABASE_UNAVAILABLE" };
  }
}

export type DbLessonBlock = {
  id: string;
  moduleId: string;
  type: string;
  title: string;
  description: string;
  duration: string;
  material: unknown;
};export type DbModule = {
  id: string;
  title: string;
  eyebrow: string;
  duration: string;
  accent: string;
  order: number;

  blocks: DbLessonBlock[];
};

export type DbCourse = {
  id: string;
  slug: string;
  title: string;
  shortTitle: string;
  description: string;
  subject: string;
  grade: string;
  duration: string;
  state: string;
  access: string;
  joinToken: string;
  ownerName: string;
  modules: DbModule[];
};

/**
 * Struktur course (modul + blok) dari database.
 *
 * Penting: id blok di database inilah yang dipakai saat menyimpan progres,
 * jawaban, dan attempt kuis — bukan id demo lokal. Tanpa ini, penulisan ke
 * database gagal karena foreign key blok tidak ditemukan.
 *
 * - Siswa: hanya course PUBLISHED yang boleh dibaca.
 * - Guru: hanya course miliknya sendiri (teacherOnly).
 */
export async function getCourseStructure(
  slug: string,
  options?: { teacherOnly?: boolean; viewerId?: string; viewerRole?: string }
): Promise<DbCourse | null> {
  try {
    const course = await prisma.course.findUnique({
      where: { slug },
      include: {
        owner: { select: { fullName: true } },
        modules: {
          orderBy: { order: "asc" },
          include: { blocks: { orderBy: { order: "asc" } } },
        },
      },
    });
    if (!course) return null;

    if (options?.teacherOnly) {
      let viewerId = options.viewerId;
      let viewerRole = options.viewerRole;
      if (!viewerId || !viewerRole) {
        const me = await getSessionProfile();
        viewerId = me?.id;
        viewerRole = me?.role;
      }
      if (!viewerId || viewerRole !== "TEACHER" || course.ownerId !== viewerId) return null;
    } else if (course.state !== "PUBLISHED") {
      // Course draft/arsip tidak boleh dilihat siswa.
      return null;
    }

    return {
      id: course.id,
      slug: course.slug,
      title: course.title,
      shortTitle: course.shortTitle,
      description: course.description,
      subject: course.subject,
      grade: course.grade,
      duration: course.duration,
      state: course.state,
      access: course.access,
      joinToken: course.joinToken,
      ownerName: course.owner.fullName,
      modules: course.modules.map((m) => ({
        id: m.id,
        title: m.title,
        eyebrow: m.eyebrow,
        duration: m.duration,
        accent: m.accent,
        order: m.order,
        blocks: m.blocks.map((b) => ({
          id: b.id,
          moduleId: b.moduleId,
          type: b.type,
          title: b.title,
          description: b.description,
          duration: b.duration,
          material: b.material,
        })),
      })),
    };
  } catch {
    return null;
  }
}

/**
 * Status belajar siswa yang login untuk satu course: apakah sudah bergabung
 * dan blok mana yang sudah selesai. Disimpan di database, bukan di perangkat.
 */
export async function getMyCourseProgress(
  slug: string
): Promise<{ courseId: string; enrolled: boolean; completedBlockIds: string[] } | null> {
  try {
    const me = await getSessionProfile();
    if (!me || me.role !== "STUDENT") return null;

    const course = await prisma.course.findUnique({ where: { slug }, select: { id: true } });
    if (!course) return null;

    const [enrollment, progress] = await Promise.all([
      prisma.enrollment.findUnique({
        where: { studentId_courseId: { studentId: me.id, courseId: course.id } },
        select: { status: true },
      }),
      prisma.progress.findMany({
        where: { studentId: me.id, courseId: course.id, completed: true },
        select: { blockId: true },
      }),
    ]);

    return {
      courseId: course.id,
      enrolled: enrollment?.status === "ACTIVE",
      completedBlockIds: progress.map((p) => p.blockId),
    };
  } catch {
    return null;
  }
}

export type TeacherActivityRow = {
  id: string;
  kind: "progress" | "quiz" | "submission" | "enrollment";
  title: string;
  meta: string;
  at: string;
};

/** Aktivitas terbaru di course milik guru yang login (progress, kuis, jawaban, bergabung). */
export async function getTeacherCourseActivity(
  courseId: string,
  viewer?: ViewerProfile
): Promise<TeacherActivityRow[]> {
  try {
    const me = viewer ?? (await getSessionProfile());
    if (!me || me.role !== "TEACHER") return [];

    const course = await prisma.course.findFirst({
      where: { id: courseId, ownerId: me.id },
      select: { id: true, title: true },
    });
    if (!course) return [];

    const [progressRows, attempts, submissions, enrollments] = await Promise.all([
      prisma.progress.findMany({
        where: { courseId, completed: true },
        include: {
          student: { select: { fullName: true } },
          block: { select: { title: true } },
        },
        orderBy: { completedAt: "desc" },
        take: 20,
      }),
      prisma.quizAttempt.findMany({
        where: { courseId },
        include: {
          student: { select: { fullName: true } },
          block: { select: { title: true } },
        },
        orderBy: { submittedAt: "desc" },
        take: 20,
      }),
      prisma.submission.findMany({
        where: { courseId },
        include: {
          student: { select: { fullName: true } },
          block: { select: { title: true } },
        },
        orderBy: { submittedAt: "desc" },
        take: 20,
      }),
      prisma.enrollment.findMany({
        where: { courseId },
        include: { student: { select: { fullName: true } } },
        orderBy: { joinedAt: "desc" },
        take: 20,
      }),
    ]);

    const rows: TeacherActivityRow[] = [
      ...progressRows.map((p) => ({
        id: p.id,
        kind: "progress" as const,
        title: `${p.student.fullName} menyelesaikan ${p.block.title}`,
        meta: formatRelative(p.completedAt ?? p.updatedAt),
        at: (p.completedAt ?? p.updatedAt).toISOString(),
      })),
      ...attempts.map((a) => ({
        id: a.id,
        kind: "quiz" as const,
        title: `${a.student.fullName} mengerjakan ${a.block.title}`,
        meta: `Nilai ${a.totalPoints ? Math.round((a.score / a.totalPoints) * 100) : 0}%`,
        at: a.submittedAt.toISOString(),
      })),
      ...submissions.map((s) => ({
        id: s.id,
        kind: "submission" as const,
        title: `${s.student.fullName} mengirim jawaban ${s.block.title}`,
        meta: s.status === "GRADED" ? "Sudah dinilai" : "Menunggu review",
        at: s.submittedAt.toISOString(),
      })),
      ...enrollments.map((e) => ({
        id: e.id,
        kind: "enrollment" as const,
        title: `${e.student.fullName} bergabung lewat link kelas`,
        meta: formatRelative(e.joinedAt),
        at: e.joinedAt.toISOString(),
      })),
    ];

    return rows
      .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0))
      .slice(0, 12);
  } catch {
    return [];
  }
}

export type ModuleAnalyticsRow = {
  moduleId: string;
  module: string;
  activities: string;
  response: string;
  completion: number;
  score: number | null;
};

/** Analitik per modul dihitung dari data nyata: blok, progres siswa, dan nilai kuis. */
export async function getCourseAnalytics(
  courseId: string,
  viewer?: ViewerProfile
): Promise<{
  rows: ModuleAnalyticsRow[];
  needsReview: number;
  topQuiz: string | null;
}> {
  try {
    const me = viewer ?? (await getSessionProfile());
    if (!me || me.role !== "TEACHER") return { rows: [], needsReview: 0, topQuiz: null };

    const course = await prisma.course.findFirst({
      where: { id: courseId, ownerId: me.id },
      include: { modules: { orderBy: { order: "asc" }, include: { blocks: { orderBy: { order: "asc" } } } } },
    });
    if (!course) return { rows: [], needsReview: 0, topQuiz: null };

    const moduleIds = course.modules.map((m) => m.id);
    const blockIds = course.modules.flatMap((m) => m.blocks.map((b) => b.id));

    const [progressRows, attempts, submissions, enrolledCount] = await Promise.all([
      prisma.progress.findMany({
        where: { courseId, completed: true, blockId: { in: blockIds } },
        select: { blockId: true, studentId: true },
      }),
      prisma.quizAttempt.findMany({
        where: { courseId, blockId: { in: blockIds } },
        select: { blockId: true, score: true, totalPoints: true },
      }),
      prisma.submission.count({ where: { courseId, status: "SUBMITTED" } }),
      prisma.enrollment.count({ where: { courseId, status: "ACTIVE" } }),
    ]);

    const rows: ModuleAnalyticsRow[] = course.modules.map((m) => {
      const mBlockIds = m.blocks.map((b) => b.id);
      const done = progressRows.filter((p) => mBlockIds.includes(p.blockId));
      const studentsDone = new Set(done.map((p) => p.studentId)).size;
      const completion =
        enrolledCount > 0 && m.blocks.length > 0
          ? Math.round((studentsDone / enrolledCount) * 100)
          : 0;
      const moduleAttempts = attempts.filter((a) => mBlockIds.includes(a.blockId));
      const scored = moduleAttempts.filter((a) => a.totalPoints > 0);
      const score = scored.length
        ? Math.round(scored.reduce((sum, a) => sum + (a.score / a.totalPoints) * 100, 0) / scored.length)
        : null;
      const responses = done.length;
      return {
        moduleId: m.id,
        module: m.title,
        activities: m.blocks.map((b) => b.title).join(" · ") || "Belum ada materi",
        response: responses
          ? `${responses} jawaban tersimpan`
          : m.blocks.some((b) => b.type === "ASSIGNMENT" || b.type === "ACTIVITY" || b.type === "REFLECTION")
            ? "Belum ada respons"
            : "Materi",
        completion,
        score,
      };
    });

    // Kuis paling kuat = nilai rata-rata tertinggi.
    const quizBlocks = new Map<string, string>();
    for (const m of course.modules)
      for (const b of m.blocks) if (b.type === "QUIZ") quizBlocks.set(b.id, b.title);
    const byBlock = new Map<string, number[]>();
    for (const a of attempts) {
      if (!quizBlocks.has(a.blockId) || a.totalPoints <= 0) continue;
      const list = byBlock.get(a.blockId) ?? [];
      list.push((a.score / a.totalPoints) * 100);
      byBlock.set(a.blockId, list);
    }
    let topQuiz: string | null = null;
    let best = -1;
    for (const [blockId, scores] of byBlock) {
      const avg = scores.reduce((s, v) => s + v, 0) / scores.length;
      if (avg > best) {
        best = avg;
        topQuiz = quizBlocks.get(blockId) ?? null;
      }
    }

    return { rows, needsReview: submissions, topQuiz };
  } catch {
    return { rows: [], needsReview: 0, topQuiz: null };
  }
}

export type StudentSubmissionRow = {
  id: string;
  studentId: string;
  studentName: string;
  blockId: string;
  blockTitle: string;
  response: string;
  fileUrl: string | null;
  fileName: string | null;
  fileType: string | null;
  score: number | null;
  maxScore: number;
  status: string;
  submittedAt: string;
};

/** Jawaban yang dikirim siswa pada satu course (untuk review guru). */
export async function getCourseSubmissions(
  courseId: string,
  studentId?: string,
  viewer?: ViewerProfile
): Promise<StudentSubmissionRow[]> {
  try {
    const me = viewer ?? (await getSessionProfile());
    if (!me || me.role !== "TEACHER") return [];

    const course = await prisma.course.findFirst({
      where: { id: courseId, ownerId: me.id },
      select: { id: true },
    });
    if (!course) return [];

    const rows = await prisma.submission.findMany({
      where: { courseId, ...(studentId ? { studentId } : {}) },
      include: {
        student: { select: { fullName: true } },
        block: { select: { title: true } },
      },
      orderBy: { submittedAt: "desc" },
    });

    return rows.map((s) => ({
      id: s.id,
      studentId: s.studentId,
      studentName: s.student.fullName,
      blockId: s.blockId,
      blockTitle: s.block.title,
      response: s.response,
      fileUrl: s.fileUrl ?? null,
      fileName: s.fileName ?? null,
      fileType: s.fileType ?? null,
      score: s.score,
      maxScore: s.maxScore,
      status: s.status,
      submittedAt: s.submittedAt.toISOString(),
    }));
  } catch {
    return [];
  }
}

export type SaveCourseInput = {
  modules: Array<{
    id: string;
    title: string;
    eyebrow: string;
    duration?: string;
    accent: string;
    order: number;
    blocks: Array<{
      id: string;
      type: string;
      title: string;
      description: string;
      duration: string;
      order: number;
      material?: unknown;
    }>;
  }>;
};

/**
 * Simpan struktur course (modul + blok) milik guru yang login ke database.
 * Baris yang sudah ada di-update, yang baru di-create, yang dihapus di-remove —
 * sehingga materi guru benar-benar tersimpan, bukan hanya di browser.
 */
export async function saveCourseStructure(
  courseId: string,
  input: SaveCourseInput
): Promise<{ ok: boolean; error?: string; structure?: DbCourse }> {
  try {
    const me = await getSessionProfile();
    if (!me || me.role !== "TEACHER") return { ok: false, error: "Hanya guru yang boleh mengubah course." };

    const course = await prisma.course.findFirst({
      where: { id: courseId, ownerId: me.id },
      select: { id: true },
    });
    if (!course) return { ok: false, error: "Course tidak ditemukan atau bukan milikmu." };

    const existingModules = await prisma.module.findMany({
      where: { courseId },
      include: { blocks: true },
    });
    const existingModuleIds = new Set(existingModules.map((m) => m.id));
    const existingBlockIds = new Set(existingModules.flatMap((m) => m.blocks.map((b) => b.id)));

    const keepModuleIds: string[] = [];
    const keepBlockIds: string[] = [];

    for (const [mIndex, m] of input.modules.entries()) {
      const moduleId = existingModuleIds.has(m.id)
        ? m.id
        : (await prisma.module.create({
            data: {
              courseId,
              title: m.title,
              eyebrow: m.eyebrow,
              duration: m.duration || "10 menit",
              accent: m.accent,
              order: m.order ?? mIndex,
            },
          })).id;
      if (existingModuleIds.has(m.id)) {
        // Judul, label, dan durasi modul ikut tersimpan saat guru mengeditnya.
        await prisma.module.update({
          where: { id: moduleId },
          data: {
            title: m.title,
            eyebrow: m.eyebrow,
            duration: m.duration || "10 menit",
            accent: m.accent,
            order: m.order ?? mIndex,
          },
        });
      }
      keepModuleIds.push(moduleId);

      if (!existingModuleIds.has(m.id)) {
        // Baru dibuat — tidak ada blok lama.
        existingModuleIds.add(moduleId);
      }

      for (const [bIndex, b] of m.blocks.entries()) {
        const data = {
          type: (b.type || "text").toUpperCase() as "TEXT",
          title: b.title,
          description: b.description ?? "",
          duration: b.duration ?? "5 menit",
          order: b.order ?? bIndex,
          material: (b.material ?? undefined) as never,
        };
        if (existingBlockIds.has(b.id)) {
          await prisma.lessonBlock.update({ where: { id: b.id }, data });
          keepBlockIds.push(b.id);
        } else {
          const created = await prisma.lessonBlock.create({
            data: { ...data, moduleId },
          });
          keepBlockIds.push(created.id);
        }
      }
    }

    // Bersihkan berkas materi yang tidak lagi dipakai blok mana pun.
    const usedFileIds = input.modules
      .flatMap((m) => m.blocks)
      .map((b) => {
        const material = b.material as { pdfFileId?: string } | undefined;
        return material?.pdfFileId;
      })
      .filter((id): id is string => Boolean(id));
    await prisma.storedFile.deleteMany({
      where: {
        courseId,
        isPublic: true,
        ownerId: me.id,
        ...(usedFileIds.length ? { id: { notIn: usedFileIds } } : {}),
      },
    });

    // Hapus blok & modul yang tidak lagi ada.
    const removedBlocks = [...existingBlockIds].filter((id) => !keepBlockIds.includes(id));
    if (removedBlocks.length) {
      await prisma.lessonBlock.deleteMany({ where: { id: { in: removedBlocks } } });
    }
    const removedModules = [...existingModuleIds].filter((id) => !keepModuleIds.includes(id));
    if (removedModules.length) {
      await prisma.module.deleteMany({ where: { id: { in: removedModules } } });
    }

    // Kembalikan struktur terbaru supaya client memakai id blok yang benar.
    const courseRow = await prisma.course.findUnique({ where: { id: courseId }, select: { slug: true } });
    const fresh = courseRow ? await getCourseStructure(courseRow.slug, { teacherOnly: true }) : null;
    return { ok: true, structure: fresh ?? undefined };
  } catch {
    return { ok: false, error: "Gagal menyimpan struktur course." };
  }
}

/** Ubah status publikasi & akses course (terimpan ke database, bukan hanya browser). */
export async function updateCourseSettings(
  courseId: string,
  settings: { state?: "draft" | "published"; access?: "open" | "locked" }
): Promise<{ ok: boolean; error?: string }> {
  try {
    const me = await getSessionProfile();
    if (!me || me.role !== "TEACHER") return { ok: false, error: "Hanya guru yang boleh mengubah pengaturan." };

    const course = await prisma.course.findFirst({
      where: { id: courseId, ownerId: me.id },
      select: { id: true },
    });
    if (!course) return { ok: false, error: "Course tidak ditemukan atau bukan milikmu." };

    await prisma.course.update({
      where: { id: courseId },
      data: {
        ...(settings.state
          ? { state: settings.state === "published" ? ("PUBLISHED" as const) : ("DRAFT" as const) }
          : {}),
        ...(settings.access
          ? { access: settings.access === "open" ? ("OPEN" as const) : ("LOCKED" as const) }
          : {}),
      },
    });

    return { ok: true };
  } catch {
    return { ok: false, error: "Gagal menyimpan pengaturan course." };
  }
}

export type QuizDraftInput = {
  title: string;
  instructions: string;
  showScore: boolean;
  totalPoints: number;
  attempts: number;
  shuffle: boolean;
  passThreshold: number;
  questions: Array<{
    id: number;
    type: string;
    prompt: string;
    options: string[];
    answer: string;
    explanation: string;
    points: number;
  }>;
};

const questionTypeMap: Record<
  string,
  "MULTIPLE_CHOICE" | "TRUE_FALSE" | "SHORT_ANSWER" | "NUMBER" | "ESSAY"
> = {
  "multiple-choice": "MULTIPLE_CHOICE",
  "true-false": "TRUE_FALSE",
  "short-answer": "SHORT_ANSWER",
  number: "NUMBER",
  essay: "ESSAY",
};

/** Simpan draft kuis (soal + kunci + aturan skor) ke database milik guru. */
export async function saveQuizStructure(
  courseId: string,
  blockId: string,
  draft: QuizDraftInput
): Promise<{ ok: boolean; error?: string }> {
  try {
    const me = await getSessionProfile();
    if (!me || me.role !== "TEACHER") return { ok: false, error: "Hanya guru yang boleh mengubah kuis." };

    const block = await prisma.lessonBlock.findFirst({
      where: { id: blockId, module: { course: { ownerId: me.id } } },
      select: { id: true },
    });
    if (!block) return { ok: false, error: "Blok kuis tidak ditemukan di course milikmu." };

    const quiz = await prisma.quiz.upsert({
      where: { blockId },
      create: {
        blockId,
        title: draft.title,
        instructions: draft.instructions,
        totalPoints: draft.totalPoints,
        maxAttempts: draft.attempts,
        shuffle: draft.shuffle,
        passThreshold: draft.passThreshold,
        showScore: draft.showScore,
      },
      update: {
        title: draft.title,
        instructions: draft.instructions,
        totalPoints: draft.totalPoints,
        maxAttempts: draft.attempts,
        shuffle: draft.shuffle,
        passThreshold: draft.passThreshold,
        showScore: draft.showScore,
      },
    });

    await prisma.question.deleteMany({ where: { quizId: quiz.id } });
    await prisma.question.createMany({
      data: draft.questions.map((q, index) => ({
        quizId: quiz.id,
        type: questionTypeMap[q.type] ?? "MULTIPLE_CHOICE",
        prompt: q.prompt,
        options: q.options ?? [],
        answer: q.answer,
        explanation: q.explanation ?? "",
        points: q.points ?? 10,
        order: index,
      })),
    });

    return { ok: true };
  } catch {
    return { ok: false, error: "Gagal menyimpan kuis." };
  }
}

/**
 * Baca kuis untuk siswa. Kunci jawaban TIDAK dikirim ke client —
 * penilaian tetap dilakukan di server saat submit.
 */
export async function getQuizForBlock(blockId: string): Promise<{
  title: string;
  instructions: string;
  showScore: boolean;
  totalPoints: number;
  passThreshold: number;
  questions: Array<{
    id: string;
    prompt: string;
    options: string[];
    explanation: string;
    points: number;
  }>;
} | null> {
  try {
    const quiz = await prisma.quiz.findUnique({
      where: { blockId },
      include: { questions: { orderBy: { order: "asc" } } },
    });
    if (!quiz) return null;
    return {
      title: quiz.title,
      instructions: quiz.instructions,
      showScore: quiz.showScore,
      totalPoints: quiz.totalPoints,
      passThreshold: quiz.passThreshold,
      questions: quiz.questions.map((q) => ({
        id: q.id,
        prompt: q.prompt,
        options: Array.isArray(q.options) ? (q.options as string[]) : [],
        explanation: q.explanation,
        points: q.points,
      })),
    };
  } catch {
    return null;
  }
}

/**
 * Baca kuis lengkap (termasuk kunci jawaban) untuk builder guru.
 * Hanya pemilik blok yang boleh membacanya — siswa tidak boleh bisa ini.
 */
export async function getQuizForTeacher(blockId: string): Promise<{
  title: string;
  instructions: string;
  showScore: boolean;
  totalPoints: number;
  passThreshold: number;
  maxAttempts: number;
  shuffle: boolean;
  questions: Array<{
    id: string;
    type: string;
    prompt: string;
    options: string[];
    answer: string;
    explanation: string;
    points: number;
  }>;
} | null> {
  try {
    const me = await getSessionProfile();
    if (!me || me.role !== "TEACHER") return null;

    const block = await prisma.lessonBlock.findFirst({
      where: { id: blockId, module: { course: { ownerId: me.id } } },
      select: { id: true },
    });
    if (!block) return null;

    const quiz = await prisma.quiz.findUnique({
      where: { blockId },
      include: { questions: { orderBy: { order: "asc" } } },
    });
    if (!quiz) return null;

    return {
      title: quiz.title,
      instructions: quiz.instructions,
      showScore: quiz.showScore,
      totalPoints: quiz.totalPoints,
      passThreshold: quiz.passThreshold,
      maxAttempts: quiz.maxAttempts,
      shuffle: quiz.shuffle,
      questions: quiz.questions.map((q) => ({
        id: q.id,
        type: q.type,
        prompt: q.prompt,
        options: Array.isArray(q.options) ? (q.options as string[]) : [],
        answer: q.answer,
        explanation: q.explanation,
        points: q.points,
      })),
    };
  } catch {
    return null;
  }
}

export type GameConfigInput = {
  name: string;
  instructions: string;
  config: Record<string, unknown>;
};

/** Simpan konfigurasi game (draft atau terbit) ke database. */
export async function saveGameVersion(
  courseId: string,
  templateId: string,
  input: GameConfigInput,
  publish: boolean
): Promise<{ ok: boolean; error?: string; id?: string }> {
  try {
    const me = await getSessionProfile();
    if (!me || me.role !== "TEACHER") return { ok: false, error: "Hanya guru yang boleh menyimpan game." };

    const course = await prisma.course.findFirst({
      where: { id: courseId, ownerId: me.id },
      select: { id: true },
    });
    if (!course) return { ok: false, error: "Course tidak ditemukan atau bukan milikmu." };

    const existing = await prisma.gameVersion.findFirst({
      where: { courseId, templateId, isDraft: !publish },
      orderBy: { version: "desc" },
    });

    if (existing) {
      const updated = await prisma.gameVersion.update({
        where: { id: existing.id },
        data: {
          name: input.name,
          instructions: input.instructions,
          config: input.config as never,
          published: publish,
          isDraft: !publish,
        },
      });
      return { ok: true, id: updated.id };
    }

    const created = await prisma.gameVersion.create({
      data: {
        courseId,
        templateId,
        name: input.name,
        instructions: input.instructions,
        config: input.config as never,
        version: 1,
        published: publish,
        isDraft: !publish,
        createdBy: me.id,
      },
    });
    return { ok: true, id: created.id };
  } catch {
    return { ok: false, error: "Gagal menyimpan konfigurasi game." };
  }
}

/** Konfigurasi game yang sudah terbit (dipakai siswa saat mengerjakan game). */
export async function getPublishedGameVersion(
  courseId: string,
  templateId: string
): Promise<{ id: string; name: string; instructions: string; config: Record<string, unknown> } | null> {
  try {
    const version = await prisma.gameVersion.findFirst({
      where: { courseId, templateId, published: true },
      orderBy: { version: "desc" },
    });
    if (!version) return null;
    return {
      id: version.id,
      name: version.name,
      instructions: version.instructions,
      config: (version.config ?? {}) as Record<string, unknown>,
    };
  } catch {
    return null;
  }
}

function formatRelative(date: Date): string {
  const diff = Date.now() - date.getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "baru saja";
  if (m < 60) return `${m} menit lalu`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} jam lalu`;
  return `${Math.floor(h / 24)} hari lalu`;
}
