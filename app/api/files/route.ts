import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const MAX_PDF = 8 * 1024 * 1024;
const MAX_IMAGE = 5 * 1024 * 1024;
const MAX_DOCUMENT = 20 * 1024 * 1024;

const MIME_BY_EXTENSION: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

const ALLOWED = new Set(Object.values(MIME_BY_EXTENSION));

/** Browser Windows kadang mengirim tipe kosong; pakai ekstensi sebagai cadangan. */
function resolveMime(file: File): string {
  if (file.type && ALLOWED.has(file.type)) return file.type;
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  return MIME_BY_EXTENSION[extension] ?? file.type;
}

function limitFor(mime: string) {
  if (mime === "application/pdf") return MAX_PDF;
  if (mime.startsWith("image/")) return MAX_IMAGE;
  return MAX_DOCUMENT;
}

/**
 * Unggah berkas (PDF materi guru atau bukti jawaban siswa) ke database.
 * Berkas tidak lagi disimpan sebagai data URL di JSON materi, sehingga bisa
 * dibuka kembali, diunduh, dan dihapus tanpa merusak materi.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { ok: false, error: "Login dulu agar berkas tersimpan di server." },
        { status: 401 }
      );
    }

    const profile = await prisma.profile.findUnique({ where: { id: user.id } });
    if (!profile || !profile.isActive) {
      return NextResponse.json({ ok: false, error: "Akun tidak aktif." }, { status: 403 });
    }

    const form = await request.formData();
    const file = form.get("file");
    const courseId = String(form.get("courseId") ?? "").trim();
    const purpose = String(form.get("purpose") ?? "material");

    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: "Berkas tidak ditemukan." }, { status: 400 });
    }
    const mimeType = resolveMime(file);
    if (!ALLOWED.has(mimeType)) {
      return NextResponse.json(
        { ok: false, error: "Format harus PDF, PPT/PPTX, DOC/DOCX, atau gambar (PNG/JPG/WEBP)." },
        { status: 415 }
      );
    }

    const limit = limitFor(mimeType);
    if (file.size > limit) {
      return NextResponse.json(
        { ok: false, error: `Ukuran maksimal ${Math.round(limit / (1024 * 1024))} MB.` },
        { status: 413 }
      );
    }

    if (!courseId) {
      return NextResponse.json({ ok: false, error: "Course wajib dipilih." }, { status: 400 });
    }

    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true, ownerId: true, state: true },
    });
    if (!course) {
      return NextResponse.json({ ok: false, error: "Course tidak ditemukan." }, { status: 404 });
    }

    let isPublic = false;
    if (profile.role === "TEACHER") {
      if (course.ownerId !== profile.id) {
        return NextResponse.json(
          { ok: false, error: "Course ini bukan milikmu." },
          { status: 403 }
        );
      }
      // Materi guru boleh dibaca peserta (termasuk siswa lewat link).
      // Dokumen modul ajar hanya untuk guru pemilik.
      isPublic = purpose === "material";
    } else if (profile.role === "STUDENT") {
      const enrollment = await prisma.enrollment.findUnique({
        where: { studentId_courseId: { studentId: profile.id, courseId } },
        select: { status: true },
      });
      if (!enrollment || enrollment.status !== "ACTIVE") {
        return NextResponse.json(
          { ok: false, error: "Gabung pembelajaran dulu sebelum mengunggah jawaban." },
          { status: 403 }
        );
      }
      isPublic = false;
    } else {
      return NextResponse.json({ ok: false, error: "Role tidak diizinkan." }, { status: 403 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const stored = await prisma.storedFile.create({
      data: {
        ownerId: profile.id,
        courseId,
        fileName: file.name || "berkas",
        mimeType,
        size: buffer.length,
        isPublic,
        data: buffer,
      },
      select: { id: true, fileName: true, mimeType: true },
    });

    return NextResponse.json({
      ok: true,
      fileId: stored.id,
      fileName: stored.fileName,
      mimeType: stored.mimeType,
      url: `/api/files/${stored.id}`,
    });
  } catch (error) {
    console.error("Upload file gagal:", error);
    return NextResponse.json({ ok: false, error: "Gagal mengunggah berkas." }, { status: 500 });
  }
}
