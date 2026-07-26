# Unit Test Cases (Core Features)

Test cases for the core DAS 7 backend features, as implemented in `test/unit/`. Run with `npm run test:unit`.

## Track Progress — summary generation (`TrackProgressModel`)

| ID | Feature / Use Case | Precondition | Input | Expected Output | Expected Postcondition |
| --- | --- | --- | --- | --- | --- |
| UT-01 | Generate a summary from one progress snapshot (`trackProgress`) | Student `student-1` exists with `currentProgressVersion="v1"`; 1 progress record on file; summary repository empty; `now()` fixed to `2026-07-23T12:00:00.000Z`; `createId()` returns `"summary-1"` | `studentId="student-1"`, `context={correlationId:"request-1", idempotencyKey:"generation-1"}` | Returns `{summary, records}` with `summary = Summary(summaryId="summary-1", studentId="student-1", content="Fake summary", generatedAt=2026-07-23T12:00:00.000Z, sourceProgressVersion="v1")` and `records` equal to the stored records | `summaryRepository.saved == [summary]`; generator called exactly once with `{student, records}`; the generator receives the same `context` object that was passed in |
| UT-02 | Coalesce concurrent requests for the same snapshot (`trackProgress`) | Student `student-1` at `"v1"`; 1 progress record; generator gated so the first call is still in flight; `createId()` returns `"shared-summary"` | Two overlapping calls: `trackProgress("student-1", {correlationId:"request-1", …})` then `trackProgress("student-1", {correlationId:"request-2", …})` | Both callers receive the **same object identity** (`firstResult === secondResult`) | Generator invoked exactly once (`generatorCalls == 1`) despite two callers |
| UT-03 | Reject an empty progress snapshot (`trackProgress`) | Student `student-1` exists; progress record repository returns `[]` | `studentId="student-1"`, `context` | Throws `ProgressUnavailableError` | Generator not called; `summaryRepository.saved` is empty |
| UT-04 | Regenerate when the progress version changes mid-flight (`trackProgress`) | Student repository returns `v1`, then `v2`, then `v2` on successive reads; 1 progress record; `createId()` returns `"summary-v2"` | `studentId="student-1"`, `context` | Returns a summary with `sourceProgressVersion="v2"` | Generator called twice, **both calls carrying the original `context` object**; only the `v2` summary is persisted (`summaryRepository.saved == [result.summary]`) |
| UT-05 | Do not persist when the generator fails (`trackProgress`) | Student `student-1` at `"v1"`; 1 progress record; generator configured to throw `Error("generator unavailable")` | `studentId="student-1"`, `context` | Rejects with that exact error instance | `summaryRepository.saved` is empty — nothing written on failure |
| UT-06 | Do not persist invalid generated content (`trackProgress`) | Student `student-1` at `"v1"`; 1 progress record; generator returns `{content:"   "}` (whitespace only) | `studentId="student-1"`, `context` | Throws `ValidationError` | `summaryRepository.saved` is empty |

## Track Progress — recommendations (`RecommendationModel`)

| ID | Feature / Use Case | Precondition | Input | Expected Output | Expected Postcondition |
| --- | --- | --- | --- | --- | --- |
| UT-07 | Generate a recommendation from the latest summary (`requestRecommendations`) | Summary repository holds `Summary(summaryId="summary-1", studentId="student-1", sourceProgressVersion="v1")`; `now()` fixed to `2026-07-23T12:30:00.000Z`; `createId()` returns `"recommendation-1"` | `studentId="student-1"`, `context={correlationId:"request-1", idempotencyKey:"generation-1"}` | Returns `Recommendation(recommendationId="recommendation-1", studentId="student-1", summaryId="summary-1", content="Fake recommendation", generatedAt=2026-07-23T12:30:00.000Z)` | `recommendationRepository.saved == [result]`; generator called once with `{summary}` and the same `context` object |
| UT-08 | Do not persist when the generator fails (`requestRecommendations`) | Summary on file; generator configured to throw `Error("recommendation generator unavailable")` | `studentId="student-1"`, `context` | Rejects with that exact error instance | `recommendationRepository.saved` is empty |
| UT-09 | Refuse to recommend without a summary (`requestRecommendations`) | Summary repository returns `null` for the student | `studentId="student-1"`, `context` | Throws `SummaryUnavailableError` | Generator not called; `recommendationRepository.saved` is empty |

## Notification preferences (`GetPreferencesModel` / `SavePreferencesModel`)

| ID | Feature / Use Case | Precondition | Input | Expected Output | Expected Postcondition |
| --- | --- | --- | --- | --- | --- |
| UT-10 | Read a parent's stored preference (`GetPreferencesModel.execute`) | Repository holds `NotificationPreference(parentId="parent-1", enabled=true, frequency="Weekly", recipientEmail="parent@example.com")` | `parentId="parent-1"` | Resolves to that same preference instance | Repository queried exactly once with `"parent-1"` (`findByParentIdCalls == ["parent-1"]`); nothing written |
| UT-11 | Read a parent with no stored preference (`GetPreferencesModel.execute`) | Repository holds `null` for the parent | `parentId="parent-1"` | Resolves to `null` | Nothing written |
| UT-12 | Save a preference, normalising the email (`SavePreferencesModel.execute`) | Repository holds no preference for the parent | `parentId="parent-1"`, `{enabled:false, frequency:"Monthly", recipientEmail:" Parent.Demo@Example.COM "}` | Returns `NotificationPreference(parentId="parent-1", enabled=false, frequency=NotificationFrequency("Monthly"), recipientEmail=EmailAddress("parent.demo@example.com"))` — trimmed and lower-cased | `repository.saved == [result]` |
| UT-13 | Reject an invalid recipient email (`SavePreferencesModel.execute`) | Repository holds no preference for the parent | `parentId="parent-1"`, `{enabled:true, frequency:"Weekly", recipientEmail:"not-an-email"}` | Rejects with `"emailAddress must be a valid email address."` | `repository.saved` is empty — the invalid preference is never persisted |

## HTTP error mapping (`mapError`)

| ID | Feature / Use Case | Precondition | Input | Expected Output | Expected Postcondition |
| --- | --- | --- | --- | --- | --- |
| UT-14 | Map an unavailable progress snapshot | None | `new ProgressUnavailableError()` | `{message:"progressUnavailable", status:503}` | Pure function; input error left unmodified |
| UT-15 | Map a missing summary | None | `new SummaryUnavailableError()` | `{message:"summaryUnavailable", status:404}` | Pure function; input error left unmodified |
| UT-16 | Map an LLM failure on the recommendation path | None | `LlmError({code:"UNAVAILABLE", operation:"recommendation", provider:"test-provider", correlationId:"c1", retryable:true})` | `{message:"recommendationUnavailable", status:503}` | Pure function; provider detail is not leaked into the response |
| UT-17 | Map an LLM failure on the summary path | None | `LlmError({code:"UNAVAILABLE", operation:"summary", provider:"test-provider", correlationId:"c1", retryable:true})` | `{message:"summaryUnavailable", status:503}` | Pure function; provider detail is not leaked into the response |
| UT-18 | Map a request-validation failure | None | `new ZodError([])` | `{message:"Invalid request.", status:400}` | Pure function; the raw Zod issues are not exposed |
| UT-19 | Map a generic domain rule violation | None | `new ValidationError("name is required")` | `{message:"name is required", status:400}` | Pure function; the domain message is passed through verbatim |
| UT-20 | Map an unrecognised error | None | `new Error("boom")` | `{message:"Something went wrong on the server.", status:500}` | Pure function; the internal message `"boom"` is not exposed |

## Domain errors

| ID | Feature / Use Case | Precondition | Input | Expected Output | Expected Postcondition |
| --- | --- | --- | --- | --- | --- |
| UT-21 | Expose a stable validation error code (`ValidationError`) | None | `new ValidationError("Invalid value.")` | Instance of `DomainError` with `name="ValidationError"`, `code="VALIDATION_ERROR"`, `message="Invalid value."` | Code and name are fixed contract values callers may branch on |
| UT-22 | Expose a stable progress-unavailable code (`ProgressUnavailableError`) | None | `new ProgressUnavailableError()` | Instance of `DomainError` with `name="ProgressUnavailableError"`, `code="PROGRESS_UNAVAILABLE"`, `message="Progress is unavailable."` | Default message requires no caller input |
| UT-23 | Expose a stable summary-unavailable code (`SummaryUnavailableError`) | None | `new SummaryUnavailableError()` | Instance of `DomainError` with `name="SummaryUnavailableError"`, `code="SUMMARY_UNAVAILABLE"`, `message="Summary is unavailable."` | Default message requires no caller input |

## Application containers

| ID | Feature / Use Case | Precondition | Input | Expected Output | Expected Postcondition |
| --- | --- | --- | --- | --- | --- |
| UT-24 | Build API and worker containers from one configuration (`createApiContainer` / `createWorkerContainer`) | None | `config = loadConfig({NODE_ENV:"test"})`, passed to both factories | Two distinct containers (`apiContainer !== workerContainer`) | Both containers hold the *same* config object by identity (`container.config === config`) — configuration is shared, wiring is not |

## Not covered by this table

- **Infrastructure suites** (101 further cases in `test/unit/infrastructure/`): Supabase row → entity mappers, entity → insert/update mappers, PostgreSQL date conversions, write-support helpers, the LLM transport, and the two LLM generator adapters. Supporting plumbing rather than core features.
- **Configuration loading** (5 cases in `test/unit/config/environment.test.ts`): environment defaults, production requirements, and malformed-value rejection.
- **Suites that currently fail to compile**, so their cases are not documented as passing: `test/unit/domain/entities.test.ts` and `test/unit/domain/value-objects.test.ts`, both stale since the Supabase auth-model removal.
