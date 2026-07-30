# Handoff — Phase 5 (Notification Preferences)

**Status:** complete. `npm run typecheck` clean; `npm test` → 25 passed, 5 skipped (integration), 0 failed.

## What shipped

| File | State |
|---|---|
| `src/services/preference.service.ts` | new — `createPreferenceService` |
| `src/http/routes/preferences.routes.ts` | 501 stub replaced with real handlers |
| `test/unit/preference-service.test.ts` | new — 13 tests, offline, in-file fakes |
| `test/integration/preferences.int.test.ts` | new — 5 supertest cases, self-skipping until Wave 3 |

Nothing outside the phase doc's "Files you own" list was modified, apart from that doc's own
Progress checklist and this handoff file (written at the orchestrator's request).

### Behaviour

- `GET /api/parents/:parentId/preferences` — `requireOwnParent` first, then the stored row; when
  no row exists, a **non-persisted** default `{ parentId, enabled: false, frequency: 'Weekly',
  recipientEmail: <parent's account email> }`. A parent that has vanished mid-request → 404.
- `PUT /api/parents/:parentId/preferences` — `requireOwnParent`, validate, upsert. `parentId`
  always comes from the URL; a `parentId` in the body is ignored (covered by a unit test).
- Foreign and nonexistent `parentId`s are both a bare 404 `notFound`, byte-identical — the
  integration suite asserts the two responses match, which is the IDOR closure.

### Validation messages (first failure wins)

1. `Request body must be an object.`
2. `` `enabled` must be true or false. ``
3. `` `frequency` must be one of: Weekly, Fortnightly, Monthly. ``
4. `` `recipientEmail` must be a valid email address. ``

Unknown extra keys are ignored. These strings are user-visible — the frontend may render them
verbatim, so treat them as part of the API contract.

## Deviations, assumptions, and open decisions

### 1. Email is normalised *before* the pattern test — deliberate, needs your ack

The phase doc's validation table rejects a `recipientEmail` not matching
`/^[^\s@]+@[^\s@]+\.[^\s@]+$/`, but unit case 5 requires `'  Parent@X.COM '` to be **accepted**
and stored as `'parent@x.com'`. These conflict: the pattern's `[^\s@]` anchors reject the leading
space.

Resolved in favour of case 5 — the value is `.trim().toLowerCase()`d first, then pattern-tested.
Surrounding whitespace is forgiven; everything the pattern actually polices (missing `@`, missing
dot, internal spaces, non-string values) still fails with the specified message.

**If you want whitespace to be a 400 instead, say so — it's a two-line flip** in
`src/services/preference.service.ts` plus the matching unit case.

### 2. Assumptions where the doc was silent

- A **missing** `enabled` key yields the `` `enabled` must be true or false. `` message; the doc
  specifies a strict boolean check and no separate "required" message. Same reasoning for missing
  `frequency` / `recipientEmail`.
- My in-file `PreferenceRepo` fake implements `listEnabled` (on the frozen interface, consumed by
  Phase 6) rather than casting around it, so the fake stays type-honest.

### 3. Nothing found wrong outside my scope

No issues to report in the contract files or other phases' stubs.

## What the orchestrator needs to do

- **Nothing before merge.** The unit suite is self-contained and offline.
- **Wave 3:** the integration suite needs `.env` configured (`SUPABASE_URL`,
  `TEST_SUPABASE_REF`, `SUPABASE_SERVICE_ROLE_KEY`) *and* Phase 7's `createHarness`, which is
  still `throw new Error('createHarness is implemented in Phase 7')`. Until both land the suite
  reports as skipped, which is the expected state.
- **Wiring:** `createPreferenceService` is exported but not yet placed into the `Deps` graph —
  that is Phase 7's composition-root job, not mine. The routes read `deps.preferenceService`, so
  they will 500 until it is wired.
- I did not touch the Supabase instance, and I did not commit, branch, or stage anything.
