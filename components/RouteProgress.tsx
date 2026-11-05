"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";

/**
 * Indikator loading di bagian atas layar setiap kali route/tab berubah,
 * supaya perpindahan halaman tidak terlihat seperti aplikasi yang macet.
 */
export function RouteProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const key = `${pathname}?${searchParams?.toString() ?? ""}`;
  const [visible, setVisible] = useState(false);
  const mounted = useRef(false);

  useEffect(() => {
    // Jangan tampilkan bar pada render pertama halaman.
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    setVisible(true);
    const timer = setTimeout(() => setVisible(false), 900);
    return () => clearTimeout(timer);
  }, [key]);

  if (!visible) return null;

  return (
    <div className="route-progress" role="status" aria-live="polite">
      <span className="route-progress__bar" />
      <span className="route-progress__label">
        <Loader2 size={13} className="spin" /> Memuat…
      </span>
    </div>
  );
}
