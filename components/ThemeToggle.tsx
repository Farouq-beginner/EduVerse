"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { getTheme, saveTheme } from "@/lib/storage";

export function ThemeToggleButton() {
  const [theme, setTheme] = useState("light");
  useEffect(() => {
    const current = getTheme();
    setTheme(current);
    document.documentElement.dataset.theme = current;
  }, []);
  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    saveTheme(next);
    document.documentElement.dataset.theme = next;
  }
  return <button className="icon-button theme-toggle" onClick={toggle} aria-label={theme === "dark" ? "Aktifkan light mode" : "Aktifkan dark mode"} title={theme === "dark" ? "Light mode" : "Dark mode"}>{theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}</button>;
}

export function ThemeBoot() {
  // Dipasang di root layout: memastikan tema tersimpan dipakai di semua halaman,
  // termasuk halaman yang tidak punya tombol tema sendiri (mis. /auth).
  useEffect(() => {
    const apply = () => {
      document.documentElement.dataset.theme = getTheme();
    };
    apply();
    // Ikut berubah saat tema diganti dari tab lain.
    const onStorage = (event: StorageEvent) => {
      if (event.key === "eduverse-theme") apply();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  return null;
}
