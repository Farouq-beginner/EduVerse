"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Activity,
  ArrowLeft,
  BookOpen,
  LogOut,
  Palette,
  Save,
  Settings2,
  ShieldCheck,
  UserPlus,
  Users,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { MetricCard, StatusPill } from "@/components/DashboardBits";
import { Toast } from "@/components/Toast";
import { getBrandSettings, saveBrandSettings, type BrandSettings } from "@/lib/storage";
import {
  getAdminStats,
  getTeacherAccounts,
  getSessionProfile,
  setTeacherActive,
  type TeacherAccountRow,
} from "@/lib/actions/dashboards";
import { logoutUser } from "@/lib/actions/auth";

export default function AdminPage() {
  const router = useRouter();
  const [brand, setBrand] = useState<BrandSettings>({ appName: "EduVerse", accent: "#7C5CFC" });
  const [toast, setToast] = useState("");
  const [adminName, setAdminName] = useState("Admin EduVerse");
  const [adminStats, setAdminStats] = useState<{
    teacherCount: number;
    studentCount: number;
    courseCount: number;
    enrollCount: number;
  } | null>(null);
  const [teacherRows, setTeacherRows] = useState<TeacherAccountRow[]>([]);
  const [fromDb, setFromDb] = useState(false);
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => setBrand(getBrandSettings()), []);

  useEffect(() => {
    let active = true;
    getSessionProfile().then((p) => {
      if (active && p?.fullName) setAdminName(p.fullName);
    });
    return () => { active = false; };
  }, []);

  async function handleLogout() {
    await logoutUser();
    router.push("/auth");
    router.refresh();
  }

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [stats, accounts] = await Promise.all([getAdminStats(), getTeacherAccounts()]);
        if (!active) return;
        if (stats.ok && stats.teacherCount != null) {
          setAdminStats({
            teacherCount: stats.teacherCount,
            studentCount: stats.studentCount ?? 0,
            courseCount: stats.courseCount ?? 0,
            enrollCount: stats.enrollCount ?? 0,
          });
          setFromDb(true);
        }
        if (accounts.length > 0) setTeacherRows(accounts);
      } catch {
        // DB belum aktif
      } finally {
        if (active) setLoadingStats(false);
      }
    })();
    return () => { active = false; };
  }, []);

  async function toggleTeacher(teacherId: string, activeNow: boolean) {
    const res = await setTeacherActive(teacherId, !activeNow);
    if (res.ok) {
      setTeacherRows((rows) =>
        rows.map((r) => (r.id === teacherId ? { ...r, status: !activeNow ? "Aktif" : "Nonaktif" } : r))
      );
      setToast(activeNow ? "Akun guru dinonaktifkan." : "Akun guru diaktifkan kembali.");
    } else {
      setToast(res.error ?? "Gagal mengubah status akun.");
    }
  }

  function saveBrand() {
    saveBrandSettings(brand);
    setToast("Branding demo diperbarui di browser ini.");
  }

  const adminInitials = adminName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();

  return (
    <AppShell role="admin">
      <div className="page-topbar">
        <div>
          <div className="eyebrow">PLATFORM CONTROL ROOM</div>
          <h1>Admin console</h1>
          <p>Pantau kesehatan ruang belajar dan jaga sistem tetap terasa ramah.</p>
        </div>
        <div className="page-topbar__actions">
          <Link href="/" className="button button--ghost button--small">
            <ArrowLeft size={15} /> Lihat landing
          </Link>
          <div className="user-pill">
            <span className="user-pill__avatar" style={{ background: "var(--violet)" }}>
              {adminInitials}
            </span>
            <div>
              <strong>{adminName}</strong>
              <small>Platform owner</small>
            </div>
          </div>
          <button className="button button--ghost button--small" onClick={handleLogout}>
            <LogOut size={15} /> Keluar
          </button>
        </div>
      </div>

      <section className="admin-hero">
        <div>
          <div className="eyebrow eyebrow--light">
            STATUS PLATFORM {fromDb && "· TERSINKRON DB"}
          </div>
          <h2>Semua ruang belajar bergerak dengan baik.</h2>
          <p>
            {adminStats
              ? `${adminStats.courseCount} pembelajaran, ${adminStats.teacherCount} guru, dan ${adminStats.enrollCount} enrollment aktif.`
              : loadingStats
              ? "Menghubungkan ke database..."
              : "Database belum terhubung atau belum ada data."}
          </p>
        </div>
        <div className="admin-hero__orb">
          <Activity size={34} />
        </div>
      </section>

      <div className="metrics-grid">
        <MetricCard label="Guru aktif" value={adminStats ? String(adminStats.teacherCount) : "—"} delta="dari database" icon="users" tone="violet" />
        <MetricCard label="Pembelajaran aktif" value={adminStats ? String(adminStats.courseCount) : "—"} delta="dari database" icon="check" tone="teal" />
        <MetricCard label="Peserta terdaftar" value={adminStats ? String(adminStats.studentCount) : "—"} delta="dari database" icon="trend" tone="yellow" />
        <MetricCard label="Enrollment aktif" value={adminStats ? String(adminStats.enrollCount) : "—"} delta="semua sistem normal" icon="clock" tone="coral" />
      </div>

      <div className="admin-grid">
        <div className="admin-panel" id="platform-activity">
          <div className="admin-panel__head">
            <div>
              <strong>Aktivitas platform</strong>
              <small>Peserta dan pembelajaran dalam 30 hari terakhir.</small>
            </div>
            <StatusPill tone="teal">Live</StatusPill>
          </div>
          <div className="mini-bar-chart">
            {[45, 58, 41, 68, 73, 62, 81, 76, 92, 88, 96, 100].map((value, index) => (
              <span key={index} className="mini-bar" style={{ height: `${value}%` }} />
            ))}
          </div>
          <div className="admin-kpis">
            <div className="admin-kpi"><strong>{adminStats?.enrollCount ?? "—"}</strong><small>enrollment aktif</small></div>
            <div className="admin-kpi"><strong>{adminStats?.courseCount ?? "—"}</strong><small>pembelajaran</small></div>
            <div className="admin-kpi"><strong>{adminStats?.teacherCount ?? "—"}</strong><small>guru aktif</small></div>
            <div className="admin-kpi"><strong>{adminStats?.studentCount ?? "—"}</strong><small>siswa terdaftar</small></div>
          </div>
        </div>

        <div className="admin-panel" id="branding-settings">
          <div className="admin-panel__head">
            <div>
              <strong>Branding platform</strong>
              <small>Token dasar dapat diganti Admin saat siap production.</small>
            </div>
            <Palette size={18} color="var(--violet)" />
          </div>
          <div className="admin-settings">
            <div className="field">
              <label>Nama aplikasi</label>
              <input value={brand.appName} onChange={(event) => setBrand({ ...brand, appName: event.target.value })} />
            </div>
            <div className="settings-row">
              <div className="settings-row__copy">
                <strong>Warna utama</strong>
                <small>Dipakai pada tombol, progress, dan link.</small>
              </div>
              <input className="color-input" type="color" value={brand.accent} onChange={(event) => setBrand({ ...brand, accent: event.target.value })} />
            </div>
            <div className="settings-row">
              <div className="settings-row__copy">
                <strong>Tema default</strong>
                <small>Preferensi siswa tetap mengikuti perangkat.</small>
              </div>
              <span style={{ color: "var(--violet)", fontSize: ".72rem", fontWeight: 800 }}>Light</span>
            </div>
            <button className="button button--primary" onClick={saveBrand}>
              <Save size={15} /> Simpan branding
            </button>
          </div>
          <div className="studio-note" style={{ marginTop: 17 }}>
            <ShieldCheck size={15} /> Demo mode: perubahan branding tersimpan di browser.
          </div>
        </div>
      </div>

      <div className="admin-grid">
        <div className="admin-panel" id="teacher-accounts">
          <div className="admin-panel__head">
            <div>
              <strong>Teacher &amp; admin</strong>
              <small>Kelola peran dan status akses workspace.</small>
            </div>
            <button className="button button--ghost button--small" onClick={() => setToast("Undangan guru siap dibuat.")}>
              <UserPlus size={14} /> Undang guru
            </button>
          </div>
          <div className="admin-teacher-list">
            {teacherRows.length > 0 ? (
              teacherRows.map((t, index) => (
                <div className="admin-teacher" key={t.id}>
                  <span className={`table-avatar ${index === 1 ? "table-avatar--teal" : index === 2 ? "table-avatar--yellow" : ""}`}>
                    {t.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                  </span>
                  <div className="admin-teacher__copy">
                    <strong>{t.name}</strong>
                    <small>{t.courseCount} pembelajaran</small>
                  </div>
                  <StatusPill tone={t.status === "Aktif" ? "teal" : "yellow"}>{t.status}</StatusPill>
                  <button className="button button--ghost button--small" onClick={() => toggleTeacher(t.id, t.status === "Aktif")}>
                    {t.status === "Aktif" ? "Nonaktifkan" : "Aktifkan"}
                  </button>
                </div>
              ))
            ) : (
              <div className="empty-state" style={{ padding: "24px 0" }}>
                <Users size={22} color="var(--muted)" />
                <p style={{ color: "var(--muted)", fontSize: ".8rem", marginTop: 8 }}>
                  {loadingStats
                    ? "Memuat data guru dari database..."
                    : fromDb
                    ? "Belum ada akun guru. Guru mendaftar lewat halaman /auth."
                    : "Database belum terhubung. Cek koneksi."}
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="admin-panel" id="audit-log">
          <div className="admin-panel__head">
            <div>
              <strong>Audit log terbaru</strong>
              <small>Tindakan penting yang perlu terlihat.</small>
            </div>
            <Settings2 size={18} color="var(--muted)" />
          </div>
          <div className="admin-log">
            <div className="empty-state" style={{ padding: "24px 0" }}>
              <BookOpen size={22} color="var(--muted)" />
              <p style={{ color: "var(--muted)", fontSize: ".8rem", marginTop: 8 }}>
                Audit log akan muncul setelah ada aktivitas administratif di platform.
              </p>
            </div>
          </div>
        </div>
      </div>

      {toast && <Toast message={toast} onClose={() => setToast("")} />}
    </AppShell>
  );
}
