"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  FileText,
  Gamepad2,
  Loader2,
  LockKeyhole,
  LogIn,
  MessageCircle,
  RefreshCw,
  Sparkles,
  Trophy,
  Video,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { ProgressRing, StatusPill } from "@/components/DashboardBits";
import { Toast } from "@/components/Toast";
import type { LessonBlock, Module } from "@/lib/demo-data";
import {
  getCompleted,
  getIdentity,
  getProgress,
  registerParticipant,
  saveCompleted,
  saveIdentity,
  saveProgress,
  type ParticipantIdentity,
} from "@/lib/storage";
import { getCourseStructure, getMyCourseProgress, getSessionProfile, type DbCourse } from "@/lib/actions/dashboards";
import { joinCourseByToken, validateJoinToken } from "@/lib/actions/enrollment";
import { markBlockComplete, syncBlockCompletions } from "@/lib/actions/progress";
import { toModule } from "@/lib/course";

export default function StudentLearningPage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const courseSlug = params.slug;

  const [localIdentity, setLocalIdentity] = useState<ParticipantIdentity | null>(null);
  const [account, setAccount] = useState<{ id: string; fullName: string; className: string } | null>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [dbCourse, setDbCourse] = useState<DbCourse | null>(null);
  const [dbCourseId, setDbCourseId] = useState<string | null>(null);
  const [enrolled, setEnrolled] = useState(false);
  const [completed, setCompleted] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [name, setName] = useState("");
  const [className, setClassName] = useState("VII-B");
  const [learningLink, setLearningLink] = useState("");
  const [toast, setToast] = useState("");
  const [joining, setJoining] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const totalBlocks = useMemo(
    () => modules.reduce((sum, module) => sum + module.lessons.length, 0),
    [modules]
  );
  const progress = totalBlocks > 0 ? Math.min(100, Math.round((completed.length / totalBlocks) * 100)) : 0;

  // Muat struktur course, enrollment, dan progres dari database.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const structure = await getCourseStructure(courseSlug);
        if (!active) return;
        if (!structure) {
          setNotFound(true);
          return;
        }
        setDbCourse(structure);
        setModules(structure.modules.map(toModule));

        const [mine, profile] = await Promise.all([getMyCourseProgress(courseSlug), getSessionProfile()]);
        if (!active) return;

        if (profile && profile.role === "STUDENT") {
          setAccount({
            id: profile.id,
            fullName: profile.fullName,
            className: profile.className ?? "—",
          });
        }
        setLocalIdentity(getIdentity());

        if (mine) {
          setDbCourseId(mine.courseId);
          setEnrolled(mine.enrolled);
          const localCompleted = getCompleted();
          const merged = Array.from(new Set([...mine.completedBlockIds, ...localCompleted]));
          setCompleted(merged);

          // Progres yang sempat tersimpan di perangkat dipindahkan ke database.
          const pending = localCompleted.filter((id) => !mine.completedBlockIds.includes(id));
          if (mine.enrolled && pending.length > 0) {
            setSyncing(true);
            const result = await syncBlockCompletions({ courseId: mine.courseId, blockIds: pending });
            if (active) {
              setSyncing(false);
              if (result.ok) setToast(`${result.saved} progres perangkat tersinkron ke database.`);
            }
          }
          saveCompleted(merged);
          if (totalBlocks > 0) {
            saveProgress(Math.round((merged.length / totalBlocks) * 100));
          }
        } else {
          setCompleted(getCompleted());
          saveProgress(getProgress());
        }
      } catch {
        // Biarkan halaman menampilkan state kosong yang jujur, bukan data demo.
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
    // totalBlocks sengaja tidak menjadi dependency agar tidak memicu reload berulang.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseSlug]);

  // Siswa yang login memakai akunnya; tanpa akun memakai identitas lokal.
  const identity = useMemo<ParticipantIdentity | null>(() => {
    if (account) return { name: account.fullName, className: account.className, participantId: account.id };
    return localIdentity;
  }, [account, localIdentity]);

  const initials =
    identity?.name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() ?? "?";

  async function joinCourse(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) {
      setToast("Isi nama lengkapmu dulu, ya.");
      return;
    }
    if (joining) return;
    setJoining(true);

    const key = learningLink.trim() || courseSlug;
    const check = await validateJoinToken(key).catch(() => null);
    if (!check || !check.valid) {
      setJoining(false);
      setToast("Link tidak valid atau sudah kedaluwarsa.");
      return;
    }
    if (check.state !== "PUBLISHED") {
      setJoining(false);
      setToast("Pembelajaran ini belum dipublikasikan.");
      return;
    }
    if (check.access === "LOCKED") {
      setJoining(false);
      setToast("Akses pembelajaran sedang dikunci oleh guru.");
      return;
    }

    if (account) {
      const result = await joinCourseByToken({ tokenOrSlug: key, className });
      setJoining(false);
      if (!result.ok) {
        setToast(result.error ?? "Gagal bergabung.");
        return;
      }
      setEnrolled(true);
      setToast(result.already ? "Kamu sudah bergabung di pembelajaran ini." : "Berhasil bergabung! Progresmu tersimpan di akun.");
      if (check.slug && check.slug !== courseSlug) router.push(`/learn/${check.slug}`);
      return;
    }

    const local: ParticipantIdentity = {
      name: name.trim(),
      className,
      participantId: `local-${Date.now().toString(36)}`,
    };
    saveIdentity(local);
    registerParticipant(local);
    setLocalIdentity(local);
    setJoining(false);
    setToast("Berhasil masuk. Progres tersimpan di perangkat ini.");
    if (check.slug && check.slug !== courseSlug) router.push(`/learn/${check.slug}`);
  }

  async function joinWithAccount() {
    const result = await joinCourseByToken({ tokenOrSlug: courseSlug, className: account?.className });
    if (!result.ok) {
      setToast(result.error ?? "Gagal bergabung.");
      return;
    }
    setEnrolled(true);
    setToast(result.already ? "Kamu sudah bergabung di pembelajaran ini." : "Berhasil bergabung! Progresmu tersimpan di akun.");
  }

  const completeBlock = useCallback(
    async (id: string, label: string) => {
      const nextCompleted = completed.includes(id) ? completed : [...completed, id];
      setCompleted(nextCompleted);
      saveCompleted(nextCompleted);
      const nextProgress = Math.min(100, Math.round((nextCompleted.length / Math.max(1, totalBlocks)) * 100));
      saveProgress(nextProgress);

      if (dbCourseId && enrolled && account) {
        const res = await markBlockComplete({ courseId: dbCourseId, blockId: id }).catch(() => ({
          ok: false,
          error: "Gagal menyimpan ke server.",
        }));
        setToast(res.ok ? `${label} selesai. Progres tersimpan di database.` : `${label} selesai. ${res.error ?? "Belum tersimpan di server."}`);
        return;
      }
      setToast(`${label} selesai. Progres tersimpan di perangkat.`);
    },
    [account, completed, dbCourseId, enrolled, totalBlocks]
  );

  const courseTitle = dbCourse?.title ?? "";
  const courseSubject = dbCourse?.subject ?? "";
  const courseGrade = dbCourse?.grade ?? "";
  const courseDescription = dbCourse?.description ?? "";
  const courseDuration = dbCourse?.duration ?? "";

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

  if (notFound || !dbCourse) {
    return (
      <AppShell role="student">
        <div className="student-wrap">
          <Link href="/pilih-pembelajaran" className="back-link">
            <ArrowLeft size={14} /> Kembali ke pilih pembelajaran
          </Link>
          <div className="empty-state-card" style={{ marginTop: 20 }}>
            <FileText size={28} />
            <h1>Pembelajaran tidak ditemukan</h1>
            <p>Link ini tidak tersedia atau pembelajaran belum dipublikasikan oleh guru.</p>
            <Link href="/pilih-pembelajaran" className="button button--primary">
              Lihat pembelajaran lain
            </Link>
          </div>
        </div>
      </AppShell>
    );
  }

  if (dbCourse.access === "LOCKED") return <LockedStudentPage title={courseTitle} subject={courseSubject} grade={courseGrade} />;

  if (account && !enrolled && dbCourseId) {
    return <JoinAccountPage account={account} courseTitle={courseTitle} onJoin={joinWithAccount} />;
  }

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
        joining={joining}
        onSubmit={joinCourse}
      />
    );
  }

  return (
    <AppShell role="student">
      <div className="student-wrap">
        <Link href="/pilih-pembelajaran" className="back-link">
          <ArrowLeft size={14} /> Kembali ke pilih pembelajaran
        </Link>
        <div className="student-welcome">
          <div>
            <div className="eyebrow">
              RUANG BELAJAR {courseSubject.toUpperCase()} · {courseGrade.toUpperCase()}
            </div>
            <h1>Halo, {identity.name.split(" ")[0]}.</h1>
            <p>Lanjutkan petualanganmu. Progres disimpan di database dan terlihat oleh guru.</p>
          </div>
          <div className="student-profile-chip">
            <span className="student-profile-chip__avatar">{initials}</span>
            <div>
              <strong>{identity.name}</strong>
              <small>
                {identity.className} · {account ? "Peserta" : "Tamu"}
              </small>
            </div>
          </div>
        </div>

        <section className="student-hero-card">
          <div className="student-hero-card__copy">
            <div className="eyebrow">PEMBELAJARAN AKTIF</div>
            <h2>{courseTitle}</h2>
            <p>{courseDescription}</p>
            <div className="student-hero-card__meta">
              <span className="meta-chip">
                <Clock3 size={13} /> {courseDuration}
              </span>
              <span className="meta-chip">
                <RefreshCw size={13} /> {account ? "Tersinkron ke akun" : "Progres perangkat"}
              </span>
              <span className="meta-chip">{modules.length} modul</span>
            </div>
          </div>
          <div className="student-hero-card__ring">
            <ProgressRing value={progress} size="lg" />
          </div>
        </section>

        {syncing && (
          <div className="sync-banner">
            <Loader2 size={16} className="spin" /> Memindahkan progres perangkat ke database...
          </div>
        )}

        <div className="student-stats">
          <StudentStat icon={<Check size={17} />} value={`${completed.length}/${totalBlocks}`} label="aktivitas selesai" />
          <StudentStat icon={<Trophy size={17} />} value={`${progress}%`} label="progres pembelajaran" />
          <StudentStat icon={<MessageCircle size={17} />} value={String(modules.length)} label="forum modul tersedia" />
        </div>

        <div className="student-content-grid">
          <div>
            <div className="section-title" style={{ marginTop: 0 }}>
              <div>
                <div className="eyebrow">ALUR BELAJAR</div>
                <h2>Modul untukmu</h2>
              </div>
              <StatusPill tone="teal">{progress}% selesai</StatusPill>
            </div>
            {modules.length === 0 ? (
              <div className="empty-state-card">
                <BookOpen size={24} />
                <h2>Modul belum tersedia</h2>
                <p>Guru belum menambahkan modul ke pembelajaran ini.</p>
              </div>
            ) : (
              modules.map((module, moduleIndex) => (
                <ModuleCard key={module.id} module={module} index={moduleIndex} completed={completed} courseSlug={courseSlug} />
              ))
            )}
          </div>

          <aside className="student-side">
            <div className="achievement-card">
              <div className="achievement-card__top">
                <span className="eyebrow" style={{ margin: 0, color: "var(--violet)" }}>
                  PENCAPAIAN
                </span>
                <span className="achievement-badge">✦</span>
              </div>
              <h3>Penjelajah materi</h3>
              <p>
                {completed.length >= totalBlocks && totalBlocks > 0
                  ? "Semua aktivitas selesai. Kerja bagus!"
                  : `Selesaikan ${Math.max(0, totalBlocks - completed.length)} aktivitas lagi untuk menuntaskan pembelajaran.`}
              </p>
              <div className="mini-progress">
                <span style={{ width: `${progress}%` }} />
              </div>
            </div>
            <div className="sync-card">
              <div className="sync-card__top">
                <RefreshCw size={16} />
                <strong>{account ? "Tersinkron dengan akun" : "Progres perangkat"}</strong>
                <span className="sync-dot" />
              </div>
              <p>
                {account
                  ? "Setiap aktivitas yang selesai dikirim ke database. Login dari perangkat lain memuat progres yang sama."
                  : "Kamu masuk sebagai tamu. Progres tersimpan di perangkat ini; login sebagai siswa agar tersimpan di akun."}
              </p>
            </div>
          </aside>
        </div>
      </div>
      {toast && <Toast message={toast} onClose={() => setToast("")} />}
    </AppShell>
  );
}

function LockedStudentPage({ title, subject, grade }: { title: string; subject: string; grade: string }) {
  return (
    <AppShell role="student">
      <div className="student-wrap">
        <Link href="/pilih-pembelajaran" className="back-link">
          <ArrowLeft size={14} /> Kembali ke pilih pembelajaran
        </Link>
        <div className="locked-card">
          <div className="locked-card__icon">
            <LockKeyhole size={34} />
          </div>
          <div className="eyebrow">AKSES SEDANG DITUTUP</div>
          <h1>Ruang belajar ini sedang dikunci.</h1>
          <p>Guru menutup akses peserta baru untuk sementara. Coba kembali lagi saat kelas sudah dibuka.</p>
          <div className="locked-card__course">
            <span className="course-art">−2</span>
            <div>
              <strong>{title}</strong>
              <small>
                {subject} · {grade}
              </small>
            </div>
          </div>
          <Link href="/pilih-pembelajaran" className="button button--ghost">
            <ArrowLeft size={16} /> Kembali ke pilih pembelajaran
          </Link>
        </div>
      </div>
    </AppShell>
  );
}

function JoinAccountPage({ account, courseTitle, onJoin }: { account: { fullName: string; className: string }; courseTitle: string; onJoin: () => void }) {
  return (
    <AppShell role="student">
      <div className="student-join">
        <div className="student-join__visual">
          <div className="eyebrow eyebrow--light">AKUN SISWA</div>
          <h1>Halo, {account.fullName.split(" ")[0]}.</h1>
          <p>Kamu login dengan akun {account.className}. Gabungkan dulu ke pembelajaran ini agar progresmu tersimpan di database.</p>
          <div className="join-orbit">
            <span className="join-orbit__number">−2</span>
            <span className="join-orbit__plus">+5</span>
            <span className="join-orbit__zero">0</span>
          </div>
          <span className="join-caption">
            <Sparkles size={14} /> Progres tersimpan di akunmu
          </span>
        </div>
        <div className="student-join__form">
          <Link href="/pilih-pembelajaran" className="back-link">
            <ArrowLeft size={14} /> Kembali ke pilih pembelajaran
          </Link>
          <div className="eyebrow" style={{ marginTop: 26 }}>
            GABUNG PEMBELAJARAN
          </div>
          <h2>{courseTitle}</h2>
          <p className="join-copy">Satu klik untuk bergabung. Tidak perlu email atau password lagi.</p>
          <button className="button button--primary" style={{ width: "100%", marginTop: 21 }} onClick={onJoin}>
            <LogIn size={16} /> Gabungkan ke pembelajaran
          </button>
          <div className="privacy-note">
            <LockKeyhole size={14} /> Enrollment, progres, dan jawaban tersimpan di database.
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function JoinStudentPage({
  name,
  setName,
  className,
  setClassName,
  learningLink,
  setLearningLink,
  courseSlug,
  courseTitle,
  courseSubject,
  joining,
  onSubmit,
}: {
  name: string;
  setName: (value: string) => void;
  className: string;
  setClassName: (value: string) => void;
  learningLink: string;
  setLearningLink: (value: string) => void;
  courseSlug: string;
  courseTitle: string;
  courseSubject: string;
  joining: boolean;
  onSubmit: (event: React.FormEvent) => void;
}) {
  return (
    <AppShell role="student">
      <div className="student-join">
        <div className="student-join__visual">
          <div className="eyebrow eyebrow--light">LINK PEMBELAJARAN · {courseSubject.toUpperCase()}</div>
          <h1>Masuk ke ruang belajar.</h1>
          <p>Masuk dengan nama dan kelasmu. Tidak perlu email atau password.</p>
          <div className="join-orbit">
            <span className="join-orbit__number">−2</span>
            <span className="join-orbit__plus">+5</span>
            <span className="join-orbit__zero">0</span>
          </div>
          <span className="join-caption">
            <Sparkles size={14} /> Progres tersimpan di perangkat atau akun
          </span>
        </div>
        <form className="student-join__form" onSubmit={onSubmit}>
          <Link href="/pilih-pembelajaran" className="back-link">
            <ArrowLeft size={14} /> Kembali ke pilih pembelajaran
          </Link>
          <div className="eyebrow" style={{ marginTop: 26 }}>
            MULAI PEMBELAJARAN
          </div>
          <h2>{courseTitle}</h2>
          <p className="join-copy">Isi identitas sederhana agar guru bisa melihat progresmu di kelas.</p>
          <div className="field">
            <label>Nama lengkap</label>
            <input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="Contoh: Alya Pramesti" />
          </div>
          <div className="field" style={{ marginTop: 14 }}>
            <label>Kelas</label>
            <select value={className} onChange={(event) => setClassName(event.target.value)}>
              <option>VII-A</option>
              <option>VII-B</option>
              <option>VII-C</option>
            </select>
          </div>
          <div className="field" style={{ marginTop: 14 }}>
            <label>Link pembelajaran</label>
            <input
              value={learningLink || `/learn/${courseSlug}`}
              onChange={(event) => setLearningLink(event.target.value)}
              placeholder="Contoh: /learn/operasi-bilangan-bulat"
            />
          </div>
          <button className="button button--primary" style={{ width: "100%", marginTop: 21 }} type="submit" disabled={joining}>
            {joining ? <Loader2 size={16} className="spin" /> : <ArrowRight size={16} />} Masuk ke ruang belajar
          </button>
          <div className="privacy-note">
            <LockKeyhole size={14} /> Login sebagai siswa agar progres dan jawaban tersimpan di database.
          </div>
        </form>
      </div>
    </AppShell>
  );
}

function ModuleCard({ module, index, completed, courseSlug }: { module: Module; index: number; completed: string[]; courseSlug: string }) {
  const [page, setPage] = useState(0);
  const pageSize = Math.max(1, Math.ceil(module.lessons.length / 3));
  const pageCount = Math.max(1, Math.ceil(module.lessons.length / pageSize));
  const visibleLessons = module.lessons.slice(page * pageSize, page * pageSize + pageSize);
  const doneCount = module.lessons.filter((lesson) => completed.includes(lesson.id)).length;

  return (
    <div className={`module-card module-card--${module.accent}`}>
      <div className="module-card__head">
        <span className="module-card__number">{String(index + 1).padStart(2, "0")}</span>
        <div>
          <strong>{module.title}</strong>
          <small>
            {module.eyebrow} · {module.duration || "10 menit"} · {doneCount}/{module.lessons.length} selesai
          </small>
        </div>
        <Link href={`/learn/${courseSlug}/modul/${module.id}`} className="module-open-link">
          Buka modul <ChevronRight size={14} />
        </Link>
      </div>
      <div className="lesson-list">
        {visibleLessons.map((lesson) => (
          <LessonButton
            key={lesson.id}
            lesson={lesson}
            isDone={completed.includes(lesson.id)}
            href={`/learn/${courseSlug}/modul/${module.id}?lesson=${lesson.id}`}
          />
        ))}
        {module.lessons.length === 0 && (
          <div className="empty-state" style={{ padding: "18px" }}>
            <FileText size={18} />
            <strong>Belum ada materi</strong>
          </div>
        )}
      </div>
      {pageCount > 1 && (
        <div className="module-pagination">
          <button className="icon-button icon-button--tiny" disabled={page === 0} onClick={() => setPage((current) => Math.max(0, current - 1))} aria-label="Materi sebelumnya">
            <ArrowLeft size={14} />
          </button>
          <span>
            Materi {page * pageSize + 1}–{Math.min(module.lessons.length, page * pageSize + pageSize)} dari {module.lessons.length}
          </span>
          <button
            className="icon-button icon-button--tiny"
            disabled={page === pageCount - 1}
            onClick={() => setPage((current) => Math.min(pageCount - 1, current + 1))}
            aria-label="Materi berikutnya"
          >
            <ArrowRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

function LessonButton({ lesson, isDone, href }: { lesson: LessonBlock; isDone: boolean; href: string }) {
  const Icon = lesson.type === "video" ? Video : lesson.type === "quiz" ? ClipboardCheck : lesson.type === "game" ? Gamepad2 : lesson.type === "reflection" ? Sparkles : BookOpen;
  return (
    <Link href={href} className="lesson-item">
      <span className="lesson-item__icon">
        <Icon size={14} />
      </span>
      <strong>{lesson.title}</strong>
      <small>{lesson.duration}</small>
      <span className={`lesson-item__status ${lesson.status === "new" ? "is-new" : ""}`}>{isDone ? <Check size={14} /> : <ChevronRight size={15} />}</span>
    </Link>
  );
}

function StudentStat({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div className="student-stat">
      <span className="student-stat__icon">{icon}</span>
      <div>
        <strong>{value}</strong>
        <small>{label}</small>
      </div>
    </div>
  );
}
