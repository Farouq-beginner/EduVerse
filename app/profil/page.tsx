import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { getSessionProfile } from "@/lib/actions/dashboards";
import { ProfileSettings } from "./ProfileSettings";

export const metadata = { title: "Kelola profil · EduVerse" };

/** Halaman profil untuk guru, siswa, dan admin. */
export default async function ProfilePage() {
  const profile = await getSessionProfile();
  if (!profile) redirect("/auth?next=/profil");

  const shellRole =
    profile.role === "STUDENT" ? "student" : profile.role === "ADMIN" ? "admin" : "teacher";

  return (
    <AppShell role={shellRole}>
      <ProfileSettings />
    </AppShell>
  );
}
