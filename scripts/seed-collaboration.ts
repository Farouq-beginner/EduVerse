/**
 * Contoh kolaborasi PhET untuk pembelajaran Operasi Hitung Bilangan Bulat.
 *
 * Jalankan: npx tsx scripts/seed-collaboration.ts
 * Idempoten: kolaborasi dengan judul sama diperbarui, bukan diduplikasi.
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const LINKS = [
  {
    label: "Garis bilangan: bilangan bulat",
    url: "https://phet.colorado.edu/en/simulations/number-line-integers",
  },
  {
    label: "Garis bilangan: operasi",
    url: "https://phet.colorado.edu/en/simulations/number-line-operations",
  },
  {
    label: "Garis bilangan: jarak",
    url: "https://phet.colorado.edu/en/simulations/number-line-distance",
  },
];

async function main() {
  const course =
    (await prisma.course.findUnique({ where: { slug: "operasi-bilangan-bulat" } })) ??
    (await prisma.course.findFirst({ orderBy: { createdAt: "asc" } }));

  if (!course) {
    console.log("Tidak ada pembelajaran di database. Buat pembelajaran dulu.");
    return;
  }

  const existing = await prisma.collaboration.findFirst({
    where: { courseId: course.id, title: "Kolaborasi PhET" },
  });

  const collaboration = existing
    ? await prisma.collaboration.update({
        where: { id: existing.id },
        data: {
          description:
            "Tiga simulasi garis bilangan PhET untuk latihan bersama: bilangan bulat, operasi, dan jarak.",
        },
      })
    : await prisma.collaboration.create({
        data: {
          courseId: course.id,
          title: "Kolaborasi PhET",
          description:
            "Tiga simulasi garis bilangan PhET untuk latihan bersama: bilangan bulat, operasi, dan jarak.",
          order: 0,
        },
      });

  await prisma.collaborationLink.deleteMany({ where: { collaborationId: collaboration.id } });
  await prisma.collaborationLink.createMany({
    data: LINKS.map((link, index) => ({
      collaborationId: collaboration.id,
      label: link.label,
      url: link.url,
      provider: "phet",
      order: index,
    })),
  });

  console.log(
    `Kolaborasi PhET siap di "${course.title}" (${LINKS.length} link). Buka /learn/${course.slug}/kolaborasi`
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
