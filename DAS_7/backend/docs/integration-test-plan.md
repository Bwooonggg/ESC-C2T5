# Integration Test Plan

**5 suites, 26 cases, all passing.** Implemented in `test/integration/` and run as part of
`npm test`.

Unlike the unit suites, these run against the **real hosted Supabase project**: real
repositories, real HTTP routing through Express, and real Supabase Auth tokens minted by
signing in two test users. Only two things are substituted, both at the outermost boundary:

- **the LLM client** — a controllable wrapper around `StubLlmClient` that counts calls and can
  be switched to `'fail'` mode, so generator-failure cases are reproducible and no API quota
  is spent;
- **the email provider** — `FakeEmailProvider`, whose `history` array is asserted against
  directly.

Everything between the HTTP request and the database row is the production code path.

## Running them

```bash
npm test
```

Integration suites **skip themselves** unless the environment is configured. The guard, in
`test/helpers/harness.ts`, requires `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` and
`TEST_SUPABASE_REF`, and additionally checks that `SUPABASE_URL` contains `TEST_SUPABASE_REF`
— a deliberate safety catch so the suites cannot be pointed at a project you did not intend.
Also required: `SUPABASE_ANON_KEY` and the two test-user credential pairs
(`TEST_USER_A_EMAIL` / `_PASSWORD`, `TEST_USER_B_*`).

## Fixtures and cleanup

`createHarness()` builds the real app, signs in both test users for real ES256 tokens, and
inserts a fresh fixture set per run using generated UUIDs:

| Fixture | Purpose |
| --- | --- |
| `parentA` (linked to test user A) | The main caller |
| `studentA1` | Guardianship of parent A, **with** progress records |
| `studentA2` | Guardianship of parent A, **no** progress — drives the 503 path |
| `parentB` (linked to test user B) | The other parent, for authorization cases |
| `studentB1` | Guardianship of parent B — parent A must not be able to see it |

`createParent()` and `createStudent({ parentId, withProgress })` add further fixtures on
demand. Every id created is registered and removed in `cleanup()`, which deletes the parents
and students and lets `ON DELETE CASCADE` remove links, progress, summaries, recommendations,
preferences and notification rows. Deletion works because the suites use the `service_role`
key, which bypasses table grants and RLS.

**Fixture note for the notifier suite:** `parentA` deliberately includes a student with no
progress, which fails a whole-parent notification by design. The notification success cases
therefore create their own parent whose every student has progress, and assert by a
UUID-unique recipient address rather than by history length — `runDueNotifications` sweeps
every enabled preference in the shared database, so other rows may legitimately appear in the
same tick.

---

## Group 7A — Track Child's Progress

Traces to `sequenceDiagram7_1.puml`.

### `test/integration/track-progress.int.test.ts` (6 cases)

| Case | Scenario | Expected |
| --- | --- | --- |
| **IT7A-01 / 02** | `GET /students/{studentA1}/track-progress` as parent A | 200 with `progress` (date-ascending) and a generated `summary`; the summary is persisted; a second identical call returns the **same** summary id with the LLM call count still at 1 |
| — | `GET /students/{studentA1}/summary` | 200 with the same stored summary — the standalone endpoint shares the same code path |
| **IT7A-04** | A student id that does not exist | 404 `progressUnavailable` |
| **IT7A-04** | `studentB1` requested by parent A | 404 `progressUnavailable`, byte-identical to the nonexistent case |
| **IT7A-05** | `studentA2` (exists, no progress records) | 503 `progressUnavailable` |
| **IT7A-07** | Fresh student with progress; LLM switched to `fail` | 503 `summaryUnavailable`, and `summaryRepo.latestByStudent` is still `null` — nothing stored |

### `test/integration/recommendations.int.test.ts` (4 cases)

| Case | Scenario | Expected |
| --- | --- | --- |
| **IT7A-03** | Summary primed, then `POST /students/{studentA1}/recommendations` | 200; `data.summaryId` equals the stored summary's id; content carries newline-separated lines; the row is persisted |
| **IT7A-08** | Student with progress but no summary ever generated | 404 `summaryUnavailable` — *not* 503, and no summary is generated as a side effect |
| **IT7A-09** | Primed student; LLM switched to `fail` | 503 `recommendationUnavailable`, nothing stored |
| — | `POST` against `studentB1` as parent A | 404 `progressUnavailable` |

### `test/integration/auth.int.test.ts` (5 cases)

| Case | Scenario | Expected |
| --- | --- | --- |
| — | `GET /me` with no token | 401 `unauthorised` |
| — | `GET /me` with a non-JWT bearer value | 401 `unauthorised` |
| — | `GET /me` with parent A's real token | 200; the parent and both their students |
| **IT7A-06 (authn)** | `track-progress` with no token | 401 `unauthorised` |
| **IT7A-06 (authz)** | Parent A requesting `studentB1` | 404 `progressUnavailable`, with the response body compared against a random-UUID request and asserted identical |

> **On IT7A-06.** The PM3 table lists the expected result as "401 or 404". Those are two
> different failures, so the case is split: no or invalid credentials → **401**; valid
> credentials for someone else's child → **404**. The 404 is deliberate — a 403 would confirm
> that the student exists, letting a caller enumerate ids.

### `test/integration/preferences.int.test.ts` (5 cases)

| Case | Scenario | Expected |
| --- | --- | --- |
| — | `GET` preferences for a parent with no stored row | 200 with the non-persisted default (`enabled:false`, `Weekly`, the parent's account email) |
| — | `PUT` a valid body, then `GET` again | 200 echo; the follow-up read returns the saved values from the real database |
| — | `PUT` with an unknown `frequency` | 400 with the exact contract message; the stored row is unchanged |
| — | Parent A reading parent B's preferences | 404 `notFound`, identical to a random UUID |
| — | Request with no token | 401 `unauthorised` |

---

## Group 7B — Notify Parent

Traces to `sequenceDiagram7_2.puml`. **These cases assert return values, not HTTP status
codes.** The notification flow is driven by a timer and has no endpoint, so its outcomes are
`'parentNotified'` and `'notificationFailed'` — the message names the sequence diagram itself
uses. The PM3 table lists HTTP statuses for 7B; that is a documentation error carried over
from when the flow was assumed to be a route, and the diagram's own outcome names are the
correct expectation.

### `test/integration/notifier.int.test.ts` (6 cases)

| Case | Scenario | Expected |
| --- | --- | --- |
| **IT7B-01 / 03** | Fresh parent with an enabled preference and a student with progress | Returns `'parentNotified'`; one email in the provider history addressed to the preference's recipient and naming the student; a real summary row now exists for that student; `lastSentAt` is no longer null |
| **IT7B-02** | Same setup, email provider in `fail` mode | Returns `'notificationFailed'`; no new email in history; `lastSentAt` unchanged — the send precedes the insert, so a failed send provably leaves no record |
| **IT7B-04** | Student with progress, LLM in `fail` mode | Returns `'notificationFailed'`; nothing sent, nothing recorded |
| **IT7B-05** | Parent whose student has no progress | Returns `'notificationFailed'`; nothing sent; `lastSentAt` still null |
| — | Parent whose preference is disabled | Returns `'notificationFailed'`; no send attempted |
| **IT7B-06** | Due parent; scheduler started under `jest.useFakeTimers()` and advanced one tick | An email addressed to that parent's unique recipient appears in history — the timer drives the sweep end to end |

> **On IT7B-06.** The case drives real database and generator work inside
> `jest.advanceTimersByTimeAsync()`. Fake timers flush microtasks but cannot force real
> network round-trips to complete, so this is the one case that could become flaky on a slow
> connection. If it does, the sanctioned fix is to await `runDueNotifications(now)` directly
> and leave timer semantics to `test/unit/scheduler.test.ts`, which already covers them.

---

## Coverage summary

| Group | Cases from the PM3 plan | Where |
| --- | --- | --- |
| 7A — Track Child's Progress | IT7A-01, 02, 04, 05, 07 | `track-progress.int.test.ts` |
| 7A — Recommendations | IT7A-03, 08, 09 | `recommendations.int.test.ts` |
| 7A — Authentication / authorization | IT7A-06 (both halves) | `auth.int.test.ts` |
| 7B — Notify Parent | IT7B-01 … 06 | `notifier.int.test.ts` |

Every case in the PM3 integration tables is implemented. The two documented departures are the
IT7A-06 split and the IT7B return-value expectations, both explained above.

Unit-level coverage (108 further cases, offline) is documented in
[../test/UNIT_TESTS.md](../test/UNIT_TESTS.md) and
[../test/UNIT_TEST_CASES.md](../test/UNIT_TEST_CASES.md).
