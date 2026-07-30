# Phase 2 — Handoff

**Status: complete.** `npx tsc --noEmit` clean; `npm test` green (2 suites, 23 tests).
Nothing was run against the live Supabase project.

## What was built

| File | What it is |
| ---- | ---------- |
| `db/migrations/0001_insight_schema.sql` | The `insight` schema DDL, verbatim from the phase doc. Idempotent — safe to re-run. |
| `db/migrations/README.md` | How migrations are applied here (by hand, via the Dashboard SQL editor) plus the empty **Applied** log table. |
| `src/repos/db.ts` | `createDbClient(config)` — service-role client scoped to `config.supabaseDbSchema`. |
| `src/repos/mappers.ts` | Six pure `rowToX` functions, snake_case → camelCase. Row shapes typed as local interfaces. |
| `src/repos/parent.repo.ts` | `byAuthUserId`, `byId`; a shared private helper reads `parent_students` for `studentIds`. |
| `src/repos/student.repo.ts` | `byId`, `listByParent` (links → `.in()`), `isGuardian`. |
| `src/repos/progress.repo.ts` | `listByStudent` (date ASC), `latestCreatedAt`. |
| `src/repos/summary.repo.ts` | `latestByStudent`, `insert` (insert-returning). |
| `src/repos/recommendation.repo.ts` | `insert` (insert-returning). |
| `src/repos/preference.repo.ts` | `byParentId`, `upsert` on `parent_id`, `listEnabled`. |
| `src/repos/emailNotification.repo.ts` | `lastSentAt`, `insert` (no read-back). |
| `scripts/seed.ts` | The demo dataset, fixed UUIDs, `upsert` everywhere. |
| `test/unit/mappers.test.ts` | 13 offline tests covering all six mappers. |

Every factory is annotated with its `deps.ts` interface as the return type, so the
compiler — not a comment — proves each one satisfies its contract.

## Things the next person should know

### One deviation from the phase doc

`src/repos/db.ts` does **not** match the Step 2 snippet exactly. The snippet does not
compile against the installed `@supabase/supabase-js`:

```
error TS2322: Type 'SupabaseClient<any, any, string, any, any>' is not assignable to
type 'SupabaseClient<any, "public", "public", any, any>'.
```

Passing `db: { schema: config.supabaseDbSchema }` — a plain `string` — widens the
client's schema type parameter, while the declared `SupabaseClient` return type defaults
that parameter to the literal `'public'`. The fix in the file is `config.supabaseDbSchema
as 'public'`, with a comment. The runtime value is untouched (still `insight`, from
config); that type parameter exists only to type relation names against a generated
`Database` type, which this untyped client never uses. **If the contract snippet is
copied into other phase docs, it needs the same correction.**

### The test runner had been downgraded

The working tree carried an uncommitted downgrade of `jest ^30.2.0 → ^25.0.0` and
`ts-jest ^29.4.4 → ^25.5.1`. Jest 25 predates ESM preset support, so `npm test` died
loading `ts-jest/presets/default-esm` before reading any test file — the whole suite,
including Phase 1's, was red. Both versions were restored to their committed values and
dependencies reinstalled; `package.json` is back to its committed content and
`package-lock.json` reflects the reinstall.

Residual noise, not a failure: ts-jest prints `TS151002` once per test file, suggesting
`isolatedModules: true` for NodeNext resolution. Fixing it means editing the frozen
`tsconfig.json`, so it was left alone.

### Assumptions baked into the seed

- **Fixed UUIDs for every row**, including the 54 progress records
  (`d7000000-0000-4000-8000-…`). `upsert` cannot be idempotent if the database generates
  the ids, so they are computed from indices.
- **Scores** are `45 + studentIndex*4 + skillIndex*2 + roundIndex*11`, giving 45–85 —
  inside the doc's 40–95 band, deterministic, and strictly rising across the three
  assessment rounds.
- `summaries`, `recommendations` and `email_notifications` are seeded **empty**; the app
  generates those on demand.

### Not exercised

`npm run seed` has never been executed — there are no credentials in this environment, so
it would only have reached its missing-variable guard. The guard typechecks but is
unproven at runtime. Watch for surprises the first time it runs for real.

## What the orchestrator must do next

1. **Check the hosted Supabase for a pre-existing `insight` schema** left by the old
   backend on `main`. Decide whether to coordinate with it or drop it — do this before
   applying anything.
2. **Apply `db/migrations/0001_insight_schema.sql`** in Dashboard → SQL Editor, then
   record the date and filename in the Applied table in `db/migrations/README.md`.
3. **Expose the schema**: Dashboard → Settings → API → Exposed schemas → add `insight`.
   Without this every query fails even though the tables exist.
4. **Fill `backend/.env`** (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` at minimum).
5. **Seed**: `npm run seed`. Set `SEED_AUTH_USER_ID` to the demo login's auth user id
   first if the parent should be linked to a real account — otherwise the parent is
   seeded with `auth_user_id = null` and the script logs that it did so. Re-running after
   setting it will link them.

## What downstream phases can rely on

- Repos throw `Error('db: …')` on any supabase-js error — the error middleware turns that
  into a 500, which is right for infrastructure failures. Repos never throw `ApiError`;
  translating "no rows" into a 404 is the service layer's job.
- One-or-none reads return `null`, never throw: `byAuthUserId`, `byId`, `latestByStudent`,
  `byParentId`, `latestCreatedAt`, `lastSentAt`.
- `listByParent` returns `[]` for a parent with no linked students — it does not throw.
- Dates stay strings end to end. `Student.dateOfBirth` and `ProgressRecord.date` are bare
  `'YYYY-MM-DD'`; timestamps are ISO 8601 as Postgres returned them. No mapper constructs
  a `Date`, and none should.
- `progressRepo.latestCreatedAt` is insertion time (`created_at`), deliberately distinct
  from `ProgressRecord.date` — it is what summary-staleness checks compare against.
