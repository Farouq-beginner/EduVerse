import "dotenv/config";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  const rows = await prisma.progress.findMany({ include: { student: { select: { fullName: true } }, block: { select: { title: true, type: true } } } });
  for (const r of rows) console.log("PROGRESS:", r.student.fullName, "|", r.block.title, `(${r.block.type})`, "| completed:", r.completed, "| at", r.completedAt?.toISOString());
  console.log("total progress rows:", rows.length);
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
