import type { Metadata } from "next";
import { Suspense } from "react";
import "./globals.css";
import { ThemeBoot } from "@/components/ThemeToggle";

export const metadata: Metadata = {
  title: "EduVerse LMS — Make learning feel alive",
  description: "Learning studio interaktif untuk guru dan siswa.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="id"><body><Suspense fallback={<div />}><ThemeBoot />{children}</Suspense></body></html>;
}
