import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/** Sajikan berkas tersimpan. Materi publik terbuka, jawaban siswa hanya untuk pemilik/guru. */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const file = await prisma.storedFile.findUnique({ where: { id } });
  if (!file) return new Response("Berkas tidak ditemukan.", { status: 404 });

  let allowed = file.isPublic;
  if (!allowed) {
    try {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        if (file.ownerId === user.id) {
          allowed = true;
        } else {
          const profile = await prisma.profile.findUnique({
            where: { id: user.id },
            select: { role: true },
          });
          if (profile?.role === "ADMIN") {
            allowed = true;
          } else if (profile?.role === "TEACHER" && file.courseId) {
            const course = await prisma.course.findFirst({
              where: { id: file.courseId, ownerId: user.id },
              select: { id: true },
            });
            allowed = Boolean(course);
          }
        }
      }
    } catch {
      allowed = false;
    }
  }

  if (!allowed) return new Response("Tidak diizinkan.", { status: 403 });

  const inline = file.mimeType === "application/pdf" || file.mimeType.startsWith("image/");
  const safeName = file.fileName.replace(/[^\w.\-() ]+/g, "_");

  return new Response(new Uint8Array(file.data), {
    headers: {
      "Content-Type": file.mimeType,
      "Content-Length": String(file.size),
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${safeName}"`,
      "Cache-Control": file.isPublic ? "public, max-age=300" : "private, no-store",
    },
  });
}
