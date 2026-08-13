# Frontend UI testing

This document covers the browser-driven end-to-end tests under `frontend/test/`.
It does not cover the DAS1, DAS3, or DAS7 backend test suites — see the root
[README.md](../README.md#tests) for those commands.

## Layout

```
frontend/test/
  api/          Jest unit tests for the typed API clients (jsdom, no browser)
  config/       Jest unit tests for environment/config helpers
  lib/          Jest unit tests for shared formatting utilities
  ui/           Selenium end-to-end suites (one folder per service)
    das1/
    das3/
    das7/
  e2e/          Playwright end-to-end suites (one file per service)
```

The `api/`, `config/`, and `lib/` suites run under Jest and never open a browser.
The `ui/` and `e2e/` suites drive a real Chromium browser against the frontend
running in stub mode (`VITE_USE_STUBS=true`) — no backend, Docker, or Supabase
project required.

## What the end-to-end suites cover

Both `ui/` (Selenium) and `e2e/` (Playwright) exercise the same three user
journeys, kept in parallel as a comparison between the two tools:

| Service | Flow | Selenium spec | Playwright spec |
| --- | --- | --- | --- |
| DAS1 Screening | Adult/child screener → questions → summary → follow-up contact | `ui/das1/das1-ui.spec.js` | `e2e/das1-screening.spec.js` |
| DAS3 Worksheet Builder | Prompt → generated worksheet → answers toggle → reset → logout | `ui/das3/das3-ui.spec.js` | `e2e/das3-worksheet.spec.js` |
| DAS7 Insights | Login page → dashboard → switch child → suggestions → email settings → logout | `ui/das7/das7-ui.spec.js` | `e2e/das7-insights.spec.js` |

Each spec is self-contained: it starts its own copy of the Vite dev server in
stub mode, runs its tests against fake in-browser data, and shuts the server
down afterward. You do not need to start `npm run dev` yourself first — the
Playwright suite starts it automatically via `playwright.config.js`, and each
Selenium suite starts it via its own `support.js`.

Because these tests only run against stub data, they cannot exercise real
authentication (401/403 redirects), the DAS3 worksheet clarification loop, or
Brevo email delivery — those require the real DAS1/DAS3/DAS7 backends running
with `VITE_USE_STUBS=false` and are out of scope for these suites.

## Prerequisites

- `npm install --prefix frontend` (installs both `selenium-webdriver` and
  `@playwright/test`)
- Selenium suites (`test:ui:*`) use your system's installed Google Chrome —
  nothing further to install.
- Playwright suites (`test:e2e*`) use their own managed browser, installed once
  with:

  ```powershell
  npx playwright install chromium --prefix frontend
  ```

## Running the tests

All commands run from the repository root and use `--prefix frontend`, or run
directly inside `frontend/` and drop the flag.

### Jest unit tests

```powershell
npm run frontend:test
```

or `npm test --prefix frontend`.

### Selenium (one service at a time)

```powershell
npm run test:ui:das1 --prefix frontend
npm run test:ui:das3 --prefix frontend
npm run test:ui:das7 --prefix frontend
```

Each has a `:headed` variant (e.g. `test:ui:das1:headed`) that opens a visible
Chrome window instead of running headless — useful when a test fails and you
want to watch it happen rather than read a stack trace.

Failure screenshots and page source are saved to
`frontend/test/ui/<service>/artifacts/`.

### Playwright (all three services together)

```powershell
npm run test:e2e --prefix frontend
```

`playwright test` automatically picks up every spec under `frontend/test/e2e/`,
so this runs DAS1, DAS3, and DAS7 in one invocation. Variants:

```powershell
npm run test:e2e:headed --prefix frontend
npm run test:e2e:ui --prefix frontend
```

`test:e2e:ui` opens Playwright's interactive UI mode — a timeline of every
action with a DOM snapshot at each step, and the ability to time-travel through
a failed test. It is the fastest way to debug a Playwright failure.

Failure screenshots and traces are saved under `frontend/test-results/`. View a
trace with:

```powershell
npx playwright show-trace frontend/test-results/<failed-test-folder>/trace.zip
```

## Notes for anyone extending these suites

- Selenium: keep locators specific. `By.css("h2")` or similar unscoped
  selectors can match more than one element on a page with several headings,
  and if the wrong one is later removed from the DOM by a re-render, the test
  fails with `StaleElementReferenceError` rather than a clear mismatch. Prefer
  an XPath or CSS selector that matches the exact target, e.g.
  `//h2[normalize-space()='Your results']`.
- Selenium: for a controlled input (checked/value driven by React state rather
  than the native DOM), avoid `.check()`/native assertions that verify
  immediately after the action. Click, then assert the end state with a
  locator that retries (e.g. `driver.wait(until.elementIsSelected(...))`)
  rather than a single-shot check, since the state may only update after an
  async round trip.
- Playwright: `getByRole(role, { name })` re-evaluates the `name` filter on
  every use, not just once at creation. If an element's own text is also its
  accessible name and that text changes during the test (e.g. a button that
  reads "Save changes" while idle and "Saving…" while busy), a locator scoped
  to the original name stops matching the moment the text changes. Match every
  state the element can be in, e.g. `{ name: /Save changes|Saving…/ }`.
- Playwright: keep `workers` in `playwright.config.js` modest (2 is the current
  setting) rather than the default of one worker per CPU core. Many parallel
  headless Chromium instances competing for CPU can cause very short-lived
  loading states to be skipped between polls, producing failures that look
  like app bugs but are really test-runner contention.
- If `npm run test:e2e --prefix frontend` times out waiting for the dev server
  to start, first try running `npm run dev --prefix frontend` directly to see
  whether Vite itself starts cleanly (port already in use, or a slow
  filesystem, are the two common causes — a project synced by OneDrive or
  similar cloud storage can slow `node_modules` access enough to matter here).