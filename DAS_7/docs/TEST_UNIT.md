# DAS 7 sequence-driven backend unit testing plan

## Scope and counting rule

This plan follows `DIAGSRC_SequenceDiagram7_1.puml` and
`DIAGSRC_SequenceDiagram7_2.puml`, then maps each diagram activation to the
current backend implementation. It also covers the explicitly selected
authentication, authorization, identity lookup, and mapping units that run
outside the two diagram flows. The implementation is the test oracle. Each test
isolates one unit and mocks only that unit's direct outgoing dependencies.

Every table row is one separately reported Jest test. A row never combines
several boundary values, equivalence-class representatives, or loop
cardinalities. Tests may still use `it.each`, but each dataset entry must have
its own Test ID and its own row below. Jest's output is authoritative for the
current executed test count.

The UI and external actors are outside this backend plan. Repeated calls to the same implementation unit are covered once, with separate rows for their distinct paths.

## Diagram-to-source mapping

| Diagram participant or operation | Current implementation unit |
|---|---|
| `StudentsController.trackProgress()` | `studentsRoutes()` GET `/:studentId/track-progress` |
| `StudentsController.createRecommendation()` | `studentsRoutes()` POST `/:studentId/recommendations` |
| `NotificationController.savePreferences()` | `preferencesRoutes()` PUT `/:parentId/preferences`, then `PreferenceService.save()` |
| `NotificationController.notifyParent()` | `notificationRoutes()` POST `/:parentId/notifications` |
| `SupabaseRepository.listProgress()` | `ProgressRepo.listByStudent()` |
| `SupabaseRepository.getLatestSummary()` | `SummaryRepo.latestByStudent()` |
| `SupabaseRepository.saveSummary()` | `SummaryRepo.insert()` |
| `SupabaseRepository.saveRecommendation()` | `RecommendationRepo.insert()` |
| `SupabaseRepository.upsertPreference()` | `PreferenceRepo.upsert()` |
| `SupabaseRepository.listEnabledPreferences()` | `PreferenceRepo.listEnabled()` |
| `SupabaseRepository.getLastSentAt()` | `EmailNotificationRepo.lastSentAt()` |
| `SupabaseRepository.getNotificationData()` | No aggregate method exists; the implementation calls `PreferenceRepo.byParentId()`, `ParentRepo.byId()`, and `StudentRepo.listByParent()` |
| `SupabaseRepository.getProgressAndSummary()` | No aggregate method exists; `InsightService.getSummary()` calls `StudentRepo.byId()`, `ProgressRepo.listByStudent()`, `SummaryRepo.latestByStudent()`, and `ProgressRepo.latestCreatedAt()` |
| `SupabaseRepository.saveNotification()` | `EmailNotificationRepo.insert()` |
| `LLMAdapter` | `OpenRouterLlmClient.generateSummary()` and `.generateRecommendation()` |
| `Email.sendEmail()` | `BrevoEmailProvider.send()` |

## Black-box techniques used

| Technique | Where used | Why it was chosen | Selection rule |
|---|---|---|---|
| Equivalence class testing | Bearer-header grammar, JWT outcomes, controller outcomes, validation fields, repository results, mapper inputs, and provider results | These inputs fall into categories that take the same branch, such as present versus absent data or successful versus failed dependencies. One representative is enough for each distinct behavior. | Give every behaviorally distinct valid, invalid, absent, and failure class its own row. |
| Normal boundary value analysis | Summary freshness, notification intervals, and scheduler ticks | These units compare times or lengths at exact thresholds, where off-by-one faults are likely. | Put the nearest valid value below the boundary, the boundary, and the nearest valid value above it in separate rows. |
| Robust boundary value analysis | Summary length, recommendation line count, zero-millisecond scheduler interval, and future send time | The implementation defines observable behavior just outside the intended valid range, and robust tests are part of the assessment criteria. | Add the closest invalid value outside each boundary as a separate row. |
| Decision table testing | Authentication, ownership authorization, summary reuse, recommendation creation, notification preparation, and scheduled delivery | Outcomes depend on combinations of conditions, and later calls must be skipped once a deciding condition fails. | Give every feasible rule and short-circuit point its own row. |
| Loop enumeration | Progress records, recommendation lines, students, preferences, and guardian links | A loop can fail when it runs zero times, once, or repeatedly; multiple iterations also reveal ordering faults. | Give zero, one, and many iterations separate rows, plus a separate mid-loop failure where relevant. |
| Worst and robust-worst boundary value analysis | Not used | Cartesian products would duplicate decision-table paths and introduce infeasible combinations without adding useful coverage. | Use decision-table rules for dependent inputs instead. |

## Track child progress and recommendations

| Test ID | Target Unit | Test scenario | State before | Inputs | Expected outputs | State after | Mocked input/output pairs |
|---|---|---|---|---|---|---|---|
| UT-DAS7-U01-01 | `StudentsRoutes.studentsRoutes()` GET `/:studentId/track-progress` | Owned student succeeds | Router attaches parent `p1` | GET `/s1/track-progress` | Status 200 with the service result | Ownership checked before one service call | `studentRepo.isGuardian("p1","s1") -> true`; `insightService.trackProgress("s1") -> result` |
| UT-DAS7-U01-02 | `StudentsRoutes.studentsRoutes()` GET `/:studentId/track-progress` | Student is not owned | Router attaches parent `p1` | GET `/s1/track-progress` | Status 404 with `progressUnavailable` | Service is not called | `studentRepo.isGuardian("p1","s1") -> false` |
| UT-DAS7-U01-03 | `StudentsRoutes.studentsRoutes()` POST `/:studentId/recommendations` | Owned student succeeds | Router attaches parent `p1` | POST `/s1/recommendations` | Status 200 with recommendation | Ownership checked before one service call | Guardian true; `createRecommendation("s1") -> recommendation` |
| UT-DAS7-U02-01 | `InsightService.trackProgress()` | Shared summary path succeeds | Dependency histories empty | Student `s1` | Returns `{ progress: secondRecords, summary }` | Progress is read during summary work and once again for the response | Direct repository and LLM calls produce `summary`; final `listByStudent("s1") -> secondRecords` |
| UT-DAS7-U02-02 | `InsightService.trackProgress()` | Shared summary path fails | Dependency histories empty | Student `s1` | Rejects with the summary-path error | Final progress read is absent | A direct dependency used by the summary path rejects |
| UT-DAS7-U03-01 | `InsightService.getSummary()` | Student is absent | Histories empty | Student `s1` | Rejects `NotFoundError("progressUnavailable")` | No progress or summary calls | `studentRepo.byId("s1") -> null` |
| UT-DAS7-U03-02 | `InsightService.getSummary()` | Student has zero progress records | Histories empty | Student `s1` | Rejects `UnavailableError("progressUnavailable")` | Summary, timestamp, LLM, and insert calls are absent | Student lookup returns student; `progressRepo.listByStudent("s1") -> []` |
| UT-DAS7-U03-03 | `InsightService.getSummary()` | Stored summary exists and newest timestamp is absent | Stored summary `sum1` | Student `s1` | Returns `sum1` | No generation or insert | Student and progress exist; latest summary is `sum1`; `latestCreatedAt("s1") -> null` |
| UT-DAS7-U03-04 | `InsightService.getSummary()` | Freshness boundary is one millisecond below | Summary generated at `2026-01-02T00:00:00.000Z` | Newest progress at `2026-01-01T23:59:59.999Z` | Returns stored summary | No generation or insert | Lookups return the stated values |
| UT-DAS7-U03-05 | `InsightService.getSummary()` | Freshness boundary is exactly equal | Summary generated at `2026-01-02T00:00:00.000Z` | Newest progress at the same timestamp | Returns stored summary | No generation or insert | Lookups return the stated values |
| UT-DAS7-U03-06 | `InsightService.getSummary()` | Freshness boundary is one millisecond above | Stored summary is stale | Newest progress at `2026-01-02T00:00:00.001Z` | Returns inserted fresh summary | One generation and one insert | `llm.generateSummary(...) -> "fresh"`; `summaryRepo.insert(...) -> freshSummary` |
| UT-DAS7-U03-07 | `InsightService.getSummary()` | Stored summary is absent | Student and progress exist | Student `s1` | Returns inserted fresh summary | One generation and one insert | Latest summary returns null; LLM and insert succeed |
| UT-DAS7-U03-08 | `InsightService.getSummary()` | Summary generation fails | Summary absent or stale; console spy empty | Student `s1` | Rejects `UnavailableError("summaryUnavailable")` | Cause logged; insert absent | `llm.generateSummary(...) -> throws llmError` |
| UT-DAS7-U03-09 | `InsightService.getSummary()` | Summary insert fails | Summary absent or stale | Student `s1` | Repository error propagates | Generation and attempted insert recorded | LLM returns `fresh`; `summaryRepo.insert(...) -> throws dbError` |
| UT-DAS7-U04-01 | `ProgressRepo.listByStudent()` | Zero rows | Fake Supabase history empty | Student `s1`; query returns `[]` | Returns `[]` | Select, filter, and ascending date order recorded | Query chain returns `{ data: [], error: null }` |
| UT-DAS7-U04-02 | `ProgressRepo.listByStudent()` | One row | Fake history empty | Student `s1`; one database row | Returns one mapped record | One ordered query recorded | Query returns one row |
| UT-DAS7-U04-03 | `ProgressRepo.listByStudent()` | Many rows | Fake history empty | Student `s1`; three ordered rows | Returns three mapped records in response order | One ordered query recorded | Query returns three rows |
| UT-DAS7-U04-04 | `ProgressRepo.listByStudent()` | Query fails | Fake history empty | Student `s1` | Throws `Error("db: down")` | Failed query chain recorded | Query returns `{ data: null, error: { message: "down" } }` |
| UT-DAS7-U05-01 | `ProgressRepo.latestCreatedAt()` | Timestamp is absent | Fake history empty | Student `s1` | Returns null | Descending `created_at`, limit 1, and `maybeSingle` recorded | Query returns `{ data: null, error: null }` |
| UT-DAS7-U05-02 | `ProgressRepo.latestCreatedAt()` | Timestamp is present | Fake history empty | Student `s1` | Returns exact `created_at` | Expected query chain recorded | Query returns `{ created_at: timestamp }` |
| UT-DAS7-U05-03 | `ProgressRepo.latestCreatedAt()` | Query fails | Fake history empty | Student `s1` | Throws `Error("db: down")` | Failed chain recorded | Query returns database error |
| UT-DAS7-U06-01 | `SummaryRepo.latestByStudent()` | Summary is absent | Fake history empty | Student `s1` | Returns null | Descending `generated_at`, limit 1, and `maybeSingle` recorded | Query returns null |
| UT-DAS7-U06-02 | `SummaryRepo.latestByStudent()` | Summary is present | Fake history empty | Student `s1` | Returns mapped summary | Expected query chain recorded | Query returns summary row |
| UT-DAS7-U06-03 | `SummaryRepo.latestByStudent()` | Query fails | Fake history empty | Student `s1` | Throws `Error("db: down")` | Failed chain recorded | Query returns database error |
| UT-DAS7-U07-01 | `OpenRouterLlmClient.generateSummary()` | Progress loop has zero records | Fetch history empty | Student Amy; `records=[]` | Returns provider text; prompt contains the record heading and no row | One fetch | Fetch returns 200 with `summary` |
| UT-DAS7-U07-02 | `OpenRouterLlmClient.generateSummary()` | Progress loop has one record | Fetch history empty | Student Amy; one record | Returns provider text; prompt contains that row once | One fetch | Fetch returns 200 with `summary` |
| UT-DAS7-U07-03 | `OpenRouterLlmClient.generateSummary()` | Progress loop has many records | Fetch history empty | Student Amy; three records | Returns provider text; prompt preserves all three rows in order | One fetch | Fetch returns 200 with `summary` |
| UT-DAS7-U07-04 | `OpenRouterLlmClient.generateSummary()` | Summary length is 0 | Fetch history empty | Provider content is empty after trimming | Throws `LlmUnavailableError` | No output escapes | Fetch returns 200 with empty content |
| UT-DAS7-U07-05 | `OpenRouterLlmClient.generateSummary()` | Summary length is 1 | Fetch history empty | One-character content | Returns one character | One fetch | Fetch returns selected content |
| UT-DAS7-U07-06 | `OpenRouterLlmClient.generateSummary()` | Summary length is 2 | Fetch history empty | Two-character content | Returns two characters | One fetch | Fetch returns selected content |
| UT-DAS7-U07-07 | `OpenRouterLlmClient.generateSummary()` | Summary length is 1000 | Fetch history empty | 1000-character content | Returns all 1000 characters | One fetch | Fetch returns selected content |
| UT-DAS7-U07-08 | `OpenRouterLlmClient.generateSummary()` | Summary length is 1999 | Fetch history empty | 1999-character content | Returns all 1999 characters | One fetch | Fetch returns selected content |
| UT-DAS7-U07-09 | `OpenRouterLlmClient.generateSummary()` | Summary length is 2000 | Fetch history empty | 2000-character content | Returns all 2000 characters | One fetch | Fetch returns selected content |
| UT-DAS7-U07-10 | `OpenRouterLlmClient.generateSummary()` | Summary length is 2001 | Fetch history empty | 2001-character content | Returns the first 2000 characters | One fetch; oversized character removed | Fetch returns selected content |
| UT-DAS7-U07-11 | `OpenRouterLlmClient.generateSummary()` | Network request fails | Fetch history empty | Valid generation input | Throws normalized `LlmUnavailableError`; key is absent | No retry | `fetch -> rejects Error("offline")` |
| UT-DAS7-U07-12 | `OpenRouterLlmClient.generateSummary()` | Provider returns non-2xx | Fetch history empty | Valid generation input | Throws error containing provider status, not API key | No retry | Fetch returns status 429 |
| UT-DAS7-U07-13 | `OpenRouterLlmClient.generateSummary()` | Response JSON is malformed | Fetch returns 200 | Valid generation input | Throws empty-content `LlmUnavailableError` | No output | `response.json() -> rejects SyntaxError` |
| UT-DAS7-U07-14 | `OpenRouterLlmClient.generateSummary()` | Provider error object is returned with 200 | Fetch returns 200 | Valid generation input | Throws provider-message `LlmUnavailableError` | No output | JSON is `{ error: { message: "busy" } }` |
| UT-DAS7-U08-01 | `SummaryRepo.insert()` | Insert succeeds | Fake history empty | `{ studentId: "s1", content: "fresh" }` | Returns mapped database row | Snake-case insert, select, and single recorded | Query returns saved row |
| UT-DAS7-U08-02 | `SummaryRepo.insert()` | Insert fails | Fake history empty | Valid summary input | Throws `Error("db: down")` | Attempted insert recorded | Query returns database error |
| UT-DAS7-U09-01 | `InsightService.createRecommendation()` | Student is absent | Histories empty | Student `s1` | Rejects `NotFoundError("progressUnavailable")` | No summary, LLM, or insert calls | `studentRepo.byId("s1") -> null` |
| UT-DAS7-U09-02 | `InsightService.createRecommendation()` | Stored summary is absent | Student exists | Student `s1` | Rejects `NotFoundError("summaryUnavailable")` | No LLM or insert | Latest summary returns null |
| UT-DAS7-U09-03 | `InsightService.createRecommendation()` | Recommendation succeeds | Student and stored summary exist | Student `s1` | Returns inserted recommendation | One generation and one insert | LLM returns advice; insert returns recommendation |
| UT-DAS7-U09-04 | `InsightService.createRecommendation()` | Recommendation generation fails | Stored summary exists; console spy empty | Student `s1` | Rejects `UnavailableError("recommendationUnavailable")` | Cause logged; insert absent | `llm.generateRecommendation(...) -> throws llmError` |
| UT-DAS7-U09-05 | `InsightService.createRecommendation()` | Recommendation insert fails | Stored summary exists | Student `s1` | Repository error propagates | Generation and attempted insert recorded | LLM returns advice; insert throws database error |
| UT-DAS7-U10-01 | `OpenRouterLlmClient.generateRecommendation()` | Successful request uses student and stored summary | Fetch history empty | Student Amy and summary `sum1` | Returns three plain lines; request contains Amy and summary content | One fetch | Fetch returns three lines |
| UT-DAS7-U10-02 | `OpenRouterLlmClient.generateRecommendation()` | Symbol marker is removed | Fetch history empty | Content `- Read together` | Returns `Read together` | One fetch | Fetch returns selected content |
| UT-DAS7-U10-03 | `OpenRouterLlmClient.generateRecommendation()` | Numeric marker is removed | Fetch history empty | Content `1) Read together` | Returns `Read together` | One fetch | Fetch returns selected content |
| UT-DAS7-U10-04 | `OpenRouterLlmClient.generateRecommendation()` | Blank lines are removed | Fetch history empty | Content has one suggestion surrounded by blank lines | Returns only the suggestion | One fetch | Fetch returns selected content |
| UT-DAS7-U10-05 | `OpenRouterLlmClient.generateRecommendation()` | Sanitized line count is 0 | Fetch history empty | Raw content is a standalone list marker | Throws `LlmUnavailableError("openrouter returned no advice lines")` | No output | Fetch returns `-` |
| UT-DAS7-U10-06 | `OpenRouterLlmClient.generateRecommendation()` | Sanitized line count is 1 | Fetch history empty | One advice line | Returns one line | One fetch | Fetch returns selected lines |
| UT-DAS7-U10-07 | `OpenRouterLlmClient.generateRecommendation()` | Sanitized line count is 2 | Fetch history empty | Two advice lines | Returns two lines | One fetch | Fetch returns selected lines |
| UT-DAS7-U10-08 | `OpenRouterLlmClient.generateRecommendation()` | Sanitized line count is 3 | Fetch history empty | Three advice lines | Returns three lines | One fetch | Fetch returns selected lines |
| UT-DAS7-U10-09 | `OpenRouterLlmClient.generateRecommendation()` | Sanitized line count is 4 | Fetch history empty | Four advice lines | Returns four lines | One fetch | Fetch returns selected lines |
| UT-DAS7-U10-10 | `OpenRouterLlmClient.generateRecommendation()` | Sanitized line count is 5 | Fetch history empty | Five advice lines | Returns five lines | One fetch | Fetch returns selected lines |
| UT-DAS7-U10-11 | `OpenRouterLlmClient.generateRecommendation()` | Sanitized line count is 6 | Fetch history empty | Six advice lines | Returns only the first five | One fetch; sixth line dropped | Fetch returns selected lines |
| UT-DAS7-U11-01 | `RecommendationRepo.insert()` | Insert succeeds | Fake history empty | `{ summaryId: "sum1", content: "advice" }` | Returns mapped recommendation | Snake-case insert, select, and single recorded | Query returns saved row |
| UT-DAS7-U11-02 | `RecommendationRepo.insert()` | Insert fails | Fake history empty | Valid recommendation input | Throws `Error("db: down")` | Attempted insert recorded | Query returns database error |

## Save preferences and notify parent

| Test ID | Target Unit | Test scenario | State before | Inputs | Expected outputs | State after | Mocked input/output pairs |
|---|---|---|---|---|---|---|---|
| UT-DAS7-U12-01 | `PreferencesRoutes.preferencesRoutes()` PUT `/:parentId/preferences` | Own valid request succeeds | Router attaches parent `p1` | PUT `/p1/preferences` with valid body | Status 200 with saved preference | Exact body passed once | `preferenceService.save("p1", body) -> savedPref` |
| UT-DAS7-U12-02 | `PreferencesRoutes.preferencesRoutes()` PUT `/:parentId/preferences` | URL parent is foreign | Router attaches parent `p1` | PUT `/p2/preferences` | Status 404 with `notFound` | Service is not called | None |
| UT-DAS7-U13-01 | `PreferenceService.save()` | Body is not an object | Repo history empty | `null` | Throws object-body `ValidationError` | Upsert absent | None |
| UT-DAS7-U13-02 | `PreferenceService.save()` | Enabled value is invalid | Repo history empty | Object with `enabled: "true"` | Throws enabled-field `ValidationError` | Upsert absent | None |
| UT-DAS7-U13-03 | `PreferenceService.save()` | Frequency is invalid | Enabled is valid | Frequency `"weekly"` | Throws frequency-field `ValidationError` | Upsert absent | None |
| UT-DAS7-U13-04 | `PreferenceService.save()` | Email is invalid | Earlier fields valid | Email `parent@example` | Throws email-field `ValidationError` | Upsert absent | None |
| UT-DAS7-U13-05 | `PreferenceService.save()` | Valid body is normalized | Repo history empty | URL parent `p1`; body parent `p2`; email ` Parent@Example.COM ` | Returns saved preference | Upsert uses `p1` and `parent@example.com`; input is not mutated | `preferenceRepo.upsert(expected) -> savedPref` |
| UT-DAS7-U13-06 | `PreferenceService.save()` | Upsert fails | Valid body | Parent `p1` | Database error propagates | One attempted upsert | `preferenceRepo.upsert(expected) -> throws dbError` |
| UT-DAS7-U14-01 | `PreferenceRepo.upsert()` | Upsert succeeds | Fake Supabase history empty | Complete preference | Returns mapped saved preference | Payload, `onConflict: "parent_id"`, select, and single recorded | Query returns saved row |
| UT-DAS7-U14-02 | `PreferenceRepo.upsert()` | Upsert fails | Fake history empty | Complete preference | Throws `Error("db: down")` | Attempted upsert recorded | Query returns database error |
| UT-DAS7-U15-01 | `NotificationRoutes.notificationRoutes()` POST `/:parentId/notifications` | Manual notification succeeds | Router attaches parent `p1`; fixed clock | POST `/p1/notifications` | Status 200 with `parentNotified` | Notifier called once with fixed Date | `notifyParent("p1", now) -> "parentNotified"` |
| UT-DAS7-U15-02 | `NotificationRoutes.notificationRoutes()` POST `/:parentId/notifications` | Manual notification fails | Router attaches parent `p1` | POST `/p1/notifications` | Status 503 with `notificationFailed` | One notifier call | `notifyParent("p1", now) -> "notificationFailed"` |
| UT-DAS7-U16-01 | `Scheduler.start()` | Interval is 0 ms | Scheduler stopped; fake timers | `start()` with `tickMs=0` | Returns void and installs exact interval | Scheduler running; timer unreferenced | `setInterval(callback,0) -> timer` |
| UT-DAS7-U16-02 | `Scheduler.start()` | Interval is 1 ms | Scheduler stopped; fake timers | `start()` with `tickMs=1` | Returns void and installs exact interval | Scheduler running; timer unreferenced | `setInterval(callback,1) -> timer` |
| UT-DAS7-U16-03 | `Scheduler.start()` | Interval is 2 ms | Scheduler stopped; fake timers | `start()` with `tickMs=2` | Returns void and installs exact interval | Scheduler running; timer unreferenced | `setInterval(callback,2) -> timer` |
| UT-DAS7-U16-04 | `Scheduler.start()` | Start is repeated while running | Scheduler running | Call `start()` again | Returns void | Original timer remains; no second interval | Existing fake timer |
| UT-DAS7-U16-05 | `Scheduler` tick callback | Time is one millisecond below tick | Scheduler running at fixed clock | Advance by `tickMs-1` | Run is not called | Scheduler remains running | None |
| UT-DAS7-U16-06 | `Scheduler` tick callback | Time is exactly at tick | Scheduler running at fixed clock | Advance by `tickMs` | Run called once with fixed-clock Date | Scheduler remains running | `run(now) -> resolves` |
| UT-DAS7-U16-07 | `Scheduler` tick callback | Time is one millisecond above tick | Scheduler running at fixed clock | Advance by `tickMs+1` | Run called once | Scheduler remains running | `run(now) -> resolves` |
| UT-DAS7-U16-08 | `Scheduler` tick callback | Run rejects | Scheduler running; console spy empty | Fire timer | Rejection is consumed and logged | Scheduler remains running | `run(now) -> rejects error`; console mock returns void |
| UT-DAS7-U16-09 | `Scheduler.stop()` | Stop is called while already stopped | Scheduler stopped | `stop()` | Returns void | No clear call | None |
| UT-DAS7-U16-10 | `Scheduler.stop()` | Active timer is stopped | Scheduler running | `stop()` | Returns void | Timer cleared; scheduler stopped | `clearInterval(timer) -> void` |
| UT-DAS7-U16-11 | `Scheduler.start()` | Scheduler restarts after stop | Scheduler started then stopped | `start()` | New interval installed | Scheduler running with a distinct timer | Second `setInterval -> newTimer` |
| UT-DAS7-U17-01 | `NotifierService.runDueNotifications()` | Preference loop has zero entries | Results empty | Fixed now | Returns `[]` | No last-send or delivery calls | `preferenceRepo.listEnabled() -> []` |
| UT-DAS7-U17-02 | `NotifierService.runDueNotifications()` | One preference is not due | Results empty | One recent preference | Returns `[]` | One last-send lookup; no delivery | List returns pref; last sent is recent |
| UT-DAS7-U17-03 | `NotifierService.runDueNotifications()` | One preference is due | Results empty | One preference with no prior send | Returns one successful parent result | One last-send lookup and one delivery path | Last sent null; notify dependencies succeed |
| UT-DAS7-U17-04 | `NotifierService.runDueNotifications()` | Preference loop has many mixed entries | Four preferences in fixed order | Due states false, true, false, true | Returns results for second and fourth parents in order | All last-send reads; delivery only for due parents | Per-parent timestamps and successful notify dependencies |
| UT-DAS7-U17-05 | `NotifierService.runDueNotifications()` | A due parent fails without stopping the loop | Two due preferences | Fixed now | Returns failure then success | Both delivery paths run | First notify dependencies fail; second succeed |
| UT-DAS7-U17-06 | `NotifierService.runDueNotifications()` | Last-send lookup fails mid-loop | Three preferences; first completed | Second lookup rejects | Rejects database error | Work after second lookup is absent | First lookup resolves; second throws |
| UT-DAS7-U17-07 | `NotifierService.runDueNotifications()` | Enabled-list lookup fails | Histories empty | Fixed now | Rejects database error | No loop work starts | `preferenceRepo.listEnabled() -> throws dbError` |
| UT-DAS7-U18-01 | `PreferenceRepo.listEnabled()` | Enabled list has zero rows | Fake history empty | Query returns `[]` | Returns `[]` | Select and `eq("enabled",true)` recorded | Query succeeds with empty data |
| UT-DAS7-U18-02 | `PreferenceRepo.listEnabled()` | Enabled list has one row | Fake history empty | Query returns one row | Returns one mapped preference | Expected query recorded | Query returns one row |
| UT-DAS7-U18-03 | `PreferenceRepo.listEnabled()` | Enabled list has many rows | Fake history empty | Query returns three rows | Returns three mapped preferences in order | Expected query recorded | Query returns three rows |
| UT-DAS7-U18-04 | `PreferenceRepo.listEnabled()` | Query fails | Fake history empty | Enabled-list call | Throws `Error("db: down")` | Failed query recorded | Query returns database error |
| UT-DAS7-U19-01 | `EmailNotificationRepo.lastSentAt()` | Prior send is absent | Fake history empty | Parent `p1` | Returns null | Descending `sent_at`, limit 1, and `maybeSingle` recorded | Query returns null |
| UT-DAS7-U19-02 | `EmailNotificationRepo.lastSentAt()` | Prior send is present | Fake history empty | Parent `p1` | Returns exact timestamp | Expected query recorded | Query returns `{ sent_at: timestamp }` |
| UT-DAS7-U19-03 | `EmailNotificationRepo.lastSentAt()` | Query fails | Fake history empty | Parent `p1` | Throws `Error("db: down")` | Failed query recorded | Query returns database error |
| UT-DAS7-U20-01 | `NotifierService.isDue()` | No prior send | Fixed now | `lastSentAt=null`; Weekly | Returns true | No state change | None |
| UT-DAS7-U20-02 | `NotifierService.isDue()` | Prior timestamp is invalid | Fixed now | `lastSentAt="invalid"`; Weekly | Returns true | No state change | None |
| UT-DAS7-U20-03 | `NotifierService.isDue()` | Weekly elapsed time is one millisecond below interval | Fixed now | `lastSentAt=now-weekly+1ms` | Returns false | No state change | None |
| UT-DAS7-U20-04 | `NotifierService.isDue()` | Weekly elapsed time equals interval | Fixed now | `lastSentAt=now-weekly` | Returns true | No state change | None |
| UT-DAS7-U20-05 | `NotifierService.isDue()` | Weekly elapsed time is one millisecond above interval | Fixed now | `lastSentAt=now-weekly-1ms` | Returns true | No state change | None |
| UT-DAS7-U20-06 | `NotifierService.isDue()` | Fortnightly elapsed time equals interval | Fixed now | Fortnightly and exact interval | Returns true | No state change | None |
| UT-DAS7-U20-07 | `NotifierService.isDue()` | Monthly elapsed time equals interval | Fixed now | Monthly and exact interval | Returns true | No state change | None |
| UT-DAS7-U20-08 | `NotifierService.isDue()` | Last send is one millisecond before now | Fixed now; interval greater than 1 ms | `lastSentAt=now-1ms` | Returns false | No state change | None |
| UT-DAS7-U20-09 | `NotifierService.isDue()` | Last send equals now | Fixed now | `lastSentAt=now` | Returns false | No state change | None |
| UT-DAS7-U20-10 | `NotifierService.isDue()` | Last send is one millisecond in the future | Fixed now | `lastSentAt=now+1ms` | Returns false | No state change | None |
| UT-DAS7-U21-01 | `NotifierService.notifyParent()` | Preference is absent | Histories empty; console spy empty | Parent `p1` | Returns `notificationFailed` | Failure logged; later calls absent | `preferenceRepo.byParentId("p1") -> null` |
| UT-DAS7-U21-02 | `NotifierService.notifyParent()` | Preference is disabled | Histories empty | Parent `p1` | Returns `notificationFailed` | Parent and later calls absent | Preference lookup returns disabled preference |
| UT-DAS7-U21-03 | `NotifierService.notifyParent()` | Parent is absent | Enabled preference exists | Parent `p1` | Returns `notificationFailed` | Student and later calls absent | `parentRepo.byId("p1") -> null` |
| UT-DAS7-U21-04 | `NotifierService.notifyParent()` | Student loop has zero entries | Preference and parent exist | Parent `p1` | Returns `notificationFailed` | Summary, email, and record calls absent | `studentRepo.listByParent("p1") -> []` |
| UT-DAS7-U21-05 | `NotifierService.notifyParent()` | Student loop has one entry | Valid preference, parent, and one student | Parent `p1` | Returns `parentNotified` | One summary, email, then notification insert | Summary, email, and insert all succeed |
| UT-DAS7-U21-06 | `NotifierService.notifyParent()` | Student loop has many entries | Three students in fixed order | Parent `p1` | Returns `parentNotified` | Summaries, subject, and body preserve order; record uses first summary ID | Three summaries, email, and insert succeed |
| UT-DAS7-U21-07 | `NotifierService.notifyParent()` | Summary fails mid-loop | Three students | Second summary rejects | Returns `notificationFailed` | Third summary, email, and record calls absent | First summary resolves; second throws |
| UT-DAS7-U21-08 | `NotifierService.notifyParent()` | Email send fails | All summaries resolved | Parent `p1` | Returns `notificationFailed` | Email attempted; notification row absent | `email.send(expected) -> throws EmailSendError` |
| UT-DAS7-U21-09 | `NotifierService.notifyParent()` | Notification insert fails after send | Email succeeds; console spy empty | Parent `p1` | Returns `parentNotified` | Sent email remains; record failure logged | Email resolves; notification insert throws |
| UT-DAS7-U21-10 | `NotifierService.notifyParent()` | Preference lookup rejects | Histories empty | Parent `p1` | Returns `notificationFailed` | Later calls absent; failure logged | Preference lookup throws database error |
| UT-DAS7-U21-11 | `NotifierService.notifyParent()` | Parent lookup rejects | Preference lookup succeeds | Parent `p1` | Returns `notificationFailed` | Student and later calls absent | Parent lookup throws database error |
| UT-DAS7-U21-12 | `NotifierService.notifyParent()` | Student lookup rejects | Preference and parent lookups succeed | Parent `p1` | Returns `notificationFailed` | Summary and later calls absent | Student lookup throws database error |
| UT-DAS7-U22-01 | `PreferenceRepo.byParentId()` | Preference is absent | Fake history empty | Parent `p1` | Returns null | Table, select, filter, and `maybeSingle` recorded | Query returns null |
| UT-DAS7-U22-02 | `PreferenceRepo.byParentId()` | Preference is present | Fake history empty | Parent `p1` | Returns mapped preference | Expected query recorded | Query returns preference row |
| UT-DAS7-U22-03 | `PreferenceRepo.byParentId()` | Query fails | Fake history empty | Parent `p1` | Throws `Error("db: down")` | Failed query recorded | Query returns database error |
| UT-DAS7-U23-01 | `ParentRepo.byId()` | Parent is absent | Fake history empty | Parent `p1` | Returns null | Parent query only; link query absent | Parent query returns null |
| UT-DAS7-U23-02 | `ParentRepo.byId()` | Guardian-link loop has zero entries | Parent row exists | Parent `p1` | Returns mapped parent with `studentIds=[]` | Parent and link queries recorded | Link query returns `[]` |
| UT-DAS7-U23-03 | `ParentRepo.byId()` | Guardian-link loop has one entry | Parent row exists | Parent `p1` | Returns parent with one student ID | Parent then link query | Link query returns one link |
| UT-DAS7-U23-04 | `ParentRepo.byId()` | Guardian-link loop has many entries | Parent row exists | Parent `p1` | Returns IDs in query order | Parent then link query | Link query returns three links |
| UT-DAS7-U23-05 | `ParentRepo.byId()` | Parent query fails | Fake history empty | Parent `p1` | Throws `Error("db: down")` | Link query absent | Parent query returns database error |
| UT-DAS7-U23-06 | `ParentRepo.byId()` | Guardian-link query fails | Parent row exists | Parent `p1` | Throws `Error("db: down")` | Both attempted queries recorded | Link query returns database error |
| UT-DAS7-U24-01 | `StudentRepo.listByParent()` | Link loop has zero entries | Fake history empty | Parent `p1` | Returns `[]` | Student query absent | Link query returns `[]` |
| UT-DAS7-U24-02 | `StudentRepo.listByParent()` | Link loop has one entry | Fake history empty | Parent `p1` | Returns one mapped student | Link query then student `.in()` query | Queries return one link and one student |
| UT-DAS7-U24-03 | `StudentRepo.listByParent()` | Link loop has many entries | Fake history empty | Parent `p1` | Returns mapped students in database response order | `.in()` receives all linked IDs | Queries return three links and students |
| UT-DAS7-U24-04 | `StudentRepo.listByParent()` | Link query fails | Fake history empty | Parent `p1` | Throws `Error("db: down")` | Student query absent | Link query returns database error |
| UT-DAS7-U24-05 | `StudentRepo.listByParent()` | Student query fails | Link query succeeds | Parent `p1` | Throws `Error("db: down")` | Both query attempts recorded | Student query returns database error |
| UT-DAS7-U25-01 | `StudentRepo.byId()` | Student is absent | Fake history empty | Student `s1` | Returns null | Select, ID filter, and `maybeSingle` recorded | Query returns null |
| UT-DAS7-U25-02 | `StudentRepo.byId()` | Student is present | Fake history empty | Student `s1` | Returns mapped student | Expected query recorded | Query returns student row |
| UT-DAS7-U25-03 | `StudentRepo.byId()` | Query fails | Fake history empty | Student `s1` | Throws `Error("db: down")` | Failed query recorded | Query returns database error |
| UT-DAS7-U26-01 | `BrevoEmailProvider.send()` | Send succeeds with default sender name | Fetch history empty | Config omits `fromName`; valid email | Resolves void; request uses `DAS Parent Insights` | One fetch | Fetch returns 202 |
| UT-DAS7-U26-02 | `BrevoEmailProvider.send()` | Send succeeds with configured sender name | Fetch history empty | `fromName="DAS Team"`; valid email | Resolves void; request uses `DAS Team` | One fetch | Fetch returns 202 |
| UT-DAS7-U26-03 | `BrevoEmailProvider.send()` | Network request fails | Fetch history empty | Valid email | Throws normalized `EmailSendError`; key absent | No retry | Fetch rejects `Error("offline")` |
| UT-DAS7-U26-04 | `BrevoEmailProvider.send()` | Request times out | Fetch history empty | Valid email | Throws timeout `EmailSendError`; key absent | No retry | Fetch rejects an error named `TimeoutError` |
| UT-DAS7-U26-05 | `BrevoEmailProvider.send()` | Provider returns non-2xx | Fetch history empty | Valid email | Throws `EmailSendError("brevo responded 400")` | No retry | Fetch returns status 400 |
| UT-DAS7-U27-01 | `EmailNotificationRepo.insert()` | Insert succeeds with summary ID | Fake history empty | Complete input with `summaryId="sum1"` | Resolves void | Exact snake-case payload recorded | Insert returns `{ error: null }` |
| UT-DAS7-U27-02 | `EmailNotificationRepo.insert()` | Insert succeeds without summary ID | Fake history empty | Complete input with `summaryId=null` | Resolves void | Null summary ID preserved in payload | Insert returns `{ error: null }` |
| UT-DAS7-U27-03 | `EmailNotificationRepo.insert()` | Insert fails | Fake history empty | Complete input | Throws `Error("db: down")` | Attempted insert recorded | Insert returns database error |

## Cross-cutting authentication, authorization, and mapping units

These units execute before, below, or beside the sequence-diagram activations. They are included because controller tests mock them, so their behavior would otherwise remain untested in isolation.

| Test ID | Target Unit | Test scenario | State before | Inputs | Expected outputs | State after | Mocked input/output pairs |
|---|---|---|---|---|---|---|---|
| UT-DAS7-U28-01 | `Auth.createAuthenticate()` middleware | Authorization header is absent | Request has no parent | No `Authorization` header | Rejects `UnauthorizedError` | Parent remains absent; verifier, repository, and `next` are not called | None |
| UT-DAS7-U28-02 | `Auth.createAuthenticate()` middleware | Authorization header is malformed | Request has no parent | `Authorization: Basic token` | Rejects `UnauthorizedError` | Parent remains absent; verifier, repository, and `next` are not called | None |
| UT-DAS7-U28-03 | `Auth.createAuthenticate()` middleware | Canonical Bearer header succeeds | Request has no parent | `Authorization: Bearer token` | Resolves and calls `next()` once | `req.parent` is attached | `jwtVerify("token", jwks, issuer) -> { payload: { sub: "auth1" } }`; parent lookup returns parent |
| UT-DAS7-U28-04 | `Auth.createAuthenticate()` middleware | Case-insensitive Bearer with repeated spaces succeeds | Request has no parent | `Authorization: bearer   token` | Extracts exactly `token` and resolves | `req.parent` is attached; `next()` called once | Verifier returns subject; parent lookup returns parent |
| UT-DAS7-U28-05 | `Auth.createAuthenticate()` middleware | JWT token validation fails | Request has no parent | Valid Bearer header | Rejects `UnauthorizedError` | Parent lookup and `next` are absent | `jwtVerify(...) -> throws JWTExpired` |
| UT-DAS7-U28-06 | `Auth.createAuthenticate()` middleware | Remote JWKS lookup times out | Request has no parent | Valid Bearer header | Rejects `UnavailableError("authUnavailable")` | Parent lookup and `next` are absent | `jwtVerify(...) -> throws JWKSTimeout` |
| UT-DAS7-U28-07 | `Auth.createAuthenticate()` middleware | JOSE reports a generic infrastructure error | Request has no parent | Valid Bearer header | Rejects `UnavailableError("authUnavailable")` | Parent lookup and `next` are absent | `jwtVerify(...) -> throws JOSEError` with code `ERR_JOSE_GENERIC` |
| UT-DAS7-U28-08 | `Auth.createAuthenticate()` middleware | Verifier throws a non-JOSE error | Request has no parent | Valid Bearer header | Rejects `UnavailableError("authUnavailable")` | Parent lookup and `next` are absent | `jwtVerify(...) -> throws Error("network")` |
| UT-DAS7-U28-09 | `Auth.createAuthenticate()` middleware | Verified payload omits subject | Request has no parent | Valid Bearer header | Rejects `UnauthorizedError` | Parent lookup and `next` are absent | Verifier returns `{ payload: {} }` |
| UT-DAS7-U28-10 | `Auth.createAuthenticate()` middleware | Valid platform user is not a registered parent | Request has no parent | Valid Bearer header | Rejects `ForbiddenError` | Parent remains absent; `next` is not called | Verifier returns `sub="auth1"`; parent lookup returns null |
| UT-DAS7-U28-11 | `Auth.createAuthenticate()` middleware | Parent identity lookup fails | Request has no parent | Valid Bearer header | Repository error propagates | Parent remains absent; `next` is not called | Verifier returns `sub="auth1"`; parent lookup throws database error |
| UT-DAS7-U28-12 | `Auth.createAuthenticate()` middleware | JWKS URL and normalized issuer are configured correctly | Mock histories empty | Supabase URL with trailing slashes and configured JWKS URL | Authentication succeeds; verifier receives issuer without trailing slashes | Parent attached; one JWKS construction and verification | JWKS factory returns mock set; verifier and parent lookup succeed |
| UT-DAS7-U29-01 | `Auth.requireOwnStudent()` | Parent is the student's guardian | No state | Parent `p1`; student `s1` | Resolves void | No state change | `studentRepo.isGuardian("p1","s1") -> true` |
| UT-DAS7-U29-02 | `Auth.requireOwnStudent()` | Parent is not the student's guardian | No state | Parent `p1`; student `s1` | Rejects `NotFoundError("progressUnavailable")` | No state change | `studentRepo.isGuardian("p1","s1") -> false` |
| UT-DAS7-U29-03 | `Auth.requireOwnStudent()` | Guardianship lookup fails | No state | Parent `p1`; student `s1` | Repository error propagates | No state change | `studentRepo.isGuardian("p1","s1") -> throws dbError` |
| UT-DAS7-U29-04 | `Auth.requireOwnParent()` | Authenticated and requested parent IDs match | No state | Parent `p1`; URL parent `p1` | Returns void | No state change | None |
| UT-DAS7-U29-05 | `Auth.requireOwnParent()` | Authenticated and requested parent IDs differ | No state | Parent `p1`; URL parent `p2` | Throws default `NotFoundError` | No state change | None |
| UT-DAS7-U30-01 | `StudentRepo.isGuardian()` | Guardian link is present | Fake Supabase history empty | Parent `p1`; student `s1` | Returns true | Both equality filters and `maybeSingle` recorded | Query returns `{ student_id: "s1" }` |
| UT-DAS7-U30-02 | `StudentRepo.isGuardian()` | Guardian link is absent | Fake history empty | Parent `p1`; student `s1` | Returns false | Both equality filters and `maybeSingle` recorded | Query returns null |
| UT-DAS7-U30-03 | `StudentRepo.isGuardian()` | Guardian-link query fails | Fake history empty | Parent `p1`; student `s1` | Throws `Error("db: down")` | Failed query chain recorded | Query returns database error |
| UT-DAS7-U31-01 | `ParentRepo.byAuthUserId()` | Auth user has no parent row | Fake Supabase history empty | Auth user `auth1` | Returns null | Parent query recorded; link query absent | Parent query returns null |
| UT-DAS7-U31-02 | `ParentRepo.byAuthUserId()` | Parent has zero guardian links | Parent row exists | Auth user `auth1` | Returns mapped parent with `studentIds=[]` | Parent then link query recorded | Link query returns `[]` |
| UT-DAS7-U31-03 | `ParentRepo.byAuthUserId()` | Parent has one guardian link | Parent row exists | Auth user `auth1` | Returns mapped parent with one student ID | Parent then link query recorded | Link query returns one link |
| UT-DAS7-U31-04 | `ParentRepo.byAuthUserId()` | Parent has many guardian links | Parent row exists | Auth user `auth1` | Returns mapped parent with IDs in query order | Parent then link query recorded | Link query returns three links |
| UT-DAS7-U31-05 | `ParentRepo.byAuthUserId()` | Parent query fails | Fake history empty | Auth user `auth1` | Throws `Error("db: down")` | Link query absent | Parent query returns database error |
| UT-DAS7-U31-06 | `ParentRepo.byAuthUserId()` | Guardian-link query fails | Parent row exists | Auth user `auth1` | Throws `Error("db: down")` | Both attempted queries recorded | Link query returns database error |
| UT-DAS7-U32-01 | `Mappers.rowToParent()` | Parent row and student IDs are mapped | No state | Complete parent row; `studentIds=["s1","s2","s3"]` | Returns exact camel-case parent without `auth_user_id`; preserves ID order | Inputs unchanged | None |
| UT-DAS7-U32-02 | `Mappers.rowToStudent()` | Student row is mapped | No state | Complete snake-case student row | Returns exact `studentId`, name, `dateOfBirth`, and `bandLevel` | Input unchanged | None |
| UT-DAS7-U32-03 | `Mappers.rowToProgressRecord()` | Progress row is mapped | No state | Complete row including `created_at` | Returns exact domain fields; date stays a string and `created_at` is omitted | Input unchanged | None |
| UT-DAS7-U32-04 | `Mappers.rowToSummary()` | Summary row is mapped | No state | Complete snake-case summary row | Returns exact camel-case summary; timestamp unchanged | Input unchanged | None |
| UT-DAS7-U32-05 | `Mappers.rowToRecommendation()` | Recommendation row is mapped | No state | Complete snake-case recommendation row | Returns exact camel-case recommendation | Input unchanged | None |
| UT-DAS7-U32-06 | `Mappers.rowToPreference()` | Representative preference row is mapped | No state | Weekly row with `enabled=true` | Returns exact camel-case preference | Input unchanged | None |

## Isolation and implementation notes

| Item | Requirement |
|---|---|
| Direct mocks only | Mock only the outgoing arrows of the target unit. For example, controller tests mock ownership and service calls; service tests mock repositories and providers; repository tests mock the Supabase client chain. |
| JWT isolation | `auth.ts` closes over `createRemoteJWKSet()` and `jwtVerify()`. Mock `jose` before importing the module, using ESM-aware Jest module mocking, so no unit test contacts a real JWKS endpoint. |
| Supabase repository fake | Use an immediate fluent fake that records `from`, `select`, filters, ordering, limits, and write payloads, then resolves the row's `{ data, error }` pair. It does not replace database integration testing. |
| Fixed time | Use Jest fake timers and a fixed system clock for freshness, due-time, route Date, and scheduler rows. Restore timers after every test. |
| Provider cleanup | Restore `fetch`, `AbortSignal.timeout`, console spies, and clock state after every row. Assert that configured API keys never appear in thrown messages. |
| Deferred integration work | Real Supabase ordering, constraints, generated values, RLS, provider schemas, credentials, email delivery, and the end-to-end activation order belong in the later sequence-diagram integration suite. |
