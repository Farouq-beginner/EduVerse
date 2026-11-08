"use server";

import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

export type MyProfile = {
  id: string;
  fullName: string;
  nickname: string | null;
  username: string | null;
  role: string;
  className: string | null;
  avatarUrl: string | null;
};

async function currentUserId() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user?.id ?? null;
  } catch {
    return null;
  }
}

/** Profil lengkap akun yang sedang login — dipakai halaman pengaturan profil. */
export async function getMyProfile(): Promise<MyProfile | null> {
  try {
    const id = await currentUserId();
    if (!id) return null;
    const profile = await prisma.profile.findUnique({ where: { id } });
    if (!profile) return null;
    return {
      id: profile.id,
      fullName: profile.fullName,
      nickname: profile.nickname ?? null,
      username: profile.username ?? null,
      role: profile.role,
      className: profile.className ?? null,
      avatarUrl: profile.avatarUrl ?? null,
    };
  } catch {
    return null;
  }
}

export type ProfileUpdateInput = {
  fullName: string;
  nickname?: string;
  username?: string;
  className?: string;
};

/**
 * Guru dan siswa menyunting profilnya sendiri. Role tidak pernah diubah dari
 * sini — hanya identitas tampilan yang memang boleh diubah pemilik akun.
 */
export async function updateMyProfile(
  input: ProfileUpdateInput
): Promise<{ ok: boolean; error?: string; profile?: MyProfile }> {
  try {
    const id = await currentUserId();
    if (!id) return { ok: false, error: "Sesi berakhir. Silakan masuk lagi." };

    const fullName = input.fullName.trim();
    if (fullName.length < 2) return { ok: false, error: "Nama lengkap minimal 2 karakter." };

    const nickname = input.nickname?.trim() || null;
    if (nickname && nickname.length > 24)
      return { ok: false, error: "Nama panggilan maksimal 24 karakter." };

    const usernameRaw = input.username?.trim().toLowerCase() ?? "";
    const username = usernameRaw ? usernameRaw.replace(/[^a-z0-9._-]/g, "") : null;
    if (usernameRaw && username !== usernameRaw)
      return { ok: false, error: "Username hanya boleh huruf kecil, angka, titik, garis bawah, dan strip." };
    if (username && (username.length < 3 || username.length > 24))
      return { ok: false, error: "Username 3–24 karakter." };

    if (username) {
      const taken = await prisma.profile.findFirst({
        where: { username, id: { not: id } },
        select: { id: true },
      });
      if (taken) return { ok: false, error: "Username sudah dipakai akun lain." };
    }

    const updated = await prisma.profile.update({
      where: { id },
      data: {
        fullName,
        nickname,
        username,
        ...(input.className !== undefined ? { className: input.className.trim() || null } : {}),
      },
    });

    return {
      ok: true,
      profile: {
        id: updated.id,
        fullName: updated.fullName,
        nickname: updated.nickname ?? null,
        username: updated.username ?? null,
        role: updated.role,
        className: updated.className ?? null,
        avatarUrl: updated.avatarUrl ?? null,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (/unique/i.test(message)) return { ok: false, error: "Username sudah dipakai akun lain." };
    return { ok: false, error: "Gagal menyimpan profil." };
  }
}

/** Pasang foto profil dari berkas yang sudah diunggah pemilik akun. */
export async function setMyAvatar(
  fileId: string
): Promise<{ ok: boolean; error?: string; avatarUrl?: string }> {
  try {
    const id = await currentUserId();
    if (!id) return { ok: false, error: "Sesi berakhir. Silakan masuk lagi." };

    const file = await prisma.storedFile.findFirst({
      where: { id: fileId, ownerId: id },
      select: { id: true },
    });
    if (!file) return { ok: false, error: "Berkas foto tidak ditemukan." };

    const avatarUrl = `/api/files/${file.id}`;
    await prisma.profile.update({ where: { id }, data: { avatarUrl } });
    return { ok: true, avatarUrl };
  } catch {
    return { ok: false, error: "Gagal memasang foto profil." };
  }
}

/** Hapus foto profil (kembali ke inisial nama). */
export async function removeMyAvatar(): Promise<{ ok: boolean; error?: string }> {
  try {
    const id = await currentUserId();
    if (!id) return { ok: false, error: "Sesi berakhir. Silakan masuk lagi." };
    await prisma.profile.update({ where: { id }, data: { avatarUrl: null } });
    return { ok: true };
  } catch {
    return { ok: false, error: "Gagal menghapus foto profil." };
  }
}
