"use server";

import { prisma } from "@/lib/prisma";
import { getSessionProfile } from "@/lib/actions/dashboards";

export type GroupMemberRow = { id: string; name: string; className: string; joinedAt: string };
export type GroupMessageRow = {
  id: string;
  authorId: string;
  authorName: string;
  body: string;
  createdAt: string;
};
export type GroupTaskRow = {
  id: string;
  title: string;
  body: string;
  fileUrl: string | null;
  fileName: string | null;
  createdById: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
};
export type GroupRoomSummary = {
  id: string;
  name: string;
  instructions: string;
  maxMembers: number;
  memberCount: number;
  taskCount: number;
  messageCount: number;
  joined: boolean;
  full: boolean;
  graded: boolean;
  deadline: string | null;
};
export type GroupRoomDetail = {
  id: string;
  name: string;
  instructions: string;
  maxMembers: number;
  deadline: string | null;
  grade: number | null;
  feedback: string | null;
  gradedAt: string | null;
  locked: boolean;
  isTeacher: boolean;
  courseSlug: string;
  courseTitle: string;
  members: GroupMemberRow[];
  messages: GroupMessageRow[];
  tasks: GroupTaskRow[];
};

function isLocked(room: { grade: number | null; deadline: Date | null }) {
  if (room.grade !== null) return true;
  return Boolean(room.deadline && room.deadline.getTime() < Date.now());
}

function normalizeUrl(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  const withScheme = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  try {
    const url = new URL(withScheme);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

async function teacherProfile() {
  const me = await getSessionProfile();
  if (!me || me.role !== "TEACHER" || !me.isActive) return null;
  return me;
}

async function studentProfile() {
  const me = await getSessionProfile();
  if (!me || me.role !== "STUDENT" || !me.isActive) return null;
  return me;
}

async function enrolledCourse(studentId: string, slug: string) {
  const course = await prisma.course.findUnique({
    where: { slug },
    select: { id: true, title: true, slug: true },
  });
  if (!course) return null;
  const enrollment = await prisma.enrollment.findUnique({
    where: { studentId_courseId: { studentId, courseId: course.id } },
    select: { status: true },
  });
  if (!enrollment || enrollment.status !== "ACTIVE") return null;
  return course;
}

async function membership(roomId: string, studentId: string) {
  return prisma.groupRoomMember.findUnique({
    where: { roomId_studentId: { roomId, studentId } },
    select: { id: true },
  });
}

/* ── Sisi siswa ────────────────────────────────────────────────────────── */

/** Daftar kelompok pada pembelajaran yang diikuti siswa. */
export async function getStudentGroupRooms(slug: string): Promise<{
  courseTitle: string;
  rooms: GroupRoomSummary[];
}> {
  try {
    const me = await studentProfile();
    if (!me) return { courseTitle: "", rooms: [] };
    const course = await enrolledCourse(me.id, slug);
    if (!course) return { courseTitle: "", rooms: [] };

    const rooms = await prisma.groupRoom.findMany({
      where: { courseId: course.id },
      orderBy: { createdAt: "asc" },
      include: {
        members: { select: { studentId: true } },
        _count: { select: { tasks: true, messages: true } },
      },
    });

    return {
      courseTitle: course.title,
      rooms: rooms.map((room) => {
        const joined = room.members.some((member) => member.studentId === me.id);
        const memberCount = room.members.length;
        return {
          id: room.id,
          name: room.name,
          instructions: room.instructions,
          maxMembers: room.maxMembers,
          memberCount,
          taskCount: room._count.tasks,
          messageCount: room._count.messages,
          joined,
          full: memberCount >= room.maxMembers,
          graded: room.grade !== null,
          deadline: room.deadline?.toISOString() ?? null,
        };
      }),
    };
  } catch {
    return { courseTitle: "", rooms: [] };
  }
}

/** Gabung room langsung dari daftar kelompok. Kapasitas dicek di server. */
export async function joinGroupRoom(
  roomId: string
): Promise<{ ok: boolean; error?: string; roomId?: string }> {
  try {
    const me = await studentProfile();
    if (!me) return { ok: false, error: "Masuk sebagai siswa untuk bergabung ke kelompok." };

    const room = await prisma.groupRoom.findUnique({
      where: { id: roomId },
      include: {
        course: { select: { id: true, slug: true } },
        members: { select: { studentId: true } },
      },
    });
    if (!room) return { ok: false, error: "Kelompok tidak ditemukan." };

    const course = await enrolledCourse(me.id, room.course.slug);
    if (!course) return { ok: false, error: "Kamu belum tergabung di pembelajaran ini." };

    if (room.members.some((member) => member.studentId === me.id))
      return { ok: true, roomId: room.id };

    if (room.members.length >= room.maxMembers)
      return {
        ok: false,
        error: `Kelompok ini sudah penuh (${room.members.length}/${room.maxMembers}). Pilih kelompok lain.`,
      };

    // Satu siswa hanya masuk satu kelompok per pembelajaran.
    await prisma.$transaction([
      prisma.groupRoomMember.deleteMany({
        where: { studentId: me.id, room: { courseId: room.course.id } },
      }),
      prisma.groupRoomMember.create({ data: { roomId: room.id, studentId: me.id } }),
    ]);

    return { ok: true, roomId: room.id };
  } catch {
    return { ok: false, error: "Gagal bergabung ke kelompok. Coba lagi." };
  }
}

/** Isi room untuk anggota: chat, tugas, anggota, dan status penilaian. */
export async function getStudentRoom(roomId: string): Promise<GroupRoomDetail | null> {
  try {
    const me = await studentProfile();
    if (!me) return null;
    const room = await prisma.groupRoom.findUnique({
      where: { id: roomId },
      include: {
        course: { select: { slug: true, title: true } },
        members: {
          orderBy: { joinedAt: "asc" },
          include: { student: { select: { fullName: true, className: true } } },
        },
        messages: { orderBy: { createdAt: "asc" }, take: 200 },
        tasks: { orderBy: { createdAt: "asc" } },
      },
    });
    if (!room) return null;
    if (!room.members.some((member) => member.studentId === me.id)) return null;

    return {
      id: room.id,
      name: room.name,
      instructions: room.instructions,
      maxMembers: room.maxMembers,
      deadline: room.deadline?.toISOString() ?? null,
      grade: room.grade,
      feedback: room.feedback,
      gradedAt: room.gradedAt?.toISOString() ?? null,
      locked: isLocked(room),
      isTeacher: false,
      courseSlug: room.course.slug,
      courseTitle: room.course.title,
      members: room.members.map((member) => ({
        id: member.studentId,
        name: member.student.fullName,
        className: member.student.className ?? "—",
        joinedAt: member.joinedAt.toISOString(),
      })),
      messages: room.messages.map((message) => ({
        id: message.id,
        authorId: message.authorId,
        authorName: message.authorName,
        body: message.body,
        createdAt: message.createdAt.toISOString(),
      })),
      tasks: room.tasks.map((task) => ({
        id: task.id,
        title: task.title,
        body: task.body,
        fileUrl: task.fileUrl,
        fileName: task.fileName,
        createdById: task.createdById,
        createdByName: task.createdByName,
        createdAt: task.createdAt.toISOString(),
        updatedAt: task.updatedAt.toISOString(),
      })),
    };
  } catch {
    return null;
  }
}

export async function sendRoomMessage(input: {
  roomId: string;
  body: string;
}): Promise<{ ok: boolean; error?: string; message?: GroupMessageRow }> {
  try {
    const me = await studentProfile();
    if (!me) return { ok: false, error: "Hanya anggota kelompok yang bisa mengirim pesan." };
    if (!(await membership(input.roomId, me.id)))
      return { ok: false, error: "Kamu bukan anggota kelompok ini." };

    const body = input.body.trim();
    if (!body) return { ok: false, error: "Tulis pesan terlebih dahulu." };
    if (body.length > 1000) return { ok: false, error: "Pesan maksimal 1000 karakter." };

    const room = await prisma.groupRoom.findUnique({
      where: { id: input.roomId },
      select: { deadline: true, grade: true },
    });
    if (!room) return { ok: false, error: "Kelompok tidak ditemukan." };
    if (isLocked(room))
      return {
        ok: false,
        error: "Tugas kelompok sudah dinilai atau deadline lewat. Chat dikunci.",
      };

    const saved = await prisma.groupMessage.create({
      data: { roomId: input.roomId, authorId: me.id, authorName: me.fullName, body },
    });

    return {
      ok: true,
      message: {
        id: saved.id,
        authorId: saved.authorId,
        authorName: saved.authorName,
        body: saved.body,
        createdAt: saved.createdAt.toISOString(),
      },
    };
  } catch {
    return { ok: false, error: "Gagal mengirim pesan." };
  }
}

/** Tambah atau edit tugas kelompok. Semua anggota berhak selama belum dinilai. */
export async function saveGroupTask(input: {
  roomId: string;
  id?: string;
  title: string;
  body?: string;
  fileUrl?: string;
  fileName?: string;
}): Promise<{ ok: boolean; error?: string; task?: GroupTaskRow }> {
  try {
    const me = await studentProfile();
    if (!me) return { ok: false, error: "Hanya anggota kelompok yang bisa mengelola tugas." };
    if (!(await membership(input.roomId, me.id)))
      return { ok: false, error: "Kamu bukan anggota kelompok ini." };

    const room = await prisma.groupRoom.findUnique({
      where: { id: input.roomId },
      select: { deadline: true, grade: true },
    });
    if (!room) return { ok: false, error: "Kelompok tidak ditemukan." };
    if (isLocked(room))
      return {
        ok: false,
        error: "Tugas sudah dinilai atau deadline lewat, jawaban tidak bisa diubah lagi.",
      };

    const title = input.title.trim();
    if (!title) return { ok: false, error: "Judul tugas wajib diisi." };

    const fileUrl = input.fileUrl?.trim() ? normalizeUrl(input.fileUrl) : null;
    if (input.fileUrl?.trim() && !fileUrl)
      return { ok: false, error: "Link lampiran tidak valid (harus http/https)." };

    const data = {
      title,
      body: input.body?.trim() ?? "",
      fileUrl,
      fileName: fileUrl ? input.fileName?.trim() || "Lampiran" : null,
    };

    if (input.id) {
      const existing = await prisma.groupTask.findFirst({
        where: { id: input.id, roomId: input.roomId },
        select: { id: true },
      });
      if (!existing) return { ok: false, error: "Tugas tidak ditemukan di kelompok ini." };
      const updated = await prisma.groupTask.update({
        where: { id: existing.id },
        data,
      });
      return {
        ok: true,
        task: {
          id: updated.id,
          title: updated.title,
          body: updated.body,
          fileUrl: updated.fileUrl,
          fileName: updated.fileName,
          createdById: updated.createdById,
          createdByName: updated.createdByName,
          createdAt: updated.createdAt.toISOString(),
          updatedAt: updated.updatedAt.toISOString(),
        },
      };
    }

    const created = await prisma.groupTask.create({
      data: {
        roomId: input.roomId,
        createdById: me.id,
        createdByName: me.fullName,
        ...data,
      },
    });
    return {
      ok: true,
      task: {
        id: created.id,
        title: created.title,
        body: created.body,
        fileUrl: created.fileUrl,
        fileName: created.fileName,
        createdById: created.createdById,
        createdByName: created.createdByName,
        createdAt: created.createdAt.toISOString(),
        updatedAt: created.updatedAt.toISOString(),
      },
    };
  } catch {
    return { ok: false, error: "Gagal menyimpan tugas kelompok." };
  }
}

export async function deleteGroupTask(
  id: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const me = await studentProfile();
    if (!me) return { ok: false, error: "Hanya anggota kelompok yang bisa menghapus tugas." };
    const task = await prisma.groupTask.findUnique({
      where: { id },
      select: { id: true, roomId: true, room: { select: { deadline: true, grade: true } } },
    });
    if (!task) return { ok: false, error: "Tugas tidak ditemukan." };
    if (!(await membership(task.roomId, me.id)))
      return { ok: false, error: "Kamu bukan anggota kelompok ini." };
    if (isLocked(task.room)) return { ok: false, error: "Tugas sudah dikunci karena sudah dinilai." };

    await prisma.groupTask.delete({ where: { id: task.id } });
    return { ok: true };
  } catch {
    return { ok: false, error: "Gagal menghapus tugas." };
  }
}

/* ── Sisi guru ─────────────────────────────────────────────────────────── */

export async function getTeacherGroupRooms(courseId: string): Promise<{
  courseTitle: string;
  rooms: GroupRoomSummary[];
}> {
  try {
    const me = await teacherProfile();
    if (!me) return { courseTitle: "", rooms: [] };
    const course = await prisma.course.findFirst({
      where: { id: courseId, ownerId: me.id },
      select: { id: true, title: true },
    });
    if (!course) return { courseTitle: "", rooms: [] };

    const rooms = await prisma.groupRoom.findMany({
      where: { courseId: course.id },
      orderBy: { createdAt: "asc" },
      include: {
        members: { select: { studentId: true } },
        _count: { select: { tasks: true, messages: true } },
      },
    });

    return {
      courseTitle: course.title,
      rooms: rooms.map((room) => ({
        id: room.id,
        name: room.name,
        instructions: room.instructions,
        maxMembers: room.maxMembers,
        memberCount: room.members.length,
        taskCount: room._count.tasks,
        messageCount: room._count.messages,
        joined: false,
        full: room.members.length >= room.maxMembers,
        graded: room.grade !== null,
        deadline: room.deadline?.toISOString() ?? null,
      })),
    };
  } catch {
    return { courseTitle: "", rooms: [] };
  }
}

export async function createGroupRoom(input: {
  courseId: string;
  name: string;
  instructions?: string;
  maxMembers?: number;
  deadline?: string | null;
}): Promise<{ ok: boolean; error?: string; roomId?: string }> {
  try {
    const me = await teacherProfile();
    if (!me) return { ok: false, error: "Hanya guru yang boleh membuat kelompok." };
    const course = await prisma.course.findFirst({
      where: { id: input.courseId, ownerId: me.id },
      select: { id: true, slug: true },
    });
    if (!course) return { ok: false, error: "Pembelajaran tidak ditemukan atau bukan milikmu." };

    const name = input.name.trim();
    if (!name) return { ok: false, error: "Nama kelompok wajib diisi." };

    const maxMembers = Math.min(5, Math.max(1, Math.round(input.maxMembers ?? 5)));

    const deadline = input.deadline ? new Date(input.deadline) : null;
    if (deadline && Number.isNaN(deadline.getTime()))
      return { ok: false, error: "Format deadline tidak valid." };

    const created = await prisma.groupRoom.create({
      data: {
        courseId: course.id,
        name,
        instructions: input.instructions?.trim() ?? "",
        maxMembers,
        deadline,
      },
    });
    return { ok: true, roomId: created.id };
  } catch {
    return { ok: false, error: "Gagal membuat kelompok." };
  }
}

export async function updateGroupRoom(input: {
  id: string;
  name?: string;
  instructions?: string;
  maxMembers?: number;
  deadline?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const me = await teacherProfile();
    if (!me) return { ok: false, error: "Hanya guru yang boleh mengubah kelompok." };
    const room = await prisma.groupRoom.findFirst({
      where: { id: input.id, course: { ownerId: me.id } },
      include: { _count: { select: { members: true } } },
    });
    if (!room) return { ok: false, error: "Kelompok tidak ditemukan." };

    const maxMembers =
      input.maxMembers === undefined
        ? room.maxMembers
        : Math.min(5, Math.max(1, Math.round(input.maxMembers)));
    if (maxMembers < room._count.members)
      return { ok: false, error: "Slot lebih kecil dari jumlah anggota saat ini." };

    const deadline =
      input.deadline === undefined ? room.deadline : input.deadline ? new Date(input.deadline) : null;
    if (deadline && Number.isNaN(deadline.getTime()))
      return { ok: false, error: "Format deadline tidak valid." };

    await prisma.groupRoom.update({
      where: { id: room.id },
      data: {
        name: input.name?.trim() || room.name,
        instructions: input.instructions === undefined ? room.instructions : input.instructions.trim(),
        maxMembers,
        deadline,
      },
    });
    return { ok: true };
  } catch {
    return { ok: false, error: "Gagal memperbarui kelompok." };
  }
}

export async function deleteGroupRoom(
  id: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const me = await teacherProfile();
    if (!me) return { ok: false, error: "Hanya guru yang boleh menghapus kelompok." };
    const room = await prisma.groupRoom.findFirst({
      where: { id, course: { ownerId: me.id } },
      select: { id: true },
    });
    if (!room) return { ok: false, error: "Kelompok tidak ditemukan." };
    await prisma.groupRoom.delete({ where: { id: room.id } });
    return { ok: true };
  } catch {
    return { ok: false, error: "Gagal menghapus kelompok." };
  }
}

/** Guru membaca isi room: chat, tugas, dan anggota. */
export async function getTeacherRoom(roomId: string): Promise<GroupRoomDetail | null> {
  try {
    const me = await teacherProfile();
    if (!me) return null;
    const room = await prisma.groupRoom.findFirst({
      where: { id: roomId, course: { ownerId: me.id } },
      include: {
        course: { select: { slug: true, title: true } },
        members: {
          orderBy: { joinedAt: "asc" },
          include: { student: { select: { fullName: true, className: true } } },
        },
        messages: { orderBy: { createdAt: "asc" }, take: 300 },
        tasks: { orderBy: { createdAt: "asc" } },
      },
    });
    if (!room) return null;

    return {
      id: room.id,
      name: room.name,
      instructions: room.instructions,
      maxMembers: room.maxMembers,
      deadline: room.deadline?.toISOString() ?? null,
      grade: room.grade,
      feedback: room.feedback,
      gradedAt: room.gradedAt?.toISOString() ?? null,
      locked: isLocked(room),
      isTeacher: true,
      courseSlug: room.course.slug,
      courseTitle: room.course.title,
      members: room.members.map((member) => ({
        id: member.studentId,
        name: member.student.fullName,
        className: member.student.className ?? "—",
        joinedAt: member.joinedAt.toISOString(),
      })),
      messages: room.messages.map((message) => ({
        id: message.id,
        authorId: message.authorId,
        authorName: message.authorName,
        body: message.body,
        createdAt: message.createdAt.toISOString(),
      })),
      tasks: room.tasks.map((task) => ({
        id: task.id,
        title: task.title,
        body: task.body,
        fileUrl: task.fileUrl,
        fileName: task.fileName,
        createdById: task.createdById,
        createdByName: task.createdByName,
        createdAt: task.createdAt.toISOString(),
        updatedAt: task.updatedAt.toISOString(),
      })),
    };
  } catch {
    return null;
  }
}

/** Nilai kelompok. Setelah dinilai, siswa tidak bisa mengubah tugas lagi. */
export async function gradeGroupRoom(input: {
  roomId: string;
  grade: number;
  feedback?: string;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const me = await teacherProfile();
    if (!me) return { ok: false, error: "Hanya guru yang boleh menilai kelompok." };
    const room = await prisma.groupRoom.findFirst({
      where: { id: input.roomId, course: { ownerId: me.id } },
      select: { id: true },
    });
    if (!room) return { ok: false, error: "Kelompok tidak ditemukan." };

    const grade = Math.round(input.grade);
    if (!Number.isFinite(grade) || grade < 0 || grade > 100)
      return { ok: false, error: "Nilai harus 0 sampai 100." };

    await prisma.groupRoom.update({
      where: { id: room.id },
      data: { grade, feedback: input.feedback?.trim() || null, gradedAt: new Date() },
    });
    return { ok: true };
  } catch {
    return { ok: false, error: "Gagal menyimpan nilai kelompok." };
  }
}
