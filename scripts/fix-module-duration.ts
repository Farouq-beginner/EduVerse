import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const modules = await prisma.module.findMany();
  for (const module of modules) {
    const parts = module.eyebrow.split("·");
    if (parts[1] && module.duration === "10 menit") {
      await prisma.module.update({
        where: { id: module.id },
        data: { eyebrow: parts[0].trim(), duration: parts[1].trim() },
      });
    }
  }
  console.log(await prisma.module.findMany({ select: { title: true, eyebrow: true, duration: true } }));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
