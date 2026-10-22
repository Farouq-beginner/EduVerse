"use client";

import Link from "next/link";
import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
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
  Upload,
  Video,
  X,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { StatusPill } from "@/components/DashboardBits";
import { Toast } from "@/components/Toast";
import { DiscussionForum } from "@/components/DiscussionForum";
import {
  blankWorksheet,
  gameTemplates,
  type GameBlockConfig,
  type GameTemplateId,
  type LessonBlock,
  type Module,
  type WorksheetConfig,
} from "@/lib/demo-data";
import {
  getTeacherCourseBuilder,
  publishCourse,
  removeCourseModuleDoc,
  saveCourseStructure,
  setCourseModuleDoc,
  updateCourseSettings,
  type DbCourse,
} from "@/lib/actions/dashboards";
import { deleteStoredFile } from "@/lib/actions/files";
import { toModule, toSavePayload } from "@/lib/course";
import { MATERIAL_ACCEPT, fileKindLabel, uploadCourseFile } from "@/lib/upload";

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
  { type: "assignment", label: "Lembar Kerja / Tugas", icon: FileText },
  { type: "game", label: "Game", icon: Gamepad2 },
];

type CourseMeta = { title: string; description: string; subject: string; grade: string; duration: string };
type ModuleDraft = { title: string; eyebrow: string; duration: string; accent: Module["accent"] };

const blankMeta: CourseMeta = { title: "", description: "", subject: "", grade: "", duration: "" };

const blankGame: GameBlockConfig = {
  gameId: "number-line-challenge",
  instructions: "Jawab tantangan operasi bilangan bulat dengan cepat dan tepat.",
  points: 20,
  graded: true,
  showScore: true,
  passThreshold: 70,
};

export default function CourseBuilderPage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const slug = params.slug;

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [courseId, setCourseId] = useState<string | null>(null);
  const [teacherName, setTeacherName] = useState("");
  const [meta, setMeta] = useState<CourseMeta>(blankMeta);
  const [modules, setModules] = useState<Module[]>([]);
  const [access, setAccess] = useState<"open" | "locked">("open");
  const [state, setState] = useState<"draft" | "published">("published");
  const [hasDraftChanges, setHasDraftChanges] = useState(false);
  const [publishedAt, setPublishedAt] = useState<string | null>(null);
  const [moduleDoc, setModuleDoc] = useState<{ fileId: string; name: string; mime: string } | null>(null);
  const [draftStarted, setDraftStarted] = useState(false);
  const [showDraftPrompt, setShowDraftPrompt] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [saveError, setSaveError] = useState("");
  const [toast, setToast] = useState("");
  const [showAdd, setShowAdd] = useState<string | null>(null);
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [editingModuleId, setEditingModuleId] = useState<string | null>(null);
  const [uploadingBlockId, setUploadingBlockId] = useState<string | null>(null);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [forumModule, setForumModule] = useState<Module | null>(null);

  const dataRef = useRef({ meta, modules });
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savePromise = useRef<Promise<DbCourse | null> | null>(null);
  const rollbackRef = useRef<{ meta: CourseMeta; modules: Module[]; hasDraftChanges: boolean } | null>(null);

  useEffect(() => {
    dataRef.current = { meta, modules };
  }, [meta, modules]);

  // Ups! halaman ditutup/refresh — draft yang sedang diketik tetap dikirim.
  useEffect(() => {
    function flush() {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        saveTimer.current = null;
        void saveNow(true);
      }
    }
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", flush);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);

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
          duration: structure.duration,
        });
        setAccess(structure.access === "LOCKED" ? "locked" : "open");
        setState(structure.state === "PUBLISHED" ? "published" : "draft");
        setHasDraftChanges(structure.hasDraftChanges);
        setPublishedAt(structure.publishedAt);
        setModuleDoc(
          structure.moduleDocFileId
            ? {
                fileId: structure.moduleDocFileId,
                name: structure.moduleDocName ?? "Modul",
                mime: structure.moduleDocMime ?? "",
              }
            : null
        );
        setModules(structure.modules.map(toModule));
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

  /** Semua perubahan melewati gerbang draft: popup "Buat draft baru?" dulu. */
  function commit(next: { meta?: CourseMeta; modules?: Module[] }) {
    if (!draftStarted && !showDraftPrompt) {
      rollbackRef.current = { meta: dataRef.current.meta, modules: dataRef.current.modules, hasDraftChanges };
      setShowDraftPrompt(true);
    }
    if (next.meta) setMeta(next.meta);
    if (next.modules) setModules(next.modules);
    setHasDraftChanges(true);
    if (draftStarted) scheduleSave();
  }

  function beginDraft() {
    setDraftStarted(true);
    setShowDraftPrompt(false);
    rollbackRef.current = null;
    scheduleSave();
    setToast("Draft baru dibuat. Perubahan tersimpan otomatis dan belum terlihat siswa.");
  }

  function cancelDraft() {
    if (rollbackRef.current) {
      setMeta(rollbackRef.current.meta);
      setModules(rollbackRef.current.modules);
      setHasDraftChanges(rollbackRef.current.hasDraftChanges);
    }
    rollbackRef.current = null;
    setShowDraftPrompt(false);
  }

  function scheduleSave() {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveNow(true);
    }, 700);
  }

  /** Simpan seluruh draft (identitas + pertemuan + materi) ke database. */
  async function saveNow(silent: boolean): Promise<DbCourse | null> {
    if (!courseId) {
      setToast("Pembelajaran belum ada di database.");
      return null;
    }
    // Tunggu simpan yang sedang berjalan agar tidak ada dua tulisan bersamaan
    // yang saling menimpa (penyebab materi seolah hilang / kembali seperti lama).
    if (savePromise.current) await savePromise.current;
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }

    const run = (async () => {
      setSaving(true);
      try {
        const snapshot = dataRef.current;
        const res = await saveCourseStructure(
          courseId,
          toSavePayload(snapshot.modules, {
            title: snapshot.meta.title,
            description: snapshot.meta.description,
            subject: snapshot.meta.subject,
            grade: snapshot.meta.grade,
            duration: snapshot.meta.duration,
          })
        );
        if (!res.ok) {
          const message = res.error ?? "Gagal menyimpan draft.";
          setSaveError(message);
          setToast(message);
          return null;
        }
        if (res.structure) adoptFreshIds(res.structure);
        setSaveError("");
        setSavedAt(new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }));
        setHasDraftChanges(true);
        if (!silent) setToast("Draft tersimpan. Tekan Publish agar siswa melihat perubahan.");
        return res.structure ?? null;
      } catch {
        const message = "Koneksi ke database terputus. Perubahan belum tersimpan — coba Simpan Draft lagi.";
        setSaveError(message);
        setToast(message);
        return null;
      } finally {
        setSaving(false);
      }
    })();

    savePromise.current = run;
    try {
      return await run;
    } finally {
      savePromise.current = null;
    }
  }

  /**
   * Ambil id database hasil simpan tanpa menimpa suntingan yang lebih baru.
   * Id lokal (baru dibuat) diganti id database, termasuk id yang sedang dibuka
   * di editor — supaya editor tidak tertutup sendiri setelah autosave.
   */
  function adoptFreshIds(fresh: DbCourse) {
    const current = dataRef.current.modules;
    if (current.length !== fresh.modules.length) return;
    if (current.some((module, index) => module.lessons.length !== fresh.modules[index].blocks.length)) return;

    const idMap = new Map<string, string>();
    fresh.modules.forEach((freshModule, moduleIndex) => {
      const localModule = current[moduleIndex];
      idMap.set(localModule.id, freshModule.id);
      freshModule.blocks.forEach((freshBlock, blockIndex) => {
        idMap.set(localModule.lessons[blockIndex].id, freshBlock.id);
      });
    });

    setModules((previous) =>
      previous.map((module, moduleIndex) => {
        const freshModule = fresh.modules[moduleIndex];
        if (!freshModule || module.lessons.length !== freshModule.blocks.length) return module;
        return {
          ...module,
          id: freshModule.id,
          lessons: module.lessons.map((block, blockIndex) => ({
            ...block,
            id: freshModule.blocks[blockIndex].id,
            moduleId: freshModule.id,
          })),
        };
      })
    );

    setEditingBlockId((id) => (id ? idMap.get(id) ?? id : id));
    setEditingModuleId((id) => (id ? idMap.get(id) ?? id : id));
    setShowAdd((id) => (id ? idMap.get(id) ?? id : id));
    setForumModule((module) => (module ? { ...module, id: idMap.get(module.id) ?? module.id } : module));
  }

  function copyLink() {
    navigator.clipboard?.writeText(`${window.location.origin}/learn/${slug}`);
    setToast("Link pembelajaran disalin.");
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

  async function publish() {
    if (!courseId) return;
    if (!window.confirm("Publikasikan versi terbaru? Siswa akan langsung melihat isi draft ini.")) return;
    const saved = await saveNow(true);
    if (!saved) {
      setToast("Draft belum tersimpan, publish dibatalkan. Coba lagi.");
      return;
    }
    const res = await publishCourse(courseId);
    if (!res.ok) {
      setToast(res.error ?? "Gagal mempublikasikan.");
      return;
    }
    setState("published");
    setHasDraftChanges(false);
    setPublishedAt(res.publishedAt ?? new Date().toISOString());
    setDraftStarted(true);
    setToast("Pembelajaran dipublikasikan. Siswa sekarang melihat versi terbaru.");
  }

  function openAddModule() {
    const nextNumber = modules.length + 1;
    setEditingId(null);
    setModuleDraftTarget({
      title: "",
      eyebrow: `Pertemuan ${String(nextNumber).padStart(2, "0")}`,
      duration: "10 menit",
      accent: "violet",
    });
  }

  // ── Pertemuan ───────────────────────────────────────────────────────────
  const setEditingId = (id: string | null) => setEditingModuleId(id);
  const [moduleDraftTarget, setModuleDraftTarget] = useState<ModuleDraft | null>(null);

  function saveModuleDraft() {
    if (!moduleDraftTarget || !moduleDraftTarget.title.trim()) {
      setToast("Judul pertemuan wajib diisi.");
      return;
    }
    const next: Module = {
      id: `module-new-${Date.now()}`,
      title: moduleDraftTarget.title.trim(),
      eyebrow: moduleDraftTarget.eyebrow.trim() || `Pertemuan ${String(modules.length + 1).padStart(2, "0")}`,
      duration: moduleDraftTarget.duration.trim() || "10 menit",
      accent: moduleDraftTarget.accent,
      lessons: [],
    };
    setModuleDraftTarget(null);
    commit({ modules: [...modules, next] });
  }

  function patchModule(moduleId: string, patch: Partial<ModuleDraft>) {
    commit({
      modules: modules.map((module) => (module.id === moduleId ? { ...module, ...patch } : module)),
    });
  }

  function removeModule(moduleId: string) {
    const module = modules.find((item) => item.id === moduleId);
    if (!module || !window.confirm(`Hapus ${module.title} beserta semua materinya?`)) return;
    commit({ modules: modules.filter((item) => item.id !== moduleId) });
    setForumModule(null);
    setToast("Pertemuan dan materi di dalamnya dihapus dari draft.");
  }

  // ── Materi ──────────────────────────────────────────────────────────────
  function addBlock(moduleId: string, type: LessonBlock["type"], label: string) {
    const block: LessonBlock = {
      id: `block-new-${Date.now()}`,
      moduleId,
      type,
      title: `${label} baru`,
      description: "Isi materi ini dari editor.",
      duration: "05 menit",
      status: "new",
      material:
        type === "activity"
          ? { activity: { visualId: "number-line-lab" } }
          : type === "game"
            ? { game: { ...blankGame } }
            : type === "link"
              ? { linkUrl: "" }
              : {},
    };
    const next = modules.map((module) =>
      module.id === moduleId ? { ...module, lessons: [...module.lessons, block] } : module
    );
    setShowAdd(null);
    setEditingBlockId(type === "quiz" ? null : block.id);
    commit({ modules: next });
    if (type === "quiz") {
      setToast("Blok kuis ditambahkan. Klik ikon pensil pada materi kuis untuk mengisi soal.");
    }
  }

  /** Buka editor kuis; simpan draft dulu bila bloknya belum punya id database. */
  async function openQuizEditor(block: LessonBlock, moduleId: string) {
    if (!block.id.startsWith("block-new-")) {
      router.push(`/teacher/course/${slug}/quiz/${block.id}`);
      return;
    }
    const fresh = await saveNow(true);
    if (!fresh) {
      setToast("Kuis belum tersimpan. Tekan Simpan Draft lalu coba lagi.");
      return;
    }
    const moduleIndex = modules.findIndex((module) => module.id === moduleId);
    const freshModule = fresh.modules[moduleIndex];
    const target = freshModule?.blocks.find((item) => item.type.toUpperCase() === "QUIZ" && item.title === block.title);
    if (target) router.push(`/teacher/course/${slug}/quiz/${target.id}`);
  }

  function patchBlock(blockId: string, patch: Partial<LessonBlock>) {
    commit({
      modules: modules.map((module) => ({
        ...module,
        lessons: module.lessons.map((block) => (block.id === blockId ? { ...block, ...patch } : block)),
      })),
    });
  }

  function patchMaterial(blockId: string, patch: Record<string, unknown>) {
    const block = modules.flatMap((module) => module.lessons).find((item) => item.id === blockId);
    const material = { ...(block?.material ?? {}), ...patch } as LessonBlock["material"];
    commit({
      modules: modules.map((module) => ({
        ...module,
        lessons: module.lessons.map((item) => (item.id === blockId ? { ...item, material } : item)),
      })),
    });
  }

  function updateWorksheet(blockId: string, current: WorksheetConfig | undefined, patch: Partial<WorksheetConfig>) {
    patchMaterial(blockId, { worksheet: { ...blankWorksheet, ...(current ?? {}), ...patch } });
  }

  function removeBlock(blockId: string) {
    if (!window.confirm("Hapus materi ini dari draft?")) return;
    commit({
      modules: modules.map((module) => ({
        ...module,
        lessons: module.lessons.filter((block) => block.id !== blockId),
      })),
    });
    if (editingBlockId === blockId) setEditingBlockId(null);
    setToast("Materi dihapus dari draft.");
  }

  async function handleBlockUpload(block: LessonBlock, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !courseId) return;
    setUploadingBlockId(block.id);
    const result = await uploadCourseFile({ file, courseId, purpose: "material" });
    setUploadingBlockId(null);
    if (!result.ok || !result.file) {
      setToast(result.error ?? "Gagal mengunggah berkas.");
      return;
    }
    patchMaterial(block.id, {
      pdfUrl: result.file.url,
      pdfFileId: result.file.fileId,
      fileName: result.file.fileName,
      fileMime: result.file.mimeType,
    });
    setToast(`${fileKindLabel(result.file.mimeType, result.file.fileName)} tersimpan di draft.`);
  }

  async function removeBlockFile(block: LessonBlock) {
    const fileId = block.material?.pdfFileId;
    patchMaterial(block.id, { pdfUrl: "", pdfFileId: "", fileName: "", fileMime: "" });
    if (fileId) await deleteStoredFile(fileId).catch(() => undefined);
    setToast("Berkas materi dihapus.");
  }

  async function handleModuleDocUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !courseId) return;
    setUploadingDoc(true);
    const result = await uploadCourseFile({ file, courseId, purpose: "module-doc" });
    if (!result.ok || !result.file) {
      setUploadingDoc(false);
      setToast(result.error ?? "Gagal mengunggah modul.");
      return;
    }
    const res = await setCourseModuleDoc(courseId, {
      fileId: result.file.fileId,
      name: result.file.fileName,
      mime: result.file.mimeType,
    });
    setUploadingDoc(false);
    if (!res.ok) {
      setToast(res.error ?? "Gagal menyimpan modul.");
      return;
    }
    setModuleDoc({ fileId: result.file.fileId, name: result.file.fileName, mime: result.file.mimeType });
    setToast("Modul berhasil diunggah. Hanya guru yang bisa melihat modul ini.");
  }

  async function removeModuleDoc() {
    if (!courseId || !moduleDoc) return;
    if (!window.confirm("Hapus modul ini?")) return;
    const res = await removeCourseModuleDoc(courseId);
    if (!res.ok) {
      setToast(res.error ?? "Gagal menghapus modul.");
      return;
    }
    setModuleDoc(null);
    setToast("Modul dihapus.");
  }

  const totalBlocks = useMemo(() => modules.reduce((sum, module) => sum + module.lessons.length, 0), [modules]);

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
              <p>Memuat pembelajaran...</p>
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
            <p>Semua perubahan tersimpan otomatis di draft. Siswa baru melihatnya setelah Publish.</p>
          </div>
        </div>
        <div className="builder-header__actions">
          <button className="button button--ghost button--small" onClick={openAddModule}>
            <Plus size={15} /> Tambah pertemuan
          </button>
          <Link href={`/learn/${slug}`} className="button button--ghost button--small">
            <Eye size={15} /> Preview siswa
          </Link>
          <button className="button button--ghost button--small" onClick={() => saveNow(false)} disabled={saving}>
            {saving ? <Loader2 size={14} className="spin" /> : <Save size={15} />} Simpan Draft
          </button>
          <button className="button button--primary button--small" onClick={publish} disabled={saving}>
            <Check size={15} /> Publish
          </button>
        </div>
      </div>

      <div className="sync-banner" style={{ background: saveError ? "rgba(239, 68, 68, .12)" : hasDraftChanges ? "rgba(250, 204, 21, .12)" : "rgba(16, 185, 129, .12)" }}>
        {saving ? <Loader2 size={16} className="spin" /> : <Check size={16} />}
        {saving
          ? "Menyimpan draft..."
          : saveError
            ? `${saveError} Tekan Simpan Draft untuk mencoba lagi.`
            : hasDraftChanges
              ? `Draft tersimpan${savedAt ? ` pukul ${savedAt}` : ""}. Siswa masih melihat versi terbit sampai kamu menekan Publish.`
              : `Tidak ada perubahan draft baru. Versi terbit${publishedAt ? ` sejak ${new Date(publishedAt).toLocaleString("id-ID")}` : " belum ada"}.`}
      </div>

      <div className="builder-layout">
        <div className="builder-main">
          <div className="builder-card">
            <div className="builder-card__head">
              <div>
                <strong>Info pembelajaran</strong>
                <small>Identitas yang dilihat siswa saat membuka link.</small>
              </div>
              <StatusPill tone={state === "published" ? "teal" : "yellow"}>{state === "published" ? "Published" : "Draft"}</StatusPill>
            </div>
            <div className="form-grid">
              <div className="field field--full">
                <label>Judul pembelajaran</label>
                <input value={meta.title} onChange={(event) => commit({ meta: { ...meta, title: event.target.value } })} />
              </div>
              <div className="field field--full">
                <label>Deskripsi</label>
                <textarea value={meta.description} onChange={(event) => commit({ meta: { ...meta, description: event.target.value } })} />
              </div>
              <div className="field">
                <label>Mata pelajaran</label>
                <input value={meta.subject} onChange={(event) => commit({ meta: { ...meta, subject: event.target.value } })} />
              </div>
              <div className="field">
                <label>Target kelas</label>
                <input value={meta.grade} onChange={(event) => commit({ meta: { ...meta, grade: event.target.value } })} />
              </div>
              <div className="field field--full">
                <label>Durasi pembelajaran</label>
                <input value={meta.duration} onChange={(event) => commit({ meta: { ...meta, duration: event.target.value } })} />
              </div>
            </div>

            <div className="access-divider" />
            <div className="builder-card__head" style={{ marginTop: 12 }}>
              <div>
                <strong>Modul pembelajaran · khusus guru</strong>
                <small>Unggah modul ajar (PDF, PPT, atau DOCX). Bagian ini tidak terlihat siswa.</small>
              </div>
              <FileText size={18} color="var(--violet)" />
            </div>
            {moduleDoc ? (
              <div className="file-chip-row" style={{ marginTop: 10 }}>
                <span className="file-chip">
                  <FileText size={14} /> {moduleDoc.name} · {fileKindLabel(moduleDoc.mime, moduleDoc.name)}
                </span>
                <a href={`/api/files/${moduleDoc.fileId}`} target="_blank" rel="noreferrer" className="button button--primary button--small">
                  <Eye size={14} /> Lihat Modul
                </a>
                <label className="button button--ghost button--small" style={{ cursor: "pointer" }}>
                  <Upload size={14} /> Ganti
                  <input type="file" accept={MATERIAL_ACCEPT} onChange={handleModuleDocUpload} hidden disabled={uploadingDoc} />
                </label>
                <button className="button button--ghost button--small" onClick={removeModuleDoc}>
                  <Trash2 size={13} /> Hapus
                </button>
              </div>
            ) : (
              <label className="file-upload-zone" style={{ marginTop: 10 }}>
                <input type="file" accept={MATERIAL_ACCEPT} onChange={handleModuleDocUpload} disabled={uploadingDoc} />
                {uploadingDoc ? <Loader2 size={16} className="spin" /> : <Upload size={16} />}
                <span>{uploadingDoc ? "Mengunggah modul..." : "Unggah modul (PDF, PPT, DOCX)"}</span>
              </label>
            )}
          </div>

          {modules.length === 0 ? (
            <div className="builder-card empty-state">
              <span className="empty-state__icon">
                <Plus size={22} />
              </span>
              <strong>Belum ada pertemuan</strong>
              <p>Tambahkan pertemuan pertama, lalu isi materi, lembar kerja, kuis, atau game di dalamnya.</p>
              <button className="button button--primary button--small" onClick={openAddModule}>
                <Plus size={15} /> Tambah pertemuan pertama
              </button>
            </div>
          ) : (
            modules.map((module, moduleIndex) => (
              <div className={`builder-card module-builder-card module-builder-card--${module.accent}`} key={module.id}>
                <div className="builder-card__head">
                  <div>
                    <span className="eyebrow">{module.eyebrow || `PERTEMUAN ${String(moduleIndex + 1).padStart(2, "0")}`}</span>
                    <strong style={{ margin: "2px 0" }}>{module.title}</strong>
                    <small style={{ display: "block", marginTop: 2 }}>
                      {module.duration || "10 menit"} · {module.lessons.length} materi
                    </small>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button className="button button--ghost button--small" onClick={() => setForumModule(module)}>
                      <MessageCircle size={14} /> Forum
                    </button>
                    <button
                      className="button button--ghost button--small"
                      onClick={() => setEditingModuleId(editingModuleId === module.id ? null : module.id)}
                    >
                      <Pencil size={14} /> Edit pertemuan
                    </button>
                    <button className="button button--ghost button--small" onClick={() => setShowAdd(showAdd === module.id ? null : module.id)}>
                      <Plus size={15} /> Tambah materi
                    </button>
                    <button className="icon-button icon-button--tiny" onClick={() => removeModule(module.id)} aria-label={`Hapus pertemuan ${module.title}`}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {editingModuleId === module.id && (
                  <div className="form-grid" style={{ marginTop: 14, padding: 14, background: "var(--surface-2)", borderRadius: 14 }}>
                    <div className="field field--full">
                      <label>Judul pertemuan</label>
                      <input value={module.title} onChange={(event) => patchModule(module.id, { title: event.target.value })} />
                    </div>
                    <div className="field">
                      <label>Label pertemuan</label>
                      <input value={module.eyebrow} onChange={(event) => patchModule(module.id, { eyebrow: event.target.value })} />
                    </div>
                    <div className="field">
                      <label>Estimasi durasi</label>
                      <input value={module.duration ?? ""} onChange={(event) => patchModule(module.id, { duration: event.target.value })} />
                    </div>
                    <div className="field field--full">
                      <label>Warna aksen</label>
                      <select
                        value={module.accent}
                        onChange={(event) => patchModule(module.id, { accent: event.target.value as Module["accent"] })}
                      >
                        <option value="violet">Violet</option>
                        <option value="teal">Teal</option>
                        <option value="yellow">Kuning</option>
                        <option value="coral">Coral</option>
                      </select>
                    </div>
                    <div className="field field--full">
                      <small className="field-helper">Perubahan tersimpan otomatis di draft — tidak ada tombol simpan/batal.</small>
                    </div>
                  </div>
                )}

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
                  {module.lessons.map((item) => {
                    const Icon = iconMap[item.type] ?? FileText;
                    const isEditing = editingBlockId === item.id;
                    return (
                      <div key={item.id}>
                        <div className="content-block">
                          <span className="content-block__icon">
                            <Icon size={17} />
                          </span>
                          <div className="content-block__copy">
                            <strong>{item.title}</strong>
                            <small>{item.description}</small>
                            {item.material?.videoUrl && <em className="material-chip">Video terhubung</em>}
                            {item.material?.linkUrl && <em className="material-chip">Link terhubung</em>}
                            {item.material?.pdfUrl && (
                              <em className="material-chip">
                                Berkas: {item.material.fileName || "dokumen"} · {fileKindLabel(item.material.fileMime, item.material.fileName)}
                              </em>
                            )}
                            {item.material?.worksheet?.enabled !== false && <em className="material-chip">Lembar kerja aktif</em>}
                          </div>
                          <small style={{ color: "var(--muted)", fontSize: ".64rem" }}>{item.duration}</small>
                          <div className="content-block__menu">
                            <button
                              className="icon-button icon-button--tiny"
                              onClick={() =>
                                item.type === "quiz" ? openQuizEditor(item, module.id) : setEditingBlockId(isEditing ? null : item.id)
                              }
                              aria-label={`Edit materi ${item.title}`}
                            >
                              <Pencil size={14} />
                            </button>
                            <button className="icon-button icon-button--tiny" onClick={() => removeBlock(item.id)} aria-label={`Hapus ${item.title}`}>
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>

                        {isEditing && (
                          <BlockEditor
                            block={item}
                            uploading={uploadingBlockId === item.id}
                            onPatch={(patch) => patchBlock(item.id, patch)}
                            onMaterial={(patch) => patchMaterial(item.id, patch)}
                            onWorksheet={(patch) => updateWorksheet(item.id, item.material?.worksheet, patch)}
                            onUpload={(event) => handleBlockUpload(item, event)}
                            onRemoveFile={() => removeBlockFile(item)}
                            onClose={() => setEditingBlockId(null)}
                          />
                        )}
                      </div>
                    );
                  })}
                  {module.lessons.length === 0 && (
                    <div className="empty-state">
                      <FileText size={20} />
                      <strong>Pertemuan ini belum punya materi</strong>
                      <p>Gunakan tombol Tambah materi untuk mengisi teks, berkas, kuis, aktivitas, atau game.</p>
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
                <strong>Status draft</strong>
                <small>{totalBlocks} materi di {modules.length} pertemuan.</small>
              </div>
              <Sparkles size={18} color="var(--violet)" />
            </div>
            <div className="settings-row">
              <div className="settings-row__copy">
                <strong>{hasDraftChanges ? "Ada draft belum terbit" : "Draft sama dengan versi terbit"}</strong>
                <small>Perubahan tersimpan otomatis meski kamu menutup halaman.</small>
              </div>
              <button className="button button--primary button--small" onClick={publish} disabled={saving}>
                Publish
              </button>
            </div>
            <div className="settings-row">
              <div className="settings-row__copy">
                <strong>Halaman siswa</strong>
                <small>Setiap pertemuan memiliki route dan forum sendiri.</small>
              </div>
              {modules[0] ? (
                <Link href={`/learn/${slug}/modul/${modules[0].id}`} className="text-link">
                  Buka <Eye size={14} />
                </Link>
              ) : (
                <span className="text-link" style={{ opacity: 0.5 }}>
                  Belum ada pertemuan
                </span>
              )}
            </div>
          </div>
        </aside>
      </div>

      {showDraftPrompt && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-card__head">
              <div>
                <div className="eyebrow">DRAFT BARU</div>
                <h2>Buat draft baru?</h2>
                <p>Perubahan akan disimpan sebagai draft dan belum terlihat siswa sampai kamu menekan Publish.</p>
              </div>
            </div>
            <div className="modal-actions">
              <button className="button button--ghost button--small" onClick={cancelDraft}>
                Batal
              </button>
              <button className="button button--primary button--small" onClick={beginDraft}>
                <Check size={14} /> Ya, buat draft
              </button>
            </div>
          </div>
        </div>
      )}

      {moduleDraftTarget && (
        <div className="modal-backdrop" onClick={() => setModuleDraftTarget(null)}>
          <div className="modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="modal-card__head">
              <div>
                <div className="eyebrow">PERTEMUAN BARU</div>
                <h2>Tambah pertemuan ke pembelajaran.</h2>
              </div>
              <button className="icon-button" onClick={() => setModuleDraftTarget(null)} aria-label="Tutup">
                <X size={16} />
              </button>
            </div>
            <div className="form-grid" style={{ marginTop: 18 }}>
              <div className="field field--full">
                <label>Judul pertemuan</label>
                <input
                  autoFocus
                  value={moduleDraftTarget.title}
                  onChange={(event) => setModuleDraftTarget({ ...moduleDraftTarget, title: event.target.value })}
                  placeholder="Contoh: Mengamati & Menanya"
                />
              </div>
              <div className="field">
                <label>Label pertemuan</label>
                <input
                  value={moduleDraftTarget.eyebrow}
                  onChange={(event) => setModuleDraftTarget({ ...moduleDraftTarget, eyebrow: event.target.value })}
                  placeholder="Pertemuan 05"
                />
              </div>
              <div className="field">
                <label>Estimasi durasi</label>
                <input
                  value={moduleDraftTarget.duration}
                  onChange={(event) => setModuleDraftTarget({ ...moduleDraftTarget, duration: event.target.value })}
                  placeholder="10 menit"
                />
              </div>
              <div className="field field--full">
                <label>Warna aksen</label>
                <select
                  value={moduleDraftTarget.accent}
                  onChange={(event) => setModuleDraftTarget({ ...moduleDraftTarget, accent: event.target.value as Module["accent"] })}
                >
                  <option value="violet">Violet</option>
                  <option value="teal">Teal</option>
                  <option value="yellow">Kuning</option>
                  <option value="coral">Coral</option>
                </select>
              </div>
            </div>
            <div className="modal-actions">
              <button className="button button--ghost button--small" onClick={() => setModuleDraftTarget(null)}>
                Batal
              </button>
              <button className="button button--primary button--small" onClick={saveModuleDraft}>
                <Plus size={14} /> Tambah pertemuan
              </button>
            </div>
          </div>
        </div>
      )}

      {forumModule && (
        <div className="modal-backdrop" onClick={() => setForumModule(null)}>
          <div className="modal-card forum-modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-card__head">
              <div>
                <div className="eyebrow">FORUM GURU · {forumModule.title.toUpperCase()}</div>
                <h2>Diskusi pertemuan ini.</h2>
                <p>Guru dapat menghapus semua pertanyaan dan tanggapan di forum pertemuan ini.</p>
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

/** Editor materi inline — semua ketikan langsung masuk draft, tanpa tombol simpan/batal. */
function BlockEditor({
  block,
  uploading,
  onPatch,
  onMaterial,
  onWorksheet,
  onUpload,
  onRemoveFile,
  onClose,
}: {
  block: LessonBlock;
  uploading: boolean;
  onPatch: (patch: Partial<LessonBlock>) => void;
  onMaterial: (patch: Record<string, unknown>) => void;
  onWorksheet: (patch: Partial<WorksheetConfig>) => void;
  onUpload: (event: ChangeEvent<HTMLInputElement>) => void;
  onRemoveFile: () => void;
  onClose: () => void;
}) {
  const material = block.material ?? {};
  const worksheet: WorksheetConfig = { ...blankWorksheet, ...(material.worksheet ?? {}) };

  return (
    <div className="activity-lesson-card" style={{ marginTop: 10, padding: 16, background: "var(--surface-2)", borderRadius: 14 }}>
      <div className="builder-card__head" style={{ marginBottom: 10 }}>
        <div>
          <div className="eyebrow">EDITOR MATERI · {block.type.toUpperCase()}</div>
          <small>Tersimpan otomatis di draft. Tidak perlu tombol simpan.</small>
        </div>
        <button className="icon-button icon-button--tiny" onClick={onClose} aria-label="Tutup editor">
          <X size={14} />
        </button>
      </div>

      <div className="form-grid">
        <div className="field field--full">
          <label>Judul materi</label>
          <input value={block.title} onChange={(event) => onPatch({ title: event.target.value })} />
        </div>
        <div className="field field--full">
          <label>Deskripsi</label>
          <textarea value={block.description} onChange={(event) => onPatch({ description: event.target.value })} />
        </div>
        <div className="field">
          <label>Estimasi durasi</label>
          <input value={block.duration} onChange={(event) => onPatch({ duration: event.target.value })} />
        </div>

        {(block.type === "text" || block.type === "assignment" || block.type === "reflection") && (
          <div className="field field--full">
            <label>Isi materi / instruksi</label>
            <textarea
              className="material-textarea"
              value={material.text ?? ""}
              onChange={(event) => onMaterial({ text: event.target.value })}
              placeholder="Tulis materi atau instruksi yang akan muncul di halaman siswa..."
            />
          </div>
        )}

        {block.type === "video" && (
          <>
            <div className="field field--full">
              <label>Link YouTube</label>
              <input value={material.videoUrl ?? ""} onChange={(event) => onMaterial({ videoUrl: event.target.value })} placeholder="https://www.youtube.com/watch?v=..." />
            </div>
            <div className="field field--full">
              <label>Link Google Drive (opsional)</label>
              <input value={material.driveUrl ?? ""} onChange={(event) => onMaterial({ driveUrl: event.target.value })} placeholder="https://drive.google.com/file/d/.../view" />
            </div>
          </>
        )}

        {block.type === "link" && (
          <>
            <div className="field field--full">
              <label>Judul link</label>
              <input value={material.linkTitle ?? ""} onChange={(event) => onMaterial({ linkTitle: event.target.value })} placeholder="Judul sumber belajar" />
            </div>
            <div className="field field--full">
              <label>URL / link yang dibuka siswa</label>
              <input value={material.linkUrl ?? ""} onChange={(event) => onMaterial({ linkUrl: event.target.value })} placeholder="https://contoh.com/sumber-belajar" />
            </div>
          </>
        )}

        {block.type === "activity" && (
          <div className="field field--full">
            <label>Pilih visual interaktif</label>
            <select
              value={material.activity?.visualId ?? "number-line-lab"}
              onChange={(event) => onMaterial({ activity: { visualId: event.target.value as GameTemplateId } })}
            >
              {gameTemplates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.title}
                </option>
              ))}
            </select>
            <small className="field-helper">Siswa membuka visual dengan tombol Buka Visual / Tutup Visual.</small>
          </div>
        )}

        {block.type === "game" && (
          <>
            <div className="field field--full">
              <label>Game dari library</label>
              <select
                value={material.game?.gameId ?? "number-line-challenge"}
                onChange={(event) => onMaterial({ game: { ...blankGame, ...(material.game ?? {}), gameId: event.target.value as GameBlockConfig["gameId"] } })}
              >
                {gameTemplates.map((game) => (
                  <option key={game.id} value={game.id}>
                    {game.title}
                  </option>
                ))}
              </select>
            </div>
            <div className="field field--full">
              <label>Instruksi game</label>
              <textarea
                value={material.game?.instructions ?? ""}
                onChange={(event) => onMaterial({ game: { ...blankGame, ...(material.game ?? {}), instructions: event.target.value } })}
              />
            </div>
          </>
        )}

        {block.type === "quiz" && (
          <div className="field field--full">
            <div className="material-callout">
              <ClipboardCheck size={18} />
              <div>
                <strong>Soal kuis dikelola di halaman builder kuis</strong>
                <small>Klik ikon pensil pada materi kuis untuk mengatur soal, kunci, dan aturan skor.</small>
              </div>
            </div>
          </div>
        )}

        {/* Berkas materi untuk semua tipe: PDF, PPT, DOCX, atau gambar. */}
        <div className="field field--full">
          <label>Berkas materi (PDF, PPT, DOCX, atau gambar)</label>
          <label className="file-upload-zone">
            <input type="file" accept={MATERIAL_ACCEPT} onChange={onUpload} disabled={uploading} />
            {uploading ? <Loader2 size={16} className="spin" /> : <Upload size={16} />}
            <span>{uploading ? "Mengunggah..." : "Pilih berkas dari perangkat"}</span>
          </label>
          {material.pdfUrl ? (
            <div className="file-chip-row" style={{ marginTop: 8 }}>
              <a href={material.pdfUrl} target="_blank" rel="noreferrer" className="file-chip">
                <FileText size={14} /> {material.fileName || "Berkas materi"} · {fileKindLabel(material.fileMime, material.fileName)}
              </a>
              <button type="button" className="button button--ghost button--small" onClick={onRemoveFile}>
                <Trash2 size={13} /> Hapus
              </button>
            </div>
          ) : (
            <small className="field-helper">PDF pratinjau langsung; PPT/DOCX bisa diunduh siswa.</small>
          )}
        </div>

        {/* Lembar kerja, jawaban & lampiran — sama untuk semua tipe materi. */}
        <div className="field field--full">
          <div className="settings-row">
            <div className="settings-row__copy">
              <strong>Lembar kerja, jawaban &amp; lampiran</strong>
              <small>Satu format untuk semua materi. Siswa menjawab dan melampirkan berkas.</small>
            </div>
            <button className={`toggle ${worksheet.enabled ? "is-on" : ""}`} onClick={() => onWorksheet({ enabled: !worksheet.enabled })}>
              <span />
            </button>
          </div>
        </div>
        {worksheet.enabled && (
          <>
            <div className="field field--full">
              <label>Instruksi lembar kerja</label>
              <textarea value={worksheet.prompt} onChange={(event) => onWorksheet({ prompt: event.target.value })} />
            </div>
            <div className="field">
              <label>Label kolom jawaban</label>
              <input value={worksheet.answerLabel} onChange={(event) => onWorksheet({ answerLabel: event.target.value })} />
            </div>
            <div className="field">
              <label>Label kolom lampiran</label>
              <input value={worksheet.attachmentLabel} onChange={(event) => onWorksheet({ attachmentLabel: event.target.value })} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
