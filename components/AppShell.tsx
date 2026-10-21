"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BarChart3, BookOpen, ChevronDown, CircleHelp, Gamepad2, LayoutDashboard, LayoutGrid, LogOut, Moon, Settings2, ShieldCheck, Sun, Users, WandSparkles } from "lucide-react";
import { BrandMark } from "./BrandMark";
import { getBrandSettings, getTheme, saveTheme } from "@/lib/storage";
import { getSessionProfile } from "@/lib/actions/dashboards";
import { logoutUser } from "@/lib/actions/auth";

const teacherLinks = [
  { href: "/teacher", label: "Ringkasan", icon: LayoutDashboard },
  { href: "/teacher/game-studio", label: "Mini-Game Studio", icon: Gamepad2, accent: true },
  { href: "/teacher?tab=participants", label: "Peserta", icon: Users },
  { href: "/teacher?tab=analytics", label: "Analitik", icon: BarChart3 },
];

export function AppShell({ children, role = "teacher" }: { children: React.ReactNode; role?: "teacher" | "admin" | "student" }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [theme, setTheme] = useState("light");
  const [appName, setAppName] = useState("EduVerse");
  const [hash, setHash] = useState("");
  const [account, setAccount] = useState<{ fullName: string; role: string } | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const current = getTheme();
    setTheme(current);
    document.documentElement.dataset.theme = current;
    setAppName(getBrandSettings().appName);
  }, []);

  // Profil taken dari database — nama di sidebar harus milik akun yang login.
  useEffect(() => {
    let active = true;
    getSessionProfile()
      .then((profile) => {
        if (active && profile) setAccount({ fullName: profile.fullName, role: profile.role });
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setProfileLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);

  async function handleLogout() {
    await logoutUser();
    router.push("/auth");
    router.refresh();
  }

  useEffect(() => {
    const updateHash = () => setHash(window.location.hash);
    updateHash();
    window.addEventListener("hashchange", updateHash);
    return () => window.removeEventListener("hashchange", updateHash);
  }, [pathname]);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    saveTheme(next);
  }

  if (role === "student") {
    const onCatalogue = pathname === "/pilih-pembelajaran";
    return (
      <div className="student-surface">
        <div className="student-topbar">
          <div className="student-topbar__left">
            <BrandMark />
            <Link
              href="/pilih-pembelajaran"
              className={`student-topbar__link ${onCatalogue ? "is-active" : ""}`}
              aria-current={onCatalogue ? "page" : undefined}
            >
              <LayoutGrid size={15} /> Pilih Pembelajaran
            </Link>
          </div>
          <div className="student-topbar__right">
            <span className="sync-pill">
              <span className="sync-dot" /> Tersimpan di perangkat
            </span>
            <button className="icon-button" onClick={toggleTheme} aria-label="Ganti tema">
              {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </div>
        {children}
      </div>
    );
  }

  const links = teacherLinks;

  const initials = account?.fullName
    ? account.fullName
        .split(" ")
        .map((part) => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "·";
  const roleLabel =
    account?.role === "ADMIN" ? "Platform Admin" : account?.role === "STUDENT" ? "Siswa" : "Guru";

  return (
    <div className="app-frame">
      <aside className="sidebar">
        <div className="sidebar__brand"><BrandMark /><span className="demo-badge">DEMO</span></div>
        <div className="workspace-switcher"><div className="workspace-avatar">{initials}</div><div><strong>{account ? account.fullName : profileLoaded ? "Akun guru" : "Memuat profil..."}</strong><small>{account ? roleLabel : "Sinkron akun"}</small></div><ChevronDown size={15} /></div>
        <div className="sidebar__label">WORKSPACE</div>
        <nav className="sidebar__nav" aria-label="Navigasi utama">
          {links.map(({ href, label, icon: Icon, accent }) => {
            const [hrefPath, hrefQuery] = href.split("?");
            const [hrefBase, hrefHash] = hrefPath.split("#");
            const active = hrefBase === pathname && (hrefQuery ? searchParams.get("tab") === hrefQuery.replace("tab=", "") : hrefHash ? hash === `#${hrefHash}` : !searchParams.get("tab") && !hash);
            return <Link key={href} href={href} className={`nav-link ${active ? "is-active" : ""} ${accent ? "nav-link--accent" : ""}`}><Icon size={18} /><span>{label}</span>{accent && <span className="nav-spark">✦</span>}</Link>;
          })}
        </nav>
        <div className="sidebar__bottom"><div className="sidebar__label">PREFERENSI</div><button className="nav-link nav-link--button" onClick={toggleTheme}>{theme === "dark" ? <Sun size={18} /> : <Moon size={18} />} <span>{theme === "dark" ? "Light mode" : "Dark mode"}</span></button><button className="nav-link nav-link--button" onClick={handleLogout}><LogOut size={18} /> <span>Keluar</span></button><Link href="/about" className="nav-link"><CircleHelp size={18} /><span>Tentang {appName}</span></Link><div className="sidebar-card"><WandSparkles size={19} /><div><strong>Ruang belajar hidup</strong><small>Bagikan link, lihat progres.</small></div></div></div>
      </aside>
      <main className="main-canvas">{children}</main>
    </div>
  );
}
