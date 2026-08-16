# DAS 7 unit testing plan

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
| `SupabaseRepository.getNotificationData()` | `NotifierService.notifyParent()` |
| `SupabaseRepository.getProgressAndSummary()` | `InsightService.getSummary()` |
| `SupabaseRepository.saveNotification()` | `EmailNotificationRepo.insert()` |
| `LLMAdapter` | `OpenRouterLlmClient.generateSummary()` and `.generateRecommendation()` |
| `Email.sendEmail()` | `BrevoEmailProvider.send()` |

## Black-box techniques used

| Technique | Where used | Why it was chosen | Selection rule |
|---|---|---|---|
| Equivalence class testing | `StudentsRoutes.studentsRoutes()`, `InsightService.getSummary()`, `InsightService.createRecommendation()`, `ProgressRepo.listByStudent()`, `SummaryRepo.latestByStudent()`, `OpenRouterLlmClient.generateSummary()`, `PreferenceService.save()`, `NotificationRoutes.notificationRoutes()`, `EmailNotificationRepo.lastSentAt()`, `NotifierService.isDue()`, `NotifierService.notifyParent()`, and `BrevoEmailProvider.send()` | These methods handle inputs or dependency results from distinct classes, such as valid, invalid, missing, successful, and failed cases. | Keep one test row for each behaviorally distinct class included in this plan. |
| Normal boundary value analysis | `InsightService.getSummary()` | This comparison sits on a timestamp boundary, so an error of one millisecond could change whether the stored summary is reused. | Set the newest progress timestamp to 1 ms before, exactly equal to, and 1 ms after the stored summary's `generatedAt` timestamp. |
| Robust boundary value analysis | `NotifierService.isDue()` | The notification interval has an exact due-time boundary. Elapsed time also has a lower valid boundary of 0 ms, which makes a future `lastSentAt` the nearest out-of-range case. | Test elapsed time 1 ms below, exactly at, and 1 ms above the notification interval. Also test `lastSentAt` 1 ms before now, exactly now, and 1 ms after now. |
| Decision table testing | `StudentsRoutes.studentsRoutes()`, `InsightService.getSummary()`, `InsightService.createRecommendation()`, `NotificationRoutes.notificationRoutes()`, `NotifierService.runDueNotifications()`, and `NotifierService.notifyParent()` | The result changes with combinations of ownership, stored data, dependency outcomes, and due-state conditions. Once one condition decides the result, later calls should not run. | Keep one test row for each feasible rule or short-circuit outcome included in this plan. |

## Track child progress and recommendations

| Test ID | Target Unit | Test scenario | State before | Inputs | Expected outputs | State after | Mocked input/output pairs |
|---|---|---|---|---|---|---|---|
| UT-DAS7-U01-01 | `StudentsRoutes.studentsRoutes()` GET `/:studentId/track-progress` | Owned student succeeds | Router attaches parent `p1` | GET `/s1/track-progress` | Status 200 with the service result | Ownership checked before one service call | `studentRepo.isGuardian("p1","s1") -> true`; `insightService.trackProgress("s1") -> result` |
| UT-DAS7-U01-02 | `StudentsRoutes.studentsRoutes()` GET `/:studentId/track-progress` | Student is not owned | Router attaches parent `p1` | GET `/s1/track-progress` | Status 404 with `progressUnavailable` | Service is not called | `studentRepo.isGuardian("p1","s1") -> false` |
| UT-DAS7-U01-03 | `StudentsRoutes.studentsRoutes()` POST `/:studentId/recommendations` | Owned student succeeds | Router attaches parent `p1` | POST `/s1/recommendations` | Status 200 with recommendation | Ownership checked before one service call | Guardian true; `createRecommendation("s1") -> recommendation` |
| UT-DAS7-U02-01 | `InsightService.trackProgress()` | Shared summary path succeeds | Dependency histories empty | Student `s1` | Returns `{ progress: secondRecords, summary }` | Progress is read during summary work and once again for the response | Direct repository and LLM calls produce `summary`; final `listByStudent("s1") -> secondRecords` |
| UT-DAS7-U03-02 | `InsightService.getSummary()` | Student has zero progress records | Histories empty | Student `s1` | Rejects `UnavailableError("progressUnavailable")` | Summary, timestamp, LLM, and insert calls are absent | Student lookup returns student; `progressRepo.listByStudent("s1") -> []` |
| UT-DAS7-U03-03 | `InsightService.getSummary()` | Stored summary exists and newest timestamp is absent | Stored summary `sum1` | Student `s1` | Returns `sum1` | No generation or insert | Student and progress exist; latest summary is `sum1`; `latestCreatedAt("s1") -> null` |
| UT-DAS7-U03-04 | `InsightService.getSummary()` | Freshness boundary is one millisecond below | Summary generated at `2026-01-02T00:00:00.000Z` | Newest progress at `2026-01-01T23:59:59.999Z` | Returns stored summary | No generation or insert | Lookups return the stated values |
| UT-DAS7-U03-05 | `InsightService.getSummary()` | Freshness boundary is exactly equal | Summary generated at `2026-01-02T00:00:00.000Z` | Newest progress at the same timestamp | Returns stored summary | No generation or insert | Lookups return the stated values |
| UT-DAS7-U03-06 | `InsightService.getSummary()` | Freshness boundary is one millisecond above | Stored summary is stale | Newest progress at `2026-01-02T00:00:00.001Z` | Returns inserted fresh summary | One generation and one insert | `llm.generateSummary(...) -> "fresh"`; `summaryRepo.insert(...) -> freshSummary` |
| UT-DAS7-U03-07 | `InsightService.getSummary()` | Stored summary is absent | Student and progress exist | Student `s1` | Returns inserted fresh summary | One generation and one insert | Latest summary returns null; LLM and insert succeed |
| UT-DAS7-U03-08 | `InsightService.getSummary()` | Summary generation fails | Summary absent or stale; console spy empty | Student `s1` | Rejects `UnavailableError("summaryUnavailable")` | Cause logged; insert absent | `llm.generateSummary(...) -> throws llmError` |
| UT-DAS7-U04-03 | `ProgressRepo.listByStudent()` | Many rows | Fake history empty | Student `s1`; three ordered rows | Returns three mapped records in response order | One ordered query recorded | Query returns three rows |
| UT-DAS7-U04-04 | `ProgressRepo.listByStudent()` | Query fails | Fake history empty | Student `s1` | Throws `Error("db: down")` | Failed query chain recorded | Query returns `{ data: null, error: { message: "down" } }` |
| UT-DAS7-U06-01 | `SummaryRepo.latestByStudent()` | Summary is absent | Fake history empty | Student `s1` | Returns null | Descending `generated_at`, limit 1, and `maybeSingle` recorded | Query returns null |
| UT-DAS7-U06-02 | `SummaryRepo.latestByStudent()` | Summary is present | Fake history empty | Student `s1` | Returns mapped summary | Expected query chain recorded | Query returns summary row |
| UT-DAS7-U07-03 | `OpenRouterLlmClient.generateSummary()` | Progress loop has many records | Fetch history empty | Student Amy; three records | Returns provider text; prompt preserves all three rows in order | One fetch | Fetch returns 200 with `summary` |
| UT-DAS7-U07-11 | `OpenRouterLlmClient.generateSummary()` | Network request fails | Fetch history empty | Valid generation input | Throws normalized `LlmUnavailableError`; key is absent | No retry | `fetch -> rejects Error("offline")` |
| UT-DAS7-U08-01 | `SummaryRepo.insert()` | Insert succeeds | Fake history empty | `{ studentId: "s1", content: "fresh" }` | Returns mapped database row | Snake-case insert, select, and single recorded | Query returns saved row |
| UT-DAS7-U09-02 | `InsightService.createRecommendation()` | Stored summary is absent | Student exists | Student `s1` | Rejects `NotFoundError("summaryUnavailable")` | No LLM or insert | Latest summary returns null |
| UT-DAS7-U09-03 | `InsightService.createRecommendation()` | Recommendation succeeds | Student and stored summary exist | Student `s1` | Returns inserted recommendation | One generation and one insert | LLM returns advice; insert returns recommendation |
| UT-DAS7-U10-01 | `OpenRouterLlmClient.generateRecommendation()` | Successful request uses student and stored summary | Fetch history empty | Student Amy and summary `sum1` | Returns three plain lines; request contains Amy and summary content | One fetch | Fetch returns three lines |
| UT-DAS7-U11-01 | `RecommendationRepo.insert()` | Insert succeeds | Fake history empty | `{ summaryId: "sum1", content: "advice" }` | Returns mapped recommendation | Snake-case insert, select, and single recorded | Query returns saved row |

## Save preferences and notify parent

| Test ID | Target Unit | Test scenario | State before | Inputs | Expected outputs | State after | Mocked input/output pairs |
|---|---|---|---|---|---|---|---|
| UT-DAS7-U12-01 | `PreferencesRoutes.preferencesRoutes()` PUT `/:parentId/preferences` | Own valid request succeeds | Router attaches parent `p1` | PUT `/p1/preferences` with valid body | Status 200 with saved preference | Exact body passed once | `preferenceService.save("p1", body) -> savedPref` |
| UT-DAS7-U13-03 | `PreferenceService.save()` | Frequency is invalid | Enabled is valid | Frequency `"weekly"` | Throws frequency-field `ValidationError` | Upsert absent | None |
| UT-DAS7-U13-05 | `PreferenceService.save()` | Valid body is normalized | Repo history empty | URL parent `p1`; body parent `p2`; email ` Parent@Example.COM ` | Returns saved preference | Upsert uses `p1` and `parent@example.com`; input is not mutated | `preferenceRepo.upsert(expected) -> savedPref` |
| UT-DAS7-U14-01 | `PreferenceRepo.upsert()` | Upsert succeeds | Fake Supabase history empty | Complete preference | Returns mapped saved preference | Payload, `onConflict: "parent_id"`, select, and single recorded | Query returns saved row |
| UT-DAS7-U15-01 | `NotificationRoutes.notificationRoutes()` POST `/:parentId/notifications` | Manual notification succeeds | Router attaches parent `p1`; fixed clock | POST `/p1/notifications` | Status 200 with `parentNotified` | Notifier called once with fixed Date | `notifyParent("p1", now) -> "parentNotified"` |
| UT-DAS7-U15-02 | `NotificationRoutes.notificationRoutes()` POST `/:parentId/notifications` | Manual notification fails | Router attaches parent `p1` | POST `/p1/notifications` | Status 503 with `notificationFailed` | One notifier call | `notifyParent("p1", now) -> "notificationFailed"` |
| UT-DAS7-U16-06 | `Scheduler` tick callback | Time is exactly at tick | Scheduler running at fixed clock | Advance by `tickMs` | Run called once with fixed-clock Date | Scheduler remains running | `run(now) -> resolves` |
| UT-DAS7-U17-02 | `NotifierService.runDueNotifications()` | One preference is not due | Results empty | One recent preference | Returns `[]` | One last-send lookup; no delivery | List returns pref; last sent is recent |
| UT-DAS7-U17-03 | `NotifierService.runDueNotifications()` | One preference is due | Results empty | One preference with no prior send | Returns one successful parent result | One last-send lookup and one delivery path | Last sent null; notify dependencies succeed |
| UT-DAS7-U17-04 | `NotifierService.runDueNotifications()` | Preference loop has many mixed entries | Four preferences in fixed order | Due states false, true, false, true | Returns results for second and fourth parents in order | All last-send reads; delivery only for due parents | Per-parent timestamps and successful notify dependencies |
| UT-DAS7-U18-03 | `PreferenceRepo.listEnabled()` | Enabled list has many rows | Fake history empty | Query returns three rows | Returns three mapped preferences in order | Expected query recorded | Query returns three rows |
| UT-DAS7-U19-01 | `EmailNotificationRepo.lastSentAt()` | Prior send is absent | Fake history empty | Parent `p1` | Returns null | Descending `sent_at`, limit 1, and `maybeSingle` recorded | Query returns null |
| UT-DAS7-U19-02 | `EmailNotificationRepo.lastSentAt()` | Prior send is present | Fake history empty | Parent `p1` | Returns exact timestamp | Expected query recorded | Query returns `{ sent_at: timestamp }` |
| UT-DAS7-U20-01 | `NotifierService.isDue()` | No prior send | Fixed now | `lastSentAt=null`; Weekly | Returns true | No state change | None |
| UT-DAS7-U20-03 | `NotifierService.isDue()` | Weekly elapsed time is one millisecond below interval | Fixed now | `lastSentAt=now-weekly+1ms` | Returns false | No state change | None |
| UT-DAS7-U20-04 | `NotifierService.isDue()` | Weekly elapsed time equals interval | Fixed now | `lastSentAt=now-weekly` | Returns true | No state change | None |
| UT-DAS7-U20-05 | `NotifierService.isDue()` | Weekly elapsed time is one millisecond above interval | Fixed now | `lastSentAt=now-weekly-1ms` | Returns true | No state change | None |
| UT-DAS7-U20-08 | `NotifierService.isDue()` | Last send is one millisecond before now | Fixed now; interval greater than 1 ms | `lastSentAt=now-1ms` | Returns false | No state change | None |
| UT-DAS7-U20-09 | `NotifierService.isDue()` | Last send equals now | Fixed now | `lastSentAt=now` | Returns false | No state change | None |
| UT-DAS7-U20-10 | `NotifierService.isDue()` | Last send is one millisecond in the future | Fixed now | `lastSentAt=now+1ms` | Returns false | No state change | None |
| UT-DAS7-U21-01 | `NotifierService.notifyParent()` | Preference is absent | Histories empty; console spy empty | Parent `p1` | Returns `notificationFailed` | Failure logged; later calls absent | `preferenceRepo.byParentId("p1") -> null` |
| UT-DAS7-U21-06 | `NotifierService.notifyParent()` | Student loop has many entries | Three students in fixed order | Parent `p1` | Returns `parentNotified` | Summaries, subject, and body preserve order; record uses first summary ID | Three summaries, email, and insert succeed |
| UT-DAS7-U21-07 | `NotifierService.notifyParent()` | Summary fails mid-loop | Three students | Second summary rejects | Returns `notificationFailed` | Third summary, email, and record calls absent | First summary resolves; second throws |
| UT-DAS7-U21-08 | `NotifierService.notifyParent()` | Email send fails | All summaries resolved | Parent `p1` | Returns `notificationFailed` | Email attempted; notification row absent | `email.send(expected) -> throws EmailSendError` |
| UT-DAS7-U22-02 | `PreferenceRepo.byParentId()` | Preference is present | Fake history empty | Parent `p1` | Returns mapped preference | Expected query recorded | Query returns preference row |
| UT-DAS7-U23-03 | `ParentRepo.byId()` | Guardian-link loop has one entry | Parent row exists | Parent `p1` | Returns parent with one student ID | Parent then link query | Link query returns one link |
| UT-DAS7-U24-03 | `StudentRepo.listByParent()` | Link loop has many entries | Fake history empty | Parent `p1` | Returns mapped students in database response order | `.in()` receives all linked IDs | Queries return three links and students |
| UT-DAS7-U26-01 | `BrevoEmailProvider.send()` | Send succeeds with default sender name | Fetch history empty | Config omits `fromName`; valid email | Resolves void; request uses `DAS Parent Insights` | One fetch | Fetch returns 202 |
| UT-DAS7-U26-05 | `BrevoEmailProvider.send()` | Provider returns non-2xx | Fetch history empty | Valid email | Throws `EmailSendError("brevo responded 400")` | No retry | Fetch returns status 400 |
| UT-DAS7-U27-01 | `EmailNotificationRepo.insert()` | Insert succeeds with summary ID | Fake history empty | Complete input with `summaryId="sum1"` | Resolves void | Exact snake-case payload recorded | Insert returns `{ error: null }` |
