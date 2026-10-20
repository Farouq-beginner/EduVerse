"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, BookOpen, GraduationCap, Loader2, ShieldCheck, UsersRound } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";
import { Toast } from "@/components/Toast";
import { loginUser, registerUser } from "@/lib/actions/auth";

type Role = "TEACHER" | "STUDENT" | "ADMIN";
type Mode = "login" | "register";

/**
 * Tentukan tujuan setelah login. Menghormati ?next= dari middleware, tetapi
 * hanya untuk path internal yang memang milik peran tersebut (anti open-redirect).
 */
function resolveDestination(role?: string): string {
  const fallback =
    role === "ADMIN" ? "/admin" : role === "TEACHER" ? "/teacher" : "/student";
  if (typeof window === "undefined") return fallback;
  const next = new URLSearchParams(window.location.search).get("next");
  if (!next || !next.startsWith("/") || next.startsWith("//")) return fallback;
  if (role === "ADMIN" && next.startsWith("/admin")) return next;
  if (role === "TEACHER" && next.startsWith("/teacher")) return next;
  if (role === "STUDENT" && next.startsWith("/student")) return next;
  return fallback;
}

/**
 * Cek apakah user sudah memiliki profile lengkap (sudah login dengan role yang terdefinisi).
 * Jika belum, redirect ke registrasi/penyelesaian profil rather than showing form.
 */
function checkCompletedProfile(role?: string): string | null {
  if (typeof window === "undefined") return null;
  // Jika ada role yang valid, user sudah lengkap, arahkan ke dashboard
  if (role && (role === "ADMIN" || role === "TEACHER" || role === "STUDENT")) {
    return resolveDestination(role);
  }
  // Jika role belum terdefinisi, biarkan form tampil untuk penyelesaian
  return null;
}

export default function AuthPage() {
  const router = useRouter();
  const [role, setRole] = useState<Role>("STUDENT");
  const [mode, setMode] = useState<Mode>("login");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [className, setClassName] = useState("VII-B");
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (loading) return;

    if (!email.includes("@")) return setToast("Email tidak valid.");
    if (password.length < 8) return setToast("Password minimal 8 karakter.");
    if (mode === "register") {
      if (!fullName.trim()) return setToast("Nama lengkap wajib diisi.");
      if (password !== confirm) return setToast("Konfirmasi password tidak sama.");
    }

    setLoading(true);
    try {
      const result =
        mode === "login"
          ? await loginUser({ email, password })
          : role === "ADMIN"
          ? { ok: false, error: "Admin daftar melalui bootstrap, bukan form publik." }
          : await registerUser({
              fullName,
              email,
              password,
              className: role === "STUDENT" ? className : undefined,
              role: role === "TEACHER" || role === "STUDENT" ? role : "TEACHER",
            });

      if (!result.ok) {
        setToast(result.error ?? "Terjadi kesalahan.");
        return;
      }

      // Redirect ke dashboard sesuai role setelah sukses.
      // router.replace (bukan push) supaya halaman login tidak tertinggal di
      // riwayat browser — tombol "kembali" tidak lagi memunculkan form login.
      const dest = resolveDestination(result.role);
      router.replace(dest);
      router.refresh();
    } catch {
      setToast("Koneksi bermasalah. Coba lagi.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-visual">
        <Link href="/" className="back-link auth-visual__back">
          <ArrowLeft size={14} /> Kembali ke beranda
        </Link>
        <div className="eyebrow eyebrow--light">MASUK KE EDUVERSE</div>
        <h1>Satu akun, satu peran, pengalaman yang berbeda.</h1>
        <p>Guru merancang kelas. Siswa belajar lewat link. Admin menjaga semuanya tetap sehat.</p>
        <div className="auth-visual__art">
          <span className="join-orbit__number">−2</span>
          <span className="join-orbit__plus">+5</span>
          <span className="join-orbit__zero">0</span>
        </div>
        <div className="auth-admin-note">
          <ShieldCheck size={14} /> Pendaftaran Admin hanya lewat proses bootstrap admin, tidak lewat formulir publik.
        </div>
      </div>

      <div className="auth-form-wrap">
        <BrandMark />
        <div className="auth-tabs">
          <button className={`auth-tab ${mode === "login" ? "is-active" : ""}`} onClick={() => setMode("login")}>
            Masuk
          </button>
          <button
            className={`auth-tab ${mode === "register" ? "is-active" : ""}`}
            onClick={() => setMode("register")}
          >
            Daftar
          </button>
        </div>

        <div className="auth-role-picker">
          <button
            className={`auth-role ${role === "STUDENT" ? "is-active" : ""}`}
            onClick={() => setRole("STUDENT")}
            type="button"
          >
            <UsersRound size={18} /> Siswa
          </button>
          <button
            className={`auth-role ${role === "TEACHER" ? "is-active" : ""}`}
            onClick={() => setRole("TEACHER")}
            type="button"
          >
            <GraduationCap size={18} /> Guru
          </button>
        </div>

        <form className="auth-form" onSubmit={submit}>
          {mode === "register" && role === "STUDENT" && (
            <div className="field">
              <label>Nama lengkap</label>
              <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Contoh: Alya Pramesti" />
            </div>
          )}
          {mode === "register" && role === "TEACHER" && (
            <div className="field">
              <label>Nama lengkap</label>
              <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Contoh: Atika Pratiwi" />
            </div>
          )}
          <div className="field">
            <label>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nama@email.com" />
          </div>
          <div className="field">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimal 8 karakter"
            />
          </div>
          {mode === "register" && (
            <>
              <div className="field">
                <label>Konfirmasi password</label>
                <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Ulangi password" />
              </div>
              {role === "STUDENT" && (
                <div className="field">
                  <label>Kelas</label>
                  <select value={className} onChange={(e) => setClassName(e.target.value)}>
                    <option>VII-A</option>
                    <option>VII-B</option>
                    <option>VII-C</option>
                  </select>
                </div>
              )}
            </>
          )}

          <button className="button button--primary auth-submit" type="submit" disabled={loading}>
            {loading ? <Loader2 size={16} className="spin" /> : mode === "login" ? <BookOpen size={16} /> : <ArrowRight size={16} />}
            {loading ? "Memproses..." : mode === "login" ? "Masuk" : `Daftar sebagai ${role === "STUDENT" ? "Siswa" : "Guru"}`}
          </button>
        </form>

        {mode === "login" && role === "STUDENT" && (
          <p className="auth-alt">Belum punya akun? <button className="linklike" onClick={() => setMode("register")}>Daftar sebagai Siswa</button></p>
        )}
        {mode === "login" && role === "TEACHER" && (
          <p className="auth-alt">Belum punya akun guru? <button className="linklike" onClick={() => setMode("register")}>Daftar sebagai Guru</button></p>
        )}
        <p className="auth-alt">Masuk sebagai Admin? <Link href="/auth/admin">Halaman login Admin</Link></p>

        {/* Shortcut Akun Demo Siap Pakai (1-Klik Masuk) */}
        <div className="demo-shortcuts" style={{ marginTop: 20, paddingTop: 16, borderTop: "1px dashed var(--line)" }}>
          <div style={{ fontSize: "0.74rem", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 10, textAlign: "center" }}>
            ⚡ Akun Demo Siap Pakai (1-Klik Masuk)
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            <button
              type="button"
              className="button button--ghost button--small"
              style={{ justifyContent: "flex-start", width: "100%", padding: "10px 14px", border: "1px solid var(--line)", background: "var(--bg)" }}
              onClick={async () => {
                setEmail("guru@eduverse.id");
                setPassword("GuruEduVerse123!");
                setRole("TEACHER");
                setMode("login");
                setLoading(true);
                try {
                  const res = await loginUser({ email: "guru@eduverse.id", password: "GuruEduVerse123!" });
                  if (res.ok) {
                    router.replace(resolveDestination(res.role));
                    router.refresh();
                  } else {
                    setToast(res.error || "Gagal masuk.");
                  }
                } catch {
                  setToast("Koneksi bermasalah.");
                } finally {
                  setLoading(false);
                }
              }}
            >
              <GraduationCap size={16} color="var(--violet)" />
              <div style={{ textAlign: "left", lineHeight: 1.2 }}>
                <strong style={{ display: "block", fontSize: "0.8rem" }}>Guru: Farouq Sensei</strong>
                <small style={{ color: "var(--muted)", fontSize: "0.68rem" }}>guru@eduverse.id · Pengelola Pembelajaran</small>
              </div>
            </button>

            <button
              type="button"
              className="button button--ghost button--small"
              style={{ justifyContent: "flex-start", width: "100%", padding: "10px 14px", border: "1px solid var(--line)", background: "var(--bg)" }}
              onClick={async () => {
                setEmail("siswa@eduverse.id");
                setPassword("SiswaEduVerse123!");
                setRole("STUDENT");
                setMode("login");
                setLoading(true);
                try {
                  const res = await loginUser({ email: "siswa@eduverse.id", password: "SiswaEduVerse123!" });
                  if (res.ok) {
                    router.replace(resolveDestination(res.role));
                    router.refresh();
                  } else {
                    setToast(res.error || "Gagal masuk.");
                  }
                } catch {
                  setToast("Koneksi bermasalah.");
                } finally {
                  setLoading(false);
                }
              }}
            >
              <UsersRound size={16} color="var(--teal)" />
              <div style={{ textAlign: "left", lineHeight: 1.2 }}>
                <strong style={{ display: "block", fontSize: "0.8rem" }}>Siswa: Alya Pramesti (Kelas VII-B)</strong>
                <small style={{ color: "var(--muted)", fontSize: "0.68rem" }}>siswa@eduverse.id · Mengikuti Pembelajaran</small>
              </div>
            </button>

            <button
              type="button"
              className="button button--ghost button--small"
              style={{ justifyContent: "flex-start", width: "100%", padding: "10px 14px", border: "1px solid var(--line)", background: "var(--bg)" }}
              onClick={async () => {
                setEmail("admin@eduverse.id");
                setPassword("AdminEduVerse123!");
                setMode("login");
                setLoading(true);
                try {
                  const res = await loginUser({ email: "admin@eduverse.id", password: "AdminEduVerse123!" });
                  if (res.ok) {
                    router.replace(resolveDestination(res.role));
                    router.refresh();
                  } else {
                    setToast(res.error || "Gagal masuk.");
                  }
                } catch {
                  setToast("Koneksi bermasalah.");
                } finally {
                  setLoading(false);
                }
              }}
            >
              <ShieldCheck size={16} color="var(--red)" />
              <div style={{ textAlign: "left", lineHeight: 1.2 }}>
                <strong style={{ display: "block", fontSize: "0.8rem" }}>Admin: Sistem</strong>
                <small style={{ color: "var(--muted)", fontSize: "0.68rem" }}>admin@eduverse.id · Pengelola Sistem</small>
              </div>
            </button>
          </div>
        </div>
      </div>

      {toast && <Toast message={toast} onClose={() => setToast("")} />}
    </div>
  );
}
