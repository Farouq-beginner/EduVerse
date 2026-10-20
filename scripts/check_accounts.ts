import { prisma } from "../lib/prisma";

async function main() {
  const p: any = await prisma.$queryRawUnsafe('SELECT id, "fullName", role, "isLocked", "isActive" FROM "Profile"');
  console.log("PROFILES:", JSON.stringify(p, null, 2));
}

main().catch(console.error).finally(() => process.exit(0));
