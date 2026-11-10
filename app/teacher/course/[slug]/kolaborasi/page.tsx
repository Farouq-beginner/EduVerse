"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ExternalLink,
  Gamepad2,
  Loader2,
  Pencil,
  Plus,
  Save,
  Trash2,
  Video,
  X,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { StatusPill } from "@/components/DashboardBits";
import { Toast } from "@/components/Toast";
import { getTeacherCourseIdBySlug } from "@/lib/actions/dashboards";
import {
  deleteCollaboration,
  getTeacherCollaborations,
  saveCollaboration,
  type CollaborationRow,
} from "@/lib/actions/collaboration";
import { getCollabProvider } from "@/lib/collab";

type LinkDraft = { id?: string; label: string; url: string };
type Draft = { id?: string; title: string; description: string; links: LinkDraft[] };

const emptyDraft: Draft = { title: "", description: "", links: [{ label: "", url: "" }] };

function providerLabel(provider: string) {
  return getCollabProvider(provider)?.label ?? "Link";
}

export default function TeacherCollaborationPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;

  const [courseId, setCourseId] = useState<string | null>(null);
  const [rows, setRows] = useState<CollaborationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [toast, setToast] = useState("");

  async function refresh(id: string) {
    const data = await getTeacherCollaborations(id);
    setRows(data);
  }

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const id = await getTeacherCourseIdBySlug(slug);
        if (!active) return;
        setCourseId(id);
        if (id) {
          const data = await getTeacherCollaborations(id);
          if (active) setRows(data);
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [slug]);

  function openCreate() {
    setDraft({ ...emptyDraft, links: [{ label: "", url: "" }] });
  }

  function openEdit(row: CollaborationRow) {
    setDraft({
      id: row.id,
      title: row.title,
      description: row.description,
      links: row.links.length
        ? row.links.map((link) => ({ id: link.id, label: link.label, url: link.url }))
        : [{ label: "", url: "" }],
    });
  }

  function patchLink(index: number, patch: Partial<LinkDraft>) {
    setDraft((current) =>
      current
        ? {
            ...current,
            links: current.links.map((link, position) =>
              position === index ? { ...link, ...patch } : link
            ),
          }
        : current
    );
  }

  async function submit() {
    if (!draft || !courseId || saving) return;
    if (!draft.title.trim()) {
      setToast("Judul kolaborasi wajib diisi.");
      return;
    }
    const links = draft.links.filter((link) => link.url.trim());
    if (links.length === 0) {
      setToast("Isi minimal satu link kolaborasi.");
      return;
    }
    setSaving(true);
    const result = await saveCollaboration({
      id: draft.id,
      courseId,
      title: draft.title,
      description: draft.description,
      links,
    });
    setSaving(false);
    if (!result.ok) {
      setToast(result.error ?? "Gagal menyimpan kolaborasi.");
      return;
    }
    setDraft(null);
    await refresh(courseId);
    setToast("Kolaborasi tersimpan dan langsung terlihat siswa.");
  }

  async function remove(row: CollaborationRow) {
    if (!window.confirm(`Hapus kolaborasi "${row.title}"?`)) return;
    setDeleting(row.id);
    const result = await deleteCollaboration(row.id);
    setDeleting(null);
    if (!result.ok) {
      setToast(result.error ?? "Gagal menghapus kolaborasi.");
      return;
    }
    if (courseId) await refresh(courseId);
    setToast("Kolaborasi dihapus.");
  }

  return (
    <AppShell>
      <div className="page-topbar">
        <div>
          <Link href={`/teacher/course/${slug}`} className="back-link">
            <ArrowLeft size={14} /> Kembali ke course builder
          </Link>
          <div className="eyebrow" style={{ marginTop: 12 }}>
            DI LUAR PERTEMUAN · KOLABORASI
          </div>
          <h1>Kolaborasi kelas</h1>
          <p>
            Satu kolaborasi punya judul, deskripsi, dan banyak link. Kelompokkan aplikasi yang
            dipakai kelas — siswa melihat semuanya di halaman kolaborasi.
          </p>
        </div>
        <div className="page-topbar__actions">
          <Link href={`/teacher/course/${slug}/game`} className="button button--ghost button--small">
            <Gamepad2 size={15} /> Game kelompok
          </Link>
          <button className="button button--primary button--small" onClick={openCreate}>
            <Plus size={15} /> Tambah kolaborasi
          </button>
        </div>
      </div>

      {loading ? (
        <div className="panel sync-loading">
          <Loader2 size={18} className="spin" /> Memuat kolaborasi dari database...
        </div>
      ) : courseId === null ? (
        <div className="panel empty-state">
          <strong>Pembelajaran tidak ditemukan</strong>
          <p>Halaman ini hanya bisa dibuka oleh guru pemilik pembelajaran.</p>
        </div>
      ) : rows.length === 0 ? (
        <div className="panel empty-state">
          <span className="empty-state__icon">
            <Video size={22} />
          </span>
          <strong>Belum ada kolaborasi</strong>
          <p>
            Tambahkan kolaborasi pertama, misalnya “Kolaborasi PhET” dengan tiga link simulasi garis
            bilangan.
          </p>
          <button className="button button--primary button--small" onClick={openCreate}>
            <Plus size={15} /> Tambah kolaborasi
          </button>
        </div>
      ) : (
        <div className="collab-page">
          {rows.map((row) => (
            <article className="collab-edit-card" key={row.id}>
              <div className="collab-edit-card__head">
                <div>
                  <strong>{row.title}</strong>
                  {row.description && <p>{row.description}</p>}
                </div>
                <StatusPill tone="violet">{row.links.length} link</StatusPill>
              </div>
              <div className="collab-edit-card__links">
                {row.links.map((link) => (
                  <a
                    key={link.id}
                    href={link.url}
                    target="_blank"
                    rel="noreferrer"
                    className="collab-edit-link"
                  >
                    <span>{providerLabel(link.provider)}</span>
                    <strong>{link.label}</strong>
                    <ExternalLink size={13} />
                  </a>
                ))}
              </div>
              <div className="collab-edit-card__actions">
                <button className="button button--ghost button--small" onClick={() => openEdit(row)}>
                  <Pencil size={14} /> Edit
                </button>
                <button
                  className="button button--ghost button--small button--danger"
                  onClick={() => remove(row)}
                  disabled={deleting === row.id}
                >
                  {deleting === row.id ? <Loader2 size={14} className="spin" /> : <Trash2 size={14} />}{" "}
                  Hapus
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {draft && (
        <div className="modal-backdrop" onClick={() => setDraft(null)}>
          <div className="modal-card collab-editor" onClick={(event) => event.stopPropagation()}>
            <div className="modal-card__head">
              <div>
                <div className="eyebrow">KOLABORASI KELAS</div>
                <h2>{draft.id ? "Edit kolaborasi" : "Kolaborasi baru"}</h2>
                <p>Judul dan deskripsi tampil di halaman siswa, link dibuka di tab baru.</p>
              </div>
              <button className="icon-button" onClick={() => setDraft(null)} aria-label="Tutup">
                <X size={16} />
              </button>
            </div>

            <div className="form-grid" style={{ marginTop: 16 }}>
              <div className="field field--full">
                <label>Judul kolaborasi</label>
                <input
                  autoFocus
                  value={draft.title}
                  onChange={(event) => setDraft({ ...draft, title: event.target.value })}
                  placeholder="Contoh: Kolaborasi PhET"
                />
              </div>
              <div className="field field--full">
                <label>Deskripsi</label>
                <textarea
                  value={draft.description}
                  onChange={(event) => setDraft({ ...draft, description: event.target.value })}
                  placeholder="Apa yang dikerjakan siswa dengan kolaborasi ini?"
                />
              </div>
            </div>

            <div className="collab-link-editor">
              <div className="collab-link-editor__head">
                <strong>Link kolaborasi</strong>
                <button
                  className="button button--ghost button--small"
                  onClick={() =>
                    setDraft({ ...draft, links: [...draft.links, { label: "", url: "" }] })
                  }
                >
                  <Plus size={14} /> Tambah link
                </button>
              </div>
              {draft.links.map((link, index) => (
                <div className="collab-link-row" key={link.id ?? `link-${index}`}>
                  <input
                    value={link.label}
                    onChange={(event) => patchLink(index, { label: event.target.value })}
                    placeholder="Label (mis. Bilangan bulat)"
                  />
                  <input
                    value={link.url}
                    onChange={(event) => patchLink(index, { url: event.target.value })}
                    placeholder="https://phet.colorado.edu/..."
                    inputMode="url"
                  />
                  <button
                    className="icon-button icon-button--tiny"
                    onClick={() =>
                      setDraft({
                        ...draft,
                        links:
                          draft.links.length > 1
                            ? draft.links.filter((_, position) => position !== index)
                            : [{ label: "", url: "" }],
                      })
                    }
                    aria-label="Hapus link"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              <small className="field-hint">
                Link harus diawali http/https. Zoom, Meet, Mathigon, GeoGebra, dan PhET dikenali
                otomatis.
              </small>
            </div>

            <div className="modal-actions">
              <button className="button button--ghost button--small" onClick={() => setDraft(null)}>
                Batal
              </button>
              <button className="button button--primary button--small" onClick={submit} disabled={saving}>
                {saving ? <Loader2 size={14} className="spin" /> : <Save size={14} />} Simpan
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast message={toast} onClose={() => setToast("")} />}

      <div className="builder-extras" style={{ marginTop: 24 }}>
        <Link href={`/teacher/course/${slug}/game`} className="builder-extra-card builder-extra-card--teal">
          <span className="builder-extra-card__icon">
            <Gamepad2 size={19} />
          </span>
          <strong>Lanjut ke game kelompok</strong>
          <small>Buat room tugas bersama dengan kode kelompok dan nilai tambahan.</small>
          <span className="text-link">
            Kelola room <ArrowRight size={14} />
          </span>
        </Link>
      </div>
    </AppShell>
  );
}
