# Phase 7 Handoff — Composition Root, Test Harness & Full Integration

**Status:** complete. `npm run typecheck` clean; `npm run build` clean; `npm test` against the
live test project → **14 suites / 134 tests passing, 0 failed, 0 skipped** (run twice, stable).
With integration env unset → 9 suites passing, 5 skipped, 26 tests skipped, as designed.
`docker build` succeeds and the resulting container serves `/api/health`. The Step 4.4 smoke test
against the running service passes end to end (see below).

## What shipped

| File | What it is |
| --- | --- |
| `src/index.ts` | new — composition root. Config → client → repos → adapters → services → `Deps` → `createApp().listen()`, plus the scheduler and signal handlers. |
| `test/helpers/harness.ts` | placeholder replaced with the real implementation. Every exported name and type is unchanged. |
| `Dockerfile` | new — two-stage build, `dist/` + production `node_modules` only. |
| `.dockerignore` | new — keeps `node_modules/`, `dist/` and `.env` out of the build context. |
| `README.md` | rewritten. The old one described the retired MySQL-era backend, including three doc links that no longer exist. |
| `jest.config.cjs` | `maxWorkers: 1`, `testTimeout: 60000` — see the fix log below. |
| `test/integration/notifier.int.test.ts` | IT7B-06 only: the sweep the timer starts is now awaited. |
| `.env.example` | `SEED_AUTH_USER_ID` added — read by `scripts/seed.ts`, never documented. |

## The composition root

Built once, at module scope, in this order: `loadConfig()` → `createDbClient` → the seven repos →
LLM + email → `insightService`, `preferenceService`, `notifierService` → `Deps` → `createApp`.

- **LLM factory** — `'stub'` returns `StubLlmClient`; every other value throws
  ``LLM provider '<x>' not implemented — see docs/ARCHITECTURE.md §10.1``. This is the seam a real
  provider slots into: one new file plus one case.
- **Email factory** — `'resend'` requires `RESEND_API_KEY` and `EMAIL_FROM`, and names whichever is
  missing in the startup error rather than failing on the first send hours later. `'fake'` logs a
  warning that mail is recorded in memory, not delivered.
- **Startup log** — one line: `[das7] listening on http://0.0.0.0:4000 — schema=insight, llm=stub,
  email=fake, scheduler=off`. Binds `0.0.0.0`, not localhost, so Traefik can reach it.
- **Shutdown** — `SIGINT`/`SIGTERM` stop the scheduler, then `server.close()`, then exit. Verified
  in the container: `docker stop` returns in 0.67s, not at the 10s SIGKILL fallback.

## The harness

Real app, real repos, real routes, real JWT verification against the live JWKS. Exactly two
boundaries are faked, as the test plan requires.

- **Config is forced**, not trusted: `authDevSub: null` (otherwise `.env`'s dev fallback would let
  the auth suite's unauthenticated requests through as a real parent) and `emailProvider: 'fake'`
  so `deps.config` matches the provider actually injected. `notifyIntervalsMs` is left as configured.
- **`ControllableLlmClient`** wraps a real `StubLlmClient`. Counters increment on entry, so they
  count *attempted* generations including failing ones; `mode: 'fail'` throws `LlmUnavailableError`
  before delegating, which is what the insight service maps to 503.
- **Fixtures**: parents A and B carry the two test users' `auth_user_id`s; studentA1 gets progress
  (2 skill areas × 3 dates, rising scores so the stub reports an improvement), studentA2 and
  studentB1 get none. All ids from `crypto.randomUUID()`, all inserts through the supabase client
  directly — `ParentRepo` is read-only by design.
- **`cleanup()`** deletes tracked parents then tracked students and clears both id lists, so it is
  idempotent and safe in `afterAll` even if setup failed halfway. Cascades take the links, progress,
  summaries, recommendations, preferences and email notifications.
- No `jest` API is used beyond the pre-existing `describeIntegration`, so `tsx` can import the file.

### One addition beyond the phase doc

`insight.parents.auth_user_id` is `UNIQUE`, so a run that dies before `afterAll` leaves a parent row
squatting on a test user's id and every later run fails to insert. Setup now clears that row — **but
only if its `name` is the harness's own marker string**. Any other row and it throws a message
naming the parent id and telling you to point `TEST_USER_*` at dedicated test users. It will never
delete a row it did not write, including the seeded demo parent.

## Cross-phase fixes

Six changes outside this phase's "files you create" list, all under the Special-permission mandate.
**No `src/` file from Phases 2–6 needed changing** — the drift was entirely in test infrastructure,
the base image this phase doc itself prescribed, and one undocumented environment variable. The same
list is logged in `PHASE_7_INTEGRATION.md`.

1. **`jest.config.cjs` — `maxWorkers: 1`.** Each of the five integration suites builds a harness that
   inserts a parent carrying a test user's `auth_user_id`, and that column is `UNIQUE`. Under Jest's
   default parallelism they raced: the second harness to start hit a unique violation, and one
   suite's cleanup deleted fixtures another was still using. Serial execution is the precondition
   these suites were written against, so it now lives in the config rather than in a reader's head.
2. **`jest.config.cjs` — `testTimeout: 60000`.** Only `preferences.int.test.ts` passed an explicit
   60s timeout to its hooks; the other four relied on Jest's 5s default while doing sign-ins and
   multi-round-trip Supabase work. The notifier sweep alone exceeds 5s. The default was timing out
   on latency, not on a real failure.
3. **`test/integration/notifier.int.test.ts` (IT7B-06).** Phase 6's handoff called this exact case a
   Wave-3 watch-item, and it did fail. `jest.advanceTimersByTimeAsync(1000)` fires the interval and
   yields the event loop a couple of times; it cannot complete a sweep made of real network calls.
   The assertion ran mid-sweep — visible as `[notifier]` logs still arriving after teardown, and as
   errors from cleanup deleting rows the sweep was midway through reading. The scheduler callback now
   hands its promise back to the test, which awaits it before asserting. Phase 6 suggested dropping
   the timer and calling `runDueNotifications` directly; keeping the timer costs three lines and
   preserves what IT7B-06 is actually for — proving a *tick* drives the sweep.
4. **`Dockerfile` — `node:22-alpine`, not the `node:20-alpine` Step 3 specifies.** A Node 20 image
   builds fine and then dies on startup: `@supabase/supabase-js` reaches for a native `WebSocket` at
   `createClient()` and throws `Node.js detected but native WebSocket not found`. Verified by
   building and running both. Node 20 is also past end-of-life as of April 2026.
5. **`.dockerignore` added** — an unlisted file, but without it the whole `node_modules/` tree and
   `.env` go into the build context.
6. **`.env.example` — `SEED_AUTH_USER_ID` documented.** `scripts/seed.ts` has read it since Phase 2,
   but the template never listed it, so the single variable deciding whether the seeded demo parent
   is reachable by a login was discoverable only by reading the seed script. That is exactly why
   Step 4.4's smoke test came up 401. Audited both directions afterwards: all 27 variables the code
   reads are now documented, and every documented variable is read by something.

## Step 4.4 — smoke test against the running service

Ran against `npm run dev` with the demo parent seeded and `AUTH_DEV_SUB` set to the same auth user
id, using the tokenless dev fallback:

| Check | Result |
|---|---|
| `GET /api/health` | `{"ok":true,"data":{"ok":true}}` |
| `GET /api/me` | the seeded parent + all three students |
| `GET /api/students/:id/track-progress` | 18 records, dates ascending, summary generated |
| same call again | identical `summaryId` — the stored summary is reused, no second generation |
| `GET /api/students/:id/summary` | same `summaryId` as track-progress served |
| `POST /api/students/:id/recommendations` | keyed to that `summaryId`, `\n`-joined lines |

Worth recording because Step 4 named them as the drift to watch for: `date` comes back as bare
`YYYY-MM-DD` (no ISO datetime leak), `generatedAt` is a full ISO 8601 timestamp, records arrive
date-ascending, and the snake→camel mapping is clean across every field.

This initially failed with a 401 on every authenticated route: `AUTH_DEV_SUB` resolved to no parent
row because the seed had never been run with a matching `SEED_AUTH_USER_ID` — a variable missing
from `.env.example` altogether (fix 6), which is the likeliest reason it was never set. Seeding with
it set resolved it.

## Open items for the orchestrator

- **Keep the demo login separate from the two integration auth users.** `AUTH_DEV_SUB` /
  `SEED_AUTH_USER_ID` should point at a third auth user, not at `TEST_USER_A` or `TEST_USER_B`. The
  harness creates and deletes parent rows for those two on every run, and if it finds one of their
  ids already mapped to a parent it did not create, it refuses to run rather than delete someone
  else's row. Only the demo user's *id* is ever needed — no email/password pair, because nothing in
  the backend signs it in.
- **Integration runs write outside their own fixtures.** `runDueNotifications` sweeps *every* enabled
  preference in the shared test project, so IT7B-06 will generate summaries and `email_notifications`
  rows for the seeded demo parent (and anyone else's enabled preference). Phase 6 flagged this as
  intentional and the test asserts by recipient address rather than history length. Worth knowing
  before you look at the seed data after a test run and wonder what touched it.
- **`ts-jest` prints a `TS151002` warning per test file** — hybrid module kind wants
  `isolatedModules: true` in `tsconfig.json`. Noise only; tsconfig is a frozen contract file, so I
  left it. One line if you want it silenced.
- **My local environment, for reproducibility:** Node v24.8.0, Docker 29.6.1. I started Docker
  Desktop (it was not running) and left a local image tagged `das7-backend:phase7`.

## Assumptions where the doc was silent

- "~6 progress records" for studentA1 → 2 skill areas × 3 dates with rising scores, so the stub
  produces `improved from X to Y` lines that `generateRecommendation` can parse back.
- `LlmControl` counters count attempted calls, including ones that throw in `mode: 'fail'`. No test
  distinguishes the two readings.

## Not done, by design

No dependencies added, removed or updated. No SQL, migrations or schema changes run against the
shared Supabase project. Database writes were limited to the harness's own fixtures, the rows the
sanctioned integration path creates, and — from the Step 4.4 smoke test — one summary and one
recommendation generated on demand for the seeded demo student, which is what that step asks for. No secrets in code, logs or this document. No git operations:
nothing committed, staged, branched or stashed. `docs/ARCHITECTURE.md` was already modified in the
working tree before this phase began and was not touched.
