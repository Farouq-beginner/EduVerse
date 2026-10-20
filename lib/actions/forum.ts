"use server";

import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import type { ForumPost } from "@/components/DiscussionForum";

/**
 * Mengambil daftar postingan forum diskusi berdasarkan modul tertentu.
 * Data forum bersifat spesifik per modul (beda modul, beda data diskusi).
 */
export async function getForumPostsByModule(
  moduleId: string,
  courseSlug: string = "operasi-bilangan-bulat"
): Promise<ForumPost[]> {
  try {
    const rawPosts = await prisma.$queryRawUnsafe<any[]>(
      `SELECT "id", "moduleId", "courseSlug", "authorId", "authorName", "role", "className", "title", "content", "likes", "createdAt"
       FROM "ForumPost"
       WHERE "moduleId" = $1 AND "courseSlug" = $2
       ORDER BY "createdAt" DESC;`,
      moduleId,
      courseSlug
    );

    const posts: ForumPost[] = [];

    for (const p of rawPosts) {
      const rawReplies = await prisma.$queryRawUnsafe<any[]>(
        `SELECT "id", "postId", "authorId", "authorName", "role", "content", "likes", "isVerified", "createdAt"
         FROM "ForumReply"
         WHERE "postId" = $1
         ORDER BY "createdAt" ASC;`,
        p.id
      );

      posts.push({
        id: p.id,
        author: p.authorName,
        role: p.role as "TEACHER" | "STUDENT",
        className: p.className ?? undefined,
        title: p.title,
        content: p.content,
        createdAt: new Date(p.createdAt).toLocaleDateString("id-ID", {
          day: "numeric",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        }),
        likes: p.likes ?? 0,
        replies: rawReplies.map((r) => ({
          id: r.id,
          author: r.authorName,
          role: r.role as "TEACHER" | "STUDENT",
          content: r.content,
          createdAt: new Date(r.createdAt).toLocaleDateString("id-ID", {
            day: "numeric",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          }),
          likes: r.likes ?? 0,
          isVerified: r.isVerified ?? false,
        })),
      });
    }

    return posts;
  } catch (err) {
    console.error("Gagal mengambil data forum:", err);
    return [];
  }
}

/**
 * Siswa atau Guru membuat pertanyaan forum baru pada modul yang sedang dibuka.
 */
export async function createForumPost(input: {
  moduleId: string;
  courseSlug: string;
  title: string;
  content: string;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    let authorId = user?.id || "guest-" + Date.now();
    let authorName = "Pengguna EduVerse";
    let role = "STUDENT";
    let className: string | null = "VII-B";

    if (user) {
      const profile = await prisma.profile.findUnique({ where: { id: user.id } });
      if (profile) {
        authorName = profile.fullName;
        role = profile.role;
        className = profile.className;
      }
    }

    const id = "fp-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6);

    await prisma.$executeRawUnsafe(
      `INSERT INTO "ForumPost" ("id", "moduleId", "courseSlug", "authorId", "authorName", "role", "className", "title", "content", "likes", "createdAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 0, NOW());`,
      id,
      input.moduleId,
      input.courseSlug,
      authorId,
      authorName,
      role,
      className,
      input.title.trim(),
      input.content.trim()
    );

    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err.message || "Gagal membuat pertanyaan." };
  }
}

/**
 * Menambahkan balasan pada pertanyaan forum diskusi.
 */
export async function replyForumPost(input: {
  postId: string;
  content: string;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    let authorId = user?.id || "guest-" + Date.now();
    let authorName = "Pengguna EduVerse";
    let role = "STUDENT";

    if (user) {
      const profile = await prisma.profile.findUnique({ where: { id: user.id } });
      if (profile) {
        authorName = profile.fullName;
        role = profile.role;
      }
    }

    const id = "fr-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6);
    const isVerified = role === "TEACHER";

    await prisma.$executeRawUnsafe(
      `INSERT INTO "ForumReply" ("id", "postId", "authorId", "authorName", "role", "content", "likes", "isVerified", "createdAt")
       VALUES ($1, $2, $3, $4, $5, $6, 0, $7, NOW());`,
      id,
      input.postId,
      authorId,
      authorName,
      role,
      input.content.trim(),
      isVerified
    );

    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err.message || "Gagal mengirim tanggapan." };
  }
}

/**
 * Menyukai (like / upvote) pertanyaan forum
 */
export async function toggleLikePost(postId: string): Promise<{ ok: boolean }> {
  try {
    await prisma.$executeRawUnsafe(
      `UPDATE "ForumPost" SET "likes" = "likes" + 1 WHERE "id" = $1;`,
      postId
    );
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

/**
 * Menyukai balasan forum
 */
export async function toggleLikeReply(replyId: string): Promise<{ ok: boolean }> {
  try {
    await prisma.$executeRawUnsafe(
      `UPDATE "ForumReply" SET "likes" = "likes" + 1 WHERE "id" = $1;`,
      replyId
    );
    return { ok: true };
  } catch {
    return { ok: false };
  }
}
