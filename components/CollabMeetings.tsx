"use client";

import { useState } from "react";
import {
  Check,
  ExternalLink,
  GraduationCap,
  Loader2,
  Presentation,
  Trash2,
  Users,
  Video,
} from "lucide-react";
import {
  COLLAB_PROVIDERS,
  getCollabProvider,
  validateCollabUrl,
  type CollabProviderId,
} from "@/lib/collab";
import {
  deleteCourseMeeting,
  setCourseMeeting,
  type CourseMeetingRow,
} from "@/lib/actions/dashboards";

function ProviderIcon({ provider, size = 16 }: { provider: string; size?: number }) {
  if (provider === "zoom") return <Video size={size} />;
  if (provider === "meet") return <Presentation size={size} />;
  if (provider === "classroom") return <GraduationCap size={size} />;
  return <Users size={size} />;
}

/** Kotak kolaborasi di halaman siswa — hanya menampilkan link yang diisi guru. */
export function StudentMeetings({ meetings }: { meetings: CourseMeetingRow[] }) {
  const rows = meetings.filter((meeting) => getCollabProvider(meeting.provider));

  return (
    <div className="collab-card">
      <div className="collab-card__head">
        <Video size={16} />
        <strong>Kolaborasi</strong>
      </div>
      {rows.length === 0 ? (
        <p className="collab-card__empty">Belum ada kolaborasi di pertemuan ini.</p>
      ) : (
        <div className="collab-card__list">
          {rows.map((meeting) => {
            const provider = getCollabProvider(meeting.provider)!;
            return (
              <a
                key={meeting.id}
                href={meeting.url}
                target="_blank"
                rel="noreferrer"
                className={`collab-item collab-item--${provider.tone}`}
              >
                <span className="collab-item__icon">
                  <ProviderIcon provider={provider.id} />
                </span>
                <span className="collab-item__copy">
                  <strong>{provider.label}</strong>
                  <small>Gabung kolaborasi</small>
                </span>
                <ExternalLink size={13} />
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Modal guru untuk mengisi link kolaborasi tiap pertemuan. */
export function CollabMeetingModal({
  moduleId,
  moduleTitle,
  meetings,
  onChange,
  onClose,
}: {
  moduleId: string;
  moduleTitle: string;
  meetings: CourseMeetingRow[];
  onChange: (rows: CourseMeetingRow[]) => void;
  onClose: () => void;
}) {
  const [drafts, setDrafts] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    COLLAB_PROVIDERS.forEach((provider) => {
      initial[provider.id] = meetings.find((m) => m.provider === provider.id)?.url ?? "";
    });
    return initial;
  });
  const [busy, setBusy] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  async function save(provider: CollabProviderId) {
    const validated = validateCollabUrl(provider, drafts[provider] ?? "");
    if (!validated.ok) {
      setFeedback({ tone: "error", text: validated.error });
      return;
    }
    setBusy(provider);
    setFeedback(null);
    const result = await setCourseMeeting({ moduleId, provider, url: validated.url });
    setBusy(null);
    if (!result.ok || !result.meeting) {
      setFeedback({ tone: "error", text: result.error ?? "Gagal menyimpan link." });
      return;
    }
    const saved = result.meeting;
    const next = [...meetings.filter((item) => item.provider !== provider), saved];
    onChange(next);
    setDrafts((current) => ({ ...current, [provider]: saved.url }));
    setFeedback({
      tone: "ok",
      text: `Link ${getCollabProvider(provider)?.label} tersimpan untuk pertemuan ini.`,
    });
  }

  async function remove(provider: CollabProviderId) {
    setBusy(provider);
    setFeedback(null);
    const result = await deleteCourseMeeting({ moduleId, provider });
    setBusy(null);
    if (!result.ok) {
      setFeedback({ tone: "error", text: result.error ?? "Gagal menghapus link." });
      return;
    }
    onChange(meetings.filter((item) => item.provider !== provider));
    setDrafts((current) => ({ ...current, [provider]: "" }));
    setFeedback({
      tone: "ok",
      text: `Link ${getCollabProvider(provider)?.label} dihapus. Siswa melihat kotak kosong.`,
    });
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card collab-modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal-card__head">
          <div>
            <div className="eyebrow">KOLABORASI PERTEMUAN</div>
            <h2>{moduleTitle}</h2>
            <p>
              Tempel link dari aplikasi aslinya. Link Zoom tidak bisa disimpan sebagai Google
              Classroom — setiap kolaborasi hanya menerima link miliknya sendiri.
            </p>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Tutup">
            ×
          </button>
        </div>

        <div className="collab-form-list">
          {COLLAB_PROVIDERS.map((provider) => {
            const current = meetings.find((item) => item.provider === provider.id);
            const isBusy = busy === provider.id;
            return (
              <div className={`collab-form collab-form--${provider.tone}`} key={provider.id}>
                <div className="collab-form__head">
                  <span className="collab-form__icon">
                    <ProviderIcon provider={provider.id} size={15} />
                  </span>
                  <div>
                    <strong>{provider.label}</strong>
                    <small>{provider.hint}</small>
                  </div>
                  {current && <span className="status-pill status-pill--teal">Terisi</span>}
                </div>
                <div className="collab-form__row">
                  <input
                    value={drafts[provider.id] ?? ""}
                    onChange={(event) =>
                      setDrafts((state) => ({ ...state, [provider.id]: event.target.value }))
                    }
                    placeholder={provider.placeholder}
                    inputMode="url"
                  />
                  <button
                    className="button button--primary button--small"
                    onClick={() => save(provider.id)}
                    disabled={isBusy}
                  >
                    {isBusy ? <Loader2 size={14} className="spin" /> : <Check size={14} />} Simpan
                  </button>
                  {current && (
                    <button
                      className="button button--ghost button--small"
                      onClick={() => remove(provider.id)}
                      disabled={isBusy}
                    >
                      <Trash2 size={13} /> Hapus
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {feedback && (
          <div className={`collab-feedback collab-feedback--${feedback.tone}`}>{feedback.text}</div>
        )}

        <div className="modal-actions">
          <button className="button button--ghost button--small" onClick={onClose}>
            Selesai
          </button>
        </div>
      </div>
    </div>
  );
}
