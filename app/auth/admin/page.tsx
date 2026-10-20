"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, ShieldCheck } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";
import { Toast } from "@/components/Toast";
import { loginUser } from "@/lib/actions/auth";

export default function AdminAuthPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (loading) return;
    if (!email.includes("@")) return setToast("Email tidak valid.");
    if (!password) return setToast("Password wajib diisi.");

    setLoading(true);
    try {
      const result = await loginUser({ email, password });
      if (!result.ok) {
        setToast(result.error ?? "Login gagal.");
        return;
      }
      if (result.role !== "ADMIN") {
        setToast("Akun ini bukan Admin. Gunakan login Guru atau Siswa.");
        return;
      }
      // replace, bukan push: halaman login tidak boleh tersisa di riwayat
      // browser sehingga tombol "kembali" tidak memunculkan form login lagi.
      router.replace("/admin");
      router.refresh();
    } catch {
      setToast("Koneksi bermasalah. Coba lagi.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page auth-page--admin">
      <div className="auth-form-wrap">
        <BrandMark />
        <div className="eyebrow" style={{ marginTop: 20 }}>LOGIN ADMIN</div>
        <h2 style={{ margin: "6px 0 4px" }}>Console platform</h2>
        <p className="auth-alt" style={{ marginTop: 0 }}>
          Akun Admin dibuat melalui proses bootstrap admin, bukan pendaftaran publik.
        </p>
        <form className="auth-form" onSubmit={submit}>
          <div className="field">
            <label>Email admin</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@eduverse.id" />
          </div>
          <div className="field">
            <label>Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password admin" />
          </div>
          <button className="button button--primary auth-submit" type="submit" disabled={loading}>
            {loading ? <Loader2 size={16} className="spin" /> : <ShieldCheck size={16} />}
            {loading ? "Memverifikasi..." : "Masuk sebagai Admin"}
          </button>
        </form>
        <p className="auth-alt">
          <Link href="/auth">Kembali ke login Guru / Siswa</Link>
        </p>
        <p className="auth-alt">
          <Link href="/" className="back-link">
            <ArrowLeft size={13} /> Beranda
          </Link>
        </p>
      </div>
      {toast && <Toast message={toast} onClose={() => setToast("")} />}
    </div>
  );
}
