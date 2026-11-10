"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Clock3,
  Copy,
  Gamepad2,
  Loader2,
  MessageCircle,
  Pencil,
  Plus,
  Save,
  Trash2,
  Trophy,
  UsersRound,
  Video,
  X,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { StatusPill } from "@/components/DashboardBits";
import { Toast } from "@/components/Toast";
import { getTeacherCourseIdBySlug } from "@/lib/actions/dashboards";
import {
  createGroupRoom,
  deleteGroupRoom,
  getTeacherGroupRooms,
  getTeacherRoom,
  gradeGroupRoom,
  updateGroupRoom,
  type GroupRoomDetail,
  type GroupRoomSummary,
} from "@/lib/actions/groups";

type RoomDraft = {
  id?: string;
  name: string;
  instructions: string;
  maxMembers: number;
  deadline: string;
};

const emptyDraft: RoomDraft = { name: "", instructions: "", maxMembers: 5, deadline: "" };

function toLocalInput(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
}

export default function TeacherGroupGamePage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;

  const [courseId, setCourseId] = useState<string | null>(null);
  const [rooms, setRooms] = useState<GroupRoomSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<RoomDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [detail, setDetail] = useState<GroupRoomDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [gradeInput, setGradeInput] = useState("");
  const [feedback, setFeedback] = useState("");
  const [grading, setGrading] = useState(false);
  const [toast, setToast] = useState("");

  async function refresh(id: string) {
    const data = await getTeacherGroupRooms(id);
    setRooms(data.rooms);
  }

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const id = await getTeacherCourseIdBySlug(slug);
        if (!active) return;
        setCourseId(id);
        if (id) {
          const data = await getTeacherGroupRooms(id);
          if (active) setRooms(data.rooms);
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [slug]);

  async function openRoom(roomId: string) {
    setDetailLoading(true);
    const room = await getTeacherRoom(roomId);
    setDetailLoading(false);
    if (!room) {
      setToast("Room tidak ditemukan.");
      return;
    }
    setDetail(room);
    setGradeInput(room.grade === null ? "" : String(room.grade));
    setFeedback(room.feedback ?? "");
  }

  async function submitRoom() {
    if (!draft || !courseId || saving) return;
    if (!draft.name.trim()) {
      setToast("Nama kelompok wajib diisi.");
      return;
    }
    setSaving(true);
    const payload = {
      name: draft.name,
      instructions: draft.instructions,
      maxMembers: draft.maxMembers,
      deadline: draft.deadline ? new Date(draft.deadline).toISOString() : null,
    };
    const result = draft.id
      ? await updateGroupRoom({ id: draft.id, ...payload })
      : await createGroupRoom({ courseId, ...payload });
    setSaving(false);
    if (!result.ok) {
      setToast(result.error ?? "Gagal menyimpan kelompok.");
      return;
    }
    setDraft(null);
    await refresh(courseId);
    setToast(draft.id ? "Kelompok diperbarui." : "Kelompok dibuat. Bagikan kodenya ke siswa.");
  }

  async function removeRoom(room: GroupRoomSummary) {
    if (!window.confirm(`Hapus ${room.name}? Chat dan tugas kelompok ikut terhapus.`)) return;
    const result = await deleteGroupRoom(room.id);
    if (!result.ok) {
      setToast(result.error ?? "Gagal menghapus kelompok.");
      return;
    }
    if (detail?.id === room.id) setDetail(null);
    if (courseId) await refresh(courseId);
    setToast("Kelompok dihapus.");
  }

  async function submitGrade() {
    if (!detail || grading) return;
    const value = Number(gradeInput);
    if (!Number.isFinite(value) || value < 0 || value > 100) {
      setToast("Nilai harus 0 sampai 100.");
      return;
    }
    setGrading(true);
    const result = await gradeGroupRoom({ roomId: detail.id, grade: value, feedback });
    setGrading(false);
    if (!result.ok) {
      setToast(result.error ?? "Gagal menyimpan nilai.");
      return;
    }
    await openRoom(detail.id);
    if (courseId) await refresh(courseId);
    setToast("Nilai kelompok tersimpan. Jawaban siswa terkunci.");
  }

  function copyCode(code: string) {
    navigator.clipboard?.writeText(code);
    setToast(`Kode ${code} disalin.`);
  }

  return (
    <AppShell>
      <div className="page-topbar">
        <div>
          <Link href={`/teacher/course/${slug}`} className="back-link">
            <ArrowLeft size={14} /> Kembali ke course builder
          </Link>
          {!detail && (
            <>
              <div className="eyebrow" style={{ marginTop: 12 }}>
                DI LUAR PERTEMUAN · GAME KELOMPOK
              </div>
              <h1>Room tugas kelompok</h1>
              <p>
                Setiap room maksimal 5 siswa dan hanya bisa dibuka dengan kode kelompok. Guru dapat
                membaca chat, melihat tugas, dan memberi nilai tambahan.
              </p>
            </>
          )}
        </div>
        <div className="page-topbar__actions">
          {detail ? (
            <button className="button button--ghost button--small" onClick={() => setDetail(null)}>
              <ArrowLeft size={14} /> Daftar room
            </button>
          ) : (
            <>
              <Link href={`/teacher/course/${slug}/kolaborasi`} className="button button--ghost button--small">
                <Video size={15} /> Kolaborasi
              </Link>
              <button
                className="button button--primary button--small"
                onClick={() => setDraft({ ...emptyDraft })}
              >
                <Plus size={15} /> Buat kelompok
              </button>
            </>
          )}
        </div>
      </div>

      {detail ? (
        <div className="group-room">
          <div className="group-room__head">
            <div>
              <div className="eyebrow">RUANG PRIVAT KELOMPOK</div>
              <h2>{detail.name}</h2>
              <div className="group-room__meta">
                <button className="room-code" onClick={() => copyCode(detail.code)}>
                  Kode {detail.code} <Copy size={12} />
                </button>
                <span>
                  <UsersRound size={13} /> {detail.members.length}/{detail.maxMembers} siswa
                </span>
                <span>
                  <Clock3 size={13} />{" "}
                  {detail.deadline
                    ? new Date(detail.deadline).toLocaleString("id-ID")
                    : "Tanpa deadline"}
                </span>
              </div>
              {detail.instructions && <p className="group-room__instructions">{detail.instructions}</p>}
            </div>
            {detail.grade !== null ? (
              <StatusPill tone="teal">Sudah dinilai · {detail.grade}</StatusPill>
            ) : (
              <StatusPill tone="yellow">Belum dinilai</StatusPill>
            )}
          </div>

          <div className="group-room__grid">
            <div className="panel">
              <div className="section-title" style={{ marginBottom: 12 }}>
                <div>
                  <div className="eyebrow">ANGGOTA</div>
                  <h2 style={{ fontSize: "1rem" }}>{detail.members.length} siswa</h2>
                </div>
              </div>
              <div className="member-chips">
                {detail.members.length === 0 ? (
                  <p className="section-subtitle">Belum ada siswa yang bergabung.</p>
                ) : (
                  detail.members.map((member) => (
                    <span className="member-chip" key={member.id}>
                      <strong>{member.name}</strong>
                      <small>{member.className}</small>
                    </span>
                  ))
                )}
              </div>

              <div className="section-title" style={{ margin: "22px 0 12px" }}>
                <div>
                  <div className="eyebrow">TUGAS KELOMPOK</div>
                  <h2 style={{ fontSize: "1rem" }}>{detail.tasks.length} tugas</h2>
                </div>
              </div>
              <div className="task-list">
                {detail.tasks.length === 0 ? (
                  <p className="section-subtitle">Kelompok ini belum mengunggah tugas.</p>
                ) : (
                  detail.tasks.map((task) => (
                    <div className="task-card" key={task.id}>
                      <div className="task-card__head">
                        <strong>{task.title}</strong>
                        <small>{new Date(task.createdAt).toLocaleString("id-ID")}</small>
                      </div>
                      {task.body && <p>{task.body}</p>}
                      <div className="task-card__foot">
                        <small>oleh {task.createdByName}</small>
                        {task.fileUrl && (
                          <a href={task.fileUrl} target="_blank" rel="noreferrer" className="text-link">
                            Buka lampiran
                          </a>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="grade-box">
                <div className="eyebrow">NILAI TAMBAHAN</div>
                <div className="grade-box__row">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={gradeInput}
                    onChange={(event) => setGradeInput(event.target.value)}
                    placeholder="0-100"
                  />
                  <input
                    value={feedback}
                    onChange={(event) => setFeedback(event.target.value)}
                    placeholder="Catatan untuk kelompok (opsional)"
                  />
                  <button className="button button--primary button--small" onClick={submitGrade} disabled={grading}>
                    {grading ? <Loader2 size={14} className="spin" /> : <Trophy size={14} />} Simpan nilai
                  </button>
                </div>
                <small className="field-hint">
                  Setelah dinilai, anggota tidak bisa lagi mengubah tugas maupun chat.
                </small>
              </div>
            </div>

            <div className="panel chat-panel">
              <div className="section-title" style={{ marginBottom: 12 }}>
                <div>
                  <div className="eyebrow">FORUM CHAT</div>
                  <h2 style={{ fontSize: "1rem" }}>Percakapan kelompok</h2>
                </div>
                <MessageCircle size={18} color="var(--muted)" />
              </div>
              <div className="chat-log">
                {detail.messages.length === 0 ? (
                  <p className="section-subtitle">Belum ada pesan di kelompok ini.</p>
                ) : (
                  detail.messages.map((message) => (
                    <div className="chat-bubble" key={message.id}>
                      <div className="chat-bubble__head">
                        <strong>{message.authorName}</strong>
                        <small>{new Date(message.createdAt).toLocaleTimeString("id-ID")}</small>
                      </div>
                      <p>{message.body}</p>
                    </div>
                  ))
                )}
              </div>
              <small className="field-hint">Guru hanya membaca; siswa yang mengisi chat.</small>
            </div>
          </div>
        </div>
      ) : loading ? (
        <div className="panel sync-loading">
          <Loader2 size={18} className="spin" /> Memuat room dari database...
        </div>
      ) : courseId === null ? (
        <div className="panel empty-state">
          <strong>Pembelajaran tidak ditemukan</strong>
          <p>Halaman ini hanya untuk guru pemilik pembelajaran.</p>
        </div>
      ) : rooms.length === 0 ? (
        <div className="panel empty-state">
          <span className="empty-state__icon">
            <Gamepad2 size={22} />
          </span>
          <strong>Belum ada room kelompok</strong>
          <p>Buat kelompok pertama, tentukan slot siswa, lalu bagikan kode kelompoknya.</p>
          <button className="button button--primary button--small" onClick={() => setDraft({ ...emptyDraft })}>
            <Plus size={15} /> Buat kelompok
          </button>
        </div>
      ) : (
        <div className="group-grid">
          {rooms.map((room) => (
            <article className="group-card" key={room.id}>
              <div className="group-card__head">
                <span className="group-card__icon">
                  <Gamepad2 size={18} />
                </span>
                <div>
                  <strong>{room.name}</strong>
                  <small>Kode {room.code}</small>
                </div>
                <StatusPill tone={room.graded ? "teal" : room.full ? "coral" : "yellow"}>
                  {room.graded ? "Sudah dinilai" : room.full ? "Penuh" : "Terbuka"}
                </StatusPill>
              </div>
              <div className="group-card__meta">
                <span>
                  <UsersRound size={13} /> {room.memberCount}/{room.maxMembers}
                </span>
                <span>
                  <MessageCircle size={13} /> {room.messageCount}
                </span>
                <span>{room.taskCount} tugas</span>
                <span>
                  <Clock3 size={13} />{" "}
                  {room.deadline ? new Date(room.deadline).toLocaleDateString("id-ID") : "Tanpa deadline"}
                </span>
              </div>
              <div className="group-card__actions">
                <button className="button button--primary button--small" onClick={() => openRoom(room.id)}>
                  <ArrowRight size={14} /> Buka room
                </button>
                <button
                  className="button button--ghost button--small"
                  onClick={() =>
                    setDraft({
                      id: room.id,
                      name: room.name,
                      instructions: room.instructions,
                      maxMembers: room.maxMembers,
                      deadline: toLocalInput(room.deadline),
                    })
                  }
                >
                  <Pencil size={14} /> Edit
                </button>
                <button className="button button--ghost button--small button--danger" onClick={() => removeRoom(room)}>
                  <Trash2 size={14} /> Hapus
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {detailLoading && (
        <div className="panel sync-loading" style={{ marginTop: 16 }}>
          <Loader2 size={18} className="spin" /> Membuka room...
        </div>
      )}

      {draft && (
        <div className="modal-backdrop" onClick={() => setDraft(null)}>
          <div className="modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="modal-card__head">
              <div>
                <div className="eyebrow">ROOM TUGAS KELOMPOK</div>
                <h2>{draft.id ? "Edit kelompok" : "Kelompok baru"}</h2>
                <p>Kode kelompok dibuat otomatis dan hanya bisa dipakai di pembelajaran ini.</p>
              </div>
              <button className="icon-button" onClick={() => setDraft(null)} aria-label="Tutup">
                <X size={16} />
              </button>
            </div>
            <div className="form-grid" style={{ marginTop: 16 }}>
              <div className="field field--full">
                <label>Nama kelompok</label>
                <input
                  autoFocus
                  value={draft.name}
                  onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                  placeholder="Contoh: Kelompok 1"
                />
              </div>
              <div className="field field--full">
                <label>Tugas / instruksi kelompok</label>
                <textarea
                  value={draft.instructions}
                  onChange={(event) => setDraft({ ...draft, instructions: event.target.value })}
                  placeholder="Apa yang harus dikerjakan kelompok ini?"
                />
              </div>
              <div className="field">
                <label>Maksimal siswa</label>
                <select
                  value={draft.maxMembers}
                  onChange={(event) => setDraft({ ...draft, maxMembers: Number(event.target.value) })}
                >
                  {[2, 3, 4, 5].map((slot) => (
                    <option key={slot} value={slot}>
                      {slot} siswa
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Deadline (opsional)</label>
                <input
                  type="datetime-local"
                  value={draft.deadline}
                  onChange={(event) => setDraft({ ...draft, deadline: event.target.value })}
                />
              </div>
            </div>
            <div className="modal-actions">
              <button className="button button--ghost button--small" onClick={() => setDraft(null)}>
                Batal
              </button>
              <button className="button button--primary button--small" onClick={submitRoom} disabled={saving}>
                {saving ? <Loader2 size={14} className="spin" /> : <Save size={14} />} Simpan
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast message={toast} onClose={() => setToast("")} />}
    </AppShell>
  );
}
