"use client";

import { useEffect, useState } from "react";
import { Check, FileText, Loader2, Paperclip, Trash2 } from "lucide-react";
import { blankWorksheet, type LessonBlock, type WorksheetConfig } from "@/lib/demo-data";
import { getMySubmission } from "@/lib/actions/files";
import { submitAssignment } from "@/lib/actions/progress";
import { getSubmissions, saveSubmission } from "@/lib/storage";
import { ANSWER_ACCEPT, fileKindLabel, uploadCourseFile } from "@/lib/upload";

type Identity = { name: string; className: string; participantId: string } | null;
type UploadedFile = { url: string; fileName: string; fileType: string };

/**
 * Lembar Kerja · Jawaban & Lampiran.
 *
 * Satu format untuk SEMUA tipe materi: guru mengisi instruksi lembar kerja di
 * builder, siswa menjawab dan melampirkan berkas (foto, PDF, PPT, atau DOCX).
 * Jawaban tersimpan di tabel Submission sehingga tidak hilang saat refresh.
 */
export function WorksheetForm({
  block,
  worksheet,
  courseId,
  enrolled,
  identity,
  onSubmitted,
  onToast,
}: {
  block: LessonBlock;
  worksheet?: WorksheetConfig;
  courseId: string | null;
  enrolled: boolean;
  identity: Identity;
  onSubmitted?: () => void;
  onToast: (message: string) => void;
}) {
  const config: WorksheetConfig = { ...blankWorksheet, ...(worksheet ?? {}) };
  const [response, setResponse] = useState("");
  const [file, setFile] = useState<UploadedFile | null>(null);
  const [submittedAt, setSubmittedAt] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    let active = true;
    setResponse("");
    setFile(null);
    setSubmittedAt("");
    (async () => {
      if (courseId) {
        const row = await getMySubmission(courseId, block.id).catch(() => null);
        if (!active || !row) return;
        setResponse(row.response ?? "");
        if (row.fileUrl) {
          setFile({
            url: row.fileUrl,
            fileName: row.fileName ?? "Lampiran",
            fileType: row.fileType ?? "application/octet-stream",
          });
        }
        setSubmittedAt(row.submittedAt);
        return;
      }
      if (identity) {
        const local = getSubmissions().find(
          (item) => item.participantId === identity.participantId && item.blockId === block.id
        );
        if (local && active) {
          setResponse(local.response);
          setSubmittedAt(local.submittedAt);
        }
      }
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId, block.id, identity?.participantId]);

  if (!config.enabled) return null;

  const locked = Boolean(submittedAt);

  async function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0];
    event.target.value = "";
    if (!selected) return;
    if (!courseId || !enrolled) {
      onToast("Login sebagai siswa dan gabung pembelajaran agar lampiran tersimpan di database.");
      return;
    }
    setUploading(true);
    const result = await uploadCourseFile({ file: selected, courseId, purpose: "submission" });
    setUploading(false);
    if (!result.ok || !result.file) {
      onToast(result.error ?? "Gagal mengunggah berkas.");
      return;
    }
    setFile({ url: result.file.url, fileName: result.file.fileName, fileType: result.file.mimeType });
    onToast("Lampiran tersimpan di database.");
  }

  async function submit() {
    if (!response.trim() && !file) return;
    setSaving(true);
    const now = new Date().toISOString();

    if (courseId && enrolled && identity) {
      const res = await submitAssignment({
        courseId,
        blockId: block.id,
        response,
        fileUrl: file?.url,
        fileName: file?.fileName,
        fileType: file?.fileType,
      });
      setSaving(false);
      if (!res.ok) {
        onToast(res.error ?? "Gagal menyimpan jawaban.");
        return;
      }
      onToast("Lembar kerja terkirim ke guru dan tersimpan di database.");
    } else if (identity) {
      saveSubmission({
        id: `${identity.participantId}-${block.id}`,
        participantId: identity.participantId,
        participantName: identity.name,
        className: identity.className,
        blockId: block.id,
        blockTitle: block.title,
        moduleId: block.moduleId,
        response,
        score: null,
        maxScore: 100,
        submittedAt: now,
        status: "submitted",
      });
      setSaving(false);
      onToast("Jawaban tersimpan di perangkat.");
    } else {
      setSaving(false);
      onToast("Masuk ke pembelajaran dulu agar jawaban tersimpan.");
      return;
    }

    setSubmittedAt(now);
    onSubmitted?.();
  }

  const isImage = file?.fileType.startsWith("image/");

  return (
    <div className="activity-lesson-card answer-panel" style={{ marginTop: 18 }}>
      <div className="eyebrow">LEMBAR KERJA · JAWABAN &amp; LAMPIRAN</div>
      {config.prompt && <p style={{ marginTop: 8, color: "var(--muted)", fontSize: ".86rem" }}>{config.prompt}</p>}

      <div className="form-grid" style={{ marginTop: 12 }}>
        <div className="field field--full">
          <label>{config.answerLabel || blankWorksheet.answerLabel}</label>
          <textarea
            className="material-textarea"
            value={response}
            onChange={(event) => setResponse(event.target.value)}
            placeholder="Tuliskan jawaban, hasil akhir, atau kesimpulanmu di sini..."
            rows={5}
            disabled={locked}
          />
          <small className="field-helper">{response.trim().length} karakter</small>
        </div>
        <div className="field field--full">
          <label>{config.attachmentLabel || blankWorksheet.attachmentLabel}</label>
          <label className="file-upload-zone">
            <input type="file" accept={ANSWER_ACCEPT} onChange={handleUpload} disabled={uploading || locked} />
            <Paperclip size={16} />
            <span>{uploading ? "Mengunggah..." : "Pilih foto, PDF, PPT, atau DOCX"}</span>
          </label>
          <small className="field-helper">PDF maks 8 MB · gambar maks 5 MB · PPT/DOCX maks 20 MB.</small>
          {file && (
            <div className="attachment-preview">
              {isImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={file.url} alt={file.fileName} />
              ) : null}
              <div className="file-chip-row">
                <a href={file.url} target="_blank" rel="noreferrer" className="file-chip">
                  <FileText size={14} /> {file.fileName} · {fileKindLabel(file.fileType, file.fileName)}
                </a>
                {!locked && (
                  <button type="button" className="button button--ghost button--small" onClick={() => setFile(null)}>
                    <Trash2 size={13} /> Hapus lampiran
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <button
        className="button button--primary"
        style={{ marginTop: 14 }}
        disabled={saving || uploading || (!response.trim() && !file) || locked}
        onClick={submit}
      >
        {saving ? <Loader2 size={16} className="spin" /> : <Check size={16} />}
        {locked ? "Lembar kerja terkirim" : "Kirim jawaban & lampiran"}
      </button>

      {locked && (
        <div className="preview-result is-good" style={{ marginTop: 12 }}>
          <Check size={15} /> Terkirim pada {new Date(submittedAt).toLocaleString("id-ID")}. Guru dapat membuka jawaban dan lampiranmu.
        </div>
      )}
    </div>
  );
}
