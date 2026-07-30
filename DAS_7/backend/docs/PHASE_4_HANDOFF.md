# Phase 4 Handoff — LLM Stub, Insight Service & Student Routes

**Status:** complete. `npm run typecheck` clean; `npm test` green (3 suites / 33 tests passed, 2 integration suites / 10 tests skipped as expected until Wave 3).

## What was built

| File | What it does |
| --- | --- |
| `src/adapters/llm/stub-llm.ts` | `StubLlmClient` — deterministic offline `LlmClient`. No randomness, no clock; neither method throws. |
| `src/services/insight.service.ts` | `createInsightService(...)` — staleness rule, 404/503 error semantics, recommendation flow. |
| `src/http/routes/students.routes.ts` | The three student routes, each gated by `requireOwnStudent`. Replaces the 501 stub. |
| `test/unit/stub-llm.test.ts` | Pins the summary format, determinism, and recommendation selection/fallback. |
| `test/unit/insight-service.test.ts` | In-file repo + llm fakes; covers every IT7A branch offline. |
| `test/integration/track-progress.int.test.ts` | IT7A-01/02/04/05/07. Compiles now, self-skips until Wave 3. |
| `test/integration/recommendations.int.test.ts` | IT7A-03/08/09 + cross-parent authorization. Same. |

Nothing outside the phase doc's ownership list was modified, apart from ticking the Progress checklist in `PHASE_4_INSIGHTS.md` and adding this handoff file at the orchestrator's request.

## Behaviour worth knowing

**Summary staleness.** `getSummary` regenerates only when `progressRepo.latestCreatedAt(studentId)` is newer than the stored summary's `generatedAt`. A `null` `latestCreatedAt` counts as *not stale*, so a stored summary is reused. A second identical request therefore costs zero LLM calls.

**Error semantics (the IT7A heart).**

| Situation | Result |
| --- | --- |
| Student not found | 404 `progressUnavailable` |
| Student exists, no progress rows | 503 `progressUnavailable` (IT7A-05) |
| Summary generation throws | 503 `summaryUnavailable`, **nothing stored** (IT7A-07) |
| Recommendation requested, no summary ever generated | 404 `summaryUnavailable` — not 503 (IT7A-08) |
| Recommendation generation throws | 503 `recommendationUnavailable`, **nothing stored** (IT7A-09) |
| Student belongs to another parent | 404 `progressUnavailable`, from `requireOwnStudent` |

"Nothing stored" is guaranteed by ordering: the `insert` call sits after the `try/catch` around the LLM call, so a failed generation never reaches it. The `catch` wraps the LLM call *only* — repo failures still surface as 500s.

The recommendation path never triggers summary generation; it reads `summaryRepo.latestByStudent` and gives up with a 404 if there is none. There is a unit test asserting `generateSummary` is never called on that path.

## Judgement calls (doc gaps, not deviations)

The phase doc pins the stub's output format by example only. Three gaps had to be filled — flag any you want changed:

1. **Singular sessions.** A single-record area renders `across 1 session.` rather than `across 1 sessions.`, for plausible demo output. *Consequence:* a matcher like `/across \d+ sessions/` will miss single-session areas. Say the word and it becomes uniformly plural.
2. **Ending score, not last number.** `generateRecommendation` picks the two weakest areas by the score the student *ended* on, parsed from the numbers before the ` across ` marker (`improved from 62 to 78` → 78; `held steady at 44` → 44). Read literally, "the last number mentioned" is the session count, which would rank areas by how often they were assessed. Unparseable content (a summary from a real provider) falls back to the first two entries of `SKILL_AREAS`.
3. **Advice ordering and count.** Lines come out weakest-area-first. If the summary names fewer than two areas, the list is topped up from `SKILL_AREAS`, so the response is always a header plus exactly two lines.

## What Phase 7 must provide

The integration suites are written against the frozen `test/helpers/harness.ts` interface and compile today, but `createHarness` still throws `'createHarness is implemented in Phase 7'`. Two harness behaviours they rely on:

- **`llm.reset()` must set `mode` back to `'ok'`.** IT7A-07 and IT7A-09 set `h.llm.mode = 'fail'` and depend on the next `beforeEach` to clear it, or later tests in the file will fail.
- **`createStudent({ withProgress: true })` must insert enough progress rows for a summary to be generated** — IT7A-07 and IT7A-08 both use such a student and expect the request to reach the LLM step.

Also note IT7A-01/02 asserts `h.llm.summaryCalls === 1` across two consecutive `track-progress` calls, so the harness LLM counter must count only real generation calls.

## Orchestrator actions

None. No env vars to fill, no SQL to run, no dependency changes, and no database access was performed. Review and commit at your convenience.

**Suggested commit message:** `backend: add the AI summary and recommendation feature with its stub generator and tests`
