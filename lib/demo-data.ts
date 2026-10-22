export type CourseState = "draft" | "published";
export type AccessState = "open" | "locked";

export type LessonBlock = {
  id: string;
  moduleId?: string;
  type: "text" | "video" | "link" | "activity" | "quiz" | "assignment" | "game" | "reflection";
  title: string;
  description: string;
  duration: string;
  status: "ready" | "new" | "locked";
  material?: {
    text?: string;
    videoUrl?: string;
    driveUrl?: string;
    /// Berkas materi guru (PDF/PPT/DOCX) — disimpan di database dan dibuka lewat /api/files/[id].
    pdfUrl?: string;
    pdfFileId?: string;
    /// Blok bertipe Link: URL bebas + judul + deskripsi.
    linkUrl?: string;
    linkTitle?: string;
    linkDescription?: string;
    fileName?: string;
    fileMime?: string;
    /// Aktivitas: hanya visual interaktif pilihan guru (mini game yang tersedia).
    activity?: ActivityVisualConfig;
    game?: GameBlockConfig;
    /// Lembar kerja, jawaban & lampiran yang sama untuk semua tipe materi.
    worksheet?: WorksheetConfig;
  };
};

export type ActivityVisualConfig = {
  visualId: GameTemplateId;
};

export type WorksheetConfig = {
  /// Guru bisa mematikan lembar kerja untuk materi tertentu.
  enabled: boolean;
  /// Instruksi / isi lembar kerja yang dibaca siswa.
  prompt: string;
  answerLabel: string;
  attachmentLabel: string;
};

export const blankWorksheet: WorksheetConfig = {
  enabled: true,
  prompt: "Kerjakan lembar kerja ini bersama kelompokmu, lalu simpan hasilnya.",
  answerLabel: "Jawaban / kesimpulan",
  attachmentLabel: "Lampiran jawaban (foto, PDF, PPT, atau DOCX)",
};

export type StudentSubmission = {
  id: string;
  participantId: string;
  participantName: string;
  className: string;
  blockId: string;
  blockTitle: string;
  moduleId?: string;
  response: string;
  score: number | null;
  maxScore: number;
  submittedAt: string;
  status: "submitted" | "reviewed";
};

export type GameBlockConfig = {
  gameId: "number-line" | "charge-cards" | "number-line-challenge" | "number-line-lab";
  instructions: string;
  points: number;
  graded: boolean;
  showScore: boolean;
  passThreshold: number;
};

export type QuizQuestionType = "multiple-choice" | "true-false" | "short-answer" | "number" | "essay";
export type QuizQuestion = {
  id: number;
  type: QuizQuestionType;
  prompt: string;
  options: string[];
  answer: string;
  explanation: string;
  points: number;
};
export type QuizDraft = {
  blockId: string;
  title: string;
  instructions: string;
  showScore: boolean;
  totalPoints: number;
  attempts: number;
  shuffle: boolean;
  passThreshold: number;
  questions: QuizQuestion[];
};

export type Module = {
  id: string;
  title: string;
  eyebrow: string;
  duration?: string;
  accent: "violet" | "teal" | "yellow" | "coral";
  lessons: LessonBlock[];
};

export type Participant = {
  id: string;
  name: string;
  className: string;
  progress: number;
  score: number;
  status: "Aktif" | "Selesai" | "Baru";
  lastActive: string;
  activities: number;
};

export type Course = {
  slug: string;
  title: string;
  shortTitle: string;
  description: string;
  subject: string;
  grade: string;
  state: CourseState;
  access: AccessState;
  students: number;
  averageProgress: number;
  averageScore: number;
  duration: string;
  updatedAt: string;
  modules: Module[];
};

export type GameConfig = {
  min: number;
  max: number;
  operation: "Penjumlahan" | "Pengurangan" | "Campuran";
  questionCount: number;
  levels: number;
  points: number;
  timer: number;
  passThreshold: number;
  graded: boolean;
};

export type GameTemplateId = "number-line" | "charge-cards" | "number-line-challenge" | "number-line-lab";
export type GameStudioConfig = GameConfig & {
  templateId: GameTemplateId;
  name: string;
  instructions: string;
  start: number;
  move: number;
  direction: "kanan" | "kiri";
  positive: number;
  negative: number;
};

export const defaultGameConfig: GameConfig = {
  min: -10,
  max: 10,
  operation: "Campuran",
  questionCount: 5,
  levels: 3,
  points: 20,
  timer: 60,
  passThreshold: 70,
  graded: true,
};

export const gameTemplates: Array<{ id: GameTemplateId; title: string; description: string; tone: "violet" | "teal" | "yellow" }> = [
  { id: "number-line-lab", title: "Laboratorium Garis Bilangan Interaktif", description: "Visual interaktif garis bilangan: atur titik awal, langkah gerak, operasi +/- dan amati perpindahan titik.", tone: "teal" },
  { id: "number-line", title: "Aktivitas Garis Bilangan", description: "Gerakkan pion dari suhu awal dan lihat operasi sebagai langkah konkret.", tone: "violet" },
  { id: "charge-cards", title: "Kartu Muatan Positif & Negatif", description: "Pasangkan kartu +1 dan −1 untuk membentuk nol dan membaca hasil.", tone: "teal" },
  { id: "number-line-challenge", title: "Number Line Challenge", description: "Jawab operasi bilangan bulat, naik level, dan kumpulkan poin.", tone: "yellow" },
];

export const defaultGameStudioConfigs: Record<GameTemplateId, GameStudioConfig> = {
  "number-line-lab": { ...defaultGameConfig, templateId: "number-line-lab", name: "Laboratorium Garis Bilangan Interaktif", instructions: "Gunakan kontrol untuk menggeser angka awal dan langkah operasi.", start: -2, move: 5, direction: "kanan", positive: 2, negative: 5 },
  "number-line": { ...defaultGameConfig, templateId: "number-line", name: "Aktivitas Garis Bilangan", instructions: "Mulai dari titik awal, tentukan arah, lalu gerakkan pion sesuai jumlah langkah.", start: -2, move: 5, direction: "kanan", positive: 2, negative: 5 },
  "charge-cards": { ...defaultGameConfig, templateId: "charge-cards", name: "Kartu Muatan Positif & Negatif", instructions: "Pasangkan kartu positif dan negatif sebagai pasangan nol. Hitung kartu yang tersisa.", start: 0, move: 0, direction: "kanan", positive: 2, negative: 5 },
  "number-line-challenge": { ...defaultGameConfig, templateId: "number-line-challenge", name: "Number Line Challenge", instructions: "Baca operasi, tentukan hasilnya, lalu tuliskan angka yang benar.", start: 0, move: 0, direction: "kanan", positive: 2, negative: 5 },
};


export const demoCourse: Course = {
  slug: "operasi-bilangan-bulat",
  title: "Operasi Hitung Bilangan Bulat — Kelas VII",
  shortTitle: "Operasi Bilangan Bulat",
  description:
    "Eksplorasi bilangan positif, negatif, dan nol lewat suhu, garis bilangan, dan cerita untung-rugi.",
  subject: "Matematika",
  grade: "Kelas VII",
  state: "published",
  access: "open",
  students: 28,
  averageProgress: 68,
  averageScore: 84,
  duration: "1 JP asinkron + 2 JP sinkron",
  updatedAt: "Diperbarui 12 menit lalu",
  modules: [
    {
      id: "module-observe",
      title: "Mengamati & Menanya",
      eyebrow: "Modul 01 · 10 menit",
      accent: "violet",
      lessons: [
        {
          id: "block-video",
          type: "video",
          title: "Mengapa freezer bisa di bawah nol?",
          description: "Video pemantik: suhu ruang berpendingin dan arah gerak pada garis bilangan.",
          duration: "04:20",
          status: "ready",
          material: { videoUrl: "" },
        },
        {
          id: "block-text",
          type: "text",
          title: "E-Modul: mengenal tanda bilangan",
          description: "Ringkasan visual tentang positif, negatif, nol, dan posisi pada garis bilangan.",
          duration: "06 menit",
          status: "ready",
          material: { text: "Bilangan bulat terdiri dari bilangan positif, bilangan negatif, dan nol. Pada garis bilangan, bilangan yang lebih besar berada di sebelah kanan. Saat menjumlahkan bilangan positif, bergerak ke kanan; saat menjumlahkan bilangan negatif, bergerak ke kiri. Pengurangan dapat dipahami sebagai penjumlahan dengan lawan bilangan." },
        },
      ],
    },
    {
      id: "module-explore",
      title: "Eksplorasi Awal",
      eyebrow: "Modul 02 · 15 menit",
      accent: "teal",
      lessons: [
        {
          id: "block-number-line",
          type: "game",
          title: "Aktivitas Garis Bilangan",
          description: "Geser pion dari -10 hingga 10 dan amati perubahan posisi saat operasi berlangsung.",
          duration: "05 menit",
          status: "new",
          material: { game: { gameId: "number-line", instructions: "Mulai dari titik awal, pilih arah, lalu gerakkan pion sesuai jumlah langkah.", points: 15, graded: true, showScore: true, passThreshold: 70 } },
        },
        {
          id: "block-cards",
          type: "game",
          title: "Kartu Muatan Positif & Negatif",
          description: "Pasangkan kartu muatan untuk membangun intuisi penjumlahan bilangan bulat.",
          duration: "05 menit",
          status: "new",
          material: { game: { gameId: "charge-cards", instructions: "Pasangkan kartu +1 dan −1 sebagai pasangan nol, lalu hitung kartu yang tersisa.", points: 15, graded: true, showScore: true, passThreshold: 70 } },
        },
      ],
    },
    {
      id: "module-investigate",
      title: "Investigasi Kelompok",
      eyebrow: "Modul 03 · 20 menit",
      accent: "yellow",
      lessons: [
        {
          id: "block-lkpd",
          type: "assignment",
          title: "E-LKPD: kasus freezer toko es krim",
          description: "Pecahkan masalah suhu dan untung-rugi dengan strategi kelompokmu.",
          duration: "10 menit",
          status: "new",
          material: { text: "Kasus: freezer bersuhu −5°C. Saat listrik padam suhu naik 3°C. Setelah genset menyala suhu turun 6°C. Tunjukkan minimal satu strategi dan jelaskan mengapa hasilnya negatif. Kunci guru: −5 + 3 − 6 = −8°C." },
        },
        {
          id: "block-game",
          type: "game",
          title: "Number Line Challenge",
          description: "Naik level dengan menjawab operasi bilangan bulat secara cepat dan tepat.",
          duration: "05 menit",
          status: "new",
        },
      ],
    },
    {
      id: "module-present",
      title: "Presentasi & Evaluasi",
      eyebrow: "Modul 04 · 25 menit",
      accent: "coral",
      lessons: [
        {
          id: "block-quiz",
          type: "quiz",
          title: "Kuis Formatif · 10 soal",
          description: "Cek strategi penyelesaianmu. Setiap jawaban dilengkapi pembahasan singkat.",
          duration: "15 menit",
          status: "new",
        },
        {
          id: "block-reflection",
          type: "reflection",
          title: "Refleksi strategi",
          description: "Tulis cara yang paling membantumu menentukan arah gerak pada garis bilangan.",
          duration: "05 menit",
          status: "new",
        },
      ],
    },
  ],
};

export const seedParticipants: Participant[] = [
  { id: "p-01", name: "Alya Pramesti", className: "VII-B", progress: 94, score: 96, status: "Selesai", lastActive: "2 mnt lalu", activities: 12 },
  { id: "p-02", name: "Raka Wijaya", className: "VII-B", progress: 78, score: 88, status: "Aktif", lastActive: "8 mnt lalu", activities: 9 },
  { id: "p-03", name: "Nadira Putri", className: "VII-A", progress: 61, score: 82, status: "Aktif", lastActive: "14 mnt lalu", activities: 7 },
  { id: "p-04", name: "Bima Akbar", className: "VII-B", progress: 43, score: 74, status: "Aktif", lastActive: "26 mnt lalu", activities: 5 },
  { id: "p-05", name: "Salsa Ramadhani", className: "VII-A", progress: 18, score: 0, status: "Baru", lastActive: "42 mnt lalu", activities: 2 },
];

export const quizQuestions = [
  { id: 1, question: "Seekor penguin berada di suhu -2°C lalu suhu naik 5°C. Berapa suhu sekarang?", options: ["-7°C", "3°C", "7°C", "-3°C"], answer: "3°C", explanation: "Mulai dari -2, bergerak 5 langkah ke kanan: -1, 0, 1, 2, 3." },
  { id: 2, question: "Hasil dari 6 - (-4) adalah …", options: ["2", "-2", "10", "-10"], answer: "10", explanation: "Mengurangi bilangan negatif sama dengan menambah lawannya: 6 + 4 = 10." },
  { id: 3, question: "Manakah bilangan yang paling kecil?", options: ["-8", "-3", "0", "5"], answer: "-8", explanation: "Pada garis bilangan, semakin ke kiri berarti nilainya semakin kecil." },
  { id: 4, question: "Warung mendapat untung Rp15.000 lalu rugi Rp7.000. Perubahan bersihnya …", options: ["rugi Rp22.000", "untung Rp8.000", "untung Rp22.000", "rugi Rp8.000"], answer: "untung Rp8.000", explanation: "+15.000 + (-7.000) = +8.000, jadi masih untung." },
  { id: 5, question: "Hasil dari -7 + 9 adalah …", options: ["-16", "-2", "2", "16"], answer: "2", explanation: "Dari -7 bergerak 9 langkah ke kanan dan berhenti di 2." },
  { id: 6, question: "Suhu freezer -6°C turun lagi 3°C. Suhu sekarang adalah …", options: ["-3°C", "-9°C", "3°C", "9°C"], answer: "-9°C", explanation: "Turun 3°C berarti bergerak 3 langkah ke kiri: -6 menjadi -9." },
  { id: 7, question: "Pernyataan yang benar tentang nol adalah …", options: ["nol selalu positif", "nol selalu negatif", "nol bukan positif maupun negatif", "nol lebih kecil dari semua bilangan"], answer: "nol bukan positif maupun negatif", explanation: "Nol berada di tengah garis bilangan dan bukan bilangan positif atau negatif." },
  { id: 8, question: "Hasil dari -12 - (-5) adalah …", options: ["-17", "-7", "7", "17"], answer: "-7", explanation: "-12 - (-5) = -12 + 5 = -7." },
  { id: 9, question: "Jika saldo awal -Rp20.000 lalu mendapat pemasukan Rp35.000, saldo akhirnya …", options: ["-Rp55.000", "-Rp15.000", "Rp15.000", "Rp55.000"], answer: "Rp15.000", explanation: "-20.000 + 35.000 = 15.000, jadi saldo menjadi positif." },
  { id: 10, question: "Operasi manakah yang setara dengan 4 - (-6)?", options: ["4 - 6", "4 + 6", "-4 + 6", "-4 - 6"], answer: "4 + 6", explanation: "Mengurangi bilangan negatif sama dengan menjumlahkan lawannya." },
];

export const defaultQuizDraft: QuizDraft = {
  blockId: "block-quiz",
  title: "Kuis Formatif · Operasi Bilangan Bulat",
  instructions: "Pilih jawaban paling tepat. Baca pembahasan setelah setiap soal dan gunakan kesempatan berikutnya untuk memperbaiki strategi.",
  showScore: true,
  totalPoints: 100,
  attempts: 2,
  shuffle: false,
  passThreshold: 70,
  questions: quizQuestions.map((item) => ({ id: item.id, type: "multiple-choice" as const, prompt: item.question, options: item.options, answer: item.answer, explanation: item.explanation, points: 10 })),
};

export const activityFeed = [
  { icon: "spark", title: "Alya menyelesaikan Kuis Formatif", meta: "2 menit lalu", color: "teal" },
  { icon: "person", title: "Raka bergabung lewat link kelas", meta: "8 menit lalu", color: "violet" },
  { icon: "game", title: "Number Line Challenge dimainkan 6 kali", meta: "14 menit lalu", color: "yellow" },
  { icon: "message", title: "Nadira menambahkan refleksi", meta: "22 menit lalu", color: "coral" },
];
