"use server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";

export type AuthResult = {
  ok: boolean;
  error?: string;
  role?: Role;
};

/**
 * Registrasi Guru atau Siswa.
 * - Membuat akun autentikasi lewat Supabase Auth (email + password).
 * - Membuat baris Profile terkait dengan role yang dipilih (TEACHER / STUDENT).
 * - Role ditetapkan di sini (backend tepercaya), bukan dari body client bebas.
 *
 * Admin TIDAK bisa lewat sini — harus dibuat via bootstrap (`createAdmin`).
 */
export async function registerUser(input: {
  fullName: string;
  email: string;
  password: string;
  className?: string;
  role: "TEACHER" | "STUDENT";
}): Promise<AuthResult> {
  const { fullName, email, password, className, role } = input;

  if (!fullName.trim()) return { ok: false, error: "Nama lengkap wajib diisi." };
  if (!email.includes("@")) return { ok: false, error: "Email tidak valid." };
  if (password.length < 8)
    return { ok: false, error: "Password minimal 8 karakter." };
  // Pendaftaran publik hanya untuk Guru & Siswa.
  if (role !== "TEACHER" && role !== "STUDENT")
    return { ok: false, error: "Role tidak valid." };

  const supabase = await createClient();

  let userId: string | null = null;

  try {
    const admin = createAdminClient();

    // Buat akun dengan email_confirm: true agar user langsung bisa login ulang setelah logout
    const { data: created, error: adminErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { fullName, role },
    });

    if (adminErr) {
      if (/already.*registered|already exists/i.test(adminErr.message)) {
        return { ok: false, error: "Email sudah terdaftar. Silakan login." };
      }
      // Jika admin createUser gagal karena alasan lain, fallback ke signUp biasa
      const { data: suData, error: suErr } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { fullName, role } },
      });
      if (suErr) {
        if (/already registered/i.test(suErr.message)) {
          return { ok: false, error: "Email sudah terdaftar. Silakan login." };
        }
        return { ok: false, error: suErr.message };
      }
      userId = suData.user?.id ?? null;
      if (userId) {
        // Coba konfirmasikan email user via admin
        await admin.auth.admin.updateUserById(userId, { email_confirm: true }).catch(() => {});
      }
    } else {
      userId = created.user?.id ?? null;
    }
  } catch {
    // Fallback bila service role key belum disetel
    const { data: suData, error: suErr } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { fullName, role } },
    });
    if (suErr) {
      if (/already registered/i.test(suErr.message)) {
        return { ok: false, error: "Email sudah terdaftar. Silakan login." };
      }
      return { ok: false, error: suErr.message };
    }
    userId = suData.user?.id ?? null;
  }

  if (!userId) {
    return { ok: false, error: "Gagal membuat akun. Silakan coba beberapa saat lagi." };
  }

  // Buat profil terkait di tabel Profile (backend tepercaya)
  await prisma.profile.upsert({
    where: { id: userId },
    update: { fullName, role, className: className ?? null, isActive: true },
    create: {
      id: userId,
      fullName,
      role,
      className: className ?? null,
      isActive: true,
    },
  });

  // Login-kan user agar cookie sesi tersimpan di browser
  await supabase.auth.signInWithPassword({ email, password }).catch(() => {});

  return { ok: true, role };
}

/**
 * Login untuk ketiga role. Memverifikasi kredensial lewat Supabase Auth,
 * lalu membaca role & status aktif dari tabel profiles.
 */
export async function loginUser(input: {
  email: string;
  password: string;
}): Promise<AuthResult> {
  const { email, password } = input;
  if (!email.includes("@")) return { ok: false, error: "Email tidak valid." };
  if (!password) return { ok: false, error: "Password wajib diisi." };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    if (/invalid login credentials/i.test(error.message))
      return { ok: false, error: "Email atau password salah." };
    // Supabase mengembalikan error ini bila email belum dikonfirmasi.
    if (/email not confirmed/i.test(error.message))
      return {
        ok: false,
        error:
          "Email belum dikonfirmasi. Cek inbox kamu dan klik link verifikasi, lalu coba login lagi.",
      };
    return { ok: false, error: error.message };
  }

  const user = data.user;
  if (!user) return { ok: false, error: "Login gagal. Coba lagi." };

  const profile = await prisma.profile.findUnique({ where: { id: user.id } });
  if (!profile) return { ok: false, error: "Profil tidak ditemukan. Hubungi admin." };
  if (!profile.isActive)
    return { ok: false, error: "Akun dinonaktifkan. Hubungi admin." };

  await prisma.profile.update({
    where: { id: user.id },
    data: { lastActive: new Date() },
  });

  return { ok: true, role: profile.role };
}

/** Logout — menghapus sesi Supabase. */
export async function logoutUser() {
  const supabase = await createClient();
  await supabase.auth.signOut();
}

/**
 * Bootstrap Admin — hanya bisa dipanggil bila BELUM ada admin sama sekali,
 * atau oleh Admin yang sudah login. Mencegah pendaftaran Admin publik.
 */
export async function createAdmin(input: {
  fullName: string;
  email: string;
  password: string;
  bootstrapKey?: string;
}): Promise<AuthResult> {
  const { fullName, email, password, bootstrapKey } = input;
  if (password.length < 10)
    return { ok: false, error: "Password admin minimal 10 karakter." };

  // Saat bootstrap pertama: izinkan bila belum ada ADMIN & kunci cocok.
  // Bila sudah ada ADMIN: hanya ADMIN login yang boleh membuat admin baru.
  const supabase = await createClient();
  const {
    data: { user: caller },
  } = await supabase.auth.getUser();

  const existingAdmins = await prisma.profile.count({ where: { role: "ADMIN" } });

  if (existingAdmins > 0) {
    if (!caller) return { ok: false, error: "Harus login sebagai Admin." };
    const callerProfile = await prisma.profile.findUnique({ where: { id: caller.id } });
    if (callerProfile?.role !== "ADMIN" || !callerProfile.isActive)
      return { ok: false, error: "Hanya Admin yang boleh membuat Admin." };
  } else {
    // Bootstrap pertama memerlukan kunci keamanan agar tidak sembarangan.
    const expected = process.env.ADMIN_BOOTSTRAP_KEY;
    if (!expected || bootstrapKey !== expected)
      return { ok: false, error: "Kunci bootstrap Admin tidak valid." };
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { fullName, role: "ADMIN" },
  });
  if (error) return { ok: false, error: error.message };
  if (!data.user) return { ok: false, error: "Gagal membuat akun Admin." };

  await prisma.profile.upsert({
    where: { id: data.user.id },
    update: { fullName, role: "ADMIN" },
    create: { id: data.user.id, fullName, role: "ADMIN" },
  });

  return { ok: true, role: "ADMIN" };
}
