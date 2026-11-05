import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Middleware untuk memproteksi rute berdasarkan sesi login & role.
// Role dibaca dari tabel profiles (bukan klaim yang bisa dimanipulasi client).
export async function updateSession(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;

  // Tanpa konfigurasi Supabase, jangan buat seluruh aplikasi error 500.
  // Halaman auth tetap bisa tampil; pemeriksaan sesi dilewati sampai env diisi.
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.next({ request });
  }

  // Nilai placeholder seperti "[SENSITIVE]" (hasil `vercel env pull` untuk secret)
  // juga diperlakukan sebagai env kosong, agar middleware tidak melempar error URL.
  const urlValid = /^https?:\/\//i.test(supabaseUrl.trim());
  const keyValid =
    supabaseKey.trim().length > 20 && !/^\[?SENSITIVE\]?$/i.test(supabaseKey.trim());
  if (!urlValid || !keyValid) {
    return NextResponse.next({ request });
  }

  const path = request.nextUrl.pathname;

  // Idle timeout: akun yang tidak dipakai melewati batas otomatis di-logout,
  // termasuk saat tab lama dibuka lagi setelah berjam-jam.
  const idleMinutesRaw = Number(
    process.env.IDLE_TIMEOUT_MINUTES ?? process.env.NEXT_PUBLIC_IDLE_TIMEOUT_MINUTES ?? 120
  );
  const idleMinutes = Number.isFinite(idleMinutesRaw) && idleMinutesRaw > 0 ? idleMinutesRaw : 120;
  const seenAt = Number(request.cookies.get("eduverse_seen")?.value ?? 0);
  const isSessionRoute =
    path.startsWith("/teacher") || path.startsWith("/admin") || path.startsWith("/student");

  if (isSessionRoute && seenAt > 0 && Date.now() - seenAt > idleMinutes * 60_000) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth";
    url.search = "";
    url.searchParams.set("reason", "idle");
    const response = NextResponse.redirect(url);
    for (const cookie of request.cookies.getAll()) {
      if (cookie.name.startsWith("sb-") || cookie.name.startsWith("supabase")) {
        response.cookies.set(cookie.name, "", { maxAge: 0, path: "/" });
      }
    }
    response.cookies.set("eduverse_seen", "", { maxAge: 0, path: "/" });
    return response;
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    supabaseUrl,
    supabaseKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Jalankan refresh token sebelum halaman lain — TANPA await dua kali.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isProtected =
    path.startsWith("/teacher") || path.startsWith("/admin") || path.startsWith("/student");

  // Sudah login tapi membuka halaman login → arahkan ke dashboard sesuai role.
  // Tanpa ini, tombol "kembali" browser memunculkan form login lagi.
  // Hanya redirect jika profile sudah memiliki role yang valid.
  // Jika role belum terdefinisi, biarkan halaman auth tampil untuk penyelesaian.
  const isAuthPage = path === "/auth";
  if (user && isAuthPage) {
    const { data: profile } = await supabase
      .from("Profile")
      .select("role, isActive")
      .eq("id", user.id)
      .single();
    if (profile?.role) {
      // Role sudah pasti ada, arahkan sesuai role.
      const url = request.nextUrl.clone();
      url.pathname =
        profile.role === "ADMIN" ? "/admin" : profile.role === "TEACHER" ? "/teacher" : "/student";
      url.search = "";
      return NextResponse.redirect(url);
    } else if (!profile?.isActive) {
      // Akun dinonaktifkan → logout dan arahkan ke login.
      await supabase.auth.signOut();
      const url = request.nextUrl.clone();
      url.pathname = "/auth";
      url.searchParams.set("error", "disabled");
      return NextResponse.redirect(url);
    }
    // Jika role belum ada tapi isActive true → biarkan auth page tampil
    // User perlu lengkapi profil atau sudah login dengan akun demo.
  }

  // Belum login & masuk rute terproteksi → redirect ke /auth
  if (isProtected && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  // Sudah login: baca role dari "Profile" (PascalCase) untuk gate rute per-role.
  if (user && isProtected) {
    const { data: profile } = await supabase
      .from("Profile")
      .select("role, isActive")
      .eq("id", user.id)
      .single();

    const role = profile?.role;
    const isActive = profile?.isActive ?? true;

    // Akun dinonaktifkan Admin → paksa logout.
    if (!isActive) {
      await supabase.auth.signOut();
      const url = request.nextUrl.clone();
      url.pathname = "/auth";
      url.searchParams.set("error", "disabled");
      return NextResponse.redirect(url);
    }

    // Profil tidak terbaca / role tak dikenal → jangan render halaman terproteksi.
    // Ini mencegah redirect loop bila query profil gagal (role = undefined).
    if (!role) {
      const url = request.nextUrl.clone();
      url.pathname = "/auth";
      url.search = "";
      url.searchParams.set("next", path);
      url.searchParams.set("error", "noprofile");
      return NextResponse.redirect(url);
    }

    const denied =
      (path.startsWith("/teacher") && role !== "TEACHER") ||
      (path.startsWith("/admin") && role !== "ADMIN") ||
      (path.startsWith("/student") && role !== "STUDENT");

    if (denied) {
      const url = request.nextUrl.clone();
      // role sudah pasti diketahui di sini → arahkan ke dashboard sesuai role.
      url.pathname =
        role === "ADMIN" ? "/admin" : role === "TEACHER" ? "/teacher" : "/student";
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|json)$).*)",
  ],
};
