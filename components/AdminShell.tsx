"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BookOpen,
  CircleHelp,
  ExternalLink,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Palette,
  ScrollText,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import { BrandMark } from "./BrandMark";
import { RouteProgress } from "./RouteProgress";
import { SessionGuard } from "./SessionGuard";
import { invalidateSessionProfile, loadSessionProfile } from "@/lib/session-client";
import { logoutUser } from "@/lib/actions/auth";

const adminLinks = [
  { href: "/admin", hash: "", label: "Ringkasan platform", icon: LayoutDashboard },
  { href: "/admin#account-manager", hash: "#account-manager", label: "Akun & akses", icon: UsersRound },
  { href: "/admin#teacher-accounts", hash: "#teacher-accounts", label: "Akun guru", icon: GraduationCap },
  { href: "/admin#branding-settings", hash: "#branding-settings", label: "Branding", icon: Palette },
  { href: "/admin#audit-log", hash: "#audit-log", label: "Audit log", icon: ScrollText },
];

/** Kerangka khusus konsol Admin — terpisah dari sidebar workspace guru. */
export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [hash, setHash] = useState("");
  const [account, setAccount] = useState<{ fullName: string; role: string } | null>(null);

  useEffect(() => {
    const syncHash = () => setHash(window.location.hash);
    syncHash();
    window.addEventListener("hashchange", syncHash);
    return () => window.removeEventListener("hashchange", syncHash);
  }, [pathname]);

  useEffect(() => {
    let active = true;
    loadSessionProfile()
      .then((profile) => {
        if (active && profile) setAccount({ fullName: profile.fullName, role: profile.role });
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  async function handleLogout() {
    invalidateSessionProfile();
    await logoutUser();
    router.push("/auth");
    router.refresh();
  }

  const name = account?.fullName ?? "Admin EduVerse";
  const initials =
    name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "AD";

  return (
    <div className="admin-shell">
      <RouteProgress />
      <SessionGuard />
      <aside className="admin-sidebar">
        <div className="admin-sidebar__brand">
          <BrandMark />
          <span className="admin-tag">ADMIN</span>
        </div>

        <div className="admin-identity">
          <span className="admin-identity__avatar">{initials}</span>
          <div>
            <strong>{name}</strong>
            <small>Platform owner</small>
          </div>
          <ShieldCheck size={16} />
        </div>

        <div className="admin-sidebar__label">KONSOL PLATFORM</div>
        <nav className="admin-nav" aria-label="Navigasi admin">
          {adminLinks.map(({ href, hash: linkHash, label, icon: Icon }) => {
            const active = pathname === "/admin" && (linkHash ? hash === linkHash : !hash);
            return (
              <Link key={href} href={href} className={`admin-nav__link ${active ? "is-active" : ""}`}>
                <Icon size={17} />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="admin-sidebar__bottom">
          <Link href="/" className="admin-nav__link">
            <ExternalLink size={16} />
            <span>Lihat landing</span>
          </Link>
          <Link href="/about" className="admin-nav__link">
            <BookOpen size={16} />
            <span>Tentang platform</span>
          </Link>
          <Link href="/teacher" className="admin-nav__link">
            <CircleHelp size={16} />
            <span>Workspace guru</span>
          </Link>
          <button className="admin-nav__link admin-nav__link--button" onClick={handleLogout}>
            <LogOut size={16} />
            <span>Keluar</span>
          </button>
        </div>
      </aside>

      <main className="admin-canvas">{children}</main>
    </div>
  );
}
