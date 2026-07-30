# Database migrations

The DAS 7 backend lives in a **service-owned Postgres schema called `insight`** inside a
Supabase project that is **shared with other teams' subsystems**. Because the project is
shared, nothing here runs automatically — there is no migration runner, no CLI step, and no
script that talks to the database as part of `npm test`, `npm run dev` or CI.

## How migrations work here

1. Migrations are plain SQL files in this folder, numbered in the order they must be applied:
   `0001_insight_schema.sql`, `0002_....sql`, and so on. Never renumber or rewrite a file
   that has already been applied — add a new one instead.
2. Every file must be **idempotent** (`create schema if not exists`, `create table if not
   exists`, `create index if not exists`, …) so that re-running it on a database that is
   already up to date is harmless.
3. A **human applies each file by hand**, via the Supabase Dashboard → **SQL Editor**:
   paste the file's contents, run it, confirm it succeeded.
4. Immediately after applying, that person records the date and the filename in the
   **Applied** table below and commits the change. That table is the only record of what
   the shared database actually contains.

## One-time project setup

Creating the tables is not enough on a hosted Supabase project — two extra steps are
needed before a single query works. Both are done, but they are listed here because a
**new project** (a personal one for testing, say) needs them again.

1. **Expose the schema to the API.**
   Dashboard → **Settings** → **API** → **Exposed schemas** → add `insight` → save.
   Skipping this fails every query with `PGRST106 Invalid schema: insight`, even though
   the tables exist.

2. **Grant privileges** — see `0002_grants_and_rls.sql`. A schema you create yourself
   starts with no privileges for anyone; Supabase only wires them up automatically for
   `public`. Skipping this fails every query with `42501 permission denied for schema
   insight`. Only `service_role` is granted, which is what keeps `anon` from reading
   these tables directly through the Data API.

## Applied

| Date applied | Migration | Applied by | Notes |
| ------------ | --------- | ---------- | ----- |
| 2026-07-29 | `0001_insight_schema.sql` | Vay | Creates schema `insight` + 8 tables. Verified: all 8 reachable. |
| 2026-07-29 | `0002_grants_and_rls.sql` | Vay | Grants to `service_role` only; RLS enabled with no policies. Verified: `anon` read → HTTP 401. |

**Verified state as of 2026-07-29:** all 8 tables present and reachable with the
service-role key; every table empty (the seed has not been run); `anon` blocked.
