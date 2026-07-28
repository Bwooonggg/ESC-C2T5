# Phase 4 — LLM Stub, Insight Service & Student Routes

> **Wave 2 · runs in parallel with Phases 2, 3, 5, 6 · depends only on Phase 1.**
> You are building the core feature: progress + AI summary + recommendations. That means the deterministic stub LLM, the `InsightService` business rules (staleness, error semantics — the heart of the IT7A test cases), and the three student routes. Unit tests run offline against in-file fakes; integration tests self-skip until Wave 3.

## Context

Parents view a child's progress records; the service returns them together with an AI-generated **summary**, regenerating only when new progress has arrived since the last one. Parents can also request a **recommendation**, generated from the latest stored summary. The LLM provider is undecided, so the only implementation today is a deterministic stub behind the `LlmClient` interface. Guardianship (who may see which student) is checked in the routes via a helper that already exists.

## Files you own

```
backend/src/adapters/llm/stub-llm.ts
backend/src/services/insight.service.ts
backend/src/http/routes/students.routes.ts        # replace the 501 stub
backend/test/unit/stub-llm.test.ts
backend/test/unit/insight-service.test.ts
backend/test/integration/track-progress.int.test.ts
backend/test/integration/recommendations.int.test.ts
```

**Touch nothing else** — not `deps.ts`, not `llm-client.ts` (the interface), not `auth.ts`, not `package.json`.

## Contracts (frozen in Phase 1 — import, never edit)

From `src/adapters/llm/llm-client.ts`:

```ts
export class LlmUnavailableError extends Error { ... }
export interface LlmClient {
    generateSummary(input: { student: Student; records: ProgressRecord[] }): Promise<string>;
    generateRecommendation(input: { student: Student; summary: Summary }): Promise<string>; // '\n'-joined lines
}
```

From `src/deps.ts` — you implement `InsightService` and consume these:

```ts
export interface InsightService {
    trackProgress(studentId: string): Promise<{ progress: ProgressRecord[]; summary: Summary }>;
    getSummary(studentId: string): Promise<Summary>;
    createRecommendation(studentId: string): Promise<Recommendation>;
}
// consumed: StudentRepo { byId }, ProgressRepo { listByStudent, latestCreatedAt },
//           SummaryRepo { latestByStudent, insert }, RecommendationRepo { insert }
```

From `src/errors.ts`: `NotFoundError`, `UnavailableError`. From `src/http/auth.ts`: `requireOwnStudent(studentRepo, parent, studentId)` (throws 404 `progressUnavailable` when not guardian). From `src/http/envelope.ts`: `ok(res, data)`.

## Progress

Tick each box (`[ ]` → `[x]`) in this file as you complete the step. Do not change any other text in this document.

- [ ] Step 1 — `stub-llm.ts`
- [ ] Step 2 — `insight.service.ts`
- [ ] Step 3 — `students.routes.ts`
- [ ] Step 4 — unit tests (stub-llm, insight-service)
- [ ] Step 5 — integration tests (compile + self-skip)
- [ ] Done criteria verified (typecheck + tests green, ownership respected)

## Step 1 — `src/adapters/llm/stub-llm.ts`

`export class StubLlmClient implements LlmClient` — **fully deterministic** (no randomness, no clock), so demo output is plausible and tests can assert exact strings.

- `generateSummary`: group records by `skillArea` (records arrive date-ascending). For each area with ≥1 record, compare first vs last score: `improved from X to Y`, `dipped from X to Y`, or `held steady at X`, plus session count. Output format (exactly — unit tests pin it):

  ```
  Here's how <student.name> has been doing:
  - <Skill Area>: improved from 62 to 78 across 3 sessions.
  ...one line per skill area present, in SKILL_AREAS order (import from types.ts)...
  ```

- `generateRecommendation`: find the two areas with the lowest **latest** scores mentioned in the summary — but the summary is prose, so instead derive from the summary deterministically: parse is fragile, so keep it honest and simple: the interface gives you `summary.content`; extract the `- <Skill Area>: ... <n> ...` lines you generated (split on `\n`, match leading `- `), take the two areas with the lowest final number mentioned; if parsing yields nothing (foreign summary content), fall back to the first two entries of `SKILL_AREAS`. Map each chosen area to a fixed advice line from a `Record<SkillArea, string>` table you define (e.g. Spelling → `Practise spelling common words together for ten minutes a day.`). Return 2 lines joined with `'\n'`, prefixed by a first line `Ways you can support <student.name> at home:`.

Both methods are `async` but never throw — failures are simulated in tests via a different fake, not by the stub.

## Step 2 — `src/services/insight.service.ts`

```ts
export function createInsightService(deps: Pick<Deps,
    'studentRepo' | 'progressRepo' | 'summaryRepo' | 'recommendationRepo' | 'llm'>): InsightService
```

**`getSummary(studentId)`** — the shared core:

1. `student = await studentRepo.byId(studentId)`; null → `throw new NotFoundError('progressUnavailable')` (defense in depth; routes already checked guardianship).
2. `records = await progressRepo.listByStudent(studentId)`; empty → `throw new UnavailableError('progressUnavailable')`  *(IT7A-05: student exists, no progress → 503)*.
3. `latest = await summaryRepo.latestByStudent(studentId)`; `newest = await progressRepo.latestCreatedAt(studentId)`.
4. **Staleness:** `stale = !latest || (newest !== null && Date.parse(newest) > Date.parse(latest.generatedAt))`. Not stale → return `latest` (no LLM call).
5. Stale → `try { content = await llm.generateSummary({ student, records }) } catch { throw new UnavailableError('summaryUnavailable') }` *(IT7A-07: generator down → 503, and because the insert below never ran, nothing is stored)*.
6. `return summaryRepo.insert({ studentId, content })`.

**`trackProgress(studentId)`**: `summary = await this.getSummary(studentId)` then `progress = await progressRepo.listByStudent(studentId)`; return `{ progress, summary }`. (Loading progress twice is accepted — simplicity over a micro-optimization.)

**`createRecommendation(studentId)`**:

1. Student lookup as above (404 `progressUnavailable` if missing).
2. `latest = await summaryRepo.latestByStudent(studentId)`; null → `throw new NotFoundError('summaryUnavailable')` *(IT7A-08 — note: 404, not 503)*.
3. `try { content = await llm.generateRecommendation({ student, summary: latest }) } catch { throw new UnavailableError('recommendationUnavailable') }` *(IT7A-09; nothing stored, again by ordering)*.
4. `return recommendationRepo.insert({ summaryId: latest.summaryId, content })`.

Never trigger summary generation from the recommendation path.

## Step 3 — `src/http/routes/students.routes.ts`

Replace the stub, keeping `export function studentsRoutes(deps: Deps): Router`. All three handlers start with `await requireOwnStudent(deps.studentRepo, req.parent!, req.params.studentId)`:

- `GET /:studentId/track-progress` → `ok(res, await deps.insightService.trackProgress(studentId))` — envelope data is `{ progress, summary }`.
- `GET /:studentId/summary` → `ok(res, await deps.insightService.getSummary(studentId))`.
- `POST /:studentId/recommendations` (no request body — do not read one) → `ok(res, await deps.insightService.createRecommendation(studentId))`.

## Step 4 — unit tests (offline, in-file fakes)

Write plain-object fakes for the four repos **inside the test files** (e.g. a `fakeSummaryRepo` backed by an array). Do not import from `src/repos/` (Phase 2's files — may not exist yet).

`test/unit/stub-llm.test.ts`:
1. Summary output matches the pinned format exactly for a crafted 2-area input.
2. Same input → identical output (determinism).
3. Recommendation returns header + 2 advice lines targeting the two weakest areas from a stub-generated summary; falls back gracefully on foreign summary content.

`test/unit/insight-service.test.ts` (a counting/failing in-file `LlmClient` fake):
1. No stored summary → generates, inserts, returns it (llm called once).
2. Fresh summary (progress `created_at` older than `generatedAt`) → returns stored, llm **not** called.
3. Stale summary (newer progress) → regenerates, inserts a second row.
4. Unknown student → `NotFoundError('progressUnavailable')`.
5. No progress records → `UnavailableError('progressUnavailable')`; llm not called.
6. Llm throws → `UnavailableError('summaryUnavailable')`; summaryRepo.insert never called.
7. `trackProgress` returns both records and summary.
8. Recommendation: no summary → `NotFoundError('summaryUnavailable')`; llm failure → `UnavailableError('recommendationUnavailable')` + nothing inserted; success → inserted with the latest summary's id.

## Step 5 — integration tests (compile now, run in Wave 3)

Use the frozen harness API (`test/helpers/harness.ts`): `createHarness`, `describeIntegration`, `TestHarness` — see its interface for `tokenA`, `studentA1` (has progress), `studentA2` (no progress), `llm` control (`mode`, `summaryCalls`), `email`, `deps`, `createStudent`, `cleanup`. Standard shell:

```ts
describeIntegration('track progress (IT7A)', () => {
    let h: TestHarness;
    beforeAll(async () => { h = await createHarness(); });
    beforeEach(() => h.llm.reset());
    afterAll(async () => { await h?.cleanup(); });
    ...
});
```

`test/integration/track-progress.int.test.ts` (supertest against `h.app`, always `Bearer h.tokenA`):
- **IT7A-01/02**: `GET /api/students/{studentA1}/track-progress` → 200; `data.progress` non-empty and date-ascending; `data.summary.content` non-empty; summary persisted (`await h.deps.summaryRepo.latestByStudent(...)` matches); `h.llm.summaryCalls === 1`. A second call → same summary id, `summaryCalls` still 1 (reuse).
- `GET /api/students/{studentA1}/summary` → 200, same summary (standalone endpoint).
- **IT7A-04**: random UUID → 404 `progressUnavailable`.
- **IT7A-05**: `studentA2` → 503 `progressUnavailable`.
- **IT7A-07**: `const s = await h.createStudent({ parentId: h.parentA.parentId, withProgress: true })`; `h.llm.mode = 'fail'` → 503 `summaryUnavailable`; `h.deps.summaryRepo.latestByStudent(s.studentId)` is null (nothing stored).

`test/integration/recommendations.int.test.ts`:
- **IT7A-03**: prime `studentA1` (GET track-progress), then `POST /api/students/{studentA1}/recommendations` → 200; `data.summaryId` equals the stored summary's id; content contains `\n`.
- **IT7A-08**: fresh student with progress but **no summary ever generated** → POST → 404 `summaryUnavailable`.
- **IT7A-09**: primed student, `h.llm.mode = 'fail'` → POST → 503 `recommendationUnavailable`.
- Authorization: `POST` on `h.studentB1` with `tokenA` → 404 `progressUnavailable`.

## Done criteria

- `npm run typecheck` clean; `npm test` green — both unit suites pass; both integration suites report as skipped.
- No file outside your ownership list changed.
