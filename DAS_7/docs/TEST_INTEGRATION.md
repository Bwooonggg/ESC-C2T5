# DAS 7 Bottom-Up Integration Test Plan

**Status:** Approved and implemented. The verified result is **8 integration suites and 38
passing integration tests**. The complete DAS 7 regression run is **18 suites and 148 tests
passing**.

## 1. Objective

Verify that the components of DAS 7 cooperate according to the current class and sequence
diagrams, with particular attention to data passed across repository, service, HTTP, auth,
notification, and scheduling interfaces.

This plan follows the lecture's **bottom-up call-graph technique**:

1. Begin with leaf components and their direct external boundary.
2. Integrate the callers one level at a time.
3. Reuse the working lower-level cluster while testing the next caller.
4. Finish at the application entry points: HTTP requests and scheduler ticks.

The source designs are:

- `UC7_ClassDiagram.puml`
- `sequenceDiagram7_1.puml` — Track Child's Progress
- `sequenceDiagram7_2.puml` — Notify Parent

## 2. Scope

### Included

- Supabase repositories and database mappings
- `InsightService`, `PreferenceService`, and `NotifierService`
- Authentication and ownership checks
- Student, preference, and manual-notification routes
- Scheduler-to-notifier integration
- Successful, unavailable, unauthorized, and provider-failure paths shown by the designs

### Excluded

- Re-testing a single function in isolation; those remain unit tests
- Browser rendering and UI layout
- Load, stress, and production-provider acceptance testing
- Other DAS subsystems

## 3. Bottom-up integration order

| Level | Working cluster added at this level | Interfaces verified | Exit criterion |
| --- | --- | --- | --- |
| 0 | Previously unit-tested classes/functions | Individual component behaviour | Relevant unit suites pass |
| 1 — Repository cluster | Repository implementations + Supabase test project | Queries, mappings, ordering, inserts, upserts, foreign keys | BU7-R01 to BU7-R03 pass |
| 2 — Service cluster | Services + Level 1 repositories + controlled provider boundaries | Service/repository contracts, persistence side effects, failure propagation | IT7A-S01 to S06 and IT7B-S01 to S03 pass |
| 3 — HTTP cluster | Express routes + auth + Level 2 services | JWT-to-parent mapping, ownership, request/response envelopes, status mapping | IT7A-H01 to H04 and IT7B-H01 pass |
| 4 — Scheduler cluster | Scheduler + complete notifier cluster | Timer invocation, due filtering, notification side effects | IT7B-T01 and T02 pass |

No level is started until the preceding level passes. When a higher-level case fails, the
first investigation point is the newly added interface because its lower cluster has already
passed.

## 4. Test environment, setup, and teardown

The tests use a dedicated Supabase test project. They must not run against production.

Required configuration:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `TEST_SUPABASE_REF`, which must occur inside `SUPABASE_URL`
- Two dedicated Supabase Auth user credential pairs

Common setup creates uniquely identified fixtures:

| Fixture | Purpose |
| --- | --- |
| Parent A | Authenticated owner used for normal cases |
| Student A1 | Linked to Parent A and has dated progress records |
| Student A2 | Linked to Parent A and has no progress records |
| Parent B and Student B1 | Verify that another parent's data is not disclosed |

Provider responses are controlled so success and failure paths are repeatable. The database,
repositories, services, routing, and authentication path under test remain the production
implementations.

Teardown removes only IDs registered by the current run. Cascading database constraints remove
their summaries, recommendations, preferences, links, and notification records. Cleanup runs in
`afterAll`, including after a failed assertion.

## 5. Test case specifications

The format below follows the integration/system test-case example from the lecture slides.

### Level 1 — repository cluster

#### BU7-R01

| Test case ID | BU7-R01 (normal) |
| --- | --- |
| Test case name | Read parent, student, and progress data from Supabase |
| Objective | Verify that the parent/student relationship and progress rows are correctly queried and mapped by the repositories. |
| Pre-conditions | Parent A, Student A1, their guardianship link, and progress rows exist. |
| Event Sequence — Input | Call `parentRepo.byAuthUserId(authUserIdA)`. |
| Event Sequence — Output | Parent A is returned with Student A1 in `studentIds`. |
| Event Sequence — Input | Call `studentRepo.isGuardian(parentAId, studentA1Id)` and `progressRepo.listByStudent(studentA1Id)`. |
| Event Sequence — Output | Guardianship is `true`; all progress records are returned in ascending date order with domain field names. |
| Post-conditions | Database rows are unchanged. |

#### BU7-R02

| Test case ID | BU7-R02 (normal) |
| --- | --- |
| Test case name | Persist and retrieve summary and recommendation data |
| Objective | Verify repository insert results, generated database fields, mappings, and foreign-key linkage. |
| Pre-conditions | Student A1 exists. |
| Event Sequence — Input | Call `summaryRepo.insert({ studentId, content })`. |
| Event Sequence — Output | A summary with a database-generated ID and timestamp is returned. |
| Event Sequence — Input | Call `summaryRepo.latestByStudent(studentId)`, then insert a recommendation using that summary ID. |
| Event Sequence — Output | The same summary is read back and the recommendation references its ID. |
| Post-conditions | One summary and one linked recommendation exist and are registered for cleanup. |

#### BU7-R03

| Test case ID | BU7-R03 (normal) |
| --- | --- |
| Test case name | Persist preferences and notification history |
| Objective | Verify preference upsert/filtering and notification timestamp retrieval across their repositories. |
| Pre-conditions | Parent A exists and has no preference or notification row. |
| Event Sequence — Input | Upsert an enabled weekly preference, then call `preferenceRepo.listEnabled()`. |
| Event Sequence — Output | The saved values are returned and Parent A appears in the enabled set. |
| Event Sequence — Input | Insert an email-notification row, then call `emailNotificationRepo.lastSentAt(parentAId)`. |
| Event Sequence — Output | A valid non-null send timestamp is returned. |
| Post-conditions | One preference and one notification row exist and are registered for cleanup. |

### Level 2 — service cluster

#### IT7A-S01

| Test case ID | IT7A-S01 (normal) |
| --- | --- |
| Test case name | Generate and store a missing progress summary |
| Objective | Verify `InsightService.trackProgress()` with the working repository cluster. |
| Pre-conditions | Student A1 exists with progress; no summary exists; summary generation is available. |
| Event Sequence — Input | Call `trackProgress(studentA1Id)`. |
| Event Sequence — Output | Ascending progress records and a non-empty summary are returned. |
| Event Sequence — Input | Read the latest summary through `summaryRepo`. |
| Event Sequence — Output | Its ID and content equal the returned summary. |
| Post-conditions | Exactly one new summary is stored for Student A1. |

#### IT7A-S02

| Test case ID | IT7A-S02 (normal) |
| --- | --- |
| Test case name | Reuse a current summary |
| Objective | Verify that a current stored summary is reused instead of generated again. |
| Pre-conditions | IT7A-S01 has produced a summary and no newer progress row has been inserted. |
| Event Sequence — Input | Call `trackProgress(studentA1Id)` again. |
| Event Sequence — Output | The returned summary ID equals the existing summary ID and no additional generation occurs. |
| Post-conditions | The number of summary rows for Student A1 is unchanged. |

#### IT7A-S03

| Test case ID | IT7A-S03 (normal) |
| --- | --- |
| Test case name | Create a recommendation from the latest stored summary |
| Objective | Verify the service-to-summary, generation, and recommendation-repository interfaces. |
| Pre-conditions | Student A1 has a stored summary; recommendation generation is available. |
| Event Sequence — Input | Call `createRecommendation(studentA1Id)`. |
| Event Sequence — Output | A non-empty recommendation referencing the latest summary ID is returned. |
| Post-conditions | The recommendation is persisted against the latest summary. |

#### IT7A-S04

| Test case ID | IT7A-S04 (exception) |
| --- | --- |
| Test case name | Reject summary creation when progress is unavailable |
| Objective | Verify that the service stops before generation or persistence when no progress exists. |
| Pre-conditions | Student A2 exists with no progress records. |
| Event Sequence — Input | Call `trackProgress(studentA2Id)`. |
| Event Sequence — Output | `progressUnavailable` is raised. |
| Post-conditions | No summary or recommendation is stored for Student A2. |

#### IT7A-S05

| Test case ID | IT7A-S05 (exception) |
| --- | --- |
| Test case name | Do not persist output when generation fails |
| Objective | Verify failure propagation and transaction ordering at both generation paths. |
| Pre-conditions | A student has progress; the summary or recommendation provider boundary is set to fail for the selected subcase. |
| Event Sequence — Input | Call `trackProgress(studentId)` with no stored summary. |
| Event Sequence — Output | `summaryUnavailable` is raised and no summary is stored. |
| Event Sequence — Input | After restoring and storing a summary, call `createRecommendation(studentId)` with recommendation generation failing. |
| Event Sequence — Output | `recommendationUnavailable` is raised and no recommendation is stored. |
| Post-conditions | No partial generated record remains from either failed operation. |

#### IT7A-S06

| Test case ID | IT7A-S06 (exception) |
| --- | --- |
| Test case name | Require a stored summary before recommendation generation |
| Objective | Verify that recommendation creation never generates a summary as a side effect. |
| Pre-conditions | A student has progress but has never had a summary generated. |
| Event Sequence — Input | Call `createRecommendation(studentId)`. |
| Event Sequence — Output | `summaryUnavailable` is raised and the summary-generation call count remains zero. |
| Post-conditions | No summary or recommendation is stored. |

#### IT7B-S01

| Test case ID | IT7B-S01 (normal) |
| --- | --- |
| Test case name | Prepare, send, and record a parent notification |
| Objective | Verify `NotifierService` with the working preference, student, insight, email, and notification-repository cluster. |
| Pre-conditions | Parent A has an enabled preference; every linked student has progress; sending and generation are available. |
| Event Sequence — Input | Call `notifyParent(parentAId, now)`. |
| Event Sequence — Output | `parentNotified` is returned; one message is addressed to the configured recipient and names each student. |
| Event Sequence — Input | Read each student's latest summary and Parent A's latest send time. |
| Event Sequence — Output | Summaries exist and the send time is non-null. |
| Post-conditions | Generated summaries and one notification-history row are persisted. |

#### IT7B-S02

| Test case ID | IT7B-S02 (exception) |
| --- | --- |
| Test case name | Leave notification history unchanged when delivery fails |
| Objective | Verify that notification history is inserted only after successful delivery. |
| Pre-conditions | Parent A is eligible for notification; the email-provider boundary is set to fail. |
| Event Sequence — Input | Record `lastSentAt`, then call `notifyParent(parentAId, now)`. |
| Event Sequence — Output | `notificationFailed` is returned and no successful delivery is recorded. |
| Event Sequence — Input | Read `lastSentAt` again. |
| Event Sequence — Output | It equals the value recorded before the call. |
| Post-conditions | No notification-history row is added by the failed delivery. |

#### IT7B-S03

| Test case ID | IT7B-S03 (exception) |
| --- | --- |
| Test case name | Stop notification preparation when student insight is unavailable |
| Objective | Verify that one unavailable student prevents an incomplete parent update from being sent. |
| Pre-conditions | Subcase A: a linked student has no progress. Subcase B: summary generation fails. |
| Event Sequence — Input | Call `notifyParent(parentId, now)` for each subcase. |
| Event Sequence — Output | Each call returns `notificationFailed`; no message is delivered. |
| Post-conditions | No notification-history row is stored for either subcase. |

### Level 3 — HTTP and authentication cluster

#### IT7A-H01

| Test case ID | IT7A-H01 (normal) |
| --- | --- |
| Test case name | Track progress through the authenticated HTTP endpoint |
| Objective | Verify the full Parent-to-route-to-service-to-database path. |
| Pre-conditions | Parent A has a valid access token and owns Student A1, which has progress. |
| Event Sequence — Input | Send authenticated `GET /students/{studentA1Id}/track-progress`. |
| Event Sequence — Output | HTTP 200 returns `{ ok: true, data: { progress, summary } }`; progress is ascending and the summary is persisted. |
| Post-conditions | A reusable summary exists for Student A1. |

#### IT7A-H02

| Test case ID | IT7A-H02 (normal) |
| --- | --- |
| Test case name | Request a recommendation through the HTTP endpoint |
| Objective | Verify the authenticated route, insight service, generation boundary, and persistence cluster. |
| Pre-conditions | Parent A owns Student A1 and Student A1 has a stored summary. |
| Event Sequence — Input | Send authenticated `POST /students/{studentA1Id}/recommendations`. |
| Event Sequence — Output | HTTP 200 returns a recommendation whose `summaryId` equals the latest stored summary ID. |
| Post-conditions | The returned recommendation is persisted. |

#### IT7A-H03

| Test case ID | IT7A-H03 (exception) |
| --- | --- |
| Test case name | Hide nonexistent and foreign students behind the same response |
| Objective | Verify route ownership enforcement without disclosing whether a student ID exists. |
| Pre-conditions | Parent A is authenticated; Student B1 belongs to Parent B. |
| Event Sequence — Input | Request Student B1, then request a random nonexistent student ID. |
| Event Sequence — Output | Both responses are HTTP 404 with the identical `progressUnavailable` body. |
| Post-conditions | No database row is changed. |

#### IT7A-H04

| Test case ID | IT7A-H04 (exception) |
| --- | --- |
| Test case name | Reject unauthenticated requests |
| Objective | Verify that protected routes do not call the use-case cluster without a valid JWT. |
| Pre-conditions | A valid Student A1 ID is known. |
| Event Sequence — Input | Send the progress request with no bearer token, then with a malformed token. |
| Event Sequence — Output | Each response is HTTP 401 with `{ ok: false, error: 'unauthorised' }`. |
| Post-conditions | No summary, recommendation, preference, or notification row is changed. |

#### IT7B-H01

| Test case ID | IT7B-H01 (normal and exception) |
| --- | --- |
| Test case name | Save notification preferences and send an update now |
| Objective | Verify the parent-initiated notification path in `sequenceDiagram7_2.puml`. |
| Pre-conditions | Parent A is authenticated and all linked students have progress. |
| Event Sequence — Input | Send authenticated `PUT /parents/{parentAId}/preferences` with valid enabled settings. |
| Event Sequence — Output | HTTP 200 returns the normalized stored preference. |
| Event Sequence — Input | Send authenticated `POST /parents/{parentAId}/notifications`. |
| Event Sequence — Output | HTTP 200 returns `parentNotified` and a notification-history row exists. |
| Event Sequence — Input | Repeat the POST for an ineligible fixture. |
| Event Sequence — Output | HTTP 503 returns `notificationFailed`. |
| Post-conditions | Only the successful send adds notification history. |

### Level 4 — scheduler cluster

#### IT7B-T01

| Test case ID | IT7B-T01 (normal) |
| --- | --- |
| Test case name | Notify a due parent on a scheduler tick |
| Objective | Verify the complete Clock-to-Scheduler-to-Notifier call path. |
| Pre-conditions | Parent A has an enabled preference and no previous send, and all linked students have progress. |
| Event Sequence — Input | Start the scheduler and advance time by one configured tick. |
| Event Sequence — Output | One sweep runs and Parent A receives a notification. |
| Event Sequence — Input | Await the sweep and read Parent A's `lastSentAt`. |
| Event Sequence — Output | The timestamp is non-null and a matching successful delivery is present. |
| Post-conditions | Scheduler is stopped and real timers are restored. |

#### IT7B-T02

| Test case ID | IT7B-T02 (normal) |
| --- | --- |
| Test case name | Skip a parent whose notification is not yet due |
| Objective | Verify the scheduler/notifier decision path across preference frequency and latest-send data. |
| Pre-conditions | Parent A has an enabled weekly preference and a notification sent less than one week before `now`. |
| Event Sequence — Input | Call `runDueNotifications(now)` through a scheduler tick. |
| Event Sequence — Output | Parent A is absent from the sweep results and no new delivery occurs. |
| Post-conditions | Parent A's notification count and latest-send timestamp are unchanged. |

## 6. Requirements traceability

| Design flow | Repository level | Service level | Entry-point level |
| --- | --- | --- | --- |
| Track progress and summary | BU7-R01, BU7-R02 | IT7A-S01, S02, S04, S05 | IT7A-H01, H03, H04 |
| Request recommendation | BU7-R02 | IT7A-S03, S05, S06 | IT7A-H02, H03, H04 |
| Save notification preference | BU7-R03 | Preference behaviour is exercised by the notifier cluster | IT7B-H01 |
| Send update now | BU7-R01 to R03 | IT7B-S01 to S03 | IT7B-H01 |
| Scheduled notification | BU7-R03 | IT7B-S01 to S03 | IT7B-T01, T02 |

## 7. Implementation and verified results

| Bottom-up level | Test suite | Tests | Result |
| --- | --- | ---: | --- |
| 1 — Repository | `test/integration/repositories.int.test.ts` | 3 | Pass |
| 2 — Insight service | `test/integration/insight-service.int.test.ts` | 6 | Pass |
| 2 and 4 — Notifier and scheduler | `test/integration/notifier.int.test.ts` | 7 | Pass |
| 3 — Track-progress HTTP | `test/integration/track-progress.int.test.ts` | 6 | Pass |
| 3 — Recommendation HTTP | `test/integration/recommendations.int.test.ts` | 4 | Pass |
| 3 — Authentication and ownership | `test/integration/auth.int.test.ts` | 5 | Pass |
| 3 — Preference HTTP | `test/integration/preferences.int.test.ts` | 5 | Pass |
| 3 — Manual-notification HTTP | `test/integration/notifications.int.test.ts` | 2 | Pass |
| **Total integration** | **8 suites** | **38** | **Pass** |

Verification was performed in bottom-up order:

1. Level 1 repository suite: 3/3 passed.
2. Level 2 service suites, including Level 4 scheduler cases: 13/13 passed.
3. Level 3 HTTP/auth suites: 22/22 passed.
4. `npm run typecheck`: passed.
5. Complete `npm test` regression: 18/18 suites and 148/148 tests passed.
