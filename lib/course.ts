import type { DbCourse, DbLessonBlock, DbModule } from "@/lib/actions/dashboards";
import type { Course, LessonBlock, Module } from "@/lib/demo-data";

/**
 * Konversi baris database (dengan id blok miliknya sendiri) ke bentuk yang
 * dipakai komponen UI. Id blok dari database inilah yang wajib dipakai saat
 * menyimpan progres/jawaban — id demo lokal tidak ada di tabel LessonBlock.
 */
export function toLessonBlock(block: DbLessonBlock): LessonBlock {
  return {
    id: block.id,
    moduleId: block.moduleId,
    type: String(block.type).toLowerCase() as LessonBlock["type"],
    title: block.title,
    description: block.description,
    duration: block.duration,
    status: "ready",
    material: (block.material ?? {}) as LessonBlock["material"],
  };
}

export function toModule(module: DbModule): Module {
  return {
    id: module.id,
    title: module.title,
    eyebrow: module.eyebrow,
    duration: module.duration || "10 menit",
    accent: (module.accent || "violet") as Module["accent"],
    lessons: module.blocks.map(toLessonBlock),
  };
}

export function toCourse(course: DbCourse): Course {
  return {
    slug: course.slug,
    title: course.title,
    shortTitle: course.shortTitle,
    description: course.description,
    subject: course.subject,
    grade: course.grade,
    state: course.state === "PUBLISHED" ? "published" : "draft",
    access: course.access === "LOCKED" ? "locked" : "open",
    students: 0,
    averageProgress: 0,
    averageScore: 0,
    duration: course.duration,
    updatedAt: "",
    modules: course.modules.map(toModule),
  };
}

/** Petakan modul UI ke payload server (menormalkan id & urutan). */
export function toSavePayload(modules: Module[]) {
  return {
    modules: modules.map((module, moduleIndex) => ({
      id: module.id,
      title: module.title,
      eyebrow: module.eyebrow,
      duration: module.duration,
      accent: module.accent,
      order: moduleIndex,
      blocks: module.lessons.map((block, blockIndex) => ({
        id: block.id,
        type: block.type,
        title: block.title,
        description: block.description,
        duration: block.duration,
        order: blockIndex,
        material: block.material ?? undefined,
      })),
    })),
  };
}
