"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, ExternalLink, Loader2, Sparkles } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { StatusPill } from "@/components/DashboardBits";
import {
  getStudentCollaborations,
  type CollaborationRow,
} from "@/lib/actions/collaboration";
import { getCollabProvider } from "@/lib/collab";

const tone = ["violet", "teal", "yellow", "coral"] as const;

export default function StudentCollaborationPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;

  const [rows, setRows] = useState<CollaborationRow[]>([]);
  const [courseTitle, setCourseTitle] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    getStudentCollaborations(slug)
      .then((data) => {
        if (!active) return;
        setRows(data.rows);
        setCourseTitle(data.courseTitle);
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [slug]);

  return (
    <AppShell role="student">
      <div className="student-wrap">
        <Link href={`/learn/${slug}`} className="back-link">
          <ArrowLeft size={14} /> Kembali ke pembelajaran
        </Link>

        <div className="pilih-head" style={{ marginTop: 16 }}>
          <div>
            <div className="eyebrow">KOLABORASI KELAS</div>
            <h1>Tempat kerja bersama</h1>
            <p>
              {courseTitle ? `${courseTitle} · ` : ""}
              Link di bawah disiapkan gurumu untuk dikerjakan bersama di kelas.
            </p>
          </div>
          <Link href={`/learn/${slug}/game`} className="button button--ghost button--small">
            <Sparkles size={15} /> Game kelompok
          </Link>
        </div>

        {loading ? (
          <div className="empty-state">
            <Loader2 size={24} className="spin" />
            <strong>Memuat kolaborasi...</strong>
          </div>
        ) : rows.length === 0 ? (
          <div className="empty-state">
            <span className="empty-state__icon">
              <Sparkles size={24} />
            </span>
            <strong>Belum ada kolaborasi</strong>
            <p>Guru belum menambahkan kolaborasi untuk pembelajaran ini.</p>
            <Link href={`/learn/${slug}`} className="button button--ghost button--small">
              <ArrowLeft size={14} /> Kembali
            </Link>
          </div>
        ) : (
          <div className="collab-page">
            {rows.map((row, rowIndex) => (
              <article className="collab-student-card" key={row.id}>
                <div className={`collab-student-card__bar collab-student-card__bar--${tone[rowIndex % tone.length]}`} />
                <div className="collab-student-card__head">
                  <div>
                    <strong>{row.title}</strong>
                    {row.description && <p>{row.description}</p>}
                  </div>
                  <StatusPill tone="violet">{row.links.length} link</StatusPill>
                </div>
                <div className="collab-student-card__links">
                  {row.links.map((link) => {
                    const provider = getCollabProvider(link.provider);
                    return (
                      <a
                        key={link.id}
                        href={link.url}
                        target="_blank"
                        rel="noreferrer"
                        className="collab-student-link"
                      >
                        <span className="collab-student-link__icon">
                          <ExternalLink size={14} />
                        </span>
                        <span className="collab-student-link__copy">
                          <strong>{link.label}</strong>
                          <small>{provider?.label ?? "Buka link"}</small>
                        </span>
                        <ExternalLink size={13} />
                      </a>
                    );
                  })}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
