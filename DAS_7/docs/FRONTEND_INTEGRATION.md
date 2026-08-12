# DAS 7 — Frontend Integration Guide

Quick reference for the centralized frontend team: how to talk to the Parent Insight Dashboard backend (progress charts, AI summaries, recommendations, email preferences).

## Where to send requests

Always call **`/api/insights/...`** from the centralized frontend. The root Vite
dev server is the sole browser-facing proxy. DAS7 runs directly on the host at
port **4000** and mounts its routes at the **root** (`/health`, `/me`,
`/students/...`); the root Vite configuration strips the public prefix:

```ts
proxy: {
  '/api/insights': {
    target: 'http://localhost:4000',
    rewrite: (path) => path.replace(/^\/api\/insights/, ''),
  },
}
```

The browser therefore stays on the root frontend origin while DAS7 receives its
prefix-free service paths. Production hosting is outside the current local
integration scope.

## Logging in

We don't have login endpoints. Sign the parent in with **Supabase Auth** (supabase-js) in the browser, then send the access token on **every** request:

```
Authorization: Bearer <supabase access token>
```

- No/invalid/expired token → `401`.
- A logged-in user who isn't a registered parent in our system gets `403`.
- Parents can only see **their own** children and settings. Asking for someone else's returns `404` — exactly as if it didn't exist.

## Response format

Every response (success or error) is wrapped the same way:

```json
{ "ok": true,  "data": ... }        // success
{ "ok": false, "error": "reason" }  // failure
```

## Endpoints

| Method + path | What it returns (`data`) |
|---|---|
| `GET /me` | `{ parent, students }` — the logged-in parent and their children. Use this first; take student ids from it. |
| `GET /students/:studentId/track-progress` | `{ progress: ProgressRecord[], summary: Summary }` — chart data plus the AI summary in one call |
| `GET /students/:studentId/summary` | `Summary` — just the AI summary |
| `POST /students/:studentId/recommendations` | `Recommendation` — generates fresh advice. **No request body.** Call on button click, not on page load. |
| `GET /parents/:parentId/preferences` | `NotificationPreference` — email settings (returns sensible defaults if never saved) |
| `PUT /parents/:parentId/preferences` | `NotificationPreference` — saves email settings |
| `POST /parents/:parentId/notifications` | `{ outcome: "parentNotified" }` — sends a progress update immediately |
| `GET /health` | `{ ok: true }` — no auth needed |

(Paths above are shown **without** the `/api/insights` prefix — prepend it to every one. See "Where to send requests".)

The only request body in the whole API is the preferences `PUT`:

```json
{ "enabled": true, "frequency": "Weekly", "recipientEmail": "parent@example.com" }
```

`frequency` must be `"Weekly"`, `"Fortnightly"` or `"Monthly"`. Bad values → `400` with a human-readable `error` message you can show directly.

**The four `400` messages are part of the API contract** — they are written to be rendered verbatim, and we will not reword them without telling you. Validation stops at the first failure, so exactly one arrives per request, in this order:

1. `Request body must be an object.`
2. `` `enabled` must be true or false. `` — also what a missing `enabled` gets.
3. `` `frequency` must be one of: Weekly, Fortnightly, Monthly. ``
4. `` `recipientEmail` must be a valid email address. ``

`recipientEmail` is trimmed and lowercased before it is checked, so `"  Parent@X.COM "` is accepted and stored as `parent@x.com` — surrounding whitespace is forgiven, and the value you read back may differ in case from the one you sent. Unknown extra keys in the body are ignored.

## Data shapes (the fields you'll actually use)

```ts
Parent          { parentId, name, email, mobileNumber, studentIds[] }
Student         { studentId, name, dateOfBirth, bandLevel }          // dateOfBirth: 'YYYY-MM-DD'
ProgressRecord  { recordId, studentId, date, skillArea, score, notes }
Summary         { summaryId, studentId, content, generatedAt }       // content: plain prose
Recommendation  { recommendationId, summaryId, content, generatedAt }
NotificationPreference { parentId, enabled, frequency, recipientEmail }
```

Good to know:

- `ProgressRecord.date` is a bare `'YYYY-MM-DD'` string (not a full timestamp).
- `score` is always 0–100.
- `skillArea` is one of exactly six strings: `Phonological Awareness`, `Reading Accuracy`, `Reading Fluency`, `Spelling`, `Writing`, `Comprehension`.
- Progress comes as one record per skill per date ("long" format) — pivot it client-side for charts.
- `Recommendation.content` is one string with `\n` between suggestion lines — split on newlines when rendering.
- `generatedAt` fields are full ISO timestamps.

## Errors you should handle

| Status | `error` value | Meaning / what to show |
|---|---|---|
| 401 | `unauthorised` | Not logged in (or session expired) → send to login |
| 403 | `forbidden` | Signed in with an account that is not a parent → show access denied |
| 404 | `progressUnavailable` | Unknown student, or not this parent's child. **Not retryable** — re-fetch `/me` and check the student ids |
| 503 | `progressUnavailable` | Student has no progress data yet |
| 503 | `summaryUnavailable` | Summary couldn't be generated right now → retry later |
| 404 | `summaryUnavailable` | Recommendations requested before any summary exists (load the dashboard first) |
| 503 | `recommendationUnavailable` | Recommendation couldn't be generated right now |
| 503 | `authUnavailable` | Authentication keys are temporarily unavailable → retry later without signing out |
| 400 | *(readable sentence)* | Bad preferences input — safe to display as-is |
| 404 | `notFound` | Wrong URL or someone else's parentId |
| 500 | `internalError` | Our bug — show a generic error |

## Email notifications

A background timer sends periodic summary emails based on each parent's saved preference (enabled per deployment via `SCHEDULER_ENABLED`, off by default). The authenticated manual-send endpoint lets a parent request the same combined update immediately; it does not change or reset the normal schedule.

Questions → DAS 7 team. Full technical details: `ARCHITECTURE.md` in this folder.
