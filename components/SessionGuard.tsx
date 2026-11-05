"use client";

import { useEffect } from "react";

/**
 * Penjaga sesi:
 * 1. Logout otomatis setelah pengguna tidak aktif dalam waktu tertentu
 *    (default 120 menit, bisa diatur lewat NEXT_PUBLIC_IDLE_TIMEOUT_MINUTES).
 * 2. Memeriksa kesehatan database secara berkala; bila database bermasalah,
 *    sesi langsung diakhiri agar pengguna tidak terjebak di halaman kosong.
 */

const ACTIVITY_KEY = "eduverse:last-active";
const DEFAULT_IDLE_MINUTES = 120;
const TOUCH_THROTTLE_MS = 15_000;
const HEALTH_INTERVAL_MS = 90_000;

function idleLimitMs(): number {
  const raw = Number(process.env.NEXT_PUBLIC_IDLE_TIMEOUT_MINUTES ?? DEFAULT_IDLE_MINUTES);
  const minutes = Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_IDLE_MINUTES;
  return minutes * 60_000;
}

export function SessionGuard() {
  useEffect(() => {
    let finished = false;
    let lastTouchWrite = 0;

    async function endSession(reason: "idle" | "database") {
      if (finished) return;
      finished = true;
      try {
        await fetch("/api/session/logout", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ reason }),
          keepalive: true,
        });
      } catch {
        // Jaringan bermasalah: tetap arahkan ke halaman login.
      }
      try {
        window.localStorage.removeItem(ACTIVITY_KEY);
      } catch {
        // localStorage tidak tersedia — abaikan.
      }
      // Hapus penanda aktivitas agar middleware tidak mengira sesi masih hidup.
      document.cookie = "eduverse_seen=; path=/; max-age=0; SameSite=Lax";
      window.location.replace(`/auth?reason=${reason}`);
    }

    function readLastActive(): number {
      try {
        return Number(window.localStorage.getItem(ACTIVITY_KEY)) || 0;
      } catch {
        return 0;
      }
    }

    function touch() {
      const now = Date.now();
      if (now - lastTouchWrite < TOUCH_THROTTLE_MS) return;
      lastTouchWrite = now;
      try {
        window.localStorage.setItem(ACTIVITY_KEY, String(now));
      } catch {
        // Abaikan bila penyimpanan diblokir.
      }
      // Cookie ini dibaca middleware, sehingga idle timeout tetap berlaku
      // walau halaman ditutup lalu dibuka lagi berjam-jam kemudian.
      document.cookie = `eduverse_seen=${now}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax`;
    }

    function checkIdle(): boolean {
      const last = readLastActive();
      if (last > 0 && Date.now() - last > idleLimitMs()) {
        void endSession("idle");
        return true;
      }
      return false;
    }

    // Sesi pertama: catat aktivitas, atau langsung akhiri bila sudah lama kosong.
    if (readLastActive() === 0) touch();
    else if (checkIdle()) return;

    const activityEvents: Array<keyof WindowEventMap> = ["pointerdown", "keydown", "wheel", "touchstart", "scroll"];
    for (const name of activityEvents) {
      window.addEventListener(name, touch, { passive: true });
    }

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        touch();
        checkIdle();
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    const idleTimer = window.setInterval(() => {
      if (document.visibilityState === "visible" && !checkIdle()) touch();
    }, 60_000);

    // Pemeriksaan database: butuh dua kegagalan berurutan agar gangguan sesaat
    // tidak langsung mengeluarkan pengguna.
    let dbFailures = 0;
    const healthTimer = window.setInterval(async () => {
      if (finished || document.visibilityState !== "visible") return;
      if (checkIdle()) return;
      try {
        const response = await fetch("/api/session/health", { cache: "no-store" });
        const data = (await response.json()) as { loggedOut?: boolean };
        if (data?.loggedOut) {
          dbFailures += 1;
          if (dbFailures >= 2) void endSession("database");
        } else {
          dbFailures = 0;
        }
      } catch {
        // Server tidak terjangkau: biarkan pengguna mencoba lagi, jangan logout.
      }
    }, HEALTH_INTERVAL_MS);

    return () => {
      for (const name of activityEvents) window.removeEventListener(name, touch);
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(idleTimer);
      window.clearInterval(healthTimer);
    };
  }, []);

  return null;
}
