# Phase 6 Handoff — Email Adapters, Notifier & Scheduler

**Status:** complete. `npm run typecheck` clean; `npm test` green (4 suites / 38 tests passing, integration suite skipped as expected until Wave 3).

## What shipped

| File | What it is |
| --- | --- |
| `src/adapters/email/fake-email.ts` | `FakeEmailProvider` — offline provider with `history: SentEmail[]` (append-only) and `mode: 'ok' \| 'fail'`. Property names match the Phase 7 `FakeEmailControl` contract. |
| `src/adapters/email/resend-email.ts` | `createResendEmailProvider({ apiKey, from })` — one `fetch` to `https://api.resend.com/emails`, 10s `AbortSignal.timeout`, no SDK, no retries. |
| `src/services/notifier.service.ts` | `createNotifierService(deps)` implementing `NotifierService`, plus the exported pure helper `isDue(lastSentAt, frequency, now, intervals)`. |
| `src/services/scheduler.ts` | `Scheduler` interface + `createScheduler(run, tickMs)` — idempotent `start()`, `stop()`, unref'd interval. |
| `test/unit/fake-email.test.ts` | 4 tests. |
| `test/unit/notifier-service.test.ts` | 15 tests — `isDue`, `notifyParent`, `runDueNotifications`. In-file Map-backed fakes only; nothing imported from `src/repos/`. |
| `test/unit/scheduler.test.ts` | 7 tests, `jest.useFakeTimers()`. |
| `test/integration/notifier.int.test.ts` | 6 tests — IT7B-01/02/03/04/05 + IT7B-06 timer sweep. Compiles now, self-skips via `describeIntegration`. |

Only these eight files plus the Progress checklist in `PHASE_6_NOTIFICATIONS.md` changed.

## Behaviour worth knowing when wiring this up

- **`notifyParent` never throws.** Every path — missing/disabled preference, missing parent, no students, insight failure, email failure — is caught, logged via `console.error` with the parentId and reason, and returned as `'notificationFailed'`. This is the guarantee `runDueNotifications` leans on to keep sweeping after one parent fails.
- **Send before insert.** The email goes out first; only then is the row written to `email_notifications`. A failed send therefore provably leaves no record (IT7B-02 asserts exactly this).
- **Insert failure after a successful send still returns `'parentNotified'`** — the email really did leave. It is logged loudly, but the outcome reflects reality, not bookkeeping.
- **Summaries are fetched sequentially, one student at a time.** One student without progress fails the *whole* parent's notification. Freshly generated summaries are persisted by `InsightService.getSummary`, which is where IT7B-03's "summary stored" behaviour comes from — the notifier writes no summaries itself.
- **Email shape:** `to` = `pref.recipientEmail`; `subject` = `Progress update for <student names, comma-joined>`; `body` = `<name>:\n<summary content>` blocks joined by a blank line. `summaryId` on the recorded row is the *first* student's summary id (`null` if somehow absent).
- **The scheduler is inert until `start()`**, and `start()` twice creates one timer, not two. The interval is `unref()`ed, so it can never hold the process open.

## Deviations from the phase doc

Both are hardening; neither changes the specified contract.

1. **Scheduler tick wrapping.** The doc says the callback invokes `run(new Date())` with a `.catch(console.error)` attached. Implemented as `Promise.resolve().then(() => run(new Date())).catch(...)` so a *synchronous* throw from `run` is caught too, not just a rejection. Otherwise identical.
2. **`isDue` guards an unparseable timestamp.** A malformed `lastSentAt` would otherwise produce `NaN` comparisons that silently read as *never due*. It is now treated as due. Only reachable if a repo returns a bad timestamp.

## Open items for the orchestrator

- **Nothing is wired into the app graph yet.** Phase 6 owns no composition-root file, so `createResendEmailProvider`, `createNotifierService`, and `createScheduler` are unreferenced by `src/` production code. Whoever owns the composition root needs to:
  - select the provider off `config.emailProvider` (`'resend'` needs `resendApiKey` + `emailFrom` — both are `string | null` in `AppConfig`, so they need a null check at the wiring site);
  - build the notifier from the eight deps it takes;
  - construct the scheduler with `config.schedulerTickMs` and only `start()` it when `config.schedulerEnabled` is true.
- **`runDueNotifications` calls `emailNotificationRepo.lastSentAt` outside the per-parent try/catch**, matching the doc's statement that the never-throws guarantee lives in `notifyParent`. If a real repo's `lastSentAt` throws mid-sweep, the remaining parents are skipped for that tick. Flagged rather than changed, since guarding it goes beyond the spec. Easy to add if you want it.
- **Wave 3 watch-item, IT7B-06.** The timer test drives real Supabase + LLM I/O inside `jest.advanceTimersByTimeAsync(1000)`. Fake timers flush microtasks but cannot force real network round-trips to finish, so this case may be flaky once integration actually runs. It is implemented exactly as the phase doc prescribes. If it proves flaky, the fix is to `await` a direct `runDueNotifications(now)` call and leave timer semantics to the (already passing) unit suite.
- The integration suite uses a **fresh parent per case** with a UUID-unique recipient address, never the shared `parentA` fixture — `parentA` includes a student with no progress, which fails a whole-parent notification by design. IT7B-06 asserts by recipient address, not by history length, because `runDueNotifications` legitimately sweeps every enabled preference in the shared test database.

## Not done, by design

No dependencies added or changed. No SQL, migrations, or writes against the shared Supabase project. No frozen contract file touched (`deps.ts`, `types.ts`, `errors.ts`, `config.ts`, `email-provider.ts`, `package.json`, jest/tsconfig). No git operations.
