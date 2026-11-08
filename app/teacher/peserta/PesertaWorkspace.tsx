"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  ExternalLink,
  FileText,
  Loader2,
  Search,
  Users,
  XCircle,
} from "lucide-react";
import { StatusPill } from "@/components/DashboardBits";
import { Toast } from "@/components/Toast";
import {
  getMyCourses,
  getParticipantDirectory,
  getParticipantReport,
  type ParticipantDirectoryRow,
  type ParticipantReport,
  type TeacherCourseCard,
} from "@/lib/actions/dashboards";

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/**
 * Kelola peserta milik guru: seluruh siswa yang terdaftar di pembelajarannya,
 * lengkap dengan laporan jawaban per pertemuan (kuis dan tugas).
 */
export function PesertaWorkspace() {
  const [courses, setCourses] = useState<TeacherCourseCard[]>([]);
  const [rows, setRows] = useState<ParticipantDirectoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [courseFilter, setCourseFilter] = useState("all");
  const [toast, setToast] = useState("");

  const [selected, setSelected] = useState<ParticipantDirectoryRow | null>(null);
  const [report, setReport] = useState<ParticipantReport | null>(null);
  const [reportLoading, setReportLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [courseList, directory] = await Promise.all([getMyCourses(), getParticipantDirectory()]);
    setCourses(courseList);
    setRows(directory);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((row) => {
      const matchTerm =
        !term ||
        `${row.name} ${row.nickname ?? ""} ${row.className}`.toLowerCase().includes(term);
      const matchCourse =
        courseFilter === "all" || row.courseTitles.includes(courseFilter);
      return matchTerm && matchCourse;
    });
  }, [rows, search, courseFilter]);

  async function openReport(row: ParticipantDirectoryRow) {
    setSelected(row);
    setReport(null);
    setReportLoading(true);
    const courseId = courses.find((course) => course.title === courseFilter)?.id;
    const result = await getParticipantReport(row.id, courseDomainFilter(courseFilter, courseId));
    setReportLoading(false);
    if (!result.ok || !result.report) {
      setToast(result.error ?? "Gagal memuat laporan peserta.");
      return;
    }
    setReport(result.report);
  }

  function exportCSV() {
    const csv = [
      "Nama,Nama panggilan,Kelas,Pembelajaran,Progres,Status",
      ...filtered.map(
        (row) =>
          `${row.name},${row.nickname ?? ""},${row.className},"${row.courseTitles.join(" | ")}",${row.avgProgress}%,Aktif`
      ),
    ].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "eduverse-peserta.csv";
    anchor.click();
    URL.revokeObjectURL(url);
    setToast("Daftar peserta diunduh.");
  }

  if (selected) {
    return (
      <div>
        <button className="button button--ghost button--small" onClick={() => { setSelected(null); setReport(null); }}>
          <ArrowLeft size={15} /> Kembali ke daftar peserta
        </button>

        <div className="page-topbar" style={{ marginTop: 16 }}>
          <div>
            <div className="eyebrow">LAPORAN PESERTA · GURU</div>
            <h1>{selected.name}</h1>
            <p>
              {selected.className}
              {selected.nickname ? ` · ${selected.nickname}` : ""} · {selected.lastActive} ·{" "}
              {selected.courseCount} pembelajaran
            </p>
          </div>
          <div className="page-topbar__actions">
            <StatusPill tone="violet">{selected.avgProgress}% rata-rata progres</StatusPill>
          </div>
        </div>

        {reportLoading ? (
          <div className="sync-loading">
            <Loader2 size={18} className="spin" />
            <span>Memuat seluruh jawaban peserta...</span>
          </div>
        ) : !report ? (
          <div className="panel empty-state">
            <FileText size={22} />
            <strong>Laporan belum tersedia</strong>
            <p>Belum ada data jawaban dari peserta ini pada pembelajaranku.</p>
          </div>
        ) : (
          <>
            <div className="metrics-grid">
              <div className="metric-card metric-card--violet">
                <div className="metric-card__value">{report.totals.progress}%</div>
                <div className="metric-card__label">progres keseluruhan</div>
                <div className="metric-card__delta">
                  {report.totals.completed}/{report.totals.blocks} aktivitas selesai
                </div>
              </div>
              <div className="metric-card metric-card--teal">
                <div className="metric-card__value">
                  {report.totals.avgScore === null ? "—" : `${report.totals.avgScore}%`}
                </div>
                <div className="metric-card__label">rata-rata nilai kuis</div>
                <div className="metric-card__delta">dari attempt tersimpan</div>
              </div>
              <div className="metric-card metric-card--yellow">
                <div className="metric-card__value">{report.totals.submissions}</div>
                <div className="metric-card__label">jawaban tugas</div>
                <div className="metric-card__delta">teks dan lampiran</div>
              </div>
              <div className="metric-card metric-card--coral">
                <div className="metric-card__value">{report.totals.meetings}</div>
                <div className="metric-card__label">pertemuan termonitor</div>
                <div className="metric-card__delta">lintas pembelajaran</div>
              </div>
            </div>

            <div className="eyebrow" style={{ marginTop: 26 }}>
              RINCIAN JAWABAN PER PERTEMUAN
            </div>

            {report.meetings.length === 0 ? (
              <div className="panel empty-state">
                <FileText size={22} />
                <strong>Belum ada pertemuan</strong>
                <p>Tambahkan pertemuan dan aktivitas agar jawaban peserta tercatat.</p>
              </div>
            ) : (
              <div className="peserta-report">
                {report.meetings.map((meeting) => (
                  <details className="peserta-meeting" key={meeting.moduleId} open>
                    <summary>
                      <div>
                        <strong>{meeting.module}</strong>
                        <small>{meeting.course}</small>
                      </div>
                      <span className="peserta-meeting__count">
                        {meeting.blocks.filter((block) => block.completed).length}/{meeting.blocks.length} selesai
                      </span>
                    </summary>
                    <div className="peserta-blocks">
                      {meeting.blocks.map((block) => (
                        <div className="peserta-block" key={block.blockId}>
                          <div className="peserta-block__head">
                            <div>
                              <strong>{block.title}</strong>
                              <small>{block.type.toLowerCase()}</small>
                            </div>
                            <StatusPill tone={block.completed ? "teal" : "yellow"}>
                              {block.completed ? "Selesai" : "Belum selesai"}
                            </StatusPill>
                          </div>

                          {block.quizzes.length > 0 && (
                            <div className="peserta-quiz">
                              <div className="peserta-quiz__head">
                                <span>Attempt kuis</span>
                                <span>{block.quizzes.length} kali</span>
                              </div>
                              {block.quizzes.map((quiz) => (
                                <div className="peserta-attempt" key={quiz.id}>
                                  <div className="peserta-attempt__top">
                                    <strong>
                                      Attempt #{quiz.attemptNumber} · {quiz.score}/{quiz.totalPoints}
                                    </strong>
                                    <StatusPill tone={quiz.passed ? "teal" : "coral"}>
                                      {quiz.passed ? "Lulus" : "Belum lulus"}
                                    </StatusPill>
                                    <small>{new Date(quiz.submittedAt).toLocaleString("id-ID")}</small>
                                  </div>
                                  <table className="peserta-answers">
                                    <thead>
                                      <tr>
                                        <th>Soal</th>
                                        <th>Jawaban siswa</th>
                                        <th>Kunci</th>
                                        <th />
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {quiz.answers.map((answer, index) => (
                                        <tr key={`${quiz.id}-${index}`}>
                                          <td>{answer.question}</td>
                                          <td>{answer.given}</td>
                                          <td>{answer.correct}</td>
                                          <td>
                                            {answer.isCorrect ? (
                                              <CheckCircle2 size={15} color="var(--teal)" />
                                            ) : (
                                              <XCircle size={15} color="var(--coral)" />
                                            )}
                                          </td>
                                        </tr>
                                      ))}
                                      {quiz.answers.length === 0 && (
                                        <tr>
                                          <td colSpan={4}>Jawaban detail belum tersimpan untuk attempt ini.</td>
                                        </tr>
                                      )}
                                    </tbody>
                                  </table>
                                </div>
                              ))}
                            </div>
                          )}

                          {block.submission && (
                            <div className="peserta-submission">
                              <div className="peserta-submission__top">
                                <strong>Jawaban tugas</strong>
                                <StatusPill tone={block.submission.score === null ? "yellow" : "teal"}>
                                  {block.submission.score === null
                                    ? "Belum dinilai"
                                    : `${block.submission.score}/${block.submission.maxScore}`}
                                </StatusPill>
                                <small>{new Date(block.submission.submittedAt).toLocaleString("id-ID")}</small>
                              </div>
                              <p>{block.submission.response || "Tanpa teks jawaban."}</p>
                              {block.submission.fileUrl && (
                                <a
                                  href={block.submission.fileUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-link"
                                >
                                  <ExternalLink size={13} /> {block.submission.fileName ?? "Buka lampiran"}
                                </a>
                              )}
                            </div>
                          )}

                          {block.quizzes.length === 0 && !block.submission && (
                            <p className="peserta-block__empty">
                              Belum ada jawaban tersimpan untuk aktivitas ini.
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </details>
                ))}
              </div>
            )}
          </>
        )}

        {toast && <Toast message={toast} onClose={() => setToast("")} />}
      </div>
    );
  }

  return (
    <div>
      <div className="page-topbar">
        <div>
          <div className="eyebrow">PESERTA PEMBELAJARAN · WORKSPACE GURU</div>
          <h1>Kelola peserta</h1>
          <p>Semua siswa di pembelajaranku, lengkap dengan progres dan jawaban tiap pertemuan.</p>
        </div>
        <div className="page-topbar__actions">
          <Link href="/teacher" className="button button--ghost button--small">
            <ArrowLeft size={15} /> Ringkasan
          </Link>
          <button className="button button--primary button--small" onClick={exportCSV} disabled={!filtered.length}>
            <Download size={15} /> Unduh CSV
          </button>
        </div>
      </div>

      <div className="table-panel">
        <div className="table-toolbar">
          <div className="search-field">
            <Search size={15} />
            <input
              placeholder="Cari nama, nickname, atau kelas..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <div className="student-filters">
            <select value={courseFilter} onChange={(event) => setCourseFilter(event.target.value)}>
              <option value="all">Semua pembelajaran</option>
              {courses.map((course) => (
                <option key={course.id} value={course.title}>
                  {course.title}
                </option>
              ))}
            </select>
            <StatusPill tone="teal">{filtered.length} peserta</StatusPill>
          </div>
        </div>

        {loading ? (
          <div className="sync-loading">
            <Loader2 size={18} className="spin" />
            <span>Memuat peserta dari database...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <Users size={24} />
            <strong>{rows.length === 0 ? "Belum ada peserta" : "Tidak ada peserta yang cocok"}</strong>
            <p>
              {rows.length === 0
                ? "Bagikan link pembelajaran. Siswa yang bergabung akan muncul di sini."
                : "Coba kata kunci atau pilih pembelajaran lain."}
            </p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Peserta</th>
                <th>Pembelajaran</th>
                <th>Progres</th>
                <th>Terakhir aktif</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((row, index) => (
                <tr key={row.id}>
                  <td>
                    <div className="student-cell">
                      <span
                        className={`table-avatar ${
                          index % 3 === 1 ? "table-avatar--teal" : index % 3 === 2 ? "table-avatar--yellow" : ""
                        }`}
                      >
                        {initials(row.name)}
                      </span>
                      <div>
                        <strong>{row.name}</strong>
                        <small style={{ display: "block", marginTop: 3, color: "var(--muted)", fontWeight: 400 }}>
                          {row.nickname ? `${row.nickname} · ` : ""}
                          {row.className}
                        </small>
                      </div>
                    </div>
                  </td>
                  <td>{row.courseTitles.join(", ")}</td>
                  <td>
                    <div className="progress-cell">
                      <div className="table-progress">
                        <span style={{ width: `${row.avgProgress}%` }} />
                      </div>
                      {row.avgProgress}%
                    </div>
                  </td>
                  <td>{row.lastActive}</td>
                  <td>
                    <button className="button button--ghost button--small" onClick={() => openReport(row)}>
                      <FileText size={14} /> Lihat jawaban
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {toast && <Toast message={toast} onClose={() => setToast("")} />}
    </div>
  );
}

/** Nama course dipakai sebagai filter; ubah ke id agar server memfilter tepat. */
function courseDomainFilter(courseTitle: string, courseId?: string) {
  return courseTitle === "all" ? undefined : courseId;
}
