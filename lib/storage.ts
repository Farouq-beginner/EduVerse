import { defaultGameConfig, defaultGameStudioConfigs, demoCourse, type ActivityConfig, type GameConfig, type GameStudioConfig, type GameTemplateId, type LessonBlock, type Module, type Participant, type QuizDraft, type StudentSubmission } from "./demo-data";

const keys = {
  theme: "eduverse-theme",
  participant: "eduverse-participant",
  progress: "eduverse-progress",
  gameConfig: "eduverse-game-config",
  courseState: "eduverse-course-state",
  brand: "eduverse-brand",
  courseBlocks: "eduverse-course-blocks",
  quizDraft: "eduverse-quiz-draft",
  activityDrafts: "eduverse-activity-drafts",
  gameStudioConfigs: "eduverse-game-studio-configs",
  modules: "eduverse-course-modules",
  submissions: "eduverse-student-submissions",
  participants: "eduverse-participants",
  completed: "eduverse-completed",
};

export type ParticipantIdentity = { name: string; className: string; participantId: string };
export type BrandSettings = { appName: string; accent: string };

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const value = window.localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function getTheme() {
  return read<string>(keys.theme, "light");
}

export function saveTheme(theme: string) {
  write(keys.theme, theme);
  document.documentElement.dataset.theme = theme;
}

export function getIdentity() {
  return read<ParticipantIdentity | null>(keys.participant, null);
}

export function saveIdentity(identity: ParticipantIdentity) {
  write(keys.participant, identity);
}

export function getProgress() {
  return read<number>(keys.progress, 0);
}

export function saveProgress(progress: number, activityDelta = 0) {
  const value = Math.min(100, Math.max(0, Math.round(progress)));
  write(keys.progress, value);
  syncParticipantProgress(value, activityDelta);
}

export function getCompleted(): string[] {
  return read<string[]>(keys.completed, []);
}

export function saveCompleted(completed: string[]) {
  write(keys.completed, completed);
}

/** Sinkronkan progres perangkat ini ke daftar peserta yang dibaca workspace guru. */
function syncParticipantProgress(progress: number, activityDelta: number) {
  const identity = getIdentity();
  if (!identity) return;
  const joined = read<Participant[]>(keys.participants, []);
  const index = joined.findIndex((item) => item.id === identity.participantId);
  if (index < 0) return;
  const current = joined[index];
  joined[index] = {
    ...current,
    progress,
    status: progress >= 100 ? "Selesai" : progress > 0 ? "Aktif" : "Baru",
    lastActive: "baru saja",
    activities: current.activities + activityDelta,
  };
  write(keys.participants, joined);
}

export function getGameConfig(): GameConfig {
  return read<GameConfig>(keys.gameConfig, defaultGameConfig);
}

export function saveGameConfig(config: GameConfig) {
  write(keys.gameConfig, config);
}

export function getGameStudioConfig(templateId: GameTemplateId): GameStudioConfig {
  const configs = read<Partial<Record<GameTemplateId, GameStudioConfig>>>(keys.gameStudioConfigs, {});
  return configs[templateId] ?? defaultGameStudioConfigs[templateId];
}

export function saveGameStudioConfig(config: GameStudioConfig) {
  const configs = read<Partial<Record<GameTemplateId, GameStudioConfig>>>(keys.gameStudioConfigs, {});
  write(keys.gameStudioConfigs, { ...configs, [config.templateId]: config });
  if (config.templateId === "number-line-challenge") saveGameConfig(config);
}

export function getCourseState() {
  return read<{ state: "draft" | "published"; access: "open" | "locked" }>(keys.courseState, {
    state: "published",
    access: "open",
  });
}

export function saveCourseState(state: "draft" | "published", access: "open" | "locked") {
  write(keys.courseState, { state, access });
}

export function getBrandSettings(): BrandSettings {
  return read<BrandSettings>(keys.brand, { appName: "EduVerse", accent: "#7C5CFC" });
}

export function saveBrandSettings(settings: BrandSettings) {
  write(keys.brand, settings);
}

export function getCourseBlocks(): LessonBlock[] {
  const seeded = demoCourse.modules.flatMap((module) => module.lessons);
  const blocks = read<LessonBlock[]>(keys.courseBlocks, seeded);
  return blocks.map((block) => {
    if (block.id === "block-number-line") return { ...block, type: "game", material: { ...block.material, game: block.material?.game ?? { gameId: "number-line", instructions: "Mulai dari titik awal, pilih arah, lalu gerakkan pion sesuai jumlah langkah.", points: 15, graded: true, showScore: true, passThreshold: 70 } } };
    if (block.id === "block-cards") return { ...block, type: "game", material: { ...block.material, game: block.material?.game ?? { gameId: "charge-cards", instructions: "Pasangkan kartu +1 dan −1 sebagai pasangan nol, lalu hitung kartu yang tersisa.", points: 15, graded: true, showScore: true, passThreshold: 70 } } };
    return block;
  });
}

export function saveCourseBlocks(blocks: LessonBlock[]) {
  write(keys.courseBlocks, blocks);
}

/**
 * Modul dengan materi yang sudah digabung: materi seed + blok tambahan guru
 * (disimpan terpisah di course-blocks) tampil di semua halaman, bukan hanya
 * di dalam detail modul.
 */
export function getCourseModules(): Module[] {
  const modules = read<Module[]>(keys.modules, demoCourse.modules);
  const blocks = getCourseBlocks();
  return modules.map((module) => ({
    ...module,
    lessons: [
      ...module.lessons
        .map((seed) => blocks.find((item) => item.id === seed.id))
        .filter((block): block is LessonBlock => Boolean(block)),
      ...blocks.filter((block) => block.moduleId === module.id && !module.lessons.some((lesson) => lesson.id === block.id)),
    ],
  }));
}

/** Peserta lokal hanya dipakai sebagai cadangan tampilan; sumber utama tetap database. */
export function getParticipants(): Participant[] {
  return read<Participant[]>(keys.participants, []);
}

/** Daftarkan peserta baru (hasil join lewat link siswa) ke workspace guru. */
export function registerParticipant(identity: ParticipantIdentity): Participant[] {
  const joined = read<Participant[]>(keys.participants, []);
  const existing = joined.find((item) => item.id === identity.participantId);
  const progress = Math.max(existing?.progress ?? 0, getProgress());
  const record: Participant = {
    id: identity.participantId,
    name: identity.name,
    className: identity.className,
    progress,
    score: existing?.score ?? 0,
    status: progress >= 100 ? "Selesai" : progress > 0 ? "Aktif" : "Baru",
    lastActive: existing?.lastActive ?? "baru saja",
    activities: existing?.activities ?? 0,
  };
  write(keys.participants, [...joined.filter((item) => item.id !== identity.participantId), record]);
  return getParticipants();
}

export function saveCourseModules(modules: Module[]) {
  write(keys.modules, modules);
}export function getSubmissions(): StudentSubmission[] {
  return read<StudentSubmission[]>(keys.submissions, []);
}
export function saveSubmission(submission: StudentSubmission) {
  const current = getSubmissions();
  write(keys.submissions, [...current.filter((item) => item.id !== submission.id), submission]);
}

export function getSubmissionById(participantId: string, blockId: string): StudentSubmission | undefined {
  return getSubmissions().find(
    (item) => item.participantId === participantId && item.blockId === blockId
  );
}

/**
 * Draft lokal hanya dikembalikan bila memang pernah disimpan untuk blok ini.
 * Kuis baru selalu mulai kosong — tidak mewarisi soal contoh dari kuis lain.
 */
export function getQuizDraft(blockId = "block-quiz"): QuizDraft {
  const saved = read<QuizDraft | null>(keys.quizDraft, null);
  if (saved && saved.blockId === blockId) return saved;
  return {
    blockId,
    title: "",
    instructions: "",
    showScore: true,
    totalPoints: 0,
    attempts: 1,
    shuffle: false,
    passThreshold: 70,
    questions: [],
  };
}

export function saveQuizDraft(draft: QuizDraft) {
  write(keys.quizDraft, draft);
}

const defaultActivity: ActivityConfig = {
  templateId: "observing-questioning",
  prompt: "Amati kisah suhu bilangan bulat, tulis dua pertanyaan, dan jelaskan arah gerak pada garis bilangan.",
  evidenceLabel: "2 pertanyaan awal atau foto garis bilangan −10 sampai 10",
  responseType: "interactive",
  choices: [{ label: "A", value: "−8", correct: true }, { label: "B", value: "0" }, { label: "C", value: "8" }],
  instructions: "Ikuti langkah aktivitas, tuliskan strategi yang kamu gunakan, lalu kirim jawaban untuk ditinjau guru.",
  points: 10,
  graded: true,
  showScore: true,
  rubric: "Strategi benar (5), proses terlihat (3), refleksi jelas (2).",
};

export function getActivityDraft(blockId: string): ActivityConfig {
  const drafts = read<Record<string, ActivityConfig>>(keys.activityDrafts, {});
  return drafts[blockId] ?? defaultActivity;
}

export function saveActivityDraft(blockId: string, config: ActivityConfig) {
  const drafts = read<Record<string, ActivityConfig>>(keys.activityDrafts, {});
  write(keys.activityDrafts, { ...drafts, [blockId]: config });
}
