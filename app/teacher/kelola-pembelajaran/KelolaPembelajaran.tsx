"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  FileText,
  FolderKanban,
  Loader2,
  Plus,
  Trash2,
  UsersRound,
  X,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { StatusPill } from "@/components/DashboardBits";
import { Toast } from "@/components/Toast";
import {
  createTeacherCourse,
  deleteTeacherCourse,
  type TeacherCourseCard,
} from "@/lib/actions/dashboards";

type Form = { title: string; subject: string; grade: string; description: string };

const emptyForm: Form = { title: "", subject: "Matematika", grade: "Kelas VII", description: "" };

const accents: Record<string, string> = { violet: "−2", teal: "±", yellow: "↔", coral: "0" };

export function KelolaPembelajaran({ initialCourses }: { initialCourses: TeacherCourseCard[] }) {
  const router = useRouter();
  const [courses, setCourses] = useState(initialCourses);
  const [form, setForm] = useState<Form | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState("");

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return courses;
    return courses.filter((course) =>
      `${course.title} ${course.subject} ${course.grade}`.toLowerCase().includes(term)
    );
  }, [courses, search]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!form || creating) return;
    if (!form.title.trim()) {
      setToast("Judul pembelajaran wajib diisi.");
      return;
    }
    setCreating(true);
    const result = await createTeacherCourse(form);
    setCreating(false);
    if (!result.ok || !result.course) {
      setToast(result.error ?? "Gagal membuat pembelajaran.");
      return;
    }
    setCourses((current) => [result.course!, ...current]);
    setForm(null);
    setToast("Pembelajaran dibuat. Yuk isi pertemuan pertamamu.");
    router.push(`/teacher/course/${result.course.slug}`);
  }

  async function remove(course: TeacherCourseCard) {
    const yakin = window.confirm(
      `Hapus pembelajaran "${course.title}"? Pertemuan, materi, jawaban siswa, kolaborasi, dan room kelompok ikut terhapus dan tidak bisa dikembalikan.`
    );
    if (!yakin) return;
    setDeleting(course.id);
    const result = await deleteTeacherCourse(course.id);
    setDeleting(null);
    if (!result.ok) {
      setToast(result.error ?? "Gagal menghapus pembelajaran.");
      return;
    }
    setCourses((current) => current.filter((item) => item.id !== course.id));
    setToast("Pembelajaran dihapus.");
    router.refresh();
  }

  return (
    <AppShell>
      <div className="page-topbar">
        <div>
          <div className="eyebrow">
            WORKSPACE GURU · COURSE BUILDER <span className="eyebrow-star">✦</span>
          </div>
          <h1>Kelola pembelajaran</h1>
          <p>Buat, buka, dan hapus pembelajaran. Semua pertemuan dan kolaborasi ada di sini.</p>
        </div>
        <div className="page-topbar__actions">
          <Link href="/teacher" className="button button--ghost button--small">
            <FolderKanban size={15} /> Ringkasan workspace
          </Link>
          <button className="button button--primary button--small" onClick={() => setForm({ ...emptyForm })}>
            <Plus size={15} /> Buat pembelajaran
          </button>
        </div>
      </div>

      {courses.length > 0 && (
        <div className="account-toolbar">
          <input
            className="kelola-search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Cari pembelajaran, mapel, atau kelas..."
          />
          <small className="field-hint">{filtered.length} dari {courses.length} pembelajaran</small>
        </div>
      )}

      {courses.length === 0 ? (
        <div className="panel empty-state kelola-empty">
          <span className="empty-state__icon">
            <BookOpen size={22} />
          </span>
          <strong>Belum ada pembelajaran</strong>
          <p>Buat pembelajaran pertamamu langsung dari halaman ini.</p>
          <button className="button button--primary button--small" onClick={() => setForm({ ...emptyForm })}>
            <Plus size={15} /> Buat pembelajaran
          </button>
        </div>
      ) : (
        <div className="kelola-grid">
          {filtered.map((course) => (
            <article className="kelola-card" key={course.id}>
              <div className="kelola-card__head">
                <span className={`kelola-card__art kelola-card__art--${course.accent}`}>
                  {accents[course.accent] ?? "✦"}
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
                <Link href={`/teacher/course/${course.slug}`} className="button button--primary button--small">
                  Buka course builder <ArrowRight size={14} />
                </Link>
                <Link href={`/learn/${course.slug}`} className="button button--ghost button--small">
                  Preview siswa
                </Link>
                <button
                  className="button button--ghost button--small button--danger"
                  onClick={() => remove(course)}
                  disabled={deleting === course.id}
                >
                  {deleting === course.id ? (
                    <Loader2 size={14} className="spin" />
                  ) : (
                    <Trash2 size={14} />
                  )}{" "}
                  Hapus
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {form && (
        <div className="modal-backdrop" onClick={() => setForm(null)}>
          <form className="modal-card" onClick={(event) => event.stopPropagation()} onSubmit={submit}>
            <div className="modal-card__head">
              <div>
                <div className="eyebrow">PEMBELAJARAN BARU</div>
                <h2>Mulai ruang belajar baru.</h2>
              </div>
              <button type="button" className="icon-button" onClick={() => setForm(null)} aria-label="Tutup">
                <X size={16} />
              </button>
            </div>
            <div className="form-grid" style={{ marginTop: 16 }}>
              <div className="field field--full">
                <label>Judul pembelajaran</label>
                <input
                  autoFocus
                  value={form.title}
                  onChange={(event) => setForm({ ...form, title: event.target.value })}
                  placeholder="Contoh: Pecahan Senilai — Kelas VII"
                />
              </div>
              <div className="field field--full">
                <label>Deskripsi</label>
                <textarea
                  value={form.description}
                  onChange={(event) => setForm({ ...form, description: event.target.value })}
                  placeholder="Ringkasan singkat yang dilihat siswa."
                />
              </div>
              <div className="field">
                <label>Mata pelajaran</label>
                <select value={form.subject} onChange={(event) => setForm({ ...form, subject: event.target.value })}>
                  <option>Matematika</option>
                  <option>IPA</option>
                  <option>Bahasa Indonesia</option>
                  <option>IPS</option>
                </select>
              </div>
              <div className="field">
                <label>Target kelas</label>
                <select value={form.grade} onChange={(event) => setForm({ ...form, grade: event.target.value })}>
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

      {toast && <Toast message={toast} onClose={() => setToast("")} />}
    </AppShell>
  );
}
