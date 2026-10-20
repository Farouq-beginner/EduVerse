"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Gamepad2, RotateCcw, Sparkles, Trophy } from "lucide-react";
import { useParams, useSearchParams } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { Toast } from "@/components/Toast";
import { demoCourse } from "@/lib/demo-data";
import { getGameConfig, getIdentity, saveProgress } from "@/lib/storage";
import { getGameGrade, makeChallenge } from "@/lib/game";
import { getCourseStructure, getMyCourseProgress } from "@/lib/actions/dashboards";
import { markBlockComplete } from "@/lib/actions/progress";

const games = [
  { id: "block-number-line", title: "Aktivitas Garis Bilangan", description: "Geser pion dan lihat operasi sebagai gerakan konkret.", tone: "violet" },
  { id: "block-cards", title: "Kartu Muatan Positif & Negatif", description: "Bangun pasangan nol dan temukan hasil operasi dengan kartu.", tone: "teal" },
  { id: "block-game", title: "Number Line Challenge", description: "Jawab cepat, naik level, dan kumpulkan poin.", tone: "yellow" },
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

  // Petakan id game demo ke id blok database (agar progres tersimpan benar).
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
  return <AppShell role="student"><div className="games-page"><div className="module-page__top"><Link href={`/learn/${courseSlug}`} className="back-link"><ArrowLeft size={14} /> Kembali ke ruang belajar</Link>{identity && <span className="module-page__identity">{identity.name} · {identity.className}</span>}</div><div className="games-hero"><div><div className="eyebrow">GAME LIBRARY · EDUVERSE</div><h1>Belajar sambil bergerak.</h1><p>Pilih permainan yang membantu kamu melihat bilangan bulat sebagai gerakan, pasangan kartu, dan tantangan cepat.</p></div><div className="games-hero__badge"><Gamepad2 size={28} /><small>3 game aktif</small></div></div><div className="games-layout"><aside className="game-library-list">{games.map((game) => <button key={game.id} className={`game-library-item game-library-item--${game.tone} ${active === game.id ? "is-active" : ""}`} onClick={() => setActive(game.id)}><span><Gamepad2 size={17} /></span><div><strong>{game.title}</strong><small>{game.description}</small></div><ArrowRight size={14} /></button>)}</aside><main className="game-stage">{active === "block-number-line" && <NumberLineGame onComplete={() => finish(selected.title)} />}{active === "block-cards" && <ChargeCardsGame onComplete={() => finish(selected.title)} />}{active === "block-game" && <ChallengeGame onComplete={() => finish(selected.title)} />}</main></div>{toast && <Toast message={toast} onClose={() => setToast("")} />}</div></AppShell>;
}

function NumberLineGame({ onComplete }: { onComplete: () => void }) { const [start, setStart] = useState(-2); const [move, setMove] = useState(5); const [direction, setDirection] = useState<"kanan" | "kiri">("kanan"); const answer = direction === "kanan" ? start + move : start - move; return <GamePanel eyebrow="GAME 01 · GARIS BILANGAN" title="Gerakkan pionmu" description="Ubah konteks suhu menjadi gerakan konkret pada garis bilangan."><div className="number-line-controls"><label>Titik awal<input type="number" value={start} onChange={(event) => setStart(Number(event.target.value))} /></label><label>Arah<select value={direction} onChange={(event) => setDirection(event.target.value as "kanan" | "kiri")}><option>kanan</option><option>kiri</option></select></label><label>Langkah<input type="number" min="1" value={move} onChange={(event) => setMove(Number(event.target.value))} /></label></div><div className="number-line-board"><div className="number-line-axis"><span className="number-line-marker" style={{ left: `${Math.max(3, Math.min(97, (answer + 10) * 5))}%` }}>●</span>{[-10, -5, 0, 5, 10].map((n) => <span key={n} style={{ left: `${(n + 10) * 5}%` }}>{n}</span>)}</div><strong>{start} {direction === "kanan" ? "+" : "−"} {move} = {answer}</strong></div><p className="game-feedback"><Sparkles size={16} /> Pion bergerak ke {direction}. Hasil akhirnya {answer}.</p><button className="button button--primary" onClick={onComplete}><Check size={16} /> Tandai selesai</button></GamePanel>; }

function ChargeCardsGame({ onComplete }: { onComplete: () => void }) { const [positive, setPositive] = useState(2); const [negative, setNegative] = useState(5); const result = positive - negative; return <GamePanel eyebrow="GAME 02 · KARTU MUATAN" title="Bangun pasangan nol" description="Setiap kartu positif dan negatif yang berpasangan membentuk nol. Hitung kartu yang tersisa."><div className="charge-board"><div><span className="charge-card charge-card--positive">+1</span><strong>{positive} kartu positif</strong><div><button className="button button--ghost button--small" onClick={() => setPositive((value) => value + 1)}>Tambah +</button><button className="button button--ghost button--small" onClick={() => setPositive((value) => Math.max(0, value - 1))}>Kurangi</button></div></div><div className="charge-vs">−</div><div><span className="charge-card charge-card--negative">−1</span><strong>{negative} kartu negatif</strong><div><button className="button button--ghost button--small" onClick={() => setNegative((value) => value + 1)}>Tambah −</button><button className="button button--ghost button--small" onClick={() => setNegative((value) => Math.max(0, value - 1))}>Kurangi</button></div></div></div><div className="game-result"><span>Hasil kartu tersisa</span><strong>{result}</strong><small>{Math.min(positive, negative)} pasangan nol terbentuk</small></div><button className="button button--primary" onClick={onComplete}><Check size={16} /> Saya paham</button></GamePanel>; }

function ChallengeGame({ onComplete }: { onComplete: () => void }) { const config = getGameConfig(); const [seed, setSeed] = useState(1); const [answer, setAnswer] = useState(""); const [correct, setCorrect] = useState(0); const [message, setMessage] = useState(""); const challenge = makeChallenge(config, seed); const finished = seed > Math.min(5, config.questionCount); function submit() { if (Number(answer) === challenge.answer) { setCorrect((value) => value + 1); setMessage("Benar! Strategimu tepat."); } else setMessage(`Belum tepat. Jawaban yang benar adalah ${challenge.answer}.`); } function next() { setSeed((value) => value + 1); setAnswer(""); setMessage(""); } const grade = getGameGrade(correct, Math.min(5, config.questionCount), config); return <GamePanel eyebrow="GAME 03 · NUMBER LINE CHALLENGE" title="Tantangan garis bilangan" description="Jawab operasi dengan cepat. Playtest game tidak masuk gradebook siswa."><div className="challenge-card"><span className="challenge-level">LEVEL {Math.min(seed, 3)}</span><div className="challenge-equation">{challenge.left} {challenge.operation} {challenge.right} = ?</div><input className="challenge-answer" type="number" value={answer} onChange={(event) => setAnswer(event.target.value)} placeholder="Jawabanmu" onKeyDown={(event) => event.key === "Enter" && submit()} />{message && <p className={`game-feedback ${message.startsWith("Benar") ? "is-good" : ""}`}><Sparkles size={16} /> {message}</p>}<div className="challenge-actions">{!finished ? <><button className="button button--primary" onClick={submit}>Cek jawaban</button><button className="button button--ghost" onClick={next}>Soal berikutnya <ArrowRight size={15} /></button></> : <button className="button button--primary" onClick={onComplete}><Trophy size={16} /> Selesai · {grade.score}%</button>}</div></div><div className="game-footer"><span>{correct} benar</span><button className="icon-button" onClick={() => { setSeed(1); setCorrect(0); setMessage(""); setAnswer(""); }} aria-label="Reset game"><RotateCcw size={16} /></button></div></GamePanel>; }

function GamePanel({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children: React.ReactNode }) { return <div className="game-panel"><div className="game-panel__head"><div><div className="eyebrow">{eyebrow}</div><h2>{title}</h2><p>{description}</p></div><span className="game-panel__spark"><Sparkles size={22} /></span></div>{children}</div>; }
