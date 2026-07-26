# DAS 7 Integration Test Plan

**Status:** Backlog record for the dedicated testing phase (Phase 13). No
permanent test file is created by this document.

**Source of truth:** the integration test case tables in the project plan
document. This file mirrors those cases using the same identifiers so the two do
not diverge, and adds the diagram traceability and implementation notes that the
table format has no column for.

**Derived from:** [`sequenceDiagram7_1.puml`](sequenceDiagram7_1.puml) (Track
Child's Progress) and [`sequenceDiagram7_2.puml`](sequenceDiagram7_2.puml)
(Notify Parent).

Execution rule 3 of [`revision-plan.md`](revision-plan.md) forbids adding or
substantially rewriting permanent test files during R2 through R10 and directs
that required cases be recorded in the deferred testing backlog instead. This
document is that record.

Cases are written as blocks rather than a six-column table because the
Precondition and Postcondition text does not fit readably in a Markdown table.
The field names match the table columns exactly.

## 1. Scope and Assumptions

These cases run against the **completed system**: the Supabase `insight` schema
with its row-level security policies, the platform token boundary, the composed
request path, and the notification worker. There is no separate pre-database
stage.

### Environment

| Component | In the test | Rationale |
| --- | --- | --- |
| Database | Real Supabase project | The schema constraints are part of what is verified |
| Authentication | Real token verification | Every functional route is protected |
| Request path | Real controllers, models, repositories | The integration under test |
| Notification worker | Real claim and delivery loop | The integration under test |
| LLM provider | Stubbed at the client boundary | Non-deterministic output and per-call cost make a live provider unusable as an assertion target |
| Email provider | Stubbed at the delivery port | The same, plus no test may send mail to a real address |

"Reachable" and "unreachable" in the preconditions below are expressed by
configuring the corresponding stub to succeed or to fail.

### Interpretation notes

**The diagrams are stale on the generator boundary.** Both declare
`SummaryGeneratorService` and `RecommendationGeneratorService` as separate
secondary actors, and the case descriptions inherit that naming. R8 replaced the
two-service model with one provider-neutral `LlmClientPort` under
[`src/infrastructure/llm/`](../src/infrastructure/llm/), discriminated by a
`summary` or `recommendation` operation. Cases naming either service are
implemented against that single boundary.

**Diagram 7_2's participants do not exist yet.** `NotificationController`,
`NotifierModel`, and `EmailServiceAdapter` are unimplemented and the worker
entrypoint has no poll loop. The 7B cases become executable when Phase 11 lands.

**Routes are service-local.** Express mounts at the root and Traefik strips
`/api/insights`. The retained historical suites still call `/api/...` and now
return 404; they must not be used as a template.

**Envelopes** are `{ "ok": true, "data": ... }` and
`{ "ok": false, "error": "..." }`.

Unless a case states otherwise, the caller is an authenticated parent holding a
valid access token and an existing guardian link to the student.

## 2. Track Child's Progress

### IT7A-01

- **Integration being tested:** `TrackProgressModel` successfully fetches a
  summary using `GeneratorAdapter` and `SummaryGeneratorService`.
- **Traces to:** 7_1 lines 26 to 31.
- **Precondition:** student already has recorded progress; the summary generator
  and database are reachable.
- **Input:** student's progress.
- **Expected output:** 200 with a summary of the student's progress.
- **Expected postcondition:** summary is saved into the database; no student or
  parent data is modified.
- **Note:** duplicates IT7A-02 on every field. If both are kept, this one should
  assert the returned `Summary` object rather than an HTTP status, because
  `TrackProgressModel` never sees a response code.

### IT7A-02

- **Integration being tested:** `TrackProgressController` gets progress through
  `TrackProgressModel`.
- **Traces to:** 7_1 lines 19 to 33.
- **Precondition:** student already has recorded progress; the summary generator
  and database are reachable.
- **Input:** student's progress.
- **Expected output:** 200 with the student's progress and summary.
- **Expected postcondition:** summary is saved into the database; no student or
  parent data is modified.

### IT7A-03

- **Integration being tested:** `TrackProgressController` successfully fetches
  recommendations based on an existing summary.
- **Traces to:** 7_1 lines 36 to 52, the `opt Parent requests recommendations`
  fragment.
- **Precondition:** student has an existing summary of their current progress;
  the recommendation generator and database are reachable.
- **Input:** student's progress summary.
- **Expected output:** 200 with recommendations based on the student's summary.
- **Expected postcondition:** recommendation is saved into the database; no
  student or parent data is modified.

### IT7A-04

- **Integration being tested:** `TrackProgressController` fails to fetch progress
  on a missing student.
- **Traces to:** 7_1 lines 54 to 57, the `else Progress data cannot be fetched`
  branch.
- **Precondition:** the requested student does not exist in the system.
- **Input:** none.
- **Expected output:** 404 with `progressUnavailable`.
- **Expected postcondition:** database is unmodified.
- **Note:** the response must be byte-identical to IT7A-06's authorization
  failure. Any difference in status or body lets a caller confirm that a student
  exists.

### IT7A-05

- **Integration being tested:** `TrackProgressController` fails to fetch progress
  when no progress record is linked to the student.
- **Traces to:** 7_1 lines 54 to 57.
- **Precondition:** the student does not currently have any progress in the
  system.
- **Input:** none.
- **Expected output:** 503 with `progressUnavailable`.
- **Expected postcondition:** database is unmodified.
- **Note:** 503 is safe here because this case is only reachable by an already
  authorized caller, so it discloses nothing.

### IT7A-06

- **Integration being tested:** `TrackProgressController` fails to fetch progress
  on invalid authentication or authorization.
- **Traces to:** no branch in 7_1; the diagram has no unauthorized path.
- **Precondition:** the requested student and progress exist in the system, but
  the caller is unauthenticated or unauthorized to obtain the data.
- **Input:** none.
- **Expected output:** 401 or 404 with `progressUnavailable`.
- **Expected postcondition:** database is unmodified.
- **Note:** this needs splitting before it can be implemented — a test case
  requires one determinate expected output. Missing, malformed, or expired token
  is 401; a valid token whose holder is not the student's guardian is 404 with
  the identical body to IT7A-04.

### IT7A-07

- **Integration being tested:** `GeneratorAdapter` fails to fetch a summary from
  `SummaryGeneratorService`.
- **Traces to:** 7_1 lines 28 to 30, the failure of the depicted
  `Adapter -> SummaryService : generate(progress)` message.
- **Precondition:** the summary generator is unreachable.
- **Input:** student's progress.
- **Expected output:** 503 with `summaryUnavailable`.
- **Expected postcondition:** database is unmodified; summary not stored.

### IT7A-08

- **Integration being tested:** `RecommendationModel` fails to fetch the latest
  summary.
- **Traces to:** 7_1 line 43, `RecoModel -> RecoModel : getLatestSummary()`
  resolving to nothing.
- **Precondition:** the student does not currently have a summary of their
  progress.
- **Input:** none.
- **Expected output:** 404 with `summaryUnavailable`.
- **Expected postcondition:** database is unmodified; recommendation is not
  stored.

### IT7A-09

- **Integration being tested:** `RecommendationModel` fails to fetch
  recommendations from `RecommendationGeneratorService`.
- **Traces to:** 7_1 lines 46 to 48, the failure of the depicted
  `Adapter -> RecommendationService : generate(summary)` message.
- **Precondition:** the recommendation generator is unreachable.
- **Input:** student's summary.
- **Expected output:** 503 with `recommendationUnavailable`.
- **Expected postcondition:** database is unmodified; recommendation is not
  stored.

## 3. Notify Parent

### IT7B-01

- **Integration being tested:** `EmailServiceAdapter` successfully sends an
  email.
- **Traces to:** 7_2 lines 30 to 34, `EmailServiceAdapter -> EmailProvider :
  send(notification)` and the `sendSuccess` return.
- **Precondition:** student exists and has an existing summary; the parent
  account has a valid linked email; the email provider is reachable.
- **Input:** notification (summary and parent recipient).
- **Expected output:** email is sent by the email provider.
- **Expected postcondition:** database is unmodified; the provider has the new
  email in its history.

### IT7B-02

- **Integration being tested:** `EmailServiceAdapter` fails to send an email.
- **Traces to:** 7_2 lines 30 and 40, the `sendFailed` return.
- **Precondition:** the email provider is unreachable.
- **Input:** notification (summary and parent recipient).
- **Expected output:** email is not sent by the email provider.
- **Expected postcondition:** database is unmodified; the email does not exist
  in the provider's history.

### IT7B-03

- **Integration being tested:** `NotifierController` successfully sends an email
  through `NotifierModel` and `EmailServiceAdapter`.
- **Traces to:** 7_2 lines 18 to 37, the `alt Email sent successfully` branch.
- **Precondition:** student exists and has some progress in the database; the
  summary generator and email provider are reachable.
- **Input:** student identifier.
- **Expected output:** 200.
- **Expected postcondition:** generated summary is stored in the database; the
  provider has the new email in its history.
- **Note:** see section 4 item 1. This path has no HTTP response; the diagram's
  return value is `parentNotified`.

### IT7B-04

- **Integration being tested:** `NotifierController` fails to send an email on
  summary generator failure.
- **Traces to:** 7_2 lines 21 to 25, the failure of
  `GeneratorServiceAdapter -> SummaryService : generate(records)`.
- **Precondition:** the summary generator is unreachable.
- **Input:** student identifier.
- **Expected output:** 503 with `summaryUnavailable`.
- **Expected postcondition:** database is unmodified; email not logged in the
  provider.
- **Note:** see section 4 items 1 and 3.

### IT7B-05

- **Integration being tested:** `NotifierController` fails to send an email when
  no progress record is linked to the student.
- **Traces to:** no branch in 7_2; the diagram goes directly from `notifyParent`
  to `generateSummary` with no progress-unavailable path.
- **Precondition:** the student does not have any progress to generate a summary
  with.
- **Input:** student identifier.
- **Expected output:** 503 with `progressUnavailable`.
- **Expected postcondition:** database is unmodified; email not logged in the
  provider.
- **Note:** see section 4 items 1 and 3.

### IT7B-06

- **Integration being tested:** timer triggers notification.
- **Traces to:** 7_2 lines 16 to 19, `Clock -> NotificationController :
  timerExpired()`.
- **Precondition:** the system's timer for the specific parent reaches zero; the
  student exists and has some progress in the database; the summary generator
  and email provider are reachable.
- **Input:** none.
- **Expected output:** 200.
- **Expected postcondition:** generated summary is stored in the database; the
  provider has the new email in its history.
- **Note:** see section 4 item 1. A timer firing has no requester to return a
  status code to.

## 4. Known Issues in the Current Case Set

Recorded rather than silently corrected, so the cases above stay aligned with
the project plan document.

1. **The 7B cases expect HTTP status codes for a flow that has none.** Notify
   Parent is driven by a background worker tick, not a request. IT7B-03, 04, 05,
   and 06 cannot be implemented as written. The diagram's own return values are
   the correct expectations: `parentNotified` for IT7B-03 and IT7B-06,
   `notificationFailed` for IT7B-04 and IT7B-05, each paired with the observable
   state already listed in the postcondition.

2. **IT7A-06 has two expected outputs.** Split it into an authentication case
   (401) and an authorization case (404), so each has one assertable result.

3. **The 7B failure postconditions claim the database is unmodified.** In the
   implemented worker, a claimed job that fails must record that failure, or its
   lease expires and it is retried indefinitely. Likewise IT7B-03's success
   postcondition omits the email notification row and the job completing. The
   diagram shows no queue, so the cases are consistent with it but will diverge
   from the implementation.

4. **IT7A-01 and IT7A-02 are identical across every field.** See the note on
   IT7A-01.

5. **The 7A input column names data the caller does not supply.** "Student's
   progress" and "student's progress summary" are loaded from the database; the
   caller supplies a student identifier, as the 7B cases already state.

6. **No case covers the controller-level email failure.** IT7B-02 exercises the
   adapter alone; nothing drives `NotifierController` through 7_2's `else`
   branch to `notificationFailed`.

## 5. Not Covered

Behaviours present in the implementation but absent from both diagrams and from
the case set above. They remain untested unless the diagrams are extended or a
separate implementation-derived plan is written.

| Behaviour | Where it lives |
| --- | --- |
| Progress-version revalidation and bounded retry | The snapshot loop in the shared summary capability |
| In-flight request coalescing | The same capability |
| Unconfigured LLM provider fail-fast | The LLM boundary |
| Basis-summary ownership recheck | `RecommendationModel` |
| Correlation and idempotency metadata propagation | Controller through adapter |
| Request parameter validation and container gating | The HTTP layer |
| Prompt payload privacy minimisation | The generator adapters |
| Notification job queue: lease claim, expiry, retry, concurrency, ordering | The job RPCs and repository |
| Job and email referential integrity, idempotent scheduling | The `insight` schema constraints |
| Append-only audit enforcement | Table privileges |
| Readiness probe | The Supabase readiness probe |
| Notification preference read, upsert, and email normalisation | The preferences workflow |
| Row-schema validation at the infrastructure boundary | The Supabase mappers |
| Deterministic progress ordering and latest-summary selection | The Supabase repositories |
| `GET /students/{id}/summary` route | The track-progress router |

Two are worth revisiting deliberately rather than by omission. The **snapshot
revalidation loop** is what keeps a generated summary consistent with the
progress it was generated from, and **job queue lease semantics** are what stop
two workers double-notifying the same parent. Diagram 7_1 shows a single
progress read with no loop, and diagram 7_2 shows no queue at all, so both are
invisible to a diagram-driven plan.

## 6. Implementation Notes

**Error mapping change required.** IT7A-04 expects 404 for a missing student.
The current [`error-mapper.ts`](../src/http/responses/error-mapper.ts) maps every
`ProgressUnavailableError` to 503, and the summary capability raises that same
error for five distinct conditions. Delivering IT7A-04 and IT7A-06 requires
splitting the student-not-visible case out to 404 while leaving zero-records and
version-churn on 503. Both keep the `progressUnavailable` body, so the public
error vocabulary is unchanged.

**Row teardown.** The `insight` schema grants select, insert, and update to the
worker role and grants **no delete to any role**. Rows created by a test cannot
be removed through the Data API. This must be resolved, by either a delete grant
added through migration or a separate teardown path, before the suite is
written.

**Test project.** The suite must target a project designated for testing, with
the same guard the historical integration suites applied to the database name.
Production project credentials must never be reachable from the test
configuration.
