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
`.env`, validates all API, MySQL, generator, email, authentication, and worker
settings, applies development/test defaults, and rejects incomplete production
configuration. API and worker entrypoints now receive separate typed containers
instead of reading `process.env` directly.

1. Add startup validation for API, MySQL, generator, email, authentication, and worker settings.
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
2. Add value objects for account type, skill area, email address, and notification frequency.
3. Define repository interfaces for each persistence requirement.
4. Define ports for summary generation, recommendation generation, email delivery, password hashing, tokens, and time.
5. Add domain errors for validation, authentication, authorization, unavailable progress, and unavailable summaries.
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
8. Authentication sessions and verification data.
9. Durable notification jobs.
10. Audit events and idempotency records.

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

## Phase 5: Add Development Identity and Parent Context

1. Add a development-only authenticated parent identity.
2. Implement `GET /api/me` using the parent and student repositories.
3. Add authentication, role authorization, and guardian authorization middleware.
4. Return only students associated with the authenticated parent.
5. Test valid access, missing identity, wrong role, and unrelated-student access with Supertest.

**Done when:** the current frontend can load a parent and their guarded students without bypassing authorization rules.

## Phase 6: Implement External Generator Boundaries

1. Define the summary-generator request and response contract.
2. Define the recommendation-generator request and response contract.
3. Implement diagram-facing generator adapters around replaceable clients.
4. Add runtime response validation, request timeouts, correlation IDs, and idempotency IDs.
5. Test application logic with injected fakes.
6. Test adapters against controlled HTTP servers for success, invalid data, timeouts, and provider failures.

**Done when:** replacing an external generator requires changing only its adapter and composition wiring.

## Phase 7: Implement Track Progress and Summary

Implement:

- `GET /api/students/:studentId/track-progress`
- `GET /api/students/:studentId/summary`

For each request:

1. Authenticate the parent.
2. Verify the guardian relationship.
3. Load ordered progress records from MySQL.
4. Return `progressUnavailable` when progress cannot be obtained.
5. Generate a summary through the adapter.
6. Validate and persist the summary.
7. Return the frontend response envelope.

Coalesce overlapping requests for the same student progress version so the
frontend cannot accidentally cause duplicate generator work.

**Done when:** the success and `progressUnavailable` branches from the Track Child's Progress diagram pass HTTP and end-to-end tests.

## Phase 8: Implement Recommendations

Implement `POST /api/students/:studentId/recommendations`:

1. Authenticate and authorize the parent.
2. Load the student's latest summary.
3. Return a public error when no summary exists.
4. Generate recommendations through the external-service adapter.
5. Persist the recommendation with its basis summary.
6. Return it in the standard response envelope.

**Done when:** recommendations are generated only after an explicit parent request and always reference their basis summary.

## Phase 9: Implement Notification Preferences

Implement:

- `GET /api/parents/:parentId/preferences`
- `PUT /api/parents/:parentId/preferences`

Validate parent ownership, enabled state, notification frequency, and recipient
email. Test defaults, updates, invalid data, and cross-parent access.

**Done when:** a parent can safely configure their own schedule and recipient but cannot change another parent's settings.

## Phase 10: Implement Production Authentication

1. Implement login, verification, logout, sessions or tokens, and password hashing.
2. Store password hashes only.
3. Replace the development identity outside development mode.
4. Preserve the authenticated-user type already consumed by middleware.
5. Test expiry, revocation, invalid credentials, unverified accounts, and role restrictions.

**Done when:** deployed environments cannot enable or fall back to the development identity.

## Phase 11: Implement Data Ingestion

Add versioned staff/system endpoints for:

- Creating parents.
- Creating students.
- Assigning guardians.
- Adding progress records.
- Correcting progress records.

Require request validation, staff/system authorization, provenance, audit
records, transactions, and idempotency keys. Progress writes update the current
progress version but do not generate summaries.

**Done when:** repeated writes are safe, unauthorized writes are rejected, and every accepted mutation is auditable.

## Phase 12: Implement the Notification Worker

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

## Phase 13: Connect Real Providers

1. Connect the summary and recommendation clients to the selected service endpoints.
2. Connect the email adapter to the selected email provider.
3. Keep provider-specific data inside adapters.
4. Add contract tests for success, invalid responses, authentication failure, rate limiting, timeouts, and retryable errors.
5. Confirm secrets and generated student content are excluded from logs and fixtures.

**Done when:** provider implementations can be replaced without changing controllers, application workflows, or domain entities.

## Phase 14: Harden and Prepare for Deployment

1. Add request IDs, structured logging, sensitive-data redaction, security headers, body limits, and rate limiting.
2. Add MySQL readiness checks and worker operational health reporting.
3. Implement graceful shutdown for HTTP, database, and worker resources.
4. Document migrations, deployment, rollback, backup, and restore procedures.
5. Run frontend compatibility checks against the backend.
6. Run the complete acceptance command set.

**Done when:** the system fails safely and observably during database outages,
generator failures, email failures, malformed provider responses, and worker crashes.

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
- Generate summaries during Track Progress, Request Summary, and Notify Parent.
- Generate recommendations only after an explicit parent request.
- Send one scheduled email per student with one attached summary.
- Use Singapore time for weekly, fortnightly, and monthly schedules.
