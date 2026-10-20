-- ============================================================================
-- Fix: kolom "updatedAt" (@updatedAt Prisma) NOT NULL tanpa default database.
-- Prisma Client mengisinya di sisi client, TAPI trigger/rp SQL mentah tidak,
-- sehingga insert oleh trigger handle_new_user gagal (23502) dan meruntuhkan
-- signup Supabase Auth ("Database error saving new user").
--
-- Solusi: beri DEFAULT now() pada semua kolom "updatedAt" NOT NULL.
-- Prisma tetap mengirim nilai eksplisit, jadi default ini hanya dipakai
-- oleh insert mentah/trigger yang tidak menyebut kolom tsb.
-- ============================================================================

do $$
declare
  r record;
begin
  for r in
    select table_name
    from information_schema.columns
    where table_schema = 'public'
      and column_name = 'updatedAt'
      and is_nullable = 'NO'
  loop
    execute format(
      'alter table public.%I alter column "updatedAt" set default now()',
      r.table_name
    );
  end loop;
end $$;

-- Trigger signup: isi createdAt & updatedAt eksplisit agar tidak bergantung default.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public."Profile" (id, "fullName", role, "lastActive", "createdAt", "updatedAt")
  values (
    new.id::text,
    coalesce(new.raw_user_meta_data->>'fullName', split_part(coalesce(new.email, ''), '@', 1)),
    'STUDENT',
    now(),
    now(),
    now()
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
