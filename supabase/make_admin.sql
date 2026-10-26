-- 1) Supabase > Authentication > Users > Add user (your email + password, tick auto-confirm)
-- 2) Authentication > Providers > Email > turn OFF "Allow new users to sign up"
-- 3) Run this with YOUR email:
insert into public.admins (user_id)
select id from auth.users where email = 'your-email@example.com';