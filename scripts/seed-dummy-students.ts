/**
 * Tujuh akun siswa dummy, masing-masing dengan pembelajaran sendiri.
 *
 * Setiap siswa mendapat salinan pembelajaran contoh (modul, blok, kuis, kelompok)
 * sebagai course terpisah yang hanya diikuti olehnya, sehingga progres, jawaban,
 * chat, dan tugas tiap siswa tidak saling bercampur.
 *
 * Jalankan: npx tsx scripts/seed-dummy-students.ts
 * Idempoten: akun dan course yang sudah ada dipakai ulang (konten hanya disalin
 * saat course siswa masih kosong).
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
const TEMPLATE_SLUG = "operasi-bilangan-bulat";

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

type TemplateCourse = NonNullable<Awaited<ReturnType<typeof loadTemplate>>>;

async function loadTemplate() {
  return prisma.course.findUnique({
    where: { slug: TEMPLATE_SLUG },
    include: {
      modules: {
        orderBy: { order: "asc" },
        include: {
          meetings: true,
          blocks: {
            orderBy: { order: "asc" },
            include: { quiz: { include: { questions: { orderBy: { order: "asc" } } } } },
          },
        },
      },
    },
  });
}

function buildPayload(
  course: {
    title: string;
    shortTitle: string;
    description: string;
    subject: string;
    grade: string;
    duration: string;
    modules: Array<{
      id: string;
      title: string;
      eyebrow: string;
      duration: string;
      accent: string;
      order: number;
      blocks: Array<{
        id: string;
        moduleId: string;
        type: string;
        title: string;
        description: string;
        duration: string;
        material: unknown;
        quiz: {
          title: string;
          instructions: string;
          totalPoints: number;
          maxAttempts: number;
          passThreshold: number;
          showScore: boolean;
          questions: Array<{
            id: string;
            prompt: string;
            options: unknown;
            explanation: string;
            points: number;
            answer: string;
          }>;
        } | null;
      }>;
    }>;
  },
  now: Date
) {
  const quizzes: Record<string, unknown> = {};

  for (const module of course.modules) {
    for (const block of module.blocks) {
      if (!block.quiz) continue;
      quizzes[block.id] = {
        title: block.quiz.title,
        instructions: block.quiz.instructions,
        totalPoints: block.quiz.totalPoints,
        maxAttempts: block.quiz.maxAttempts,
        passThreshold: block.quiz.passThreshold,
        showScore: block.quiz.showScore,
        questions: block.quiz.questions.map((question) => ({
          id: question.id,
          prompt: question.prompt,
          options: Array.isArray(question.options) ? question.options : [],
          explanation: question.explanation,
          points: question.points,
          answer: question.answer,
        })),
      };
    }
  }

  return {
    course: {
      title: course.title,
      shortTitle: course.shortTitle,
      description: course.description,
      subject: course.subject,
      grade: course.grade,
      duration: course.duration,
    },
    modules: course.modules.map((module) => ({
      id: module.id,
      title: module.title,
      eyebrow: module.eyebrow,
      duration: module.duration,
      accent: module.accent,
      order: module.order,
      blocks: module.blocks.map((block) => ({
        id: block.id,
        moduleId: block.moduleId,
        type: block.type,
        title: block.title,
        description: block.description,
        duration: block.duration,
        material: block.material,
      })),
    })),
    quizzes,
    publishedAt: now.toISOString(),
  };
}

async function ensureStudentCourse(
  template: TemplateCourse,
  student: { email: string; fullName: string },
  studentId: string
) {
  const suffix = student.email.split("@")[0];
  const slug = `${template.slug}-${suffix}`;
  const title = `${template.title} — ${student.fullName}`;

  let course = await prisma.course.findUnique({ where: { slug } });
  if (!course) {
    course = await prisma.course.create({
      data: {
        slug,
        title,
        shortTitle: template.shortTitle,
        description: template.description,
        subject: template.subject,
        grade: template.grade,
        duration: template.duration,
        ownerId: template.ownerId,
        access: template.access,
        state: "DRAFT",
      },
    });
  } else {
    await prisma.course.update({ where: { id: course.id }, data: { title } });
  }

  const existingModules = await prisma.module.count({ where: { courseId: course.id } });
  if (existingModules === 0) {
    for (const source of template.modules) {
      const module = await prisma.module.create({
        data: {
          courseId: course.id,
          title: source.title,
          eyebrow: source.eyebrow,
          accent: source.accent,
          order: source.order,
          duration: source.duration,
        },
      });

      for (const sourceBlock of source.blocks) {
        const block = await prisma.lessonBlock.create({
          data: {
            moduleId: module.id,
            type: sourceBlock.type,
            title: sourceBlock.title,
            description: sourceBlock.description,
            duration: sourceBlock.duration,
            order: sourceBlock.order,
            material: (sourceBlock.material ?? undefined) as never,
          },
        });

        if (!sourceBlock.quiz) continue;
        await prisma.quiz.create({
          data: {
            blockId: block.id,
            title: sourceBlock.quiz.title,
            instructions: sourceBlock.quiz.instructions,
            totalPoints: sourceBlock.quiz.totalPoints,
            maxAttempts: sourceBlock.quiz.maxAttempts,
            shuffle: sourceBlock.quiz.shuffle,
            passThreshold: sourceBlock.quiz.passThreshold,
            showScore: sourceBlock.quiz.showScore,
            questions: {
              create: sourceBlock.quiz.questions.map((question) => ({
                type: question.type,
                prompt: question.prompt,
                options: (question.options ?? undefined) as never,
                answer: question.answer,
                explanation: question.explanation,
                points: question.points,
                order: question.order,
              })),
            },
          },
        });
      }

      if (source.meetings.length > 0) {
        await prisma.meeting.createMany({
          data: source.meetings.map((meeting) => ({
            courseId: course!.id,
            moduleId: module.id,
            provider: meeting.provider,
            url: meeting.url,
          })),
        });
      }
    }
  }

  const roomCount = await prisma.groupRoom.count({ where: { courseId: course.id } });
  if (roomCount === 0) {
    await prisma.groupRoom.createMany({
      data: [
        {
          courseId: course.id,
          name: "Kelompok 1",
          instructions: "Diskusikan langkah pengerjaan bersama, lalu tulis hasilnya di tugas kelompok.",
          maxMembers: 5,
        },
        {
          courseId: course.id,
          name: "Kelompok 2",
          instructions: "Bandingkan cara penyelesaian dan tulis kesimpulan kelompok di tugas.",
          maxMembers: 5,
        },
      ],
    });
  }

  const fresh = await prisma.course.findUniqueOrThrow({
    where: { id: course.id },
    include: {
      modules: {
        orderBy: { order: "asc" },
        include: {
          blocks: {
            orderBy: { order: "asc" },
            include: { quiz: { include: { questions: { orderBy: { order: "asc" } } } } },
          },
        },
      },
    },
  });

  const now = new Date();
  const payload = buildPayload(fresh, now);
  await prisma.$transaction([
    prisma.coursePublish.upsert({
      where: { courseId: fresh.id },
      create: { courseId: fresh.id, payload: payload as never, publishedAt: now },
      update: { payload: payload as never, publishedAt: now },
    }),
    prisma.course.update({
      where: { id: fresh.id },
      data: { state: "PUBLISHED", publishedAt: now, draftUpdatedAt: now },
    }),
  ]);

  // Isolasi: hanya siswa ini yang terdaftar di pembelajarannya.
  await prisma.enrollment.deleteMany({
    where: { courseId: fresh.id, studentId: { not: studentId } },
  });
  await prisma.enrollment.upsert({
    where: { studentId_courseId: { studentId, courseId: fresh.id } },
    update: { status: "ACTIVE" },
    create: { studentId, courseId: fresh.id },
  });
  await prisma.enrollment.deleteMany({
    where: { studentId, courseId: { not: fresh.id } },
  });

  return fresh;
}

async function main() {
  const template = await loadTemplate();
  if (!template) {
    throw new Error(`Pembelajaran contoh "${TEMPLATE_SLUG}" tidak ditemukan.`);
  }

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

    const course = await ensureStudentCourse(template, student, userId);
    rows.push(
      `${student.email} | ${PASSWORD} | ${student.fullName} | /learn/${course.slug}`
    );
  }

  console.log(`Siswa dummy siap: ${STUDENTS.length} akun, masing-masing punya pembelajaran sendiri.`);
  console.log("email | password | nama | pembelajaran");
  rows.forEach((row) => console.log(row));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
