import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const visualByTemplate: Record<string, string> = {
  "observing-questioning": "number-line-lab",
  "guided-exploration": "charge-cards",
  "group-investigation": "number-line-challenge",
  reflection: "number-line-lab",
};

async function renamePeople() {
  const profiles = await prisma.profile.findMany({ select: { id: true, fullName: true } });
  let changed = 0;
  for (const profile of profiles) {
    if (!/farouq/i.test(profile.fullName)) continue;
    const fullName = profile.fullName.replace(/farouq/gi, "Salma");
    await prisma.profile.update({ where: { id: profile.id }, data: { fullName } });
    console.log(`Profil ${profile.id}: "${profile.fullName}" → "${fullName}"`);
    changed += 1;
  }
  console.log(`Nama diganti: ${changed}`);
}

async function renameMeetingLabels() {
  const modules = await prisma.module.findMany({ select: { id: true, title: true, eyebrow: true } });
  let changed = 0;
  for (const module of modules) {
    if (!/\bmodul\b/i.test(module.eyebrow) && !/\bmodul\b/i.test(module.title)) continue;
    await prisma.module.update({
      where: { id: module.id },
      data: {
        eyebrow: module.eyebrow.replace(/\bmodul\b/gi, "Pertemuan"),
        title: module.title.replace(/\bmodul\b/gi, "Pertemuan"),
      },
    });
    changed += 1;
  }
  console.log(`Label pertemuan diperbarui: ${changed}`);
}

/** Hapus konfigurasi aktivitas lama; sisakan hanya visualId (mini game). */
async function cleanActivityMaterials() {
  const blocks = await prisma.lessonBlock.findMany({ select: { id: true, type: true, material: true } });
  let changed = 0;
  for (const block of blocks) {
    const material = (block.material ?? {}) as Record<string, unknown>;
    const activity = material.activity as Record<string, unknown> | undefined;
    if (!activity) continue;
    const keys = Object.keys(activity);
    const onlyVisual = keys.length === 1 && typeof activity.visualId === "string";
    if (onlyVisual) continue;
    const visualId =
      typeof activity.visualId === "string"
        ? activity.visualId
        : visualByTemplate[String(activity.templateId ?? "")] ?? "number-line-lab";
    await prisma.lessonBlock.update({
      where: { id: block.id },
      data: { material: { ...material, activity: { visualId } } as never },
    });
    changed += 1;
  }
  console.log(`Materi aktivitas dibersihkan: ${changed}`);
}

/** Buat snapshot terbit untuk course PUBLISHED yang belum punya snapshot. */
async function snapshotPublishedCourses() {
  const courses = await prisma.course.findMany({
    where: { state: "PUBLISHED", publish: null },
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

  for (const course of courses) {
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
          questions: block.quiz.questions.map((q) => ({
            id: q.id,
            prompt: q.prompt,
            options: Array.isArray(q.options) ? (q.options as string[]) : [],
            explanation: q.explanation,
            points: q.points,
            answer: q.answer,
          })),
        };
      }
    }

    const payload = {
      course: {
        title: course.title,
        shortTitle: course.shortTitle,
        description: course.description,
        subject: course.subject,
        grade: course.grade,
        duration: course.duration,
      },
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
      quizzes,
      publishedAt: new Date().toISOString(),
    };

    const now = new Date();
    await prisma.coursePublish.create({
      data: { courseId: course.id, payload: payload as never, publishedAt: now },
    });
    await prisma.course.update({
      where: { id: course.id },
      data: { publishedAt: now, draftUpdatedAt: now },
    });
    console.log(`Snapshot terbit dibuat untuk "${course.title}"`);
  }
  console.log(`Snapshot dibuat: ${courses.length}`);
}

async function main() {
  await renamePeople();
  await renameMeetingLabels();
  await cleanActivityMaterials();
  await snapshotPublishedCourses();
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
