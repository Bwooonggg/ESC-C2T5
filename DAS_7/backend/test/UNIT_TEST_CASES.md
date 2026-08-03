# Unit Test Cases (Core Features)

Formal case table for the core DAS 7 backend features, as implemented in `test/unit/`. Run
with `npm test`.

These 24 cases are a subset of the 108 that currently pass. The remainder are further
variations on the same behaviours (extra malformed-header cases, each validation message,
each mapper field) and are summarised as prose in [UNIT_TESTS.md](UNIT_TESTS.md). All cases
run offline against in-file fakes — no database, no network, no API keys.

## Summary generation (`InsightService.getSummary` / `trackProgress`)

| ID | Feature / Use Case | Precondition | Input | Expected Output | Expected Postcondition |
| --- | --- | --- | --- | --- | --- |
| UT-01 | Generate a summary when none exists | Student `s1` exists with 2 progress records; summary repository empty; stub LLM returns `"generated"` | `getSummary("s1")` | `Summary` with `studentId="s1"`, `content="generated"` | Summary persisted (repository holds exactly 1 row); `generateSummary` called once |
| UT-02 | Reuse a summary that still covers the newest progress | Student `s1` has records; a stored summary whose `generatedAt` is later than the newest record's insert time | `getSummary("s1")` | The stored summary, unchanged | LLM never called; no new row written |
| UT-03 | Regenerate when progress arrived after the summary | Stored summary `generatedAt=T`; `progressRepo.latestCreatedAt` returns `T + 1 hour` | `getSummary("s1")` | A newly generated summary | LLM called once; repository now holds 2 summaries; the newer one is returned |
| UT-04 | Treat an unknown insert time as not stale | Stored summary present; `latestCreatedAt` returns `null` | `getSummary("s1")` | The stored summary | LLM never called |
| UT-05 | Reject an unknown student | Student repository returns `null` | `getSummary("missing")` | Throws `NotFoundError` with message `progressUnavailable` (404) | LLM never called; nothing written |
| UT-06 | Reject a student with no progress (IT7A-05) | Student `s1` exists; progress repository returns `[]` | `getSummary("s1")` | Throws `UnavailableError` with message `progressUnavailable` (503) | LLM never called; nothing written |
| UT-07 | Do not persist when generation fails (IT7A-07) | Student `s1` has records; LLM throws `LlmUnavailableError` | `getSummary("s1")` | Throws `UnavailableError` with message `summaryUnavailable` (503) | `summaryRepo.insert` never called — the insert sits after the try/catch |
| UT-08 | Return progress alongside the summary | Student `s1` has 2 records and no summary | `trackProgress("s1")` | `{ progress, summary }` — `progress` equals the stored records, `summary` is newly generated | Summary persisted |
| UT-09 | Propagate the no-progress failure through trackProgress | Student `s1` exists with no records | `trackProgress("s1")` | Throws `UnavailableError` (`progressUnavailable`) | Nothing written |

## Recommendations (`InsightService.createRecommendation`)

| ID | Feature / Use Case | Precondition | Input | Expected Output | Expected Postcondition |
| --- | --- | --- | --- | --- | --- |
| UT-10 | Generate from the latest stored summary | Student `s1` exists; summary `sum-1` on file; LLM returns advice lines | `createRecommendation("s1")` | `Recommendation` with `summaryId="sum-1"` and the generated content | Recommendation persisted; `generateSummary` never called — this path never triggers summary generation |
| UT-11 | Refuse without a summary (IT7A-08) | Student `s1` exists; summary repository returns `null` | `createRecommendation("s1")` | Throws `NotFoundError` with message `summaryUnavailable` (**404**, not 503) | LLM never called; nothing written |
| UT-12 | Do not persist when generation fails (IT7A-09) | Summary on file; LLM throws `LlmUnavailableError` | `createRecommendation("s1")` | Throws `UnavailableError` with message `recommendationUnavailable` (503) | `recommendationRepo.insert` never called |

## Authentication and authorization (`createAuthenticate`, guardianship helpers)

| ID | Feature / Use Case | Precondition | Input | Expected Output | Expected Postcondition |
| --- | --- | --- | --- | --- | --- |
| UT-13 | Accept a valid token and resolve the parent | `supabaseJwtSecret` configured; token signed with it, issuer `${supabaseUrl}/auth/v1`, `sub` matches a parent row | Request with `Authorization: Bearer <token>` | Middleware calls `next()` | `req.parent` set to the matching parent |
| UT-14 | Reject an expired token | Same, but `exp` in the past | Request with that token | Throws `UnauthorizedError` (401, message `unauthorised`) | `req.parent` unset; the reason is never disclosed to the caller |
| UT-15 | Reject a valid token whose user is not a registered parent | Token verifies; `parentRepo.byAuthUserId` returns `null` | Request with that token | Throws `UnauthorizedError` (401) | `req.parent` unset |
| UT-16 | Fence the dev fallback out of production | `authDevSub` set; `nodeEnv="production"` | Request with **no** `Authorization` header | Throws `UnauthorizedError` (401) | The fallback parent is never looked up |
| UT-17 | Make an unowned student indistinguishable from a missing one | `studentRepo.isGuardian` returns `false` | `requireOwnStudent(repo, parentA, "s-of-parentB")` | Throws `NotFoundError` with message `progressUnavailable` | Byte-identical to the result for a nonexistent student id — no existence oracle |
| UT-18 | Reject access to another parent's account | Caller is `parent-1` | `requireOwnParent(parent1, "parent-2")` | Throws `NotFoundError` (404 `notFound`) | Closes the IDOR the mock backend had |

## Notification preferences (`PreferenceService`)

| ID | Feature / Use Case | Precondition | Input | Expected Output | Expected Postcondition |
| --- | --- | --- | --- | --- | --- |
| UT-19 | Return a default when no preference is stored | No preference row; parent `p1` has email `p1@test.dev` | `get("p1")` | `{ parentId:"p1", enabled:false, frequency:"Weekly", recipientEmail:"p1@test.dev" }` | **Not persisted** — `upsert` never called |
| UT-20 | Save a valid preference, ignoring a body-supplied parentId | No stored row | `save("p1", { enabled:true, frequency:"Monthly", recipientEmail:"a@b.dev", parentId:"p2" })` | Preference with `parentId="p1"` | Upserted once; the body's `parentId` is ignored — it always comes from the URL |
| UT-21 | Normalise the recipient email | No stored row | `save("p1", { …, recipientEmail:"  Parent@X.COM " })` | `recipientEmail = "parent@x.com"` | Trimmed and lower-cased before validation, so surrounding whitespace is forgiven |
| UT-22 | Report the first validation failure only | No stored row | `save("p1", { enabled:"yes", frequency:"Daily", recipientEmail:42 })` | Throws `ValidationError` with exactly `` `enabled` must be true or false. `` | Nothing written; the later failures are not reported — one message per request |

## Notifications (`NotifierService`)

| ID | Feature / Use Case | Precondition | Input | Expected Output | Expected Postcondition |
| --- | --- | --- | --- | --- | --- |
| UT-23 | Notify a parent successfully | Enabled preference; parent has 2 students, both with progress; fake email provider in `ok` mode | `notifyParent("p1", now)` | Returns `'parentNotified'` | One email in the provider's history naming both students; one `email_notifications` row recorded |
| UT-24 | Record nothing when the email provider is down (IT7B-02 shape) | Same, but provider in `fail` mode | `notifyParent("p1", now)` | Returns `'notificationFailed'` — it never throws | Provider history empty **and** no notification row: the send precedes the insert, so a failed send provably leaves no record |

## Not covered by this table

- **Further auth variations** (16 more cases): each malformed `Authorization` header shape,
  foreign issuers, wrong signing secrets, missing `sub`.
- **Each validation message individually** (8 more cases): null / array / string bodies,
  missing `enabled`, unknown `frequency`, malformed and numeric `recipientEmail`.
- **Row mappers** (12 cases): snake_case → camelCase for all six row types, bare-date
  preservation, and internal columns being dropped.
- **Error-to-HTTP mapping** (11 cases): every `ApiError` subclass, the generic-error 500 path,
  unknown routes, and `/health` being reachable without a token.
- **Stub generator formatting** (9 cases) and **scheduler timer behaviour** (7 cases).
- **The `FakeEmailProvider` test double itself** (4 cases).
- **Integration coverage** — 26 cases against real Supabase, documented separately in
  [../docs/integration-test-plan.md](../docs/integration-test-plan.md).
