"use server";

import type { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function requireAdmin() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    const profile = await prisma.profile.findUnique({ where: { id: user.id } });
    if (!profile || profile.role !== "ADMIN" || !profile.isActive) return null;
    return profile;
  } catch {
    return null;
  }
}

/** Semua akun auth (email) dipetakan per id — Profile tidak menyimpan email. */
async function emailMap() {
  const map = new Map<string, string>();
  try {
    const admin = createAdminClient();
    for (let page = 1; page <= 10; page += 1) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
      if (error) break;
      const users = data?.users ?? [];
      users.forEach((user) => {
        if (user.email) map.set(user.id, user.email);
      });
      if (users.length < 200) break;
    }
  } catch {
    // Service role belum disetel: email cukup ditampilkan kosong.
  }
  return map;
}

export type AccountRow = {
  id: string;
  fullName: string;
  nickname: string | null;
  username: string | null;
  email: string;
  role: Role;
  className: string | null;
  isActive: boolean;
  courseCount: number;
  enrollCount: number;
};

/** Daftar akun untuk Admin, bisa disaring per peran (guru/siswa/admin). */
export async function listAccounts(
  role: "ALL" | Role = "ALL"
): Promise<{ ok: boolean; rows?: AccountRow[]; error?: string }> {
  const me = await requireAdmin();
  if (!me) return { ok: false, error: "Hanya Admin yang boleh melihat daftar akun." };

  try {
    const profiles = await prisma.profile.findMany({
      where: role === "ALL" ? {} : { role },
      include: {
        _count: { select: { coursesOwned: true, enrollments: true } },
      },
      orderBy: [{ role: "asc" }, { fullName: "asc" }],
    });
    const emails = await emailMap();

    return {
      ok: true,
      rows: profiles.map((profile) => ({
        id: profile.id,
        fullName: profile.fullName,
        nickname: profile.nickname ?? null,
        username: profile.username ?? null,
        email: emails.get(profile.id) ?? "",
        role: profile.role,
        className: profile.className ?? null,
        isActive: profile.isActive,
        courseCount: profile._count.coursesOwned,
        enrollCount: profile._count.enrollments,
      })),
    };
  } catch {
    return { ok: false, error: "DATABASE_UNAVAILABLE" };
  }
}

export type AccountInput = {
  fullName: string;
  nickname?: string;
  username?: string;
  email: string;
  password?: string;
  role: Role;
  className?: string;
};

function cleanUsername(raw?: string) {
  return (raw ?? "").trim().toLowerCase().replace(/[^a-z0-9._-]/g, "");
}

async function usernameTaken(username: string, exceptId?: string) {
  if (!username) return false;
  const found = await prisma.profile.findFirst({
    where: { username, ...(exceptId ? { id: { not: exceptId } } : {}) },
    select: { id: true },
  });
  return Boolean(found);
}

/** Admin membuat akun baru lengkap dengan email dan password. */
export async function createAccount(
  input: AccountInput
): Promise<{ ok: boolean; error?: string; id?: string }> {
  const me = await requireAdmin();
  if (!me) return { ok: false, error: "Hanya Admin yang boleh menambah akun." };

  const fullName = input.fullName.trim();
  const email = input.email.trim().toLowerCase();
  const password = input.password ?? "";
  const username = cleanUsername(input.username);

  if (fullName.length < 2) return { ok: false, error: "Nama lengkap wajib diisi." };
  if (!email.includes("@")) return { ok: false, error: "Email tidak valid." };
  if (password.length < 8) return { ok: false, error: "Password minimal 8 karakter." };
  if (username && (username.length < 3 || username.length > 24))
    return { ok: false, error: "Username 3–24 karakter." };
  if (await usernameTaken(username)) return { ok: false, error: "Username sudah dipakai." };

  try {
    const admin = createAdminClient();
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { fullName, role: input.role },
    });
    if (error) {
      if (/already|registered|exists/i.test(error.message))
        return { ok: false, error: "Email sudah terdaftar." };
      return { ok: false, error: error.message };
    }
    const id = data.user?.id;
    if (!id) return { ok: false, error: "Gagal membuat akun." };

    await prisma.profile.upsert({
      where: { id },
      update: {
        fullName,
        role: input.role,
        nickname: input.nickname?.trim() || null,
        username: username || null,
        className: input.className?.trim() || null,
        isActive: true,
      },
      create: {
        id,
        fullName,
        role: input.role,
        nickname: input.nickname?.trim() || null,
        username: username || null,
        className: input.className?.trim() || null,
        isActive: true,
      },
    });

    await prisma.auditLog.create({
      data: {
        actorId: me.id,
        action: "account.created",
        target: id,
        meta: { email, role: input.role },
      },
    });

    return { ok: true, id };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (/SERVICE_ROLE|belum dikonfigurasi/i.test(message))
      return { ok: false, error: "SUPABASE_SERVICE_ROLE_KEY belum disetel di server." };
    return { ok: false, error: "Gagal membuat akun." };
  }
}

/** Admin mengubah nama, nickname, username, email, password, atau kelas akun. */
export async function updateAccount(input: {
  id: string;
  fullName?: string;
  nickname?: string | null;
  username?: string | null;
  email?: string;
  password?: string;
  className?: string | null;
  role?: Role;
  isActive?: boolean;
}): Promise<{ ok: boolean; error?: string }> {
  const me = await requireAdmin();
  if (!me) return { ok: false, error: "Hanya Admin yang boleh mengubah akun." };

  try {
    const target = await prisma.profile.findUnique({ where: { id: input.id } });
    if (!target) return { ok: false, error: "Akun tidak ditemukan." };

    const username = input.username === undefined ? undefined : cleanUsername(input.username ?? "");
    if (username) {
      if (username.length < 3 || username.length > 24)
        return { ok: false, error: "Username 3–24 karakter." };
      if (await usernameTaken(username, input.id))
        return { ok: false, error: "Username sudah dipakai akun lain." };
    }

    const nextRole = input.role ?? target.role;
    if (target.role === "ADMIN" && nextRole !== "ADMIN") {
      const admins = await prisma.profile.count({ where: { role: "ADMIN" } });
      if (admins <= 1) return { ok: false, error: "Tidak bisa menurunkan peran Admin terakhir." };
    }

    const email = input.email?.trim().toLowerCase();
    const password = input.password ?? "";
    if (email !== undefined && !email.includes("@"))
      return { ok: false, error: "Email tidak valid." };
    if (password && password.length < 8)
      return { ok: false, error: "Password minimal 8 karakter." };

    if (email !== undefined || password) {
      const admin = createAdminClient();
      const { error } = await admin.auth.admin.updateUserById(input.id, {
        ...(email ? { email, email_confirm: true } : {}),
        ...(password ? { password } : {}),
      });
      if (error) {
        if (/already|registered|exists/i.test(error.message))
          return { ok: false, error: "Email sudah dipakai akun lain." };
        return { ok: false, error: error.message };
      }
    }

    await prisma.profile.update({
      where: { id: input.id },
      data: {
        ...(input.fullName !== undefined ? { fullName: input.fullName.trim() } : {}),
        ...(input.nickname !== undefined ? { nickname: input.nickname?.trim() || null } : {}),
        ...(username !== undefined ? { username: username || null } : {}),
        ...(input.className !== undefined ? { className: input.className?.trim() || null } : {}),
        ...(input.role !== undefined ? { role: input.role } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
    });

    await prisma.auditLog.create({
      data: {
        actorId: me.id,
        action: "account.updated",
        target: input.id,
        meta: {
          ...(email ? { email } : {}),
          ...(password ? { passwordChanged: true } : {}),
          ...(input.role ? { role: input.role } : {}),
        },
      },
    });

    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (/SERVICE_ROLE|belum dikonfigurasi/i.test(message))
      return { ok: false, error: "SUPABASE_SERVICE_ROLE_KEY belum disetel di server." };
    if (/unique/i.test(message)) return { ok: false, error: "Username sudah dipakai akun lain." };
    return { ok: false, error: "Gagal mengubah akun." };
  }
}

/** Admin menghapus akun beserta profilnya. */
export async function deleteAccount(id: string): Promise<{ ok: boolean; error?: string }> {
  const me = await requireAdmin();
  if (!me) return { ok: false, error: "Hanya Admin yang boleh menghapus akun." };
  if (id === me.id) return { ok: false, error: "Tidak bisa menghapus akun sendiri." };

  try {
    const target = await prisma.profile.findUnique({ where: { id } });
    if (!target) return { ok: false, error: "Akun tidak ditemukan." };

    if (target.role === "ADMIN") {
      const admins = await prisma.profile.count({ where: { role: "ADMIN" } });
      if (admins <= 1) return { ok: false, error: "Admin terakhir tidak boleh dihapus." };
    }

    const admin = createAdminClient();
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error && !/not found/i.test(error.message)) return { ok: false, error: error.message };

    await prisma.profile.delete({ where: { id } }).catch(() => undefined);
    await prisma.auditLog.create({
      data: { actorId: me.id, action: "account.deleted", target: id, meta: { role: target.role } },
    });
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (/SERVICE_ROLE|belum dikonfigurasi/i.test(message))
      return { ok: false, error: "SUPABASE_SERVICE_ROLE_KEY belum disetel di server." };
    return { ok: false, error: "Gagal menghapus akun." };
  }
}

/** Email akun Admin yang aktif — ditampilkan di halaman masuk admin. */
export async function getAdminDirectory(): Promise<{ id: string; email: string; fullName: string }[]> {
  try {
    const admins = await prisma.profile.findMany({
      where: { role: "ADMIN" },
      select: { id: true, fullName: true },
      orderBy: { createdAt: "asc" },
    });
    if (admins.length === 0) return [];
    const emails = await emailMap();
    return admins
      .map((admin) => ({ id: admin.id, fullName: admin.fullName, email: emails.get(admin.id) ?? "" }))
      .filter((admin) => admin.email.length > 0);
  } catch {
    return [];
  }
}
