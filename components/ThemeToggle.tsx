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
  }
  return <button className="icon-button theme-toggle" onClick={toggle} aria-label={theme === "dark" ? "Aktifkan light mode" : "Aktifkan dark mode"} title={theme === "dark" ? "Light mode" : "Dark mode"}>{theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}</button>;
}

export function ThemeBoot() {
  // Only sets data-theme on client mount to avoid hydration mismatch
  // The ThemeToggleButton useEffect below handles theme persistence
  return null;
}
