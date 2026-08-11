# Unit Tests

**9 suites, 107 cases, all passing.** Run offline from `DAS_7/backend` with
`npm test -- --runInBand test/unit` — no database, no network, no API keys. Every suite uses
plain in-file fakes; nothing imports `src/repos/` into a unit test, so a failure here always
points at logic rather than infrastructure.

The formal case table for the core features is in [UNIT_TEST_CASES.md](UNIT_TEST_CASES.md).
Integration coverage (real Supabase, 26 further cases) is described in
[../docs/integration-test-plan.md](../docs/integration-test-plan.md).

| Suite | Cases | What it covers |
| --- | --- | --- |
| `unit/auth.test.ts` | 18 | The JWT middleware and both guardianship helpers |
| `unit/notifier-service.test.ts` | 16 | Due-date arithmetic, notification outcomes, the sweep loop |
| `unit/preference-service.test.ts` | 14 | Preference defaults and every validation message |
| `unit/insight-service.test.ts` | 13 | Summary staleness and all IT7A error semantics |
| `unit/mappers.test.ts` | 12 | Database row → domain object conversion |
| `unit/error-handler.test.ts` | 14 | Error → HTTP envelope mapping, app wiring |
| `unit/stub-llm.test.ts` | 9 | Deterministic offline summary and advice generation |
| `unit/scheduler.test.ts` | 7 | Timer start/stop behaviour under fake timers |
| `unit/fake-email.test.ts` | 4 | The in-memory email provider used by tests |

## What each suite proves

**`auth.test.ts`** — malformed headers (Basic, bare token, empty, `Bearer` with nothing after
it) are all 401; JWKS verification rejects expired tokens, foreign issuers, wrong signing keys,
and tokens with no `sub`; a valid platform user who is not a registered parent receives 403.
The suite uses an in-memory signing key and mocked JWKS response to exercise the same
asymmetric verification path offline. It also pins the deliberate design choice that
`requireOwnStudent` throws the **same** error for another parent's student as for a student that
does not exist.

**`insight-service.test.ts`** — the staleness rule in all four states (no summary, fresh
summary, newer progress, unknown insert time), plus every failure mapping: unknown student →
404 `progressUnavailable`, no records → 503 `progressUnavailable` (IT7A-05), generator failure
→ 503 `summaryUnavailable` with nothing stored (IT7A-07), recommendation without a summary →
404 `summaryUnavailable` (IT7A-08), recommendation generator failure → 503
`recommendationUnavailable` with nothing stored (IT7A-09). The "stores nothing" cases assert
the repository was never called, which makes the insert-after-generate ordering a tested
property rather than a comment.

**`preference-service.test.ts`** — the non-persisted default returned when a parent has no
row, and each of the four validation messages asserted verbatim (they are part of the API
contract; the frontend renders them). Also pins that `parentId` always comes from the URL even
when the body carries a different one, that emails are trimmed and lower-cased, and that
validation reports the `enabled` failure first when every field is invalid.

**`notifier-service.test.ts`** — `isDue` for never-sent, elapsed, not-yet-elapsed, and each
frequency's own interval; `notifyParent` returning `notificationFailed` for a disabled
preference, a missing preference, a parent with no students, a student with no progress
(IT7B-05 shape), an unavailable generator (IT7B-04 shape), and a downed email provider
(IT7B-02 shape) — each asserting nothing was sent and nothing recorded. One case pins the
deliberate asymmetry that a *recording* failure after a successful send still reports
`parentNotified`, because the email really did leave. `runDueNotifications` is shown to skip
disabled and not-yet-due parents and to keep sweeping after one parent fails.

**`stub-llm.test.ts`** — the summary format is pinned exactly (one line per skill area in
`SKILL_AREAS` order, "held steady" for an unchanged score, singular "1 session"), determinism
is asserted by generating twice, and recommendation selection is shown to rank by the score
the child *ended* on rather than the session count, with a documented fallback when the
summary text is not one the stub wrote.

**`mappers.test.ts`** — snake_case → camelCase for all six row types, and the two format
guarantees the frontend depends on: bare `YYYY-MM-DD` dates pass through untouched, and
internal columns (`created_at`, `auth_user_id`) never reach the domain object.

**`error-handler.test.ts`** — each `ApiError` subclass maps to its status with its message
intact; a generic `Error` becomes 500 `internalError` without leaking its message; a rejected
async handler reaches the middleware (Express 5 behaviour); unknown routes return 404
`notFound`; and `/health` is reachable without a token while everything below it is not.

**`scheduler.test.ts`** — under fake timers: nothing runs before `start()`, one run per tick
carrying the current `Date`, a rejecting run is logged and later ticks still fire, `stop()`
halts it, a second `start()` does not create a second timer, and `stop()` before `start()` is
harmless.

**`fake-email.test.ts`** — the test double itself: history order, `EmailSendError` in fail
mode with nothing appended, and recovery when the mode is flipped back.
