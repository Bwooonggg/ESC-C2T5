-- 0004_worksheet_teachers.sql
--
-- Creates the worksheet-owned teacher profile table. Authentication accounts are
-- owned by Supabase Auth; deleting an account deletes its profile.

create schema if not exists worksheet;

create table if not exists worksheet.teachers (
    teacher_id   uuid primary key default gen_random_uuid(),
    auth_user_id uuid not null unique references auth.users (id) on delete cascade,
    display_name text,
    created_at   timestamptz not null default now()
);

grant usage on schema worksheet to service_role;
grant all privileges on all tables in schema worksheet to service_role;
alter default privileges in schema worksheet grant all on tables to service_role;

alter table worksheet.teachers enable row level security;
revoke all privileges on table worksheet.teachers from anon, authenticated;
