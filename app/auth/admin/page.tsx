"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";
import { Toast } from "@/components/Toast";
import { loginUser } from "@/lib/actions/auth";
import { getAdminDirectory } from "@/lib/actions/admin";

/**
 * Pintu masuk Admin. Halaman ini juga menampilkan email Admin yang terdaftar,
 * supaya akses konsol tidak hilang saat emailnya lupa.
 */
export default function AdminAuthPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState("");
  const [adminEmails, setAdminEmails] = useState<{ id: string; email: string; fullName: string }[]>([]);

  useEffect(() => {
    let active = true;
    getAdminDirectory().then((rows) => {
      if (active) setAdminEmails(rows);
    });
    return () => {
      active = false;
    };
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (loading) return;
    if (!email.includes("@")) return setToast("Email tidak valid.");
    if (!password) return setToast("Password wajib diisi.");

    setLoading(true);
    try {
      const result = await loginUser({ email, password });
      if (!result.ok) {
        setToast(result.error ?? "Gagal masuk.");
        return;
      }
      if (result.role !== "ADMIN") {
        setToast("Akun ini bukan Admin. Gunakan halaman masuk guru atau siswa.");
        return;
      }
      router.replace("/admin");
    } catch (error) {
      setToast(error instanceof Error ? `Koneksi bermasalah: ${error.message}` : "Koneksi bermasalah.");
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
        <div className="eyebrow eyebrow--light">KONSOL ADMIN</div>
        <h1>Kendali platform, satu pintu.</h1>
        <p>Kelola akun guru dan siswa, pantau statistik, dan jaga nama platform.</p>
        <div className="auth-visual__art">
          <span className="join-orbit__number">−2</span>
          <span className="join-orbit__plus">+5</span>
          <span className="join-orbit__zero">0</span>
        </div>
      </div>

      <div className="auth-form-wrap">
        <BrandMark />
        <div className="eyebrow" style={{ marginTop: 20 }}>
          MASUK SEBAGAI ADMIN
        </div>
        <h2 style={{ margin: "6px 0 4px" }}>Admin console</h2>

        <form className="auth-form" style={{ marginTop: 18 }} onSubmit={submit}>
          <div className="field">
            <label>Email admin</label>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="admin@eduverse.id"
              autoComplete="username"
            />
          </div>
          <div className="field">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Password admin"
              autoComplete="current-password"
            />
          </div>
          <button className="button button--primary auth-submit" type="submit" disabled={loading}>
            {loading ? <Loader2 size={16} className="spin" /> : <ShieldCheck size={16} />}
            {loading ? "Memeriksa..." : "Masuk ke admin console"}
          </button>
        </form>

        <div className="admin-credential-note">
          <div className="admin-credential-note__head">
            <KeyRound size={15} />
            <strong>Email admin yang terdaftar</strong>
          </div>
          {adminEmails.length === 0 ? (
            <p>
              Belum ada akun Admin. Buat lewat <code>npx tsx prisma/bootstrap-admin.ts</code> dengan
              ADMIN_EMAIL dan ADMIN_PASSWORD di <code>.env</code>.
            </p>
          ) : (
            <ul>
              {adminEmails.map((admin) => (
                <li key={admin.id}>
                  <strong>{admin.email}</strong>
                  <small>{admin.fullName}</small>
                </li>
              ))}
            </ul>
          )}
          <p>
            Password tidak dapat ditampilkan. Lupa password? Jalankan{" "}
            <code>npx tsx scripts/reset-admin-password.ts email@admin</code> untuk menyetel ulang.
          </p>
        </div>

        <Link href="/auth" className="back-link" style={{ marginTop: 18 }}>
          <ArrowLeft size={14} /> Masuk sebagai guru atau siswa
        </Link>
      </div>

      {toast && <Toast message={toast} onClose={() => setToast("")} />}
    </div>
  );
}
