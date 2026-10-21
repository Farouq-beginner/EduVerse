"use server";

import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import type { ForumPost } from "@/components/DiscussionForum";

type Viewer = { id: string; fullName: string; role: "TEACHER" | "STUDENT" | "ADMIN"; className: string | null } | null;

/** Sesi forum: guru/siswa login, atau tamu (tanpa akun) untuk alur link siswa. */
async function getViewer(): Promise<Viewer> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    const profile = await prisma.profile.findUnique({ where: { id: user.id } });
    if (!profile || !profile.isActive) return null;
    return {
      id: profile.id,
      fullName: profile.fullName,
      role: profile.role,
      className: profile.className,
    };
  } catch {
    return null;
  }
}

/** Guru pemilik course (atau Admin) boleh menghapus seluruh diskusi modul. */
async function canModerateModule(moduleId: string, viewer: Viewer) {
  if (!viewer) return false;
  if (viewer.role === "ADMIN") return true;
  if (viewer.role !== "TEACHER") return false;
  const module = await prisma.module.findUnique({
    where: { id: moduleId },
    select: { course: { select: { ownerId: true } } },
  });
  return module?.course.ownerId === viewer.id;
}

function formatTime(date: Date) {
  return date.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Forum diskusi milik satu modul. Setiap modul punya ruangnya sendiri di
 * database (difilter moduleId + course), jadi data tidak bercampur antar modul.
 */
export async function getForumPostsByModule(
  moduleId: string,
  courseSlug?: string
): Promise<ForumPost[]> {
  try {
    if (!moduleId) return [];
    const module = await prisma.module.findUnique({
      where: { id: moduleId },
      select: { id: true, course: { select: { slug: true } } },
    });
    if (!module) return [];
    if (courseSlug && module.course.slug !== courseSlug) return [];

    const posts = await prisma.forumPost.findMany({
      where: { moduleId },
      orderBy: { createdAt: "desc" },
      include: { replies: { orderBy: { createdAt: "asc" } } },
    });

    return posts.map((post) => ({
      id: post.id,
      moduleId: post.moduleId,
      courseSlug: post.courseSlug,
      authorId: post.authorId,
      author: post.authorName,
      role: post.role === "TEACHER" ? "TEACHER" : "STUDENT",
      className: post.className ?? undefined,
      title: post.title,
      content: post.content,
      createdAt: formatTime(post.createdAt),
      likes: post.likes,
      replies: post.replies.map((reply) => ({
        id: reply.id,
        authorId: reply.authorId,
        author: reply.authorName,
        role: reply.role === "TEACHER" ? "TEACHER" : "STUDENT",
        content: reply.content,
        createdAt: formatTime(reply.createdAt),
        likes: reply.likes,
        isVerified: reply.isVerified,
      })),
    }));
  } catch (error) {
    console.error("Gagal mengambil data forum:", error);
    return [];
  }
}

/** Siswa/guru membuat pertanyaan baru pada forum modul tertentu. */
export async function createForumPost(input: {
  moduleId: string;
  courseSlug?: string;
  title: string;
  content: string;
  guestName?: string;
  guestClass?: string;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const title = input.title.trim();
    const content = input.content.trim();
    if (!title || !content) return { ok: false, error: "Judul dan isi pertanyaan wajib diisi." };

    const module = await prisma.module.findUnique({
      where: { id: input.moduleId },
      select: { course: { select: { slug: true } } },
    });
    if (!module) return { ok: false, error: "Modul tidak ditemukan." };

    const viewer = await getViewer();
    const guestName = input.guestName?.trim();
    const authorName = viewer?.fullName || guestName || "Pengguna EduVerse";
    const role = viewer?.role === "TEACHER" ? "TEACHER" : "STUDENT";
    const className = viewer?.className || input.guestClass || null;

    await prisma.forumPost.create({
      data: {
        moduleId: input.moduleId,
        courseSlug: module.course.slug,
        authorId: viewer?.id ?? `guest-${randomUUID()}`,
        authorName,
        role,
        className,
        title,
        content,
      },
    });

    return { ok: true };
  } catch (error) {
    console.error("Gagal membuat pertanyaan forum:", error);
    return { ok: false, error: "Gagal membuat pertanyaan. Coba lagi." };
  }
}

/** Balasan pada pertanyaan forum. Guru otomatis ditandai sebagai jawaban guru. */
export async function replyForumPost(input: {
  postId: string;
  content: string;
  guestName?: string;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const content = input.content.trim();
    if (!content) return { ok: false, error: "Tanggapan wajib diisi." };

    const post = await prisma.forumPost.findUnique({ where: { id: input.postId }, select: { id: true } });
    if (!post) return { ok: false, error: "Diskusi tidak ditemukan." };

    const viewer = await getViewer();
    const guestName = input.guestName?.trim();
    const role = viewer?.role === "TEACHER" ? "TEACHER" : "STUDENT";

    await prisma.forumReply.create({
      data: {
        postId: input.postId,
        authorId: viewer?.id ?? `guest-${randomUUID()}`,
        authorName: viewer?.fullName || guestName || "Pengguna EduVerse",
        role,
        content,
        isVerified: role === "TEACHER",
      },
    });

    return { ok: true };
  } catch (error) {
    console.error("Gagal mengirim tanggapan:", error);
    return { ok: false, error: "Gagal mengirim tanggapan." };
  }
}

/** Hapus pertanyaan: guru pemilik course boleh semua, siswa hanya miliknya. */
export async function deleteForumPost(postId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const viewer = await getViewer();
    if (!viewer) return { ok: false, error: "Login dulu untuk menghapus diskusi." };

    const post = await prisma.forumPost.findUnique({
      where: { id: postId },
      select: { moduleId: true, authorId: true },
    });
    if (!post) return { ok: false, error: "Diskusi tidak ditemukan." };

    const moderator = await canModerateModule(post.moduleId, viewer);
    const own = viewer.role === "STUDENT" && post.authorId === viewer.id;
    if (!moderator && !own) {
      return { ok: false, error: "Siswa hanya bisa menghapus pertanyaannya sendiri." };
    }

    await prisma.forumPost.delete({ where: { id: postId } });
    return { ok: true };
  } catch (error) {
    console.error("Gagal menghapus pertanyaan:", error);
    return { ok: false, error: "Gagal menghapus pertanyaan." };
  }
}

/** Hapus tanggapan: guru pemilik course boleh semua, siswa hanya miliknya. */
export async function deleteForumReply(replyId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const viewer = await getViewer();
    if (!viewer) return { ok: false, error: "Login dulu untuk menghapus tanggapan." };

    const reply = await prisma.forumReply.findUnique({
      where: { id: replyId },
      select: { authorId: true, post: { select: { moduleId: true } } },
    });
    if (!reply) return { ok: false, error: "Tanggapan tidak ditemukan." };

    const moderator = await canModerateModule(reply.post.moduleId, viewer);
    const own = viewer.role === "STUDENT" && reply.authorId === viewer.id;
    if (!moderator && !own) {
      return { ok: false, error: "Siswa hanya bisa menghapus tanggapannya sendiri." };
    }

    await prisma.forumReply.delete({ where: { id: replyId } });
    return { ok: true };
  } catch (error) {
    console.error("Gagal menghapus tanggapan:", error);
    return { ok: false, error: "Gagal menghapus tanggapan." };
  }
}

/** Menyukai pertanyaan forum. */
export async function toggleLikePost(postId: string): Promise<{ ok: boolean }> {
  try {
    await prisma.forumPost.update({ where: { id: postId }, data: { likes: { increment: 1 } } });
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

/** Menyukai balasan forum. */
export async function toggleLikeReply(replyId: string): Promise<{ ok: boolean }> {
  try {
    await prisma.forumReply.update({ where: { id: replyId }, data: { likes: { increment: 1 } } });
    return { ok: true };
  } catch {
    return { ok: false };
  }
}
