# DAS 7 Backend Implementation Plan

**Status:** Approved implementation sequence; Phase 2 in progress

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

## Phase 2: Build the Domain and Interfaces — IN PROGRESS

### Step 1 — DONE: Implement the domain entities

The diagram entities now exist as backend-owned classes with basic invariants:
`User`, `Parent`, `Student`, `ProgressRecord`, `Summary`, `Recommendation`,
`EmailNotification`, and `NotificationPreference`. Their tests do not require
Express, MySQL, or external services.

1. [DONE] Implement `User`, `Parent`, `Student`, `ProgressRecord`, `Summary`, `Recommendation`, `EmailNotification`, and `NotificationPreference`.
2. [DONE] Add immutable value objects for account type, skill area, email address, and notification frequency.
3. [DONE] Define repository interfaces for each persistence requirement.
4. Define ports for summary generation, recommendation generation, email delivery, and time. Password hashing and token/session service ports are deferred to the final authentication phase; persistence repository contracts may remain in place for integration.
5. Add domain errors for validation, unavailable progress, and unavailable summaries. Authentication and authorization errors are deferred to the final phase.
6. Test entity invariants and failure cases without Express or MySQL.

**Done when:** domain and application types have no dependency on Express, MySQL2, or provider-specific clients.

## Phase 3: Create the MySQL Schema

Create plain SQL migrations in this order:

1. Users and parents.
2. Students and parent-student guardian relationships.
3. Progress records.
4. Summaries and their source progress version.
5. Recommendations and their basis summary.
6. Notification preferences.
7. Email notifications.
8. Durable notification jobs.
9. Audit events and idempotency records.

Credential, verification, and session tables are added by the final
authentication phase rather than this initial schema pass.

Use MySQL 8, InnoDB, foreign keys, UTC `DATETIME(3)` timestamps, and `DATE` for
dates without a time. Test migration application against an isolated database.

**Done when:** a blank test database can be migrated reproducibly and all diagram relationships are enforced.

## Phase 4: Implement MySQL Repositories

1. Configure one `mysql2/promise` connection pool per process.
2. Implement row mappers so SQL result shapes do not escape the infrastructure layer.
3. Implement repositories with parameterized statements.
4. Add transaction support for related changes.
5. Test CRUD, guardian lookup, summary history, latest-summary selection, idempotency, and rollback behavior.
6. Run MySQL suites serially with `npm run test:integration`.

**Done when:** application workflows can use repositories without importing SQL or MySQL-specific types.

## Phase 5: Implement External Generator Boundaries

1. Define the summary-generator request and response contract.
2. Define the recommendation-generator request and response contract.
3. Implement diagram-facing generator adapters around replaceable clients.
4. Add runtime response validation, request timeouts, correlation IDs, and idempotency IDs.
5. Test application logic with injected fakes.
6. Test adapters against controlled HTTP servers for success, invalid data, timeouts, and provider failures.

**Done when:** replacing an external generator requires changing only its adapter and composition wiring.

## Phase 6: Implement Track Progress and Summary

Implement:

- `GET /api/students/:studentId/track-progress`
- `GET /api/students/:studentId/summary`

For each request:

1. Resolve the student context through the application boundary. Production authentication and guardian authorization are added in the final phase.
2. Load ordered progress records from MySQL.
3. Return `progressUnavailable` when progress cannot be obtained.
4. Generate a summary through the adapter.
5. Validate and persist the summary.
6. Return the frontend response envelope.

Coalesce overlapping requests for the same student progress version so the
frontend cannot accidentally cause duplicate generator work.

**Done when:** the success and `progressUnavailable` branches from the Track Child's Progress diagram pass HTTP and end-to-end tests.

## Phase 7: Implement Recommendations

Implement `POST /api/students/:studentId/recommendations`:

1. Resolve the student context through the application boundary. Production authentication and authorization are added in the final phase.
2. Load the student's latest summary.
3. Return a public error when no summary exists.
4. Generate recommendations through the external-service adapter.
5. Persist the recommendation with its basis summary.
6. Return it in the standard response envelope.

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
3. Load that student's progress records.
4. Generate and persist a fresh summary.
5. Create an `EmailNotification` referencing one parent and one summary.
6. Send it through the email adapter.
7. Persist success or failure and retry only transient failures with capped backoff.
8. Use leases so another worker can recover work after a crash without duplicate delivery.

Use Jest fake timers and a fixed clock for schedule tests. Test weekly,
fortnightly, monthly, retry, crash-recovery, and concurrent-worker scenarios.

**Done when:** both branches in the Notify Parent sequence diagram pass end-to-end tests without a public notification-trigger route.

## Phase 11: Connect Real Providers

1. Connect the summary and recommendation clients to the selected service endpoints.
2. Connect the email adapter to the selected email provider.
3. Keep provider-specific data inside adapters.
4. Add contract tests for success, invalid responses, authentication failure, rate limiting, timeouts, and retryable errors.
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
