import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  const { data, error } = await admin.auth.admin.listUsers();
  if (error) throw error;
  for (const user of data.users) {
    console.log("USER:", user.email, user.id);
  }

  const candidates = [
    ["guru@eduverse.id", "GuruEduVerse123!"],
    ["siswa@eduverse.id", "SiswaEduVerse123!"],
    ["teacher.a@eduverse.dev", "TeacherA!12345"],
    ["student.a@eduverse.dev", "StudentA!12345"],
  ];
  const anon = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  for (const [email, password] of candidates) {
    const { data: signIn, error: signErr } = await anon.auth.signInWithPassword({ email, password });
    console.log("LOGIN", email, signErr ? `FAIL: ${signErr.message}` : `OK as ${signIn.user?.id}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
