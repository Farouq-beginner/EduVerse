"use client";

import Link from "next/link";
import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  ClipboardCheck,
  Copy,
  Eye,
  FileText,
  Gamepad2,
  Link2,
  Loader2,
  MessageCircle,
  Pencil,
  Plus,
  Save,
  Sparkles,
  Trash2,
  Video,
  X,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { StatusPill } from "@/components/DashboardBits";
import { Toast } from "@/components/Toast";
import { DiscussionForum } from "@/components/DiscussionForum";
import {
  activityTemplates,
  gameTemplates,
  type ActivityConfig,
  type GameBlockConfig,
  type LessonBlock,
  type Module,
} from "@/lib/demo-data";
import {
  getTeacherCourseBuilder,
  saveCourseStructure,
  updateCourseMeta,
  updateCourseSettings,
} from "@/lib/actions/dashboards";
import { deleteStoredFile } from "@/lib/actions/files";
import { toModule, toSavePayload } from "@/lib/course";

const iconMap = {
  text: FileText,
  video: Video,
  link: Link2,
  activity: Sparkles,
  quiz: ClipboardCheck,
  assignment: FileText,
  game: Gamepad2,
  reflection: MessageCircle,
};

const newBlockTemplates: Array<{ type: LessonBlock["type"]; label: string; icon: typeof FileText }> = [
  { type: "text", label: "Teks", icon: FileText },
  { type: "video", label: "Video / YouTube", icon: Video },
  { type: "link", label: "Link", icon: Link2 },
  { type: "activity", label: "Aktivitas", icon: Sparkles },
  { type: "quiz", label: "Kuis", icon: ClipboardCheck },
  { type: "assignment", label: "PDF / Tugas", icon: FileText },
  { type: "game", label: "Game", icon: Gamepad2 },
];

type MaterialDraft = {
  text: string;
  videoUrl: string;
  driveUrl: string;
  pdfUrl: string;
  pdfFileId: string;
  fileMime: string;
  linkUrl: string;
  linkTitle: string;
  linkDescription: string;
  fileName: string;
  activity: ActivityConfig;
  game: GameBlockConfig;
};

const blankActivity: ActivityConfig = {
  templateId: "observing-questioning",
  prompt: activityTemplates[0].prompt,
  evidenceLabel: activityTemplates[0].evidenceLabel,
  responseType: "interactive",
  choices: [
    { label: "A", value: "−8", correct: true },
    { label: "B", value: "0" },
    { label: "C", value: "8" },
  ],
  instructions: "Ikuti langkah aktivitas, tuliskan strategi yang kamu gunakan, lalu kirim jawaban untuk ditinjau guru.",
  points: 10,
  graded: true,
  showScore: true,
  rubric: "Strategi benar (5), proses terlihat (3), refleksi jelas (2).",
};
const blankGame: GameBlockConfig = {
  gameId: "number-line-challenge",
  instructions: "Jawab tantangan operasi bilangan bulat dengan cepat dan tepat.",
  points: 20,
  graded: true,
  showScore: true,
  passThreshold: 70,
};  const blankMaterial: MaterialDraft = {
    text: "",
    videoUrl: "",
    driveUrl: "",
    pdfUrl: "",
    pdfFileId: "",
    fileMime: "",
    linkUrl: "",
    linkTitle: "",
    linkDescription: "",
    fileName: "",
    activity: blankActivity,
    game: blankGame,
  };

type ModuleDraft = { title: string; eyebrow: string; duration: string; accent: Module["accent"] };

export default function CourseBuilderPage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const slug = params.slug;

  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [courseId, setCourseId] = useState<string | null>(null);
  const [teacherName, setTeacherName] = useState("");
  const [meta, setMeta] = useState({ title: "", description: "", subject: "", grade: "" });
  const [metaSaving, setMetaSaving] = useState(false);
  const [access, setAccess] = useState<"open" | "locked">("open");
  const [state, setState] = useState<"draft" | "published">("published");
  const [modules, setModules] = useState<Module[]>([]);
  const [blocks, setBlocks] = useState<LessonBlock[]>([]);
  const [toast, setToast] = useState("");
  const [showAdd, setShowAdd] = useState<string | null>(null);
  const [editingBlock, setEditingBlock] = useState<LessonBlock | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [linkTitle, setLinkTitle] = useState("");
  const [linkDescription, setLinkDescription] = useState("");
  const [material, setMaterial] = useState<MaterialDraft>(blankMaterial);
  const [uploading, setUploading] = useState(false);
  const [moduleDraft, setModuleDraft] = useState<ModuleDraft | null>(null);
  const [editingModuleId, setEditingModuleId] = useState<string | null>(null);
  const [forumModule, setForumModule] = useState<Module | null>(null);

  // Muat struktur course milik guru ini dari database — tanpa data demo.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await getTeacherCourseBuilder(slug);
        if (!active) return;
        if (!data) {
          setNotFound(true);
          return;
        }
        const structure = data.structure;
        setCourseId(structure.id);
        setTeacherName(data.teacherName);
        setMeta({
          title: structure.title,
          description: structure.description,
          subject: structure.subject,
          grade: structure.grade,
        });
        setAccess(structure.access === "LOCKED" ? "locked" : "open");
        setState(structure.state === "PUBLISHED" ? "published" : "draft");
        const dbModules = structure.modules.map(toModule);
        setModules(dbModules);
        setBlocks(dbModules.flatMap((module) => module.lessons));
      } catch {
        if (active) setNotFound(true);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [slug]);

  function copyLink() {
    navigator.clipboard?.writeText(`${window.location.origin}/learn/${slug}`);
    setToast("Link pembelajaran disalin.");
  }

  /** Modul efektif: blok urut modul + blok tambahan milik modul tersebut. */
  function effectiveModules(nextBlocks: LessonBlock[] = blocks, nextModules: Module[] = modules): Module[] {
    const byId = new Map(nextBlocks.map((block) => [block.id, block]));
    return nextModules.map((module) => {
      const ordered = module.lessons.map((seed) => byId.get(seed.id)).filter(Boolean) as LessonBlock[];
      const extras = nextBlocks.filter(
        (block) => block.moduleId === module.id && !module.lessons.some((lesson) => lesson.id === block.id)
      );
      return { ...module, lessons: [...ordered, ...extras] };
    });
  }

  /** Simpan struktur (modul + blok) ke database guru, lalu muat ulang id baru. */
  async function saveToDb(nextModules: Module[], nextBlocks: LessonBlock[]) {
    if (!courseId) {
      setToast("Course belum ada di database. Login sebagai guru pemilik course.");
      return null;
    }
    setSyncing(true);
    const res = await saveCourseStructure(courseId, toSavePayload(effectiveModules(nextBlocks, nextModules)));
    setSyncing(false);
    if (!res.ok) {
      setToast(res.error ?? "Gagal menyimpan ke database.");
      return null;
    }
    if (res.structure) {
      const dbModules = res.structure.modules.map(toModule);
      setModules(dbModules);
      setBlocks(dbModules.flatMap((module) => module.lessons));
    }
    setToast("Perubahan tersimpan di database dan langsung terlihat siswa.");
    return res.structure ?? null;
  }

  async function toggleAccess() {
    const next = access === "open" ? "locked" : "open";
    setAccess(next);
    if (courseId) {
      const res = await updateCourseSettings(courseId, { access: next });
      setToast(res.ok ? (next === "open" ? "Akses masuk dibuka." : "Akses baru dikunci.") : res.error ?? "Gagal menyimpan pengaturan.");
      return;
    }
    setToast(next === "open" ? "Akses masuk dibuka." : "Akses baru dikunci.");
  }

  async function togglePublish() {
    const next = state === "published" ? "draft" : "published";
    setState(next);
    if (courseId) {
      const res = await updateCourseSettings(courseId, { state: next });
      setToast(res.ok ? (next === "published" ? "Versi terbaru dipublikasikan." : "Disimpan sebagai draft.") : res.error ?? "Gagal menyimpan pengaturan.");
      return;
    }
    setToast(next === "published" ? "Versi terbaru dipublikasikan." : "Disimpan sebagai draft.");
  }

  async function saveMeta() {
    if (!courseId || !meta.title.trim()) return;
    setMetaSaving(true);
    const res = await updateCourseMeta(courseId, meta);
    setMetaSaving(false);
    setToast(res.ok ? "Identitas pembelajaran tersimpan." : res.error ?? "Gagal menyimpan identitas.");
  }

  function openAddModule() {
    const nextNumber = modules.length + 1;
    setEditingModuleId(null);
    setModuleDraft({
      title: "",
      eyebrow: `Modul ${String(nextNumber).padStart(2, "0")}`,
      duration: "10 menit",
      accent: "violet",
    });
  }

  function openEditModule(module: Module) {
    setEditingModuleId(module.id);
    setModuleDraft({
      title: module.title,
      eyebrow: module.eyebrow || "",
      duration: module.duration || "10 menit",
      accent: module.accent,
    });
  }

  async function saveModule() {
    if (!moduleDraft || !moduleDraft.title.trim()) {
      setToast("Judul modul wajib diisi.");
      return;
    }
    const draft = moduleDraft;
    setModuleDraft(null);

    if (editingModuleId) {
      const next = modules.map((module) =>
        module.id === editingModuleId
          ? { ...module, title: draft.title.trim(), eyebrow: draft.eyebrow.trim(), duration: draft.duration.trim() || "10 menit", accent: draft.accent }
          : module
      );
      setModules(next);
      await saveToDb(next, blocks);
      setToast("Modul diperbarui.");
      return;
    }

    const temp: Module = {
      id: `module-${Date.now()}`,
      title: draft.title.trim(),
      eyebrow: draft.eyebrow.trim() || `Modul ${String(modules.length + 1).padStart(2, "0")}`,
      duration: draft.duration.trim() || "10 menit",
      accent: draft.accent,
      lessons: [],
    };
    const next = [...modules, temp];
    setModules(next);
    await saveToDb(next, blocks);
  }

  async function removeModule(moduleId: string) {
    const module = modules.find((item) => item.id === moduleId);
    if (!module || !window.confirm(`Hapus ${module.title} beserta semua materinya?`)) return;
    const nextModules = modules.filter((item) => item.id !== moduleId);
    const nextBlocks = blocks.filter((block) => block.moduleId !== moduleId);
    setModules(nextModules);
    setBlocks(nextBlocks);
    setForumModule(null);
    await saveToDb(nextModules, nextBlocks);
    setToast("Modul dan materi di dalamnya dihapus.");
  }

  async function addBlock(moduleId: string, type: LessonBlock["type"], label: string) {
    const id = `custom-${Date.now()}`;
    const nextMaterial =
      type === "activity"
        ? { activity: { ...blankActivity } }
        : type === "game"
          ? { game: { ...blankGame } }
          : type === "link"
            ? { linkUrl: "" }
            : {};
    const next = [
      ...blocks,
      {
        id,
        moduleId,
        type,
        title: `${label} baru`,
        description: type === "link" ? "Tulis deskripsi singkat link ini." : "Isi materi ini dari editor blok.",
        duration: "05 menit",
        status: "new" as const,
        material: nextMaterial,
      },
    ];
    setBlocks(next);
    setShowAdd(null);
    const structure = await saveToDb(modules, next);
    if (type === "quiz") {
      // Blok kuis baru hanya punya id database setelah disimpan.
      const dbModule = structure?.modules.find((item) => item.id === moduleId);
      const dbBlock = dbModule?.blocks[dbModule.blocks.length - 1];
      const quizBlockId = dbBlock?.id ?? id;
      router.push(`/teacher/course/${slug}/quiz/${quizBlockId}`);
      return;
    }
    setToast(`${label} ditambahkan ke ${modules.find((module) => module.id === moduleId)?.title}.`);
  }

  function openEditor(block: LessonBlock) {
    if (block.type === "quiz") {
      router.push(`/teacher/course/${slug}/quiz/${block.id}`);
      return;
    }
    setEditingBlock(block);
    setEditTitle(block.title);
    setEditDescription(block.description);
    setLinkTitle(block.material?.linkTitle ?? "");
    setLinkDescription(block.material?.linkDescription ?? "");
    setMaterial({
      ...blankMaterial,
      ...block.material,
      pdfFileId: block.material?.pdfFileId ?? "",
      fileMime: block.material?.fileMime ?? "",
      linkUrl: block.material?.linkUrl ?? "",
      linkTitle: block.material?.linkTitle ?? "",
      linkDescription: block.material?.linkDescription ?? "",
      activity: {
        ...blankActivity,
        ...block.material?.activity,
        templateId: block.material?.activity?.templateId || blankActivity.templateId,
        prompt: block.material?.activity?.prompt || blankActivity.prompt,
        evidenceLabel: block.material?.activity?.evidenceLabel || blankActivity.evidenceLabel,
      },
      game: { ...blankGame, ...block.material?.game },
    });
  }

  async function handlePdfUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !courseId) return;
    if (file.type !== "application/pdf") {
      setToast("Pilih berkas PDF.");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setToast("Ukuran PDF maksimal 8 MB.");
      return;
    }
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("courseId", courseId);
      form.append("purpose", "material");
      const response = await fetch("/api/files", { method: "POST", body: form });
      const data = (await response.json()) as { ok?: boolean; url?: string; fileId?: string; fileName?: string; mimeType?: string; error?: string };
      if (!response.ok || !data.ok || !data.url) {
        setToast(data.error ?? "Gagal mengunggah PDF.");
        return;
      }
      setMaterial((current) => ({
        ...current,
        pdfUrl: data.url!,
        pdfFileId: data.fileId ?? "",
        fileName: data.fileName ?? file.name,
        fileMime: data.mimeType ?? "application/pdf",
      }));
      setToast("PDF tersimpan di database.");
    } catch {
      setToast("Gagal mengunggah PDF.");
    } finally {
      setUploading(false);
    }
  }

  async function removePdf() {
    const fileId = material.pdfFileId;
    setMaterial((current) => ({ ...current, pdfUrl: "", pdfFileId: "", fileName: "", fileMime: "" }));
    if (fileId) await deleteStoredFile(fileId).catch(() => undefined);
    setToast("Berkas PDF dihapus dari materi.");
  }

  async function saveBlockEdit() {
    if (!editingBlock || !editTitle.trim()) return;
    const next = blocks.map((item) =>
      item.id === editingBlock.id
        ? {
            ...item,
            title: editTitle.trim(),
            description: editDescription.trim() || item.description,
            material: {
              ...material,
              linkTitle: linkTitle.trim() || (material.linkUrl ? "Link" : ""),
              linkDescription: linkDescription.trim() || "",
            },
          }
        : item
    );
    setBlocks(next);
    setEditingBlock(null);
    await saveToDb(modules, next);
    setToast("Materi blok disimpan dan siap tampil di halaman siswa.");
  }

  async function removeBlock(id: string) {
    const next = blocks.filter((item) => item.id !== id);
    setBlocks(next);
    await saveToDb(modules, next);
    setToast("Blok dihapus dari pembelajaran.");
  }

  const blockById = useMemo(() => new Map(blocks.map((block) => [block.id, block])), [blocks]);

  if (loading) {
    return (
      <AppShell>
        <div className="builder-header">
          <div className="builder-header__title">
            <div>
              <Link href="/teacher" className="back-link">
                <ArrowLeft size={14} /> Kembali ke dashboard
              </Link>
              <h1>Course builder</h1>
              <p>Menyinkronkan modul dan materi dari database...</p>
            </div>
          </div>
        </div>
        <div className="builder-card sync-loading" style={{ minHeight: 220 }}>
          <Loader2 size={22} className="spin" />
          <strong>Memuat materi pembelajaran</strong>
          <span>Materi yang sudah tersimpan akan muncul setelah sinkron selesai.</span>
        </div>
      </AppShell>
    );
  }

  if (notFound) {
    return (
      <AppShell>
        <div className="builder-header">
          <div className="builder-header__title">
            <div>
              <Link href="/teacher" className="back-link">
                <ArrowLeft size={14} /> Kembali ke dashboard
              </Link>
              <h1>Pembelajaran tidak ditemukan</h1>
              <p>Pembelajaran ini tidak ada atau bukan milik akunmu.</p>
            </div>
          </div>
        </div>
        <div className="empty-state-card">
          <FileText size={28} />
          <h2>Halaman ini khusus pemilik pembelajaran</h2>
          <p>Guru lain tidak dapat membuka course builder ini.</p>
          <Link href="/teacher" className="button button--primary">
            Ke dashboard guru
          </Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="builder-header">
        <div className="builder-header__title">
          <div>
            <Link href="/teacher" className="back-link">
              <ArrowLeft size={14} /> Kembali ke dashboard
            </Link>
            <h1>Course builder</h1>
            <p>Isi materi per modul, lalu preview langsung sebagai siswa.</p>
          </div>
        </div>
        <div className="builder-header__actions">
          <button className="button button--ghost button--small" onClick={openAddModule}>
            <Plus size={15} /> Tambah modul
          </button>
          <Link href={`/learn/${slug}`} className="button button--ghost button--small">
            <Eye size={15} /> Preview siswa
          </Link>
          <button className="button button--primary button--small" onClick={togglePublish}>
            {state === "published" ? (
              <>
                <Save size={15} /> Simpan perubahan
              </>
            ) : (
              <>
                <Check size={15} /> Publish
              </>
            )}
          </button>
        </div>
      </div>

      {syncing && (
        <div className="sync-banner">
          <Loader2 size={16} className="spin" /> Menyimpan ke database...
        </div>
      )}

      <div className="builder-layout">
        <div className="builder-main">
          <div className="builder-card">
            <div className="builder-card__head">
              <div>
                <strong>Info pembelajaran</strong>
                <small>Identitas yang dilihat siswa saat membuka link.</small>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <StatusPill tone={state === "published" ? "teal" : "yellow"}>{state === "published" ? "Published" : "Draft"}</StatusPill>
                <button className="button button--ghost button--small" onClick={saveMeta} disabled={metaSaving}>
                  {metaSaving ? <Loader2 size={14} className="spin" /> : <Save size={14} />} Simpan info
                </button>
              </div>
            </div>
            <div className="form-grid">
              <div className="field field--full">
                <label>Judul pembelajaran</label>
                <input value={meta.title} onChange={(event) => setMeta((current) => ({ ...current, title: event.target.value }))} />
              </div>
              <div className="field field--full">
                <label>Deskripsi</label>
                <textarea value={meta.description} onChange={(event) => setMeta((current) => ({ ...current, description: event.target.value }))} />
              </div>
              <div className="field">
                <label>Mata pelajaran</label>
                <input value={meta.subject} onChange={(event) => setMeta((current) => ({ ...current, subject: event.target.value }))} />
              </div>
              <div className="field">
                <label>Target kelas</label>
                <input value={meta.grade} onChange={(event) => setMeta((current) => ({ ...current, grade: event.target.value }))} />
              </div>
            </div>
          </div>

          {modules.length === 0 ? (
            <div className="builder-card empty-state">
              <span className="empty-state__icon">
                <Plus size={22} />
              </span>
              <strong>Belum ada modul</strong>
              <p>Tambahkan modul pertama, lalu isi materi, PDF, link, kuis, atau game di dalamnya.</p>
              <button className="button button--primary button--small" onClick={openAddModule}>
                <Plus size={15} /> Tambah modul pertama
              </button>
            </div>
          ) : (
            modules.map((module, moduleIndex) => (
              <div className={`builder-card module-builder-card module-builder-card--${module.accent}`} key={module.id}>
                <div className="builder-card__head">
                  <div>
                    <span className="eyebrow">{module.eyebrow || `MODUL ${String(moduleIndex + 1).padStart(2, "0")}`}</span>
                    <strong style={{ margin: "2px 0" }}>{module.title}</strong>
                    <small style={{ display: "block", marginTop: 2 }}>{module.duration || "10 menit"} · Buka untuk mengisi materi.</small>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button className="button button--ghost button--small" onClick={() => setForumModule(module)}>
                      <MessageCircle size={14} /> Buka forum diskusi
                    </button>
                    <button className="button button--ghost button--small" onClick={() => openEditModule(module)}>
                      <Pencil size={14} /> Edit modul
                    </button>
                    <button className="button button--ghost button--small" onClick={() => setShowAdd(showAdd === module.id ? null : module.id)}>
                      <Plus size={15} /> Tambah materi
                    </button>
                    <button className="icon-button icon-button--tiny" onClick={() => removeModule(module.id)} aria-label={`Hapus modul ${module.title}`}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {showAdd === module.id && (
                  <div className="add-block-bar">
                    {newBlockTemplates.map(({ type, label, icon: Icon }) => (
                      <button className="add-block-button" key={type} onClick={() => addBlock(module.id, type, label)}>
                        <Icon size={13} /> {label}
                      </button>
                    ))}
                  </div>
                )}

                <div className="module-editor-list">
                  {module.lessons
                    .map((seedBlock) => blockById.get(seedBlock.id))
                    .concat(blocks.filter((block) => block.moduleId === module.id && !module.lessons.some((lesson) => lesson.id === block.id)))
                    .filter(Boolean)
                    .map((block) => {
                      const item = block as LessonBlock;
                      const Icon = iconMap[item.type];
                      return (
                        <div className="content-block" key={item.id}>
                          <span className="content-block__icon">
                            <Icon size={17} />
                          </span>
                          <div className="content-block__copy">
                            <strong>{item.title}</strong>
                            <small>{item.description}</small>
                            {item.material?.videoUrl && <em className="material-chip">Video terhubung</em>}
                            {item.material?.linkUrl && <em className="material-chip">Link terhubung</em>}
                            {item.material?.text && <em className="material-chip">Teks siap tampil</em>}
                            {item.material?.pdfUrl && <em className="material-chip">PDF: {item.material.fileName || "dokumen"}</em>}
                          </div>
                          <small style={{ color: "var(--muted)", fontSize: ".64rem" }}>{item.duration}</small>
                          <div className="content-block__menu">
                            <button className="icon-button icon-button--tiny" onClick={() => openEditor(item)} aria-label={`Edit materi ${item.title}`}>
                              <FileText size={14} />
                            </button>
                            <button className="icon-button icon-button--tiny" onClick={() => removeBlock(item.id)} aria-label={`Hapus ${item.title}`}>
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  {module.lessons.length === 0 && (
                    <div className="empty-state">
                      <FileText size={20} />
                      <strong>Modul ini belum punya materi</strong>
                      <p>Gunakan tombol Tambah materi untuk mengisi teks, PDF, link, kuis, atau game.</p>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        <aside className="builder-sidebar">
          <div className="access-card">
            <div className="access-card__head">
              <div>
                <strong>Akses siswa</strong>
                <small>Publikasi dan akses masuk dikontrol terpisah.</small>
              </div>
              <button className={`toggle ${access === "open" ? "is-on" : ""}`} onClick={toggleAccess} aria-label="Ubah akses">
                <span />
              </button>
            </div>
            <div className="access-divider" />
            <StatusPill tone={access === "open" ? "teal" : "coral"}>{access === "open" ? "Siswa bisa bergabung" : "Siswa baru ditolak"}</StatusPill>
            <p className="access-helper">
              {access === "open"
                ? "Peserta baru bisa masuk dengan nama dan kelas lewat link."
                : "Link tetap ada, tetapi siswa baru melihat halaman akses terkunci."}
            </p>
            <div className="link-field" style={{ marginTop: 15 }}>
              <Link2 size={14} color="var(--muted)" />
              <input readOnly value={`/learn/${slug}`} />
              <button onClick={copyLink} aria-label="Salin link">
                <Copy size={13} />
              </button>
            </div>
          </div>
          <div className="access-card">
            <div className="access-card__head">
              <div>
                <strong>Materi siap tayang</strong>
                <small>Guru dapat memasukkan YouTube, Drive, teks, link bebas, PDF, kuis, dan game.</small>
              </div>
              <Sparkles size={18} color="var(--violet)" />
            </div>
            <div className="settings-row">
              <div className="settings-row__copy">
                <strong>Halaman siswa</strong>
                <small>Setiap modul memiliki route dan forum sendiri.</small>
              </div>
              {modules[0] ? (
                <Link href={`/learn/${slug}/modul/${modules[0].id}`} className="text-link">
                  Buka <Eye size={14} />
                </Link>
              ) : (
                <span className="text-link" style={{ opacity: 0.5 }}>
                  Belum ada modul
                </span>
              )}
            </div>
          </div>
        </aside>
      </div>

      {moduleDraft && (
        <div className="modal-backdrop" onClick={() => setModuleDraft(null)}>
          <div className="modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="modal-card__head">
              <div>
                <div className="eyebrow">{editingModuleId ? "EDIT MODUL" : "MODUL BARU"}</div>
                <h2>{editingModuleId ? "Rapikan judul dan durasi modul." : "Tambah modul ke pembelajaran."}</h2>
              </div>
              <button className="icon-button" onClick={() => setModuleDraft(null)} aria-label="Tutup">
                <X size={16} />
              </button>
            </div>
            <div className="form-grid" style={{ marginTop: 18 }}>
              <div className="field field--full">
                <label>Judul modul</label>
                <input
                  autoFocus
                  value={moduleDraft.title}
                  onChange={(event) => setModuleDraft((current) => (current ? { ...current, title: event.target.value } : current))}
                  placeholder="Contoh: Mengamati & Menanya"
                />
              </div>
              <div className="field">
                <label>Label modul</label>
                <input
                  value={moduleDraft.eyebrow}
                  onChange={(event) => setModuleDraft((current) => (current ? { ...current, eyebrow: event.target.value } : current))}
                  placeholder="Modul 05"
                />
              </div>
              <div className="field">
                <label>Estimasi durasi</label>
                <input
                  value={moduleDraft.duration}
                  onChange={(event) => setModuleDraft((current) => (current ? { ...current, duration: event.target.value } : current))}
                  placeholder="10 menit"
                />
              </div>
              <div className="field field--full">
                <label>Warna aksen</label>
                <select
                  value={moduleDraft.accent}
                  onChange={(event) =>
                    setModuleDraft((current) =>
                      current ? { ...current, accent: event.target.value as Module["accent"] } : current
                    )
                  }
                >
                  <option value="violet">Violet</option>
                  <option value="teal">Teal</option>
                  <option value="yellow">Kuning</option>
                  <option value="coral">Coral</option>
                </select>
              </div>
            </div>
            <div className="modal-actions">
              <button className="button button--ghost button--small" onClick={() => setModuleDraft(null)}>
                Batal
              </button>
              <button className="button button--primary button--small" onClick={saveModule}>
                <Save size={14} /> {editingModuleId ? "Simpan modul" : "Tambah modul"}
              </button>
            </div>
          </div>
        </div>
      )}

      {editingBlock && (
        <BlockEditor
          block={editingBlock}
          title={editTitle}
          description={editDescription}
          material={material}
          uploading={uploading}
          linkTitle={linkTitle}
          linkDescription={linkDescription}
          setTitle={setEditTitle}
          setDescription={setEditDescription}
          setMaterial={setMaterial}
          setLinkTitle={setLinkTitle}
          setLinkDescription={setLinkDescription}
          onPdfUpload={handlePdfUpload}
          onRemovePdf={removePdf}
          onClose={() => setEditingBlock(null)}
          onSave={saveBlockEdit}
        />
      )}

      {forumModule && (
        <div className="modal-backdrop" onClick={() => setForumModule(null)}>
          <div className="modal-card forum-modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-card__head">
              <div>
                <div className="eyebrow">FORUM GURU · {forumModule.title.toUpperCase()}</div>
                <h2>Diskusi modul ini.</h2>
                <p>Guru dapat menghapus semua pertanyaan dan tanggapan di forum modul ini.</p>
              </div>
              <button className="icon-button" onClick={() => setForumModule(null)} aria-label="Tutup forum">
                <X size={16} />
              </button>
            </div>
            <DiscussionForum
              moduleId={forumModule.id}
              courseSlug={slug}
              moduleTitle={forumModule.title}
              currentUser={teacherName ? { id: "", name: teacherName, role: "TEACHER", className: undefined } : null}
              canModerate
            />
          </div>
        </div>
      )}

      {toast && <Toast message={toast} onClose={() => setToast("")} />}
    </AppShell>
  );
}

function BlockEditor({
  block,
  title,
  description,
  material,
  uploading,
  linkTitle,
  linkDescription,
  setTitle,
  setDescription,
  setMaterial,
  setLinkTitle,
  setLinkDescription,
  onPdfUpload,
  onRemovePdf,
  onClose,
  onSave,
}: {
  block: LessonBlock;
  title: string;
  description: string;
  material: MaterialDraft;
  uploading: boolean;
  linkTitle: string;
  linkDescription: string;
  setTitle: (value: string) => void;
  setDescription: (value: string) => void;
  setMaterial: React.Dispatch<React.SetStateAction<MaterialDraft>>;
  setLinkTitle: (value: string) => void;
  setLinkDescription: (value: string) => void;
  onPdfUpload: (event: ChangeEvent<HTMLInputElement>) => void;
  onRemovePdf: () => void;
  onClose: () => void;
  onSave: () => void;
}) {
  const updateActivity = <K extends keyof ActivityConfig>(key: K, value: ActivityConfig[K]) =>
    setMaterial((current) => ({ ...current, activity: { ...current.activity, [key]: value } }));
  const updateGame = <K extends keyof GameBlockConfig>(key: K, value: GameBlockConfig[K]) =>
    setMaterial((current) => ({ ...current, game: { ...current.game, [key]: value } }));

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card material-editor-modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal-card__head">
          <div>
            <div className="eyebrow">EDITOR MATERI · {block.type.toUpperCase()}</div>
            <h2>Rincian yang dilihat siswa.</h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Tutup editor">
            <X size={16} />
          </button>
        </div>

        <div className="form-grid" style={{ marginTop: 20 }}>
          <div className="field field--full">
            <label>Judul blok</label>
            <input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} />
          </div>
          <div className="field field--full">
            <label>Deskripsi singkat</label>
            <textarea value={description} onChange={(event) => setDescription(event.target.value)} />
          </div>

          {(block.type === "text" || block.type === "assignment" || block.type === "reflection") && (
            <div className="field field--full">
              <label>Isi teks / instruksi</label>
              <textarea
                className="material-textarea"
                value={material.text}
                onChange={(event) => setMaterial((current) => ({ ...current, text: event.target.value }))}
                placeholder="Tulis materi atau instruksi tugas yang akan muncul di halaman siswa..."
              />
            </div>
          )}

          {block.type === "video" && (
            <>
              <div className="field field--full">
                <label>Link YouTube</label>
                <input
                  value={material.videoUrl}
                  onChange={(event) => setMaterial((current) => ({ ...current, videoUrl: event.target.value }))}
                  placeholder="https://www.youtube.com/watch?v=..."
                />
              </div>
              <div className="field field--full">
                <label>Link Google Drive (opsional)</label>
                <input
                  value={material.driveUrl}
                  onChange={(event) => setMaterial((current) => ({ ...current, driveUrl: event.target.value }))}
                  placeholder="https://drive.google.com/file/d/.../view"
                />
              </div>
            </>
          )}

          {block.type === "link" && (
            <>
              <div className="field field--full">
                <label>Judul link</label>
                <input
                  value={linkTitle}
                  onChange={(event) => setLinkTitle(event.target.value)}
                  placeholder="Judul sumber belajar"
                />
              </div>
              <div className="field field--full">
                <label>Deskripsi singkat</label>
                <textarea
                  value={linkDescription}
                  onChange={(event) => setLinkDescription(event.target.value)}
                  placeholder="Keterangan singkat tentang sumber belajar ini"
                  rows={2}
                />
              </div>
              <div className="field field--full">
                <label>URL / link yang ingin dibuka siswa</label>
                <input
                  value={material.linkUrl}
                  onChange={(event) => setMaterial((current) => ({ ...current, linkUrl: event.target.value }))}
                  placeholder="https://contoh.com/sumber-belajar"
                />
                <small className="field-helper">
                  Link bisa berupa website, video YouTube, atau sumber belajar lain yang bisa dibuka.
                </small>
              </div>
            </>
          )}

          {block.type === "assignment" && (
            <>
              <div className="field field--full">
                <label>Link PDF / Drive (opsional)</label>
                <input
                  value={material.pdfUrl.startsWith("/api/files/") ? "" : material.pdfUrl}
                  onChange={(event) =>
                    setMaterial((current) => ({
                      ...current,
                      pdfUrl: event.target.value,
                      pdfFileId: "",
                      fileName: "",
                      fileMime: "",
                    }))
                  }
                  placeholder="https://drive.google.com/file/d/.../view atau URL PDF"
                />
              </div>
              <div className="field field--full">
                <label>Atau upload PDF dari perangkat</label>
                <input type="file" accept="application/pdf" onChange={onPdfUpload} disabled={uploading} />
                <small className="field-helper">
                  {uploading
                    ? "Mengunggah PDF ke database..."
                    : material.pdfFileId
                      ? `Tersimpan: ${material.fileName || "PDF"}`
                      : "PDF disimpan di database sehingga bisa dibuka lagi dan dihapus."}
                </small>
              </div>
              {material.pdfUrl && (
                <div className="field field--full">
                  <div className="file-chip-row">
                    <a href={material.pdfUrl} target="_blank" rel="noreferrer" className="file-chip">
                      <FileText size={14} /> {material.fileName || "Buka PDF"}
                    </a>
                    <button type="button" className="button button--ghost button--small" onClick={onRemovePdf}>
                      <Trash2 size={13} /> Hapus PDF
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {block.type === "activity" && (
            <>
              <div className="field field--full">
                <label>Contoh aktivitas FPBL</label>
                <select
                  value={material.activity.templateId}
                  onChange={(event) => {
                    const template = activityTemplates.find((item) => item.id === event.target.value) || activityTemplates[0];
                    setMaterial((current) => ({
                      ...current,
                      activity: {
                        ...current.activity,
                        templateId: template.id,
                        prompt: template.prompt,
                        evidenceLabel: template.evidenceLabel,
                        responseType: template.responseType,
                        choices:
                          template.responseType === "interactive"
                            ? [
                                { label: "A", value: "−8", correct: true },
                                { label: "B", value: "0" },
                                { label: "C", value: "8" },
                              ]
                            : current.activity.choices,
                        instructions: `Kerjakan aktivitas: ${template.title}. Tulis proses berpikirmu dengan runtut.`,
                      },
                    }));
                  }}
                >
                  {activityTemplates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.title}
                    </option>
                  ))}
                </select>
                <small className="field-helper">
                  Aktivitas ini berdiri sendiri dan bukan mini-game. Garis Bilangan dan Kartu Muatan tersedia di tipe Game.
                </small>
              </div>
              <div className="field field--full">
                <label>Pertanyaan / kasus aktivitas</label>
                <textarea className="material-textarea" value={material.activity.prompt} onChange={(event) => updateActivity("prompt", event.target.value)} />
              </div>
              <div className="field field--full">
                <label>Instruksi aktivitas</label>
                <textarea
                  className="material-textarea"
                  value={material.activity.instructions}
                  onChange={(event) => updateActivity("instructions", event.target.value)}
                />
              </div>
              <div className="field field--full">
                <label>Bukti yang dikumpulkan</label>
                <input value={material.activity.evidenceLabel} onChange={(event) => updateActivity("evidenceLabel", event.target.value)} />
              </div>
              <div className="field">
                <label>Jenis respons siswa</label>
                <select
                  value={material.activity.responseType}
                  onChange={(event) => updateActivity("responseType", event.target.value as ActivityConfig["responseType"])}
                >
                  <option value="interactive">Interaktif / simulasi</option>
                  <option value="short-answer">Jawaban singkat</option>
                  <option value="essay">Uraian</option>
                  <option value="upload">Upload bukti</option>
                </select>
              </div>
              {material.activity.responseType === "interactive" && (
                <div className="field field--full">
                  <label>Pilihan jawaban dan kunci</label>
                  <div className="choice-editor">
                    {(material.activity.choices || []).map((choice, index) => (
                      <div className="choice-editor__row" key={choice.label}>
                        <strong>{choice.label}</strong>
                        <input
                          value={choice.value}
                          onChange={(event) =>
                            setMaterial((current) => ({
                              ...current,
                              activity: {
                                ...current.activity,
                                choices: (current.activity.choices || []).map((item, itemIndex) =>
                                  itemIndex === index ? { ...item, value: event.target.value } : item
                                ),
                              },
                            }))
                          }
                        />
                        <label className="choice-editor__check">
                          <input
                            type="radio"
                            name="activity-correct"
                            checked={Boolean(choice.correct)}
                            onChange={() =>
                              setMaterial((current) => ({
                                ...current,
                                activity: {
                                  ...current.activity,
                                  choices: (current.activity.choices || []).map((item, itemIndex) => ({
                                    ...item,
                                    correct: itemIndex === index,
                                  })),
                                },
                              }))
                            }
                          />{" "}
                          benar
                        </label>
                      </div>
                    ))}
                  </div>
                  <small className="field-helper">Siswa memilih satu jawaban lalu menekan Kirim jawaban.</small>
                </div>
              )}
              <div className="field">
                <label>Poin aktivitas</label>
                <input
                  type="number"
                  min={0}
                  value={material.activity.points}
                  onChange={(event) => updateActivity("points", Number(event.target.value))}
                />
              </div>
              <div className="field field--full">
                <label>Rubrik penilaian / catatan guru</label>
                <textarea value={material.activity.rubric} onChange={(event) => updateActivity("rubric", event.target.value)} />
              </div>
              <div className="settings-row field--full">
                <div className="settings-row__copy">
                  <strong>Masuk ke gradebook</strong>
                  <small>Nilai aktivitas ikut analitik peserta.</small>
                </div>
                <button className={`toggle ${material.activity.graded ? "is-on" : ""}`} onClick={() => updateActivity("graded", !material.activity.graded)}>
                  <span />
                </button>
              </div>
              <div className="settings-row field--full">
                <div className="settings-row__copy">
                  <strong>Tampilkan skor ke siswa</strong>
                  <small>Siswa melihat poin setelah mengirim respons.</small>
                </div>
                <button className={`toggle ${material.activity.showScore ? "is-on" : ""}`} onClick={() => updateActivity("showScore", !material.activity.showScore)}>
                  <span />
                </button>
              </div>
            </>
          )}

          {block.type === "game" && (
            <>
              <div className="field field--full">
                <label>Game dari library</label>
                <select value={material.game.gameId} onChange={(event) => updateGame("gameId", event.target.value as GameBlockConfig["gameId"])}>
                  {gameTemplates.map((game) => (
                    <option key={game.id} value={game.id}>
                      {game.title}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field field--full">
                <label>Instruksi game</label>
                <textarea value={material.game.instructions} onChange={(event) => updateGame("instructions", event.target.value)} />
              </div>
              <div className="field">
                <label>Poin per sesi</label>
                <input type="number" min={0} value={material.game.points} onChange={(event) => updateGame("points", Number(event.target.value))} />
              </div>
              <div className="field">
                <label>Ambang lulus (%)</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={material.game.passThreshold}
                  onChange={(event) => updateGame("passThreshold", Number(event.target.value))}
                />
              </div>
              <div className="settings-row field--full">
                <div className="settings-row__copy">
                  <strong>Masuk ke gradebook</strong>
                  <small>Playtest guru tetap tidak dihitung; sesi siswa dapat dinilai.</small>
                </div>
                <button className={`toggle ${material.game.graded ? "is-on" : ""}`} onClick={() => updateGame("graded", !material.game.graded)}>
                  <span />
                </button>
              </div>
              <div className="settings-row field--full">
                <div className="settings-row__copy">
                  <strong>Tampilkan skor ke siswa</strong>
                  <small>Atur apakah skor dan ambang lulus terlihat.</small>
                </div>
                <button className={`toggle ${material.game.showScore ? "is-on" : ""}`} onClick={() => updateGame("showScore", !material.game.showScore)}>
                  <span />
                </button>
              </div>
            </>
          )}

          {block.type === "quiz" && (
            <div className="material-callout">
              <ClipboardCheck size={18} />
              <div>
                <strong>Kuis dikelola di halaman builder khusus</strong>
                <small>Tambah soal, kunci jawaban, pembahasan, poin, percobaan, dan pengaturan tampilan skor.</small>
              </div>
            </div>
          )}
        </div>

        <div className="modal-actions">
          <button className="button button--ghost button--small" onClick={onClose}>
            Batal
          </button>
          <button className="button button--primary button--small" onClick={onSave} disabled={uploading}>
            <Save size={14} /> Simpan rincian
          </button>
        </div>
      </div>
    </div>
  );
}
