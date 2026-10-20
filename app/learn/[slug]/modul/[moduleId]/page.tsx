"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check, ClipboardCheck, Download, ExternalLink, FileText, Gamepad2, Link2, Loader2, Play, Sparkles, Video } from "lucide-react";
import { useParams } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { StatusPill } from "@/components/DashboardBits";
import { Toast } from "@/components/Toast";
import { NumberLineVisualizer } from "@/components/NumberLineVisualizer";
import { DiscussionForum } from "@/components/DiscussionForum";
import { demoCourse, quizQuestions, type ActivityConfig, type LessonBlock, type Module } from "@/lib/demo-data";
import { getCourseBlocks, getCourseModules, getIdentity, getProgress, getQuizDraft, saveProgress, saveSubmission } from "@/lib/storage";
import { getCourseStructure, getMyCourseProgress, getQuizForBlock, getSessionProfile, type DbCourse } from "@/lib/actions/dashboards";
import { markBlockComplete, submitAssignment, submitQuizAttempt } from "@/lib/actions/progress";
import { toModule } from "@/lib/course";

const moduleAccent: Record<string, "violet" | "teal" | "yellow" | "coral"> = { "module-observe": "violet", "module-explore": "teal", "module-investigate": "yellow", "module-present": "coral" };

type DbQuiz = Awaited<ReturnType<typeof getQuizForBlock>>;

export default function ModulePage() {
  const params = useParams<{ slug: string; moduleId: string }>();
  const courseSlug = params.slug || demoCourse.slug;
  const [modules, setModules] = useState<Module[]>(demoCourse.modules);
  const [dbCourse, setDbCourse] = useState<DbCourse | null>(null);
  const [courseId, setCourseId] = useState<string | null>(null);
  const [enrolled, setEnrolled] = useState(false);
  const [identity, setIdentity] = useState<{ name: string; className: string; participantId: string } | null>(null);
  const [completed, setCompleted] = useState<string[]>([]);
  const [dbQuiz, setDbQuiz] = useState<DbQuiz>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");

  // Muat identitas lokal + struktur course dari database.
  useEffect(() => {
    setIdentity(getIdentity());
    (async () => {
      try {
        const [structure, mine, profile] = await Promise.all([
          getCourseStructure(courseSlug),
          getMyCourseProgress(courseSlug),
          getSessionProfile(),
        ]);
        if (structure) {
          setDbCourse(structure);
          setModules(structure.modules.map(toModule));
        } else {
          setModules(getCourseModules());
        }
        if (mine) {
          setCourseId(mine.courseId);
          setEnrolled(mine.enrolled);
          setCompleted(mine.completedBlockIds);
        }
        // Siswa yang login: pakai nama akun, bukan identitas lokal browser.
        if (profile && profile.role === "STUDENT") {
          setIdentity({
            name: profile.fullName,
            className: profile.className ?? "—",
            participantId: profile.id,
          });
        }
      } catch {
        setModules(getCourseModules());
      } finally {
        setLoading(false);
      }
    })();
  }, [courseSlug]);

  const module = modules.find((item) => item.id === params.moduleId) ?? modules[0];
  const moduleIndex = modules.findIndex((item) => item.id === module.id);
  const storedBlocks = useMemo(() => (dbCourse ? [] : getCourseBlocks()), [dbCourse]);
  const blocks = dbCourse
    ? module.lessons
    : module.lessons.map((seed) => storedBlocks.find((item) => item.id === seed.id) ?? seed).concat(storedBlocks.filter((item) => item.moduleId === module.id && !module.lessons.some((lesson) => lesson.id === item.id)));
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const selected = blocks.find((block) => block.id === selectedId) ?? blocks[0];
  const accent = module.accent || moduleAccent[module.id] || "violet";

  // Muat kuis blok terpilih dari database (kunci jawaban tidak dikirim ke client).
  useEffect(() => {
    if (!selected) return;
    let active = true;
    getQuizForBlock(selected.id).then((quiz) => {
      if (active) setDbQuiz(quiz);
    });
    return () => {
      active = false;
    };
  }, [selected?.id]);

  async function completeBlock() {
    if (!selected) return;
    setCompleted((current) => (current.includes(selected.id) ? current : [...current, selected.id]));
    saveProgress(Math.min(100, getProgress() + 8));
    if (courseId && enrolled) {
      const res = await markBlockComplete({ courseId, blockId: selected.id }).catch(() => ({ ok: false, error: "Gagal menyimpan ke server." }));
      setToast(res.ok ? `${selected.title} selesai. Tersinkron ke akun guru.` : `${selected.title} selesai. ${res.error ?? "Belum tersimpan di server."}`);
      return;
    }
    setToast(`${selected.title} selesai. Progres tersimpan di perangkat.`);
  }

  if (loading) {
    return <AppShell role="student"><div className="module-page module-page--empty"><div className="empty-state"><Loader2 size={24} className="spin" /><strong>Memuat modul...</strong></div></div></AppShell>;
  }

  if (!identity && !enrolled) return <AppShell role="student"><div className="module-page module-page--empty"><Link href={`/learn/${courseSlug}`} className="back-link"><ArrowLeft size={14} /> Kembali ke ruang belajar</Link><div className="empty-state-card"><Sparkles size={28} /><h1>Masuk dulu untuk membuka modul</h1><p>Halaman modul ini mengikuti identitas dan progres siswa dari ruang belajar.</p><Link href={`/learn/${courseSlug}`} className="button button--primary">Masuk ke pembelajaran <ArrowRight size={16} /></Link></div></div></AppShell>;

  const identityName = identity?.name ?? "Siswa";
  const identityClass = identity?.className ?? "—";

  return <AppShell role="student"><div className="module-page"><div className="module-page__top"><Link href={`/learn/${courseSlug}`} className="back-link"><ArrowLeft size={14} /> Semua modul</Link><div className="module-page__identity"><span>{identityName}</span><small>{identityClass} · {enrolled ? "progres tersinkron" : "progres lokal"}</small></div></div><div className={`module-hero module-hero--${accent}`}><div><div className="eyebrow">{module.eyebrow.toUpperCase()}</div><h1>{module.title}</h1><p>Ikuti materi ini langkah demi langkah. Pilih aktivitas di daftar untuk membuka isinya di halaman modul.</p></div><span className="module-hero__number">{String(moduleIndex + 1).padStart(2, "0")}</span></div><div className="module-page__grid"><aside className="module-outline"><div className="eyebrow">ISI MODUL</div>{blocks.map((block, index) => <button key={block.id} className={`module-outline__item ${selected?.id === block.id ? "is-active" : ""}`} onClick={() => setSelectedId(block.id)}><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{block.title}</strong><small>{block.duration}</small></div>{completed.includes(block.id) && <Check size={14} />}</button>)}<Link href={`/learn/${courseSlug}/games`} className="module-games-link"><Gamepad2 size={16} /><span><strong>Game pembelajaran</strong><small>Buka semua game</small></span><ArrowRight size={14} /></Link></aside><main className="module-viewer">{selected ? <LessonRenderer block={selected} dbQuiz={dbQuiz} courseId={courseId} enrolled={enrolled} identity={identity} moduleId={module.id} moduleTitle={module.title} courseSlug={courseSlug} onComplete={completeBlock} onToast={setToast} /> : <div className="empty-state-card"><FileText size={24} /><h2>Belum ada materi</h2><p>Guru belum mengisi blok pada modul ini.</p></div>}</main></div>{toast && <Toast message={toast} onClose={() => setToast("")} />}</div></AppShell>;
}

function LessonRenderer({ block, dbQuiz, courseId, enrolled, identity, moduleId, moduleTitle, courseSlug, onComplete, onToast }: { block: LessonBlock; dbQuiz: DbQuiz; courseId: string | null; enrolled: boolean; identity: { name: string; className: string; participantId: string } | null; moduleId: string; moduleTitle: string; courseSlug: string; onComplete: () => void; onToast: (message: string) => void }) {
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

      {block.type === "quiz" && (
        <QuizLesson block={block} dbQuiz={dbQuiz} courseId={courseId} enrolled={enrolled} onComplete={onComplete} onToast={onToast} />
      )}

      {block.type === "activity" && (
        <ActivityLesson block={block} config={block.material?.activity} courseId={courseId} enrolled={enrolled} identity={identity} onComplete={onComplete} onToast={onToast} />
      )}

      {block.type === "game" && (
        (() => {
          const gameId = block.material?.game?.gameId;
          if (gameId === "number-line-lab") {
            return (
              <div className="lesson-view">
                <LessonHeading icon={<Gamepad2 size={18} />} block={block} />
                <NumberLineVisualizer
                  title={block.title || "Laboratorium Garis Bilangan Interaktif"}
                  description={block.material?.game?.instructions || block.description}
                />
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
                  <p>{block.material?.game?.instructions || block.description}</p>
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
        <AssignmentLesson block={block} courseId={courseId} enrolled={enrolled} identity={identity} onComplete={onComplete} onToast={onToast} />
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
          {/* Visual Garis Bilangan Terintegrasi di Materi */}
          <NumberLineVisualizer
            title="Eksplorasi Garis Bilangan: Tanda Positif & Negatif"
            description="Coba geser angka awal dan langkah gerak untuk melihat perpindahan titik secara langsung."
          />
          <CompleteButton onClick={onComplete} label="Materi selesai" />
        </div>
      )}

      {block.type === "reflection" && (
        <div className="lesson-view">
          <LessonHeading icon={<Sparkles size={18} />} block={block} />
          <div className="activity-lesson-card">
            <div className="eyebrow">REFLEKSI STRATEGI PEMBELAJARAN</div>
            <h2>Bagaimana pemahamanmu sejauh ini?</h2>
            <p>Tuliskan cara atau analogi yang paling membantumu mengingat aturan penjumlahan dan pengurangan bilangan bulat.</p>
            <textarea className="material-textarea" placeholder="Tulis refleksimu di sini..." />
            <button className="button button--primary" onClick={onComplete} style={{ marginTop: 12 }}>
              <Check size={16} /> Simpan Refleksi & Selesai
            </button>
          </div>
        </div>
      )}

      {/* Forum Diskusi per modul dengan data terpisah dan spesifik */}
      <DiscussionForum
        moduleId={moduleId}
        courseSlug={courseSlug}
        moduleTitle={moduleTitle}
        currentUser={identity ? { name: identity.name, role: "STUDENT", className: identity.className } : null}
      />
    </div>
  );
}

function LessonHeading({ icon, block }: { icon: React.ReactNode; block: LessonBlock }) { return <div className="lesson-view__heading"><span className="lesson-view__icon">{icon}</span><div><div className="eyebrow">MATERI SISWA</div><h2>{block.title}</h2><p>{block.description}</p></div><StatusPill tone="teal">{block.duration}</StatusPill></div>; }
function CompleteButton({ onClick, label }: { onClick: () => void; label: string }) { return <button className="button button--primary" onClick={onClick}><Check size={16} /> {label}</button>; }

function ActivityLesson({ block, config, courseId, enrolled, identity, onComplete, onToast }: { block: LessonBlock; config?: ActivityConfig; courseId: string | null; enrolled: boolean; identity: { name: string; className: string; participantId: string } | null; onComplete: () => void; onToast: (message: string) => void }) {
  const fallback: ActivityConfig = { templateId: "observing-questioning", prompt: "Amati masalah bilangan bulat dan tulis strategi penyelesaianmu.", evidenceLabel: "Jawaban tertulis", responseType: "short-answer", instructions: "Kerjakan dengan langkah yang runtut.", points: 10, graded: true, showScore: true, rubric: "Proses dan alasan matematis." };
  const activity = config ?? fallback;
  const [response, setResponse] = useState(""); const [submitted, setSubmitted] = useState(false); const [submittedAt, setSubmittedAt] = useState(""); const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    const now = new Date().toISOString();
    const selected = activity.choices?.find((choice) => choice.value === response);
    const score = activity.responseType === "interactive" ? (selected?.correct ? activity.points : 0) : null;

    if (courseId && enrolled) {
      const res = await submitAssignment({ courseId, blockId: block.id, response });
      setSaving(false);
      if (!res.ok) {
        onToast(res.error ?? "Gagal menyimpan jawaban.");
        return;
      }
      onToast("Jawaban terkirim ke guru.");
    } else {
      if (identity) saveSubmission({ id: `${identity.participantId}-${block.id}`, participantId: identity.participantId, participantName: identity.name, className: identity.className, blockId: block.id, blockTitle: block.title, moduleId: block.moduleId, response, score, maxScore: activity.points, submittedAt: now, status: "submitted" });
      setSaving(false);
    }
    setSubmittedAt(now);
    setSubmitted(true);
  }

  const needsResponse = activity.responseType !== "interactive" && !response.trim();
  return <div className="lesson-view"><LessonHeading icon={<Sparkles size={18} />} block={block} /><div className="activity-lesson-card"><div className="eyebrow">AKTIVITAS FPBL · {activity.templateId.replaceAll("-", " ").toUpperCase()}</div><h2>{activity.prompt}</h2><p>{activity.instructions}</p><div className="activity-evidence"><strong>Bukti yang dikumpulkan</strong><span>{activity.evidenceLabel}</span></div>{activity.responseType === "interactive" ? <div className="activity-choice-list">{(activity.choices?.length ? activity.choices : [{ label: "A", value: "Ya" }, { label: "B", value: "Tidak" }, { label: "C", value: "Belum yakin" }]).map((choice) => <button key={choice.label} className={`activity-choice ${response === choice.value ? "is-selected" : ""}`} onClick={() => setResponse(choice.value)}><strong>{choice.label}</strong><span>{choice.value}</span></button>)}</div> : activity.responseType === "upload" ? <label className="activity-upload">Pilih foto atau file bukti<input type="file" onChange={(event) => setResponse(event.target.files?.[0]?.name || "")} /></label> : <textarea className="material-textarea" value={response} onChange={(event) => setResponse(event.target.value)} placeholder={activity.responseType === "essay" ? "Tulis penjelasan dan strategi kelompokmu..." : "Tulis jawabanmu..."} />}{!submitted ? <button className="button button--primary" disabled={saving || needsResponse || (activity.responseType === "interactive" && !response)} onClick={submit}>{saving ? <Loader2 size={16} className="spin" /> : <Check size={16} />} Kirim jawaban</button> : <div className="preview-result is-good"><Check size={15} /> Jawaban terkirim pada {new Date(submittedAt).toLocaleString("id-ID")}. {activity.showScore && activity.responseType === "interactive" ? `Skor: ${activity.choices?.find((choice) => choice.value === response)?.correct ? activity.points : 0}/${activity.points}.` : "Menunggu peninjauan guru."}</div>}</div>{submitted && <CompleteButton onClick={onComplete} label="Aktivitas selesai" />}</div>;
}

function AssignmentLesson({ block, courseId, enrolled, identity, onComplete, onToast }: { block: LessonBlock; courseId: string | null; enrolled: boolean; identity: { name: string; className: string; participantId: string } | null; onComplete: () => void; onToast: (message: string) => void }) {
  const [response, setResponse] = useState("");
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoName, setPhotoName] = useState<string>("");
  const [submittedAt, setSubmittedAt] = useState("");
  const [saving, setSaving] = useState(false);

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoName(file.name);
      const reader = new FileReader();
      reader.onload = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  }

  function removePhoto() {
    setPhotoPreview(null);
    setPhotoName("");
  }

  async function submit() {
    setSaving(true);
    const now = new Date().toISOString();
    const finalPayload = photoName
      ? `${response.trim()} [Lampiran Foto Lembar Kerja: ${photoName}]`
      : response.trim();

    if (courseId && enrolled) {
      const res = await submitAssignment({ courseId, blockId: block.id, response: finalPayload });
      setSaving(false);
      if (!res.ok) {
        onToast(res.error ?? "Gagal menyimpan jawaban.");
        return;
      }
      onToast("Tugas dan foto jawaban berhasil dikirim ke guru.");
    } else {
      if (identity) saveSubmission({ id: `${identity.participantId}-${block.id}`, participantId: identity.participantId, participantName: identity.name, className: identity.className, blockId: block.id, blockTitle: block.title, moduleId: block.moduleId, response: finalPayload, score: null, maxScore: 20, submittedAt: now, status: "submitted" });
      setSaving(false);
      onToast("Tugas tersimpan secara lokal.");
    }
    setSubmittedAt(now);
  }

  return (
    <div className="lesson-view">
      <LessonHeading icon={<FileText size={18} />} block={block} />
      {block.material?.pdfUrl ? (
        <PdfViewer url={block.material.pdfUrl} fileName={block.material.fileName} />
      ) : (
        <div className="material-empty">
          <FileText size={24} />
          <strong>Soal Cerita & LKPD Mandiri</strong>
          <span>Bacalah studi kasus di bawah, kerjakan di buku tulismu, lalu unggah foto jawabanmu.</span>
        </div>
      )}
      {block.material?.text && (
        <div className="rich-material" style={{ borderLeft: "4px solid var(--teal)" }}>
          <h4 style={{ margin: "0 0 8px", fontSize: "0.95rem", color: "var(--teal)" }}>📖 Kasus Soal Cerita</h4>
          <p>{block.material.text}</p>
        </div>
      )}

      <div className="activity-lesson-card">
        <div className="eyebrow">LEMBAR KERJA & UNGGAH FOTO JAWABAN</div>
        <p style={{ margin: "4px 0 14px", fontSize: "0.82rem", color: "var(--muted)" }}>
          Tuliskan langkah perhitungan di buku tulismu. Foto lembar jawaban tersebut dan unggah di sini agar guru dapat memeriksa alur berpikirmu.
        </p>

        {/* Upload Foto Jawaban */}
        {!photoPreview ? (
          <label className="photo-upload-zone">
            <input
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={handlePhotoChange}
            />
            <div style={{ fontSize: "1.8rem" }}>📸</div>
            <strong>Klik untuk Mengunggah Foto Jawaban / Lembar Kerja</strong>
            <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Format JPG, PNG, atau tangkapan kamera HP</span>
          </label>
        ) : (
          <div style={{ margin: "10px 0" }}>
            <div className="photo-preview-wrap">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photoPreview} alt="Preview Jawaban Siswa" />
            </div>
            <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: "0.75rem", color: "var(--teal)", fontWeight: 700 }}>
                ✓ {photoName} siap dikirim
              </span>
              <button
                type="button"
                className="button button--ghost button--small"
                onClick={removePhoto}
                style={{ padding: "2px 8px", fontSize: "0.7rem" }}
              >
                Ganti Foto
              </button>
            </div>
          </div>
        )}

        <div style={{ marginTop: 14 }}>
          <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, marginBottom: 6 }}>
            Keterangan / Kesimpulan Perhitungan:
          </label>
          <textarea
            className="material-textarea"
            value={response}
            onChange={(event) => setResponse(event.target.value)}
            placeholder="Tuliskan hasil akhir dan alasan mengapa hasilnya bernilai positif/negatif..."
            rows={3}
          />
        </div>

        <button
          className="button button--primary"
          style={{ marginTop: 14 }}
          disabled={saving || (!response.trim() && !photoPreview) || Boolean(submittedAt)}
          onClick={submit}
        >
          {saving ? <Loader2 size={16} className="spin" /> : <Check size={16} />}
          {submittedAt ? "Tugas Terkirim" : "Kirim Jawaban & Foto Tugas"}
        </button>

        {submittedAt && (
          <div className="preview-result is-good" style={{ marginTop: 12 }}>
            <Check size={15} /> Tugas berhasil dikirim pada {new Date(submittedAt).toLocaleString("id-ID")}. Menunggu peninjauan guru.
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
  if (!url) return <div className="material-empty"><Video size={24} /><strong>Video belum ditambahkan</strong><span>Guru dapat memasukkan link YouTube atau Google Drive di editor blok.</span></div>;
  const embed = videoUrl ? youtubeEmbed(url) : driveEmbed(url);
  return <div className="media-frame">{embed && !embedError ? <iframe src={embed} title="Materi video" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen onError={() => setEmbedError(true)} /> : <div className="media-link-card"><Link2 size={20} /><div><strong>Video siap dibuka</strong><small>YouTube membatasi embed pada sebagian video. Buka dari link asli untuk memutar tanpa error 153.</small></div><a href={url} target="_blank" rel="noreferrer" className="button button--ghost button--small">Buka video <ExternalLink size={14} /></a></div>}</div>;
}
function youtubeEmbed(url: string) { try { const parsed = new URL(url); const id = parsed.searchParams.get("v") || parsed.pathname.split("/").filter(Boolean).pop(); if (!id) return ""; const origin = typeof window !== "undefined" ? window.location.origin : ""; return `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1&playsinline=1${origin ? `&origin=${encodeURIComponent(origin)}` : ""}`; } catch { return url.includes("youtube.com/embed") || url.includes("youtube-nocookie.com/embed") ? url : ""; } }
function driveEmbed(url: string) { return url.includes("drive.google.com") ? url.replace(/\/view.*$/, "/preview") : url; }
function PdfViewer({ url, fileName }: { url: string; fileName?: string }) { return <div className="pdf-viewer"><div className="pdf-viewer__head"><span><FileText size={17} /> {fileName || "Modul PDF"}</span><a href={url} target="_blank" rel="noreferrer" className="button button--ghost button--small"><Download size={14} /> Buka PDF</a></div><iframe src={url} title={fileName || "Modul PDF"} /></div>; }

function QuizLesson({ block, dbQuiz, courseId, enrolled, onComplete, onToast }: { block: LessonBlock; dbQuiz: DbQuiz; courseId: string | null; enrolled: boolean; onComplete: () => void; onToast: (message: string) => void }) {
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState("");
  const [score, setScore] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<{ score: number; total: number } | null>(null);
  const [saving, setSaving] = useState(false);

  // Kuis dari database: kunci jawaban tidak pernah dikirim ke browser.
  if (dbQuiz && dbQuiz.questions.length) {
    const question = dbQuiz.questions[index];
    const last = index === dbQuiz.questions.length - 1;
    const optionValue = (option: string) => option;
    async function submitDb() {
      if (!courseId || !enrolled) {
        onToast("Selesaikan di perangkat yang sudah login agar nilai tersimpan.");
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
    return <div className="lesson-view quiz-page"><div className="eyebrow">{dbQuiz.title.toUpperCase()} · {index + 1}/{dbQuiz.questions.length}</div><h2>{dbQuiz.instructions}</h2><p className="quiz-question">{question.prompt}</p><div className="quiz-options">{question.options.map((option) => <button key={option} className={`quiz-option ${selected === option ? "is-selected" : ""}`} onClick={() => { setSelected(option); setAnswers((current) => ({ ...current, [question.id]: optionValue(option) })); }}>{option}<span>{selected === option ? <Check size={15} /> : null}</span></button>)}</div>{result && <div className="quiz-feedback is-good"><Sparkles size={16} /> Nilai kamu {result.score}/{result.total}. {result.total > 0 && result.score / result.total >= 0.7 ? "Lulus!" : "Belum lulus, coba lagi pada kesempatan berikutnya."}</div>}<div className="quiz-footer"><span>{Object.keys(answers).length} jawaban tercatat</span>{last ? <button className="button button--primary button--small" disabled={!selected || saving || Boolean(result)} onClick={submitDb}>{saving ? <Loader2 size={15} className="spin" /> : <Check size={14} />} Kirim jawaban</button> : <button className="button button--primary button--small" disabled={!selected} onClick={() => { setIndex((value) => value + 1); setSelected(""); }}>Lanjut <ArrowRight size={14} /></button>}</div>{result && <div style={{ marginTop: 14 }}><CompleteButton onClick={onComplete} label="Kuis selesai" /></div>}</div>;
  }

  // Tanpa kuis di database: pakai soal contoh bawaan (demo).
  const draft = getQuizDraft(block.id);
  const questions = draft.questions.length ? draft.questions : quizQuestions.map((item) => ({ id: item.id, type: "multiple-choice" as const, prompt: item.question, options: item.options, answer: item.answer, explanation: item.explanation, points: 10 }));
  const question = questions[index];
  function choose(option: string) { if (selected) return; setSelected(option); if (option === question.answer) setScore((value) => value + question.points); }
  const done = index === questions.length - 1 && Boolean(selected);
  return <div className="lesson-view quiz-page"><div className="eyebrow">{draft.title.toUpperCase()} · {index + 1}/{questions.length}</div><h2>{draft.instructions}</h2><p className="quiz-question">{question.prompt}</p><div className="quiz-options">{question.options.map((option) => <button key={option} className={`quiz-option ${selected === option ? (option === question.answer ? "is-correct" : "is-wrong") : ""}`} onClick={() => choose(option)}>{option}<span>{selected === option ? (option === question.answer ? <Check size={15} /> : "×") : ""}</span></button>)}</div>{selected && <div className={`quiz-feedback ${selected === question.answer ? "is-good" : "is-explainer"}`}><Sparkles size={16} /> {selected === question.answer ? "Benar. " : "Belum tepat. "}{question.explanation}</div>}<div className="quiz-footer"><span>{draft.showScore ? `Skor sementara: ${score} poin` : "Jawaban tersimpan"}</span>{done ? <button className="button button--primary button--small" onClick={onComplete}>Selesai <Check size={14} /></button> : <button className="button button--primary button--small" disabled={!selected} onClick={() => { setIndex((value) => value + 1); setSelected(""); }}>{index < questions.length - 1 ? <>Lanjut <ArrowRight size={14} /></> : "Selesai"}</button>}</div></div>;
}
