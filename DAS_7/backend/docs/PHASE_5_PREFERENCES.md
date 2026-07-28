# Phase 5 — Notification Preferences

> **Wave 2 · runs in parallel with Phases 2, 3, 4, 6 · depends only on Phase 1.**
> You are implementing the notification-preference feature: the `PreferenceService` (defaults + hand-rolled validation of the API's only request body) and the GET/PUT routes. Smallest phase; precision on the validation messages matters because the UI may display them.

## Context

Each parent has at most one notification preference row controlling the periodic summary emails: `{ enabled, frequency: Weekly|Fortnightly|Monthly, recipientEmail }`. The frontend calls `GET /api/parents/:parentId/preferences` and `PUT /api/parents/:parentId/preferences`. A parent may only access **their own** `parentId` — anything else is a 404 (indistinguishable from nonexistent, closing the IDOR the old mock backend had). If no row exists yet, GET returns a **non-persisted default** rather than a 404: `{ parentId, enabled: false, frequency: 'Weekly', recipientEmail: <parent's account email> }` — friendlier for the yet-to-be-built settings UI, and a deliberate deviation from the mock.

## Files you own

```
backend/src/services/preference.service.ts
backend/src/http/routes/preferences.routes.ts     # replace the 501 stub
backend/test/unit/preference-service.test.ts
backend/test/integration/preferences.int.test.ts
```

**Touch nothing else** — not `deps.ts`, not `auth.ts`, not `package.json`.

## Contracts (frozen in Phase 1 — import, never edit)

From `src/deps.ts` — you implement `PreferenceService` and consume these:

```ts
export interface PreferenceService {
    get(parentId: string): Promise<NotificationPreference>;
    save(parentId: string, body: unknown): Promise<NotificationPreference>;
}
// consumed: PreferenceRepo { byParentId, upsert }, ParentRepo { byId }
```

From `src/types.ts`: `NotificationPreference`, `NotificationFrequency`, `NOTIFICATION_FREQUENCIES`.
From `src/errors.ts`: `ValidationError` (400), `NotFoundError` (404).
From `src/http/auth.ts`: `requireOwnParent(parent, parentId)` — throws 404 on mismatch.
From `src/http/envelope.ts`: `ok(res, data)`.

## Step 1 — `src/services/preference.service.ts`

```ts
export function createPreferenceService(
    deps: Pick<Deps, 'preferenceRepo' | 'parentRepo'>,
): PreferenceService
```

**`get(parentId)`**: `pref = await preferenceRepo.byParentId(parentId)`; if found return it. Otherwise `parent = await parentRepo.byId(parentId)`; if null → `throw new NotFoundError()` (can only happen if the row vanished mid-request — routes already verified ownership); return the default **without persisting**: `{ parentId, enabled: false, frequency: 'Weekly', recipientEmail: parent.email }`.

**`save(parentId, body)`** — validate the raw body, then upsert. Validation rules and **exact messages** (order matters; first failure wins):

| Check | `ValidationError` message |
|---|---|
| `body` is not a non-null, non-array object | `Request body must be an object.` |
| `enabled` is not `true`/`false` (strict boolean) | `` `enabled` must be true or false. `` |
| `frequency` not in `NOTIFICATION_FREQUENCIES` | `` `frequency` must be one of: Weekly, Fortnightly, Monthly. `` |
| `recipientEmail` not a string matching `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` | `` `recipientEmail` must be a valid email address. `` |

(Backticks are literal characters inside the messages, e.g. the string is `` `enabled` must be true or false. ``.) Unknown extra keys are ignored. Normalize `recipientEmail` with `.trim().toLowerCase()` before saving. Then `return preferenceRepo.upsert({ parentId, enabled, frequency, recipientEmail })` — `parentId` always comes from the URL parameter, **never** from the body.

## Step 2 — `src/http/routes/preferences.routes.ts`

Replace the stub, keeping `export function preferencesRoutes(deps: Deps): Router`. Both handlers first call `requireOwnParent(req.parent!, req.params.parentId)`:

- `GET /:parentId/preferences` → `ok(res, await deps.preferenceService.get(parentId))`.
- `PUT /:parentId/preferences` → `ok(res, await deps.preferenceService.save(parentId, req.body))`.

(`express.json()` is already applied app-wide by Phase 1's `app.ts`; a PUT without a JSON content-type arrives as `{}` and correctly fails the `enabled` check.)

## Step 3 — `test/unit/preference-service.test.ts` (offline)

In-file fakes for `PreferenceRepo` (Map-backed) and `ParentRepo`. Do not import from `src/repos/`. Cases:

1. `get` returns the stored preference when one exists.
2. `get` with no row returns the default (`enabled: false`, `Weekly`, parent's email) and does **not** call `upsert`.
3. `save` happy path: valid body → upserted and returned; `parentId` taken from the argument even if the body smuggles a different one.
4. Each validation failure produces exactly the specified message: non-object body (`null`, `[]`, `'str'`), `enabled: 'yes'`, `frequency: 'Daily'`, `recipientEmail: 'not-an-email'` / `42`.
5. Email normalization: `'  Parent@X.COM '` → saved as `'parent@x.com'`.
6. Validation order: a body failing everything reports the `enabled` message first (after the object check).

## Step 4 — `test/integration/preferences.int.test.ts` (compile now, run in Wave 3)

Use the frozen harness API (`test/helpers/harness.ts`): `createHarness`, `describeIntegration`, `TestHarness` (`h.app`, `h.tokenA`, `h.tokenB`, `h.parentA`, `h.parentB`, `h.cleanup`). Supertest cases:

1. `GET /api/parents/{parentA}/preferences` with `tokenA` → 200 default (`enabled: false`).
2. `PUT` valid body (`{ enabled: true, frequency: 'Fortnightly', recipientEmail: 'a@test.dev' }`) with `tokenA` → 200 echo; subsequent GET returns the saved values (persistence proven through the real DB).
3. `PUT` invalid `frequency` → 400 with the exact message; stored values unchanged.
4. Cross-parent: `GET`/`PUT` on `{parentB}` with `tokenA` → 404 `notFound` — body identical to using a random UUID (assert both).
5. No token → 401.

## Done criteria

- `npm run typecheck` clean; `npm test` green — unit suite passes; integration suite reports as skipped.
- No file outside your ownership list changed.
