# DAS 7 Selenium UI test plan

## 1. Tooling and execution

| Item | Setting |
| --- | --- |
| Browser automation | Selenium WebDriver for JavaScript |
| Test runner | Node.js built-in test runner |
| Browser | Installed Google Chrome, headless by default |
| UI data source | Existing `frontend/src/stubs/insights.ts` |
| Test location | `frontend/test/ui/das7/` |
| Application URL | `http://localhost:5173` |
| Backend process | Not started |
| Failure evidence | Current URL and screenshot, with no credentials |

Commands:

```bash
npm run test:ui:das7
npm run test:ui:das7:headed
```

The normal command starts Vite in preview-data mode, runs the tests in headless Chrome, and
stops the Vite process afterward. The headed command runs the same tests with Chrome visible.

## 2. UI test data

The tests use the frontend's existing deterministic preview data.

| Preview item | Expected UI value |
| --- | --- |
| Parent | Jamie Tan |
| Student A | Maya Tan, Band B |
| Student B | Ethan Tan, Band A |
| Assessments | Three dates per student |
| Skills | Six skill areas |
| Initial email setting | Enabled, Fortnightly, `jamie.tan@example.com` |

The application restricts preview mode to `localhost` and `127.0.0.1`. The UI tests do not
contain or require Supabase credentials.

Each test starts a fresh browser session to prevent preview preferences and local storage from
leaking between cases.

## 3. Synchronization and selectors

The React UI updates asynchronously and includes a short preview-data delay. Selenium uses explicit waits for visible text, element state, and value changes instead of fixed-duration
sleeps.

Use selectors in this order:

1. IDs: `student-select`, `notify-enabled`, `notify-frequency`, `notify-email`
2. Form names: `email`, `password`
3. Accessible labels and roles: `Main`, `Display settings`, status and alert roles
4. Button and heading text when that text is part of the interface contract

Do not use generated CSS-module class names as selectors. Tests may inspect the document root
for the stable accessibility classes `dial-large-text` and `dial-high-contrast`.

## 4. Test case specifications

The tables follow the lecture format with an ID, test name, objective, preconditions,
alternating input and output events, and postconditions.

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