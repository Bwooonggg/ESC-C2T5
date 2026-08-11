-- 0006_public_responses.sql
--
-- Creates DAS 1's completed screening-session store. The DAS 1 backend uses the
-- Supabase service-role key to write this table after a contact submission; the
-- public screening HTTP routes do not give browser clients database access.
--
-- Column names intentionally retain the camelCase contract emitted by
-- `DAS_1/backend/models/table.ts`. PostgreSQL folds unquoted identifiers to
-- lowercase, so those columns must remain quoted.

create table if not exists public.responses (
    id             uuid primary key,
    "screenerType" text not null check ("screenerType" in ('adult', 'child')),
    stage          text not null check (stage in ('screening', 'report', 'completed')),
    messages       jsonb not null,
    responses      jsonb not null,
    notes          text not null,
    report         text,
    contact        jsonb,
    "createdAt"    timestamptz not null,
    "updatedAt"    timestamptz not null
);

-- Be explicit because public-schema default grants vary by Supabase project.
grant select, insert, update, delete on table public.responses to service_role;
revoke all privileges on table public.responses from anon, authenticated;

-- No policies are created: service_role bypasses RLS, while every other API role
-- is denied by both privileges and RLS.
alter table public.responses enable row level security;
