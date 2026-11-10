"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  Clock3,
  Gamepad2,
  Loader2,
  MessageCircle,
  Pencil,
  Plus,
  Save,
  Send,
  Trash2,
  Trophy,
  UsersRound,
  X,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { StatusPill } from "@/components/DashboardBits";
import { Toast } from "@/components/Toast";
import {
  deleteGroupTask,
  getStudentGroupRooms,
  getStudentRoom,
  joinGroupRoom,
  saveGroupTask,
  sendRoomMessage,
  type GroupRoomDetail,
  type GroupRoomSummary,
} from "@/lib/actions/groups";

type TaskDraft = { id?: string; title: string; body: string; fileUrl: string; fileName: string };

const emptyTask: TaskDraft = { title: "", body: "", fileUrl: "", fileName: "" };

export default function StudentGroupGamePage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;

  const [courseTitle, setCourseTitle] = useState("");
  const [rooms, setRooms] = useState<GroupRoomSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState<string | null>(null);
  const [room, setRoom] = useState<GroupRoomDetail | null>(null);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [taskDraft, setTaskDraft] = useState<TaskDraft | null>(null);
  const [savingTask, setSavingTask] = useState(false);
  const [deletingTask, setDeletingTask] = useState<string | null>(null);
  const [toast, setToast] = useState("");

  const loadRooms = useCallback(async () => {
    const data = await getStudentGroupRooms(slug);
    setCourseTitle(data.courseTitle);
    setRooms(data.rooms);
  }, [slug]);

  useEffect(() => {
    let active = true;
    loadRooms()
      .catch(() => undefined)
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [loadRooms]);

  const refreshRoom = useCallback(async (roomId: string) => {
    const data = await getStudentRoom(roomId);
    if (data) setRoom(data);
    return data;
  }, []);

  // Chat dan tugas diperbarui berkala supaya anggota kelompok melihat pesan baru.
  useEffect(() => {
    if (!room) return;
    const timer = setInterval(() => {
      void refreshRoom(room.id);
    }, 6000);
    return () => clearInterval(timer);
  }, [room?.id, refreshRoom]);

  async function join(roomId: string) {
    if (joining) return;
    setJoining(roomId);
    const result = await joinGroupRoom(roomId);
    setJoining(null);
    if (!result.ok || !result.roomId) {
      setToast(result.error ?? "Gagal bergabung ke kelompok.");
      return;
    }
    await loadRooms();
    const detail = await refreshRoom(result.roomId);
    if (!detail) {
      setToast("Kelompok ditemukan, tetapi room belum bisa dibuka.");
      return;
    }
    setToast("Kamu bergabung ke kelompok.");
  }

  async function open(roomId: string) {
    const detail = await refreshRoom(roomId);
    if (!detail) {
      setToast("Kamu bukan anggota kelompok ini.");
      return;
    }
    setTaskDraft(null);
  }

  async function send() {
    if (!room || sending) return;
    if (!message.trim()) return;
    setSending(true);
    const result = await sendRoomMessage({ roomId: room.id, body: message });
    setSending(false);
    if (!result.ok) {
      setToast(result.error ?? "Gagal mengirim pesan.");
      return;
    }
    setMessage("");
    await refreshRoom(room.id);
  }

  async function submitTask() {
    if (!room || !taskDraft || savingTask) return;
    if (!taskDraft.title.trim()) {
      setToast("Judul tugas wajib diisi.");
      return;
    }
    setSavingTask(true);
    const result = await saveGroupTask({
      roomId: room.id,
      id: taskDraft.id,
      title: taskDraft.title,
      body: taskDraft.body,
      fileUrl: taskDraft.fileUrl,
      fileName: taskDraft.fileName,
    });
    setSavingTask(false);
    if (!result.ok) {
      setToast(result.error ?? "Gagal menyimpan tugas.");
      return;
    }
    setTaskDraft(null);
    await refreshRoom(room.id);
    setToast("Tugas kelompok tersimpan.");
  }

  async function removeTask(id: string) {
    if (!room) return;
    setDeletingTask(id);
    const result = await deleteGroupTask(id);
    setDeletingTask(null);
    if (!result.ok) {
      setToast(result.error ?? "Gagal menghapus tugas.");
      return;
    }
    await refreshRoom(room.id);
    setToast("Tugas dihapus.");
  }

  return (
    <AppShell role="student">
      <div className="student-wrap">
        <Link href={room ? `/learn/${slug}/game` : `/learn/${slug}`} className="back-link" onClick={() => setRoom(null)}>
          <ArrowLeft size={14} /> {room ? "Kembali ke daftar kelompok" : "Kembali ke pembelajaran"}
        </Link>

        {room ? (
          <div className="group-room" style={{ marginTop: 16 }}>
            <div className="group-room__head">
              <div>
                <div className="eyebrow">ROOM KELOMPOK · {courseTitle.toUpperCase()}</div>
                <h1>{room.name}</h1>
                <div className="group-room__meta">
                  <span>
                    <UsersRound size={13} /> {room.members.length}/{room.maxMembers} anggota
                  </span>
                  <span>
                    <Clock3 size={13} />{" "}
                    {room.deadline ? new Date(room.deadline).toLocaleString("id-ID") : "Tanpa deadline"}
                  </span>
                </div>
                {room.instructions && <p className="group-room__instructions">{room.instructions}</p>}
              </div>
              <StatusPill tone={room.grade !== null ? "teal" : room.locked ? "coral" : "yellow"}>
                {room.grade !== null ? `Nilai ${room.grade}` : room.locked ? "Terkunci" : "Berjalan"}
              </StatusPill>
            </div>

            {room.grade !== null && (
              <div className="grade-banner">
                <Trophy size={18} />
                <div>
                  <strong>Nilai kelompok {room.grade}</strong>
                  <small>
                    {room.feedback || "Guru sudah menilai. Tugas dan chat tidak bisa diubah lagi."}
                  </small>
                </div>
              </div>
            )}

            <div className="group-room__grid">
              <div className="panel">
                <div className="section-title" style={{ marginBottom: 12 }}>
                  <div>
                    <div className="eyebrow">TUGAS BERSAMA</div>
                    <h2 style={{ fontSize: "1rem" }}>{room.tasks.length} tugas</h2>
                  </div>
                  {!room.locked && (
                    <button
                      className="button button--primary button--small"
                      onClick={() => setTaskDraft({ ...emptyTask })}
                    >
                      <Plus size={14} /> Tambah tugas
                    </button>
                  )}
                </div>

                {taskDraft && (
                  <div className="task-editor">
                    <div className="field field--full">
                      <label>Judul tugas</label>
                      <input
                        autoFocus
                        value={taskDraft.title}
                        onChange={(event) => setTaskDraft({ ...taskDraft, title: event.target.value })}
                        placeholder="Contoh: Ringkasan hasil diskusi"
                      />
                    </div>
                    <div className="field field--full">
                      <label>Jawaban / catatan kelompok</label>
                      <textarea
                        value={taskDraft.body}
                        onChange={(event) => setTaskDraft({ ...taskDraft, body: event.target.value })}
                        placeholder="Tulis hasil kerja kelompok di sini..."
                      />
                    </div>
                    <div className="field field--full">
                      <label>Link lampiran (opsional)</label>
                      <input
                        value={taskDraft.fileUrl}
                        onChange={(event) => setTaskDraft({ ...taskDraft, fileUrl: event.target.value })}
                        placeholder="https://drive.google.com/..."
                      />
                    </div>
                    <div className="task-editor__actions">
                      <button className="button button--ghost button--small" onClick={() => setTaskDraft(null)}>
                        Batal
                      </button>
                      <button className="button button--primary button--small" onClick={submitTask} disabled={savingTask}>
                        {savingTask ? <Loader2 size={14} className="spin" /> : <Save size={14} />} Simpan
                      </button>
                    </div>
                  </div>
                )}

                <div className="task-list">
                  {room.tasks.length === 0 ? (
                    <p className="section-subtitle">Belum ada tugas. Semua anggota boleh menambah.</p>
                  ) : (
                    room.tasks.map((task) => (
                      <div className="task-card" key={task.id}>
                        <div className="task-card__head">
                          <strong>{task.title}</strong>
                          <small>{new Date(task.createdAt).toLocaleString("id-ID")}</small>
                        </div>
                        {task.body && <p>{task.body}</p>}
                        <div className="task-card__foot">
                          <small>oleh {task.createdByName}</small>
                          <div className="row-actions">
                            {task.fileUrl && (
                              <a href={task.fileUrl} target="_blank" rel="noreferrer" className="text-link">
                                Lampiran
                              </a>
                            )}
                            {!room.locked && (
                              <>
                                <button
                                  className="icon-button icon-button--tiny"
                                  onClick={() =>
                                    setTaskDraft({
                                      id: task.id,
                                      title: task.title,
                                      body: task.body,
                                      fileUrl: task.fileUrl ?? "",
                                      fileName: task.fileName ?? "",
                                    })
                                  }
                                  aria-label="Edit tugas"
                                >
                                  <Pencil size={13} />
                                </button>
                                <button
                                  className="icon-button icon-button--tiny"
                                  onClick={() => removeTask(task.id)}
                                  disabled={deletingTask === task.id}
                                  aria-label="Hapus tugas"
                                >
                                  {deletingTask === task.id ? (
                                    <Loader2 size={13} className="spin" />
                                  ) : (
                                    <Trash2 size={13} />
                                  )}
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="panel chat-panel">
                <div className="section-title" style={{ marginBottom: 12 }}>
                  <div>
                    <div className="eyebrow">CHAT KELOMPOK</div>
                    <h2 style={{ fontSize: "1rem" }}>{room.members.length} anggota</h2>
                  </div>
                  <MessageCircle size={18} color="var(--muted)" />
                </div>
                <div className="member-chips" style={{ marginBottom: 12 }}>
                  {room.members.map((member) => (
                    <span className="member-chip" key={member.id}>
                      <strong>{member.name}</strong>
                      <small>{member.className}</small>
                    </span>
                  ))}
                </div>
                <div className="chat-log">
                  {room.messages.length === 0 ? (
                    <p className="section-subtitle">Mulai percakapan dengan kelompokmu.</p>
                  ) : (
                    room.messages.map((chat) => (
                      <div className="chat-bubble" key={chat.id}>
                        <div className="chat-bubble__head">
                          <strong>{chat.authorName}</strong>
                          <small>{new Date(chat.createdAt).toLocaleTimeString("id-ID")}</small>
                        </div>
                        <p>{chat.body}</p>
                      </div>
                    ))
                  )}
                </div>
                {room.locked ? (
                  <small className="field-hint">Chat dikunci karena tugas sudah dinilai atau deadline lewat.</small>
                ) : (
                  <div className="chat-form">
                    <input
                      value={message}
                      onChange={(event) => setMessage(event.target.value)}
                      onKeyDown={(event) => event.key === "Enter" && send()}
                      placeholder="Tulis pesan untuk kelompok..."
                    />
                    <button className="button button--primary button--small" onClick={send} disabled={sending}>
                      {sending ? <Loader2 size={14} className="spin" /> : <Send size={14} />} Kirim
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="pilih-head" style={{ marginTop: 16 }}>
              <div>
                <div className="eyebrow">GAME KELOMPOK · NILAI TAMBAHAN</div>
                <h1>Room tugas kelompok</h1>
                <p>
                  {courseTitle ? `${courseTitle} · ` : ""}
                  Pilih kelompok lalu tekan Gabung. Setiap kelompok maksimal 5 siswa; kelompok yang
                  sudah penuh harus dilewati.
                </p>
              </div>
              <Link href={`/learn/${slug}/kolaborasi`} className="button button--ghost button--small">
                <Gamepad2 size={15} /> Kolaborasi
              </Link>
            </div>

            {loading ? (
              <div className="empty-state">
                <Loader2 size={24} className="spin" />
                <strong>Memuat kelompok...</strong>
              </div>
            ) : rooms.length === 0 ? (
              <div className="empty-state">
                <span className="empty-state__icon">
                  <Gamepad2 size={24} />
                </span>
                <strong>Belum ada kelompok</strong>
                <p>Guru belum membuka kelompok untuk pembelajaran ini.</p>
                <Link href={`/learn/${slug}`} className="button button--ghost button--small">
                  <ArrowLeft size={14} /> Kembali
                </Link>
              </div>
            ) : (
              <div className="group-grid">
                {rooms.map((item) => (
                  <article className="group-card" key={item.id}>
                    <div className="group-card__head">
                      <span className="group-card__icon">
                        <UsersRound size={18} />
                      </span>
                      <div>
                        <strong>{item.name}</strong>
                      </div>
                      <StatusPill
                        tone={item.graded ? "teal" : item.joined ? "violet" : item.full ? "coral" : "yellow"}
                      >
                        {item.graded ? "Sudah dinilai" : item.joined ? "Kelompokmu" : item.full ? "Penuh" : "Terbuka"}
                      </StatusPill>
                    </div>
                    <div className="group-card__meta">
                      <span>
                        <UsersRound size={13} /> {item.memberCount}/{item.maxMembers} siswa
                      </span>
                      <span>
                        <Clock3 size={13} />{" "}
                        {item.deadline ? new Date(item.deadline).toLocaleDateString("id-ID") : "Tanpa deadline"}
                      </span>
                    </div>
                    <div className="group-card__actions">
                      {item.joined ? (
                        <button className="button button--primary button--small" onClick={() => open(item.id)}>
                          Buka room
                        </button>
                      ) : (
                        <button
                          className="button button--primary button--small"
                          onClick={() => join(item.id)}
                          disabled={item.full || joining !== null}
                        >
                          {joining === item.id ? (
                            <Loader2 size={14} className="spin" />
                          ) : (
                            <UsersRound size={14} />
                          )}
                          {item.full ? "Penuh" : "Gabung kelompok"}
                        </button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {toast && <Toast message={toast} onClose={() => setToast("")} />}
    </AppShell>
  );
}
