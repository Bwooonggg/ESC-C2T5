# Phase 6 — Email Adapters, Notifier & Scheduler

> **Wave 2 · runs in parallel with Phases 2, 3, 4, 5 · depends only on Phase 1.**
> You are building the "Notify Parent" flow: the email adapters (Resend + in-memory fake), the `NotifierService` that composes and sends periodic summary emails, and the in-process scheduler. This flow has **no HTTP surface** — outcomes are the return values `'parentNotified' | 'notificationFailed'`, exactly what the IT7B test cases assert.

## Context

A timer ticks every `schedulerTickMs`. On each tick the notifier finds parents whose enabled preference makes them "due" (no email ever sent, or the frequency interval has elapsed since the last one), generates/reuses summaries for their children via the existing `InsightService`, sends **one** email per parent, and records it in `email_notifications`. All failure modes (no progress, LLM down, email provider down) are caught and reported as `'notificationFailed'` — nothing may ever crash the tick. The send happens **before** the DB insert, so a failed send is guaranteed to leave no record.

## Files you own

```
backend/src/adapters/email/resend-email.ts
backend/src/adapters/email/fake-email.ts
backend/src/services/notifier.service.ts
backend/src/services/scheduler.ts
backend/test/unit/fake-email.test.ts
backend/test/unit/notifier-service.test.ts
backend/test/unit/scheduler.test.ts
backend/test/integration/notifier.int.test.ts
```

**Touch nothing else** — not `deps.ts`, not `email-provider.ts` (the interface), not `insight.service.ts`, not `package.json` (no Resend SDK — you use `fetch`, built into Node).

## Contracts (frozen in Phase 1 — import, never edit)

From `src/adapters/email/email-provider.ts`:

```ts
export interface SentEmail { to: string; subject: string; body: string; }
export class EmailSendError extends Error { ... }
export interface EmailProvider { send(email: SentEmail): Promise<void>; }
```

From `src/deps.ts` — you implement `NotifierService` and consume these:

```ts
export type NotifyOutcome = 'parentNotified' | 'notificationFailed';
export interface NotifierService {
    notifyParent(parentId: string, now: Date): Promise<NotifyOutcome>;
    runDueNotifications(now: Date): Promise<Array<{ parentId: string; outcome: NotifyOutcome }>>;
}
// consumed: PreferenceRepo { byParentId, listEnabled }, ParentRepo { byId },
//           StudentRepo { listByParent }, EmailNotificationRepo { lastSentAt, insert },
//           InsightService { getSummary }, EmailProvider, AppConfig.notifyIntervalsMs
```

From `src/config.ts`: `AppConfig` (`resendApiKey`, `emailFrom`, `notifyIntervalsMs`).
`InsightService.getSummary` throws `ApiError`s on failure (no progress → 503-typed error, LLM down → 503-typed error) and **persists** freshly generated summaries — you get IT7B-03's "summary stored" behavior for free by calling it.

## Step 1 — `src/adapters/email/fake-email.ts`

```ts
export class FakeEmailProvider implements EmailProvider {
    readonly history: SentEmail[] = [];   // successfully sent emails, in order
    mode: 'ok' | 'fail' = 'ok';
    async send(email: SentEmail): Promise<void> {
        if (this.mode === 'fail') throw new EmailSendError('fake provider unreachable');
        this.history.push(email);
    }
}
```

This exact shape (`history`, `mode`) is relied on by the Phase 7 harness (`FakeEmailControl`) — keep the property names.

## Step 2 — `src/adapters/email/resend-email.ts`

```ts
export function createResendEmailProvider(config: { apiKey: string; from: string }): EmailProvider
```

`send` = one `fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from, to: email.to, subject: email.subject, text: email.body }) })` with `signal: AbortSignal.timeout(10000)`. Non-2xx response, network error, or timeout → throw `EmailSendError` (include status/short reason in the message; never include the API key). No SDK, no retries.

## Step 3 — `src/services/notifier.service.ts`

```ts
export function createNotifierService(deps: Pick<Deps,
    'preferenceRepo' | 'parentRepo' | 'studentRepo' | 'emailNotificationRepo'
    | 'insightService' | 'email' | 'config'>): NotifierService
```

Also export the pure due-calculation helper for direct unit testing:

```ts
export function isDue(
    lastSentAt: string | null, frequency: NotificationFrequency,
    now: Date, intervals: Record<NotificationFrequency, number>,
): boolean   // true iff lastSentAt === null || now - lastSentAt >= intervals[frequency]
```

**`notifyParent(parentId, now)`** — the whole body is wrapped so that *any* throw is caught, logged via `console.error` (include parentId and the reason), and returned as `'notificationFailed'`:

1. `pref = await preferenceRepo.byParentId(parentId)`; missing or `!pref.enabled` → failed.
2. `parent = await parentRepo.byId(parentId)`; missing → failed.
3. `students = await studentRepo.listByParent(parentId)`; empty → failed.
4. For each student **sequentially**: `summary = await insightService.getSummary(student.studentId)` — a throw here (no progress *(IT7B-05)*, LLM down *(IT7B-04)*) fails the whole notification; fresh summaries are persisted by the insight service *(IT7B-03)*.
5. Compose one email:
   - `to`: `pref.recipientEmail`
   - `subject`: `Progress update for ${students.map(s => s.name).join(', ')}`
   - `body`: per student `${student.name}:\n${summary.content}` blocks joined by `'\n\n'`.
6. `await email.send(...)` — throw *(IT7B-02)* → failed, and because the insert below never ran, no `email_notifications` row exists (assertable).
7. `await emailNotificationRepo.insert({ parentId, summaryId: summaries[0]?.summaryId ?? null, recipientEmail: pref.recipientEmail, subject, body })`. If this insert itself throws after a successful send, log loudly but still return `'parentNotified'` — the email *did* go out.
8. Return `'parentNotified'` *(IT7B-01)*.

**`runDueNotifications(now)`**: `prefs = await preferenceRepo.listEnabled()`; for each, `lastSent = await emailNotificationRepo.lastSentAt(pref.parentId)`; if `isDue(lastSent, pref.frequency, now, config.notifyIntervalsMs)` → `outcome = await notifyParent(pref.parentId, now)`; collect and return `{ parentId, outcome }[]`. One parent's failure must not stop the loop (notifyParent never throws — that guarantee lives there).

## Step 4 — `src/services/scheduler.ts`

```ts
export interface Scheduler { start(): void; stop(): void; }
export function createScheduler(
    run: (now: Date) => Promise<unknown>, tickMs: number,
): Scheduler
```

`start()` sets a `setInterval(tickMs)` whose callback invokes `run(new Date())` and attaches a `.catch(console.error)` — an error must never become an unhandled rejection or kill the process. Idempotent: calling `start()` twice doesn't create two timers; `stop()` clears it. Call `timer.unref?.()` so the interval never blocks process exit.

## Step 5 — unit tests (offline, in-file fakes — do not import from `src/repos/`)

`test/unit/fake-email.test.ts`: send appends to history; `mode='fail'` throws `EmailSendError` and appends nothing.

`test/unit/notifier-service.test.ts` — Map-backed in-file fakes for the four repos, a fake `InsightService` (per-student canned summaries or throw), `FakeEmailProvider`, and a minimal `AppConfig` literal with tiny `notifyIntervalsMs`:

1. `isDue`: never-sent → true; elapsed ≥ interval → true; not elapsed → false; each frequency picks its own interval.
2. Happy path → `'parentNotified'`; email in `history` with subject containing both student names; notification row recorded with the recipient email.
3. Disabled/missing preference → `'notificationFailed'`, no send.
4. InsightService throws (progress unavailable) → `'notificationFailed'`, `history` empty, no row *(IT7B-05 shape)*.
5. InsightService throws (LLM down) → same *(IT7B-04 shape)*.
6. `email.mode='fail'` → `'notificationFailed'`, no row inserted *(IT7B-02 shape)*.
7. Insert-after-send throws → still `'parentNotified'`.
8. `runDueNotifications`: two enabled parents, one due + one not → only the due one notified; a failing parent doesn't prevent the next parent's send.

`test/unit/scheduler.test.ts` — `jest.useFakeTimers()`: `start()` + advance one tick → `run` called with a Date; advance three ticks → three calls; a rejecting `run` doesn't break subsequent ticks (`await jest.advanceTimersByTimeAsync(...)`); `stop()` → no further calls; double `start()` → still one call per tick.

## Step 6 — `test/integration/notifier.int.test.ts` (compile now, run in Wave 3)

Use the frozen harness API (`test/helpers/harness.ts`): `h.deps` exposes the **real** repos + insight service wired to real Supabase, `h.email` is the fake provider (`history`, `mode`), `h.llm` is controllable, and `h.createParent()` / `h.createStudent({ parentId, withProgress })` create cleanup-registered fixtures. Assert against `h.email.history` and `h.deps.emailNotificationRepo`. The notifier under test is `h.deps.notifierService` (already wired to the fakes); the scheduler you construct yourself.

Fixture rule: the pre-made `parentA` deliberately includes `studentA2` (no progress), which fails a whole-parent notification — so **success cases use a fresh parent** whose every student has progress:

```ts
const p = await h.createParent();
const s = await h.createStudent({ parentId: p.parentId, withProgress: true });
await h.deps.preferenceRepo.upsert({ parentId: p.parentId, enabled: true,
    frequency: 'Weekly', recipientEmail: 'notify@test.dev' });
```

Cases (reset `h.email.mode` and `h.llm` in `beforeEach`; `h.email.history` is append-only, so capture `history.length` before each act and assert deltas):

1. **IT7B-01/03** (fresh parent as above): `notifyParent(p.parentId, new Date())` → `'parentNotified'`; one new email in `history` whose body contains the student's name and whose `to` is the preference's recipient; a real summary row now exists for the student; `h.deps.emailNotificationRepo.lastSentAt(p.parentId)` is non-null.
2. **IT7B-02**: same setup, `h.email.mode = 'fail'` → `'notificationFailed'`; no new email; `lastSentAt` unchanged from before the call.
3. **IT7B-04**: fresh parent + student with progress (so a generation is attempted), `h.llm.mode = 'fail'` → `'notificationFailed'`; no new email; no notification row.
4. **IT7B-05**: fresh parent + student `withProgress: false`, enabled preference → `'notificationFailed'`; no new email; `lastSentAt` null.
5. Disabled preference → `'notificationFailed'`, no send.
6. **IT7B-06 (timer)**: fresh due parent; `jest.useFakeTimers()`; `createScheduler(now => h.deps.notifierService.runDueNotifications(now), 1000)`; `start()`; `await jest.advanceTimersByTimeAsync(1000)`; an email **to that parent's recipient address** appears in history (assert by recipient, not by count — `runDueNotifications` legitimately sweeps every enabled preference in the shared test DB, so other emails may land in the same tick); `stop()`; restore real timers in `afterEach`. Use a unique recipient address per test run (e.g. containing a fresh UUID) so the assertion is unambiguous.

Reset `h.email.mode`/`h.llm` in `beforeEach`; note `h.email.history` is append-only — capture `history.length` before each act and assert deltas, don't assume emptiness.

## Done criteria

- `npm run typecheck` clean; `npm test` green — three unit suites pass; integration suite reports as skipped.
- `notifyParent` provably never throws (unit case 4–6 cover the paths).
- No file outside your ownership list changed.
