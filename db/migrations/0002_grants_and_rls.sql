-- 0002_grants_and_rls.sql
--
-- Two things the 0001 migration left undone on a hosted Supabase project:
--
--   1. GRANTS. A schema you create yourself starts with no privileges for anyone.
--      Supabase only wires up privileges automatically for `public`, so without
--      this block every backend query fails with:
--          42501  permission denied for schema insight
--      Only `service_role` is granted. `anon` and `authenticated` deliberately get
--      nothing, so the browser cannot reach these tables through the Data API even
--      though the schema is exposed — all access goes through the DAS 7 backend.
--
--   2. ROW LEVEL SECURITY, enabled with no policies. This is a no-op today because
--      `service_role` bypasses RLS, but it fails safe: if anyone later grants access
--      to `authenticated`, RLS-on-with-no-policies denies everything, whereas
--      RLS-off-plus-grant would be wide open. See ARCHITECTURE.md §6.1 for the
--      planned migration to real per-row policies.
--
-- Idempotent — safe to re-run.

-- 1. Grants -----------------------------------------------------------------

grant usage on schema insight to service_role;
grant all privileges on all tables in schema insight to service_role;

-- Applies to tables created by later migrations, so this never has to be repeated.
alter default privileges in schema insight grant all on tables to service_role;

-- 2. Row level security -----------------------------------------------------

alter table insight.parents                  enable row level security;
alter table insight.students                 enable row level security;
alter table insight.parent_students          enable row level security;
alter table insight.progress_records         enable row level security;
alter table insight.summaries                enable row level security;
alter table insight.recommendations          enable row level security;
alter table insight.notification_preferences enable row level security;
alter table insight.email_notifications      enable row level security;
