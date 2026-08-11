# Shared Supabase migrations

This is the ordered migration history for the shared Supabase project. It owns the
service schemas used by the worksheet (`worksheet`) and parent insight (`insight`)
backends, plus the DAS 1 screening-response store (`public.responses`). Apply files
in lexical order; do not renumber or rewrite an applied file.

The existing DAS7 history was centralized here unchanged as migrations 0001–0003.
Migrations 0004 and 0005 add the Auth-backed teacher and parent profiles required by
the integrated platform.

## Applying migrations

1. Create or select the approved local/test Supabase project.
2. Ensure every existing `insight.parents.auth_user_id` is populated with a valid
   `auth.users.id` before applying `0005_parent_auth_user_constraint.sql`.
3. Run each SQL file through the Supabase Dashboard SQL Editor in filename order.
4. Before starting either backend, expose the `insight` and `worksheet` schemas in
   Dashboard → Settings → API. Both backend clients use the Data API. `public`
   is exposed by default; `0006_public_responses.sql` explicitly restricts its
   response table to `service_role`.
5. Record the applied project and date in the team's operational notes. Do not put
   credentials in this repository.

All service-owned tables have RLS enabled. Exposing a schema does not grant browser
access: `anon` and `authenticated` have no table privileges, and only
`service_role` is granted table access. Service-role values belong only in backend
environment files.

## Applied history

| Date applied | Project | Migration | Notes |
| ------------ | ------- | --------- | ----- |
| 2026-08-11 | ESC (`vhppezszezjppgoqhbpf`) | `0001_insight_schema.sql` | Creates schema `insight` and its eight tables. |
| 2026-08-11 | ESC (`vhppezszezjppgoqhbpf`) | `0002_grants_and_rls.sql` | Grants `service_role` access and enables RLS. |
| 2026-08-11 | ESC (`vhppezszezjppgoqhbpf`) | `0003_email_notifications_summary_fk.sql` | Changes notification-summary deletion to `ON DELETE SET NULL`. |
| 2026-08-11 | ESC (`vhppezszezjppgoqhbpf`) | `0004_worksheet_teachers.sql` | Creates the Auth-backed teacher profile table. |
| 2026-08-11 | ESC (`vhppezszezjppgoqhbpf`) | `0005_parent_auth_user_constraint.sql` | Requires parent Auth links and adds cascading Auth foreign keys. |
| 2026-08-11 | ESC (`vhppezszezjppgoqhbpf`) | `0006_public_responses.sql` | Creates the RLS-protected DAS 1 screening-response store; backend service-role only. |
