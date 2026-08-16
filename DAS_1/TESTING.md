# Testing

40 unit cases (UT-01–40) and 25 integration cases (IT-01–25), plus a proxy
contract test that pins the gateway prefix. Methodology follows the course's
decomposition-based approach (see the [50.003 course
handout](https://sutd50003.github.io/notes/l1_course_handout/)) — tests walk
the real import/call graph bottom-up, except for the two leaves that cross a
network boundary (`claudeService.ts`, `db.ts`), which are stubbed top-down so
the suite stays fast, deterministic, and free of live credentials.

All test files live under `tests/` in each package — never next to source —
so `src`/`models`/`controllers` stay test-free.

## Routing note

The backend mounts `screenerRoutes.ts` at the root: it answers on `/ping`,
`/sessions`, `/sessions/:id/messages` and so on. The public gateway owns the
`/api/screening` prefix and strips it before forwarding, so Supertest cases hit
bare paths while browser-side cases (MSW handlers, `screenerApi.ts`) use the
prefixed ones.

## Layout

```
backend/tests/
  setup/env.ts          # per-test-file temp SESSIONS_FILE + dummy DB_*/SUPA_* vars
  unit/
    screeningSession.test.ts       # UT-01..UT-16 — core domain rules
    sessionSummaries.test.ts       # UT-18..UT-23 — notes, transcript, checklist summary
    screeningSessionEdges.test.ts  # UT-24..UT-31 — boundary/equivalence cases
  integration/          # Supertest against app.ts
    sessionRepository.test.ts      # IT-01 — save/read round trip over the real file store
    messages.test.ts               # IT-02, IT-03
    report.test.ts                 # IT-04
    responses.test.ts              # IT-05
    contact.test.ts                # IT-06, IT-07
                                   # IT-06 (real MySQL) is skipped unless RUN_DB_INTEGRATION_TESTS=1
                                   # points real DB_HOST/DB_USER/DB_PASSWORD/DB_NAME at a disposable schema
    errors.test.ts                 # IT-08, IT-09
    ping.test.ts                   # IT-13 — router mount + gateway prefix is not served here
    notes.test.ts                  # IT-14
    stageGuards.test.ts            # IT-15..IT-17 — completed-session and bad-payload guards
    serviceFailures.test.ts        # IT-18, IT-19 — the failure half of the Claude boundary
    fileStore.test.ts              # IT-20..IT-22 — concurrent writes keep every record
    happyPath.test.ts              # IT-23 — the whole child journey across five endpoints
    publicProxyContract.test.ts    # starts the root Vite proxy and proves /api/screening
                                   # is stripped before the public backend receives it

demo_app/tests/
  setup.ts, mocks/       # MSW server + baseline handlers
  unit/
    ChatView.test.tsx              # UT-17
    TrueFalse.test.tsx             # UT-32..UT-34
    ContactFormView.test.tsx       # UT-35, UT-36
    ChecklistView.test.tsx         # UT-37, UT-38
    chatViewGreeting.test.tsx      # UT-39, UT-40
  integration/
    screenerApi.realServer.test.ts # IT-10 — screenerApi.ts vs. a real Express app, no mocks
    screenerPage.test.tsx          # IT-11, IT-12 — ScreenerPage + hook, MSW-mocked network
    reportToContact.test.tsx       # IT-24 — report → contact, the second half of the journey
    screenerApiErrors.test.ts      # IT-25 — post() against non-JSON/empty error bodies
```

## Running

```
npm test                      # from repo root: backend, then demo_app
npm test --prefix backend      # backend only (Vitest + Supertest)
npm test --prefix demo_app     # demo_app only (Vitest + React Testing Library + MSW)
npm run test:coverage --prefix backend   # coverage report for screeningSession.ts
```

`publicProxyContract.test.ts` boots the repo-root `frontend/vite.config.ts`, so
run `npm install` in `frontend/` once before the backend suite or that one file
fails to load its config.

Each backend test file gets its own throwaway `SESSIONS_FILE` (a temp path,
never `backend/data/sessions.json`), so the suite is safe to run repeatedly
and in parallel. `claudeService.ts` is stubbed per-file with `vi.mock`, so
`VITE_ANTHROPIC_API_KEY` is only needed for live Claude calls — the suite does
not require it.

## AI response testing

`ai_testing/` holds an offline LLM-as-judge harness, run by hand rather than as
part of `npm test`. `ai_tester.ipynb` reads saved session JSON from one of the
scenario folders (`full_responses/`, `partial_responses/`, `garbage_inputs/`),
sends the transcript plus the generated report to Gemini alongside that folder's
`expected.txt`, and appends a score out of 10 with a reason to `results.txt`.
Evaluated files are marked with an `evaluated` key so a re-run skips them.

```
pip install -r ai_testing/requirements.txt
# API_KEY=<gemini key> in ai_testing/.env, then run the notebook
```
