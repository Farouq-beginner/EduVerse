import type { Metadata } from "next";
import { AdminShell } from "@/components/AdminShell";

export const metadata: Metadata = {
  title: "Admin console · EduVerse",
  description: "Konsol platform untuk mengelola akun, branding, dan kesehatan sistem.",
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
