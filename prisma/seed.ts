import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Seed pembelajaran demo "Operasi Hitung Bilangan Bulat" agar dashboard guru &
 * alur siswa langsung punya data nyata di database.
 *
 * Jalankan:  npx prisma db seed   (butuh DATABASE_URL valid & migration sudah diterapkan)
 *
 * CATATAN: Seed ini hanya membuat course jika sudah ada akun guru yang terdaftar
 * lewat Auth Supabase. Tidak akan membuat profil guru palsu tanpa akun Auth.
 * Untuk membuat akun guru, daftarkan lewat halaman /auth atau jalankan seed-test-accounts.ts.
 */
async function main() {
  // Cari guru yang sudah ada di database (harus punya akun Auth yang valid).
  // Seed TIDAK membuat profil guru palsu tanpa akun Auth.
  const teacher = await prisma.profile.findFirst({
    where: { role: "TEACHER", isActive: true },
  });

  if (!teacher) {
    console.log("⚠️  Tidak ada akun guru yang ditemukan di database.");
    console.log("   Daftarkan akun guru lewat /auth atau jalankan: npx tsx prisma/seed-test-accounts.ts");
    console.log("   Seed course dilewati.");
    return;
  }

  console.log("Menggunakan guru:", teacher.fullName, "(id:", teacher.id + ")");

  const course = await prisma.course.upsert({
    where: { slug: "operasi-bilangan-bulat" },
    update: {},
    create: {
      slug: "operasi-bilangan-bulat",
      joinToken: "a8f3-operasi-bilangan",
      title: "Operasi Hitung Bilangan Bulat — Kelas VII",
      shortTitle: "Operasi Bilangan Bulat",
      description:
        "Eksplorasi bilangan positif, negatif, dan nol lewat suhu, garis bilangan, dan cerita untung-rugi.",
      subject: "Matematika",
      grade: "Kelas VII",
      duration: "1 JP asinkron + 2 JP sinkron",
      state: "PUBLISHED",
      access: "OPEN",
      ownerId: teacher.id,
    },
  });

  // Modul + blok
  const modulesData = [
    {
      title: "Mengamati & Menanya",
      eyebrow: "Modul 01 · 10 menit",
      accent: "violet",
      blocks: [
        { type: "VIDEO", title: "Mengapa freezer bisa di bawah nol?", description: "Video pemantik: suhu berpendingin dan arah gerak pada garis bilangan.", duration: "04:20" },
        { type: "TEXT", title: "E-Modul: mengenal tanda bilangan", description: "Ringkasan visual positif, negatif, nol, dan posisi garis bilangan.", duration: "06 menit" },
      ],
    },
    {
      title: "Eksplorasi Awal",
      eyebrow: "Modul 02 · 15 menit",
      accent: "teal",
      blocks: [
        { type: "GAME", title: "Aktivitas Garis Bilangan", description: "Geser pion dari -10 hingga 10 dan amati perubahan posisi.", duration: "05 menit" },
        { type: "GAME", title: "Kartu Muatan Positif & Negatif", description: "Pasangkan kartu muatan untuk intuisi penjumlahan.", duration: "05 menit" },
      ],
    },
    {
      title: "Investigasi Kelompok",
      eyebrow: "Modul 03 · 20 menit",
      accent: "yellow",
      blocks: [
        { type: "ASSIGNMENT", title: "E-LKPD: kasus freezer toko es krim", description: "Pecahkan masalah suhu dan untung-rugi dengan strategi kelompokmu.", duration: "10 menit" },
      ],
    },
    {
      title: "Presentasi & Evaluasi",
      eyebrow: "Modul 04 · 25 menit",
      accent: "coral",
      blocks: [
        { type: "QUIZ", title: "Kuis Formatif · 10 soal", description: "Cek strategi penyelesaianmu.", duration: "15 menit" },
        { type: "REFLECTION", title: "Refleksi strategi", description: "Tulis cara yang paling membantumu.", duration: "05 menit" },
      ],
    },
  ];

  let order = 0;
  let quizBlockId: string | null = null;

  for (const m of modulesData) {
    const module = await prisma.module.upsert({
      where: { id: `${course.id}-${m.accent}` },
      update: {},
      create: {
        id: `${course.id}-${m.accent}`,
        courseId: course.id,
        title: m.title,
        eyebrow: m.eyebrow,
        accent: m.accent,
        order: order++,
      },
    });

    let bOrder = 0;
    for (const b of m.blocks) {
      const block = await prisma.lessonBlock.upsert({
        where: { id: `${module.id}-b${bOrder}` },
        update: {},
        create: {
          id: `${module.id}-b${bOrder}`,
          moduleId: module.id,
          type: b.type as never,
          title: b.title,
          description: b.description,
          duration: b.duration,
          order: bOrder,
        },
      });
      if (b.type === "QUIZ") quizBlockId = block.id;
      bOrder++;
    }
  }

  // Kuis dengan soal (kunci jawaban disimpan server).
  if (quizBlockId) {
    const existingQuiz = await prisma.quiz.findUnique({ where: { blockId: quizBlockId } });
    if (!existingQuiz) {
      const quiz = await prisma.quiz.create({
        data: {
          blockId: quizBlockId,
          title: "Kuis Formatif · Operasi Bilangan Bulat",
          instructions: "Pilih jawaban paling tepat.",
          totalPoints: 100,
          maxAttempts: 2,
          passThreshold: 70,
          showScore: true,
        },
      });
      const questions = [
        { prompt: "Seekor penguin di suhu -2°C lalu naik 5°C. Berapa suhu sekarang?", options: ["-7°C", "3°C", "7°C", "-3°C"], answer: "3°C", explanation: "Dari -2 bergerak 5 ke kanan: 3." },
        { prompt: "Hasil dari 6 - (-4) adalah …", options: ["2", "-2", "10", "-10"], answer: "10", explanation: "6 + 4 = 10." },
        { prompt: "Manakah bilangan paling kecil?", options: ["-8", "-3", "0", "5"], answer: "-8", explanation: "Semakin ke kiri semakin kecil." },
        { prompt: "Hasil dari -7 + 9 adalah …", options: ["-16", "-2", "2", "16"], answer: "2", explanation: "Dari -7 ke kanan 9 langkah: 2." },
        { prompt: "Suhu freezer -6°C turun 3°C. Suhu sekarang …", options: ["-3°C", "-9°C", "3°C", "9°C"], answer: "-9°C", explanation: "Turun 3 ke kiri: -9." },
      ];
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        await prisma.question.create({
          data: {
            quizId: quiz.id,
            type: "MULTIPLE_CHOICE",
            prompt: q.prompt,
            options: q.options,
            answer: q.answer,
            explanation: q.explanation,
            points: 20,
            order: i,
          },
        });
      }
      console.log("Kuis seed dibuat dengan", questions.length, "soal.");
    }
  }

  console.log("Seed selesai. Link join:", `/learn/${course.slug}`);
  console.log("Join token:", course.joinToken);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
