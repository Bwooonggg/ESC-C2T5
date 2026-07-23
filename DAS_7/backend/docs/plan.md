# DAS 7 Backend Implementation Plan

**Status:** Approved implementation sequence; Phase 6 complete; Phase 7 next

**Testing stack:** Jest, `ts-jest`, and Supertest

This plan implements the architecture in
[`backend-architecture.md`](backend-architecture.md). Complete the phases in
order and keep each phase passing before beginning the next one.

## Phase 0: Verify the Scaffold — DONE

The scaffold verification is complete. Dependencies are installed, the Jest
test harness is configured, the health routes have HTTP smoke coverage, and
the TypeScript checks and production build pass. The repository also ignores
the generated build, coverage, test-transform, environment, log, and dependency
directories, and the backend files follow the four-space indentation convention.

1. Install dependencies with `npm install`.
2. Run `npm run typecheck`, `npm run build`, and `npm test`.
3. Start the API and verify `GET /api/health`.
4. Confirm that `.env`, `dist/`, `coverage/`, logs, and `node_modules/` remain ignored.
5. Confirm that backend files use four spaces for indentation.

**Done when:** the existing scaffold builds and both health-route tests pass.

## Phase 1: Establish Configuration — DONE

The configuration boundary is implemented. `src/config/environment.ts` loads
`.env`, validates API, MySQL, generator, email, and worker settings, applies
development/test defaults, and rejects incomplete production configuration.
Authentication configuration is intentionally deferred to the final phase. API
and worker entrypoints receive separate typed containers instead of reading
`process.env` directly.

The public frontend and API will share one origin. Public path forwarding is a
deployment responsibility rather than a browser-origin setting in the backend.

1. Add startup validation for API, MySQL, generator, email, and worker settings.
2. Fail startup with a clear configuration error when a required production value is missing or invalid.
3. Keep environment access inside `src/config/`; pass validated configuration into other components.
4. Create separate API and worker dependency containers.
5. Test valid, missing, and malformed configuration with Jest.

**Done when:** neither process reads unvalidated environment variables outside the configuration layer.

## Phase 2: Build the Domain and Interfaces — DONE

### Step 1 — DONE: Implement the domain entities

The diagram entities now exist as backend-owned classes with basic invariants:
`User`, `Parent`, `Student`, `ProgressRecord`, `Summary`, `Recommendation`,
`EmailNotification`, and `NotificationPreference`. Their tests do not require
Express, MySQL, or external services.

1. [DONE] Implement `User`, `Parent`, `Student`, `ProgressRecord`, `Summary`, `Recommendation`, `EmailNotification`, and `NotificationPreference`.
2. [DONE] Add immutable value objects for account type, skill area, email address, and notification frequency.
3. [DONE] Define repository interfaces for each persistence requirement.
4. [DONE] Define ports for summary generation, recommendation generation, email delivery, and time. Password hashing and token/session service ports are deferred to the final authentication phase; persistence repository contracts may remain in place for integration.
5. [DONE] Add domain errors for validation, unavailable progress, and unavailable summaries. Authentication and authorization errors are deferred to the final phase.
6. [DONE] Test entity invariants and failure cases without Express or MySQL.

**Done when:** domain and application types have no dependency on Express, MySQL2, or provider-specific clients. Authentication-specific ports and errors remain deferred to the final phase.

## Phase 3: Create the MySQL Schema — DONE

The schema and integration verification for all six steps are implemented in
[`database-schema.md`](database-schema.md) and the plain SQL files under
`db/migrations/`. These files define the domain tables, direct relationships,
foreign keys, database-level validity constraints, and query-driven secondary
indexes. A portable migration runner now applies these files from validated
environment configuration. The many-to-many guardian
relationship uses foreign keys to prevent invalid pairs; its class-diagram
`1..*` minimum on both sides is completed by application workflows because
ordinary foreign keys cannot enforce a minimum child count.

### Phase 3 step tracking

1. **DONE:** Map domain entities and supporting records to tables.
2. **DONE:** Define parent-student, student-record, summary, recommendation,
   notification, job, and audit relationships with foreign keys.
3. **DONE:** Add required-field, uniqueness, normalization, allow-list, range,
   and state consistency constraints.
4. **DONE:** Add query-driven secondary indexes in
   `0011_add_query_indexes.sql`.
5. **DONE:** Configure the portable migration runner and database command.
6. **DONE:** Apply the migrations to an isolated MySQL database and add
   integration coverage.

Create plain SQL migrations in this order:

1. Users and parents.
2. Students, their current progress versions, and parent-student guardian
   relationships.
3. Progress records.
4. Summaries and their source progress-version snapshots.
5. Recommendations and their basis summary.
6. Notification preferences.
7. Email notifications.
8. Durable notification jobs.
9. Audit events.
10. Idempotency records.
11. Query-driven secondary indexes.

The migration runner creates the operational `schema_migrations` table, uses a
database-scoped advisory lock, records SHA-256 checksums, and rejects missing
or modified applied files. Migration paths are resolved relative to the
entrypoint rather than the process working directory.

The Jest integration suite loads `.env.integration` when present, while CI can
provide the same `MYSQL_TEST_*` values directly. It runs the migration command
against a dedicated database, verifies replay and checksums, checks all
expected InnoDB tables and query indexes, and exercises representative
foreign-key, allow-list, and score constraints. The base `npm test` command
keeps this suite excluded so unit and HTTP tests remain database-free.

Authentication behavior, secret management, verification workflows, and
session tables are added by the final authentication phase. The initial
`users` table retains `password_hash` and `is_verified` because they are
structural fields in the existing `User` domain entity.

Use MySQL 8, InnoDB, foreign keys, UTC `DATETIME(3)` timestamps, and `DATE` for
dates without a time. Test migration application against an isolated database.

**Done:** a blank test database can be migrated reproducibly, all
database-enforceable diagram relationships are enforced, and application
workflows maintain the guardian relationship's `1..*` minimum.

## Phase 4: Implement MySQL Repositories — DONE

1. **DONE:** Configure one `mysql2/promise` connection pool per process.
2. **DONE:** Implement row mappers so SQL result shapes do not escape the infrastructure layer.
3. **DONE:** Implement repositories with parameterized statements.
4. **DONE:** Add transaction support for related changes.
5. **DONE:** Test CRUD, guardian lookup, summary history, latest-summary
   selection, idempotency, and rollback behavior.
6. **DONE:** Run MySQL suites serially with `npm run test:integration`.

The row-mapping boundary is implemented under
`src/infrastructure/mysql/mappers/`. It accepts the snake_case columns selected
by repositories, converts MySQL date, decimal, boolean, and JSON representations,
and constructs validated domain entities or application records. Authentication
session mapping remains deferred with the final authentication phase.

Concrete MySQL repositories are implemented under
`src/infrastructure/mysql/repositories/`. They use the row mappers and bind
all dynamic values through `mysql2` prepared statements. Notification job
claiming uses a checked-out connection with `FOR UPDATE SKIP LOCKED` through the
shared `withMySqlTransaction` boundary in
`src/infrastructure/mysql/transaction-manager.ts`. Related workflows can pass
that same checked-out connection to multiple repositories, while generator and
email-provider calls remain outside the transaction. Idempotency records use a
composite scope/operation/key boundary and preserve terminal responses instead
of overwriting them on repeated requests.

**Done when:** application workflows can use repositories without importing SQL or MySQL-specific types.

## Phase 5: Implement External Generator Boundaries — DONE

1. **DONE:** Define the summary-generator request and response contract.
2. **DONE:** Define the recommendation-generator request and response contract.
3. **DONE:** Implement diagram-facing generator adapters around replaceable clients.
4. **DONE:** Add runtime response validation, request timeouts, correlation IDs, and idempotency IDs.
5. **MOVED:** Test application logic with injected fakes; complete it with the Phase 6 and Phase 7 application workflows.
6. **MOVED:** Test adapters against controlled HTTP servers; complete it after real provider wiring in Phase 11.

**Done when:** replacing an external generator requires changing only its adapter and composition wiring.

The summary-generator logical contract is recorded in
[`contracts/summary-generator.contract.md`](../contracts/summary-generator.contract.md).
The existing `SummaryGeneratorPort` remains provider-neutral: it accepts one
student/progress snapshot and returns validated content plus optional provider
metadata. Provider transport details, correlation IDs, timeouts, and retries
remain adapter responsibilities.

The diagram-facing adapters now live under `src/adapters/generators/`. They
receive injected, provider-neutral clients, map domain students, progress
records, and summaries to client request shapes, and map client responses back
to the generator ports. No HTTP library, SDK, endpoint, or provider response
schema is selected at this stage; those concerns belong to the provider client
and the runtime-hardening work in step 4.

Step 4 is implemented by the generic `GeneratorHttpClient`. It validates
successful responses against the shared Zod response schema, aborts requests
after the configured service timeout, forwards correlation and idempotency
headers, and normalizes HTTP, timeout, transport, and malformed-response
failures into `GeneratorServiceError`. The client accepts injected headers and
`fetch` so provider authentication and testing remain replaceable.

The application seams used by the diagrams are present under
`src/modules/track-progress/application/`. `TrackProgressModel` loads a
student snapshot, skips generation when progress is unavailable, regenerates
when the progress version changes during generation, and persists only a
summary based on the current version. `RecommendationModel` loads the latest
summary, generates a recommendation from that exact summary, and persists the
basis relationship. Their final workflow tests are scheduled with the
corresponding application phases below.

The two remaining generator test activities are intentionally scheduled after
their dependencies exist: application fake tests are completed with Phases 6
and 7, while controlled HTTP/provider tests are completed in Phase 11.

The recommendation-generator logical contract is recorded in
[`contracts/recommendation-generator.contract.md`](../contracts/recommendation-generator.contract.md).
It accepts exactly one persisted summary and returns one recommendation content
value plus optional provider metadata; the backend owns recommendation identity
and the summary relationship.

## Phase 6: Implement Track Progress and Summary — DONE

Implement:

- `GET /api/students/:studentId/track-progress`
- `GET /api/students/:studentId/summary`

For each request:

1. **DONE:** Resolve the student context through the application boundary. Production authentication and guardian authorization are added in the final phase.
2. **DONE:** Load ordered progress records and the student's current progress-version
   marker from MySQL as one snapshot.
3. **DONE:** Return `progressUnavailable` when progress cannot be obtained.
4. **DONE:** Generate a summary through the adapter.
5. **DONE:** Validate the generated summary, verify the progress version is still current,
   and persist it; regenerate if a concurrent progress write made the snapshot
   stale.
6. **DONE:** Return the frontend response envelope.

**DONE:** Coalesce overlapping requests for the same student progress version so
the frontend cannot accidentally cause duplicate generator work.

**DONE:** Add or finalize application-level Jest tests with injected fakes for missing
progress, generator failures, invalid generated content, stale-version
regeneration, summary persistence, and stable invocation context reuse.

The HTTP/controller, application, and database-backed end-to-end tests now cover
the success, `progressUnavailable`, validation, stale-version, persistence, and
concurrent-request branches. The end-to-end test uses the real MySQL
repositories and a controlled in-process summary generator, so external
provider credentials are not required for this phase.

**Done when:** the success and `progressUnavailable` branches from the Track Child's Progress diagram pass HTTP and database-backed end-to-end tests.

## Phase 7: Implement Recommendations

Implement `POST /api/students/:studentId/recommendations`:

1. Resolve the student context through the application boundary. Production authentication and authorization are added in the final phase.
2. Load the student's latest summary.
3. Return a public error when no summary exists.
4. Generate recommendations through the external-service adapter.
5. Persist the recommendation with its basis summary.
6. Return it in the standard response envelope.

Complete application-level Jest tests with injected fakes for missing summaries,
generator failures, summary-basis selection, recommendation persistence, and
stable invocation context reuse.

**Done when:** recommendations are generated only after an explicit parent request and always reference their basis summary.

## Phase 8: Implement Notification Preferences

Implement:

- `GET /api/parents/:parentId/preferences`
- `PUT /api/parents/:parentId/preferences`

Validate enabled state, notification frequency, and recipient email. Parent
ownership and cross-parent access checks are added in the final authentication
and authorization phase. Test defaults, updates, and invalid data now; add
access-control tests when that phase is integrated.

**Done when:** preference data validates and persists correctly; parent ownership checks are added in the final authentication and authorization phase.

## Phase 9: Implement Data Ingestion

Add versioned staff/system endpoints for:

- Creating parents.
- Creating students.
- Assigning guardians.
- Adding progress records.
- Correcting progress records.

Require request validation, provenance, audit records, transactions, and
idempotency keys. Staff/system authorization is added in the final
authentication and authorization phase. Progress writes update the current
progress version but do not generate summaries.

**Done when:** repeated writes are safe, invalid requests are rejected, and every accepted mutation is auditable; staff/system authorization is added in the final phase.

## Phase 10: Implement the Notification Worker

1. Use the worker clock to find due parent preferences.
2. Create or claim one durable job for each parent-student pair.
3. Load that student's progress records and current progress-version marker as
   one snapshot.
4. Generate a fresh summary, revalidate the version snapshot, and persist it
   only if it is still current; regenerate if a concurrent progress write made
   it stale.
5. Create an `EmailNotification` referencing one parent and one summary, then
   attach its summary and notification IDs to the durable job in the same
   transaction.
6. Send it through the email adapter.
7. Persist success or failure with `failed_at`, `retry_at`, and `last_error`,
   keeping the original schedule time stable; retry only transient failures
   with capped backoff.
8. Use leases so another worker can recover work after a crash without duplicate delivery.

Use Jest fake timers and a fixed clock for schedule tests. Test weekly,
fortnightly, monthly, retry, crash-recovery, and concurrent-worker scenarios.

**Done when:** both branches in the Notify Parent sequence diagram pass end-to-end tests without a public notification-trigger route.

## Phase 11: Connect Real Providers

1. Connect the summary and recommendation clients to the selected service endpoints.
2. Connect the email adapter to the selected email provider.
3. Keep provider-specific data inside adapters.
4. Test the adapters against controlled HTTP servers for success, invalid
   responses, authentication failure, rate limiting, timeouts, and retryable
   errors.
5. Confirm secrets and generated student content are excluded from logs and fixtures.

**Done when:** provider implementations can be replaced without changing controllers, application workflows, or domain entities.

## Phase 12: Harden and Prepare for Deployment

1. Add request IDs, structured logging, sensitive-data redaction, security headers, body limits, and rate limiting.
2. Add MySQL readiness checks and worker operational health reporting.
3. Implement graceful shutdown for HTTP, database, and worker resources.
4. Configure the public host to serve the React application at `/` and forward `/api/*` to Express on the same origin.
5. Document migrations, deployment, rollback, backup, and restore procedures.
6. Run frontend compatibility checks against the backend.
7. Run the complete acceptance command set.

**Done when:** the system fails safely and observably during database outages,
generator failures, email failures, malformed provider responses, and worker crashes.

## Phase 13: Implement Authentication and Authorization

Implement this phase after the remaining application workflows, providers, and
deployment hardening are complete. The authentication and authorization
implementation is intentionally owned and integrated with the groupmate's work.

1. Agree on the authenticated-principal, password-hasher, token/session, and middleware contracts.
2. Add authentication configuration, credential/session/verification migrations, and secret management.
3. Implement signup if the final product requires a public account-creation flow.
4. Implement login, verification, logout, password hashing, and session or token handling.
5. Add authentication and authorization domain errors plus authentication, role, and guardian authorization middleware.
6. Protect `/api/me`, student, preference, and ingestion routes with the agreed authorization rules.
7. Replace any development identity or test-only principal in deployed environments.
8. Test invalid credentials, expiry, revocation, unverified accounts, role restrictions, guardian restrictions, and session/token failures.

**Done when:** deployed environments require the integrated authentication boundary,
parents can access only their own students, and staff/system routes reject
unauthorized callers.

## Public API Contract

Preserve these routes:

- `GET /api/health`
- `GET /api/health/ready`
- `GET /api/me`
- `GET /api/students/:studentId/track-progress`
- `GET /api/students/:studentId/summary`
- `POST /api/students/:studentId/recommendations`
- `GET /api/parents/:parentId/preferences`
- `PUT /api/parents/:parentId/preferences`

Successful responses use `{ "ok": true, "data": ... }`. Failed responses use
`{ "ok": false, "error": "..." }`. The frontend never connects directly to
MySQL; it accesses persisted data through these APIs.

## Jest Test Organization

- `test/unit/`: domain and application behavior using injected fakes.
- `test/http/`: Express routing, middleware, validation, and envelopes using Supertest.
- `test/integration/mysql/`: migrations, repositories, and transactions against real MySQL.
- `test/integration/generator-adapters/`: generator client boundaries.
- `test/integration/email-adapter/`: email-provider boundaries.
- `test/contract/`: frontend and external-service request and response shapes.
- `test/e2e/`: complete API and worker workflows.
- `test/fixtures/`: fictional reusable test data.

Use `.test.ts` filenames. Prefer dependency injection and explicit fakes for
business logic, Jest mocks for technical boundaries, and Jest fake timers for
clock-controlled behavior. Do not introduce Vitest.

## Final Acceptance Commands

Run from `backend/`:

```powershell
npm run typecheck
npm run build
npm test
npm run test:integration
npm run test:contract
npm run test:e2e
```

Integration and end-to-end commands require an isolated MySQL test database
after those suites are implemented. Empty future suite directories should not
be created merely to satisfy this document.

## Fixed Decisions

- Use four spaces for indentation.
- Use raw Express and TypeScript.
- Use Jest, `ts-jest`, and Supertest; do not use Vitest.
- Keep production compilation on ESM/NodeNext and use CommonJS only for Jest tests.
- Use `mysql2/promise` and plain SQL migrations without an ORM.
- Run the API and worker as separate processes from one modular-monolith codebase.
- Treat summary, recommendation, and email services as external replaceable adapters.
- Serve the frontend and `/api` through one public origin; do not expose cross-origin browser API access.
- Generate summaries during Track Progress, Request Summary, and Notify Parent.
- Generate recommendations only after an explicit parent request.
- Send one scheduled email per student with one attached summary.
- Use Singapore time for weekly, fortnightly, and monthly schedules.
