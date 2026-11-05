import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, BookOpen, FileText, FolderKanban, Plus, UsersRound } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { StatusPill } from "@/components/DashboardBits";
import { getMyCourses, getSessionProfile } from "@/lib/actions/dashboards";

export const metadata = { title: "Kelola pembelajaran · EduVerse" };

/**
 * Pintu masuk Course builder dari sidebar Workspace.
 * Daftar pembelajaran dibaca dari cache server, jadi membuka halaman ini
 * berulang kali tidak memicu query ulang ke database.
 */
export default async function KelolaPembelajaranPage() {
  const profile = await getSessionProfile();
  if (!profile || profile.role !== "TEACHER") redirect("/auth?next=/teacher/kelola-pembelajaran");

  const courses = await getMyCourses();

  return (
    <AppShell>
      <div className="page-topbar">
        <div>
          <div className="eyebrow">
            WORKSPACE GURU · COURSE BUILDER <span className="eyebrow-star">✦</span>
          </div>
          <h1>Kelola pembelajaran</h1>
          <p>Pilih pembelajaran untuk mengatur pertemuan, materi, dan kolaborasi.</p>
        </div>
        <div className="page-topbar__actions">
          <Link href="/teacher" className="button button--ghost button--small">
            <FolderKanban size={15} /> Ringkasan workspace
          </Link>
          <Link href="/teacher" className="button button--primary button--small">
            <Plus size={15} /> Buat pembelajaran
          </Link>
        </div>
      </div>

      {courses.length === 0 ? (
        <div className="panel empty-state kelola-empty">
          <span className="empty-state__icon">
            <BookOpen size={22} />
          </span>
          <strong>Belum ada pembelajaran</strong>
          <p>Buat pembelajaran pertamamu dari halaman Ringkasan, lalu kelola di sini.</p>
          <Link href="/teacher" className="button button--primary button--small">
            <Plus size={15} /> Buat pembelajaran
          </Link>
        </div>
      ) : (
        <div className="kelola-grid">
          {courses.map((course) => (
            <article className="kelola-card" key={course.id}>
              <div className="kelola-card__head">
                <span className={`kelola-card__art kelola-card__art--${course.accent}`}>
                  {course.accent === "teal" ? "±" : course.accent === "yellow" ? "↔" : "−2"}
                </span>
                <div className="kelola-card__copy">
                  <strong>{course.title}</strong>
                  <small>
                    {course.subject} · {course.grade}
                  </small>
                </div>
                <StatusPill tone={course.state === "PUBLISHED" ? "teal" : "yellow"}>
                  {course.state === "PUBLISHED" ? "Published" : "Draft"}
                </StatusPill>
              </div>

              <div className="kelola-card__meta">
                <span>
                  <BookOpen size={14} /> {course.moduleCount} pertemuan
                </span>
                <span>
                  <FileText size={14} /> {course.blockCount} materi
                </span>
                <span>
                  <UsersRound size={14} /> {course.studentCount} siswa
                </span>
              </div>

              <div className="kelola-card__actions">
                <Link
                  href={`/teacher/course/${course.slug}`}
                  className="button button--primary button--small"
                >
                  Buka course builder <ArrowRight size={14} />
                </Link>
                <Link href={`/learn/${course.slug}`} className="button button--ghost button--small">
                  Preview siswa
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </AppShell>
  );
}
