"use server";

import { revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSessionProfile } from "@/lib/actions/dashboards";
import { COLLAB_PROVIDERS } from "@/lib/collab";

export type CollabLinkRow = { id: string; label: string; url: string; provider: string };

export type CollaborationRow = {
  id: string;
  title: string;
  description: string;
  links: CollabLinkRow[];
};

/** Cocokkan host link dengan penyedia yang dikenal; selain itu dianggap link biasa. */
function detectProvider(url: string): string {
  try {
    const host = new URL(url).hostname.toLowerCase();
    const match = COLLAB_PROVIDERS.find((provider) =>
      provider.hosts.some((candidate) => host === candidate || host.endsWith(`.${candidate}`))
    );
    return match?.id ?? "link";
  } catch {
    return "link";
  }
}

/** Hanya http/https yang diterima; link tanpa protokol dilengkapi https://. */
function normalizeUrl(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  const withScheme = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  try {
    const url = new URL(withScheme);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

function toRow(collaboration: {
  id: string;
  title: string;
  description: string;
  links: Array<{ id: string; label: string; url: string; provider: string; order: number }>;
}): CollaborationRow {
  return {
    id: collaboration.id,
    title: collaboration.title,
    description: collaboration.description,
    links: [...collaboration.links]
      .sort((a, b) => a.order - b.order)
      .map((link) => ({ id: link.id, label: link.label, url: link.url, provider: link.provider })),
  };
}

async function ownsCourse(courseId: string) {
  const me = await getSessionProfile();
  if (!me || me.role !== "TEACHER" || !me.isActive) return null;
  const course = await prisma.course.findFirst({
    where: { id: courseId, ownerId: me.id },
    select: { id: true, slug: true },
  });
  return course ? { me, course } : null;
}

/** Kolaborasi yang dibuat guru untuk satu pembelajaran (halaman builder). */
export async function getTeacherCollaborations(courseId: string): Promise<CollaborationRow[]> {
  try {
    const owned = await ownsCourse(courseId);
    if (!owned) return [];
    const rows = await prisma.collaboration.findMany({
      where: { courseId },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      include: { links: true },
    });
    return rows.map(toRow);
  } catch {
    return [];
  }
}

/** Kolaborasi yang dilihat siswa pada halaman pembelajaran. */
export async function getStudentCollaborations(
  slug: string
): Promise<{ courseTitle: string; courseId: string; rows: CollaborationRow[] }> {
  try {
    const course = await prisma.course.findUnique({
      where: { slug },
      select: { id: true, title: true, state: true },
    });
    if (!course) return { courseTitle: "", courseId: "", rows: [] };

    const rows = await prisma.collaboration.findMany({
      where: { courseId: course.id },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      include: { links: true },
    });
    return { courseTitle: course.title, courseId: course.id, rows: rows.map(toRow) };
  } catch {
    return { courseTitle: "", courseId: "", rows: [] };
  }
}

/** Simpan kolaborasi baru atau perbarui judul/deskripsi beserta seluruh linknya. */
export async function saveCollaboration(input: {
  id?: string;
  courseId: string;
  title: string;
  description?: string;
  links: Array<{ id?: string; label: string; url: string }>;
}): Promise<{ ok: boolean; error?: string; collaboration?: CollaborationRow }> {
  try {
    const owned = await ownsCourse(input.courseId);
    if (!owned) return { ok: false, error: "Hanya guru pemilik pembelajaran yang boleh mengatur kolaborasi." };

    const title = input.title.trim();
    if (!title) return { ok: false, error: "Judul kolaborasi wajib diisi." };

    const links = input.links
      .map((link, index) => {
        const url = normalizeUrl(link.url);
        if (!url) return null;
        return {
          id: link.id,
          label: link.label.trim() || `Link ${index + 1}`,
          url,
          provider: detectProvider(url),
          order: index,
        };
      })
      .filter((link): link is NonNullable<typeof link> => link !== null);

    if (links.length === 0)
      return { ok: false, error: "Tambahkan minimal satu link yang valid (http/https)." };

    const saved = await prisma.$transaction(async (tx) => {
      let collaborationId = input.id ?? "";
      if (input.id) {
        const existing = await tx.collaboration.findFirst({
          where: { id: input.id, courseId: input.courseId },
          select: { id: true },
        });
        if (!existing) throw new Error("not-found");
        await tx.collaboration.update({
          where: { id: existing.id },
          data: { title, description: input.description?.trim() ?? "" },
        });
        collaborationId = existing.id;
      } else {
        const count = await tx.collaboration.count({ where: { courseId: input.courseId } });
        const created = await tx.collaboration.create({
          data: {
            courseId: input.courseId,
            title,
            description: input.description?.trim() ?? "",
            order: count,
          },
        });
        collaborationId = created.id;
      }

      const current = await tx.collaborationLink.findMany({
        where: { collaborationId },
        select: { id: true },
      });
      const keep = new Set(links.map((link) => link.id).filter(Boolean) as string[]);
      const removed = current.filter((link) => !keep.has(link.id)).map((link) => link.id);
      if (removed.length) {
        await tx.collaborationLink.deleteMany({ where: { id: { in: removed } } });
      }

      for (const link of links) {
        if (link.id && keep.has(link.id)) {
          await tx.collaborationLink.update({
            where: { id: link.id },
            data: {
              label: link.label,
              url: link.url,
              provider: link.provider,
              order: link.order,
            },
          });
        } else {
          await tx.collaborationLink.create({
            data: {
              collaborationId,
              label: link.label,
              url: link.url,
              provider: link.provider,
              order: link.order,
            },
          });
        }
      }

      return tx.collaboration.findUniqueOrThrow({
        where: { id: collaborationId },
        include: { links: true },
      });
    });

    revalidateTag(`collab-${input.courseId}`);
    if (owned.course.slug) revalidateTag(`course-${owned.course.slug}`);
    return { ok: true, collaboration: toRow(saved) };
  } catch {
    return { ok: false, error: "Gagal menyimpan kolaborasi. Coba lagi." };
  }
}

export async function deleteCollaboration(
  id: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const me = await getSessionProfile();
    if (!me || me.role !== "TEACHER" || !me.isActive)
      return { ok: false, error: "Hanya guru yang boleh menghapus kolaborasi." };

    const row = await prisma.collaboration.findFirst({
      where: { id, course: { ownerId: me.id } },
      select: { id: true, courseId: true, course: { select: { slug: true } } },
    });
    if (!row) return { ok: false, error: "Kolaborasi tidak ditemukan." };

    await prisma.collaboration.delete({ where: { id: row.id } });
    revalidateTag(`collab-${row.courseId}`);
    revalidateTag(`course-${row.course.slug}`);
    return { ok: true };
  } catch {
    return { ok: false, error: "Gagal menghapus kolaborasi." };
  }
}
