import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { getSessionProfile } from "@/lib/actions/dashboards";
import { PesertaWorkspace } from "./PesertaWorkspace";

export const metadata = { title: "Peserta pembelajaran · EduVerse" };

/** Halaman kelola peserta: daftar siswa + laporan lengkap jawaban tiap pertemuan. */
export default async function PesertaPage() {
  const profile = await getSessionProfile();
  if (!profile || profile.role !== "TEACHER") redirect("/auth?next=/teacher/peserta");

  return (
    <AppShell>
      <PesertaWorkspace />
    </AppShell>
  );
}
