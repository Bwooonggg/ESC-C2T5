# Testing

Implements the plan in `docs/Test Plans for DAS 1.docx`: 17 unit cases (UT-01–17)
and 12 integration cases (IT-01–12). Methodology follows the course's
decomposition-based approach (see the [50.003 course
handout](https://sutd50003.github.io/notes/l1_course_handout/)) — tests walk
the real import/call graph bottom-up, except for the two leaves that cross a
network boundary (`claudeService.ts`, `db.ts`), which are stubbed top-down so
the suite stays fast, deterministic, and free of live credentials.

All test files live under `tests/` in each package — never next to source —
so `src`/`models`/`controllers` stay test-free.

## Layout

```
backend/tests/
  setup/env.ts          # per-test-file temp SESSIONS_FILE + dummy DB_* vars
  unit/                 # UT-01..UT-16 — screeningSession.ts (pure domain rules)
  integration/          # IT-01..IT-09 — Supertest against app.ts
                         # IT-06 (real MySQL) is skipped unless RUN_DB_INTEGRATION_TESTS=1
                         # points real DB_HOST/DB_USER/DB_PASSWORD/DB_NAME at a disposable schema
                         # publicProxyContract.test.ts starts the root Vite proxy and proves
                         # /api/screening is stripped before the public backend receives it

demo_app/tests/
  setup.ts, mocks/       # MSW server + baseline handlers
  unit/                  # UT-17 — ChatView.tsx
  integration/           # IT-11, IT-12 — ScreenerPage + hook, MSW-mocked network
                          # IT-10 — screenerApi.ts vs. a real Express app, no mocks
```

## Running

```
npm test                      # from repo root: backend, then demo_app
npm test --prefix backend      # backend only (Vitest + Supertest)
npm test --prefix demo_app     # demo_app only (Vitest + React Testing Library + MSW)
npm run test:coverage --prefix backend   # coverage report for screeningSession.ts
```

Each backend test file gets its own throwaway `SESSIONS_FILE` (a temp path,
never `backend/data/sessions.json`), so the suite is safe to run repeatedly
and in parallel. `claudeService.ts` is stubbed per-file with `vi.mock` so no
`VITE_ANTHROPIC_API_KEY` is only needed for live Claude calls; the test suite
stubs them and does not require it.
