"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BookOpen,
  ChevronRight,
  Clock3,
  Link2,
  Loader2,
  LogOut,
  Plus,
  RefreshCw,
  Sparkles,
  X,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { ProgressRing, StatusPill } from "@/components/DashboardBits";
import { Toast } from "@/components/Toast";
import type { StudentCourseCard } from "@/lib/actions/dashboards";
import { getMyEnrollments } from "@/lib/actions/dashboards";
import { joinCourseByToken, leaveCourse } from "@/lib/actions/enrollment";
import { logoutUser } from "@/lib/actions/auth";

export default function StudentDashboardPage() {
  const router = useRouter();
  const [courses, setCourses] = useState<StudentCourseCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [showJoin, setShowJoin] = useState(false);
  const [link, setLink] = useState("");
  const [className, setClassName] = useState("VII-B");
  const [joining, setJoining] = useState(false);
  const [toast, setToast] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "done">("all");

  const load = useCallback(async () => {
    setLoading(true);
    const data = await getMyEnrollments();
    setCourses(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleJoin(event: React.FormEvent) {
    event.preventDefault();
    if (joining || !link.trim()) return;
    setJoining(true);
    try {
      const result = await joinCourseByToken({ tokenOrSlug: link.trim(), className });
      if (!result.ok) {
        setToast(result.error ?? "Gagal bergabung.");
        return;
      }
      setToast(
        result.already
          ? "Kamu sudah bergabung di pembelajaran ini."
          : "Berhasil bergabung! Pembelajaran muncul di dashboard."
      );
      setLink("");
      setShowJoin(false);
      await load();
    } catch {
      setToast("Koneksi bermasalah. Coba lagi.");
    } finally {
      setJoining(false);
    }
  }

  async function handleLeave(courseId: string) {
    if (!confirm("Sembunyikan pembelajaran ini dari dashboard? Riwayat belajarmu tetap tersimpan.")) return;
    const result = await leaveCourse(courseId);
    if (result.ok) {
      setToast("Pembelajaran disembunyikan dari dashboard.");
      await load();
    } else {
      setToast(result.error ?? "Gagal.");
    }
  }

  async function handleLogout() {
    await logoutUser();
    router.push("/auth");
    router.refresh();
  }

  const visible = courses.filter((c) => {
    const matchSearch = `${c.title} ${c.teacherName}`.toLowerCase().includes(search.toLowerCase());
    const matchFilter =
      filter === "all" ? true : filter === "done" ? c.progress >= 100 : c.progress < 100;
    return matchSearch && matchFilter;
  });

  return (
    <AppShell role="student">
      <div className="student-wrap">
        <div className="page-topbar">
          <div>
            <div className="eyebrow">RUANG BELAJAR SISWA</div>
            <h1>Dashboard belajarmu</h1>
            <p>Semua pembelajaran yang kamu ikuti lewat link guru tersimpan di akunmu.</p>
          </div>
          <div className="page-topbar__actions">
            <button className="button button--primary" onClick={() => setShowJoin(true)}>
              <Plus size={16} /> Tambahkan Pembelajaran
            </button>
            <button className="icon-button" onClick={() => load()} aria-label="Segarkan">
              <RefreshCw size={17} />
            </button>
            <button className="button button--ghost button--small" onClick={handleLogout}>
              <LogOut size={15} /> Keluar
            </button>
          </div>
        </div>

        <div className="student-hero-card" style={{ alignItems: "center", gridTemplateColumns: "1fr" }}>
          <div className="student-hero-card__copy">
            <div className="eyebrow">TAMBAHKAN PEMBELAJARAN</div>
            <h2>Punya link dari gurumu?</h2>
            <p>Masukkan link pembelajaran untuk langsung bergabung dan mulai belajar.</p>
          </div>
        </div>

        <div className="section-title">
          <div>
            <div className="eyebrow">PEMBELAJARANKU</div>
            <h2>{courses.length} pembelajaran diikuti</h2>
          </div>
          <div className="student-filters">
            <div className="search-field">
              <input placeholder="Cari judul atau guru..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}>
              <option value="all">Semua</option>
              <option value="active">Sedang berjalan</option>
              <option value="done">Selesai</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="empty-state">
            <Loader2 size={24} className="spin" />
            <strong>Memuat pembelajaran...</strong>
          </div>
        ) : visible.length === 0 ? (
          <div className="empty-state">
            <span className="empty-state__icon">
              <Link2 size={24} />
            </span>
            <strong>Belum ada pembelajaran</strong>
            <p>Klik “Tambahkan Pembelajaran” lalu masukkan link dari gurumu.</p>
          </div>
        ) : (
          <div className="student-course-grid">
            {visible.map((c) => (
              <div className="student-course-card" key={c.courseId}>
                <div className="student-course-card__top">
                  <StatusPill tone={c.access === "OPEN" ? "teal" : "coral"}>
                    {c.access === "OPEN" ? "Akses terbuka" : "Terkunci"}
                  </StatusPill>
                  <button className="icon-button icon-button--tiny" onClick={() => handleLeave(c.courseId)} aria-label="Sembunyikan">
                    <X size={15} />
                  </button>
                </div>
                <div className="student-course-card__body">
                  <span className="course-art">−2</span>
                  <div>
                    <strong>{c.title}</strong>
                    <small>
                      {c.subject} · {c.grade} · {c.teacherName}
                    </small>
                  </div>
                </div>
                <p className="student-course-card__desc">{c.description}</p>
                <div className="student-course-card__meta">
                  <ProgressRing value={c.progress} size="sm" />
                  <div className="student-course-card__stats">
                    <span>
                      <Clock3 size={12} /> Bergabung {new Date(c.joinedAt).toLocaleDateString("id-ID")}
                    </span>
                    <span>
                      <BookOpen size={12} /> {c.progress}% selesai
                    </span>
                  </div>
                </div>
                <Link href={`/learn/${c.slug}`} className="button button--primary student-course-card__cta">
                  {c.progress > 0 ? "Lanjutkan Belajar" : "Buka Pembelajaran"} <ArrowRight size={15} />
                </Link>
              </div>
            ))}
          </div>
        )}

        <div className="sync-card" style={{ marginTop: 24 }}>
          <div className="sync-card__top">
            <RefreshCw size={16} />
            <strong>Tersinkron dengan akun</strong>
            <span className="sync-dot" />
          </div>
          <p>Progres dan pembelajaranmu tersimpan di server. Login dari perangkat lain dengan akun yang sama akan memuat data yang sama.</p>
        </div>
      </div>

      {showJoin && (
        <div className="modal-backdrop" onClick={() => setShowJoin(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-card__head">
              <div>
                <div className="eyebrow">TAMBAHKAN PEMBELAJARAN</div>
                <h2>Masukkan link dari guru</h2>
              </div>
              <button className="icon-button" onClick={() => setShowJoin(false)} aria-label="Tutup">
                ×
              </button>
            </div>
            <form onSubmit={handleJoin}>
              <div className="field">
                <label>Link pembelajaran</label>
                <input
                  autoFocus
                  value={link}
                  onChange={(e) => setLink(e.target.value)}
                  placeholder="https://.../learn/operasi-bilangan-bulat-a8f3"
                />
              </div>
              <div className="field" style={{ marginTop: 14 }}>
                <label>Kelas (opsional)</label>
                <select value={className} onChange={(e) => setClassName(e.target.value)}>
                  <option>VII-A</option>
                  <option>VII-B</option>
                  <option>VII-C</option>
                </select>
              </div>
              <p className="join-copy" style={{ marginTop: 10 }}>
                Link biasanya berformat <code>/learn/[slug]-[kode]</code> dan dibagikan guru lewat kelas.
              </p>
              <button className="button button--primary" style={{ width: "100%", marginTop: 16 }} type="submit" disabled={joining}>
                {joining ? <Loader2 size={16} className="spin" /> : <Sparkles size={16} />}
                {joining ? "Memproses..." : "Gabung Pembelajaran"}
              </button>
            </form>
          </div>
        </div>
      )}

      {toast && <Toast message={toast} onClose={() => setToast("")} />}
    </AppShell>
  );
}
