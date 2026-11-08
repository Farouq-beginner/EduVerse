"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Loader2, Save, Trash2, UserRound } from "lucide-react";
import { Toast } from "@/components/Toast";
import {
  getMyProfile,
  removeMyAvatar,
  setMyAvatar,
  updateMyProfile,
  type MyProfile,
} from "@/lib/actions/profile";

const MAX_AVATAR = 5 * 1024 * 1024;

/**
 * Pengaturan profil guru & siswa: foto profil, nama lengkap, nama panggilan,
 * username, dan kelas (khusus siswa). Email & password dikelola Admin.
 */
export function ProfileSettings() {
  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [fullName, setFullName] = useState("");
  const [nickname, setNickname] = useState("");
  const [username, setUsername] = useState("");
  const [className, setClassName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState("");
  const fileInput = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let active = true;
    getMyProfile().then((data) => {
      if (!active) return;
      setProfile(data);
      setFullName(data?.fullName ?? "");
      setNickname(data?.nickname ?? "");
      setUsername(data?.username ?? "");
      setClassName(data?.className ?? "");
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    const result = await updateMyProfile({
      fullName,
      nickname,
      username,
      ...(profile?.role === "STUDENT" ? { className } : {}),
    });
    setSaving(false);
    if (!result.ok || !result.profile) {
      setToast(result.error ?? "Gagal menyimpan profil.");
      return;
    }
    setProfile(result.profile);
    setUsername(result.profile.username ?? "");
    setToast("Profil tersimpan.");
  }

  async function uploadAvatar(file: File) {
    if (!file.type.startsWith("image/")) {
      setToast("Foto profil harus berupa gambar (PNG/JPG/WEBP).");
      return;
    }
    if (file.size > MAX_AVATAR) {
      setToast("Ukuran foto maksimal 5 MB.");
      return;
    }
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("purpose", "avatar");
      const response = await fetch("/api/files", { method: "POST", body: form });
      const data = (await response.json()) as { ok?: boolean; fileId?: string; error?: string };
      if (!response.ok || !data.ok || !data.fileId) {
        setToast(data.error ?? "Gagal mengunggah foto.");
        return;
      }
      const saved = await setMyAvatar(data.fileId);
      if (!saved.ok || !saved.avatarUrl) {
        setToast(saved.error ?? "Gagal memasang foto profil.");
        return;
      }
      setProfile((current) => (current ? { ...current, avatarUrl: saved.avatarUrl! } : current));
      setToast("Foto profil diperbarui.");
    } catch {
      setToast("Gagal mengunggah foto profil.");
    } finally {
      setUploading(false);
    }
  }

  async function removeAvatar() {
    const result = await removeMyAvatar();
    if (!result.ok) {
      setToast(result.error ?? "Gagal menghapus foto.");
      return;
    }
    setProfile((current) => (current ? { ...current, avatarUrl: null } : current));
    setToast("Foto profil dihapus.");
  }

  const initials = (fullName || profile?.fullName || "?")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const roleLabel =
    profile?.role === "TEACHER" ? "Guru" : profile?.role === "ADMIN" ? "Admin" : "Siswa";

  if (loading) {
    return (
      <div className="sync-loading">
        <Loader2 size={18} className="spin" />
        <span>Memuat profil...</span>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="panel empty-state">
        <UserRound size={22} />
        <strong>Profil tidak ditemukan</strong>
        <p>Silakan masuk lagi untuk mengelola profilmu.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="page-topbar">
        <div>
          <div className="eyebrow">PENGATURAN AKUN · {roleLabel.toUpperCase()}</div>
          <h1>Kelola profil</h1>
          <p>Ubah foto, nama, dan identitas yang dilihat guru atau siswa lain.</p>
        </div>
      </div>

      <div className="profile-layout">
        <section className="panel profile-card">
          <div className="profile-avatar">
            {profile.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.avatarUrl} alt={`Foto profil ${profile.fullName}`} />
            ) : (
              <span>{initials}</span>
            )}
          </div>
          <strong>{fullName || profile.fullName}</strong>
          <small>
            {roleLabel}
            {nickname ? ` · ${nickname}` : ""}
            {profile.role === "STUDENT" && className ? ` · ${className}` : ""}
          </small>

          <input
            ref={fileInput}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) uploadAvatar(file);
              event.target.value = "";
            }}
          />

          <div className="profile-actions">
            <button
              className="button button--primary button--small"
              onClick={() => fileInput.current?.click()}
              disabled={uploading}
              type="button"
            >
              {uploading ? <Loader2 size={14} className="spin" /> : <Camera size={14} />}
              {uploading ? "Mengunggah..." : "Ganti foto"}
            </button>
            {profile.avatarUrl && (
              <button
                className="button button--ghost button--small"
                onClick={removeAvatar}
                type="button"
              >
                <Trash2 size={14} /> Hapus
              </button>
            )}
          </div>
          <p className="profile-note">JPG, PNG, atau WEBP maksimal 5 MB.</p>
        </section>

        <form className="panel profile-form" onSubmit={save}>
          <div className="eyebrow">IDENTITAS</div>

          <div className="field">
            <label>Nama lengkap</label>
            <input value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Nama yang tampil di kelas" />
          </div>

          <div className="field">
            <label>Nama panggilan</label>
            <input
              value={nickname}
              onChange={(event) => setNickname(event.target.value)}
              placeholder="Contoh: Salma"
              maxLength={24}
            />
          </div>

          <div className="field">
            <label>Username</label>
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="contoh: salma.sensei"
            />
            <small className="field-hint">Huruf kecil, angka, titik, garis bawah, atau strip.</small>
          </div>

          {profile.role === "STUDENT" && (
            <div className="field">
              <label>Kelas</label>
              <select value={className} onChange={(event) => setClassName(event.target.value)}>
                <option value="">Belum ditentukan</option>
                <option>VII-A</option>
                <option>VII-B</option>
                <option>VII-C</option>
                <option>VIII-A</option>
                <option>VIII-B</option>
                <option>IX-A</option>
                <option>IX-B</option>
              </select>
            </div>
          )}

          <button className="button button--primary" type="submit" disabled={saving}>
            {saving ? <Loader2 size={15} className="spin" /> : <Save size={15} />}
            {saving ? "Menyimpan..." : "Simpan profil"}
          </button>

          <p className="profile-note">
            Email dan password dikelola Admin lewat konsol admin. Hubungi Admin bila keduanya perlu diubah.
          </p>
        </form>
      </div>

      {toast && <Toast message={toast} onClose={() => setToast("")} />}
    </div>
  );
}
