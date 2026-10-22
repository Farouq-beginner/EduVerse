"use client";

import { useState } from "react";
import { ArrowRight, Check, RotateCcw, Sparkles, Trophy } from "lucide-react";
import { NumberLineVisualizer } from "@/components/NumberLineVisualizer";
import type { GameTemplateId } from "@/lib/demo-data";
import { getGameConfig } from "@/lib/storage";
import { getGameGrade, makeChallenge } from "@/lib/game";

/**
 * Visual interaktif yang bisa dipilih guru pada materi Aktivitas.
 * Satu komponen dipakai bersama oleh halaman game dan halaman materi supaya
 * siswa melihat visual yang benar-benar sama.
 */
export function InteractiveVisual({ visualId, onComplete }: { visualId: GameTemplateId; onComplete?: () => void }) {
  if (visualId === "number-line-lab") {
    return <NumberLineVisualizer title="Laboratorium Garis Bilangan Interaktif" description="Atur titik awal dan langkah, lalu amati perpindahan titik pada garis bilangan." />;
  }
  if (visualId === "charge-cards") {
    return <ChargeCardsGame onComplete={onComplete} />;
  }
  if (visualId === "number-line-challenge") {
    return <ChallengeGame onComplete={onComplete} />;
  }
  return <NumberLineGame onComplete={onComplete} />;
}

function NumberLineGame({ onComplete }: { onComplete?: () => void }) {
  const [start, setStart] = useState(-2);
  const [move, setMove] = useState(5);
  const [direction, setDirection] = useState<"kanan" | "kiri">("kanan");
  const answer = direction === "kanan" ? start + move : start - move;
  return (
    <GamePanel eyebrow="GARIS BILANGAN" title="Gerakkan pionmu" description="Ubah konteks suhu menjadi gerakan konkret pada garis bilangan.">
      <div className="number-line-controls">
        <label>
          Titik awal
          <input type="number" value={start} onChange={(event) => setStart(Number(event.target.value))} />
        </label>
        <label>
          Arah
          <select value={direction} onChange={(event) => setDirection(event.target.value as "kanan" | "kiri")}>
            <option>kanan</option>
            <option>kiri</option>
          </select>
        </label>
        <label>
          Langkah
          <input type="number" min="1" value={move} onChange={(event) => setMove(Number(event.target.value))} />
        </label>
      </div>
      <div className="number-line-board">
        <div className="number-line-axis">
          <span className="number-line-marker" style={{ left: `${Math.max(3, Math.min(97, (answer + 10) * 5))}%` }}>
            ●
          </span>
          {[-10, -5, 0, 5, 10].map((n) => (
            <span key={n} style={{ left: `${(n + 10) * 5}%` }}>
              {n}
            </span>
          ))}
        </div>
        <strong>
          {start} {direction === "kanan" ? "+" : "−"} {move} = {answer}
        </strong>
      </div>
      <p className="game-feedback">
        <Sparkles size={16} /> Pion bergerak ke {direction}. Hasil akhirnya {answer}.
      </p>
      {onComplete && (
        <button className="button button--primary" onClick={onComplete}>
          <Check size={16} /> Tandai selesai
        </button>
      )}
    </GamePanel>
  );
}

function ChargeCardsGame({ onComplete }: { onComplete?: () => void }) {
  const [positive, setPositive] = useState(2);
  const [negative, setNegative] = useState(5);
  const result = positive - negative;
  return (
    <GamePanel eyebrow="KARTU MUATAN" title="Bangun pasangan nol" description="Setiap kartu positif dan negatif yang berpasangan membentuk nol. Hitung kartu yang tersisa.">
      <div className="charge-board">
        <div>
          <span className="charge-card charge-card--positive">+1</span>
          <strong>{positive} kartu positif</strong>
          <div>
            <button className="button button--ghost button--small" onClick={() => setPositive((value) => value + 1)}>
              Tambah +
            </button>
            <button className="button button--ghost button--small" onClick={() => setPositive((value) => Math.max(0, value - 1))}>
              Kurangi
            </button>
          </div>
        </div>
        <div className="charge-vs">−</div>
        <div>
          <span className="charge-card charge-card--negative">−1</span>
          <strong>{negative} kartu negatif</strong>
          <div>
            <button className="button button--ghost button--small" onClick={() => setNegative((value) => value + 1)}>
              Tambah −
            </button>
            <button className="button button--ghost button--small" onClick={() => setNegative((value) => Math.max(0, value - 1))}>
              Kurangi
            </button>
          </div>
        </div>
      </div>
      <div className="game-result">
        <span>Hasil kartu tersisa</span>
        <strong>{result}</strong>
        <small>{Math.min(positive, negative)} pasangan nol terbentuk</small>
      </div>
      {onComplete && (
        <button className="button button--primary" onClick={onComplete}>
          <Check size={16} /> Saya paham
        </button>
      )}
    </GamePanel>
  );
}

function ChallengeGame({ onComplete }: { onComplete?: () => void }) {
  const config = getGameConfig();
  const [seed, setSeed] = useState(1);
  const [answer, setAnswer] = useState("");
  const [correct, setCorrect] = useState(0);
  const [message, setMessage] = useState("");
  const challenge = makeChallenge(config, seed);
  const finished = seed > Math.min(5, config.questionCount);

  function submit() {
    if (Number(answer) === challenge.answer) {
      setCorrect((value) => value + 1);
      setMessage("Benar! Strategimu tepat.");
    } else setMessage(`Belum tepat. Jawaban yang benar adalah ${challenge.answer}.`);
  }
  function next() {
    setSeed((value) => value + 1);
    setAnswer("");
    setMessage("");
  }
  const grade = getGameGrade(correct, Math.min(5, config.questionCount), config);
  return (
    <GamePanel eyebrow="NUMBER LINE CHALLENGE" title="Tantangan garis bilangan" description="Jawab operasi dengan cepat. Playtest game tidak masuk gradebook siswa.">
      <div className="challenge-card">
        <span className="challenge-level">LEVEL {Math.min(seed, 3)}</span>
        <div className="challenge-equation">
          {challenge.left} {challenge.operation} {challenge.right} = ?
        </div>
        <input
          className="challenge-answer"
          type="number"
          value={answer}
          onChange={(event) => setAnswer(event.target.value)}
          placeholder="Jawabanmu"
          onKeyDown={(event) => event.key === "Enter" && submit()}
        />
        {message && (
          <p className={`game-feedback ${message.startsWith("Benar") ? "is-good" : ""}`}>
            <Sparkles size={16} /> {message}
          </p>
        )}
        <div className="challenge-actions">
          {!finished ? (
            <>
              <button className="button button--primary" onClick={submit}>
                Cek jawaban
              </button>
              <button className="button button--ghost" onClick={next}>
                Soal berikutnya <ArrowRight size={15} />
              </button>
            </>
          ) : (
            onComplete && (
              <button className="button button--primary" onClick={onComplete}>
                <Trophy size={16} /> Selesai · {grade.score}%
              </button>
            )
          )}
        </div>
      </div>
      <div className="game-footer">
        <span>{correct} benar</span>
        <button
          className="icon-button"
          onClick={() => {
            setSeed(1);
            setCorrect(0);
            setMessage("");
            setAnswer("");
          }}
          aria-label="Reset game"
        >
          <RotateCcw size={16} />
        </button>
      </div>
    </GamePanel>
  );
}

export function GamePanel({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="game-panel">
      <div className="game-panel__head">
        <div>
          <div className="eyebrow">{eyebrow}</div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        <span className="game-panel__spark">
          <Sparkles size={22} />
        </span>
      </div>
      {children}
    </div>
  );
}
