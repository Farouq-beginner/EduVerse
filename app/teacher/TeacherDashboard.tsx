"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  BookOpen,
  ChevronRight,
  Download,
  ExternalLink,
  FileText,
  Gamepad2,
  Loader2,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Sparkles,
  UsersRound,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { ChartBars, MetricCard, SectionTitle, StatusPill } from "@/components/DashboardBits";
import { Toast } from "@/components/Toast";
import {
  createTeacherCourse,
  getTeacherWorkspace,
  publishCourse,
  updateCourseSettings,
  type DbCourse,
  type ModuleAnalyticsRow,
  type ParticipantRow,
  type StudentSubmissionRow,
  type TeacherActivityRow,
  type TeacherCourseCard,
} from "@/lib/actions/dashboards";

type Stats = {
  courseCount: number;
  uniqueStudents: number;
  enrollCount: number;
  completedActivities: number;
  avgScore: number;
  avgProgress: number;
} | null;

type Tab = "overview" | "participants" | "analytics";

const emptyForm = { title: "", subject: "Matematika", grade: "Kelas VII", description: "" };

export function TeacherDashboard({
  teacherName,
  initialCourses,
  initialStats,
}: {
  teacherName: string;
  initialCourses: TeacherCourseCard[];
  initialStats: Stats;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [courses, setCourses] = useState<TeacherCourseCard[]>(initialCourses);
  const [stats] = useState<Stats>(initialStats);
  const [tab, setTab] = useState<Tab>("overview");
  const [selectedSlug, setSelectedSlug] = useState<string>(initialCourses[0]?.slug ?? "");
  const [participants, setParticipants] = useState<ParticipantRow[]>([]);
  const [participantsLoading, setParticipantsLoading] = useState(false);
  const [structure, setStructure] = useState<DbCourse | null>(null);
  const [structureLoading, setStructureLoading] = useState(false);
  const [analytics, setAnalytics] = useState<{ rows: ModuleAnalyticsRow[]; needsReview: number; topQuiz: string | null } | null>(null);
  const [submissions, setSubmissions] = useState<StudentSubmissionRow[]>([]);
  const [activityRows, setActivityRows] = useState<TeacherActivityRow[]>([]);
  const [selectedParticipant, setSelectedParticipant] = useState<ParticipantRow | null>(null);
  const [search, setSearch] = useState("");
  const [filterSearchableTerm, setFilterSearchableTerm] = useState("");
  const [toast, setToast] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState(emptyForm);
  const [creating, setCreating] = useState(false);

  const selectedCourse = useMemo(
    () => courses.find((course) => course.slug === selectedSlug) ?? courses[0] ?? null,
    [courses, selectedSlug]
  );

  useEffect(() => {
    const nextTab = searchParams.get("tab");
    if (nextTab === "participants" || nextTab === "analytics" || nextTab === "overview") setTab(nextTab);
    const courseParam = searchParams.get("course");
    if (courseParam) setSelectedSlug(courseParam);
  }, [searchParams]);

  // Muat data workspace hanya untuk course pilihan milik guru ini.
  useEffect(() => {
    if (!selectedCourse) {
      setParticipants([]);
      setStructure(null);
      setAnalytics(null);
      setSubmissions([]);
      setActivityRows([]);
      return;
    }

    let active = true;
    setParticipantsLoading(true);
    setStructureLoading(true);      (async () => {
      try {
        const workspace = await getTeacherWorkspace(selectedCourse.id, selectedCourse.slug);
        if (!active) return;
        setParticipants(workspace?.participants ?? []);
        setStructure(workspace?.structure ?? null);
        setAnalytics(workspace?.analytics ?? null);
        setSubmissions(workspace?.submissions ?? []);
        setActivityRows(workspace?.activity ?? []);
        setFilterSearchableTerm("");
      } catch {
        if (!active) return;
        setParticipants([]);
        setStructure(null);
      } finally {
        if (active) {
          setParticipantsLoading(false);
          setStructureLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [selectedCourse?.id, selectedCourse?.slug]);

  const navigate = useCallback(
    (nextTab: Tab, slug?: string) => {
      const params = new URLSearchParams();
      if (nextTab !== "overview") params.set("tab", nextTab);
      const courseSlug = slug ?? selectedCourse?.slug;
      if (courseSlug && courses.length > 1) params.set("course", courseSlug);
      router.replace(`/teacher${params.toString() ? `?${params}` : ""}`, { scroll: false });
    },
    [router, selectedCourse?.slug, courses.length]
  );

  async function copyLink() {
    if (!selectedCourse) return;
    const link = `${window.location.origin}/learn/${selectedCourse.slug}`;
    await navigator.clipboard?.writeText(link);
    setToast("Link pembelajaran disalin ke clipboard.");
  }

  function exportCSV() {
    const csv = [
      "Nama,Kelas,Progres,Nilai,Status,Aktivitas",
      ...participants.map((row) => `${row.name},${row.className},${row.progress}%,${row.score ?? ""},${row.status},${row.activities}`),
    ].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `eduverse-peserta-${selectedCourse?.slug ?? "kelas"}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    setToast("Laporan peserta diunduh.");
  }

  async function togglePublish(course: TeacherCourseCard) {
    const next = course.state === "PUBLISHED" ? "draft" : "published";
    // Publish selalu mengambil snapshot draft terbaru, bukan sekadar mengubah status.
    const result =
      next === "published"
        ? await publishCourse(course.id)
        : await updateCourseSettings(course.id, { state: "draft" });
    if (!result.ok) {
      setToast(result.error ?? "Gagal menyimpan status.");
      return;
    }
    setCourses((current) =>
      current.map((item) => (item.id === course.id ? { ...item, state: next === "published" ? "PUBLISHED" : "DRAFT" } : item))
    );
    setToast(
      next === "published"
        ? "Pembelajaran dipublikasikan dari draft terbaru."
        : "Pembelajaran dikembalikan ke draft. Siswa belum bisa membukanya."
    );
  }

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    if (creating) return;
    if (!createForm.title.trim()) {
      setToast("Judul pembelajaran wajib diisi.");
      return;
    }
    setCreating(true);
    const result = await createTeacherCourse(createForm);
    setCreating(false);
    if (!result.ok || !result.course) {
      setToast(result.error ?? "Gagal membuat pembelajaran.");
      return;
    }
    setCourses((current) => [result.course!, ...current]);
    setCreateForm(emptyForm);
    setShowCreate(false);
    setToast("Pembelajaran baru dibuat. Yuk isi pertemuan pertamamu.");
    router.push(`/teacher/course/${result.course.slug}`);
  }

  const searchLower = search.trim().toLowerCase();
  const hasSearch = searchLower.length > 0;

  const moduleRows = useMemo(() => {
    if (!structure) return [];
    return structure.modules.map((module) => {
      const analyticsRow = analytics?.rows.find((row) => row.moduleId === module.id);
      return {
        id: module.id,
        title: module.title,
        eyebrow: module.eyebrow,
        duration: module.duration,
        count: module.blocks.length,
        completion: analyticsRow?.completion ?? 0,
      };
    });
  }, [structure, analytics]);

  const filteredParticipants = useMemo(
    () =>
      hasSearch
        ? participants.filter((row) =>
            `${row.name} ${row.className}`.toLowerCase().includes(searchLower)
          )
        : participants,
    [participants, searchLower, hasSearch]
  );

  const filteredModules = useMemo(
    () =>
      hasSearch
        ? moduleRows.filter((row) => row.title.toLowerCase().includes(searchLower))
        : moduleRows,
    [moduleRows, searchLower, hasSearch]
  );

  const firstName = teacherName.split(" ")[0] || teacherName;
  const initials = firstName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "GU";

  const analyticsRows = analytics?.rows ?? [];

  return (
    <AppShell>
      <div className="page-topbar">
        <div>
          <div className="eyebrow">
            WORKSPACE GURU · {teacherName.toUpperCase()} <span className="eyebrow-star">✦</span>
          </div>
          <h1>
            {tab === "participants" ? "Peserta kelas" : tab === "analytics" ? "Analitik pembelajaran" : `Halo, ${firstName}.`}
          </h1>
          <p>
            {tab === "participants"
              ? "Peserta berasal dari database pembelajaran milikmu — tanpa data contoh."
              : tab === "analytics"
                ? "Progres dan respons dihitung dari aktivitas siswa yang sebenarnya."
                : "Semua kelas dan materi di sini hanya milik akunmu."}
          </p>
        </div>
        <div className="page-topbar__actions">
          <button className="button button--primary button--small" onClick={() => setShowCreate(true)}>
            <Plus size={15} /> Buat pembelajaran
          </button>
          <div className="user-pill">
            <span className="user-pill__avatar">{initials}</span>
            <div>
              <strong>{teacherName}</strong>
              <small>Teacher</small>
            </div>
          </div>
        </div>
      </div>

      <div className="tabs" style={{ width: "max-content", marginBottom: 18 }}>
        <button className={`tab ${tab === "overview" ? "is-active" : ""}`} onClick={() => navigate("overview")}>
          Overview
        </button>
        <button className={`tab ${tab === "participants" ? "is-active" : ""}`} onClick={() => navigate("participants")}>
          Peserta <span style={{ color: "var(--violet)" }}>{participants.length}</span>
        </button>
        <button className={`tab ${tab === "analytics" ? "is-active" : ""}`} onClick={() => navigate("analytics")}>
          Analitik
        </button>
      </div>

      {tab === "overview" && (
        <>
          <section className="dashboard-hero">
            <div className="dashboard-hero__copy">
              <div className="eyebrow">
                {courses.length ? "PEMBELAJARAN AKTIF" : "MULAI DARI NOL"}{" "}
                {courses.length > 0 && <StatusPill tone="teal">Tersinkron DB</StatusPill>}
              </div>
              <h2>
                {courses.length
                  ? "Progress kecil yang terlihat, bikin semangat jadi besar."
                  : `Selamat datang, ${firstName}. Buat pembelajaran pertamamu.`}
              </h2>
              <p>
                {stats && stats.enrollCount > 0
                  ? `${stats.enrollCount} enrollment aktif dari ${stats.uniqueStudents} siswa unik. Rata-rata progres ${stats.avgProgress}%.`
                  : "Belum ada siswa yang bergabung. Bagikan link pembelajaran agar siswa bisa masuk."}
              </p>
            </div>
            <div className="hero-orbit-badge">
              <div>
                <strong>{stats ? `${stats.avgProgress}%` : "—"}</strong>
                <small>rata-rata progres</small>
              </div>
            </div>
          </section>

          <section className="metrics-grid">
            <MetricCard label="Siswa unik" value={String(stats?.uniqueStudents ?? 0)} delta="dari enrollment aktif" icon="users" tone="violet" />
            <MetricCard label="Rata-rata nilai" value={`${stats?.avgScore ?? 0}%`} delta="dari attempt kuis" icon="trend" tone="teal" />
            <MetricCard label="Sedang aktif" value={String(stats?.enrollCount ?? 0).padStart(2, "0")} delta="enrollment aktif" icon="clock" tone="yellow" />
            <MetricCard label="Aktivitas selesai" value={String(stats?.completedActivities ?? 0)} delta="progres siswa" icon="check" tone="coral" />
          </section>

          <div className="dashboard-grid">
            <div>
              <SectionTitle
                eyebrow="PEMBELAJARAN MILIKMU"
                title={courses.length ? `${courses.length} pembelajaran` : "Belum ada pembelajaran"}
              />
              {courses.length === 0 ? (
                <div className="panel empty-state">
                  <span className="empty-state__icon">
                    <BookOpen size={22} />
                  </span>
                  <strong>Workspace ini masih kosong</strong>
                  <p>Buat pembelajaran baru. Data pertemuan, peserta, dan jawaban akan tersimpan di akunmu sendiri.</p>
                  <button className="button button--primary button--small" onClick={() => setShowCreate(true)}>
                    <Plus size={15} /> Buat pembelajaran pertama
                  </button>
                </div>
              ) : (
                <div style={{ display: "grid", gap: 14 }}>
                  {courses.map((course) => (
                    <div className="panel course-panel" key={course.id}>
                      <div className="course-panel__head">
                        <span className="course-art">{course.accent === "teal" ? "±" : course.accent === "yellow" ? "↔" : "−2"}</span>
                        <div>
                          <strong>{course.title}</strong>
                          <small>
                            {course.subject} · {course.grade} · {course.moduleCount} pertemuan · {course.blockCount} materi
                          </small>
                        </div>
                        <StatusPill tone={course.state === "PUBLISHED" ? "teal" : "yellow"}>
                          {course.state === "PUBLISHED" ? "Published" : "Draft"}
                        </StatusPill>
                      </div>
                      <div className="module-row" style={{ cursor: "default" }}>
                        <span className="module-row__step">{String(course.studentCount).padStart(2, "0")}</span>
                        <div className="module-row__copy">
                          <strong>{course.studentCount} siswa bergabung</strong>
                          <small>Rata-rata progres {course.averageProgress}%</small>
                        </div>
                        <div className="module-row__progress">
                          <span style={{ width: `${course.averageProgress}%` }} />
                        </div>
                        <span className="module-row__percent">{course.averageProgress}%</span>
                      </div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", padding: "0 18px 16px" }}>
                        <Link href={`/teacher/course/${course.slug}`} className="button button--primary button--small">
                          Kelola pembelajaran <ArrowRight size={14} />
                        </Link>
                        <button
                          className="button button--ghost button--small"
                          onClick={() => {
                            navigator.clipboard?.writeText(`${window.location.origin}/learn/${course.slug}`);
                            setToast("Link pembelajaran disalin.");
                          }}
                        >
                          <ExternalLink size={14} /> Bagikan link
                        </button>
                        <button className="button button--ghost button--small" onClick={() => togglePublish(course)}>
                          {course.state === "PUBLISHED" ? "Jadikan draft" : "Publikasikan"}
                        </button>
                        <button
                          className="button button--ghost button--small"
                          onClick={() => {
                            setSelectedSlug(course.slug);
                            navigate("participants", course.slug);
                          }}
                        >
                          <UsersRound size={14} /> Peserta
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div>
              <SectionTitle eyebrow="MOMEN BELAJAR" title="Aktivitas terbaru" />
              <div className="panel activity-panel">
                {activityRows.length === 0 ? (
                  <div className="empty-state">
                    <MessageCircle size={22} />
                    <strong>Belum ada aktivitas</strong>
                    <p>Aktivitas siswa muncul di sini setelah mereka membuka materi atau mengirim jawaban.</p>
                  </div>
                ) : (
                  <div className="activity-list">
                    {activityRows.map((row) => (
                      <div className="activity-item" key={row.id}>
                        <span
                          className={`activity-icon activity-icon--${
                            row.kind === "progress" ? "teal" : row.kind === "enrollment" ? "violet" : row.kind === "quiz" ? "yellow" : "coral"
                          }`}
                        >
                          {row.kind === "progress" ? <Sparkles size={15} /> : row.kind === "enrollment" ? <UsersRound size={15} /> : row.kind === "quiz" ? <Gamepad2 size={15} /> : <MessageCircle size={15} />}
                        </span>
                        <div className="activity-item__copy">
                          <strong>{row.title}</strong>
                          <small>{row.meta}</small>
                        </div>
                        <ChevronRight size={14} />
                      </div>
                    ))}
                    {activityRows.length === 0 && (
                      <div className="activity-list__empty">
                        <div className="activity-item activity-item--empty">
                          <div className="activity-item__copy">
                            <strong>Belum ada aktivitas</strong>
                            <small>Data muncul setelah siswa membuka materi atau mengirim jawaban.</small>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="dashboard-grid">
            <div style={{ gridColumn: "1 / -1" }}>
              <SectionTitle eyebrow="MATERI" title={selectedCourse ? `Pertemuan · ${selectedCourse.title}` : "Pertemuan"} />
              <div className="panel">
                {structureLoading ? (
                  <div className="sync-loading">
                    <Loader2 size={18} className="spin" />
                    <span>Menyinkronkan materi dari database...</span>
                  </div>
                ) : moduleRows.length === 0 ? (
                  <div className="empty-state">
                    <FileText size={22} />
                    <strong>Belum ada pertemuan</strong>
                    <p>{selectedCourse ? "Buka course builder untuk menambah pertemuan pertama." : "Buat pembelajaran dulu."}</p>
                  </div>
                ) : (
                  <div className="module-list">
                    {moduleRows.map((module, index) => (
                      <div className="module-row" key={module.id}>
                        <span className="module-row__step">{String(index + 1).padStart(2, "0")}</span>
                        <div className="module-row__copy">
                          <strong>{module.title}</strong>
                          <small>
                            {module.eyebrow} · {module.duration} · {module.count} materi
                          </small>
                        </div>
                        <div className="module-row__progress">
                          <span style={{ width: `${module.completion}%` }} />
                        </div>
                        <span className="module-row__percent">{module.completion}%</span>
                      </div>
                    ))}
                    {moduleRows.length > 0 && (
                      <div className="module-list-footer">
                        <Link href={`/teacher/course/${selectedCourse?.slug}`} className="button button--primary button--small">
                          <Pencil size={14} /> Kelola semua pertemuan
                        </Link>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {tab === "participants" && (
        <>
          <div className="section-title">
            <div>
              <div className="eyebrow">PESERTA PEMBELAJARAN</div>
              <h2>{selectedCourse?.title ?? "Pilih pembelajaran"}</h2>
              <p className="section-subtitle">Data diambil langsung dari enrollment database. Tidak ada peserta contoh.</p>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {courses.length > 1 && (
                <select
                  value={selectedCourse?.slug ?? ""}
                  onChange={(event) => {
                    setSelectedSlug(event.target.value);
                    navigate("participants", event.target.value);
                  }}
                >
                  {courses.map((course) => (
                    <option key={course.id} value={course.slug}>
                      {course.title}
                    </option>
                  ))}
                </select>
              )}
              <button className="button button--ghost button--small" onClick={exportCSV} disabled={!participants.length}>
                <Download size={15} /> Unduh CSV
              </button>
              <button className="button button--primary button--small" onClick={copyLink} disabled={!selectedCourse}>
                <ExternalLink size={15} /> Bagikan link
              </button>
            </div>
          </div>

          <div className="table-panel">
            <div className="table-toolbar">
              <div className="search-field">
                <Search size={15} />
                <input placeholder="Cari nama atau kelas..." value={search} onChange={(event) => setSearch(event.target.value)} />
              </div>
              <StatusPill tone="teal">{filteredParticipants.length} peserta terlihat</StatusPill>
            </div>
            {participantsLoading ? (
              <div className="sync-loading">
                <Loader2 size={18} className="spin" />
                <span>Memuat peserta dari database...</span>
              </div>
            ) : filteredParticipants.length === 0 ? (
              <div className="empty-state">
                <UsersRound size={24} />
                <strong>{filterSearchableTerm ? "Tidak ada peserta yang cocok" : "Belum ada peserta"}</strong>
                <p>{filterSearchableTerm ? "Coba kata kunci lain." : "Bagikan link pembelajaran. Siswa yang bergabung lewat link akan muncul di sini."}</p>
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Peserta</th>
                    <th>Progres</th>
                    <th>Nilai rata-rata</th>
                    <th>Status</th>
                    <th>Aktivitas</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {filteredParticipants.map((person, index) => (
                    <tr key={person.id}>
                      <td>
                        <div className="student-cell">
                          <span className={`table-avatar ${index % 3 === 1 ? "table-avatar--teal" : index % 3 === 2 ? "table-avatar--yellow" : ""}`}>
                            {person.name
                              .split(" ")
                              .map((n) => n[0])
                              .join("")
                              .slice(0, 2)}
                          </span>
                          <div>
                            <strong>{person.name}</strong>
                            <small style={{ display: "block", marginTop: 3, color: "var(--muted)", fontWeight: 400 }}>
                              {person.className} · {person.lastActive}
                            </small>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="progress-cell">
                          <div className="table-progress">
                            <span style={{ width: `${person.progress}%` }} />
                          </div>
                          {person.progress}%
                        </div>
                      </td>
                      <td>{person.score === null ? "—" : `${person.score}%`}</td>
                      <td>
                        <StatusPill tone={person.status === "Selesai" ? "teal" : person.status === "Baru" ? "yellow" : "violet"}>
                          {person.status}
                        </StatusPill>
                      </td>
                      <td>{person.activities}</td>
                      <td>
                        <button
                          className="icon-button icon-button--tiny"
                          onClick={() => setSelectedParticipant(person)}
                          aria-label={`Buka detail ${person.name}`}
                        >
                          <MoreHorizontal size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}              {tab === "analytics" && (
        <>
          <div className="section-title">
            <div>
              <div className="eyebrow">INSIGHT YANG BISA DITINDAKLANJUTI</div>
              <h2>{selectedCourse?.title ?? "Pilih pembelajaran"}</h2>
              <p className="section-subtitle">Rincian progres, respons, dan skor mengikuti struktur pertemuan di database.</p>
            </div>
            {courses.length > 1 && (
              <select
                value={selectedCourse?.slug ?? ""}
                onChange={(event) => {
                  setSelectedSlug(event.target.value);
                  navigate("analytics", event.target.value);
                }}
              >
                {courses.map((course) => (
                  <option key={course.id} value={course.slug}>
                    {course.title}
                  </option>
                ))}
              </select>
            )}
            {!selectedCourse && courses.length > 0 && (
              <div className="empty-state" style={{ marginTop: 16 }}>
                <BookOpen size={20} />
                <strong>Belum ada pembelajaran dipilih</strong>
                <p>Pilih pembelajaran dari menu di atas untuk melihat analitik.</p>
              </div>
            )}
          </div>

          <div className="metrics-grid">
            <MetricCard
              label="Penyelesaian pertemuan"
              value={`${analyticsRows.length ? Math.round(analyticsRows.reduce((sum, row) => sum + row.completion, 0) / analyticsRows.length) : 0}%`}
              delta="dihitung dari progres siswa"
              icon="check"
              tone="teal"
            />
            <MetricCard label="Siswa perlu dukungan" value={String(participants.filter((p) => p.progress < 50).length).padStart(2, "0")} delta="progres di bawah 50%" icon="users" tone="coral" />
            <MetricCard label="Jawaban perlu review" value={String(analytics?.needsReview ?? 0).padStart(2, "0")} delta="menunggu penilaian guru" icon="check" tone="yellow" />
            <MetricCard label="Kuis paling kuat" value={analytics?.topQuiz ?? "Belum ada"} delta="nilai rata-rata tertinggi" icon="trend" tone="violet" />
          </div>

          <div className="table-panel analytics-module-table">
            <div className="table-toolbar">
              <div>
                <strong>Rincian aktivitas per pertemuan</strong>
                <small>Respons dan nilai diperbarui dari aktivitas siswa.</small>
              </div>
              <StatusPill tone="violet">{analyticsRows.length} pertemuan</StatusPill>
            </div>
            {structureLoading ? (
              <div className="sync-loading">
                <Loader2 size={18} className="spin" />
                <span>Menyinkronkan analitik...</span>
              </div>
            ) : analyticsRows.length === 0 ? (
              <div className="empty-state">
                <Sparkles size={22} />
                <strong>Belum ada data analitik</strong>
                <p>Analitik muncul setelah ada pertemuan dan aktivitas siswa.</p>
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Pertemuan</th>
                    <th>Aktivitas</th>
                    <th>Respons</th>
                    <th>Selesai</th>
                    <th>Nilai</th>
                  </tr>
                </thead>
                <tbody>
                  {analyticsRows.map((row) => (
                    <tr key={row.moduleId}>
                      <td>
                        <strong>{row.module}</strong>
                      </td>
                      <td>{row.activities}</td>
                      <td>
                        <span className="response-type-pill">{row.response}</span>
                      </td>
                      <td>{row.completion}%</td>
                      <td>{row.score === null ? "—" : `${row.score}%`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="panel chart-panel" style={{ marginTop: 18 }}>
            <div className="chart-panel__head">
              <div>
                <strong>Progres penyelesaian</strong>
                <small>Pertemuan yang selesai per minggu</small>
              </div>
            </div>
            <ChartBars />
          </div>
        </>
      )}

      {showCreate && (
        <div className="modal-backdrop" onClick={() => setShowCreate(false)}>
          <form className="modal-card" onClick={(event) => event.stopPropagation()} onSubmit={handleCreate}>
            <div className="modal-card__head">
              <div>
                <div className="eyebrow">PEMBELAJARAN BARU</div>
                <h2>Mulai ruang belajar baru.</h2>
              </div>
              <button type="button" className="icon-button" onClick={() => setShowCreate(false)} aria-label="Tutup">
                ×
              </button>
            </div>
            <div className="form-grid">
              <div className="field field--full">
                <label>Judul pembelajaran</label>
                <input
                  autoFocus
                  value={createForm.title}
                  onChange={(event) => setCreateForm((current) => ({ ...current, title: event.target.value }))}
                  placeholder="Contoh: Pecahan Senilai — Kelas VII"
                />
              </div>
              <div className="field field--full">
                <label>Deskripsi</label>
                <textarea
                  value={createForm.description}
                  onChange={(event) => setCreateForm((current) => ({ ...current, description: event.target.value }))}
                  placeholder="Ringkasan singkat yang dilihat siswa."
                />
              </div>
              <div className="field">
                <label>Mata pelajaran</label>
                <select value={createForm.subject} onChange={(event) => setCreateForm((current) => ({ ...current, subject: event.target.value }))}>
                  <option>Matematika</option>
                  <option>IPA</option>
                  <option>Bahasa Indonesia</option>
                  <option>IPS</option>
                </select>
              </div>
              <div className="field">
                <label>Target kelas</label>
                <select value={createForm.grade} onChange={(event) => setCreateForm((current) => ({ ...current, grade: event.target.value }))}>
                  <option>Kelas VII</option>
                  <option>Kelas VIII</option>
                  <option>Kelas IX</option>
                </select>
              </div>
            </div>
            <button className="button button--primary" style={{ width: "100%", marginTop: 18 }} type="submit" disabled={creating}>
              {creating ? <Loader2 size={16} className="spin" /> : <ArrowRight size={16} />}
              {creating ? "Membuat..." : "Buat pembelajaran"}
            </button>
            <p className="modal-note">Pembelajaran dibuat di akunmu. Guru lain tidak dapat membuka atau mengubahnya.</p>
          </form>
        </div>
      )}

      {selectedParticipant && (
        <ParticipantDetailModal
          participant={selectedParticipant}
          submissions={submissions.filter((item) => item.studentId === selectedParticipant.id)}
          analytics={analytics?.rows ?? null}
          courseId={selectedCourse?.id ?? null}
          onClose={() => setSelectedParticipant(null)}
        />
      )}

      {toast && <Toast message={toast} onClose={() => setToast("")} />}
    </AppShell>
  );
}

function ParticipantDetailModal({
  participant,
  submissions,
  analytics,
  onClose,
}: {
  participant: ParticipantRow;
  submissions: StudentSubmissionRow[];
  analytics: ModuleAnalyticsRow[] | null;
  courseId: string | null;
  onClose: () => void;
}) {
  const rows = analytics?.map((row) => ({
    module: row.module,
    progress: row.completion,
    score: row.score,
    items: row.activities,
    response: row.response,
  })) ?? [];

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card participant-detail-modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal-card__head">
          <div>
            <div className="eyebrow">DETAIL PESERTA · DATABASE</div>
            <h2>{participant.name}</h2>
            <p>
              {participant.className} · {participant.lastActive} · {participant.activities} aktivitas tercatat
            </p>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Tutup detail">
            ×
          </button>
        </div>
        <div className="participant-detail-summary">
          <div>
            <strong>{participant.progress}%</strong>
            <small>progres course</small>
          </div>
          <div>
            <strong>{participant.score === null ? "—" : `${participant.score}%`}</strong>
            <small>nilai otomatis</small>
          </div>
          <div>
            <strong>{submissions.length}</strong>
            <small>jawaban tersimpan</small>
          </div>
        </div>
        <div className="eyebrow" style={{ marginTop: 24 }}>
          RINCIAN PER MODUL
        </div>
        <div className="participant-module-list">
          {rows.length === 0 ? (
            <p className="section-subtitle">Belum ada pertemuan yang bisa dianalisis.</p>
          ) : (
            rows.map((row) => (
              <div className="participant-module-row" key={row.module}>
                <div>
                  <strong>{row.module}</strong>
                  <small>{row.items}</small>
                  <span className="response-type-pill">{row.response}</span>
                </div>
                <div className="participant-module-score">
                  <strong>{row.progress}%</strong>
                  <small>{row.score === null ? "—" : `${row.score}%`}</small>
                </div>
              </div>
            ))
          )}
        </div>
        <div className="participant-submission-list">
          <div className="eyebrow">JAWABAN TERKIRIM</div>
          {submissions.length === 0 ? (
            <p className="section-subtitle">Belum ada jawaban tersimpan dari peserta ini.</p>
          ) : (
            submissions.map((item) => (
              <div className="participant-submission-row" key={item.id}>
                <div>
                  <strong>{item.blockTitle}</strong>
                  <small>{item.response || "Tanpa teks jawaban"} · {new Date(item.submittedAt).toLocaleString("id-ID")}</small>
                  {item.fileUrl && (
                    <a href={item.fileUrl} target="_blank" rel="noreferrer" className="text-link">
                      <ExternalLink size={12} /> {item.fileName || "Buka lampiran"}
                    </a>
                  )}
                </div>
                <span>{item.score === null ? "Review manual" : `${item.score}/${item.maxScore}`}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
