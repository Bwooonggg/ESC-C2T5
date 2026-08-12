# DAS 7 Selenium UI Test Plan

**Status:** Approved and implemented. All **10 Selenium UI tests pass** in headless Chrome.
The existing frontend regression suite also passes with **7 suites and 41 tests**, and the
production frontend build succeeds.

## 1. Objective

Verify the DAS 7 React interface in a real Chrome browser without testing the backend,
Supabase, authentication service, database, email provider, or LLM provider.

```text
Chrome -> React/Vite -> frontend preview-data module
```

These are **UI tests**, not end-to-end tests. Vite will run with `VITE_USE_STUBS=true`, causing
the frontend to use its built-in Parent Insight preview data. No DAS 7 backend process is
required.

## 2. Scope

### Included

- Login-page layout and controls
- Parent Insight header and navigation
- Student banner, metadata, and child selector
- Progress, skill score, summary, and recommendation presentation
- Email-update controls and user feedback
- Loading and button states visible to the user
- Larger-text and high-contrast controls
- Logout navigation

### Excluded

- Express routes, services, repositories, and Supabase
- Real login and authorization behaviour
- Database persistence
- Real email or generated-content providers
- API contract and end-to-end tests
- Pixel-by-pixel visual-regression testing
- Other DAS subsystems

## 3. Proposed tooling and execution

| Item | Proposal |
| --- | --- |
| Browser automation | Selenium WebDriver for JavaScript |
| Test runner | Node.js built-in test runner |
| Browser | Installed Google Chrome, headless by default |
| UI data source | Existing `frontend/src/stubs/insights.ts` |
| Test location | `frontend/test/ui/das7/` |
| Application URL | `http://localhost:5173` |
| Backend process | Not started |
| Failure evidence | Current URL and screenshot, with no credentials |

Proposed commands after approval:

```bash
npm run test:ui:das7
npm run test:ui:das7:headed
```

The normal command will start Vite in preview-data mode, run Chrome headlessly, and stop the
Vite process that it started. The headed command will show Chrome while executing the same
tests.

## 4. UI test data

The tests use the frontend's existing deterministic preview data:

| Preview item | Expected UI value |
| --- | --- |
| Parent | Jamie Tan |
| Student A | Maya Tan, Band B |
| Student B | Ethan Tan, Band A |
| Assessments | Three dates per student |
| Skills | Six skill areas |
| Initial email setting | Enabled, Fortnightly, `jamie.tan@example.com` |

Preview mode is restricted by the application to `localhost` and `127.0.0.1`. UI tests will
not contain or require Supabase credentials.

Each test starts with a fresh browser session so the preview preference and local-storage state
do not leak between cases.

## 5. Synchronization and selectors

The React UI updates asynchronously, including a deliberate short preview-data delay. Selenium
will use explicit waits for visible text, element state, and changed values. Fixed-duration
sleeps will not be the normal synchronization mechanism.

Selectors will prefer:

1. IDs: `student-select`, `notify-enabled`, `notify-frequency`, `notify-email`
2. Form names: `email`, `password`
3. Accessible labels and roles: `Main`, `Display settings`, status and alert roles
4. Button and heading text when that text is part of the interface contract

Generated CSS-module class names will not be used as selectors. The test may inspect the
document root for the stable accessibility classes `dial-large-text` and
`dial-high-contrast`.

## 6. Test case specifications

The tables use the lecture format: ID, test name, objective, preconditions, alternating
input/output events, and postconditions.

### UI7-01

| Test case ID | UI7-01 (normal) |
| --- | --- |
| Test case name | Display the Parent Insight login interface |
| Objective | Verify the static login page structure and usable form controls. |
| Pre-conditions | Vite is running in preview-data mode; a fresh Chrome session exists. |
| Event Sequence - Input | Navigate to `/insights/login`. |
| Event Sequence - Output | `Parent Insight`, `Log in`, the parent-access description, email field, password field, and `Log in` button are visible. |
| Event Sequence - Input | Inspect the form controls. |
| Event Sequence - Output | The email field has type `email`; the password field has type `password`; both are required. |
| Post-conditions | No login is submitted and no external request is made. |

### UI7-02

| Test case ID | UI7-02 (normal) |
| --- | --- |
| Test case name | Display the initial progress dashboard |
| Objective | Verify the main layout and initial preview state of the DAS 7 dashboard. |
| Pre-conditions | A fresh browser session exists. |
| Event Sequence - Input | Navigate to `/insights`. |
| Event Sequence - Output | The header displays `Parent Insight`, `Progress`, `Email updates`, `Signed in as Jamie Tan`, and `Log out`. |
| Event Sequence - Input | Wait for preview data to load. |
| Event Sequence - Output | Maya Tan, Band B, the latest assessment, `Latest skill scores`, `Progress over time`, `Summary`, and `What you can do at home` are visible. |
| Post-conditions | Progress is the current navigation item and Maya is selected. |

### UI7-03

| Test case ID | UI7-03 (normal) |
| --- | --- |
| Test case name | Present Maya's progress information |
| Objective | Verify that the preview progress records are represented by the correct dashboard sections. |
| Pre-conditions | Maya is selected and dashboard loading has completed. |
| Event Sequence - Input | Inspect the skill and progress sections. |
| Event Sequence - Output | Six skill areas are presented and the progress card reports `3 assessments` and `scores out of 100`. |
| Event Sequence - Input | Inspect the summary card after its loading text disappears. |
| Event Sequence - Output | Maya's non-empty summary and its formatted date are displayed. |
| Post-conditions | The selected child remains Maya. |

### UI7-04

| Test case ID | UI7-04 (normal) |
| --- | --- |
| Test case name | Switch the displayed child |
| Objective | Verify that the child selector refreshes all student-scoped UI content. |
| Pre-conditions | Maya is selected and the dashboard is ready. |
| Event Sequence - Input | Select `Ethan Tan · Band A` using `student-select`. |
| Event Sequence - Output | The banner changes to Ethan Tan and a progress loading state is shown. |
| Event Sequence - Input | Wait for loading to complete. |
| Event Sequence - Output | Ethan's Band A metadata, progress information, and summary replace Maya's content. |
| Post-conditions | `student-select` has value `student-ethan`. |

### UI7-05

| Test case ID | UI7-05 (normal) |
| --- | --- |
| Test case name | Request and display home suggestions |
| Objective | Verify the recommendation card's initial, loading, and completed UI states. |
| Pre-conditions | Maya's progress page is ready. |
| Event Sequence - Input | Inspect the recommendation card before interaction. |
| Event Sequence - Output | The placeholder text and enabled `Get suggestions` button are visible. |
| Event Sequence - Input | Press `Get suggestions`. |
| Event Sequence - Output | The button temporarily displays `Generating…` and is disabled. |
| Event Sequence - Input | Wait for preview generation to finish. |
| Event Sequence - Output | A non-empty Maya suggestion replaces the placeholder and the button returns to `Get suggestions`. |
| Post-conditions | The recommendation remains visible on the current page. |

### UI7-06

| Test case ID | UI7-06 (normal) |
| --- | --- |
| Test case name | Navigate to email-update settings |
| Objective | Verify navigation state and the initial preference form. |
| Pre-conditions | The progress dashboard is ready. |
| Event Sequence - Input | Press `Email updates` in the Main navigation. |
| Event Sequence - Output | `Email updates` becomes the current navigation item and the page heading is visible. |
| Event Sequence - Input | Wait for preferences to load. |
| Event Sequence - Output | Emails are enabled, frequency is `Fortnightly`, recipient is `jamie.tan@example.com`, and both action buttons are enabled. |
| Post-conditions | The preference form is ready for input. |

### UI7-07

| Test case ID | UI7-07 (normal) |
| --- | --- |
| Test case name | Toggle email controls and save changes |
| Objective | Verify control state, user editing, normalization, and save confirmation within the UI. |
| Pre-conditions | The Email updates form is ready. |
| Event Sequence - Input | Clear `Send me progress emails`. |
| Event Sequence - Output | `Send update now` becomes disabled while `Save changes` remains enabled. |
| Event Sequence - Input | Re-enable emails, choose `Monthly`, enter `UI.TEST@EXAMPLE.COM`, and press `Save changes`. |
| Event Sequence - Output | The button temporarily displays `Saving…`; then `Saved.` appears and the recipient becomes lower case. |
| Post-conditions | The displayed state is enabled, Monthly, and `ui.test@example.com`. |

### UI7-08

| Test case ID | UI7-08 (normal) |
| --- | --- |
| Test case name | Display immediate-send feedback |
| Objective | Verify the send button's progress and success states using preview responses. |
| Pre-conditions | Email updates are enabled and the form is ready. |
| Event Sequence - Input | Press `Send update now`. |
| Event Sequence - Output | The button temporarily displays `Sending…` and both action buttons are disabled. |
| Event Sequence - Input | Wait for preview sending to complete. |
| Event Sequence - Output | A status message says `Progress update sent to jamie.tan@example.com.` and the controls become enabled again. |
| Post-conditions | The UI remains on Email updates. No email or database row is created. |

### UI7-09

| Test case ID | UI7-09 (normal) |
| --- | --- |
| Test case name | Apply and retain accessibility display settings |
| Objective | Verify the Larger text and High contrast controls and their browser persistence. |
| Pre-conditions | A fresh browser session is on the dashboard. |
| Event Sequence - Input | Press `Larger text` and `High contrast` in the Display settings group. |
| Event Sequence - Output | Both buttons have `aria-pressed=true`; the document root contains `dial-large-text` and `dial-high-contrast`. |
| Event Sequence - Input | Refresh the page. |
| Event Sequence - Output | Both controls remain pressed and both root classes remain applied. |
| Post-conditions | Both preferences are stored as `true` in local storage. |

### UI7-10

| Test case ID | UI7-10 (normal) |
| --- | --- |
| Test case name | Navigate to the login page on logout |
| Objective | Verify the user-visible logout navigation in frontend preview mode. |
| Pre-conditions | The dashboard is visible. |
| Event Sequence - Input | Press `Log out`. |
| Event Sequence - Output | The browser navigates to `/insights/login` and the login form becomes visible. |
| Post-conditions | The UI no longer displays parent or student dashboard information. |

## 7. Traceability

| UI area | Test cases |
| --- | --- |
| Login page | UI7-01, UI7-10 |
| Header and navigation | UI7-02, UI7-06, UI7-10 |
| Child progress dashboard | UI7-02, UI7-03, UI7-04 |
| Summary and recommendations | UI7-03, UI7-04, UI7-05 |
| Email-update form | UI7-06, UI7-07, UI7-08 |
| Accessibility controls | UI7-09 |

## 8. Acceptance criteria

The UI test implementation is complete when:

- All ten cases pass in Chrome using frontend preview data.
- No backend process, Supabase credential, test database, email provider, or LLM is used.
- Tests use explicit waits and stable selectors.
- Every failure saves a screenshot and reports the current URL.
- Browser state is isolated between test cases.
- Existing frontend unit tests and build still pass.

## 9. Implementation and verified results

| Artifact | Location |
| --- | --- |
| UI cases | `frontend/test/ui/das7/das7-ui.spec.js` |
| Vite, Chrome, wait, and screenshot support | `frontend/test/ui/das7/support.js` |
| Headless command | `npm run test:ui:das7` from `frontend/` |
| Headed command | `npm run test:ui:das7:headed` from `frontend/` |

Verification results:

| Verification | Result |
| --- | --- |
| Selenium UI7-01 through UI7-10 | 10/10 passed |
| Existing frontend Jest tests | 7/7 suites, 41/41 tests passed |
| TypeScript and Vite production build | Passed |
| Production dependency audit | 0 vulnerabilities |

The Selenium suite starts only Vite with `VITE_USE_STUBS=true`. It does not start or call the
DAS 7 backend, Supabase, a database, an email provider, or an LLM provider.
