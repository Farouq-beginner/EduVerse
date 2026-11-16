import type { Metadata } from "next";
import { Suspense } from "react";
import "./globals.css";
import { ThemeBoot } from "@/components/ThemeToggle";

export const metadata: Metadata = {
  title: "EduVerse LMS — Make learning feel alive",
  description: "Learning studio interaktif untuk guru dan siswa.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // suppressHydrationWarning: ekstensi penerjemah (mis. Trancy) dan preferensi
  // tema menambahkan atribut ke <html>/<body> sebelum React hydrate. Itu bukan
  // milik aplikasi, jadi jangan dianggap mismatch yang merusak halaman.
  return (
    <html lang="id" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <Suspense fallback={<div />}>
          <ThemeBoot />
          {children}
        </Suspense>
      </body>
    </html>
  );
}
