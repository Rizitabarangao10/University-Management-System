-- Run in Supabase: SQL Editor > New query > Run
create table profiles(id uuid primary key references auth.users on delete cascade,full_name text,email text,role text not null default 'student' check(role in('admin','teacher','student')),created_at timestamptz default now());
create table classes(id bigint generated always as identity primary key,code text,name text not null,teacher_id uuid references profiles(id) on delete set null,day text,start_time time,end_time time,room text);
create table enrollments(id bigint generated always as identity primary key,class_id bigint references classes on delete cascade,student_id uuid references profiles on delete cascade,unique(class_id,student_id));
create table grades(id bigint generated always as identity primary key,class_id bigint references classes on delete cascade,student_id uuid references profiles on delete cascade,score numeric,remarks text,unique(class_id,student_id));
create table announcements(id bigint generated always as identity primary key,title text not null,body text,created_at timestamptz default now());
create table settings(key text primary key,value text);
insert into settings values('university_name','My University'),('pass_score','75'),('max_score','100');

create function my_role() returns text language sql security definer stable set search_path=public as $$ select role from profiles where id=auth.uid() $$;
create or replace function handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$
begin 
  insert into profiles(id,email,full_name,role) 
  values(
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name',split_part(new.email,'@',1)),
    case 
      when new.raw_user_meta_data->>'role' in ('admin','teacher','student') then new.raw_user_meta_data->>'role'
      else 'student'
    end
  ); 
  return new; 
end $$;
create or replace trigger on_signup after insert on auth.users for each row execute function handle_new_user();

alter table profiles enable row level security;alter table classes enable row level security;alter table enrollments enable row level security;
alter table grades enable row level security;alter table announcements enable row level security;alter table settings enable row level security;

create policy p_read on profiles for select to authenticated using(true);
create policy p_own on profiles for update to authenticated using(id=auth.uid()) with check(role=my_role());
create policy p_admin on profiles for all to authenticated using(my_role()='admin') with check(my_role()='admin');
create policy c_read on classes for select to authenticated using(true);
create policy c_write on classes for all to authenticated using(my_role()='admin' or teacher_id=auth.uid()) with check(my_role()='admin' or (my_role()='teacher' and teacher_id=auth.uid()));
create policy e_read on enrollments for select to authenticated using(my_role() in('admin','teacher') or student_id=auth.uid());
create policy e_admin on enrollments for all to authenticated using(my_role()='admin') with check(my_role()='admin');
create policy g_read on grades for select to authenticated using(my_role() in('admin','teacher') or student_id=auth.uid());
create policy g_write on grades for all to authenticated using(my_role()='admin' or exists(select 1 from classes c where c.id=class_id and c.teacher_id=auth.uid())) with check(my_role()='admin' or exists(select 1 from classes c where c.id=class_id and c.teacher_id=auth.uid()));
create policy a_read on announcements for select to authenticated using(true);
create policy a_admin on announcements for all to authenticated using(my_role()='admin') with check(my_role()='admin');
create policy s_read on settings for select to anon,authenticated using(true);
create policy s_admin on settings for all to authenticated using(my_role()='admin') with check(my_role()='admin');

-- =========================================================================
-- USER ROLES MANAGEMENT: admin, teacher, student
-- =========================================================================
-- Assign or switch a user's role anytime:
-- update profiles set role = 'admin' where email = 'admin@example.com';
-- update profiles set role = 'teacher' where email = 'teacher@example.com';
-- update profiles set role = 'student' where email = 'student@example.com';
--
-- View users grouped by role:
-- select role, count(*) from profiles group by role;
-- select id, full_name, email, role, created_at from profiles order by role, full_name;
