-- ============================================================================
-- EduVerse LMS — RLS + Trigger (Supabase / PostgreSQL)
--
-- Catatan penamaan: Prisma TANPA @@map memakai nama model apa adanya,
-- jadi tabel = "Profile", "Course", "LessonBlock", ... (PascalCase)
-- dan kolom = camelCase sesuai field. ID bertipe text (bukan uuid).
-- Karena itu auth.uid() (uuid) harus di-cast ke text saat dibandingkan.
--
-- Jalankan: prisma db execute --file <file> --schema prisma/schema.prisma
-- (tabel sudah dibuat lewat: prisma db push)
-- ============================================================================

-- ─────────────────────────────────────────────────────────────
-- 1. TRIGGER: role default STUDENT saat user dibuat via Supabase Auth.
--    Role TEACHER/ADMIN tetap ditetapkan backend (Prisma) yang tepercaya.
-- ─────────────────────────────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public."Profile" (id, "fullName", role)
  values (
    new.id::text,
    coalesce(new.raw_user_meta_data->>'fullName', split_part(new.email, '@', 1)),
    'STUDENT'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─────────────────────────────────────────────────────────────
-- 2. FUNGSI PEMBANTU
-- ─────────────────────────────────────────────────────────────

-- uid login sebagai text (id kolom bertipe text).
create or replace function public.current_uid()
returns text
language sql
stable
security definer set search_path = public
as $$
  select auth.uid()::text
$$;

create or replace function public.current_profile_role()
returns text
language sql
stable
security definer set search_path = public
as $$
  select role::text from public."Profile" where id = auth.uid()::text
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public."Profile"
    where id = auth.uid()::text and role = 'ADMIN' and "isActive" = true
  )
$$;

create or replace function public.is_teacher()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public."Profile"
    where id = auth.uid()::text and role = 'TEACHER' and "isActive" = true
  )
$$;

-- Guru pemilik course?
create or replace function public.owns_course(cid text)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public."Course"
    where id = cid and "ownerId" = auth.uid()::text
  )
$$;

-- Siswa punya enrollment ACTIVE pada course?
create or replace function public.enrolled_active(cid text)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public."Enrollment"
    where "courseId" = cid and "studentId" = auth.uid()::text and status = 'ACTIVE'
  )
$$;

-- Siswa terdaftar pada blok (lewat course-nya)?
create or replace function public.enrolled_in_block(bid text)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public."LessonBlock" lb
    join public."Module" m on m.id = lb."moduleId"
    join public."Enrollment" e on e."courseId" = m."courseId"
    where lb.id = bid and e."studentId" = auth.uid()::text and e.status = 'ACTIVE'
  )
$$;

-- Course sebuah blok (membantu policy quiz/queston).
create or replace function public.block_course(bid text)
returns text
language sql
stable
security definer set search_path = public
as $$
  select m."courseId" from public."LessonBlock" lb
  join public."Module" m on m.id = lb."moduleId"
  where lb.id = bid
$$;

-- Course sebuah quiz.
create or replace function public.quiz_course(qid text)
returns text
language sql
stable
security definer set search_path = public
as $$
  select public.block_course(q."blockId") from public."Quiz" q where q.id = qid
$$;

-- ─────────────────────────────────────────────────────────────
-- 3. AKTIFKAN RLS DI SEMUA TABEL PRIVAT
-- ─────────────────────────────────────────────────────────────
alter table public."Profile"        enable row level security;
alter table public."StudentAvatar"  enable row level security;
alter table public."Course"         enable row level security;
alter table public."Module"         enable row level security;
alter table public."LessonBlock"    enable row level security;
alter table public."Enrollment"     enable row level security;
alter table public."Progress"       enable row level security;
alter table public."Quiz"           enable row level security;
alter table public."Question"       enable row level security;
alter table public."QuizAttempt"    enable row level security;
alter table public."Submission"     enable row level security;
alter table public."GameVersion"    enable row level security;
alter table public."GameAttempt"    enable row level security;
alter table public."Notification"   enable row level security;
alter table public."AuditLog"       enable row level security;
alter table public."PlatformSetting" enable row level security;

-- ─────────────────────────────────────────────────────────────
-- 4. POLICIES: PROFILE
-- ─────────────────────────────────────────────────────────────
create policy "profile_select_self_admin"
  on public."Profile" for select
  using (id = auth.uid()::text or public.is_admin());

-- Siswa/guru boleh ubah profilnya sendiri; role & isActive dikunci trigger.
create policy "profile_update_self"
  on public."Profile" for update
  using (id = auth.uid()::text)
  with check (id = auth.uid()::text);

-- Insert lewat client hanya boleh memuat role STUDENT (cegah eskalasi).
create policy "profile_insert_self_student"
  on public."Profile" for insert
  with check (id = auth.uid()::text and role = 'STUDENT');

-- ─────────────────────────────────────────────────────────────
-- 5. POLICIES: COURSE
-- ─────────────────────────────────────────────────────────────
create policy "course_select_published_or_owner"
  on public."Course" for select
  using (state = 'PUBLISHED' or "ownerId" = auth.uid()::text or public.is_admin());

create policy "course_insert_teacher"
  on public."Course" for insert
  with check (public.is_teacher() and "ownerId" = auth.uid()::text);

create policy "course_update_owner"
  on public."Course" for update
  using ("ownerId" = auth.uid()::text or public.is_admin())
  with check ("ownerId" = auth.uid()::text or public.is_admin());

create policy "course_delete_owner"
  on public."Course" for delete
  using ("ownerId" = auth.uid()::text or public.is_admin());

-- ─────────────────────────────────────────────────────────────
-- 6. POLICIES: MODULE & LESSON BLOCK
-- ─────────────────────────────────────────────────────────────
create policy "module_select"
  on public."Module" for select
  using (
    public.owns_course("courseId")
    or exists (select 1 from public."Course" c where c.id = "courseId" and c.state = 'PUBLISHED')
    or public.is_admin()
  );

create policy "module_write_owner"
  on public."Module" for all
  using (public.owns_course("courseId") or public.is_admin())
  with check (public.owns_course("courseId") or public.is_admin());

create policy "block_select"
  on public."LessonBlock" for select
  using (
    public.owns_course(public.block_course(id))
    or exists (
      select 1 from public."Module" m join public."Course" c on c.id = m."courseId"
      where m.id = "moduleId" and c.state = 'PUBLISHED'
    )
    or public.is_admin()
  );

create policy "block_write_owner"
  on public."LessonBlock" for all
  using (public.owns_course(public.block_course(id)) or public.is_admin())
  with check (public.owns_course(public.block_course(id)) or public.is_admin());

-- ─────────────────────────────────────────────────────────────
-- 7. POLICIES: ENROLLMENT
-- ─────────────────────────────────────────────────────────────
create policy "enrollment_select"
  on public."Enrollment" for select
  using ("studentId" = auth.uid()::text or public.owns_course("courseId") or public.is_admin());

create policy "enrollment_insert_self"
  on public."Enrollment" for insert
  with check ("studentId" = auth.uid()::text);

create policy "enrollment_update"
  on public."Enrollment" for update
  using ("studentId" = auth.uid()::text or public.owns_course("courseId") or public.is_admin())
  with check ("studentId" = auth.uid()::text or public.owns_course("courseId") or public.is_admin());

-- ─────────────────────────────────────────────────────────────
-- 8. POLICIES: PROGRESS
-- ─────────────────────────────────────────────────────────────
create policy "progress_select"
  on public."Progress" for select
  using ("studentId" = auth.uid()::text or public.owns_course("courseId") or public.is_admin());

create policy "progress_insert_own"
  on public."Progress" for insert
  with check ("studentId" = auth.uid()::text and public.enrolled_active("courseId"));

create policy "progress_update_own"
  on public."Progress" for update
  using ("studentId" = auth.uid()::text)
  with check ("studentId" = auth.uid()::text);

-- ─────────────────────────────────────────────────────────────
-- 9. POLICIES: QUIZ & QUESTION
--     Kunci jawaban (Question.answer) tidak diberikan ke siswa di sini;
--     validasi skor dilakukan server lewat Prisma (bypass RLS sebagai owner).
-- ─────────────────────────────────────────────────────────────
create policy "quiz_select"
  on public."Quiz" for select
  using (
    public.owns_course(public.block_course("blockId"))
    or public.enrolled_in_block("blockId")
    or public.is_admin()
  );

create policy "quiz_write_owner"
  on public."Quiz" for all
  using (public.owns_course(public.block_course("blockId")) or public.is_admin())
  with check (public.owns_course(public.block_course("blockId")) or public.is_admin());

create policy "question_select_owner_admin"
  on public."Question" for select
  using (
    public.owns_course(public.quiz_course(id))
    or public.is_admin()
  );

create policy "question_write_owner"
  on public."Question" for all
  using (public.owns_course(public.quiz_course(id)) or public.is_admin())
  with check (public.owns_course(public.quiz_course(id)) or public.is_admin());

-- ─────────────────────────────────────────────────────────────
-- 10. POLICIES: QUIZ ATTEMPT
-- ─────────────────────────────────────────────────────────────
create policy "attempt_select"
  on public."QuizAttempt" for select
  using ("studentId" = auth.uid()::text or public.owns_course("courseId") or public.is_admin());

create policy "attempt_insert_own"
  on public."QuizAttempt" for insert
  with check ("studentId" = auth.uid()::text and public.enrolled_active("courseId"));

-- ─────────────────────────────────────────────────────────────
-- 11. POLICIES: SUBMISSION
-- ─────────────────────────────────────────────────────────────
create policy "submission_select"
  on public."Submission" for select
  using ("studentId" = auth.uid()::text or public.owns_course("courseId") or public.is_admin());

create policy "submission_insert_own"
  on public."Submission" for insert
  with check ("studentId" = auth.uid()::text and public.enrolled_active("courseId"));

create policy "submission_grade_owner"
  on public."Submission" for update
  using (public.owns_course("courseId") or public.is_admin())
  with check (public.owns_course("courseId") or public.is_admin());

-- ─────────────────────────────────────────────────────────────
-- 12. POLICIES: GAME VERSION & ATTEMPT
-- ─────────────────────────────────────────────────────────────
create policy "gameversion_select"
  on public."GameVersion" for select
  using (published = true or "createdBy" = auth.uid()::text or public.is_admin());

create policy "gameversion_write_creator"
  on public."GameVersion" for all
  using ("createdBy" = auth.uid()::text or public.is_admin())
  with check ("createdBy" = auth.uid()::text or public.is_admin());

create policy "gameattempt_select"
  on public."GameAttempt" for select
  using ("studentId" = auth.uid()::text or public.owns_course("courseId") or public.is_admin());

create policy "gameattempt_insert_own"
  on public."GameAttempt" for insert
  with check ("studentId" = auth.uid()::text);

-- ─────────────────────────────────────────────────────────────
-- 13. POLICIES: NOTIFICATION, AUDIT, SETTINGS
-- ─────────────────────────────────────────────────────────────
create policy "notification_select_own"
  on public."Notification" for select
  using ("userId" = auth.uid()::text);

create policy "notification_update_own"
  on public."Notification" for update
  using ("userId" = auth.uid()::text);

create policy "audit_select"
  on public."AuditLog" for select
  using (public.is_admin() or "actorId" = auth.uid()::text);

create policy "audit_insert"
  on public."AuditLog" for insert
  with check ("actorId" = auth.uid()::text);

create policy "settings_select"
  on public."PlatformSetting" for select
  using (true);

create policy "settings_update_admin"
  on public."PlatformSetting" for update
  using (public.is_admin())
  with check (public.is_admin());

-- ─────────────────────────────────────────────────────────────
-- 14. TRIGGER: kunci role & isActive.
--     - auth.uid() IS NULL  → koneksi backend tepercaya (Prisma) → boleh.
--     - ada uid & bukan admin → INSERT hanya STUDENT; UPDATE dilarang ubah role/isActive.
-- ─────────────────────────────────────────────────────────────
create or replace function public.protect_role_columns()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  -- Koneksi backend/service-role (tanpa JWT) dianggap tepercaya.
  if auth.uid() is null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.role is distinct from 'STUDENT' and not public.is_admin() then
      raise exception 'Pendaftaran publik hanya boleh membuat role STUDENT';
    end if;
    return new;
  end if;

  -- UPDATE: blokir perubahan role/isActive oleh non-admin.
  if (new.role is distinct from old.role or new."isActive" is distinct from old."isActive")
     and not public.is_admin() then
    raise exception 'Perubahan role/isActive hanya boleh oleh Admin';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_role on public."Profile";
create trigger protect_role
  before insert or update on public."Profile"
  for each row execute function public.protect_role_columns();
