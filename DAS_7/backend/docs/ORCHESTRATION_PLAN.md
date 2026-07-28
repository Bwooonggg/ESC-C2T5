# Orchestration Plan — DAS 7 Backend Implementation

> **Audience: the orchestrator (you).** This is the run-book for executing the seven phase plans in `docs/PHASE_*.md` with parallel workers. Architecture reference: `docs/ARCHITECTURE.md`.

## The model

- Work is split into **waves**. Every phase inside a wave can run **fully in parallel** — the phase docs define disjoint file-ownership sets, and all cross-phase contracts were frozen in Phase 1.
- Give each worker exactly: its own `PHASE_N_*.md` (required) + `ARCHITECTURE.md` (optional background). A worker must not need — and must not touch — anything else. Suggested worker brief:
  > *"Implement Phase N of the DAS 7 backend by following `backend/docs/PHASE_N_<name>.md` exactly. Only create/modify the files listed under 'Files you own'. Do not add dependencies or edit package.json. If the plan seems wrong or something you need is missing, stop and report instead of improvising outside your file list."*
- **Isolation between simultaneous workers:** if workers share one checkout they will trample each other's `npm test` runs even without file conflicts. Preferred: one **git worktree/branch per phase** (`git worktree add ../das7-p4 -b phase-4 DAS7_backend_v2`), merged after the wave — merges will be conflict-free by construction (disjoint files). Acceptable fallback: run the wave's workers sequentially in one checkout; correctness is unaffected, only wall-clock.
- **`backend/CLAUDE.md` is gitignored on purpose** (it holds the worker rules but stays out of the repo). It therefore does NOT appear in fresh worktrees — after creating each worktree, copy it in yourself: `cp DAS_7/backend/CLAUDE.md ../das7-p4/DAS_7/backend/CLAUDE.md`. Skipping this silently strips every guardrail from that worker.
- **Gate** at the end of each wave before starting the next: review diffs, run checks, commit/merge. Nothing in Wave N+1 starts until the gate passes.

## Phase → wave map

| Wave | Phase | Doc | Files it owns (summary) | Depends on |
|---|---|---|---|---|
| 1 | P1 Scaffold & contracts | `PHASE_1_SCAFFOLD.md` | package/tsconfig/jest, `src/{types,errors,config,deps,app}.ts`, http plumbing, route stubs, adapter interfaces, harness placeholder | — |
| 2 | P2 Database & repos | `PHASE_2_DATABASE.md` | `db/migrations/*`, `src/repos/*`, `scripts/seed.ts` | P1 |
| 2 | P3 Auth & /me | `PHASE_3_AUTH.md` | `src/http/auth.ts` (rewrite), `me.routes.ts`, auth tests, `test-auth.ts` | P1 |
| 2 | P4 LLM + insights | `PHASE_4_INSIGHTS.md` | `stub-llm.ts`, `insight.service.ts`, `students.routes.ts`, IT7A tests | P1 |
| 2 | P5 Preferences | `PHASE_5_PREFERENCES.md` | `preference.service.ts`, `preferences.routes.ts`, tests | P1 |
| 2 | P6 Email + notifier | `PHASE_6_NOTIFICATIONS.md` | email adapters, `notifier.service.ts`, `scheduler.ts`, IT7B tests | P1 |
| 3 | P7 Composition & integration | `PHASE_7_INTEGRATION.md` | `src/index.ts`, real harness, Dockerfile, README; may fix drift anywhere | P1–P6 + human checkpoint H2 |

Integration tests written in Wave 2 **compile but self-skip** (env guard) — they first actually run in Wave 3. That's by design; don't be alarmed by "skipped" suites at the Wave 2 gates.

## Wave 0 — human prep (yours; start immediately, runs alongside Waves 1–2, must finish before Wave 3)

- [ ] **H0.1 Supabase project & keys.** Decide which Supabase project is the test/dev target (strongly consider a project that is *not* the team demo one). Collect: project URL, `service_role` key, `anon` key, project ref.
- [ ] **H0.2 Old schema check.** Look for an existing `insight` schema from the `main`-branch backend (Dashboard → Database → Schemas). If present, agree with the team whether to drop it or let the idempotent migration coexist. Don't drop anything unilaterally — other subsystems share this instance.
- [ ] **H0.3 JWT signing mode.** Dashboard → Settings → JWT/signing keys: if the project uses **legacy HS256**, copy the JWT secret (→ `SUPABASE_JWT_SECRET`); if migrated to asymmetric signing keys, leave that variable blank (the backend verifies via JWKS). Migrating to signing keys is recommended if the team agrees.
- [ ] **H0.4 Test users.** Supabase Auth → create two users (e.g. `das7.test.a@…` / `das7.test.b@…`) with passwords, auto-confirm them. Record for `.env` (`TEST_USER_A_*`, `TEST_USER_B_*`).
- [ ] **H0.5 Resend.** Create a Resend account + API key. For a student project without a verified domain, use `onboarding@resend.dev` as `EMAIL_FROM` (Resend then only delivers to your own account email — fine for the demo; note it). Not blocking: `EMAIL_PROVIDER=fake` works everywhere except the live-email demo.

## Wave 1 — P1 alone (single worker)

Everything else compiles against P1's frozen contracts, so nothing may run concurrently with it.

**Gate G1:**
- [ ] `npm install && npm run typecheck && npm test` — green (error-handler suite).
- [ ] Spot-check `src/deps.ts`, `src/types.ts`, `src/http/auth.ts` helper signatures, and `test/helpers/harness.ts` against the verbatim blocks in `PHASE_1_SCAFFOLD.md` — **these are the contracts five workers are about to build against; a drift here costs a wave.**
- [ ] Commit (e.g. `feat(DAS7 backend-v2): phase 1 scaffold and contracts`).

## Wave 2 — P2 ∥ P3 ∥ P4 ∥ P5 ∥ P6 (up to five workers)

Launch all five with the standard brief. Conflict rules already embedded in the docs: nobody edits `package.json`, `deps.ts`, or another phase's files; unit tests use in-file fakes; integration tests use only the frozen harness API.

**Per-phase acceptance (as each worker finishes):**
- [ ] `npm run typecheck && npm test` green in that worker's tree (its unit suites pass; integration suites skipped).
- [ ] Diff touches only the phase's owned files.

**Gate G2 (after merging all five):**
- [ ] Merge the five branches (any order; conflicts indicate a worker broke ownership — reject and fix, don't hand-resolve silently).
- [ ] On the merged tree: `npm run typecheck && npm test` — all unit suites green together.
- [ ] Commit/merge (e.g. one merge commit per phase, or squash per phase: `feat(DAS7 backend-v2): phase N <name>`).

**Human checkpoint H2 (needs P2 merged + H0.1/H0.2; do while other Wave-2 workers finish):**
- [ ] H2.1 Run `db/migrations/0001_insight_schema.sql` in the Supabase SQL editor.
- [ ] H2.2 Add `insight` to Exposed schemas (Dashboard → Settings → API).
- [ ] H2.3 Create `backend/.env` from `.env.example`; fill Supabase URL/keys, `TEST_SUPABASE_REF`, test users (H0.4), `SUPABASE_JWT_SECRET` per H0.3, `EMAIL_PROVIDER=fake` for now.
- [ ] H2.4 `npm run seed` (optionally with `SEED_AUTH_USER_ID=<a real auth user id>` if you want the demo parent reachable via dev fallback / a real login later). Verify rows in the Table editor.

## Wave 3 — P7 alone (single worker; H2 must be complete)

The integrator wires `index.ts`, implements the harness, runs the full suite against the live test project, and fixes cross-phase drift (it has explicit permission to touch anything — review its reported fix list with extra care).

**Gate G3:**
- [ ] Full `npm test` green **with** integration env — every IT7A-01…09 / IT7B-01…06 case passing.
- [ ] `npm run build` clean; Dockerfile builds (or a noted reason it wasn't attempted).
- [ ] Read the worker's drift report; sanity-check any change it made to Wave-2 files.
- [ ] Commit.

## Wave 4 — demo verification (human, optional worker assist)

- [ ] **H4.1 Frontend build config is missing on this branch** (deleted from the working tree; sources in `frontend/src` survive). Restore it before any end-to-end check: `git checkout main -- DAS_7/frontend` (or from `HEAD`), then `npm install` in `frontend/`.
- [ ] H4.2 End-to-end dev run: backend `npm run dev` with `AUTH_DEV_SUB` set to the seeded parent's auth user id; frontend `npm run dev` (Vite proxies `/api` → 4000). Check: students appear, chart renders 6 skill areas, summary text shows, recommendation button returns lines, no console errors.
- [ ] H4.3 Live email demo (optional): `EMAIL_PROVIDER=resend`, `RESEND_API_KEY`, `EMAIL_FROM` per H0.5, `SCHEDULER_ENABLED=true`, `SCHEDULER_TICK_MS=15000`, `NOTIFY_WEEKLY_MS=60000`, seeded preference enabled → expect a real email within ~1 min; verify an `email_notifications` row.
- [ ] H4.4 Team review → PR/merge of `DAS7_backend_v2` per team workflow; decide jointly what happens to `main`'s old backend.

## If something goes wrong

- **A Wave-2 worker needs a contract change** (missing repo method, wrong signature): stop that worker, change the contract **yourself** in P1's files on the base branch, rebase/notify the other workers, resume. Never let a worker edit `deps.ts` unilaterally.
- **A worker needs a new dependency:** it must report back instead of editing `package.json`. Add it on the base branch if justified.
- **Integration tests reveal a phase implemented its doc wrong:** P7 fixes it (that's its mandate). If the *doc* was wrong, fix the doc too — the docs are the spec of record.
- **Supabase schema drift** (old `insight` tables conflict): coordinate with the team; worst case, point `.env` at a fresh personal Supabase project — nothing in the code assumes the shared instance.
