# Phase 7 — Composition Root, Test Harness & Full Integration

> **Wave 3 · single worker · depends on ALL of Phases 1–6 being merged, and on the human checkpoint (live schema, seeded data, filled `.env`, test users).**
> You are the integrator: you write the entrypoint that wires everything together, implement the test harness whose frozen API five suites already compile against, run the **entire** test suite against the live test Supabase, and fix whatever drift the parallel phases produced.

## Special permission

Unlike Wave 2 phases, you **may modify any file in `backend/`** to resolve integration mismatches (type errors between phases, wrong import paths, subtly mismatched behavior vs the phase docs). Rules: keep changes minimal and behavior-preserving with respect to the phase docs (`PHASE_2`–`PHASE_6`); when a unit test and its phase doc disagree, the phase doc wins; log every cross-phase fix you make in your final report.

## Files you create

```
backend/src/index.ts
backend/Dockerfile
backend/test/helpers/harness.ts        # REPLACE the Phase 1 placeholder; keep the exported API exactly
backend/README.md                      # update: quickstart, test guide, service_role/RLS note
```

## Step 1 — `src/index.ts` (composition root)

```ts
import 'dotenv/config';
```

then:

1. `const config = loadConfig();`
2. `const client = createDbClient(config);` (from `src/repos/db.ts`).
3. Build all repos via their factories (`createParentRepo(client)`, …).
4. **LLM factory (this is the provider slot):** `config.llmProvider === 'stub'` → `new StubLlmClient()`; any other value → `throw new Error(\`LLM provider '${...}' not implemented — see docs/ARCHITECTURE.md §10.1\`)`.
5. **Email factory:** `'resend'` → `createResendEmailProvider({ apiKey, from })` (fail fast if `resendApiKey`/`emailFrom` missing); `'fake'` → `new FakeEmailProvider()` (log a warning that emails are not really sent).
6. Build services: `createInsightService(...)`, `createPreferenceService(...)`, `createNotifierService(...)` — assemble the full `Deps` object.
7. `createApp(deps).listen(config.port, '0.0.0.0')` with a startup log line (port, schema, llm provider, email provider, scheduler on/off).
8. If `config.schedulerEnabled`: `createScheduler(now => deps.notifierService.runDueNotifications(now), config.schedulerTickMs).start()`.
9. `SIGINT`/`SIGTERM` handlers: stop the scheduler, `server.close()`, exit.

## Step 2 — `test/helpers/harness.ts` (real implementation)

Replace the placeholder **without changing any exported name or type** — `integrationConfigured()`, `describeIntegration`, `createHarness()`, `TestHarness`, `LlmControl`, `FakeEmailControl` (see the placeholder for the exact shapes; five integration suites already import them).

`createHarness()`:

1. Guard: throw a descriptive error if `integrationConfigured()` is false (suites are already skipped in that case; the throw is belt-and-braces).
2. `config = loadConfig()` but **force**: `authDevSub: null` (auth tests need the fallback off), `emailProvider` ignored (you inject the fake), `notifyIntervalsMs` as configured.
3. Real client + real repos exactly as `index.ts` does.
4. **Controllable LLM** — a wrapper implementing `LlmClient` + `LlmControl` around a real `StubLlmClient`:
   `mode: 'ok' | 'fail'`, `summaryCalls`/`recommendationCalls` counters, `reset()`; `'fail'` → throw `LlmUnavailableError` before delegating.
5. `email = new FakeEmailProvider()` (Phase 6) — satisfies `FakeEmailControl` (`history`, `mode`).
6. Build the three services and the full `Deps` with the controllable llm + fake email; `app = createApp(deps)`.
7. **Fixtures** (all ids from `crypto.randomUUID()`, tracked for cleanup):
   - Sign in test users with `signInTestUser` (Phase 3, `test/helpers/test-auth.ts`) using `TEST_USER_A_*` / `TEST_USER_B_*` env → `tokenA`/`tokenB` + their `authUserId`s.
   - Insert `parentA` (with `auth_user_id` = user A's id), `parentB` (user B's id) — **via the supabase client directly** (repos are read-only for parents by design).
   - Insert `studentA1` + guardianship + ~6 progress records (2 skill areas × 3 dates is enough); `studentA2` + guardianship, no progress; `studentB1` + guardianship, no progress.
8. `createParent()` — insert a parent row (`auth_user_id: null`), register id, return mapped `Parent` (empty `studentIds`).
   `createStudent({ parentId, withProgress })` — insert student + `parent_students` link (+ 6 progress rows when `withProgress`), register id, return `Student`.
9. `cleanup()` — delete (client direct, in this order is enough given cascades): all tracked **parents**, then all tracked **students** (`.in('parent_id' | 'student_id', ids)`). Cascades remove links, progress, summaries, recommendations, preferences, email notifications. Idempotent, safe to call in `afterAll` even if setup half-failed.

Keep the harness free of `jest` APIs except the already-exported `describeIntegration` (so `tsx` could import it too).

## Step 3 — `Dockerfile`

Two-stage `node:20-alpine`: `npm ci` + `npm run build` in the builder; runtime stage copies `dist/` + production `node_modules` (`npm ci --omit=dev`), sets `NODE_ENV=production`, `EXPOSE 4000`, `CMD ["node", "dist/index.js"]`. The service must listen on `0.0.0.0` (Traefik). Do not bake any env values in.

## Step 4 — run everything and fix drift

1. `npm run typecheck` — expect and fix cross-phase type mismatches first.
2. `npm test` with integration env **unset**: all unit suites green, integration suites skipped.
3. With the human-provided `.env` (live test project): `npm test` — all suites green, including every IT7A/IT7B case. Typical drift to look for: envelope shape deviations, error-message strings, date formats leaking as ISO datetimes into `date` fields, snake/camel mapping slips, `maybeSingle` vs `single` misuse, JWKS vs HS256 config.
4. Smoke the real thing: `npm run dev` with `AUTH_DEV_SUB=<seed parent's auth_user_id>`… (requires the human to have run `npm run seed` with `SEED_AUTH_USER_ID`) — `curl localhost:4000/api/health`, `/api/me`, one track-progress round trip.

## Step 5 — `backend/README.md`

Rewrite with: what the service is (2 sentences), quickstart (install → `.env` from example → seed → dev), test guide (unit vs integration, the `TEST_SUPABASE_REF` guard, how test users are provisioned), a pointer to `docs/ARCHITECTURE.md`, and an explicit short section "**Database access: service_role now, RLS later**" summarizing ARCHITECTURE §6.1 (the team asked for this decision to stay visible).

## Done criteria

- Full `npm test` green against the live test project — all IT7A-01…09 and IT7B-01…06 assertions pass in their suites.
- `npm run build` clean; `docker build` succeeds (if Docker is available on the machine; otherwise note it).
- `README.md` updated; every cross-phase fix listed in your report.
