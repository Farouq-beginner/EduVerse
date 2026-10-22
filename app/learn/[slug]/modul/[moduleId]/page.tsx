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
  Sparkles,
  Video,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { StatusPill } from "@/components/DashboardBits";
import { Toast } from "@/components/Toast";
import { DiscussionForum } from "@/components/DiscussionForum";
import { InteractiveVisual } from "@/components/InteractiveVisual";
import { WorksheetForm } from "@/components/WorksheetForm";
import type { LessonBlock, Module } from "@/lib/demo-data";
import {
  getCompleted,
  getCourseBlocks,
  getCourseModules,
  getIdentity,
  saveCompleted,
  saveProgress,
} from "@/lib/storage";
import { getCourseStructure, getMyCourseProgress, getQuizForBlock, getSessionProfile, type DbCourse } from "@/lib/actions/dashboards";
import { markBlockComplete, submitQuizAttempt, syncBlockCompletions } from "@/lib/actions/progress";
import { toModule } from "@/lib/course";
import { fileKindLabel } from "@/lib/upload";

type Identity = { name: string; className: string; participantId: string };
type DbQuiz = Awaited<ReturnType<typeof getQuizForBlock>>;

const ACCENTS: Record<string, "violet" | "teal" | "yellow" | "coral"> = {
  "module-observe": "violet",
  "module-explore": "teal",
  "module-investigate": "yellow",
  "module-present": "coral",
};

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
            <strong>Memuat pembelajaran...</strong>
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
            <p>Pertemuan hanya bisa dibuka dari pembelajaran yang sudah dipublikasikan guru.</p>
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
            <h1>Masuk dulu untuk membuka pertemuan</h1>
            <p>Halaman pertemuan ini mengikuti identitas dan progres siswa dari ruang belajar.</p>
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
            <ArrowLeft size={14} /> Semua pertemuan
          </Link>
          <div className="empty-state-card">
            <FileText size={26} />
            <h1>Pertemuan tidak ditemukan</h1>
            <p>Pertemuan ini mungkin sudah dihapus guru.</p>
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
            <ArrowLeft size={14} /> Semua pertemuan
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
              {module.eyebrow || `PERTEMUAN ${String(moduleIndex + 1).padStart(2, "0")}`} · {(module.duration || "10 menit").toUpperCase()}
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
            <div className="eyebrow">ISI PERTEMUAN</div>
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
            {blocks.length === 0 && <p className="section-subtitle">Guru belum mengisi materi pertemuan ini.</p>}
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
                key={selected.id}
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
                <p>Guru belum mengisi blok pada pertemuan ini.</p>
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
  const [showVisual, setShowVisual] = useState(false);
  const worksheet = material.worksheet;

  return (
    <div>
      {block.type === "video" && (
        <div className="lesson-view">
          <LessonHeading icon={<Video size={18} />} block={block} />
          <MediaEmbed videoUrl={material.videoUrl} driveUrl={material.driveUrl} />
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
        </div>
      )}

      {block.type === "quiz" && (
        <QuizLesson block={block} dbQuiz={dbQuiz} courseId={courseId} enrolled={enrolled} onComplete={onComplete} onToast={onToast} />
      )}

      {block.type === "activity" && (
        <div className="lesson-view">
          <LessonHeading icon={<Sparkles size={18} />} block={block} />
          <div style={{ marginTop: 14 }}>
            <button
              type="button"
              className="button button--ghost button--small"
              onClick={() => setShowVisual((current) => !current)}
              style={{ marginBottom: 12 }}
            >
              <Sparkles size={15} /> {showVisual ? "Tutup Visual" : "Buka Visual"}
            </button>
            {showVisual && (
              <InteractiveVisual
                visualId={material.activity?.visualId ?? "number-line-lab"}
                onComplete={onComplete}
              />
            )}
          </div>
        </div>
      )}

      {block.type === "game" && (
        <div className="lesson-view">
          <LessonHeading icon={<Gamepad2 size={18} />} block={block} />
          <div className="game-lesson-card">
            <div className="game-lesson-card__art">{material.game?.gameId === "charge-cards" ? "±" : material.game?.gameId === "number-line" ? "↔" : "✦"}</div>
            <div>
              <h2>{block.title}</h2>
              <p>{material.game?.instructions || block.description}</p>
              <Link href={`/learn/${courseSlug}/games`} className="button button--primary">
                <Gamepad2 size={16} /> Buka game ini
              </Link>
            </div>
          </div>
        </div>
      )}

      {block.type === "text" && (
        <div className="lesson-view">
          <LessonHeading icon={<FileText size={18} />} block={block} />
          {material.text ? (
            <div className="rich-material">
              <p>{material.text}</p>
            </div>
          ) : (
            <div className="material-empty">
              <FileText size={24} />
              <strong>Materi teks belum diisi</strong>
              <span>Guru dapat mengisi isi teks dari editor materi.</span>
            </div>
          )}
        </div>
      )}

      {(block.type === "assignment" || block.type === "reflection") && (
        <div className="lesson-view">
          <LessonHeading icon={<FileText size={18} />} block={block} />
          {material.text && (
            <div className="rich-material">
              <p>{material.text}</p>
            </div>
          )}
        </div>
      )}

      {/* Berkas materi berlaku untuk semua tipe: PDF, PPT, DOCX, atau gambar. */}
      {material.pdfUrl && (
        <MaterialFile
          url={material.pdfUrl}
          fileName={material.fileName}
          mime={material.fileMime}
        />
      )}

      <WorksheetForm
        block={block}
        worksheet={worksheet}
        courseId={courseId}
        enrolled={enrolled}
        identity={account ? { name: account.fullName, className: account.className, participantId: account.id } : identity}
        onSubmitted={onComplete}
        onToast={onToast}
      />

      {worksheet?.enabled === false && <CompleteButton onClick={onComplete} label="Materi selesai" />}
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

function MaterialFile({ url, fileName, mime }: { url: string; fileName?: string; mime?: string }) {
  const label = fileKindLabel(mime, fileName);
  if (mime?.startsWith("image/")) {
    return (
      <div className="attachment-preview" style={{ marginTop: 16 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={fileName || "Berkas materi"} />
        <div className="file-chip-row">
          <a href={url} target="_blank" rel="noreferrer" className="file-chip">
            <FileText size={14} /> {fileName || "Berkas materi"}
          </a>
        </div>
      </div>
    );
  }
  if (!mime || mime === "application/pdf") {
    return <PdfViewer url={url} fileName={fileName} />;
  }
  return (
    <div className="pdf-viewer" style={{ marginTop: 16 }}>
      <div className="pdf-viewer__head">
        <span>
          <FileText size={17} /> {fileName || `Berkas ${label}`}
        </span>
        <div style={{ display: "flex", gap: 8 }}>
          <a href={url} target="_blank" rel="noreferrer" className="button button--primary button--small">
            <ExternalLink size={14} /> Lihat {label}
          </a>
          <a href={url} download={fileName || `materi.${label.toLowerCase()}`} className="button button--ghost button--small">
            <Download size={14} /> Unduh
          </a>
        </div>
      </div>
      <p style={{ marginTop: 10, color: "var(--muted)", fontSize: "0.78rem" }}>
        Berkas {label} tidak bisa dipratinjau di browser. Buka di tab baru atau unduh untuk membacanya.
      </p>
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
        <span>Guru dapat memasukkan link YouTube atau Google Drive di editor materi.</span>
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
          <h2>Kuis belum tersedia</h2>
          <p>Guru belum mempublikasikan kuis ini. Coba muat ulang halaman.</p>
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
