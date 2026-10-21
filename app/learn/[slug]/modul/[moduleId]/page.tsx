"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ClipboardCheck,
  Download,
  ExternalLink,
  FileText,
  Gamepad2,
  Link2,
  Loader2,
  Paperclip,
  Sparkles,
  Trash2,
  Video,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { StatusPill } from "@/components/DashboardBits";
import { Toast } from "@/components/Toast";
import { NumberLineVisualizer } from "@/components/NumberLineVisualizer";
import { DiscussionForum } from "@/components/DiscussionForum";
import type { ActivityConfig, LessonBlock, Module } from "@/lib/demo-data";
import {
  getCompleted,
  getCourseBlocks,
  getCourseModules,
  getIdentity,
  getSubmissions,
  saveCompleted,
  saveProgress,
  saveSubmission,
} from "@/lib/storage";
import { getCourseStructure, getMyCourseProgress, getQuizForBlock, getSessionProfile, type DbCourse } from "@/lib/actions/dashboards";
import { markBlockComplete, submitAssignment, submitQuizAttempt, syncBlockCompletions } from "@/lib/actions/progress";
import { getMySubmission } from "@/lib/actions/files";
import { toModule } from "@/lib/course";

type Identity = { name: string; className: string; participantId: string };
type DbQuiz = Awaited<ReturnType<typeof getQuizForBlock>>;
type UploadedFile = { url: string; fileName: string; fileType: string };

const ACCENTS: Record<string, "violet" | "teal" | "yellow" | "coral"> = {
  "module-observe": "violet",
  "module-explore": "teal",
  "module-investigate": "yellow",
  "module-present": "coral",
};

/** Unggah bukti jawaban ke database; mengembalikan URL yang bisa dibuka guru. */
async function uploadAnswerFile(file: File, courseId: string): Promise<{ ok: boolean; file?: UploadedFile; error?: string }> {
  if (!["application/pdf", "image/png", "image/jpeg", "image/webp", "image/gif"].includes(file.type)) {
    return { ok: false, error: "Format harus PDF atau gambar." };
  }
  const limit = file.type === "application/pdf" ? 8 * 1024 * 1024 : 5 * 1024 * 1024;
  if (file.size > limit) return { ok: false, error: `Ukuran maksimal ${Math.round(limit / 1024 / 1024)} MB.` };

  try {
    const form = new FormData();
    form.append("file", file);
    form.append("courseId", courseId);
    form.append("purpose", "submission");
    const response = await fetch("/api/files", { method: "POST", body: form });
    const data = (await response.json()) as { ok?: boolean; url?: string; fileName?: string; mimeType?: string; error?: string };
    if (!response.ok || !data.ok || !data.url) return { ok: false, error: data.error ?? "Gagal mengunggah berkas." };
    return { ok: true, file: { url: data.url, fileName: data.fileName ?? file.name, fileType: data.mimeType ?? file.type } };
  } catch {
    return { ok: false, error: "Gagal mengunggah berkas." };
  }
}

export default function ModulePage() {
  const params = useParams<{ slug: string; moduleId: string }>();
  const searchParams = useSearchParams();
  const courseSlug = params.slug;
  const lessonParam = searchParams.get("lesson");

  const [modules, setModules] = useState<Module[]>([]);
  const [dbCourse, setDbCourse] = useState<DbCourse | null>(null);
  const [courseId, setCourseId] = useState<string | null>(null);
  const [enrolled, setEnrolled] = useState(false);
  const [account, setAccount] = useState<{ id: string; fullName: string; className: string } | null>(null);
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [completed, setCompleted] = useState<string[]>([]);
  const [dbQuiz, setDbQuiz] = useState<DbQuiz>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [selectedId, setSelectedId] = useState<string | undefined>(lessonParam ?? undefined);

  // Muat identitas lokal + struktur course dari database.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [structure, mine, profile] = await Promise.all([
          getCourseStructure(courseSlug),
          getMyCourseProgress(courseSlug),
          getSessionProfile(),
        ]);
        if (!active) return;

        if (structure) {
          setDbCourse(structure);
          setModules(structure.modules.map(toModule));
        } else {
          setModules(getCourseModules());
        }

        if (profile && profile.role === "STUDENT") {
          setAccount({ id: profile.id, fullName: profile.fullName, className: profile.className ?? "—" });
          setIdentity({ name: profile.fullName, className: profile.className ?? "—", participantId: profile.id });
        } else {
          setIdentity(getIdentity());
        }

        if (mine) {
          setCourseId(mine.courseId);
          setEnrolled(mine.enrolled);
          const localCompleted = getCompleted();
          const merged = Array.from(new Set([...mine.completedBlockIds, ...localCompleted]));
          setCompleted(merged);
          saveCompleted(merged);

          const pending = localCompleted.filter((id) => !mine.completedBlockIds.includes(id));
          if (mine.enrolled && pending.length > 0) {
            setSyncing(true);
            const result = await syncBlockCompletions({ courseId: mine.courseId, blockIds: pending });
            if (active) {
              setSyncing(false);
              if (result.ok && result.saved > 0) setToast(`${result.saved} progres perangkat tersinkron ke database.`);
            }
          }
        } else {
          // Mode lokal (belum login): progres tetap dibaca dari perangkat.
          setCompleted(getCompleted());
        }
      } catch {
        setModules(getCourseModules());
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [courseSlug]);

  const module = modules.find((item) => item.id === params.moduleId) ?? modules[0];
  const moduleIndex = module ? modules.findIndex((item) => item.id === module.id) : 0;

  const blocks = useMemo(() => {
    if (!module) return [];
    if (dbCourse) return module.lessons;
    const stored = getCourseBlocks();
    return module.lessons
      .map((seed) => stored.find((item) => item.id === seed.id) ?? seed)
      .concat(stored.filter((item) => item.moduleId === module.id && !module.lessons.some((lesson) => lesson.id === item.id)));
  }, [module, dbCourse]);

  const selected = blocks.find((block) => block.id === selectedId) ?? blocks[0];

  useEffect(() => {
    if (!selected) return;
    let active = true;
    setDbQuiz(null);
    getQuizForBlock(selected.id).then((quiz) => {
      if (active) setDbQuiz(quiz);
    });
    return () => {
      active = false;
    };
  }, [selected?.id]);

  async function completeBlock(block: LessonBlock, label = "Materi") {
    const nextCompleted = completed.includes(block.id) ? completed : [...completed, block.id];
    setCompleted(nextCompleted);
    saveCompleted(nextCompleted);
    const total = modules.reduce((sum, item) => sum + item.lessons.length, 0);
    saveProgress(total > 0 ? Math.round((nextCompleted.length / total) * 100) : 0);

    if (courseId && enrolled && account) {
      const res = await markBlockComplete({ courseId, blockId: block.id }).catch(() => ({ ok: false, error: "Gagal menyimpan ke server." }));
      setToast(res.ok ? `${label} selesai. Progres tersimpan di database.` : `${label} selesai. ${res.error ?? "Belum tersimpan di server."}`);
      return;
    }
    setToast(`${label} selesai. Progres tersimpan di perangkat.`);
  }

  if (loading) {
    return (
      <AppShell role="student">
        <div className="module-page module-page--empty">
          <div className="empty-state">
            <Loader2 size={24} className="spin" />
            <strong>Memuat modul...</strong>
          </div>
        </div>
      </AppShell>
    );
  }

  if (!dbCourse) {
    return (
      <AppShell role="student">
        <div className="module-page module-page--empty">
          <Link href={`/learn/${courseSlug}`} className="back-link">
            <ArrowLeft size={14} /> Kembali ke ruang belajar
          </Link>
          <div className="empty-state-card">
            <FileText size={28} />
            <h1>Pembelajaran tidak ditemukan</h1>
            <p>Modul hanya bisa dibuka dari pembelajaran yang sudah dipublikasikan guru.</p>
          </div>
        </div>
      </AppShell>
    );
  }

  if (!identity && !enrolled) {
    return (
      <AppShell role="student">
        <div className="module-page module-page--empty">
          <Link href={`/learn/${courseSlug}`} className="back-link">
            <ArrowLeft size={14} /> Kembali ke ruang belajar
          </Link>
          <div className="empty-state-card">
            <Sparkles size={28} />
            <h1>Masuk dulu untuk membuka modul</h1>
            <p>Halaman modul ini mengikuti identitas dan progres siswa dari ruang belajar.</p>
            <Link href={`/learn/${courseSlug}`} className="button button--primary">
              Masuk ke pembelajaran <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </AppShell>
    );
  }

  if (!module) {
    return (
      <AppShell role="student">
        <div className="module-page module-page--empty">
          <Link href={`/learn/${courseSlug}`} className="back-link">
            <ArrowLeft size={14} /> Semua modul
          </Link>
          <div className="empty-state-card">
            <FileText size={26} />
            <h1>Modul tidak ditemukan</h1>
            <p>Modul ini mungkin sudah dihapus guru.</p>
          </div>
        </div>
      </AppShell>
    );
  }

  const accent = module.accent || ACCENTS[module.id] || "violet";
  const identityName = identity?.name ?? "Siswa";
  const identityClass = identity?.className ?? "—";
  const totalBlocks = modules.reduce((sum, item) => sum + item.lessons.length, 0);

  return (
    <AppShell role="student">
      <div className="module-page">
        <div className="module-page__top">
          <Link href={`/learn/${courseSlug}`} className="back-link">
            <ArrowLeft size={14} /> Semua modul
          </Link>
          <div className="module-page__identity">
            <span>{identityName}</span>
            <small>
              {identityClass} · {enrolled ? "progres tersinkron" : "progres perangkat"}
            </small>
          </div>
        </div>

        <div className={`module-hero module-hero--${accent}`}>
          <div>
            <div className="eyebrow">
              {module.eyebrow || `MODUL ${String(moduleIndex + 1).padStart(2, "0")}`} · {(module.duration || "10 menit").toUpperCase()}
            </div>
            <h1>{module.title}</h1>
            <p>
              {completed.filter((id) => blocks.some((block) => block.id === id)).length}/{blocks.length} materi selesai · {totalBlocks} materi di
              seluruh pembelajaran.
            </p>
          </div>
          <span className="module-hero__number">{String(moduleIndex + 1).padStart(2, "0")}</span>
        </div>

        {syncing && (
          <div className="sync-banner">
            <Loader2 size={16} className="spin" /> Memindahkan progres perangkat ke database...
          </div>
        )}

        <div className="module-page__grid">
          <aside className="module-outline">
            <div className="eyebrow">ISI MODUL</div>
            {blocks.map((block, index) => (
              <button
                key={block.id}
                className={`module-outline__item ${selected?.id === block.id ? "is-active" : ""}`}
                onClick={() => setSelectedId(block.id)}
              >
                <span>{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <strong>{block.title}</strong>
                  <small>{block.duration}</small>
                </div>
                {completed.includes(block.id) && <Check size={14} />}
              </button>
            ))}
            {blocks.length === 0 && <p className="section-subtitle">Guru belum mengisi materi modul ini.</p>}
            <Link href={`/learn/${courseSlug}/games`} className="module-games-link">
              <Gamepad2 size={16} />
              <span>
                <strong>Game pembelajaran</strong>
                <small>Buka semua game</small>
              </span>
              <ArrowRight size={14} />
            </Link>
          </aside>

          <main className="module-viewer">
            {selected ? (
              <LessonRenderer
                block={selected}
                dbQuiz={dbQuiz}
                courseId={courseId}
                enrolled={enrolled}
                account={account}
                identity={identity}
                courseSlug={courseSlug}
                onComplete={() => completeBlock(selected)}
                onToast={setToast}
              />
            ) : (
              <div className="empty-state-card">
                <FileText size={24} />
                <h2>Belum ada materi</h2>
                <p>Guru belum mengisi blok pada modul ini.</p>
              </div>
            )}

            <DiscussionForum
              moduleId={module.id}
              courseSlug={courseSlug}
              moduleTitle={module.title}
              currentUser={
                identity
                  ? {
                      id: account?.id,
                      name: identity.name,
                      role: "STUDENT",
                      className: identity.className,
                    }
                  : null
              }
            />
          </main>
        </div>

        {toast && <Toast message={toast} onClose={() => setToast("")} />}
      </div>
    </AppShell>
  );
}

function LessonRenderer({
  block,
  dbQuiz,
  courseId,
  enrolled,
  account,
  identity,
  courseSlug,
  onComplete,
  onToast,
}: {
  block: LessonBlock;
  dbQuiz: DbQuiz;
  courseId: string | null;
  enrolled: boolean;
  account: { id: string; fullName: string; className: string } | null;
  identity: Identity | null;
  courseSlug: string;
  onComplete: () => void;
  onToast: (message: string) => void;
}) {
  const material = block.material ?? {};
  const [showNumberLine, setShowNumberLine] = useState(false);

  return (
    <div>
      {block.type === "video" && (
        <div className="lesson-view">
          <LessonHeading icon={<Video size={18} />} block={block} />
          <MediaEmbed videoUrl={material.videoUrl} driveUrl={material.driveUrl} />
          <div style={{ marginTop: 14 }}>
            <button
              type="button"
              className="button button--ghost button--small"
              onClick={() => setShowNumberLine(!showNumberLine)}
              style={{ marginBottom: 12 }}
            >
              <Sparkles size={15} /> {showNumberLine ? "Tutup Visual Garis Bilangan" : "Buka Visual Garis Bilangan Interaktif"}
            </button>
            {showNumberLine && <NumberLineVisualizer />}
          </div>
          <CompleteButton onClick={onComplete} label="Video selesai" />
        </div>
      )}

      {block.type === "link" && (
        <div className="lesson-view">
          <LessonHeading icon={<Link2 size={18} />} block={block} />
          <div className="link-lesson-card">
            <span className="link-lesson-card__icon">
              <Link2 size={22} />
            </span>
            <div>
              <h2>{block.title}</h2>
              <p>{block.description || "Link sumber belajar dari guru."}</p>
              {material.linkUrl ? (
                <a href={material.linkUrl} target="_blank" rel="noreferrer" className="button button--primary">
                  <ExternalLink size={16} /> Buka link
                </a>
              ) : (
                <div className="material-empty" style={{ minHeight: 0, padding: 16 }}>
                  <strong>Link belum diisi guru</strong>
                </div>
              )}
            </div>
          </div>
          <CompleteButton onClick={onComplete} label="Link sudah dibuka" />
        </div>
      )}

      {block.type === "quiz" && (
        <QuizLesson block={block} dbQuiz={dbQuiz} courseId={courseId} enrolled={enrolled} onComplete={onComplete} onToast={onToast} />
      )}

      {block.type === "activity" && (
        <ActivityLesson
          block={block}
          config={block.material?.activity}
          courseId={courseId}
          enrolled={enrolled}
          identity={identity}
          onComplete={onComplete}
          onToast={onToast}
        />
      )}

      {block.type === "game" && (
        (() => {
          const gameId = material.game?.gameId;
          if (gameId === "number-line-lab") {
            return (
              <div className="lesson-view">
                <LessonHeading icon={<Gamepad2 size={18} />} block={block} />
                <NumberLineVisualizer title={block.title || "Laboratorium Garis Bilangan Interaktif"} description={material.game?.instructions || block.description} />
                <CompleteButton onClick={onComplete} label="Aktivitas Lab selesai" />
              </div>
            );
          }
          const gameRoute = gameId === "charge-cards" ? "block-cards" : gameId === "number-line" ? "block-number-line" : "block-game";
          return (
            <div className="lesson-view">
              <LessonHeading icon={<Gamepad2 size={18} />} block={block} />
              <div className="game-lesson-card">
                <div className="game-lesson-card__art">{gameId === "charge-cards" ? "±" : gameId === "number-line" ? "↔" : "✦"}</div>
                <div>
                  <h2>{block.title}</h2>
                  <p>{material.game?.instructions || block.description}</p>
                  <Link href={`/learn/${courseSlug}/games?game=${gameRoute}`} className="button button--primary">
                    <Gamepad2 size={16} /> Buka game ini
                  </Link>
                </div>
              </div>
              <CompleteButton onClick={onComplete} label="Game selesai" />
            </div>
          );
        })()
      )}

      {block.type === "assignment" && (
        <AssignmentLesson
          block={block}
          courseId={courseId}
          enrolled={enrolled}
          account={account}
          identity={identity}
          onComplete={onComplete}
          onToast={onToast}
        />
      )}

      {block.type === "text" && (
        <div className="lesson-view">
          <LessonHeading icon={<FileText size={18} />} block={block} />
          {material.text ? (
            <div className="rich-material">
              <p>{material.text}</p>
              <div className="material-tip">
                <Sparkles size={15} /> Amati pergerakan pada garis bilangan interaktif di bawah ini untuk memperkuat pemahaman tandamu.
              </div>
            </div>
          ) : (
            <div className="material-empty">
              <FileText size={24} />
              <strong>Materi teks belum diisi</strong>
              <span>Guru dapat mengisi isi teks dari editor blok.</span>
            </div>
          )}
          <NumberLineVisualizer
            title="Eksplorasi Garis Bilangan: Tanda Positif & Negatif"
            description="Coba geser angka awal dan langkah gerak untuk melihat perpindahan titik secara langsung."
          />
          <CompleteButton onClick={onComplete} label="Materi selesai" />
        </div>
      )}

      {block.type === "reflection" && (
        <ReflectionLesson
          block={block}
          courseId={courseId}
          enrolled={enrolled}
          account={account}
          onComplete={onComplete}
          onToast={onToast}
        />
      )}
    </div>
  );
}

function LessonHeading({ icon, block }: { icon: React.ReactNode; block: LessonBlock }) {
  return (
    <div className="lesson-view__heading">
      <span className="lesson-view__icon">{icon}</span>
      <div>
        <div className="eyebrow">MATERI SISWA</div>
        <h2>{block.title}</h2>
        <p>{block.description}</p>
      </div>
      <StatusPill tone="teal">{block.duration}</StatusPill>
    </div>
  );
}

function CompleteButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button className="button button--primary" onClick={onClick} style={{ marginTop: 14 }}>
      <Check size={16} /> {label}
    </button>
  );
}

function useExistingSubmission(courseId: string | null, blockId: string, identity: Identity | null) {
  const [response, setResponse] = useState("");
  const [file, setFile] = useState<UploadedFile | null>(null);
  const [submittedAt, setSubmittedAt] = useState("");

  useEffect(() => {
    let active = true;
    if (courseId) {
      getMySubmission(courseId, blockId).then((row) => {
        if (!active || !row) return;
        setResponse(row.response ?? "");
        if (row.fileUrl) {
          setFile({ url: row.fileUrl, fileName: row.fileName ?? "Lampiran", fileType: row.fileType ?? "application/pdf" });
        }
        setSubmittedAt(row.submittedAt);
      });
    } else if (identity) {
      const local = getSubmissions().find(
        (item) => item.participantId === identity.participantId && item.blockId === blockId
      );
      if (local) {
        setResponse(local.response);
        setSubmittedAt(local.submittedAt);
      }
    }
    return () => {
      active = false;
    };
    // Cukup id peserta sebagai dependency agar objek identitas baru tidak memicu loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId, blockId, identity?.participantId]);

  return { response, setResponse, file, setFile, submittedAt, setSubmittedAt };
}

function ActivityLesson({
  block,
  config,
  courseId,
  enrolled,
  identity,
  onComplete,
  onToast,
}: {
  block: LessonBlock;
  config?: ActivityConfig;
  courseId: string | null;
  enrolled: boolean;
  identity: Identity | null;
  onComplete: () => void;
  onToast: (message: string) => void;
}) {
  const fallback: ActivityConfig = {
    templateId: "observing-questioning",
    prompt: "Amati masalah bilangan bulat dan tulis strategi penyelesaianmu.",
    evidenceLabel: "Jawaban tertulis",
    responseType: "short-answer",
    instructions: "Kerjakan dengan langkah yang runtut.",
    points: 10,
    graded: true,
    showScore: true,
    rubric: "Proses dan alasan matematis.",
  };
  const activity = config ?? fallback;
  const { response, setResponse, file, setFile, submittedAt, setSubmittedAt } = useExistingSubmission(courseId, block.id, identity);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showScore, setShowScore] = useState(false);

  const selectedChoice = activity.choices?.find((choice) => choice.value === response);
  const score = activity.responseType === "interactive" ? (selectedChoice?.correct ? activity.points : 0) : null;
  const needsAnswer =
    activity.responseType === "interactive"
      ? !response
      : activity.responseType === "upload"
        ? !file && !response.trim()
        : !response.trim();

  async function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0];
    event.target.value = "";
    if (!selected) return;
    if (!courseId || !enrolled) {
      onToast("Login sebagai siswa dan gabung pembelajaran agar lampiran tersimpan di database.");
      return;
    }
    setUploading(true);
    const result = await uploadAnswerFile(selected, courseId);
    setUploading(false);
    if (!result.ok || !result.file) {
      onToast(result.error ?? "Gagal mengunggah berkas.");
      return;
    }
    setFile(result.file);
    onToast("Lampiran tersimpan di database.");
  }

  async function submit() {
    if (needsAnswer) return;
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
      onToast("Jawaban terkirim ke guru dan tersimpan di database.");
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
        score,
        maxScore: activity.points,
        submittedAt: now,
        status: "submitted",
      });
      setSaving(false);
      onToast("Jawaban tersimpan di perangkat.");
    }

    setSubmittedAt(now);
    setShowScore(true);
  }

  return (
    <div className="lesson-view">
      <LessonHeading icon={<Sparkles size={18} />} block={block} />
      <div className="activity-lesson-card answer-panel">
        <div className="eyebrow">AKTIVITAS FPBL · {activity.templateId.replaceAll("-", " ").toUpperCase()}</div>
        <h2>{activity.prompt}</h2>

        <div className="form-grid">
          <div className="field field--full">
            <label>Instruksi aktivitas</label>
            <div className="field-static">{activity.instructions}</div>
          </div>
          <div className="field field--full">
            <label>Bukti yang dikumpulkan</label>
            <div className="field-static">{activity.evidenceLabel}</div>
          </div>
          <div className="field field--full">
            <label>Rubrik penilaian</label>
            <div className="field-static">{activity.rubric}</div>
          </div>
          {activity.responseType === "interactive" ? (
            <div className="field field--full">
              <label>Pilih satu jawaban</label>
              <div className="activity-choice-list">
                {(activity.choices?.length
                  ? activity.choices
                  : [
                      { label: "A", value: "Ya" },
                      { label: "B", value: "Tidak" },
                      { label: "C", value: "Belum yakin" },
                    ]
                ).map((choice) => (
                  <button
                    key={choice.label}
                    className={`activity-choice ${response === choice.value ? "is-selected" : ""}`}
                    onClick={() => setResponse(choice.value)}
                    disabled={Boolean(submittedAt)}
                  >
                    <strong>{choice.label}</strong>
                    <span>{choice.value}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {activity.responseType === "upload" && (
                <div className="field field--full">
                  <label>Upload bukti (gambar atau PDF)</label>
                  <label className="file-upload-zone">
                    <input type="file" accept="image/*,application/pdf" onChange={handleUpload} disabled={uploading || Boolean(submittedAt)} />
                    <Paperclip size={16} />
                    <span>{uploading ? "Mengunggah..." : "Pilih gambar atau PDF"}</span>
                  </label>
                  {file && (
                    <div className="file-chip-row">
                      <a href={file.url} target="_blank" rel="noreferrer" className="file-chip">
                        <FileText size={14} /> {file.fileName}
                      </a>
                      {!submittedAt && (
                        <button type="button" className="button button--ghost button--small" onClick={() => setFile(null)}>
                          <Trash2 size={13} /> Hapus
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
              <div className="field field--full">
                <label>Jawabanmu</label>
                <textarea
                  className="material-textarea"
                  value={response}
                  onChange={(event) => setResponse(event.target.value)}
                  placeholder={activity.responseType === "essay" ? "Tulis penjelasan dan strategi kelompokmu..." : "Tulis jawabanmu..."}
                  rows={6}
                  disabled={Boolean(submittedAt)}
                />
                <small className="field-helper">{response.trim().length} karakter</small>
              </div>
            </>
          )}
        </div>

        {!submittedAt ? (
          <button className="button button--primary" disabled={saving || uploading || needsAnswer} onClick={submit} style={{ marginTop: 14 }}>
            {saving ? <Loader2 size={16} className="spin" /> : <Check size={16} />} Kirim jawaban
          </button>
        ) : (
          <div className="preview-result is-good" style={{ marginTop: 14 }}>
            <Check size={15} /> Jawaban terkirim pada {new Date(submittedAt).toLocaleString("id-ID")}.{" "}
            {showScore && activity.showScore && activity.responseType === "interactive"
              ? `Skor: ${score}/${activity.points}.`
              : "Menunggu peninjauan guru."}
          </div>
        )}
      </div>
      {submittedAt && <CompleteButton onClick={onComplete} label="Aktivitas selesai" />}
    </div>
  );
}

function ReflectionLesson({
  block,
  courseId,
  enrolled,
  account,
  onComplete,
  onToast,
}: {
  block: LessonBlock;
  courseId: string | null;
  enrolled: boolean;
  account: { id: string; fullName: string; className: string } | null;
  onComplete: () => void;
  onToast: (message: string) => void;
}) {
  const identity = account ? { name: account.fullName, className: account.className, participantId: account.id } : null;
  const { response, setResponse, submittedAt, setSubmittedAt } = useExistingSubmission(courseId, block.id, identity);
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!response.trim()) return;
    setSaving(true);
    if (courseId && enrolled) {
      const res = await submitAssignment({ courseId, blockId: block.id, response });
      setSaving(false);
      if (!res.ok) {
        onToast(res.error ?? "Gagal menyimpan refleksi.");
        return;
      }
      onToast("Refleksi tersimpan di database.");
    } else {
      setSaving(false);
      onToast("Refleksi tersimpan di perangkat.");
    }
    setSubmittedAt(new Date().toISOString());
  }

  return (
    <div className="lesson-view">
      <LessonHeading icon={<Sparkles size={18} />} block={block} />
      <div className="activity-lesson-card answer-panel">
        <div className="eyebrow">REFLEKSI STRATEGI PEMBELAJARAN</div>
        <h2>{block.title}</h2>
        <p>{block.material?.text || block.description}</p>
        <div className="form-grid">
          <div className="field field--full">
            <label>Refleksimu</label>
            <textarea
              className="material-textarea"
              placeholder="Tulis refleksimu di sini..."
              value={response}
              onChange={(event) => setResponse(event.target.value)}
              rows={5}
              disabled={Boolean(submittedAt)}
            />
          </div>
        </div>
        {!submittedAt ? (
          <button className="button button--primary" onClick={submit} disabled={saving || !response.trim()} style={{ marginTop: 14 }}>
            {saving ? <Loader2 size={16} className="spin" /> : <Check size={16} />} Simpan refleksi
          </button>
        ) : (
          <div className="preview-result is-good" style={{ marginTop: 14 }}>
            <Check size={15} /> Refleksi tersimpan. Terima kasih!
          </div>
        )}
      </div>
      {submittedAt && <CompleteButton onClick={onComplete} label="Materi selesai" />}
    </div>
  );
}

function AssignmentLesson({
  block,
  courseId,
  enrolled,
  account,
  identity,
  onComplete,
  onToast,
}: {
  block: LessonBlock;
  courseId: string | null;
  enrolled: boolean;
  account: { id: string; fullName: string; className: string } | null;
  identity: Identity | null;
  onComplete: () => void;
  onToast: (message: string) => void;
}) {
  const activeIdentity = account
    ? { name: account.fullName, className: account.className, participantId: account.id }
    : identity;
  const { response, setResponse, file, setFile, submittedAt, setSubmittedAt } = useExistingSubmission(courseId, block.id, activeIdentity);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const pdfUrl = block.material?.pdfUrl;

  async function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0];
    event.target.value = "";
    if (!selected) return;
    if (!courseId || !enrolled) {
      onToast("Login sebagai siswa dan gabung pembelajaran agar jawaban tersimpan di database.");
      return;
    }
    setUploading(true);
    const result = await uploadAnswerFile(selected, courseId);
    setUploading(false);
    if (!result.ok || !result.file) {
      onToast(result.error ?? "Gagal mengunggah berkas.");
      return;
    }
    setFile(result.file);
    onToast("Lampiran jawaban tersimpan di database.");
  }

  async function submit() {
    if (!response.trim() && !file) return;
    setSaving(true);
    const now = new Date().toISOString();

    if (courseId && enrolled && activeIdentity) {
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
      onToast("Tugas dan lampiran jawaban tersimpan di database.");
    } else if (activeIdentity) {
      saveSubmission({
        id: `${activeIdentity.participantId}-${block.id}`,
        participantId: activeIdentity.participantId,
        participantName: activeIdentity.name,
        className: activeIdentity.className,
        blockId: block.id,
        blockTitle: block.title,
        moduleId: block.moduleId,
        response,
        score: null,
        maxScore: 20,
        submittedAt: now,
        status: "submitted",
      });
      setSaving(false);
      onToast("Jawaban tersimpan di perangkat.");
    }

    setSubmittedAt(now);
  }

  const imageFile = file && file.fileType.startsWith("image/");

  return (
    <div className="lesson-view">
      <LessonHeading icon={<FileText size={18} />} block={block} />
      {pdfUrl ? (
        <PdfViewer url={pdfUrl} fileName={block.material?.fileName} />
      ) : (
        <div className="material-empty">
          <FileText size={24} />
          <strong>E-LKPD</strong>
          <span>Guru belum melampirkan PDF untuk tugas ini.</span>
        </div>
      )}
      {block.material?.text && (
        <div className="rich-material" style={{ borderLeft: "4px solid var(--teal)", marginTop: 14 }}>
          <h4 style={{ margin: "0 0 8px", fontSize: "0.95rem", color: "var(--teal)" }}>📖 Kasus Soal Cerita</h4>
          <p>{block.material.text}</p>
        </div>
      )}

      <div className="activity-lesson-card answer-panel">
        <div className="eyebrow">LEMBAR KERJA · JAWABAN & LAMPIRAN</div>
        <div className="form-grid">
          <div className="field field--full">
            <label>Keterangan / kesimpulan perhitungan</label>
            <textarea
              className="material-textarea"
              value={response}
              onChange={(event) => setResponse(event.target.value)}
              placeholder="Tuliskan hasil akhir dan alasan mengapa hasilnya bernilai positif/negatif..."
              rows={4}
              disabled={Boolean(submittedAt)}
            />
          </div>
          <div className="field field--full">
            <label>Lampiran jawaban (foto atau PDF)</label>
            <label className="file-upload-zone">
              <input type="file" accept="image/*,application/pdf" onChange={handleUpload} disabled={uploading || Boolean(submittedAt)} />
              <Paperclip size={16} />
              <span>{uploading ? "Mengunggah..." : "Pilih foto lembar kerja atau PDF"}</span>
            </label>
            <small className="field-helper">Foto JPG/PNG atau PDF, maksimal 5–8 MB.</small>
            {file && (
              <div className="attachment-preview">
                {imageFile ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={file.url} alt={file.fileName} />
                ) : null}
                <div className="file-chip-row">
                  <a href={file.url} target="_blank" rel="noreferrer" className="file-chip">
                    <FileText size={14} /> {file.fileName}
                  </a>
                  {!submittedAt && (
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
          disabled={saving || uploading || (!response.trim() && !file) || Boolean(submittedAt)}
          onClick={submit}
        >
          {saving ? <Loader2 size={16} className="spin" /> : <Check size={16} />}
          {submittedAt ? "Tugas terkirim" : "Kirim jawaban & lampiran"}
        </button>

        {submittedAt && (
          <div className="preview-result is-good" style={{ marginTop: 12 }}>
            <Check size={15} /> Tugas terkirim pada {new Date(submittedAt).toLocaleString("id-ID")}. Menunggu peninjauan guru.
          </div>
        )}
      </div>

      {submittedAt && <CompleteButton onClick={onComplete} label="Tugas selesai" />}
    </div>
  );
}

function MediaEmbed({ videoUrl, driveUrl }: { videoUrl?: string; driveUrl?: string }) {
  const [embedError, setEmbedError] = useState(false);
  const url = videoUrl || driveUrl;
  if (!url)
    return (
      <div className="material-empty">
        <Video size={24} />
        <strong>Video belum ditambahkan</strong>
        <span>Guru dapat memasukkan link YouTube atau Google Drive di editor blok.</span>
      </div>
    );
  const embed = videoUrl ? youtubeEmbed(url) : driveEmbed(url);
  return (
    <div className="media-frame">
      {embed && !embedError ? (
        <iframe
          src={embed}
          title="Materi video"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
          onError={() => setEmbedError(true)}
        />
      ) : (
        <div className="media-link-card">
          <Link2 size={20} />
          <div>
            <strong>Video siap dibuka</strong>
            <small>YouTube membatasi embed pada sebagian video. Buka dari link asli untuk memutar tanpa error 153.</small>
          </div>
          <a href={url} target="_blank" rel="noreferrer" className="button button--ghost button--small">
            Buka video <ExternalLink size={14} />
          </a>
        </div>
      )}
    </div>
  );
}

function youtubeEmbed(url: string) {
  try {
    const parsed = new URL(url);
    const id = parsed.searchParams.get("v") || parsed.pathname.split("/").filter(Boolean).pop();
    if (!id) return "";
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1&playsinline=1${origin ? `&origin=${encodeURIComponent(origin)}` : ""}`;
  } catch {
    return url.includes("youtube.com/embed") || url.includes("youtube-nocookie.com/embed") ? url : "";
  }
}

function driveEmbed(url: string) {
  return url.includes("drive.google.com") ? url.replace(/\/view.*$/, "/preview") : url;
}

function pdfPreviewUrl(url: string) {
  return url.includes("drive.google.com") ? url.replace(/\/view.*$/, "/preview") : url;
}

function PdfViewer({ url, fileName }: { url: string; fileName?: string }) {
  const preview = pdfPreviewUrl(url);
  const [openedInNewTab, setOpenedInNewTab] = useState(false);
  return (
    <div className="pdf-viewer">
      <div className="pdf-viewer__head">
        <span>
          <FileText size={17} /> {fileName || "PDF dari guru"}
        </span>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            className="button button--primary button--small"
            onClick={() => window.open(preview, "_blank", "noopener")}
          >
            <ExternalLink size={14} /> Buka di tab baru
          </button>
          <a href={preview} download={fileName || "materi.pdf"} className="button button--ghost button--small">
            <Download size={14} /> Unduh
          </a>
        </div>
      </div>
      {!openedInNewTab ? (
        <iframe
          src={preview}
          title={fileName || "Modul PDF"}
          style={{ width: "100%", height: 520, border: "1px solid var(--line)" }}
          onError={() => setOpenedInNewTab(true)}
        />
      ) : (
        <p style={{ marginTop: 10, color: "var(--muted)", fontSize: "0.78rem" }}>
          PDF dibuka di tab baru karena browser memblokir embed otomatis.
        </p>
      )}
    </div>
  );
}

function QuizLesson({
  block,
  dbQuiz,
  courseId,
  enrolled,
  onComplete,
  onToast,
}: {
  block: LessonBlock;
  dbQuiz: DbQuiz;
  courseId: string | null;
  enrolled: boolean;
  onComplete: () => void;
  onToast: (message: string) => void;
}) {
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<{ score: number; total: number } | null>(null);
  const [saving, setSaving] = useState(false);

  // Cek apakah kuis ada di database tapi kosong (belum diisi guru)
  if (!dbQuiz) {
    return (
      <div className="lesson-view">
        <LessonHeading icon={<ClipboardCheck size={18} />} block={block} />
        <div className="empty-state-card">
          <ClipboardCheck size={26} />
          <h2>Kuis belum tersedia di database</h2>
          <p>Sedang dimuat. Silakan muat ulang halaman.</p>
        </div>
      </div>
    );
  }

  if (dbQuiz.questions.length === 0) {
    return (
      <div className="lesson-view">
        <LessonHeading icon={<ClipboardCheck size={18} />} block={block} />
        <div className="empty-state-card">
          <ClipboardCheck size={26} />
          <h2>Kuis belum diisi guru</h2>
          <p>Guru belum menambahkan soal. Kuis ini akan aktif setelah soal ditambahkan.</p>
        </div>
      </div>
    );
  }

  const question = dbQuiz.questions[index];
  const last = index === dbQuiz.questions.length - 1;

  async function submitDb() {
    if (!courseId || !enrolled) {
      onToast("Login sebagai siswa yang sudah bergabung agar nilai tersimpan.");
      return;
    }
    setSaving(true);
    const res = await submitQuizAttempt({ courseId, blockId: block.id, answers });
    setSaving(false);
    if (!res.ok) {
      onToast(res.error ?? "Gagal menyimpan hasil kuis.");
      return;
    }
    setResult({ score: res.score ?? 0, total: res.total ?? 0 });
    onToast("Hasil kuis tersimpan dan terlihat guru.");
  }

  return (
    <div className="lesson-view quiz-page">
      <div className="eyebrow">
        {dbQuiz.title.toUpperCase()} · {index + 1}/{dbQuiz.questions.length}
      </div>
      <h2>{dbQuiz.instructions}</h2>
      <p className="quiz-question">{question.prompt}</p>
      <div className="quiz-options">
        {question.options.filter(Boolean).map((option) => (
          <button
            key={option}
            className={`quiz-option ${selected === option ? "is-selected" : ""}`}
            onClick={() => {
              setSelected(option);
              setAnswers((current) => ({ ...current, [question.id]: option }));
            }}
            disabled={Boolean(result)}
          >
            {option}
            <span>{selected === option ? <Check size={15} /> : null}</span>
          </button>
        ))}
      </div>
      {result && (
        <div className="quiz-feedback is-good">
          <Sparkles size={16} /> Nilai kamu {result.score}/{result.total}.{" "}
          {result.total > 0 && (result.score / result.total) * 100 >= dbQuiz.passThreshold ? "Lulus!" : "Belum lulus, coba lagi pada kesempatan berikutnya."}
        </div>
      )}
      <div className="quiz-footer">
        <span>{Object.keys(answers).length} jawaban tercatat</span>
        {last ? (
          <button className="button button--primary button--small" disabled={!selected || saving || Boolean(result)} onClick={submitDb}>
            {saving ? <Loader2 size={15} className="spin" /> : <Check size={14} />} Kirim jawaban
          </button>
        ) : (
          <button
            className="button button--primary button--small"
            disabled={!selected}
            onClick={() => {
              setIndex((value) => value + 1);
              setSelected("");
            }}
          >
            Lanjut <ArrowRight size={14} />
          </button>
        )}
      </div>
      {result && (
        <div style={{ marginTop: 14 }}>
          <CompleteButton onClick={onComplete} label="Kuis selesai" />
        </div>
      )}
    </div>
  );
}
