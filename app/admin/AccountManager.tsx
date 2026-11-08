"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import { StatusPill } from "@/components/DashboardBits";
import { Toast } from "@/components/Toast";
import {
  createAccount,
  deleteAccount,
  listAccounts,
  updateAccount,
  type AccountRow,
} from "@/lib/actions/admin";

type Filter = "ALL" | "TEACHER" | "STUDENT" | "ADMIN";

const emptyForm = {
  fullName: "",
  nickname: "",
  username: "",
  email: "",
  password: "",
  role: "STUDENT" as "TEACHER" | "STUDENT" | "ADMIN",
  className: "",
};

const roleLabel: Record<string, string> = {
  ALL: "Semua",
  TEACHER: "Guru",
  STUDENT: "Siswa",
  ADMIN: "Admin",
};

/**
 * Kelola akun di konsol Admin: saring per peran, tambah, ubah, dan hapus.
 * Email dan password diubah lewat Supabase Admin sehingga akun benar-benar
 * bisa dipakai login, bukan hanya baris tabel.
 */
export function AccountManager() {
  const [rows, setRows] = useState<AccountRow[]>([]);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AccountRow | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async (nextFilter: Filter) => {
    setLoading(true);
    const result = await listAccounts(nextFilter);
    setLoading(false);
    if (!result.ok || !result.rows) {
      setToast(result.error ?? "Gagal memuat akun.");
      return;
    }
    setRows(result.rows);
  }, []);

  useEffect(() => {
    load(filter);
  }, [filter, load]);

  const filtered = rows.filter((row) => {
    const term = search.trim().toLowerCase();
    if (!term) return true;
    return `${row.fullName} ${row.nickname ?? ""} ${row.username ?? ""} ${row.email} ${row.className ?? ""}`
      .toLowerCase()
      .includes(term);
  });

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setFormOpen(true);
  }

  function openEdit(row: AccountRow) {
    setEditing(row);
    setForm({
      fullName: row.fullName,
      nickname: row.nickname ?? "",
      username: row.username ?? "",
      email: row.email,
      password: "",
      role: row.role as "TEACHER" | "STUDENT" | "ADMIN",
      className: row.className ?? "",
    });
    setFormOpen(true);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);

    const result = editing
      ? await updateAccount({
          id: editing.id,
          fullName: form.fullName,
          nickname: form.nickname,
          username: form.username,
          email: form.email || undefined,
          password: form.password || undefined,
          role: form.role,
          className: form.role === "STUDENT" ? form.className : null,
        })
      : await createAccount({
          fullName: form.fullName,
          nickname: form.nickname,
          username: form.username,
          email: form.email,
          password: form.password,
          role: form.role,
          className: form.role === "STUDENT" ? form.className : undefined,
        });

    setSaving(false);
    if (!result.ok) {
      setToast(result.error ?? "Gagal menyimpan akun.");
      return;
    }
    setToast(editing ? "Akun diperbarui." : "Akun baru dibuat.");
    setFormOpen(false);
    await load(filter);
  }

  async function remove(row: AccountRow) {
    if (!confirm(`Hapus akun ${row.fullName}? Tindakan ini menghapus akses login dan profilnya.`)) return;
    setBusyId(row.id);
    const result = await deleteAccount(row.id);
    setBusyId(null);
    if (!result.ok) {
      setToast(result.error ?? "Gagal menghapus akun.");
      return;
    }
    setToast("Akun dihapus.");
    await load(filter);
  }

  async function toggleActive(row: AccountRow) {
    setBusyId(row.id);
    const result = await updateAccount({ id: row.id, isActive: !row.isActive });
    setBusyId(null);
    if (!result.ok) {
      setToast(result.error ?? "Gagal mengubah status akun.");
      return;
    }
    setRows((current) =>
      current.map((item) => (item.id === row.id ? { ...item, isActive: !row.isActive } : item))
    );
    setToast(row.isActive ? "Akun dinonaktifkan." : "Akun diaktifkan kembali.");
  }

  return (
    <div className="admin-panel" id="account-manager">
      <div className="admin-panel__head">
        <div>
          <strong>Kelola akun</strong>
          <small>Saring per peran, lalu ubah email, password, nama, atau username.</small>
        </div>
        <button className="button button--primary button--small" onClick={openCreate}>
          <UserPlus size={14} /> Tambah akun
        </button>
      </div>

      <div className="account-toolbar">
        <div className="tabs" style={{ width: "max-content" }}>
          {(["ALL", "TEACHER", "STUDENT", "ADMIN"] as Filter[]).map((value) => (
            <button
              key={value}
              className={`tab ${filter === value ? "is-active" : ""}`}
              onClick={() => setFilter(value)}
              type="button"
            >
              {roleLabel[value]}
            </button>
          ))}
        </div>
        <div className="search-field">
          <Search size={15} />
          <input
            placeholder="Cari nama, email, atau username..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="sync-loading">
          <Loader2 size={18} className="spin" />
          <span>Memuat akun...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state" style={{ padding: "24px 0" }}>
          <Users size={22} color="var(--muted)" />
          <p style={{ color: "var(--muted)", fontSize: ".8rem", marginTop: 8 }}>
            Belum ada akun pada filter ini.
          </p>
        </div>
      ) : (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Akun</th>
                <th>Peran</th>
                <th>Email</th>
                <th>Username</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.id}>
                  <td>
                    <div className="student-cell">
                      <span className="table-avatar">
                        {row.fullName
                          .split(" ")
                          .map((part) => part[0])
                          .join("")
                          .slice(0, 2)}
                      </span>
                      <div>
                        <strong>{row.fullName}</strong>
                        <small style={{ display: "block", color: "var(--muted)", fontWeight: 400 }}>
                          {row.nickname ?? "—"}
                          {row.className ? ` · ${row.className}` : ""}
                        </small>
                      </div>
                    </div>
                  </td>
                  <td>
                    <StatusPill tone={row.role === "ADMIN" ? "coral" : row.role === "TEACHER" ? "violet" : "teal"}>
                      {roleLabel[row.role]}
                    </StatusPill>
                  </td>
                  <td>{row.email || "—"}</td>
                  <td>{row.username ? `@${row.username}` : "—"}</td>
                  <td>
                    <button
                      className="status-toggle"
                      onClick={() => toggleActive(row)}
                      disabled={busyId === row.id}
                      title="Ubah status akses"
                    >
                      <StatusPill tone={row.isActive ? "teal" : "yellow"}>
                        {row.isActive ? "Aktif" : "Nonaktif"}
                      </StatusPill>
                    </button>
                  </td>
                  <td>
                    <div className="row-actions">
                      <button className="icon-button icon-button--tiny" onClick={() => openEdit(row)} aria-label={`Ubah ${row.fullName}`}>
                        <Pencil size={14} />
                      </button>
                      <button
                        className="icon-button icon-button--tiny"
                        onClick={() => remove(row)}
                        disabled={busyId === row.id}
                        aria-label={`Hapus ${row.fullName}`}
                      >
                        {busyId === row.id ? <Loader2 size={14} className="spin" /> : <Trash2 size={14} />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {formOpen && (
        <div className="modal-backdrop" onClick={() => setFormOpen(false)}>
          <form className="modal-card" onClick={(event) => event.stopPropagation()} onSubmit={submit}>
            <div className="modal-card__head">
              <div>
                <div className="eyebrow">{editing ? "UBAH AKUN" : "AKUN BARU"}</div>
                <h2>{editing ? editing.fullName : "Tambah akun"}</h2>
              </div>
              <button type="button" className="icon-button" onClick={() => setFormOpen(false)} aria-label="Tutup">
                ×
              </button>
            </div>

            <div className="form-grid">
              <div className="field">
                <label>Nama lengkap</label>
                <input
                  value={form.fullName}
                  onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))}
                  required
                />
              </div>
              <div className="field">
                <label>Nama panggilan</label>
                <input
                  value={form.nickname}
                  onChange={(event) => setForm((current) => ({ ...current, nickname: event.target.value }))}
                  placeholder="Opsional"
                />
              </div>
              <div className="field">
                <label>Username</label>
                <input
                  value={form.username}
                  onChange={(event) => setForm((current) => ({ ...current, username: event.target.value }))}
                  placeholder="contoh: alya.p"
                />
              </div>
              <div className="field">
                <label>Peran</label>
                <select
                  value={form.role}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, role: event.target.value as typeof current.role }))
                  }
                >
                  <option value="STUDENT">Siswa</option>
                  <option value="TEACHER">Guru</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>
              <div className="field">
                <label>Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                  placeholder={editing ? "Biarkan untuk tidak mengubah" : "nama@email.com"}
                  required={!editing}
                />
              </div>
              <div className="field">
                <label>{editing ? "Password baru" : "Password"}</label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                  placeholder={editing ? "Kosongkan bila tidak diubah" : "Minimal 8 karakter"}
                  required={!editing}
                />
              </div>
              {form.role === "STUDENT" && (
                <div className="field field--full">
                  <label>Kelas</label>
                  <input
                    value={form.className}
                    onChange={(event) => setForm((current) => ({ ...current, className: event.target.value }))}
                    placeholder="Contoh: VII-B"
                  />
                </div>
              )}
            </div>

            <button className="button button--primary" style={{ width: "100%", marginTop: 18 }} type="submit" disabled={saving}>
              {saving ? <Loader2 size={16} className="spin" /> : <Plus size={16} />}
              {saving ? "Menyimpan..." : editing ? "Simpan perubahan" : "Buat akun"}
            </button>
            <p className="modal-note">
              Akun langsung aktif dan bisa dipakai login dengan email serta password di atas.
            </p>
          </form>
        </div>
      )}

      {toast && <Toast message={toast} onClose={() => setToast("")} />}
    </div>
  );
}
