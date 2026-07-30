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

For the backend (`@supabase/supabase-js` configured with `db.schema = 'insight'`) to see
these tables, the schema must be exposed to the API:

> Dashboard → **Settings** → **API** → **Exposed schemas** → add `insight` → save.

Without this, every query fails even though the tables exist.

## Applied

| Date applied | Migration | Applied by | Notes |
| ------------ | --------- | ---------- | ----- |
|              |           |            |       |
