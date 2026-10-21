import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Middleware untuk memproteksi rute berdasarkan sesi login & role.
// Role dibaca dari tabel profiles (bukan klaim yang bisa dimanipulasi client).
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY!,
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

  const path = request.nextUrl.pathname;
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
