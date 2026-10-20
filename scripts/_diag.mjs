import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function extractSlug(raw) {
  try {
    const input = raw.trim();
    if (/^https?:\/\//i.test(input)) {
      const url = new URL(input);
      const parts = url.pathname.split("/").filter(Boolean);
      const idx = parts.indexOf("learn");
      if (idx >= 0 && parts[idx + 1]) return parts[idx + 1];
    }
    if (input.includes("/learn/")) {
      const afterLearn = input.split("/learn/")[1];
      if (afterLearn) return afterLearn.split("/")[0].split("?")[0].split("#")[0];
    }
    if (input.startsWith("learn/")) {
      const parts = input.split("/").filter(Boolean);
      if (parts[1]) return parts[1].split("?")[0].split("#")[0];
    }
  } catch {}
  return null;
}

async function resolveCourse(key) {
  const cleanedKey = key.trim().split("?")[0].split("#")[0].replace(/\/+$/, "");
  const slugFromUrl = extractSlug(cleanedKey);
  const candidateKeys = Array.from(new Set([cleanedKey, slugFromUrl, key.trim()].filter(Boolean)));
  let course = await prisma.course.findFirst({
    where: { OR: candidateKeys.flatMap((k) => [{ joinToken: k }, { slug: k }]) },
  });
  if (course) return { course, how: "exact" };
  if (slugFromUrl) {
    const all = await prisma.course.findMany({ select: { id: true, slug: true, joinToken: true } });
    const match = all.find((c) => slugFromUrl.startsWith(c.slug) || (c.joinToken && slugFromUrl.includes(c.joinToken)));
    if (match) return { course: match, how: "prefix" };
  }
  return { course: null, how: "none" };
}

console.log("=== COURSES ===");
const courses = await prisma.course.findMany();
for (const c of courses) {
  console.log(
    ` id=${c.id}\n slug=${JSON.stringify(c.slug)}\n joinToken=${JSON.stringify(c.joinToken)}\n state=${c.state} access=${c.access} owner=${c.ownerId} title=${JSON.stringify(c.title)}`
  );
}
console.log("count:", courses.length);

console.log("\n=== PROFILES ===");
for (const p of await prisma.profile.findMany()) {
  console.log(` id=${p.id} role=${p.role} active=${p.isActive} class=${p.className} name=${p.fullName}`);
}

console.log("\n=== ENROLLMENTS ===");
const enrollments = await prisma.enrollment.findMany();
for (const e of enrollments) console.log(` ${e.studentId} -> ${e.courseId} status=${e.status}`);
console.log("count:", enrollments.length);

console.log("\n=== AUTH USERS ===");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_ANON_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);
const { data: list, error: listErr } = await supabase.auth.admin.listUsers({ perPage: 100 });
if (listErr) console.log("auth error:", listErr.message);
for (const u of list?.users ?? []) console.log(` ${u.id} ${u.email} confirmed=${u.email_confirmed_at ? "yes" : "no"}`);

console.log("\n=== RESOLVE PROBE ===");
const probes = [
  "operasi-bilangan-bulat",
  "/learn/operasi-bilangan-bulat",
  "https://example.com/learn/operasi-bilangan-bulat",
  "https://example.com/learn/operasi-bilangan-bulat-a8f3",
  "a8f3-operasi-bilangan",
  "a8f3",
];
for (const p of probes) {
  const r = await resolveCourse(p);
  console.log(` ${JSON.stringify(p)} -> ${r.course ? r.course.slug : "NULL"} (${r.how})`);
}

await prisma.$disconnect();
