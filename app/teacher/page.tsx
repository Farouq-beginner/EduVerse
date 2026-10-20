"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, BookOpen, ChevronRight, Download, ExternalLink, Gamepad2, MoreHorizontal, Plus, Search, Sparkles, Video, ClipboardCheck, FileText, MessageCircle, UserRound, LogOut } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { ChartBars, MetricCard, SectionTitle, StatusPill } from "@/components/DashboardBits";
import { Toast } from "@/components/Toast";
import { activityFeed, demoCourse, seedParticipants, type Participant, type StudentSubmission } from "@/lib/demo-data";
import { getCourseModules, getCourseState, getSubmissions, getParticipants, saveCourseState } from "@/lib/storage";
import {
  getCourseAnalytics,
  getCourseParticipants,
  getCourseStructure,
  getCourseSubmissions,
  getSessionProfile,
  getTeacherCourseActivity,
  getTeacherCourseIdBySlug,
  getTeacherStats,
  updateCourseSettings,
  type ModuleAnalyticsRow,
  type TeacherActivityRow,
} from "@/lib/actions/dashboards";
import { toModule } from "@/lib/course";

const blockIcons = { video: Video, text: FileText, activity: Sparkles, quiz: ClipboardCheck, assignment: BookOpen, game: Gamepad2, reflection: MessageCircle };

export default function TeacherDashboardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [access, setAccess] = useState<"open" | "locked">("open");
  const [state, setState] = useState<"draft" | "published">("published");
  const [toast, setToast] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [tab, setTab] = useState<"overview" | "participants" | "analytics">("overview");
  const [participants, setParticipants] = useState<Participant[]>(seedParticipants);
  const [search, setSearch] = useState("");
  const [selectedParticipant, setSelectedParticipant] = useState<Participant | null>(null);
  const [submissions, setSubmissions] = useState<StudentSubmission[]>([]);
  const [dbSubmissions, setDbSubmissions] = useState<Array<{ id: string; studentId: string; studentName: string; blockId: string; blockTitle: string; response: string; score: number | null; maxScore: number; status: string; submittedAt: string }>>([]);
  const [modules, setModules] = useState(demoCourse.modules);
  const [completed, setCompleted] = useState<string[]>([]);
  const [activityRows, setActivityRows] = useState<TeacherActivityRow[]>([]);
  const [analytics, setAnalytics] = useState<{ rows: ModuleAnalyticsRow[]; needsReview: number; topQuiz: string | null } | null>(null);
  const [teacherName, setTeacherName] = useState("");
  // true bila data peserta/statistik berasal dari database (sinkron), bukan demo.
  const [fromDb, setFromDb] = useState(false);
  const [dbStats, setDbStats] = useState<{
    uniqueStudents: number;
    enrollCount: number;
    completedActivities: number;
    avgScore: number;
    avgProgress: number;
  } | null>(null);

  useEffect(() => {
    const saved = getCourseState();
    setAccess(saved.access);
    setState(saved.state);
    setSubmissions(getSubmissions());
    setModules(getCourseModules());
  }, []);

  // Muat peserta, statistik, aktivitas & analitik dari database bila tersedia.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [courseId, profile] = await Promise.all([
          getTeacherCourseIdBySlug(demoCourse.slug),
          getSessionProfile(),
        ]);
        if (profile?.role === "TEACHER") setTeacherName(profile.fullName);
        if (!courseId) return; // belum login / belum ada course di DB → tetap demo

        const [structure, participantsRes, stats, activity, analyticsRes, submissionsRes] = await Promise.all([
          getCourseStructure(demoCourse.slug, { teacherOnly: true }),
          getCourseParticipants(courseId),
          getTeacherStats(),
          getTeacherCourseActivity(courseId),
          getCourseAnalytics(courseId),
          getCourseSubmissions(courseId),
        ]);

        if (!active) return;

        if (structure) {
          setModules(structure.modules.map(toModule));
          setAccess(structure.access === "LOCKED" ? "locked" : "open");
          setState(structure.state === "PUBLISHED" ? "published" : "draft");
        }
        if (participantsRes.ok && participantsRes.rows) {
          setParticipants(
            participantsRes.rows.map((r) => ({
              id: r.id,
              name: r.name,
              className: r.className,
              progress: r.progress,
              score: r.score ?? 0,
              status: r.status,
              lastActive: r.lastActive,
              activities: r.activities,
            }))
          );
          setFromDb(true);
        }
        setDbSubmissions(submissionsRes);
        setActivityRows(activity);
        if (analyticsRes) setAnalytics(analyticsRes);
        if (stats) setDbStats(stats);
      } catch {
        // DB belum aktif — pertahankan data demo.
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const nextTab = searchParams.get("tab");
    setTab(nextTab === "participants" || nextTab === "analytics" ? nextTab : "overview");
  }, [searchParams]);

  function navigateTab(nextTab: "overview" | "participants" | "analytics") {
    setTab(nextTab);
    router.replace(nextTab === "overview" ? "/teacher" : `/teacher?tab=${nextTab}`, { scroll: false });
  }

  async function updateAccess() {
    const next = access === "open" ? "locked" : "open";
    setAccess(next);
    saveCourseState(state, next);
    const courseId = await getTeacherCourseIdBySlug(demoCourse.slug);
    if (courseId) {
      const res = await updateCourseSettings(courseId, { access: next });
      setToast(res.ok ? (next === "open" ? "Akses siswa dibuka kembali." : "Akses siswa dikunci untuk peserta baru.") : res.error ?? "Gagal menyimpan pengaturan.");
      return;
    }
    setToast(next === "open" ? "Akses siswa dibuka kembali." : "Akses siswa dikunci untuk peserta baru.");
  }

  async function publishCourse() {
    const next = state === "published" ? "draft" : "published";
    setState(next);
    saveCourseState(next, access);
    const courseId = await getTeacherCourseIdBySlug(demoCourse.slug);
    if (courseId) {
      const res = await updateCourseSettings(courseId, { state: next });
      setToast(res.ok ? (next === "published" ? "Pembelajaran berhasil dipublikasikan." : "Pembelajaran dikembalikan ke draft.") : res.error ?? "Gagal menyimpan pengaturan.");
      return;
    }
    setToast(next === "published" ? "Pembelajaran berhasil dipublikasikan." : "Pembelajaran dikembalikan ke draft.");
  }

  function copyLink() {
    const link = `${window.location.origin}/learn/${demoCourse.slug}`;
    navigator.clipboard?.writeText(link);
    setToast("Link pembelajaran disalin ke clipboard.");
  }

  function exportCSV() {
    const csv = ["Nama,Kelas,Progres,Nilai,Status,Aktivitas", ...participants.map((p) => `${p.name},${p.className},${p.progress}%,${p.score},${p.status},${p.activities}`)].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "eduverse-peserta.csv";
    anchor.click();
    URL.revokeObjectURL(url);
    setToast("Laporan peserta diunduh.");
  }

  const liveParticipants = useMemo(() => participants.map((person) => {
    const rows = dbSubmissions.filter((item) => item.studentId === person.id);
    const graded = rows.filter((item) => item.score !== null);
    const score = graded.length ? Math.round(graded.reduce((sum, item) => sum + ((item.score || 0) / item.maxScore) * 100, 0) / graded.length) : person.score;
    const localRows = submissions.filter((item) => item.participantId === person.id);
    return {
      ...person,
      score,
      activities: Math.max(person.activities, rows.length, localRows.length),
      lastActive: rows.length ? new Date(rows[rows.length - 1].submittedAt).toLocaleString("id-ID") : person.lastActive,
    };
  }), [participants, submissions, dbSubmissions]);

  const filtered = useMemo(() => liveParticipants.filter((person) => `${person.name} ${person.className}`.toLowerCase().includes(search.toLowerCase())), [liveParticipants, search]);

  const totalBlocks = useMemo(() => modules.reduce((sum, module) => sum + module.lessons.length, 0), [modules]);

  const moduleProgress = useMemo(() => {
    return modules.map((module) => {
      const completedCount = completed.filter((id) => module.lessons.some((lesson) => lesson.id === id)).length;
      const localPct = module.lessons.length > 0 ? Math.min(100, Math.round((completedCount / module.lessons.length) * 100)) : 0;
      // Analitik DB memberi persentase penyelesaian nyata per modul.
      const fromAnalytics = analytics?.rows.find((row) => row.moduleId === module.id)?.completion;
      const progressPct = fromAnalytics ?? localPct;
      return { module, completedCount, progressPct };
    });
  }, [modules, completed, analytics]);

  const analyticsRows = useMemo(() => {
    if (analytics?.rows?.length) {
      return analytics.rows.map((row) => ({
        module: row.module,
        activities: row.activities,
        response: row.response,
        completion: `${row.completion}%`,
        score: row.score === null ? "—" : `${row.score}%`,
      }));
    }
    return moduleProgress.map((mp) => {
      const rows = submissions.filter((item) => item.moduleId === mp.module.id);
      const graded = rows.filter((item) => item.score !== null);
      return {
        module: mp.module.title,
        activities: mp.module.lessons.map((lesson) => lesson.title).join(" · ") || "Belum ada materi",
        response: rows.length ? `${rows.length} jawaban tersimpan` : "Belum ada respons",
        completion: rows.length ? `${Math.min(100, rows.length * 25)}%` : "0%",
        score: graded.length ? `${Math.round(graded.reduce((sum, item) => sum + ((item.score || 0) / item.maxScore) * 100, 0) / graded.length)}%` : "—",
      };
    });
  }, [moduleProgress, submissions, analytics]);

  const activityList = activityRows.length
    ? activityRows.map((row) => ({
        icon: row.kind === "progress" ? "spark" : row.kind === "enrollment" ? "person" : row.kind === "quiz" ? "game" : "message",
        title: row.title,
        meta: row.meta,
        color: row.kind === "progress" ? "teal" : row.kind === "enrollment" ? "violet" : row.kind === "quiz" ? "yellow" : "coral",
      }))
    : activityFeed;

  const firstName = teacherName.split(" ")[0] || "Guru";
  const initials = teacherName.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "GU";

  return <AppShell>
    <div className="page-topbar"><div><div className="eyebrow">SELAMAT PAGI, {firstName.toUpperCase()} <span className="eyebrow-star">✦</span></div><h1>{tab === "participants" ? "Peserta kelas" : tab === "analytics" ? "Analitik pembelajaran" : "Ringkasan workspace"}</h1><p>{tab === "participants" ? "Pantau siapa yang masuk, progres, dan aktivitas terakhir mereka." : tab === "analytics" ? "Lihat pola belajar kelasmu dan temukan momen yang perlu didukung." : "Satu tempat untuk melihat apa yang sedang bergerak di kelasmu."}</p></div><div className="page-topbar__actions"><button className="icon-button notification-button" aria-label="Notifikasi"><Sparkles size={17} /></button><div className="user-pill"><span className="user-pill__avatar">{initials}</span><div><strong>{teacherName || "Guru"}</strong><small>Teacher</small></div></div></div></div>
    <div className="tabs" style={{ width: "max-content", marginBottom: 18 }}><button className={`tab ${tab === "overview" ? "is-active" : ""}`} onClick={() => navigateTab("overview")}>Overview</button><button className={`tab ${tab === "participants" ? "is-active" : ""}`} onClick={() => navigateTab("participants")}>Peserta <span style={{ color: "var(--violet)" }}>{fromDb ? liveParticipants.length : getParticipants().length}</span></button><button className={`tab ${tab === "analytics" ? "is-active" : ""}`} onClick={() => navigateTab("analytics")}>Analitik</button></div>
    {tab === "overview" && <>
      <section className="dashboard-hero"><div className="dashboard-hero__copy"><div className="eyebrow">MINGGU INI DI KELASMU {fromDb && <StatusPill tone="teal">Tersinkron DB</StatusPill>}</div><h2>Progress kecil yang terlihat, bikin semangat jadi besar.</h2><p>{dbStats ? `${dbStats.enrollCount} enrollment aktif dari ${dbStats.uniqueStudents} siswa unik. Rata-rata progres ${dbStats.avgProgress}%.` : `${getParticipants().length} siswa sudah masuk ke pembelajaranmu. 7 orang menyelesaikan kuis dalam 24 jam terakhir.`}</p></div><div className="hero-orbit-badge"><div><strong>{dbStats ? `${dbStats.avgProgress}%` : "68%"}</strong><small>rata-rata progres</small></div></div></section>
      <section className="metrics-grid"><MetricCard label="Siswa unik" value={String(dbStats ? dbStats.uniqueStudents : getParticipants().length)} delta="+12% minggu ini" icon="users" tone="violet" /><MetricCard label="Rata-rata nilai" value={dbStats ? `${dbStats.avgScore}%` : "84%"} delta="+6% dari kuis lalu" icon="trend" tone="teal" /><MetricCard label="Sedang aktif" value={dbStats ? String(dbStats.enrollCount).padStart(2, "0") : "07"} delta="4 baru hari ini" icon="clock" tone="yellow" /><MetricCard label="Aktivitas selesai" value={dbStats ? String(dbStats.completedActivities) : "186"} delta="+24 aktivitas" icon="check" tone="coral" /></section>
      <div className="dashboard-grid"><div><SectionTitle eyebrow="PEMBELAJARAN AKTIF" title="Yang sedang bergerak" action={<Link href={`/teacher/course/${demoCourse.slug}`} className="text-link">Kelola pembelajaran <ArrowRight size={15} /></Link>} /><div className="panel course-panel"><div className="course-panel__head"><span className="course-art">−2</span><div><strong>{demoCourse.title}</strong><small>{demoCourse.subject} · {demoCourse.grade} · {demoCourse.duration}</small></div><StatusPill tone={access === "open" ? "teal" : "coral"}>{access === "open" ? "Akses terbuka" : "Terkunci"}</StatusPill></div><div className="module-list">{moduleProgress.map((mp, index) => {
    const module = mp.module;
    const progressPct = mp.progressPct;
    const completedCount = mp.completedCount;
    return <div className="module-row" key={module.id}><span className="module-row__step">0{index + 1}</span><div className="module-row__copy"><strong>{module.title}</strong><small>{module.lessons.length} aktivitas · {module.eyebrow.split("·")[1]}</small></div><div className="module-row__progress"><span style={{ width: `${progressPct}%` }} /></div><span className="module-row__percent">{progressPct}%</span><ChevronRight size={15} color="var(--muted)" /></div>;
  })}</div></div></div><div><SectionTitle eyebrow="MOMEN BELAJAR" title="Aktivitas terbaru" action={<Link href="/teacher?tab=participants" className="text-link">Lihat semua <ArrowRight size={15} /></Link>} /><div className="panel activity-panel"><div className="activity-list">{activityList.map((item) => <div className="activity-item" key={item.title}><span className={`activity-icon activity-icon--${item.color}`}>{item.icon === "spark" ? <Sparkles size={15} /> : item.icon === "person" ? <UserRound size={15} /> : item.icon === "game" ? <Gamepad2 size={15} /> : <MessageCircle size={15} />}</span><div className="activity-item__copy"><strong>{item.title}</strong><small>{item.meta}</small></div><ChevronRight size={14} /></div>)}</div></div></div></div>
      <div className="dashboard-grid"><div><SectionTitle eyebrow="RITME KELAS" title="Progres mingguan" /><div className="panel chart-panel"><div className="chart-panel__head"><div><strong>Aktivitas selesai</strong><small>Jumlah aktivitas yang selesai per hari</small></div><div className="chart-legend"><span /> selesai</div></div><ChartBars /></div></div><div><SectionTitle eyebrow="AKSES CEPAT" title="Lanjutkan pekerjaan" /><div className="panel activity-panel"><div className="quick-actions"><Link href={`/teacher/course/${demoCourse.slug}`} className="quick-action"><span className="quick-action__icon quick-action__icon--violet"><BookOpen size={17} /></span><div><strong>Edit pembelajaran</strong><small>Tambah blok, quiz, atau materi</small></div><ChevronRight size={14} /></Link><Link href="/teacher/game-studio" className="quick-action"><span className="quick-action__icon quick-action__icon--teal"><Gamepad2 size={17} /></span><div><strong>Uji mini-game</strong><small>Number Line Challenge</small></div><ChevronRight size={14} /></Link><button className="quick-action" onClick={() => setShowCreate(true)}><span className="quick-action__icon quick-action__icon--yellow"><Plus size={17} /></span><div><strong>Buat pembelajaran baru</strong><small>Mulai dari template kosong</small></div><ChevronRight size={14} /></button></div></div></div></div>
    </>}
    {tab === "participants" && <><div className="section-title"><div><div className="eyebrow">PESERTA PEMBELAJARAN</div><h2>{demoCourse.shortTitle}</h2></div><div style={{ display: "flex", gap: 8 }}><button className="button button--ghost button--small" onClick={exportCSV}><Download size={15} /> Unduh CSV</button><button className="button button--primary button--small" onClick={copyLink}><ExternalLink size={15} /> Bagikan link</button></div></div><div className="table-panel"><div className="table-toolbar"><div className="search-field"><Search size={15} /><input placeholder="Cari nama atau kelas..." value={search} onChange={(event) => setSearch(event.target.value)} /></div><StatusPill tone="teal">{filtered.length} peserta terlihat</StatusPill></div><table className="data-table"><thead><tr><th>Peserta</th><th>Progres</th><th>Nilai rata-rata</th><th>Status</th><th>Aktivitas</th><th /></tr></thead><tbody>{filtered.map((person, index) => <tr key={person.id}><td><div className="student-cell"><span className={`table-avatar ${index % 3 === 1 ? "table-avatar--teal" : index % 3 === 2 ? "table-avatar--yellow" : ""}`}>{person.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}</span><div><strong>{person.name}</strong><small style={{ display: "block", marginTop: 3, color: "var(--muted)", fontWeight: 400 }}>{person.className} · {person.lastActive}</small></div></div></td><td><div className="progress-cell"><div className="table-progress"><span style={{ width: `${person.progress}%` }} /></div>{person.progress}%</div></td><td>{person.score ? `${person.score}%` : "—"}</td><td><StatusPill tone={person.status === "Selesai" ? "teal" : person.status === "Baru" ? "yellow" : "violet"}>{person.status}</StatusPill></td><td>{person.activities}/{totalBlocks || 12}</td><td><button className="icon-button icon-button--tiny" onClick={() => setSelectedParticipant(person)} aria-label={`Buka detail ${person.name}`}><MoreHorizontal size={16} /></button></td></tr>)}</tbody></table></div></>}
    {tab === "analytics" && <><div className="section-title"><div><div className="eyebrow">INSIGHT YANG BISA DITINDAKLANJUTI</div><h2>Analitik pembelajaran</h2><p className="section-subtitle">Rincian progres, respons, dan skor disusun mengikuti struktur modul.</p></div><button className="button button--ghost button--small" onClick={() => setToast("Rentang waktu diatur ke 30 hari terakhir.")}>30 hari terakhir <ChevronRight size={15} /></button></div><div className="metrics-grid"><MetricCard label="Penyelesaian modul" value={`${analytics?.rows.length ? Math.round(analytics.rows.reduce((s, r) => s + r.completion, 0) / analytics.rows.length) : 72}%`} delta="dihitung dari data siswa" icon="check" tone="teal" /><MetricCard label="Siswa perlu dukungan" value={String(dbStats ? Math.max(0, dbStats.uniqueStudents - Math.round((dbStats.avgProgress / 100) * dbStats.uniqueStudents)) : 5).padStart(2, "0")} delta="progres di bawah rata-rata" icon="users" tone="coral" /><MetricCard label="Jawaban uraian perlu review" value={String(analytics?.needsReview ?? 12).padStart(2, "0")} delta="menunggu penilaian guru" icon="check" tone="yellow" /><MetricCard label="Kuis paling kuat" value={analytics?.topQuiz ? analytics.topQuiz : "Belum ada"} delta="berdasarkan nilai rata-rata" icon="trend" tone="violet" /></div><div className="table-panel analytics-module-table"><div className="table-toolbar"><div><strong>Rincian aktivitas per modul</strong><small>Jenis respons membantu guru melihat materi mana yang memerlukan penilaian manual.</small></div><StatusPill tone="violet">{analyticsRows.length} modul</StatusPill></div><table className="data-table"><thead><tr><th>Modul</th><th>Aktivitas</th><th>Respons</th><th>Selesai</th><th>Nilai</th></tr></thead><tbody>{analyticsRows.map((row) => <tr key={row.module}><td><strong>{row.module}</strong></td><td>{row.activities}</td><td><span className="response-type-pill">{row.response}</span></td><td>{row.completion}</td><td>{row.score}</td></tr>)}</tbody></table></div><div className="dashboard-grid"><div><div className="panel chart-panel"><div className="chart-panel__head"><div><strong>Progres penyelesaian</strong><small>Modul yang selesai per minggu</small></div></div><ChartBars /></div></div><div className="panel activity-panel"><div className="section-title" style={{ marginTop: 0 }}><h2 style={{ fontSize: "1rem" }}>Catatan guru</h2><Sparkles size={16} color="var(--yellow)" /></div><p style={{ color: "var(--muted)", fontSize: ".76rem", lineHeight: 1.6 }}>“Modul investigasi punya drop-off terbesar. Coba tambahkan contoh visual sebelum studi kasus freezer.”</p><button className="button button--ghost button--small" style={{ marginTop: 18 }} onClick={() => setToast("Catatan disimpan ke aktivitas kelas.")}>Simpan catatan</button></div></div></>}
    {showCreate && <div className="modal-backdrop" onClick={() => setShowCreate(false)}><div className="modal-card" onClick={(event) => event.stopPropagation()}><div className="modal-card__head"><div><div className="eyebrow">PEMBELAJARAN BARU</div><h2>Mulai ruang belajar baru.</h2></div><button className="icon-button" onClick={() => setShowCreate(false)} aria-label="Tutup">×</button></div><div className="form-grid"><div className="field field--full"><label>Judul pembelajaran</label><input defaultValue="Eksplorasi baru" /></div><div className="field"><label>Mata pelajaran</label><select defaultValue="Matematika"><option>Matematika</option><option>IPA</option><option>Bahasa Indonesia</option></select></div><div className="field"><label>Target kelas</label><select defaultValue="Kelas VII"><option>Kelas VII</option><option>Kelas VIII</option><option>Kelas IX</option></select></div></div><button className="button button--primary" style={{ width: "100%", marginTop: 18 }} onClick={() => { setShowCreate(false); setToast("Draft pembelajaran baru dibuat."); }}>Buat draft pembelajaran <ArrowRight size={16} /></button><p className="modal-note">Demo mode: draft ini hanya disimpan sebagai status tampilan di browser.</p></div></div>}
    {selectedParticipant && <ParticipantDetailModal participant={selectedParticipant} submissions={dbSubmissions.filter((item) => item.studentId === selectedParticipant.id)} modules={modules} analytics={analytics?.rows ?? null} onClose={() => setSelectedParticipant(null)} />}
    {toast && <Toast message={toast} onClose={() => setToast("")} />}
  </AppShell>;
}

function ParticipantDetailModal({ participant, submissions, modules, analytics, onClose }: { participant: Participant; submissions: Array<{ id: string; blockTitle: string; response: string; score: number | null; maxScore: number; submittedAt: string; status: string }>; modules: typeof demoCourse.modules; analytics: ModuleAnalyticsRow[] | null; onClose: () => void }) {
  const detailRows = modules.map((module, index) => {
    const analyticsRow = analytics?.find((row) => row.moduleId === module.id);
    return {
      module: module.title,
      progress: analyticsRow?.completion ?? Math.max(8, Math.min(100, participant.progress + ([20, 4, -18, -34][index] ?? 0))),
      score: analyticsRow?.score === null || analyticsRow?.score === undefined ? "—" : `${analyticsRow.score}%`,
      items: analyticsRow?.activities ?? module.lessons.map((lesson) => lesson.title).join(" · "),
      response: analyticsRow?.response ?? (index === 2 || index === 3 ? "Uraian + otomatis" : index === 1 ? "Interaktif" : "Materi"),
    };
  });
  return <div className="modal-backdrop" onClick={onClose}><div className="modal-card participant-detail-modal" onClick={(event) => event.stopPropagation()}><div className="modal-card__head"><div><div className="eyebrow">DETAIL PESERTA · SUMBER DATABASE</div><h2>{participant.name}</h2><p>{participant.className} · {participant.lastActive} · {participant.activities} aktivitas tercatat</p></div><button className="icon-button" onClick={onClose} aria-label="Tutup detail">×</button></div><div className="participant-detail-summary"><div><strong>{participant.progress}%</strong><small>progres course</small></div><div><strong>{participant.score || "—"}{participant.score ? "%" : ""}</strong><small>nilai otomatis</small></div><div><strong>{modules.reduce((sum, module) => sum + module.lessons.length, 0)}</strong><small>item dalam course</small></div></div><div className="eyebrow" style={{ marginTop: 24 }}>RINCIAN PER MODUL</div><div className="participant-module-list">{detailRows.map((row) => <div className="participant-module-row" key={row.module}><div><strong>{row.module}</strong><small>{row.items}</small><span className="response-type-pill">{row.response}</span></div><div className="participant-module-score"><strong>{row.progress}%</strong><small>{row.score}</small></div></div>)}</div><div className="participant-submission-list"><div className="eyebrow">JAWABAN TERKIRIM</div>{submissions.length ? submissions.map((item) => <div className="participant-submission-row" key={item.id}><div><strong>{item.blockTitle}</strong><small>{item.response || "File bukti dikirim"} · {new Date(item.submittedAt).toLocaleString("id-ID")}</small></div><span>{item.score === null ? "Review manual" : `${item.score}/${item.maxScore}`}</span></div>) : <p className="section-subtitle">Belum ada jawaban tersimpan dari peserta ini.</p>}</div><div className="participant-detail-note"><strong>Catatan penilaian manual</strong><p>Jawaban uraian pada E-LKPD dan Refleksi strategi belum memiliki nilai otomatis. Setelah guru menilai rubriknya, nilai modul akan ikut memperbarui analitik peserta.</p></div></div></div>;
}
