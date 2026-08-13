# DAS 7 — Parent Insight Dashboard backend

DAS7 is the Express and TypeScript backend for the Parent Insight Dashboard. It lets an authenticated parent:

- view the students linked to their account;
- view a student's reading progress and latest summary;
- generate suggestions for supporting a student at home;
- read and update email-notification preferences;
- send a progress update immediately; and
- receive scheduled progress updates when their saved frequency is due.

The service stores data in the shared Supabase project's `insight` schema. Supabase Auth supplies user identities and access tokens. Summary and recommendation generation can use either the deterministic local stub or OpenRouter; email can use either the in-memory fake or Brevo.

For the detailed design rationale, data model, and error semantics, see [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md). The current unit-test design is in [`docs/UNIT_TEST_PLAN.md`](docs/UNIT_TEST_PLAN.md), and the frontend API contract is in [`docs/FRONTEND_INTEGRATION.md`](docs/FRONTEND_INTEGRATION.md).

## Backend structure

```text
DAS_7/
├── src/
│   ├── index.ts                 composition root, server startup, scheduler startup
│   ├── app.ts                   Express middleware and route assembly
│   ├── config.ts                environment parsing and defaults
│   ├── deps.ts                  dependency interfaces used across layers
│   ├── errors.ts                typed application errors
│   ├── types.ts                 domain types and constants
│   ├── http/
│   │   ├── auth.ts              bearer/JWT authentication and ownership checks
│   │   ├── envelope.ts          common success and error response envelopes
│   │   ├── error-handler.ts     404 and terminal error handling
│   │   └── routes/              health, parent, student, preference, notification routes
│   ├── services/
│   │   ├── insight.service.ts   progress, summary, and recommendation rules
│   │   ├── preference.service.ts preference defaults, validation, and persistence
│   │   ├── notifier.service.ts  immediate and due notification preparation
│   │   └── scheduler.ts         in-process notification timer
│   ├── repos/                   Supabase queries and row-to-domain mapping
│   └── adapters/
│       ├── llm/                 stub and OpenRouter LLM implementations
│       └── email/               fake and Brevo email implementations
├── scripts/seed.ts              repeatable demonstration-data seed
├── test/
│   ├── unit/                    offline unit tests with direct dependencies mocked
│   ├── integration/             real app, routes, JWT verification, and Supabase data
│   └── helpers/                 integration harness and test-user authentication
├── docs/                        architecture, diagrams, test plan, frontend guide
├── .env.example                 runtime and integration-test environment template
├── jest.config.cjs
├── package.json
└── tsconfig*.json
```

Dependencies point inward through the interfaces in `deps.ts`. Routes enforce authentication and ownership, services hold business rules, repositories translate between Supabase rows and domain objects, and adapters isolate the LLM and email providers. `index.ts` constructs each implementation once and injects the completed dependency graph into the application.

## How the features work

All routes except `/health` pass through the same authentication middleware first:

1. The frontend signs the user in with Supabase Auth and sends `Authorization: Bearer <access-token>`.
2. `createAuthenticate()` validates the bearer format and verifies the JWT issuer and signature using the project's JWKS. The remote key set is cached by the verifier.
3. The JWT `sub` is resolved through `ParentRepo.byAuthUserId()`.
4. A missing or invalid token returns `401`; a valid Supabase user without a DAS7 parent profile returns `403`.
5. Student- and parent-specific routes then apply an ownership check. Foreign and nonexistent resources both return `404`, so the API does not reveal another parent's records.

### Load the signed-in parent

`GET /me`

1. Authentication attaches the resolved parent to the request.
2. `StudentRepo.listByParent()` retrieves every linked student.
3. The route returns `{ parent, students }` for the dashboard's initial state.

### Track progress and obtain a summary

`GET /students/:studentId/track-progress`

1. The route checks that the signed-in parent is the student's guardian.
2. `InsightService.getSummary()` confirms that the student exists and has progress records.
3. The service reads the latest stored summary and the newest progress insertion time.
4. A stored summary is reused when it is still current. If it is missing or stale, the LLM generates a new summary and `SummaryRepo.insert()` stores it.
5. The service reads the ordered progress records and returns `{ progress, summary }`.

`GET /students/:studentId/summary` uses the same summary-reuse and regeneration flow but returns only the summary.

### Generate home recommendations

`POST /students/:studentId/recommendations`

1. The route checks guardianship.
2. The service loads the student and their latest **stored** summary.
3. If no summary exists, the request returns `404 summaryUnavailable`; recommendation generation does not create a summary implicitly.
4. The LLM produces recommendation text from the student and summary.
5. `RecommendationRepo.insert()` stores and returns the generated recommendation.

### Read and save notification preferences

`GET /parents/:parentId/preferences`

1. The route requires the URL parent ID to match the signed-in parent.
2. The saved preference is returned when present.
3. If no preference has been saved, the service returns a non-persisted default: notifications disabled, Weekly frequency, and the parent's account email.

`PUT /parents/:parentId/preferences`

1. The same ownership check runs first.
2. The body must contain a Boolean `enabled`, a `Weekly`, `Fortnightly`, or `Monthly` frequency, and a valid recipient email.
3. The email is trimmed and lowercased.
4. The parent ID is taken from the URL, never from the body.
5. `PreferenceRepo.upsert()` saves and returns the preference.

### Send a progress update immediately

`POST /parents/:parentId/notifications`

1. The route checks parent ownership.
2. The notifier requires an enabled preference, the parent record, and at least one linked student.
3. It obtains a current summary for each student sequentially.
4. It builds one combined email and sends it through the configured email provider.
5. After a successful send, it records the delivery in `email_notifications`. If recording fails, the send still counts as successful and the database failure is logged.
6. A preparation or delivery failure maps to `503 notificationFailed`.

The manual send uses the same delivery history as scheduled sends. Its recorded `sent_at` therefore becomes the latest send time used by future due checks.

### Send scheduled updates

When `SCHEDULER_ENABLED=true`:

1. The in-process scheduler wakes every `SCHEDULER_TICK_MS` milliseconds.
2. `PreferenceRepo.listEnabled()` finds enabled preferences.
3. For each parent, `EmailNotificationRepo.lastSentAt()` is compared with the configured Weekly, Fortnightly, or Monthly interval.
4. A due parent goes through the same notification flow described above.
5. A failure for one parent is recorded as `notificationFailed` and does not stop later parents. A repository failure while determining the last send ends that sweep; the next timer tick tries again.

The scheduler is off by default. Its timer is stopped during graceful shutdown.

## Local setup

### Prerequisites

- Node.js 22 or newer
- npm
- access to the team's Supabase project, or a separate approved development project
- a Supabase Auth user for the demonstration parent

The backend runs directly on the host on port `4000`; it is not part of the DAS3 Docker stack.

### 1. Install backend dependencies

From the repository root:

```bash
cd DAS_7
npm install
```

### 2. Create the backend environment file

PowerShell:

```powershell
Copy-Item .env.example .env
```

macOS/Linux:

```bash
cp .env.example .env
```

At minimum, set:

```dotenv
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-server-only-service-role-key
SUPABASE_DB_SCHEMA=insight
```

Never put `SUPABASE_SERVICE_ROLE_KEY` in the frontend or commit `.env`. It bypasses RLS and belongs only in backend environments.

For a fully offline LLM/email development mode, keep:

```dotenv
LLM_PROVIDER=stub
EMAIL_PROVIDER=fake
SCHEDULER_ENABLED=false
```

The fake email provider records messages only in process memory. It does not deliver email.

### 3. Prepare Supabase

The shared migration history is in [`../db/migrations`](../db/migrations). Follow [`../db/migrations/README.md`](../db/migrations/README.md) and apply the SQL files in filename order. Do not rewrite or renumber migrations that have already been applied.

For a new project:

1. Apply the migrations in lexical order.
2. In the Supabase Dashboard, expose the `insight` schema through the Data API settings. The backend's Supabase client queries this schema through the Data API.
3. Create a parent login under **Authentication → Users**.
4. Copy that Auth user's UUID. The `insight.parents.auth_user_id` value must match it.

The migrations enable RLS and revoke browser roles from service-owned tables. The backend uses the service-role key and enforces user ownership in its HTTP layer.

### 4. Seed demonstration data

Set the Auth user's UUID in `DAS_7/.env`:

```dotenv
SEED_AUTH_USER_ID=the-demo-parent-auth-user-uuid
```

Then run:

```bash
npm run seed
```

The seed is repeatable. It upserts fixed demonstration records in the `insight`
schema rather than duplicating them. It creates three students and 108 progress
records across six assessment dates, including temporary dips and recoveries.
Use a separate demonstration user—not either integration-test user—because the
integration harness temporarily owns and removes its test users' parent profiles.

#### Account-separation demonstration

The shared demonstration project also contains a second parent account for checking
that authenticated parents see only their own linked students:

| Parent | Email | Password | Linked student |
|---|---|---|---|
| Daniel Tan | `esc.parent.separate@example.com` | `S2Y9Dqz7xCiaCoLh4N5lDvv7Aa1!` | Chloe Tan |

Chloe has 24 progress records covering six skills over four dates. The values include
dips and recoveries so charts demonstrate non-linear progress. Daniel's notification
preference is disabled and set to Weekly.

This account is distinct from the primary demonstration parent: the Auth user IDs are
different, Daniel is linked only to Chloe, and no student link is shared between the
two parents. Signing in as Daniel should therefore return only Chloe from `GET /me`;
requests for a student belonging to the other parent should return `404`.

The account and its data were provisioned directly in the shared Supabase project and
are not currently recreated by `npm run seed`. The password is a shared demonstration
credential; change it if the account is retained outside the controlled demo project,
and never reuse it for a production account.

### 5. Start the backend

```bash
npm run dev
```

The API listens at `http://localhost:4000`. Check it directly with:

```text
http://localhost:4000/health
```

Other backend commands:

| Command | Purpose |
|---|---|
| `npm run typecheck` | Type-check source, unit tests, and scripts |
| `npm run build` | Compile production JavaScript into `dist/` |
| `npm start` | Run the compiled backend |
| `npm run seed` | Upsert the demonstration dataset |
| `npm test` | Run unit tests and any configured integration tests |

### 6. Start the shared frontend

The browser should call `/api/insights/...`, not port `4000` directly. The root frontend's Vite server proxies that prefix to DAS7 and removes the prefix before forwarding.

In a second terminal, from the repository root:

```bash
cd frontend
npm install
```

Copy `frontend/.env.example` to `frontend/.env`, then set:

```dotenv
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-browser-safe-publishable-key
VITE_DAS7_API_URL=/api/insights
VITE_USE_STUBS=false
```

Start Vite:

```bash
npm run dev
```

Open the URL printed by Vite, normally `http://localhost:5173`, and log in with the Supabase Auth user linked through `SEED_AUTH_USER_ID`.

## API endpoints

The backend mounts routes without an `/api` prefix. Direct backend paths and browser-facing paths are shown together:

| Method | Backend path | Browser path | Purpose |
|---|---|---|---|
| `GET` | `/health` | `/api/insights/health` | Public liveness check |
| `GET` | `/me` | `/api/insights/me` | Signed-in parent and linked students |
| `GET` | `/students/:studentId/track-progress` | `/api/insights/students/:studentId/track-progress` | Ordered progress and current summary |
| `GET` | `/students/:studentId/summary` | `/api/insights/students/:studentId/summary` | Current summary only |
| `POST` | `/students/:studentId/recommendations` | `/api/insights/students/:studentId/recommendations` | Generate and store home recommendations |
| `GET` | `/parents/:parentId/preferences` | `/api/insights/parents/:parentId/preferences` | Read saved preferences or defaults |
| `PUT` | `/parents/:parentId/preferences` | `/api/insights/parents/:parentId/preferences` | Validate and save preferences |
| `POST` | `/parents/:parentId/notifications` | `/api/insights/parents/:parentId/notifications` | Send a progress update immediately |

Every response uses one JSON envelope:

```json
{ "ok": true, "data": {} }
```

or:

```json
{ "ok": false, "error": "reason" }
```

Common statuses are `400` for preference validation, `401` for missing or invalid authentication, `403` for an authenticated non-parent account, `404` for hidden/unavailable resources, `503` for provider or authentication-key infrastructure failures, and `500` for an unexpected internal failure.

## Provider setup

### OpenRouter

The default `stub` provider is deterministic and makes no external request. To use OpenRouter:

```dotenv
LLM_PROVIDER=openrouter
LLM_API_KEY=your-openrouter-key
LLM_MODEL=your-model-id
LLM_TIMEOUT_MS=10000
```

Although `anthropic`, `openai`, and `gemini` are accepted configuration values, adapters for them are not implemented and the backend will refuse to start with one selected.

### Brevo

The default `fake` provider does not send email. To use Brevo:

```dotenv
EMAIL_PROVIDER=brevo
BREVO_API_KEY=your-brevo-key
EMAIL_FROM=a-verified-sender@example.com
```

The sender address must be verified in Brevo. Missing provider credentials fail during startup rather than during the first request.

### Scheduler

```dotenv
SCHEDULER_ENABLED=true
SCHEDULER_TICK_MS=900000
NOTIFY_WEEKLY_MS=604800000
NOTIFY_FORTNIGHTLY_MS=1209600000
NOTIFY_MONTHLY_MS=2592000000
```

The interval values are milliseconds. The defaults above are 15 minutes, 7 days, 14 days, and 30 days respectively.

## Testing

### Unit tests

```bash
npm test -- test/unit
```

The unit suite contains **174 tests** and runs offline. It isolates routes, authentication helpers, services, repositories, row mappers, schedulers, and provider adapters by mocking each unit's direct outgoing dependencies. No unit test contacts Supabase, OpenRouter, or Brevo.

### Integration tests

Integration tests use the real Express app, repositories, routes, JWT verification, and a real Supabase test project. Only the LLM and email boundaries are replaced with deterministic fakes.

Set these values in `DAS_7/.env`:

```dotenv
SUPABASE_URL=https://your-test-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-test-service-role-key
SUPABASE_ANON_KEY=your-test-browser-key
TEST_SUPABASE_REF=your-test-project-ref
TEST_USER_A_EMAIL=first-dedicated-test-user@example.com
TEST_USER_A_PASSWORD=first-test-password
TEST_USER_B_EMAIL=second-dedicated-test-user@example.com
TEST_USER_B_PASSWORD=second-test-password
```

Create both test users manually in Supabase Auth. Do not seed either user's UUID. The harness signs them in, creates its own parent/student/progress rows, and deletes those rows after the run.

Run all integration suites with:

```bash
npm test -- test/integration
```

The suites skip unless `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `TEST_SUPABASE_REF` are set and the URL contains the stated project reference. This guard makes running against the wrong project deliberate; do not weaken it. Once the guard passes, the anon key and both test-user credential pairs are also required.

Jest runs serially (`maxWorkers: 1`) because the integration suites share one project and two Auth users. The notification sweep may process other enabled preferences already present in that test project, so use a dedicated test project where possible and inspect its data after notification tests.

Running plain `npm test` executes the unit suite and either runs or skips the integration suites according to this guard.

## Production runtime

Build and start the backend with:

```bash
npm run build
npm start
```

The production reverse proxy must reproduce the development proxy contract: forward `/api/insights/*` to DAS7 and strip `/api/insights` before the request reaches Express. Keep `SUPABASE_SERVICE_ROLE_KEY` server-side, use real provider credentials only through the deployment environment, and enable the scheduler in only one process unless duplicate sweeps are intentionally coordinated.
