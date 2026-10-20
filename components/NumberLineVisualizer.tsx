"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight, RotateCcw, Sparkles } from "lucide-react";

interface NumberLineVisualizerProps {
  initialStart?: number;
  initialMove?: number;
  initialOp?: "+" | "-";
  title?: string;
  description?: string;
}

export function NumberLineVisualizer({
  initialStart = -2,
  initialMove = 5,
  initialOp = "+",
  title = "Visualisasi Garis Bilangan Interaktif",
  description = "Eksplorasi bagaimana operasi hitung bilangan bulat bergerak di atas garis bilangan.",
}: NumberLineVisualizerProps) {
  const [start, setStart] = useState<number>(initialStart);
  const [move, setMove] = useState<number>(initialMove);
  const [op, setOp] = useState<"+" | "-">(initialOp);

  // Perhitungan hasil
  const effectiveMove = op === "+" ? move : -move;
  const result = start + effectiveMove;

  // Garis bilangan dari -10 ke 10
  const min = -10;
  const max = 10;
  const range = max - min;

  function toPercent(val: number) {
    const clamped = Math.max(min, Math.min(max, val));
    return ((clamped - min) / range) * 100;
  }

  const startPct = toPercent(start);
  const resultPct = toPercent(result);
  const leftPct = Math.min(startPct, resultPct);
  const widthPct = Math.abs(resultPct - startPct);

  return (
    <div className="number-line-widget">
      <div className="number-line-widget__header">
        <div>
          <div className="eyebrow" style={{ color: "var(--teal)" }}>
            VISUAL INTERAKTIF
          </div>
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
        <div className="number-line-formula">
          <span className="formula-part formula-start">{start}</span>
          <span className="formula-op">{op}</span>
          <span className="formula-part formula-move">{move >= 0 ? move : `(${move})`}</span>
          <span className="formula-eq">=</span>
          <span className="formula-part formula-result">{result}</span>
        </div>
      </div>

      {/* Kontrol Input */}
      <div className="number-line-controls">
        <div className="control-group">
          <label>Titik Awal (a):</label>
          <div className="button-stepper">
            <button
              type="button"
              onClick={() => setStart((s) => Math.max(-10, s - 1))}
              disabled={start <= -10}
            >
              -
            </button>
            <span className="stepper-val">{start}</span>
            <button
              type="button"
              onClick={() => setStart((s) => Math.min(10, s + 1))}
              disabled={start >= 10}
            >
              +
            </button>
          </div>
        </div>

        <div className="control-group">
          <label>Operasi:</label>
          <div className="toggle-group">
            <button
              type="button"
              className={op === "+" ? "is-active" : ""}
              onClick={() => setOp("+")}
            >
              + (Tambah / Maju)
            </button>
            <button
              type="button"
              className={op === "-" ? "is-active" : ""}
              onClick={() => setOp("-")}
            >
              - (Kurang / Mundur)
            </button>
          </div>
        </div>

        <div className="control-group">
          <label>Langkah (b):</label>
          <div className="button-stepper">
            <button
              type="button"
              onClick={() => setMove((m) => Math.max(0, m - 1))}
              disabled={move <= 0}
            >
              -
            </button>
            <span className="stepper-val">{move}</span>
            <button
              type="button"
              onClick={() => setMove((m) => Math.min(15, m + 1))}
              disabled={move >= 15}
            >
              +
            </button>
          </div>
        </div>

        <button
          type="button"
          className="reset-btn"
          onClick={() => {
            setStart(initialStart);
            setMove(initialMove);
            setOp(initialOp);
          }}
          title="Reset ke awal"
        >
          <RotateCcw size={15} />
        </button>
      </div>

      {/* Garis Bilangan Visual */}
      <div className="number-line-track-wrap">
        <div className="number-line-track">
          {/* Garis lintasan panah */}
          {widthPct > 0 && (
            <div
              className={`number-line-arrow ${effectiveMove >= 0 ? "move-right" : "move-left"}`}
              style={{
                left: `${leftPct}%`,
                width: `${widthPct}%`,
              }}
            >
              <div className="arrow-badge">
                {effectiveMove >= 0 ? `+${effectiveMove}` : effectiveMove}
              </div>
            </div>
          )}

          {/* Titik Awal Marker */}
          <div
            className="track-marker marker-start"
            style={{ left: `${startPct}%` }}
            title={`Titik Awal: ${start}`}
          >
            <div className="marker-dot" />
            <span className="marker-tag">Awal ({start})</span>
          </div>

          {/* Titik Akhir Marker */}
          <div
            className="track-marker marker-result"
            style={{ left: `${resultPct}%` }}
            title={`Posisi Akhir: ${result}`}
          >
            <div className="marker-dot" />
            <span className="marker-tag">Hasil ({result})</span>
          </div>

          {/* Skala angka -10 sampai 10 */}
          <div className="number-line-ticks">
            {Array.from({ length: 21 }, (_, i) => i - 10).map((num) => {
              const isZero = num === 0;
              const isStart = num === start;
              const isResult = num === result;
              return (
                <div
                  key={num}
                  className={`track-tick ${isZero ? "tick-zero" : ""} ${
                    isStart ? "tick-start" : ""
                  } ${isResult ? "tick-result" : ""}`}
                >
                  <div className="tick-line" />
                  <span className="tick-label">{num}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Penjelasan Intuisi */}
      <div className="number-line-explainer">
        <Sparkles size={16} />
        <div>
          <strong>Penjelasan Konsep:</strong>
          <p>
            Mulai dari posisi <strong>{start}</strong>. Karena operasinya adalah{" "}
            <strong>{op === "+" ? "penjumlahan (+)" : "pengurangan (-)"}</strong> sebanyak{" "}
            <strong>{move} langkah</strong>, titik bergerak ke arah{" "}
            <strong>{effectiveMove >= 0 ? "kanan (searah positif)" : "kiri (searah negatif)"}</strong>.
            Posisi akhir berhenti tepat pada angka <strong>{result}</strong>.
          </p>
        </div>
      </div>
    </div>
  );
}
