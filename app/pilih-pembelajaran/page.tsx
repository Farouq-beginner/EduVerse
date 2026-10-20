"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, BookOpen, ChevronRight, LayoutGrid, Loader2, Sparkles } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { StatusPill } from "@/components/DashboardBits";
import { getPublishedCourses, type PublishedCourseCard } from "@/lib/actions/dashboards";

const accentArt: Record<string, string> = {
  violet: "−2",
  teal: "+5",
  yellow: "0",
  coral: "±3",
};

export default function ChooseLearningPage() {
  const [courses, setCourses] = useState<PublishedCourseCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    getPublishedCourses()
      .then((data) => {
        if (active) setCourses(data);
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <AppShell role="student">
      <div className="student-wrap">
        <div className="pilih-head">
          <div>
            <div className="eyebrow">PILIH PEMBELAJARAN</div>
            <h1>Mau belajar apa hari ini?</h1>
            <p>
              Pilih pembelajaran yang ingin kamu buka. Semua materi, kuis, dan game tersedia di
              dalam setiap ruang belajar.
            </p>
          </div>
          <Link href="/student" className="button button--ghost button--small">
            <LayoutGrid size={15} /> Dashboard saya
          </Link>
        </div>

        {loading ? (
          <div className="empty-state">
            <Loader2 size={24} className="spin" />
            <strong>Memuat pembelajaran...</strong>
          </div>
        ) : courses.length === 0 ? (
          <div className="empty-state">
            <span className="empty-state__icon">
              <BookOpen size={24} />
            </span>
            <strong>Belum ada pembelajaran tersedia</strong>
            <p>Minta link pembelajaran dari gurumu, lalu buka dari dashboard siswa.</p>
            <Link href="/student" className="button button--primary button--small">
              Buka dashboard <ArrowRight size={14} />
            </Link>
          </div>
        ) : (
          <div className="pilih-grid">
            {courses.map((course) => (
              <div className="pilih-card" key={course.slug}>
                <div className="pilih-card__top">
                  <span className={`pilih-card__art pilih-card__art--${course.accent}`}>
                    {accentArt[course.accent] ?? "✦"}
                  </span>
                  <StatusPill tone={course.joined ? "teal" : "violet"}>
                    {course.joined ? "Sudah kamu ikuti" : "Tersedia"}
                  </StatusPill>
                </div>
                <div className="pilih-card__body">
                  <strong>{course.title}</strong>
                  <small>
                    {course.subject} · {course.grade} · {course.teacherName}
                  </small>
                </div>
                <p className="pilih-card__desc">{course.description}</p>
                <div className="pilih-card__meta">
                  <span>
                    <BookOpen size={12} /> {course.moduleCount} modul
                  </span>
                  <span>{course.blockCount} materi</span>
                  <span>{course.duration}</span>
                </div>
                <Link
                  href={`/learn/${course.slug}`}
                  className="button button--primary pilih-card__cta"
                >
                  {course.joined ? "Lanjutkan Belajar" : "Masuk Pembelajaran"} <ChevronRight size={15} />
                </Link>
              </div>
            ))}
          </div>
        )}

        <div className="sync-card" style={{ marginTop: 24 }}>
          <div className="sync-card__top">
            <Sparkles size={16} />
            <strong>Punya link dari gurumu?</strong>
            <span className="sync-dot" />
          </div>
          <p>
            Tempel link pembelajaran di dashboard siswa untuk bergabung otomatis. Progresmu
            tetap tersimpan di akun dan bisa dilanjutkan di perangkat lain.
          </p>
        </div>
      </div>
    </AppShell>
  );
}
