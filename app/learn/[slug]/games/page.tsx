"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, Gamepad2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Toast } from "@/components/Toast";
import { InteractiveVisual } from "@/components/InteractiveVisual";
import { demoCourse, type GameTemplateId } from "@/lib/demo-data";
import { getIdentity, saveProgress } from "@/lib/storage";
import { getCourseStructure, getMyCourseProgress } from "@/lib/actions/dashboards";
import { markBlockComplete } from "@/lib/actions/progress";

const games: Array<{ id: string; visualId: GameTemplateId; title: string; description: string; tone: string }> = [
  { id: "block-number-line", visualId: "number-line", title: "Aktivitas Garis Bilangan", description: "Geser pion dan lihat operasi sebagai gerakan konkret.", tone: "violet" },
  { id: "block-cards", visualId: "charge-cards", title: "Kartu Muatan Positif & Negatif", description: "Bangun pasangan nol dan temukan hasil operasi dengan kartu.", tone: "teal" },
  { id: "block-game", visualId: "number-line-challenge", title: "Number Line Challenge", description: "Jawab cepat, naik level, dan kumpulkan poin.", tone: "yellow" },
];

export default function GamesPage() {
  const params = useParams<{ slug: string }>();
  const searchParams = useSearchParams();
  const courseSlug = params.slug || demoCourse.slug;
  const [active, setActive] = useState(searchParams.get("game") || "block-game");
  const [toast, setToast] = useState("");
  const [identity, setIdentity] = useState<ReturnType<typeof getIdentity>>(null);
  const [courseId, setCourseId] = useState<string | null>(null);
  const [enrolled, setEnrolled] = useState(false);
  const [blockIds, setBlockIds] = useState<Record<string, string>>({});
  const selected = games.find((game) => game.id === active) ?? games[2];

  // Petakan id game ke id blok database (agar progres tersimpan benar).
  useEffect(() => {
    setIdentity(getIdentity());
    (async () => {
      try {
        const [structure, mine] = await Promise.all([
          getCourseStructure(courseSlug),
          getMyCourseProgress(courseSlug),
        ]);
        if (mine) {
          setCourseId(mine.courseId);
          setEnrolled(mine.enrolled);
        }
        if (structure) {
          const map: Record<string, string> = {};
          for (const module of structure.modules) {
            for (const block of module.blocks) {
              const gameId = (block.material as { game?: { gameId?: string } } | null)?.game?.gameId;
              if (!gameId) continue;
              if (gameId === "number-line") map["block-number-line"] = block.id;
              else if (gameId === "charge-cards") map["block-cards"] = block.id;
              else if (gameId === "number-line-challenge") map["block-game"] = block.id;
            }
          }
          setBlockIds(map);
        }
      } catch {
        // DB belum aktif — progres tetap disimpan di perangkat.
      }
    })();
  }, [courseSlug]);

  async function finish(label: string) {
    saveProgress(8);
    const blockId = blockIds[selected.id];
    if (courseId && enrolled && blockId) {
      const res = await markBlockComplete({ courseId, blockId }).catch(() => ({ ok: false, error: "Gagal menyimpan ke server." }));
      setToast(res.ok ? `${label} selesai. Tersinkron ke akun guru.` : `${label} selesai. ${res.error ?? "Belum tersimpan di server."}`);
      return;
    }
    setToast(`${label} selesai. Progres tersimpan di perangkat.`);
  }

  return (
    <AppShell role="student">
      <div className="games-page">
        <div className="module-page__top">
          <Link href={`/learn/${courseSlug}`} className="back-link">
            <ArrowLeft size={14} /> Kembali ke ruang belajar
          </Link>
          {identity && (
            <span className="module-page__identity">
              {identity.name} · {identity.className}
            </span>
          )}
        </div>
        <div className="games-hero">
          <div>
            <div className="eyebrow">GAME LIBRARY · EDUVERSE</div>
            <h1>Belajar sambil bergerak.</h1>
            <p>Pilih permainan yang membantu kamu melihat bilangan bulat sebagai gerakan, pasangan kartu, dan tantangan cepat.</p>
          </div>
          <div className="games-hero__badge">
            <Gamepad2 size={28} />
            <small>{games.length} game aktif</small>
          </div>
        </div>
        <div className="games-layout">
          <aside className="game-library-list">
            {games.map((game) => (
              <button
                key={game.id}
                className={`game-library-item game-library-item--${game.tone} ${active === game.id ? "is-active" : ""}`}
                onClick={() => setActive(game.id)}
              >
                <span>
                  <Gamepad2 size={17} />
                </span>
                <div>
                  <strong>{game.title}</strong>
                  <small>{game.description}</small>
                </div>
                <ArrowRight size={14} />
              </button>
            ))}
          </aside>
          <main className="game-stage">
            <InteractiveVisual visualId={selected.visualId} onComplete={() => finish(selected.title)} />
          </main>
        </div>
        {toast && <Toast message={toast} onClose={() => setToast("")} />}
      </div>
    </AppShell>
  );
}
