# DAS 7 Backend Progress

## Current Status

**Phase 4 — Implement MySQL repositories: done**

**Phase 5 — Implement external generator boundaries: in progress**

**Next:** Phase 5, step 3 — Implement generator adapters

## Completed Work

- Installed the backend dependencies, including Jest, `ts-jest`, Supertest, and their TypeScript types.
- Added the Jest configuration and test-specific TypeScript configuration.
- Added HTTP smoke tests for `GET /api/health` and `GET /api/health/ready`.
- Updated the backend README and architecture documentation for Jest.
- Recorded the full implementation sequence in [`plan.md`](plan.md).
- Added `.ts-jest/` to the backend ignore list.
- Confirmed four-space indentation in the updated scaffold files.
- Added `.env` loading and typed validation for API, MySQL, generator, email, and worker settings.
- Added separate API and worker composition containers.
- Added tests for development defaults, valid production settings, missing production settings, malformed values, and container composition.
- Verified the built API starts with validated configuration and returns HTTP 200 from `GET /api/health`.
- Verified the worker starts with the worker disabled by default.
- Implemented the Phase 2 domain entities with basic state and relationship invariants.
- Added unit tests for entity construction, relationships, invalid scores, and email delivery state.
- Recorded the same-origin deployment decision for the frontend and `/api`.
- Removed cross-origin middleware, configuration, and package dependencies from the real and mock APIs so the runtime matches that same-origin decision.
- Implemented immutable value objects for account types, skill areas, email addresses, and notification frequencies.
- Added repository ports for identity, parents, students, progress records, summaries, recommendations, preferences, email notifications, notification jobs, sessions, audit events, and idempotency records.
- Added provider-neutral ports for summary generation, recommendation generation, email delivery, and the system clock; authentication service ports remain deferred.
- Deferred authentication configuration and route exposure so login, signup, password security, authentication, and authorization can be integrated in the final phase with the groupmate's implementation.
- Added domain error types for validation, unavailable progress, and unavailable summaries.
- Expanded domain tests for invalid fields, value-object requirements, boundary scores, immutable relationship data, and delivery-state invariants.
- Added the Phase 3 relational schema migrations for users, parents, students,
  guardian relationships, progress records, summaries, recommendations,
  notification preferences, email notifications, notification jobs, audit
  events, and idempotency records.
- Added database constraints for required values, account and value-object
  allow-lists, score bounds, summary ownership, guardian job ownership, and
  notification delivery state.
- Aligned the guardian relationship with the class diagram's many-to-many
  `1..*` logical minimum and changed destructive foreign-key cascades to
  preserve parent, student, job, and audit history.
- Added transactional progress-version state on students, allowed repeated
  summary snapshots for an unchanged version, and linked notification jobs to
  their generated summary and email output.
- Documented snapshot/version revalidation so concurrent progress writes cannot
  leave a generated summary claiming the wrong source version.
- Added notification failure and retry timestamps, stable schedule semantics,
  scoped idempotency keys, and idempotency lifecycle constraints.
- Restricted progress scores to at most two decimal places in the domain and
  schema, with Jest coverage for the precision rule.
- Added database checks for non-empty identifiers and normalized email values
  where the domain already requires them.
- Documented the table mapping and relationship decisions in
  [`database-schema.md`](database-schema.md).
- Added `0011_add_query_indexes.sql` for guardian reverse lookups, ordered
  progress and summary reads, recommendation history, notification queues,
  audit investigations, and idempotency cleanup.
- Added the portable MySQL pool and migration runner with environment-driven
  connection settings, entrypoint-relative migration discovery, checksums,
  duplicate-run protection, and a database-scoped advisory lock.
- Added `npm run migrate` and `npm run migrate:compiled` commands plus Jest
  coverage for migration ordering, line-ending normalization, replay, checksum
  drift, and missing migration detection.
- Added a separate Jest integration configuration and explicit
  `MYSQL_TEST_*` environment boundary so the default test command remains
  database-free.
- Added live MySQL integration coverage for migration application and replay,
  migration metadata, InnoDB tables, query indexes, foreign keys, allow-lists,
  and score bounds.
- Added the MySQL row-mapping boundary for users, parents, students, progress
  records, summaries, recommendations, notification preferences, email
  notifications, notification jobs, and audit events.
- Added mapper validation for MySQL date, decimal, boolean, JSON, and
  allow-list representations before values reach application workflows.
- Added parameterized MySQL repositories for users, parents, students, progress
  records, summaries, recommendations, notification preferences, email
  notifications, notification jobs, and audit events.
- Added repository unit coverage for parameter binding, ordered reads,
  multi-row writes, and notification state updates.
- Verified repository persistence and `FOR UPDATE SKIP LOCKED` notification-job
  claiming against a fresh migrated MySQL 8 database.
- Added `withMySqlTransaction`, which checks out one connection, commits
  successful related operations, rolls back failures, and always releases the
  connection.
- Updated notification-job claiming to use the shared transaction boundary.
- Added Jest coverage for transaction commit, rollback, error preservation, and
  connection lifecycle ordering.
- Added the ingestion idempotency port, MySQL repository, and row mapper for
  processing, completed, and failed request states.
- Added repository coverage for idempotency response persistence, duplicate-key
  protection, and terminal-state preservation.
- Added real MySQL coverage for repository lookups, idempotency behavior, and
  rollback of related writes across two repositories.
- Finalized the provider-neutral SummaryGeneratorService contract, including
  snapshot/version semantics, ordered progress input, response validation, and
  provider-error boundaries.
- Added [`summary-generator.contract.md`](../contracts/summary-generator.contract.md)
  for the logical external-service request and response shape.
- Finalized the provider-neutral RecommendationGeneratorService contract,
  including its persisted-summary basis, response shape, and provider-error
  boundary.
- Added [`recommendation-generator.contract.md`](../contracts/recommendation-generator.contract.md)
  for the logical external-service request and response shape.

## Verification Evidence

The following checks passed from `backend/`:

```powershell
npm run typecheck
npm run build
npm test
npx tsc --noEmit -p tsconfig.test.json
npm run test:http
npm run test:coverage
npm run test:integration
```

Current unit/HTTP Jest result: 10 test suites passed and 49 tests passed.
The MySQL integration result is 1 suite passed and 5 tests passed against a
disposable MySQL 8 test database.
The integration suite was run against a disposable MySQL 8 instance with
explicit `MYSQL_TEST_*` settings; no local database files were retained.

The migration runner and index migration were applied successfully to a blank
isolated MySQL 8 database, and a second run was verified as a no-op.

## Phase Tracking

| Phase | Description | Status |
| --- | --- | --- |
| 0 | Verify the scaffold | Done |
| 1 | Establish configuration | Done |
| 2 | Build the domain and interfaces | Done |
| 3 | Create the MySQL schema | Done |
| 4 | Implement MySQL repositories | Done |
| 5 | Implement external generator boundaries | In progress — Step 3 next |
| 6 | Implement Track Progress and Summary | Pending |
| 7 | Implement recommendations | Pending |
| 8 | Implement notification preferences | Pending |
| 9 | Implement data ingestion | Pending |
| 10 | Implement the notification worker | Pending |
| 11 | Connect real providers | Pending |
| 12 | Harden and prepare for deployment | Pending |
| 13 | Implement authentication and authorization | Deferred to final phase |

## Progress Rules

- Update this file when a phase is complete.
- Record the verification commands for each completed phase.
- Keep only one phase marked `Next`.
- Update [`plan.md`](plan.md) when the approved implementation sequence changes.

## Phase 2 Step Tracking

| Step | Description | Status |
| --- | --- | --- |
| 1 | Implement domain entities | Done |
| 2 | Add value objects | Done |
| 3 | Define repository interfaces | Done |
| 4 | Define external and technical ports | Done |
| 5 | Add domain errors | Done |
| 6 | Test remaining entity invariants and failure cases | Done |

## Phase 3 Step Tracking

| Step | Description | Status |
| --- | --- | --- |
| 1 | Map domain entities and supporting records to tables | Done |
| 2 | Define relationships and foreign keys | Done |
| 3 | Add database-level validity constraints | Done |
| 4 | Add query-driven secondary indexes | Done |
| 5 | Configure the migration runner and database command | Done |
| 6 | Apply migrations to an isolated MySQL database and add integration coverage | Done |

## Phase 4 Step Tracking

| Step | Description | Status |
| --- | --- | --- |
| 1 | Configure the MySQL pool | Done |
| 2 | Implement SQL row mappers | Done |
| 3 | Implement repositories with parameterized statements | Done |
| 4 | Add transaction support | Done |
| 5 | Test repository behavior and rollback | Done |
| 6 | Run the MySQL integration suites serially | Done |
