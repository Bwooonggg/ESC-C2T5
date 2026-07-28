# Phase 2 — Database Schema, Repositories & Seed

> **Wave 2 · runs in parallel with Phases 3–6 · depends only on Phase 1.**
> You are writing the SQL migration for DAS 7's `insight` schema, the Supabase repository implementations, and the demo seed script. You do not need a live database to complete this phase — everything must compile and the mapper unit tests must pass offline. A human applies the SQL later.

## Context

The DAS 7 backend stores parents, students, guardianship links, progress records, AI summaries, recommendations, notification preferences, and a sent-email log in the **shared hosted Supabase**, inside a service-owned Postgres schema `insight`. Access is via `@supabase/supabase-js` with the **service_role key** (bypasses RLS; authorization is enforced in backend code — not your concern in this phase). DB rows are `snake_case`; domain objects are `camelCase`.

## Files you own

```
backend/db/migrations/0001_insight_schema.sql
backend/db/migrations/README.md
backend/scripts/seed.ts
backend/src/repos/db.ts
backend/src/repos/mappers.ts
backend/src/repos/parent.repo.ts
backend/src/repos/student.repo.ts
backend/src/repos/progress.repo.ts
backend/src/repos/summary.repo.ts
backend/src/repos/recommendation.repo.ts
backend/src/repos/preference.repo.ts
backend/src/repos/emailNotification.repo.ts
backend/test/unit/mappers.test.ts
```

**Touch nothing else.** In particular do not edit `src/deps.ts` (the interfaces you implement), `package.json` (all dependencies you need are already declared: `@supabase/supabase-js`, `dotenv`, `tsx`), or any service/route/adapter file.

## Contracts you implement (from `src/deps.ts` — already written, do not edit)

```ts
export interface ParentRepo {
    byAuthUserId(authUserId: string): Promise<Parent | null>;
    byId(parentId: string): Promise<Parent | null>;
}
export interface StudentRepo {
    byId(studentId: string): Promise<Student | null>;
    listByParent(parentId: string): Promise<Student[]>;
    isGuardian(parentId: string, studentId: string): Promise<boolean>;
}
export interface ProgressRepo {
    listByStudent(studentId: string): Promise<ProgressRecord[]>;      // ordered by date ASC
    latestCreatedAt(studentId: string): Promise<string | null>;       // internal created_at, ISO
}
export interface SummaryRepo {
    latestByStudent(studentId: string): Promise<Summary | null>;
    insert(input: { studentId: string; content: string }): Promise<Summary>;
}
export interface RecommendationRepo {
    insert(input: { summaryId: string; content: string }): Promise<Recommendation>;
}
export interface PreferenceRepo {
    byParentId(parentId: string): Promise<NotificationPreference | null>;
    upsert(pref: NotificationPreference): Promise<NotificationPreference>;
    listEnabled(): Promise<NotificationPreference[]>;
}
export interface EmailNotificationRepo {
    lastSentAt(parentId: string): Promise<string | null>;
    insert(input: {
        parentId: string; summaryId: string | null;
        recipientEmail: string; subject: string; body: string;
    }): Promise<void>;
}
```

Domain types (`Parent`, `Student`, `ProgressRecord`, `Summary`, `Recommendation`, `NotificationPreference`) are in `src/types.ts` — import, never redefine. Key format facts: `Student.dateOfBirth` and `ProgressRecord.date` are bare `'YYYY-MM-DD'` strings (Postgres `date` columns already come back in that format via supabase-js — pass them through, never `new Date()` them); `generatedAt`/timestamps are ISO 8601 strings as returned by Postgres `timestamptz`.

## Progress

Tick each box (`[ ]` → `[x]`) in this file as you complete the step. Do not change any other text in this document.

- [ ] Step 1 — migration SQL + migrations README
- [ ] Step 2 — `src/repos/db.ts`
- [ ] Step 3 — `src/repos/mappers.ts`
- [ ] Step 4 — repo implementations (7 files)
- [ ] Step 5 — `scripts/seed.ts`
- [ ] Step 6 — mapper unit tests
- [ ] Done criteria verified (typecheck + tests green, ownership respected, no live DB touched)

## Step 1 — `db/migrations/0001_insight_schema.sql`

Exactly this DDL (idempotent so re-running is safe):

```sql
create schema if not exists insight;

create table if not exists insight.parents (
    parent_id     uuid primary key default gen_random_uuid(),
    auth_user_id  uuid unique,
    name          text not null,
    email         text not null,
    mobile_number text not null default ''
);

create table if not exists insight.students (
    student_id    uuid primary key default gen_random_uuid(),
    name          text not null,
    date_of_birth date not null,
    band_level    text not null
);

create table if not exists insight.parent_students (
    parent_id  uuid not null references insight.parents  on delete cascade,
    student_id uuid not null references insight.students on delete cascade,
    primary key (parent_id, student_id)
);

create table if not exists insight.progress_records (
    record_id  uuid primary key default gen_random_uuid(),
    student_id uuid not null references insight.students on delete cascade,
    date       date not null,
    skill_area text not null check (skill_area in ('Phonological Awareness','Reading Accuracy',
                 'Reading Fluency','Spelling','Writing','Comprehension')),
    score      int  not null check (score between 0 and 100),
    notes      text not null default '',
    created_at timestamptz not null default now()
);
create index if not exists progress_records_student_date_idx
    on insight.progress_records (student_id, date);

create table if not exists insight.summaries (
    summary_id   uuid primary key default gen_random_uuid(),
    student_id   uuid not null references insight.students on delete cascade,
    content      text not null,
    generated_at timestamptz not null default now()
);
create index if not exists summaries_student_latest_idx
    on insight.summaries (student_id, generated_at desc);

create table if not exists insight.recommendations (
    recommendation_id uuid primary key default gen_random_uuid(),
    summary_id        uuid not null references insight.summaries on delete cascade,
    content           text not null,
    generated_at      timestamptz not null default now()
);

create table if not exists insight.notification_preferences (
    parent_id       uuid primary key references insight.parents on delete cascade,
    enabled         boolean not null default false,
    frequency       text not null default 'Weekly'
                      check (frequency in ('Weekly','Fortnightly','Monthly')),
    recipient_email text not null
);

create table if not exists insight.email_notifications (
    notification_id uuid primary key default gen_random_uuid(),
    parent_id       uuid not null references insight.parents on delete cascade,
    summary_id      uuid references insight.summaries,
    recipient_email text not null,
    subject         text not null,
    body            text not null,
    sent_at         timestamptz not null default now()
);
create index if not exists email_notifications_parent_latest_idx
    on insight.email_notifications (parent_id, sent_at desc);
```

`db/migrations/README.md`: explain the workflow — migrations are numbered SQL files applied **manually via the Supabase Dashboard SQL editor** by a human; after applying, the human records date + filename in an "Applied" table in this README; the `insight` schema must also be added to **Exposed schemas** under Dashboard → Settings → API. Include the empty "Applied" table.

## Step 2 — `src/repos/db.ts`

```ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { AppConfig } from '../config.js';

export function createDbClient(config: AppConfig): SupabaseClient {
    return createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
        db: { schema: config.supabaseDbSchema },
        auth: { persistSession: false, autoRefreshToken: false },
    });
}
```

## Step 3 — `src/repos/mappers.ts`

Pure functions `rowToParent` (takes the parent row plus a `studentIds: string[]` argument), `rowToStudent`, `rowToProgressRecord`, `rowToSummary`, `rowToRecommendation`, `rowToPreference`. snake_case in, camelCase out; no Date parsing (pass strings through). Type row shapes as local interfaces in this file.

## Step 4 — repo implementations

Each `src/repos/X.repo.ts` exports one factory, e.g. `export function createParentRepo(client: SupabaseClient): ParentRepo`. Rules:

- On any supabase-js error (`error` non-null), `throw new Error(\`db: ${error.message}\`)` — this becomes a 500 via the app's error middleware, which is correct for infrastructure failures.
- Reading one-or-none: use `.maybeSingle()` (returns `data: null` without error when no row).
- Query patterns:
    - `parent.repo`: select from `parents` by `auth_user_id` / `parent_id`; then select `student_id` from `parent_students` by `parent_id` to build `studentIds`. Share a private helper.
    - `student.repo.listByParent`: select `student_id` from `parent_students`, then `.in('student_id', ids)` on `students`; return `[]` for no links. `isGuardian`: `parent_students` filtered on both columns, `.maybeSingle()`, return `data !== null`.
    - `progress.repo.listByStudent`: `.eq('student_id', id).order('date', { ascending: true })`. `latestCreatedAt`: select `created_at`, `.order('created_at', { ascending: false }).limit(1).maybeSingle()`.
    - `summary.repo.latestByStudent`: `.order('generated_at', { ascending: false }).limit(1).maybeSingle()`. `insert`: `.insert({ student_id, content }).select().single()` and map (DB generates id + timestamp).
    - `recommendation.repo.insert`: same insert-returning pattern.
    - `preference.repo.upsert`: `.upsert({...}, { onConflict: 'parent_id' }).select().single()`. `listEnabled`: `.eq('enabled', true)`.
    - `emailNotification.repo.lastSentAt`: select `sent_at` ordered desc limit 1 `.maybeSingle()`. `insert`: plain insert, no select needed.

## Step 5 — `scripts/seed.ts`

Runnable via `npm run seed` (tsx; `import 'dotenv/config'`). Uses `loadConfig()` + `createDbClient`. Seeds the demo dataset **with fixed UUIDs** (declare constants) and `upsert` everywhere so re-running is safe:

- Parent: name `Aisha Rahman`, email `parent.demo@dial.sg`, mobile `+65 8123 4567`. Set `auth_user_id` from env `SEED_AUTH_USER_ID` if present, else leave null, and log which happened.
- Students: `Nur Hakim` (Band A, dob 2015-04-12), `Elias Rahman` (Band B, dob 2013-11-02), `Sofia Rahman` (Band A, dob 2016-08-23) — all linked to the parent in `parent_students`.
- Progress: for each student × each of the 6 skill areas × dates `2026-01-20`, `2026-03-17`, `2026-05-19` (54 rows), scores rising over time in 40–95, deterministic (compute from indices, not `Math.random`), short realistic `notes`.
- Preference: enabled `true`, frequency `Weekly`, recipient `parent.demo@dial.sg`.

Print a completion summary (counts per table). The script must refuse to run (clear error) if `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` are missing.

## Step 6 — `test/unit/mappers.test.ts`

Offline unit tests: each mapper converts a representative row correctly (field-by-field), preserves bare date strings untouched, and `rowToParent` attaches the passed `studentIds`.

## Done criteria

- `npm run typecheck` clean; `npm test` green (your mappers suite passes; other suites untouched).
- Repo factories satisfy the `deps.ts` interfaces exactly (the compiler proves this — annotate the factory return types).
- You never ran anything against a live database (that's a human step later), and no file outside your ownership list changed.

## Human intervention required after this phase (orchestrator handles — just make it easy)

1. Inspect the hosted Supabase for a pre-existing `insight` schema left by the old backend on `main`; coordinate/drop as decided, then run `0001_insight_schema.sql` in the SQL editor.
2. Add `insight` to Exposed schemas (Dashboard → Settings → API).
3. Fill `backend/.env`, then run `npm run seed`.
