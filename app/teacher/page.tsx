import { redirect } from "next/navigation";
import { getMyCourses, getSessionProfile, getTeacherStats } from "@/lib/actions/dashboards";
import { TeacherDashboard } from "./TeacherDashboard";

export default async function TeacherDashboardPage() {
  const profile = await getSessionProfile();
  if (!profile || profile.role !== "TEACHER") redirect("/auth?next=/teacher");

  const [courses, stats] = await Promise.all([getMyCourses(), getTeacherStats()]);

  return (
    <TeacherDashboard
      teacherName={profile.fullName}
      initialCourses={courses}
      initialStats={stats}
    />
  );
}
