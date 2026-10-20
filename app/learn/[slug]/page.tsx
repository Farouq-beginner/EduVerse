"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, BookOpen, Check, ChevronRight, ClipboardCheck, Clock3, Loader2, LogIn, LockKeyhole, RefreshCw, Sparkles, Trophy, Video } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { ProgressRing, StatusPill } from "@/components/DashboardBits";
import { Toast } from "@/components/Toast";
import { demoCourse, quizQuestions, type LessonBlock, type Module } from "@/lib/demo-data";
import { getCourseModules, getCourseState, getIdentity, getProgress, getCompleted, registerParticipant, saveIdentity, saveProgress, saveCompleted, type ParticipantIdentity } from "@/lib/storage";
import { getCourseStructure, getMyCourseProgress, getSessionProfile, type DbCourse } from "@/lib/actions/dashboards";
import { joinCourseByToken, validateJoinToken } from "@/lib/actions/enrollment";
import { markBlockComplete } from "@/lib/actions/progress";
import { toModule } from "@/lib/course";
import { NumberLineVisualizer } from "@/components/NumberLineVisualizer";
import { DiscussionForum } from "@/components/DiscussionForum";

export default function StudentLearningPage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const courseSlug = params.slug || demoCourse.slug;

  const [localIdentity, setLocalIdentity] = useState<ParticipantIdentity | null>(null);
  const [name, setName] = useState("");
  const [className, setClassName] = useState("VII-B");
  const [progress, setProgress] = useState(0);
  const [access, setAccess] = useState<"open" | "locked">("open");
  const [activeBlock, setActiveBlock] = useState<string | null>(null);
  const [quizIndex, setQuizIndex] = useState(0);
  const [quizAnswers, setQuizAnswers] = useState<Record<number, string>>({});
  const [quizFeedback, setQuizFeedback] = useState<string | null>(null);
  const [completed, setCompleted] = useState<string[]>([]);
  const [toast, setToast] = useState("");
  const [modules, setModules] = useState<Module[]>(demoCourse.modules);
  // Link yang diketik siswa — dipakai server untuk menentukan course tujuan.
  const [learningLink, setLearningLink] = useState("");
  // Info sinkron DB: course, status enrollment, dan blok yang sudah selesai.
  const [dbCourse, setDbCourse] = useState<DbCourse | null>(null);
  const [dbCourseId, setDbCourseId] = useState<string | null>(null);
  const [enrolled, setEnrolled] = useState(false);
  const [account, setAccount] = useState<{ id: string; fullName: string; className: string } | null>(null);
  const [syncedCount, setSyncedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  // Cache data DB agar load() tidak menimpa modul/progres dari server.
  const dbRef = useRef<{ modules: Module[]; completed: string[]; progress: number; enrolled: boolean } | null>(null);

  const load = useCallback(async () => {
    const db = dbRef.current;
    if (db?.modules.length) {
      setModules(db.modules);
    } else {
      setModules(getCourseModules());
    }
    // Progres milik siswa yang sudah terdaftar dibaca dari server; selain itu lokal.
    if (db?.enrolled) {
      setCompleted(db.completed);
      setProgress(db.progress);
    } else {
      setProgress(getProgress());
      setCompleted(getCompleted());
    }
    setLocalIdentity(getIdentity());
    const courseState = getCourseState();
    setAccess(courseState.access);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Muat course, enrollment, dan progres dari database.
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
          setAccess(structure.access === "LOCKED" ? "locked" : "open");
        }
        if (mine) {
          setDbCourseId(mine.courseId);
          setEnrolled(mine.enrolled);
          setCompleted(mine.completedBlockIds);
          const total = structure
            ? structure.modules.reduce((sum, m) => sum + m.blocks.length, 0)
            : 0;
          if (total > 0) setProgress(Math.round((mine.completedBlockIds.length / total) * 100));
        }
        if (profile && profile.role === "STUDENT") {
          setAccount({
            id: profile.id,
            fullName: profile.fullName,
            className: profile.className ?? "—",
          });
        }

        const dbModules = structure ? structure.modules.map(toModule) : [];
        const total = structure ? structure.modules.reduce((sum, m) => sum + m.blocks.length, 0) : 0;
        dbRef.current = {
          modules: dbModules,
          completed: mine?.completedBlockIds ?? [],
          progress: mine && total > 0 ? Math.round((mine.completedBlockIds.length / total) * 100) : 0,
          enrolled: Boolean(mine?.enrolled),
        };
      } catch {
        // Database belum aktif — mode lokal tetap berjalan.
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [courseSlug]);

  // Siswa yang login memakai akunnya; tanpa akun memakai identitas lokal.
  const identity = useMemo<ParticipantIdentity | null>(() => {
    if (account) {
      return { name: account.fullName, className: account.className, participantId: account.id };
    }
    return localIdentity;
  }, [account, localIdentity]);

  /**
   * Validasi link di server dengan aturan yang sama persis dengan join.
   * Ini sumber kebenaran tunggal — bukan sekadar string yang diketik di klien.
   */
  async function resolveLearningLink(key: string) {
    const check = await validateJoinToken(key).catch(() => null);
    if (!check || !check.valid) {
      return { error: "Link tidak valid atau sudah kedaluwarsa." } as const;
    }
    if (check.state === "DRAFT") {
      return { error: "Pembelajaran ini belum dipublikasikan." } as const;
    }
    if (check.state === "ARCHIVED") {
      return { error: "Pembelajaran ini sudah diarsipkan." } as const;
    }
    if (check.access === "LOCKED") {
      return { error: "Akses pembelajaran sedang dikunci oleh guru." } as const;
    }
    return { slug: check.slug ?? courseSlug, title: check.title } as const;
  }

  async function joinCourse(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) {
      setToast("Isi nama lengkapmu dulu, ya.");
      return;
    }
    if (getCourseState().access === "locked") {
      setToast("Pembelajaran ini sedang dikunci. Hubungi guru untuk dibuka.");
      return;
    }

    const key = learningLink.trim() || courseSlug;
    const resolved = await resolveLearningLink(key);
    if ("error" in resolved) {
      setToast(resolved.error);
      return;
    }

    // Siswa terdaftar → enrollment asli dibuat di database.
    if (account) {
      const result = await joinCourseByToken({ tokenOrSlug: key, className });
      if (!result.ok) {
        setToast(result.error ?? "Gagal bergabung.");
        return;
      }
      setEnrolled(true);
      setToast(result.already ? "Kamu sudah bergabung di pembelajaran ini." : "Berhasil bergabung! Pembelajaran muncul di dashboard.");
      if (resolved.slug !== courseSlug) router.push(`/learn/${resolved.slug}`);
      return;
    }

    // Tanpa akun → identitas lokal, progres tetap bisa berjalan di perangkat.
    const local: ParticipantIdentity = {
      name: name.trim(),
      className,
      participantId: `local-${Date.now().toString(36)}`,
    };
    saveIdentity(local);
    registerParticipant(local);
    setLocalIdentity(local);
    setToast("Berhasil masuk! Progres tersimpan di perangkatmu.");
    if (resolved.slug !== courseSlug) router.push(`/learn/${resolved.slug}`);
  }

  async function joinWithAccount() {
    const result = await joinCourseByToken({ tokenOrSlug: courseSlug, className: account?.className });
    if (!result.ok) {
      setToast(result.error ?? "Gagal bergabung.");
      return;
    }
    setEnrolled(true);
    setToast(result.already ? "Kamu sudah bergabung di pembelajaran ini." : "Berhasil bergabung!");
  }

  async function completeBlock(id: string, label: string) {
    const nextCompleted = completed.includes(id) ? completed : [...completed, id];
    setCompleted(nextCompleted);
    const totalBlocks = modules.reduce((sum, module) => sum + module.lessons.length, 0);
    const nextProgress = Math.min(100, Math.round((nextCompleted.length / Math.max(1, totalBlocks)) * 100));
    setProgress(nextProgress);
    saveProgress(nextProgress); // cache di perangkat sebagai cadangan
    setActiveBlock(null);

    // Sinkron ke database (idempoten) bila siswa login & sudah bergabung.
    if (dbCourseId && enrolled) {
      const res = await markBlockComplete({ courseId: dbCourseId, blockId: id }).catch(() => ({
        ok: false,
        error: "Gagal menyimpan ke server.",
      }));
      if (res.ok) {
        setSyncedCount((n) => n + 1);
        setToast(`${label} selesai. Tersinkron ke akun guru.`);
      } else {
        setToast(`${label} selesai. ${res.error ?? "Belum tersimpan di server."}`);
      }
      return;
    }
    setToast(`${label} selesai. Progres tersimpan di perangkat.`);
  }

  function answerQuiz(option: string) {
    const question = quizQuestions[quizIndex];
    setQuizAnswers((current) => ({ ...current, [question.id]: option }));
    setQuizFeedback(option === question.answer ? `Benar. ${question.explanation}` : `Belum tepat. ${question.explanation}`);
  }

  function nextQuiz() {
    if (quizIndex < quizQuestions.length - 1) {
      setQuizIndex((value) => value + 1);
      setQuizFeedback(null);
    } else {
      completeBlock(quizBlockId, "Kuis formatif");
      setQuizFeedback("Kuis selesai. Kamu sudah melihat pembahasan di setiap langkah.");
    }
  }

  const initials = identity?.name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase() ?? "?";
  const currentQuestion = quizQuestions[quizIndex];
  const score = Object.entries(quizAnswers).filter(([id, answer]) => quizQuestions.find((question) => question.id === Number(id))?.answer === answer).length;
  const allLessons = modules.flatMap((module) => module.lessons);
  const totalBlocks = allLessons.length;
  // Id blok dari database dipakai saat menyimpan progres (id demo tidak ada di DB).
  const reflectionBlockId = allLessons.find((lesson) => lesson.type === "reflection")?.id ?? "block-reflection";
  const quizBlockId = allLessons.find((lesson) => lesson.type === "quiz")?.id ?? "block-quiz";
  const courseTitle = dbCourse?.title ?? demoCourse.title;
  const courseSubject = dbCourse?.subject ?? demoCourse.subject;
  const courseGrade = dbCourse?.grade ?? demoCourse.grade;
  const courseDescription = dbCourse?.description ?? demoCourse.description;
  const courseDuration = dbCourse?.duration ?? demoCourse.duration;

  // Jika akses dikunci, tampilkan halaman terkunci.
  if (access === "locked") return <LockedStudentPage title={courseTitle} subject={courseSubject} grade={courseGrade} />;

  // Jika masih loading, tampilkan state loading.
  if (loading) {
    return (
      <AppShell role="student">
        <div className="student-wrap">
          <div className="empty-state">
            <Loader2 size={24} className="spin" />
            <strong>Memuat pembelajaran...</strong>
          </div>
        </div>
      </AppShell>
    );
  }

  // Jika akun terdaftar tapi belum gabung ke kursus, tampilkan halaman gabung akun.
  if (account && !enrolled && dbCourseId) {
    return <JoinAccountPage account={account} courseTitle={courseTitle} onJoin={joinWithAccount} />;
  }

  // Jika belum ada identitas, tampilkan halaman masukin nama/kelas.
  if (!identity) {
    return (
      <JoinStudentPage
        name={name}
        setName={setName}
        className={className}
        setClassName={setClassName}
        learningLink={learningLink}
        setLearningLink={setLearningLink}
        courseSlug={courseSlug}
        courseTitle={courseTitle}
        courseSubject={courseSubject}
        onSubmit={joinCourse}
      />
    );
  }

  return (
    <AppShell role="student">
      <div className="student-wrap">
        <Link href="/pilih-pembelajaran" className="back-link"><ArrowLeft size={14} /> Kembali ke pilih pembelajaran</Link>
        <div className="student-welcome">
          <div><div className="eyebrow">RUANG BELAJAR {courseSubject.toUpperCase()} · {courseGrade.toUpperCase()}</div><h1>Halo, {identity.name.split(" ")[0]}.</h1><p>Lanjutkan petualanganmu. Selesaikan satu aktivitas kecil, lalu lihat progresmu bergerak.</p></div>
          <div className="student-profile-chip"><span className="student-profile-chip__avatar">{initials}</span><div><strong>{identity.name}</strong><small>{identity.className} · Peserta</small></div></div>
        </div>
        <section className="student-hero-card"><div className="student-hero-card__copy"><div className="eyebrow">PEMBELAJARAN AKTIF</div><h2>{courseTitle}</h2><p>{courseDescription}</p><div className="student-hero-card__meta"><span className="meta-chip"><Clock3 size={13} /> {courseDuration}</span><span className="meta-chip"><RefreshCw size={13} /> Sinkronisasi aktif</span><span className="meta-chip">FPBL</span></div></div><div className="student-hero-card__ring"><ProgressRing value={progress} size="lg" /></div></section>
        <div className="student-stats"><StudentStat icon={<Check size={17} />} value={`${completed.length}/${totalBlocks}`} label="aktivitas selesai" /><StudentStat icon={<Trophy size={17} />} value={score ? `${score * 25}` : "—"} label="nilai kuis sementara" /><StudentStat icon={<Clock3 size={17} />} value="18 menit" label="waktu belajar" /></div>
        <div className="student-content-grid">
          <div>
            <div className="section-title" style={{ marginTop: 0 }}><div><div className="eyebrow">ALUR BELAJAR</div><h2>Modul untukmu</h2></div><StatusPill tone="teal">{progress}% selesai</StatusPill></div>
            {modules.map((module, moduleIndex) => <ModuleCard key={module.id} module={module} index={moduleIndex} completed={completed} courseSlug={courseSlug} />)}

            {/* Visual Garis Bilangan Interaktif */}
            <div style={{ marginTop: 24 }}>
              <NumberLineVisualizer
                title="Laboratorium Garis Bilangan Interaktif"
                description="Simulasikan penjumlahan dan pengurangan bilangan positif, negatif, dan nol secara langsung."
              />
            </div>

            {/* Forum Tanya Jawab Kelas */}
            <DiscussionForum
              currentUser={
                account
                  ? { name: account.fullName, role: "STUDENT", className: account.className }
                  : identity
                  ? { name: identity.name, role: "STUDENT", className: identity.className }
                  : null
              }
            />
          </div>
          <aside className="student-side">
            <div className="achievement-card">
              <div className="achievement-card__top"><span className="eyebrow" style={{ margin: 0, color: "var(--violet)" }}>PENCAPAIAN</span><span className="achievement-badge">✦</span></div>
              <h3>Penjelajah garis bilangan</h3>
              <p>Selesaikan 3 aktivitas lagi untuk membuka badge berikutnya.</p>
              <div className="mini-progress"><span style={{ width: `${Math.min(100, completed.length * 28)}%` }} /></div>
            </div>
            <div className="reflection-card">
              <div className="reflection-card__head"><span><Sparkles size={16} /></span><strong>Refleksi singkat</strong></div>
              <p>Strategi apa yang paling membantumu menentukan arah gerak?</p>
              <textarea placeholder="Tulis satu kalimat..." onBlur={(event) => event.currentTarget.value && setToast("Refleksimu tersimpan sebagai draft lokal.")} />
              <button className="button button--ghost button--small" style={{ marginTop: 10 }} onClick={() => completeBlock(reflectionBlockId, "Refleksi")}>Simpan refleksi</button>
            </div>
            <div className="sync-card">
              <div className="sync-card__top"><RefreshCw size={16} /><strong>{enrolled ? "Tersinkron dengan akun" : "Progres perangkat"}</strong><span className="sync-dot" /></div>
              <p>{enrolled ? `${syncedCount} aktivitas sudah dikirim ke server. Guru dapat melihat progres terbarumu.` : "Semua jawaban demo tersimpan lokal dan siap disinkronkan saat koneksi tersedia."}</p>
            </div>
          </aside>
        </div>
      </div>
      {activeBlock === "block-quiz" && <QuizModal question={currentQuestion} quizIndex={quizIndex} selected={quizAnswers[currentQuestion.id]} feedback={quizFeedback} answerQuiz={answerQuiz} nextQuiz={nextQuiz} onClose={() => setActiveBlock(null)} answerCount={Object.keys(quizAnswers).length} />}
      {activeBlock && activeBlock !== "block-quiz" && <ActivityModal block={allLessons.find((lesson) => lesson.id === activeBlock)} onClose={() => setActiveBlock(null)} onComplete={() => completeBlock(activeBlock, "Aktivitas")} />}
      {toast && <Toast message={toast} onClose={() => setToast("")} />}
    </AppShell>
  );
}

function LockedStudentPage({ title, subject, grade }: { title: string; subject: string; grade: string }) {
  return <AppShell role="student"><div className="student-wrap"><Link href="/pilih-pembelajaran" className="back-link"><ArrowLeft size={14} /> Kembali ke pilih pembelajaran</Link><div className="locked-card"><div className="locked-card__icon"><LockKeyhole size={34} /></div><div className="eyebrow">AKSES SEDANG DITUTUP</div><h1>Ruang belajar ini sedang dikunci.</h1><p>Guru menutup akses peserta baru untuk sementara. Coba kembali lagi saat kelas sudah dibuka.</p><div className="locked-card__course"><span className="course-art">−2</span><div><strong>{title}</strong><small>{subject} · {grade}</small></div></div><Link href="/pilih-pembelajaran" className="button button--ghost"><ArrowLeft size={16} /> Kembali ke pilih pembelajaran</Link></div></div></AppShell>;
}

function JoinAccountPage({ account, courseTitle, onJoin }: { account: { fullName: string; className: string }; courseTitle: string; onJoin: () => void }) {
  return (
    <AppShell role="student">
      <div className="student-join">
        <div className="student-join__visual">
          <div className="eyebrow eyebrow--light">AKUN SISWA</div>
          <h1>Halo, {account.fullName.split(" ")[0]}.</h1>
          <p>Kamu login dengan akun {account.className}. Gabungkan dulu ke pembelajaran ini agar progresmu tersimpan di server dan terlihat guru.</p>
          <div className="join-orbit">
            <span className="join-orbit__number">−2</span>
            <span className="join-orbit__plus">+5</span>
            <span className="join-orbit__zero">0</span>
          </div>
          <span className="join-caption"><Sparkles size={14} /> Progres tersimpan di akunmu</span>
        </div>
        <div className="student-join__form">
          <Link href="/pilih-pembelajaran" className="back-link"><ArrowLeft size={14} /> Kembali ke pilih pembelajaran</Link>
          <div className="eyebrow" style={{ marginTop: 26 }}>GABUNG PEMBELAJARAN</div>
          <h2>{courseTitle}</h2>
          <p className="join-copy">Satu klik untuk bergabung. Tidak perlu email atau password lagi.</p>
          <button className="button button--primary" style={{ width: "100%", marginTop: 21 }} onClick={onJoin}>
            <LogIn size={16} /> Gabungkan ke pembelajaran
          </button>
          <div className="privacy-note"><LockKeyhole size={14} /> Enrollment, progres, dan jawaban tersimpan di server.</div>
        </div>
      </div>
    </AppShell>
  );
}

function JoinStudentPage({ name, setName, className, setClassName, learningLink, setLearningLink, courseSlug, courseTitle, courseSubject, onSubmit }: { name: string; setName: (value: string) => void; className: string; setClassName: (value: string) => void; learningLink: string; setLearningLink: (value: string) => void; courseSlug: string; courseTitle: string; courseSubject: string; onSubmit: (event: React.FormEvent) => void }) {
  return <AppShell role="student"><div className="student-join"><div className="student-join__visual"><div className="eyebrow eyebrow--light">LINK PEMBELAJARAN · {courseSubject.toUpperCase()}</div><h1>Siap menjelajah bilangan bulat?</h1><p>Masuk dengan nama dan kelasmu. Tidak perlu email atau password.</p><div className="join-orbit"><span className="join-orbit__number">−2</span><span className="join-orbit__plus">+5</span><span className="join-orbit__zero">0</span></div><span className="join-caption"><Sparkles size={14} /> Progres tersimpan di perangkatmu</span></div><form className="student-join__form" onSubmit={onSubmit}><Link href="/pilih-pembelajaran" className="back-link"><ArrowLeft size={14} /> Kembali ke pilih pembelajaran</Link><div className="eyebrow" style={{ marginTop: 26 }}>MULAI PEMBELAJARAN</div><h2>{courseTitle}</h2><p className="join-copy">Isi identitas sederhana agar guru bisa melihat progresmu di kelas.</p><div className="field"><label>Nama lengkap</label><input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="Contoh: Alya Pramesti" /></div><div className="field" style={{ marginTop: 14 }}><label>Kelas</label><select value={className} onChange={(event) => setClassName(event.target.value)}><option>VII-A</option><option>VII-B</option><option>VII-C</option></select></div><div className="field" style={{ marginTop: 14 }}><label>Link pembelajaran</label><input value={learningLink || `/learn/${courseSlug}`} onChange={(event) => setLearningLink(event.target.value)} placeholder="Contoh: /learn/operasi-bilangan-bulat" /></div><button className="button button--primary" style={{ width: "100%", marginTop: 21 }} type="submit">Masuk ke ruang belajar <ArrowRight size={16} /></button><div className="privacy-note"><LockKeyhole size={14} /> Nama, kelas, dan link digunakan untuk menghubungkan progres ke pembelajaran ini.</div></form></div></AppShell>;
}

function ModuleCard({ module, index, completed, courseSlug }: { module: Module; index: number; completed: string[]; courseSlug: string }) {
  const [page, setPage] = useState(0);
  const pageSize = Math.max(1, Math.ceil(module.lessons.length / 3));
  const pageCount = Math.max(1, Math.ceil(module.lessons.length / pageSize));
  const visibleLessons = module.lessons.slice(page * pageSize, page * pageSize + pageSize);
  return <div className={`module-card module-card--${module.accent}`}><div className="module-card__head"><span className="module-card__number">0{index + 1}</span><div><strong>{module.title}</strong><small>{module.eyebrow}</small></div><Link href={`/learn/${courseSlug}/modul/${module.id}`} className="module-open-link">Buka modul <ChevronRight size={14} /></Link></div><div className="lesson-list">{visibleLessons.map((lesson) => <LessonButton key={lesson.id} lesson={lesson} isDone={completed.includes(lesson.id)} href={`/learn/${courseSlug}/modul/${module.id}?lesson=${lesson.id}`} />)}</div>{pageCount > 1 && <div className="module-pagination"><button className="icon-button icon-button--tiny" disabled={page === 0} onClick={() => setPage((current) => Math.max(0, current - 1))} aria-label="Materi sebelumnya"><ArrowLeft size={14} /></button><span>Materi {page * pageSize + 1}–{Math.min(module.lessons.length, page * pageSize + pageSize)} dari {module.lessons.length}</span><button className="icon-button icon-button--tiny" disabled={page === pageCount - 1} onClick={() => setPage((current) => Math.min(pageCount - 1, current + 1))} aria-label="Materi berikutnya"><ArrowRight size={14} /></button></div>}</div>;
}

function LessonButton({ lesson, isDone, href }: { lesson: LessonBlock; isDone: boolean; href: string }) {
  const Icon = lesson.type === "video" ? Video : lesson.type === "quiz" ? ClipboardCheck : lesson.type === "reflection" ? Sparkles : BookOpen;
  const isDisabled = !isDone;
  return (
    <Link
      href={href}
      className="lesson-item"
      style={{ pointerEvents: isDisabled ? "none" : "auto", cursor: isDisabled ? "default" : "pointer" }}
    >
      <span className="lesson-item__icon"><Icon size={14} /></span>
      <strong>{lesson.title}</strong>
      <small>{lesson.duration}</small>
      <span className={`lesson-item__status ${lesson.status === "new" ? "is-new" : ""}`}>{isDone ? <Check size={14} /> : <ChevronRight size={15} />}</span>
    </Link>
  );
}

function StudentStat({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return <div className="student-stat"><span className="student-stat__icon">{icon}</span><div><strong>{value}</strong><small>{label}</small></div></div>;
}

function QuizModal({ question, quizIndex, selected, feedback, answerQuiz, nextQuiz, onClose, answerCount }: { question: (typeof quizQuestions)[number]; quizIndex: number; selected?: string; feedback: string | null; answerQuiz: (option: string) => void; nextQuiz: () => void; onClose: () => void; answerCount: number }) {
  const isCorrect = selected === question.answer;
  return <div className="modal-backdrop" onClick={onClose}><div className="modal-card quiz-modal" onClick={(event) => event.stopPropagation()}><div className="modal-card__head"><div><div className="eyebrow">KUIS FORMATIF · SOAL {quizIndex + 1}/{quizQuestions.length}</div><h2>Uji strategimu</h2></div><button className="icon-button" onClick={onClose} aria-label="Tutup">×</button></div><p className="quiz-question">{question.question}</p><div className="quiz-options">{question.options.map((option) => <button key={option} className={`quiz-option ${selected === option ? (isCorrect ? "is-correct" : "is-wrong") : ""}`} onClick={() => answerQuiz(option)}>{option}<span>{selected === option && (isCorrect ? <Check size={15} /> : "×")}</span></button>)}</div>{feedback && <div className={`quiz-feedback ${isCorrect ? "is-good" : "is-explainer"}`}><Sparkles size={16} /><span>{feedback}</span></div>}<div className="quiz-footer"><span>{answerCount} jawaban tersimpan</span><button className="button button--primary button--small" onClick={nextQuiz}>{quizIndex < quizQuestions.length - 1 ? <>Lanjut <ArrowRight size={14} /></> : <>Selesai <Trophy size={14} /></>}</button></div></div></div>;
}

function ActivityModal({ block, onClose, onComplete }: { block?: LessonBlock; onClose: () => void; onComplete: () => void }) {
  return <div className="modal-backdrop" onClick={onClose}><div className="modal-card" onClick={(event) => event.stopPropagation()}><div className="modal-card__head"><div><div className="eyebrow">AKTIVITAS BELAJAR</div><h2>{block?.title ?? "Aktivitas"}</h2></div><button className="icon-button" onClick={onClose} aria-label="Tutup">×</button></div><div className="activity-detail"><span className="activity-detail__art">{block?.type === "game" ? "↔" : block?.type === "video" ? "▶" : "✦"}</span><p>{block?.description}</p><div className="number-line-demo"><span>-5</span><i /><span>0</span><i /><span>5</span></div></div><button className="button button--primary" style={{ width: "100%" }} onClick={onComplete}>Tandai selesai <Check size={16} /></button></div></div>;
}
