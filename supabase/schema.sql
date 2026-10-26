-- Run ONCE in Supabase > SQL Editor.

create type intake_t  as enum ('september','january','june');
create type problem_t as enum ('cat2','fat','both');
create type status_t  as enum ('new','in_review','resolved','rejected');

create table public.modules (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  lecturer   text,
  is_english boolean not null default true,
  active     boolean not null default true
);

create table public.submissions (
  id          uuid primary key default gen_random_uuid(),
  ref_no      bigint generated always as identity,
  created_at  timestamptz not null default now(),
  language    text not null check (language in ('en','ar')),
  full_name   text not null,
  roll_number text not null,
  whatsapp    text not null,
  intake      intake_t not null,
  module_id   uuid references public.modules(id),
  module_name text not null,
  lecturer    text not null,
  problem     problem_t not null,
  note        text,
  status      status_t not null default 'new',
  admin_note  text,
  resolved_at timestamptz
);

-- same student cannot send the same problem twice
create unique index uq_submission
  on public.submissions (lower(roll_number), lower(module_name), intake, problem);

create index idx_sub_status on public.submissions (status, created_at desc);

-- who is an admin (nobody can read this table through the API)
create table public.admins (user_id uuid primary key references auth.users(id) on delete cascade);

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

alter table public.modules     enable row level security;
alter table public.submissions enable row level security;
alter table public.admins      enable row level security;

-- modules: everyone reads active ones, admins manage all
create policy "read active modules" on public.modules
  for select to anon, authenticated using (active);
create policy "admin manages modules" on public.modules
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- submissions: NO direct insert for students (they use the function below)
create policy "admin reads submissions" on public.submissions
  for select to authenticated using (public.is_admin());
create policy "admin updates submissions" on public.submissions
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- the only door for students: validates, inserts, returns the reference number
create or replace function public.submit_problem(
  p_language  text,
  p_full_name text,
  p_roll      text,
  p_whatsapp  text,
  p_intake    intake_t,
  p_module_id uuid,
  p_lecturer  text,
  p_problem   problem_t,
  p_note      text
) returns bigint
language plpgsql security definer set search_path = public as $$
declare
  m public.modules%rowtype;
  r bigint;
begin
  select * into m from public.modules where id = p_module_id and active and is_english;
  if not found then raise exception 'module_not_allowed'; end if;
  if length(trim(p_full_name)) < 3 or length(trim(p_roll)) < 1 then
    raise exception 'bad_input';
  end if;

  insert into public.submissions
    (language, full_name, roll_number, whatsapp, intake, module_id, module_name, lecturer, problem, note)
  values
    (p_language, trim(p_full_name), trim(p_roll), trim(p_whatsapp), p_intake, m.id, m.name,
     coalesce(nullif(trim(p_lecturer), ''), m.lecturer, '-'), p_problem, nullif(trim(p_note), ''))
  returning ref_no into r;

  return r;
end $$;

grant execute on function public.submit_problem(text,text,text,text,intake_t,uuid,text,problem_t,text)
  to anon, authenticated;

drop policy if exists "admin deletes submissions" on public.submissions;
create policy "admin deletes submissions" on public.submissions
  for delete to authenticated using (public.is_admin());
notify pgrst, 'reload schema';
