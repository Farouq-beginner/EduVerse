/**
 * Unggah berkas materi/jawaban ke database lewat /api/files.
 * Satu tempat untuk aturan format & pesan error agar guru dan siswa konsisten.
 */
export const MATERIAL_ACCEPT = ".pdf,.ppt,.pptx,.doc,.docx,image/png,image/jpeg,image/webp,image/gif";
export const ANSWER_ACCEPT = ".pdf,.ppt,.pptx,.doc,.docx,image/png,image/jpeg,image/webp,image/gif";

const DOCUMENT_MIMES = new Set([
  "application/pdf",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);
const IMAGE_MIMES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

export type UploadedMaterial = { fileId: string; url: string; fileName: string; mimeType: string };

/** Validasi di client supaya guru/siswa dapat pesan cepat sebelum upload. */
export function validateMaterialFile(file: File): string | null {
  const type = file.type || "";
  const isDocument = DOCUMENT_MIMES.has(type);
  const isImage = IMAGE_MIMES.has(type);
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  const allowedExtension = ["pdf", "ppt", "pptx", "doc", "docx", "png", "jpg", "jpeg", "webp", "gif"].includes(extension);

  if (!isDocument && !isImage && !allowedExtension) {
    return "Format harus PDF, PPT/PPTX, DOC/DOCX, atau gambar.";
  }
  const limit = isImage || ["png", "jpg", "jpeg", "webp", "gif"].includes(extension)
    ? 5 * 1024 * 1024
    : type === "application/pdf" || extension === "pdf"
      ? 8 * 1024 * 1024
      : 20 * 1024 * 1024;
  if (file.size > limit) {
    return `Ukuran maksimal ${Math.round(limit / (1024 * 1024))} MB untuk berkas ini.`;
  }
  return null;
}

export async function uploadCourseFile(input: {
  file: File;
  courseId: string;
  purpose: "material" | "module-doc" | "submission";
}): Promise<{ ok: boolean; file?: UploadedMaterial; error?: string }> {
  const invalid = validateMaterialFile(input.file);
  if (invalid) return { ok: false, error: invalid };

  try {
    const form = new FormData();
    form.append("file", input.file);
    form.append("courseId", input.courseId);
    form.append("purpose", input.purpose);
    const response = await fetch("/api/files", { method: "POST", body: form });
    const data = (await response.json()) as {
      ok?: boolean;
      fileId?: string;
      url?: string;
      fileName?: string;
      mimeType?: string;
      error?: string;
    };
    if (!response.ok || !data.ok || !data.url || !data.fileId) {
      return { ok: false, error: data.error ?? "Gagal mengunggah berkas." };
    }
    return {
      ok: true,
      file: {
        fileId: data.fileId,
        url: data.url,
        fileName: data.fileName ?? input.file.name,
        mimeType: data.mimeType ?? input.file.type,
      },
    };
  } catch {
    return { ok: false, error: "Gagal mengunggah berkas." };
  }
}

/** Label singkat jenis berkas untuk chip di UI. */
export function fileKindLabel(mime: string | undefined, name?: string) {
  const value = (mime || "").toLowerCase();
  if (value.includes("pdf")) return "PDF";
  if (value.includes("presentation") || value.includes("powerpoint")) return "PPT";
  if (value.includes("word") || value.includes("msword")) return "DOCX";
  if (value.startsWith("image/")) return "Gambar";
  const extension = name?.split(".").pop()?.toUpperCase();
  return extension || "Berkas";
}
