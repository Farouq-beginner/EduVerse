import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  const email = "uji.guru@eduverse.dev";
  const password = "UjiGuru!12345";
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { fullName: "Guru Uji Kosong" },
  });
  if (error) throw error;
  await prisma.profile.upsert({
    where: { id: data.user.id },
    update: { fullName: "Guru Uji Kosong", role: "TEACHER", isActive: true },
    create: { id: data.user.id, fullName: "Guru Uji Kosong", role: "TEACHER", isActive: true },
  });
  console.log("created", data.user.id, email, password);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
