import { redirect } from "next/navigation";
import { getMyCourses, getSessionProfile } from "@/lib/actions/dashboards";
import { KelolaPembelajaran } from "./KelolaPembelajaran";

export const metadata = { title: "Kelola pembelajaran · EduVerse" };

/**
 * Pintu masuk Course builder dari sidebar Workspace. Pembuatan dan penghapusan
 * pembelajaran dilakukan di sini, bukan lagi dari popup di halaman Ringkasan.
 */
export default async function KelolaPembelajaranPage() {
  const profile = await getSessionProfile();
  if (!profile || profile.role !== "TEACHER") redirect("/auth?next=/teacher/kelola-pembelajaran");

  const courses = await getMyCourses();

  return <KelolaPembelajaran initialCourses={courses} />;
}
