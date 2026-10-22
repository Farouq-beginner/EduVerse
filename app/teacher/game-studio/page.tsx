"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Gamepad2, Info, Play, RotateCcw, Save, Sparkles, Trophy, WandSparkles } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { StatusPill } from "@/components/DashboardBits";
import { Toast } from "@/components/Toast";
import { defaultGameStudioConfigs, gameTemplates, type GameStudioConfig, type GameTemplateId } from "@/lib/demo-data";
import { getGameGrade, makeChallenge } from "@/lib/game";
import { getGameStudioConfig, saveGameStudioConfig } from "@/lib/storage";
import { getTeacherCourseIdBySlug, saveGameVersion } from "@/lib/actions/dashboards";
import { demoCourse } from "@/lib/demo-data";

export default function GameStudioPage() {
  const [templateId, setTemplateId] = useState<GameTemplateId>("number-line-challenge");
  const [config, setConfig] = useState<GameStudioConfig>(defaultGameStudioConfigs["number-line-challenge"]);
  const [published, setPublished] = useState(false);
  const [toast, setToast] = useState("");

  useEffect(() => setConfig(getGameStudioConfig(templateId)), [templateId]);

  function selectTemplate(next: GameTemplateId) {
    setTemplateId(next);
    setPublished(false);
    setToast(`${gameTemplates.find((template) => template.id === next)?.title} dipilih. Atur perilakunya di panel konfigurasi.`);
  }

  function update<K extends keyof GameStudioConfig>(key: K, value: GameStudioConfig[K]) {
    setConfig((current) => ({ ...current, [key]: value }));
  }

  async function saveDraft() {
    saveGameStudioConfig(config);
    const courseId = await getTeacherCourseIdBySlug(demoCourse.slug);
    if (!courseId) {
      setToast(`${config.name} disimpan sebagai draft di perangkat. Course belum ada di database.`);
      return;
    }
    const res = await saveGameVersion(courseId, templateId, { name: config.name, instructions: config.instructions, config: { ...config } }, false);
    setToast(res.ok ? `${config.name} disimpan sebagai draft template ${templateId}.` : res.error ?? "Gagal menyimpan draft.");
  }

  async function publishGame() {
    saveGameStudioConfig(config);
    const courseId = await getTeacherCourseIdBySlug(demoCourse.slug);
    if (!courseId) {
      setToast("Course belum ada di database. Login sebagai guru pemilik course.");
      return;
    }
    const res = await saveGameVersion(courseId, templateId, { name: config.name, instructions: config.instructions, config: { ...config } }, true);
    if (!res.ok) {
      setToast(res.error ?? "Gagal memublikasikan game.");
      return;
    }
    setPublished(true);
    setToast(`${config.name} dipublikasikan ke Game Library dan siap ditambahkan ke pertemuan.`);
  }

  const selectedTemplate = gameTemplates.find((template) => template.id === templateId)!;
  return <AppShell><div className="studio-header"><div><Link href="/teacher" className="back-link"><ArrowLeft size={14} /> Kembali ke dashboard</Link><div className="eyebrow" style={{ marginTop: 14 }}>STUDIO KREASI GURU</div><h1>Mini-Game Studio</h1><p>Pilih template yang sesuai aktivitas Operasi Hitung Bilangan Bulat, ubah parameternya, lalu playtest sebelum ditambahkan ke pertemuan.</p></div><div className="studio-header__actions"><StatusPill tone={published ? "teal" : "yellow"}>{published ? "Published ke library" : "Draft template"}</StatusPill><button className="button button--ghost button--small" onClick={saveDraft}><Save size={15} /> Simpan draft</button><button className="button button--primary button--small" onClick={publishGame}><WandSparkles size={15} /> Publish ke library</button></div></div>
    <div className="studio-layout"><div><div className="studio-panel"><div className="studio-panel__head"><div><strong>Template game pembelajaran</strong><small>Template di bawah mengikuti rancangan: garis bilangan, kartu muatan, dan challenge operasi.</small></div><Gamepad2 size={19} color="var(--violet)" /></div><div className="template-grid">{gameTemplates.map((template) => <button key={template.id} className={`template-button template-button--${template.tone} ${template.id === templateId ? "is-selected" : ""}`} onClick={() => selectTemplate(template.id)}><span>{template.id === "number-line" ? "↔" : template.id === "charge-cards" ? "±" : "✦"}</span><strong>{template.title}</strong><small>{template.description}</small></button>)}</div></div>
      <div className="studio-panel"><div className="studio-panel__head"><div><strong>Konfigurasi {selectedTemplate.title}</strong><small>Perubahan langsung memengaruhi preview di sebelah kanan.</small></div><StatusPill tone="violet">{published ? "v1.0" : "Draft"}</StatusPill></div><div className="form-grid"><div className="field field--full"><label>Nama game di library</label><input value={config.name} onChange={(event) => update("name", event.target.value)} /></div><div className="field field--full"><label>Petunjuk untuk siswa</label><textarea value={config.instructions} onChange={(event) => update("instructions", event.target.value)} /></div>{templateId === "number-line-challenge" && <><div className="field"><label>Operasi</label><select value={config.operation} onChange={(event) => update("operation", event.target.value as GameStudioConfig["operation"])}><option>Campuran</option><option>Penjumlahan</option><option>Pengurangan</option></select></div><div className="field"><label>Jumlah level</label><select value={config.levels} onChange={(event) => update("levels", Number(event.target.value))}><option value={2}>2 level</option><option value={3}>3 level</option><option value={5}>5 level</option></select></div></>}{templateId === "number-line" && <><div className="field"><label>Titik awal</label><input type="number" value={config.start} onChange={(event) => update("start", Number(event.target.value))} /></div><div className="field"><label>Arah gerak</label><select value={config.direction} onChange={(event) => update("direction", event.target.value as GameStudioConfig["direction"])}><option value="kanan">Kanan / tambah</option><option value="kiri">Kiri / kurang</option></select></div><div className="field"><label>Jumlah langkah</label><input type="number" min={1} value={config.move} onChange={(event) => update("move", Number(event.target.value))} /></div></>}{templateId === "charge-cards" && <><div className="field"><label>Kartu positif awal</label><input type="number" min={0} value={config.positive} onChange={(event) => update("positive", Number(event.target.value))} /></div><div className="field"><label>Kartu negatif awal</label><input type="number" min={0} value={config.negative} onChange={(event) => update("negative", Number(event.target.value))} /></div></>}</div><div className="range-fields"><RangeControl label="Jumlah ronde / soal" value={config.questionCount} min={1} max={20} suffix={`${config.questionCount} ronde`} onChange={(value) => update("questionCount", value)} /><RangeControl label="Timer" value={config.timer} min={5} max={120} step={5} suffix={`${config.timer}s`} onChange={(value) => update("timer", value)} /></div><div className="range-fields"><RangeControl label="Poin" value={config.points} min={0} max={100} step={5} suffix={`${config.points} poin`} onChange={(value) => update("points", value)} /><RangeControl label="Ambang lulus" value={config.passThreshold} min={0} max={100} step={5} suffix={`${config.passThreshold}%`} onChange={(value) => update("passThreshold", value)} /></div><div className="settings-row"><div className="settings-row__copy"><strong>Masuk ke gradebook</strong><small>Playtest guru tetap tidak dihitung sebagai nilai siswa.</small></div><button className={`toggle ${config.graded ? "is-on" : ""}`} onClick={() => update("graded", !config.graded)} aria-label="Aktifkan penilaian"><span /></button></div><div className="studio-note"><Info size={15} /> Setiap template menyimpan konfigurasi sendiri. Saat dipilih kembali, nilai yang terakhir disimpan akan dimuat.</div></div>
      <div className="studio-panel"><div className="studio-panel__head"><div><strong>Library & penggunaan</strong><small>Tambahkan versi aktif ke pertemuan pembelajaran.</small></div><Sparkles size={18} color="var(--yellow)" /></div><div className="settings-row"><div className="settings-row__copy"><strong>{config.name}</strong><small>{published ? "Versi aktif di library" : "Belum dipublish"} · {config.graded ? "dinilai" : "latihan saja"}</small></div><button className="button button--ghost button--small" onClick={() => setToast(`${config.name} ditambahkan ke pertemuan Operasi Hitung Bilangan Bulat.`)}>Tambahkan <ArrowRight size={14} /></button></div></div></div>
      <div className="studio-preview"><div className="studio-preview__top"><div className="preview-dots"><span /><span /><span /></div><small>LIVE PREVIEW · PLAYTEST ONLY</small><span style={{ color: "#9a92d7" }}>•••</span></div><div className="studio-preview__body"><span className="studio-game-badge"><Gamepad2 size={13} /> {config.name}</span><h2>{selectedTemplate.title}</h2><p>{config.instructions}</p>{templateId === "number-line" && <NumberLinePreview config={config} update={update} />}{templateId === "charge-cards" && <ChargeCardsPreview config={config} update={update} />}{templateId === "number-line-challenge" && <ChallengePreview config={config} />}<div className="preview-score"><div><small>POIN PER JAWABAN</small><strong>{config.points} poin</strong></div><div><small>GRADEBOOK</small><strong className={config.graded ? "score-good" : "score-muted"}>{config.graded ? "Aktif" : "Nonaktif"}</strong></div><Trophy size={21} /></div></div></div></div>{toast && <Toast message={toast} onClose={() => setToast("")} />}</AppShell>;
}

function NumberLinePreview({ config, update }: { config: GameStudioConfig; update: <K extends keyof GameStudioConfig>(key: K, value: GameStudioConfig[K]) => void }) {
  const answer = config.direction === "kanan" ? config.start + config.move : config.start - config.move;
  return <div className="challenge-card studio-template-preview"><div className="challenge-card__meta"><span>Garis bilangan · {config.questionCount} ronde</span><span>⏱ {config.timer}s</span></div><div className="number-line-controls"><label>Mulai<input type="number" value={config.start} onChange={(event) => update("start", Number(event.target.value))} /></label><label>Arah<select value={config.direction} onChange={(event) => update("direction", event.target.value as GameStudioConfig["direction"])}><option value="kanan">kanan</option><option value="kiri">kiri</option></select></label><label>Langkah<input type="number" min={1} value={config.move} onChange={(event) => update("move", Number(event.target.value))} /></label></div><div className="challenge-question">{config.start} {config.direction === "kanan" ? "+" : "−"} {config.move} = <strong>{answer}</strong></div><div className="challenge-line"><span>-10</span><span>0</span><span>10</span></div><div className="preview-result is-good"><Check size={15} /> Pion bergerak ke {config.direction}; hasil {answer}. Feedback dan poin siap diuji.</div></div>;
}

function ChargeCardsPreview({ config, update }: { config: GameStudioConfig; update: <K extends keyof GameStudioConfig>(key: K, value: GameStudioConfig[K]) => void }) {
  const result = config.positive - config.negative;
  return <div className="challenge-card studio-template-preview"><div className="challenge-card__meta"><span>Kartu muatan · {Math.min(config.positive, config.negative)} pasangan nol</span><span>⏱ {config.timer}s</span></div><div className="charge-board"><div><span className="charge-card charge-card--positive">+1</span><strong>{config.positive} kartu positif</strong><div><button className="button button--ghost button--small" onClick={() => update("positive", config.positive + 1)}>Tambah +</button><button className="button button--ghost button--small" onClick={() => update("positive", Math.max(0, config.positive - 1))}>Kurangi</button></div></div><div className="charge-vs">−</div><div><span className="charge-card charge-card--negative">−1</span><strong>{config.negative} kartu negatif</strong><div><button className="button button--ghost button--small" onClick={() => update("negative", config.negative + 1)}>Tambah −</button><button className="button button--ghost button--small" onClick={() => update("negative", Math.max(0, config.negative - 1))}>Kurangi</button></div></div></div><div className="game-result"><span>Hasil kartu tersisa</span><strong>{result}</strong><small>{Math.min(config.positive, config.negative)} pasangan nol terbentuk</small></div></div>;
}

function ChallengePreview({ config }: { config: GameStudioConfig }) {
  const [seed, setSeed] = useState(1); const [answer, setAnswer] = useState(""); const [correct, setCorrect] = useState(0); const [result, setResult] = useState<"good" | "bad" | null>(null); const challenge = useMemo(() => makeChallenge(config, seed), [config, seed]); const grade = getGameGrade(correct, Math.max(1, seed - 1), config);
  function check() { setResult(Number(answer) === challenge.answer ? "good" : "bad"); if (Number(answer) === challenge.answer) setCorrect((value) => value + 1); }
  return <div className="challenge-card studio-template-preview"><div className="challenge-card__meta"><span>Level {Math.min(config.levels, Math.ceil(seed / 2))} · Soal {Math.min(config.questionCount, seed)}</span><span>⏱ {config.timer}s</span></div><div className="challenge-question">{challenge.left} {challenge.operation} {challenge.right} = ?</div><div className="challenge-line"><span>{config.min}</span><span>0</span><span>{config.max}</span></div><div className="answer-row"><input type="number" placeholder="Tulis jawaban" value={answer} onChange={(event) => setAnswer(event.target.value)} onKeyDown={(event) => event.key === "Enter" && check()} /><button onClick={check}><Check size={15} /> Cek</button></div>{result === "good" && <div className="preview-result is-good">Benar. +{config.points} poin.</div>}{result === "bad" && <div className="preview-result is-bad">Belum tepat. Coba baca arah gerak lagi.</div>}<div className="studio-actions"><button className="button button--outline-light" onClick={() => { setSeed(1); setCorrect(0); setAnswer(""); setResult(null); }}><RotateCcw size={15} /> Reset</button><button className="button button--primary" onClick={() => { setSeed((value) => value + 1); setAnswer(""); setResult(null); }}><Play size={15} /> Soal berikutnya</button></div><div className="preview-mini-score">{correct} benar · {grade.score}% · {grade.passed ? "Lulus" : "Belum lulus"}</div></div>;
}

function RangeControl({ label, value, min, max, step = 1, suffix, onChange }: { label: string; value: number; min: number; max: number; step?: number; suffix: string; onChange: (value: number) => void }) {
  return <div className="range-control"><label className="studio-label">{label}</label><div className="range-line"><input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} /><span className="range-value">{suffix}</span></div></div>;
}
