"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Check, ClipboardCheck, Eye, GripVertical, Loader2, Plus, Save, Trash2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { StatusPill } from "@/components/DashboardBits";
import { Toast } from "@/components/Toast";
import { demoCourse, type QuizDraft, type QuizQuestion, type QuizQuestionType } from "@/lib/demo-data";
import { getQuizDraft, saveQuizDraft } from "@/lib/storage";
import { getQuizForTeacher, getTeacherCourseIdBySlug, saveQuizStructure } from "@/lib/actions/dashboards";

const questionTypeLabels: Record<QuizQuestionType, string> = {
  "multiple-choice": "Pilihan ganda",
  "true-false": "Benar / salah",
  "short-answer": "Jawaban singkat",
  number: "Angka",
  essay: "Uraian",
};

const dbTypeToLocal: Record<string, QuizQuestionType> = {
  MULTIPLE_CHOICE: "multiple-choice",
  TRUE_FALSE: "true-false",
  SHORT_ANSWER: "short-answer",
  NUMBER: "number",
  ESSAY: "essay",
  MATCHING: "multiple-choice",
  ORDERING: "multiple-choice",
  FILL_BLANK: "short-answer",
  DRAG_DROP: "multiple-choice",
};

function newQuestion(id: number): QuizQuestion {
  return { id, type: "multiple-choice", prompt: "Tulis pertanyaan baru...", options: ["Pilihan A", "Pilihan B", "Pilihan C", "Pilihan D"], answer: "Pilihan A", explanation: "Jelaskan langkah atau alasan jawaban yang benar.", points: 10 };
}

export default function QuizBuilderPage() {
  const params = useParams<{ blockId: string }>();
  const router = useRouter();
  const [draft, setDraft] = useState<QuizDraft>(() => getQuizDraft(params.blockId));
  const [toast, setToast] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fromDb, setFromDb] = useState(false);

  // Muat kuis dari database (blok milik guru). Kunci jawaban hanya untuk guru.
  useEffect(() => {
    let active = true;
    (async () => {
      const quiz = await getQuizForTeacher(params.blockId);
      if (!active) return;
      if (quiz) {
        setDraft({
          blockId: params.blockId,
          title: quiz.title,
          instructions: quiz.instructions,
          showScore: quiz.showScore,
          totalPoints: quiz.totalPoints,
          attempts: quiz.maxAttempts,
          shuffle: quiz.shuffle,
          passThreshold: quiz.passThreshold,
          questions: quiz.questions.map((question, index) => ({
            id: index + 1,
            type: dbTypeToLocal[question.type] ?? "multiple-choice",
            prompt: question.prompt,
            options: question.options,
            answer: question.answer,
            explanation: question.explanation,
            points: question.points,
          })),
        });
        setFromDb(true);
      } else {
        setDraft(getQuizDraft(params.blockId));
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [params.blockId]);

  function update<K extends keyof QuizDraft>(key: K, value: QuizDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function updateQuestion(id: number, patch: Partial<QuizQuestion>) {
    setDraft((current) => ({ ...current, questions: current.questions.map((question) => question.id === id ? { ...question, ...patch } : question) }));
  }

  function addQuestion() {
    const nextId = Math.max(0, ...draft.questions.map((question) => question.id)) + 1;
    setDraft((current) => ({ ...current, questions: [...current.questions, newQuestion(nextId)] }));
  }

  function removeQuestion(id: number) {
    setDraft((current) => ({ ...current, questions: current.questions.filter((question) => question.id !== id) }));
  }

  async function save() {
    saveQuizDraft(draft); // cadangan di perangkat
    const courseId = await getTeacherCourseIdBySlug(demoCourse.slug);
    if (!courseId) {
      setToast("Course tidak ditemukan di database. Login sebagai guru pemilik course.");
      return;
    }
    setSaving(true);
    const res = await saveQuizStructure(courseId, params.blockId, {
      title: draft.title,
      instructions: draft.instructions,
      showScore: draft.showScore,
      totalPoints: draft.totalPoints,
      attempts: draft.attempts,
      shuffle: draft.shuffle,
      passThreshold: draft.passThreshold,
      questions: draft.questions.map((question) => ({
        id: question.id,
        type: question.type,
        prompt: question.prompt,
        options: question.options,
        answer: question.answer,
        explanation: question.explanation,
        points: question.points,
      })),
    });
    setSaving(false);
    setToast(res.ok ? "Kuis tersimpan di database. Siswa langsung memakai versi ini." : res.error ?? "Gagal menyimpan kuis.");
  }

  if (loading) {
    return <AppShell><div className="quiz-builder-page"><div className="empty-state"><Loader2 size={24} className="spin" /><strong>Memuat kuis...</strong></div></div></AppShell>;
  }

  return <AppShell><div className="quiz-builder-page">
    <div className="page-topbar"><div><Link href={`/teacher/course/${demoCourse.slug}`} className="back-link"><ArrowLeft size={14} /> Kembali ke course builder</Link><div className="eyebrow" style={{ marginTop: 14 }}>BUILDER KUIS · {draft.questions.length} SOAL</div><h1>{draft.title}</h1><p>Bangun pertanyaan, kunci jawaban, pembahasan, dan aturan penilaian dalam satu halaman.</p></div><div className="page-topbar__actions"><Link href={`/learn/${demoCourse.slug}/modul/module-present?lesson=${params.blockId}`} className="button button--ghost button--small"><Eye size={15} /> Preview siswa</Link><button className="button button--primary button--small" onClick={save} disabled={saving}>{saving ? <Loader2 size={15} className="spin" /> : <Save size={15} />} Simpan kuis</button></div></div>
    <div className="quiz-builder-layout"><main>
      <section className="builder-card"><div className="builder-card__head"><div><strong>Identitas kuis</strong><small>Informasi yang terlihat di halaman siswa.</small></div><StatusPill tone="violet">{fromDb ? "Tersimpan di DB" : "Draft lokal"}</StatusPill></div><div className="form-grid"><div className="field field--full"><label>Judul kuis</label><input value={draft.title} onChange={(event) => update("title", event.target.value)} /></div><div className="field field--full"><label>Instruksi pengerjaan</label><textarea className="material-textarea" value={draft.instructions} onChange={(event) => update("instructions", event.target.value)} /></div></div></section>
      <div className="quiz-question-toolbar"><div><div className="eyebrow">BANK SOAL DALAM KUIS INI</div><h2>{draft.questions.length} soal · {draft.questions.reduce((sum, question) => sum + question.points, 0)} poin</h2></div><button className="button button--primary button--small" onClick={addQuestion}><Plus size={15} /> Tambah soal</button></div>
      <div className="quiz-question-list">{draft.questions.map((question, index) => <QuestionEditor key={question.id} question={question} index={index} onChange={(patch) => updateQuestion(question.id, patch)} onRemove={() => removeQuestion(question.id)} />)}</div>
      <button className="quiz-add-question" onClick={addQuestion}><Plus size={17} /> Tambah soal berikutnya</button>
    </main><aside className="quiz-builder-sidebar">
      <section className="builder-card"><div className="builder-card__head"><div><strong>Aturan penilaian</strong><small>Guru mengatur cara skor dihitung.</small></div><ClipboardCheck size={18} color="var(--violet)" /></div><div className="form-grid"><div className="field"><label>Total skor</label><input type="number" min={0} value={draft.totalPoints} onChange={(event) => update("totalPoints", Number(event.target.value))} /></div><div className="field"><label>Nilai lulus (%)</label><input type="number" min={0} max={100} value={draft.passThreshold} onChange={(event) => update("passThreshold", Number(event.target.value))} /></div><div className="field"><label>Jumlah percobaan</label><select value={draft.attempts} onChange={(event) => update("attempts", Number(event.target.value))}><option value={1}>1 kali</option><option value={2}>2 kali</option><option value={3}>3 kali</option><option value={0}>Tidak dibatasi</option></select></div></div><SettingToggle label="Acak urutan soal" hint="Urutan berbeda untuk setiap siswa." value={draft.shuffle} onChange={(value) => update("shuffle", value)} /><SettingToggle label="Tampilkan skor akhir" hint="Siswa melihat total poin setelah mengirim." value={draft.showScore} onChange={(value) => update("showScore", value)} /></section>
      <section className="builder-card quiz-summary-card"><div className="eyebrow">RINGKASAN PUBLIKASI</div><strong>{draft.questions.length} soal siap dikerjakan</strong><p>Skor maksimum {draft.totalPoints} poin · lulus mulai {draft.passThreshold}% · {draft.showScore ? "nilai ditampilkan" : "nilai disembunyikan"}.</p><div className="quiz-score-bar"><span style={{ width: `${Math.min(100, (draft.questions.reduce((sum, question) => sum + question.points, 0) / Math.max(1, draft.totalPoints)) * 100)}%` }} /></div></section>
    </aside></div>{toast && <Toast message={toast} onClose={() => setToast("")} />}
  </div></AppShell>;
}

function QuestionEditor({ question, index, onChange, onRemove }: { question: QuizQuestion; index: number; onChange: (patch: Partial<QuizQuestion>) => void; onRemove: () => void }) {
  const usesOptions = question.type === "multiple-choice" || question.type === "true-false";
  const options = question.type === "true-false" ? ["Benar", "Salah"] : question.options;
  return <article className="quiz-question-card"><div className="quiz-question-card__head"><span className="quiz-drag"><GripVertical size={16} /> SOAL {String(index + 1).padStart(2, "0")}</span><select value={question.type} onChange={(event) => { const type = event.target.value as QuizQuestionType; onChange({ type, options: type === "true-false" ? ["Benar", "Salah"] : question.options, answer: type === "true-false" ? "Benar" : question.answer }); }}><option value="multiple-choice">Pilihan ganda</option><option value="true-false">Benar / salah</option><option value="short-answer">Jawaban singkat</option><option value="number">Angka</option><option value="essay">Uraian</option></select><button className="icon-button icon-button--tiny" onClick={onRemove} aria-label={`Hapus soal ${index + 1}`}><Trash2 size={14} /></button></div><div className="field field--full"><label>Pertanyaan</label><textarea value={question.prompt} onChange={(event) => onChange({ prompt: event.target.value })} /></div><div className="quiz-question-fields">{usesOptions && <div className="field"><label>Opsi jawaban</label><textarea value={options.join("\n")} onChange={(event) => onChange({ options: event.target.value.split("\n").filter(Boolean) })} /><small className="field-helper">Satu pilihan per baris.</small></div>}<div className="field"><label>Kunci jawaban</label>{usesOptions ? <select value={question.answer} onChange={(event) => onChange({ answer: event.target.value })}>{options.map((option) => <option key={option}>{option}</option>)}</select> : <input value={question.answer} onChange={(event) => onChange({ answer: event.target.value })} placeholder={question.type === "essay" ? "Manual oleh guru" : "Jawaban benar"} />}</div></div><div className="quiz-question-fields"><div className="field"><label>Poin soal</label><input type="number" min={0} value={question.points} onChange={(event) => onChange({ points: Number(event.target.value) })} /></div><div className="field"><label>Pembahasan / feedback</label><input value={question.explanation} onChange={(event) => onChange({ explanation: event.target.value })} /></div></div></article>;
}

function SettingToggle({ label, hint, value, onChange }: { label: string; hint: string; value: boolean; onChange: (value: boolean) => void }) {
  return <div className="settings-row"><div className="settings-row__copy"><strong>{label}</strong><small>{hint}</small></div><button className={`toggle ${value ? "is-on" : ""}`} onClick={() => onChange(!value)} aria-label={label}><span /></button></div>;
}
