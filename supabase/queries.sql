-- =====================================================================
-- MARKS HELP DESK: queries (PostgreSQL / Supabase). No demo data.
-- Run one:   .\supabase\run.ps1 -Id 3.2
-- See all:   .\supabase\run.ps1 -List
-- {{arg}} is filled from -Arg "value"
-- =====================================================================

-- ---------- PART 0. CHECK THE SETUP ----------

-- [0.1] Which tables exist
select table_name from information_schema.tables where table_schema = 'public' order by table_name;

-- [0.2] Row count per table
select (select count(*) from modules) as modules, (select count(*) from submissions) as submissions, (select count(*) from admins) as admins;

-- [0.3] Columns of the submissions table
select column_name, data_type, is_nullable from information_schema.columns where table_schema = 'public' and table_name = 'submissions' order by ordinal_position;

-- ---------- PART 1. MODULES ----------

-- [1.1] All modules
select name, lecturer, is_english, active from modules order by name;

-- [1.2] What students can pick (active and English)
select name, lecturer from modules where active and is_english order by name;

-- [1.3] Every module with how many problems it has (LEFT JOIN keeps empty ones)
select m.name, m.lecturer, count(s.id) as problems from modules m left join submissions s on s.module_id = m.id group by m.id, m.name, m.lecturer order by problems desc, m.name;

-- ---------- PART 2. BASICS: SELECT, WHERE, ORDER BY ----------

-- [2.1] New problems waiting for action, oldest first
select ref_no, full_name, roll_number, module_name, problem, created_at from submissions where status = 'new' order by created_at asc;

-- [2.2] The 20 newest problems
select ref_no, full_name, roll_number, module_name, problem, status, created_at from submissions order by created_at desc limit 20;

-- [2.3] Last 7 days
select ref_no, full_name, module_name, problem, created_at from submissions where created_at >= now() - interval '7 days' order by created_at desc;

-- [2.4] One student by roll number (use -Arg "roll number")
select ref_no, module_name, intake, problem, status from submissions where lower(roll_number) = lower('{{arg}}') order by created_at;

-- [2.5] Search by part of a name (use -Arg "part of name")
select ref_no, full_name, roll_number, module_name from submissions where full_name ilike '%{{arg}}%' order by full_name;

-- ---------- PART 3. AGGREGATES: COUNT, GROUP BY, HAVING, FILTER ----------

-- [3.1] Problems per status
select status, count(*) as total from submissions group by status order by total desc;

-- [3.2] Problems per module
select module_name, count(*) as total from submissions group by module_name order by total desc;

-- [3.3] CAT 2 / FAT / both per intake, one row per intake
select intake, count(*) as total, count(*) filter (where problem = 'cat2') as cat2, count(*) filter (where problem = 'fat') as fat, count(*) filter (where problem = 'both') as both_papers from submissions group by intake order by intake;

-- [3.4] HAVING: modules with 2 or more problems
select module_name, count(*) as total from submissions group by module_name having count(*) >= 2 order by total desc;

-- [3.5] Dashboard numbers in one row
select count(*) as total, count(*) filter (where status = 'new') as new, count(*) filter (where status = 'in_review') as in_review, count(*) filter (where status = 'resolved') as resolved, count(*) filter (where status = 'rejected') as rejected from submissions;

-- [3.6] Problems per day
select created_at::date as day, count(*) as total from submissions group by day order by day;

-- [3.7] English vs Arabic form usage
select language, count(*) as total from submissions group by language;

-- ---------- PART 4. JOINS ----------

-- [4.1] INNER JOIN: submissions with module details
select s.ref_no, s.full_name, m.name as module, m.lecturer, s.problem from submissions s join modules m on m.id = s.module_id order by s.ref_no;

-- [4.2] Modules nobody has reported (anti-join)
select m.name from modules m left join submissions s on s.module_id = m.id where s.id is null order by m.name;

-- [4.3] Lecturer workload
select lecturer, count(*) as problems from submissions group by lecturer order by problems desc;

-- ---------- PART 5. INTERMEDIATE: CTE AND WINDOW FUNCTIONS ----------

-- [5.1] CTE: students who reported more than one problem
with per_student as (select roll_number, min(full_name) as full_name, count(*) as problems from submissions group by roll_number) select * from per_student where problems > 1 order by problems desc;

-- [5.2] Rank modules by number of problems
select module_name, count(*) as total, rank() over (order by count(*) desc) as position from submissions group by module_name order by position;

-- [5.3] Most recent problem in each module
select module_name, full_name, problem, created_at from (select module_name, full_name, problem, created_at, row_number() over (partition by module_name order by created_at desc) as rn from submissions) t where rn = 1;

-- [5.4] Average time to resolve
select count(*) as resolved_count, avg(resolved_at - created_at) as avg_time_to_resolve from submissions where status = 'resolved';

-- ---------- PART 6. ADMIN WORKFLOW (use -Arg with the ref_no) ----------

-- [6.1] Preview a problem before changing it
select ref_no, full_name, roll_number, module_name, problem, status, admin_note from submissions where ref_no = '{{arg}}';

-- [6.2] Start working on it
update submissions set status = 'in_review' where ref_no = '{{arg}}' returning ref_no, full_name, status;

-- [6.3] Resolve it
update submissions set status = 'resolved', resolved_at = now() where ref_no = '{{arg}}' returning ref_no, status, resolved_at;

-- [6.4] Preview: problems still new after 30 days
select ref_no, full_name, module_name, created_at from submissions where status = 'new' and created_at < now() - interval '30 days' order by created_at;

-- ---------- PART 7. DATA QUALITY ----------

-- [7.1] WhatsApp numbers that look wrong
select ref_no, full_name, whatsapp from submissions where whatsapp !~ '^\+?\d{8,15}$';

-- [7.2] Same student, same module, more than one problem type
select roll_number, module_name, count(*) as problems from submissions group by roll_number, module_name having count(*) > 1;

-- ---------- PART 8. PERFORMANCE ----------

-- [8.1] Indexes on submissions
select indexname, indexdef from pg_indexes where tablename = 'submissions';

-- [8.2] Query plan for the admin list
explain analyze select ref_no, full_name from submissions where status = 'new' order by created_at desc;

-- ---------- PART 9. SECURITY ----------

-- [9.1] Is row level security on?
select relname as table_name, relrowsecurity as rls_enabled from pg_class where relname in ('modules', 'submissions', 'admins');

-- [9.2] Policies and who they apply to
select tablename, policyname, cmd, roles from pg_policies where schemaname = 'public' order by tablename, policyname;

-- [9.3] Who are the admins
select a.user_id, u.email from admins a join auth.users u on u.id = a.user_id;

-- ---------- PART 10. ADMIN ACCESS ----------

-- [10.1] Make a user an admin (create the user first in Supabase > Authentication; use -Arg "email")
insert into public.admins (user_id) select id from auth.users where lower(email) = lower('{{arg}}') on conflict do nothing returning user_id;