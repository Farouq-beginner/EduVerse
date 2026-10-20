"use client";

import Link from "next/link";
import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, ClipboardCheck, Copy, Eye, FileText, Gamepad2, Image, Link2, MessageCircle, Plus, Save, Sparkles, Trash2, Video, X } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { StatusPill } from "@/components/DashboardBits";
import { Toast } from "@/components/Toast";
import { activityTemplates, demoCourse, gameTemplates, type ActivityConfig, type GameBlockConfig, type LessonBlock, type Module } from "@/lib/demo-data";
import { getCourseBlocks, getCourseModules, getCourseState, saveCourseBlocks, saveCourseModules, saveCourseState } from "@/lib/storage";
import { getCourseStructure, getTeacherCourseIdBySlug, saveCourseStructure, updateCourseSettings } from "@/lib/actions/dashboards";
import { toModule, toSavePayload } from "@/lib/course";

const iconMap = { text: FileText, video: Video, activity: Sparkles, quiz: ClipboardCheck, assignment: FileText, game: Gamepad2, reflection: MessageCircle };
const newBlockTemplates: Array<{ type: LessonBlock["type"]; label: string; icon: typeof FileText }> = [
  { type: "text", label: "Teks", icon: FileText },
  { type: "video", label: "Video / YouTube", icon: Video },
  { type: "activity", label: "Aktivitas", icon: Sparkles },
  { type: "quiz", label: "Kuis", icon: ClipboardCheck },
  { type: "assignment", label: "PDF / Tugas", icon: FileText },
  { type: "game", label: "Game", icon: Gamepad2 },
];

type MaterialDraft = { text: string; videoUrl: string; driveUrl: string; pdfUrl: string; fileName: string; activity: ActivityConfig; game: GameBlockConfig };
const blankActivity: ActivityConfig = { templateId: "observing-questioning", prompt: activityTemplates[0].prompt, evidenceLabel: activityTemplates[0].evidenceLabel, responseType: "interactive", choices: [{ label: "A", value: "−8", correct: true }, { label: "B", value: "0" }, { label: "C", value: "8" }], instructions: "Ikuti langkah aktivitas, tuliskan strategi yang kamu gunakan, lalu kirim jawaban untuk ditinjau guru.", points: 10, graded: true, showScore: true, rubric: "Strategi benar (5), proses terlihat (3), refleksi jelas (2)." };
const blankGame: GameBlockConfig = { gameId: "number-line-challenge", instructions: "Jawab tantangan operasi bilangan bulat dengan cepat dan tepat.", points: 20, graded: true, showScore: true, passThreshold: 70 };
const blankMaterial: MaterialDraft = { text: "", videoUrl: "", driveUrl: "", pdfUrl: "", fileName: "", activity: blankActivity, game: blankGame };

export default function CourseBuilderPage() {
  const router = useRouter();
  const [access, setAccess] = useState<"open" | "locked">("open");
  const [state, setState] = useState<"draft" | "published">("published");
  const [blocks, setBlocks] = useState<LessonBlock[]>([]);
  const [modules, setModules] = useState<Module[]>(demoCourse.modules);
  const [toast, setToast] = useState("");
  const [showAdd, setShowAdd] = useState<string | null>(null);
  const [editingBlock, setEditingBlock] = useState<LessonBlock | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [material, setMaterial] = useState<MaterialDraft>(blankMaterial);
  const [courseId, setCourseId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Muat struktur course dari database (id blok asli), bukan seed demo.
  useEffect(() => {
    const saved = getCourseState();
    setAccess(saved.access);
    setState(saved.state);
    setBlocks(getCourseBlocks());
    setModules(getCourseModules());

    let active = true;
    (async () => {
      const id = await getTeacherCourseIdBySlug(demoCourse.slug);
      if (!active || !id) return;
      setCourseId(id);
      const structure = await getCourseStructure(demoCourse.slug, { teacherOnly: true });
      if (!active || !structure) return;
      const dbModules = structure.modules.map(toModule);
      setModules(dbModules);
      setBlocks(dbModules.flatMap((module) => module.lessons));
      setAccess(structure.access === "LOCKED" ? "locked" : "open");
      setState(structure.state === "PUBLISHED" ? "published" : "draft");
    })();
    return () => {
      active = false;
    };
  }, []);

  function copyLink() {
    navigator.clipboard?.writeText(`${window.location.origin}/learn/${demoCourse.slug}`);
    setToast("Link pembelajaran disalin.");
  }

  function persist(nextBlocks: LessonBlock[]) {
    setBlocks(nextBlocks);
    saveCourseBlocks(nextBlocks);
  }

  /** Modul efektif: blok urut modul + blok tambahan milik modul tersebut. */
  function effectiveModules(nextBlocks: LessonBlock[] = blocks, nextModules: Module[] = modules): Module[] {
    const byId = new Map(nextBlocks.map((block) => [block.id, block]));
    return nextModules.map((module) => {
      const ordered = module.lessons.map((seed) => byId.get(seed.id)).filter(Boolean) as LessonBlock[];
      const extras = nextBlocks.filter((block) => block.moduleId === module.id && !module.lessons.some((lesson) => lesson.id === block.id));
      return { ...module, lessons: [...ordered, ...extras] };
    });
  }

  /** Simpan struktur (modul + blok) ke database guru, lalu muat ulang id baru. */
  async function saveToDb(nextModules: Module[], nextBlocks: LessonBlock[]) {
    if (!courseId) {
      setToast("Course belum ada di database. Login sebagai guru pemilik course.");
      return null;
    }
    setSaving(true);
    const res = await saveCourseStructure(courseId, toSavePayload(effectiveModules(nextBlocks, nextModules)));
    setSaving(false);
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
    saveCourseState(state, next);
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
    saveCourseState(next, access);
    if (courseId) {
      const res = await updateCourseSettings(courseId, { state: next });
      setToast(res.ok ? (next === "published" ? "Versi terbaru dipublikasikan." : "Disimpan sebagai draft.") : res.error ?? "Gagal menyimpan pengaturan.");
      return;
    }
    setToast(next === "published" ? "Versi terbaru dipublikasikan." : "Disimpan sebagai draft.");
  }

  function addModule() { const id = `module-${Date.now()}`; const module: Module = { id, title: "Modul baru", eyebrow: "Modul baru · 10 menit", accent: "violet", lessons: [] }; const next = [...modules, module]; setModules(next); saveCourseModules(next); void saveToDb(next, blocks); setToast("Modul baru ditambahkan ke pembelajaran."); }

  function removeModule(moduleId: string) { const module = modules.find((item) => item.id === moduleId); if (!module || !window.confirm(`Hapus ${module.title} beserta semua materinya?`)) return; const nextModules = modules.filter((item) => item.id !== moduleId); const nextBlocks = blocks.filter((block) => block.moduleId !== moduleId); setModules(nextModules); saveCourseModules(nextModules); persist(nextBlocks); void saveToDb(nextModules, nextBlocks); setToast("Modul dan materi di dalamnya dihapus."); }

  async function addBlock(moduleId: string, type: LessonBlock["type"], label: string) {
    const id = `custom-${Date.now()}`;
    const material = type === "activity" ? { activity: { ...blankActivity } } : type === "game" ? { game: { ...blankGame } } : {};
    const next = [...blocks, { id, moduleId, type, title: `${label} baru`, description: "Isi materi ini dari editor blok.", duration: "05 menit", status: "new" as const, material }];
    persist(next);
    setShowAdd(null);
    const structure = await saveToDb(modules, next);
    if (type === "quiz") {
      // Blok kuis baru hanya punya id database setelah disimpan.
      const dbModule = structure?.modules.find((item) => item.id === moduleId);
      const dbBlock = dbModule?.blocks[dbModule.blocks.length - 1];
      const quizBlockId = dbBlock?.id ?? id;
      router.push(`/teacher/course/${demoCourse.slug}/quiz/${quizBlockId}`);
      return;
    }
    setToast(`${label} ditambahkan ke ${modules.find((module) => module.id === moduleId)?.title}.`);
  }

  function openEditor(block: LessonBlock) {
    if (block.type === "quiz") {
      router.push(`/teacher/course/${demoCourse.slug}/quiz/${block.id}`);
      return;
    }
    setEditingBlock(block);
    setEditTitle(block.title);
    setEditDescription(block.description);
    setMaterial({ ...blankMaterial, ...block.material, activity: { ...blankActivity, ...block.material?.activity, templateId: block.material?.activity?.templateId || blankActivity.templateId, prompt: block.material?.activity?.prompt || blankActivity.prompt, evidenceLabel: block.material?.activity?.evidenceLabel || blankActivity.evidenceLabel }, game: { ...blankGame, ...block.material?.game } });
  }

  function handlePdfUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setMaterial((current) => ({ ...current, pdfUrl: String(reader.result), fileName: file.name }));
    reader.readAsDataURL(file);
  }

  function saveBlockEdit() {
    if (!editingBlock || !editTitle.trim()) return;
    const next = blocks.map((item) => item.id === editingBlock.id ? { ...item, title: editTitle.trim(), description: editDescription.trim() || item.description, material: { ...material } } : item);
    persist(next);
    setEditingBlock(null);
    void saveToDb(modules, next);
    setToast("Materi blok disimpan dan siap tampil di halaman siswa.");
  }

  function removeBlock(id: string) {
    const next = blocks.filter((item) => item.id !== id);
    persist(next);
    void saveToDb(modules, next);
    setToast("Blok dihapus dari pembelajaran.");
  }

  const blockById = useMemo(() => new Map(blocks.map((block) => [block.id, block])), [blocks]);

  return <AppShell>
    <div className="builder-header"><div className="builder-header__title"><div><Link href="/teacher" className="back-link"><ArrowLeft size={14} /> Kembali ke dashboard</Link><h1>Course builder</h1><p>Isi materi per modul, lalu preview langsung sebagai siswa.</p></div></div><div className="builder-header__actions"><button className="button button--ghost button--small" onClick={addModule}><Plus size={15} /> Tambah modul</button><Link href={`/learn/${demoCourse.slug}`} className="button button--ghost button--small"><Eye size={15} /> Preview siswa</Link><button className="button button--primary button--small" onClick={togglePublish}>{state === "published" ? <><Save size={15} /> Simpan perubahan</> : <><Check size={15} /> Publish</>}</button></div></div>
    <div className="builder-layout"><div className="builder-main">
      <div className="builder-card"><div className="builder-card__head"><div><strong>Info pembelajaran</strong><small>Identitas yang dilihat siswa saat membuka link.</small></div><StatusPill tone={state === "published" ? "teal" : "yellow"}>{state === "published" ? "Published" : "Draft"}</StatusPill></div><div className="form-grid"><div className="field field--full"><label>Judul pembelajaran</label><input defaultValue={demoCourse.title} /></div><div className="field field--full"><label>Deskripsi</label><textarea defaultValue={demoCourse.description} /></div></div></div>
      {modules.map((module, moduleIndex) => <div className={`builder-card module-builder-card module-builder-card--${module.accent}`} key={module.id}><div className="builder-card__head"><div><span className="eyebrow">MODUL 0{moduleIndex + 1}</span><strong>{module.title}</strong><small>{module.eyebrow} · Buka untuk mengisi materi.</small></div><div style={{ display: "flex", gap: 8 }}><button className="button button--ghost button--small" onClick={() => setShowAdd(showAdd === module.id ? null : module.id)}><Plus size={15} /> Tambah materi</button><button className="icon-button icon-button--tiny" onClick={() => removeModule(module.id)} aria-label={`Hapus modul ${module.title}`}><Trash2 size={14} /></button></div></div>{showAdd === module.id && <div className="add-block-bar">{newBlockTemplates.map(({ type, label, icon: Icon }) => <button className="add-block-button" key={type} onClick={() => addBlock(module.id, type, label)}><Icon size={13} /> {label}</button>)}</div>}<div className="module-editor-list">{module.lessons.map((seedBlock) => blockById.get(seedBlock.id)).concat(blocks.filter((block) => block.moduleId === module.id && !module.lessons.some((lesson) => lesson.id === block.id))).filter(Boolean).map((block) => { const item = block as LessonBlock; const Icon = iconMap[item.type]; return <div className="content-block" key={item.id}><span className="content-block__icon"><Icon size={17} /></span><div className="content-block__copy"><strong>{item.title}</strong><small>{item.description}</small>{item.material?.videoUrl && <em className="material-chip">Video terhubung</em>}{item.material?.text && <em className="material-chip">Teks siap tampil</em>}{item.material?.pdfUrl && <em className="material-chip">PDF: {item.material.fileName || "dokumen"}</em>}</div><small style={{ color: "var(--muted)", fontSize: ".64rem" }}>{item.duration}</small><div className="content-block__menu"><button className="icon-button icon-button--tiny" onClick={() => openEditor(item)} aria-label={`Edit materi ${item.title}`}><FileText size={14} /></button><button className="icon-button icon-button--tiny" onClick={() => removeBlock(item.id)} aria-label={`Hapus ${item.title}`}><Trash2 size={13} /></button></div></div>; })}</div></div>)}
    </div><aside className="builder-sidebar"><div className="access-card"><div className="access-card__head"><div><strong>Akses siswa</strong><small>Publikasi dan akses masuk dikontrol terpisah.</small></div><button className={`toggle ${access === "open" ? "is-on" : ""}`} onClick={toggleAccess} aria-label="Ubah akses"><span /></button></div><div className="access-divider" /><StatusPill tone={access === "open" ? "teal" : "coral"}>{access === "open" ? "Siswa bisa bergabung" : "Siswa baru ditolak"}</StatusPill><p className="access-helper">{access === "open" ? "Peserta baru bisa masuk dengan nama dan kelas lewat link." : "Link tetap ada, tetapi siswa baru melihat halaman akses terkunci."}</p><div className="link-field" style={{ marginTop: 15 }}><Link2 size={14} color="var(--muted)" /><input readOnly value={`/learn/${demoCourse.slug}`} /><button onClick={copyLink} aria-label="Salin link"><Copy size={13} /></button></div></div><div className="access-card"><div className="access-card__head"><div><strong>Materi siap tayang</strong><small>Guru dapat memasukkan YouTube, Drive, teks, PDF, kuis, dan game.</small></div><Sparkles size={18} color="var(--violet)" /></div><div className="settings-row"><div className="settings-row__copy"><strong>Halaman siswa</strong><small>Setiap modul memiliki route dan halaman sendiri.</small></div><Link href={`/learn/${demoCourse.slug}/modul/module-observe`} className="text-link">Buka <Eye size={14} /></Link></div></div></aside></div>
    {editingBlock && <BlockEditor block={editingBlock} title={editTitle} description={editDescription} material={material} setTitle={setEditTitle} setDescription={setEditDescription} setMaterial={setMaterial} onPdfUpload={handlePdfUpload} onClose={() => setEditingBlock(null)} onSave={saveBlockEdit} />}
    {toast && <Toast message={toast} onClose={() => setToast("")} />}
  </AppShell>;
}

function BlockEditor({ block, title, description, material, setTitle, setDescription, setMaterial, onPdfUpload, onClose, onSave }: { block: LessonBlock; title: string; description: string; material: MaterialDraft; setTitle: (value: string) => void; setDescription: (value: string) => void; setMaterial: React.Dispatch<React.SetStateAction<MaterialDraft>>; onPdfUpload: (event: ChangeEvent<HTMLInputElement>) => void; onClose: () => void; onSave: () => void }) {
  const updateActivity = <K extends keyof ActivityConfig>(key: K, value: ActivityConfig[K]) => setMaterial((current) => ({ ...current, activity: { ...current.activity, [key]: value } }));
  const updateGame = <K extends keyof GameBlockConfig>(key: K, value: GameBlockConfig[K]) => setMaterial((current) => ({ ...current, game: { ...current.game, [key]: value } }));
  return <div className="modal-backdrop" onClick={onClose}><div className="modal-card material-editor-modal" onClick={(event) => event.stopPropagation()}><div className="modal-card__head"><div><div className="eyebrow">EDITOR MATERI · {block.type.toUpperCase()}</div><h2>Rincian yang dilihat siswa.</h2></div><button className="icon-button" onClick={onClose} aria-label="Tutup editor"><X size={16} /></button></div><div className="form-grid" style={{ marginTop: 20 }}><div className="field field--full"><label>Judul blok</label><input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} /></div><div className="field field--full"><label>Deskripsi singkat</label><textarea value={description} onChange={(event) => setDescription(event.target.value)} /></div>{(block.type === "text" || block.type === "assignment" || block.type === "reflection") && <div className="field field--full"><label>Isi teks / instruksi</label><textarea className="material-textarea" value={material.text} onChange={(event) => setMaterial((current) => ({ ...current, text: event.target.value }))} placeholder="Tulis materi atau instruksi tugas yang akan muncul di halaman siswa..." /></div>}{block.type === "video" && <><div className="field field--full"><label>Link YouTube</label><input value={material.videoUrl} onChange={(event) => setMaterial((current) => ({ ...current, videoUrl: event.target.value }))} placeholder="https://www.youtube.com/watch?v=..." /></div><div className="field field--full"><label>Link Google Drive (opsional)</label><input value={material.driveUrl} onChange={(event) => setMaterial((current) => ({ ...current, driveUrl: event.target.value }))} placeholder="https://drive.google.com/file/d/.../view" /></div></>}{block.type === "assignment" && <><div className="field field--full"><label>Link PDF / Drive</label><input value={material.pdfUrl.startsWith("data:") ? "" : material.pdfUrl} onChange={(event) => setMaterial((current) => ({ ...current, pdfUrl: event.target.value, fileName: "" }))} placeholder="https://drive.google.com/file/d/.../view atau URL PDF" /></div><div className="field field--full"><label>Atau upload PDF dari perangkat</label><input type="file" accept="application/pdf" onChange={onPdfUpload} /><small className="field-helper">{material.fileName ? `File siap: ${material.fileName}` : "File demo disimpan lokal di browser."}</small></div></>}{block.type === "activity" && <><div className="field field--full"><label>Contoh aktivitas FPBL</label><select value={material.activity.templateId} onChange={(event) => { const template = activityTemplates.find((item) => item.id === event.target.value) || activityTemplates[0]; setMaterial((current) => ({ ...current, activity: { ...current.activity, templateId: template.id, prompt: template.prompt, evidenceLabel: template.evidenceLabel, responseType: template.responseType, choices: template.responseType === "interactive" ? [{ label: "A", value: "−8", correct: true }, { label: "B", value: "0" }, { label: "C", value: "8" }] : current.activity.choices, instructions: `Kerjakan aktivitas: ${template.title}. Tulis proses berpikirmu dengan runtut.` } })); }}>{activityTemplates.map((template) => <option key={template.id} value={template.id}>{template.title}</option>)}</select><small className="field-helper">Aktivitas ini berdiri sendiri dan bukan mini-game. Garis Bilangan dan Kartu Muatan tersedia di tipe Game.</small></div><div className="field field--full"><label>Pertanyaan / kasus aktivitas</label><textarea className="material-textarea" value={material.activity.prompt} onChange={(event) => updateActivity("prompt", event.target.value)} placeholder="Apa yang harus dilakukan siswa?" /></div><div className="field field--full"><label>Instruksi aktivitas</label><textarea className="material-textarea" value={material.activity.instructions} onChange={(event) => updateActivity("instructions", event.target.value)} placeholder="Bagaimana siswa mengerjakan aktivitas?" /></div><div className="field field--full"><label>Bukti yang dikumpulkan</label><input value={material.activity.evidenceLabel} onChange={(event) => updateActivity("evidenceLabel", event.target.value)} /></div><div className="field"><label>Jenis respons siswa</label><select value={material.activity.responseType} onChange={(event) => updateActivity("responseType", event.target.value as ActivityConfig["responseType"])}><option value="interactive">Interaktif / simulasi</option><option value="short-answer">Jawaban singkat</option><option value="essay">Uraian</option><option value="upload">Upload bukti</option></select></div>{material.activity.responseType === "interactive" && <div className="field field--full"><label>Pilihan jawaban dan kunci</label><div className="choice-editor">{(material.activity.choices || []).map((choice, index) => <div className="choice-editor__row" key={choice.label}><strong>{choice.label}</strong><input value={choice.value} onChange={(event) => setMaterial((current) => ({ ...current, activity: { ...current.activity, choices: (current.activity.choices || []).map((item, itemIndex) => itemIndex === index ? { ...item, value: event.target.value } : item) } }))} /><label className="choice-editor__check"><input type="radio" name="activity-correct" checked={Boolean(choice.correct)} onChange={() => setMaterial((current) => ({ ...current, activity: { ...current.activity, choices: (current.activity.choices || []).map((item, itemIndex) => ({ ...item, correct: itemIndex === index })) } }))} /> benar</label></div>)}</div><small className="field-helper">Siswa memilih satu jawaban lalu menekan Kirim jawaban.</small></div>}<div className="field"><label>Poin aktivitas</label><input type="number" min={0} value={material.activity.points} onChange={(event) => updateActivity("points", Number(event.target.value))} /></div><div className="field field--full"><label>Rubrik penilaian / catatan guru</label><textarea value={material.activity.rubric} onChange={(event) => updateActivity("rubric", event.target.value)} placeholder="Kriteria penilaian untuk jawaban uraian..." /></div><div className="settings-row field--full"><div className="settings-row__copy"><strong>Masuk ke gradebook</strong><small>Nilai aktivitas ikut analitik peserta.</small></div><button className={`toggle ${material.activity.graded ? "is-on" : ""}`} onClick={() => updateActivity("graded", !material.activity.graded)}><span /></button></div><div className="settings-row field--full"><div className="settings-row__copy"><strong>Tampilkan skor ke siswa</strong><small>Siswa melihat poin setelah mengirim respons.</small></div><button className={`toggle ${material.activity.showScore ? "is-on" : ""}`} onClick={() => updateActivity("showScore", !material.activity.showScore)}><span /></button></div></>}{block.type === "game" && <><div className="field field--full"><label>Game dari library</label><small className="field-helper">Template ini sama dengan Mini-Game Studio dan dapat dikonfigurasi dari menu Game.</small><select value={material.game.gameId} onChange={(event) => updateGame("gameId", event.target.value as GameBlockConfig["gameId"])}>{gameTemplates.map((game) => <option key={game.id} value={game.id}>{game.title}</option>)}</select></div><div className="field field--full"><label>Instruksi game</label><textarea value={material.game.instructions} onChange={(event) => updateGame("instructions", event.target.value)} /></div><div className="field"><label>Poin per sesi</label><input type="number" min={0} value={material.game.points} onChange={(event) => updateGame("points", Number(event.target.value))} /></div><div className="field"><label>Ambang lulus (%)</label><input type="number" min={0} max={100} value={material.game.passThreshold} onChange={(event) => updateGame("passThreshold", Number(event.target.value))} /></div><div className="settings-row field--full"><div className="settings-row__copy"><strong>Masuk ke gradebook</strong><small>Playtest guru tetap tidak dihitung; sesi siswa dapat dinilai.</small></div><button className={`toggle ${material.game.graded ? "is-on" : ""}`} onClick={() => updateGame("graded", !material.game.graded)}><span /></button></div><div className="settings-row field--full"><div className="settings-row__copy"><strong>Tampilkan skor ke siswa</strong><small>Atur apakah skor dan ambang lulus terlihat.</small></div><button className={`toggle ${material.game.showScore ? "is-on" : ""}`} onClick={() => updateGame("showScore", !material.game.showScore)}><span /></button></div></>}{block.type === "quiz" && <div className="material-callout"><ClipboardCheck size={18} /><div><strong>Kuis dikelola di halaman builder khusus</strong><small>Tambah soal, kunci jawaban, pembahasan, poin, percobaan, dan pengaturan tampilan skor.</small></div></div>}</div><div className="modal-actions"><button className="button button--ghost button--small" onClick={onClose}>Batal</button><button className="button button--primary button--small" onClick={onSave}><Save size={14} /> Simpan rincian</button></div></div></div>;
}
