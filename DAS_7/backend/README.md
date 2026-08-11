# DAS 7 Backend — Parent Insight Dashboard

An Express + TypeScript API that lets a parent see their child's reading-progress
records, an AI-written summary of them, and follow-up suggestions for home. It also
runs an in-process timer that emails opted-in parents a progress update on their
chosen schedule.

Design background — data model, error semantics, decisions and their reasons —
lives in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Quickstart

```bash
npm install
```

Copy the environment template and fill it in:

```bash
cp .env.example .env
```

The only two required values are `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`;
everything else has a working default (`LLM_PROVIDER=stub`, `EMAIL_PROVIDER=fake`,
scheduler off). Apply `../../db/migrations/*.sql` through the Supabase dashboard, then
load the demo dataset:

```bash
npm run seed
```

Set `SEED_AUTH_USER_ID` to the Supabase Auth user id of your demo login before
seeding. Parent profiles require a matching Auth user.

```bash
npm run dev
```

The API runs directly on the host at `http://localhost:4000`. The root Vite dev
server is the sole browser-facing proxy and forwards `/api/insights` to that port
after stripping the prefix, so the browser stays on one origin.

Other scripts: `npm run typecheck`, `npm run build`, `npm start` (runs `dist/`),
`npm test`.

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/health` | liveness; the only unauthenticated route |
| `GET` | `/me` | the signed-in parent and their students |
| `GET` | `/students/:studentId/track-progress` | progress records + summary |
| `GET` | `/students/:studentId/summary` | the summary alone |
| `POST` | `/students/:studentId/recommendations` | suggestions from the stored summary |
| `GET`/`PUT` | `/parents/:parentId/preferences` | notification preferences |

These are internal service paths. Browser callers prepend `/api/insights`; the
root Vite proxy strips that prefix before forwarding to the host process on port
`4000`.

Every response uses one envelope: `{ ok: true, data }` or `{ ok: false, error }`.

## Tests

```bash
npm test
```

**Unit suites** (`test/unit/`) run entirely offline — no database, no network. They
use in-file fakes and never import `src/repos/`.

**Integration suites** (`test/integration/`) run the real app against a real Supabase
project: real repositories, real routes, real JWT verification. Exactly two boundaries
are faked — the LLM client and the email provider — so the tests are deterministic
without weakening the parts under test. `test/helpers/harness.ts` builds that app,
creates its own parents, students and progress rows with fresh UUIDs, and deletes
them again in `afterAll`.

**They are not fully isolated, by design.** The notifier suite calls
`runDueNotifications`, which sweeps *every* enabled preference in the project — not
just the harness's own. So a run will generate summaries and `email_notifications`
rows for the seeded demo parent, and for anyone else whose preference is enabled.
That is what the test is for, and it asserts by recipient address rather than by
row count so the extra work is harmless. Worth knowing before you look at the seed
data afterwards and wonder what touched it.

**The `TEST_SUPABASE_REF` guard.** Integration suites skip themselves unless
`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` and `TEST_SUPABASE_REF` are all set *and*
`SUPABASE_URL` contains `TEST_SUPABASE_REF`. That last condition is the point: it makes
running the suites against the wrong project take a deliberate act. `npm test` with the
variables unset is a normal, fully green run with the integration suites reported as
skipped. Do not weaken this guard.

**Test users.** The two integration parents are backed by real Supabase Auth users,
created by hand in the dashboard and referenced through `TEST_USER_A_EMAIL` /
`TEST_USER_A_PASSWORD` and the `_B_` pair. The harness signs them in with the anon key
(`SUPABASE_ANON_KEY`) and uses the resulting access tokens, so tests exercise the same
verification path a browser would. Nothing in the test code ever creates an auth user.

Jest runs with `maxWorkers: 1`: the integration suites share one project and one pair of
test users, and `insight.parents.auth_user_id` is unique, so only one harness can exist
at a time.

## Database access: service_role now, RLS later

The backend connects to Supabase with the **`service_role` key**, scoped to the
`insight` schema. That key **bypasses Row Level Security entirely**, so *every*
authorization decision is made in backend code — `requireOwnStudent` and
`requireOwnParent` on each data route are not belt-and-braces, they are the only thing
standing between one parent and another's data. The key must never reach the frontend
and never enter git.

This was a deliberate call (ARCHITECTURE §6.1, 2026-07-28): only this backend touches
the `insight` tables, so RLS policies would be design and maintenance work for a second
line of defense nothing else needs yet.

The migration path is recorded so it stays a choice rather than an accident. If the trust
model changes — the frontend starts querying Supabase directly, or defense-in-depth is
wanted — switch the repositories to a per-request client built from the anon key plus the
caller's JWT, add owner-check policies per table, grant `authenticated` what it needs, and
keep `service_role` only where no user is in context (the scheduler and the seed script).
The code-level `requireOwn*` checks stay either way; RLS would become the second layer,
not a replacement.

## Runtime

DAS7 runs directly on the host, not in the DAS3 Docker stack. Use `npm run dev` for
development, or `npm run build` followed by `npm start`, and keep it on port `4000`
for the root Vite proxy.

Node 22 or newer is required at runtime: `@supabase/supabase-js` needs a native
`WebSocket`, which Node 20 does not provide.
