# DAS 7 Backend Progress

## Current Status

**Phase 4 — Implement MySQL repositories: done**

**Phase 5 — Implement external generator boundaries: done**

**Phase 6 — Implement Track Progress and Summary: in progress**

**Next:** Complete the Phase 6 database-backed end-to-end verification

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
- Added generic generator adapter and client boundaries with dependency
  injection for replaceable external generator clients.
- Added summary and recommendation adapters that map domain objects to
  provider-neutral client request shapes and map client responses back to the
  generator ports.
- Added adapter unit tests for date and timestamp conversion, request mapping,
  metadata mapping, and client failure propagation.
- Added shared generator invocation metadata for correlation and idempotency
  identifiers, with generated defaults when callers do not provide a context.
- Added the generic HTTP generator client with configurable timeouts,
  abort-based cancellation, request metadata headers, runtime Zod response
  validation, and provider-neutral error classification.
- Added timeout, malformed-response, status-mapping, header, and configuration
  tests for the generator safeguards.
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
- Added `TrackProgressModel` and `RecommendationModel` application seams for
  the diagram workflows without mounting HTTP routes yet.
- Added explicit in-memory generator fakes and application tests for summary
  persistence, unavailable progress, stale-version regeneration, invalid
  output, recommendation basis selection, and provider failures.
- Rescheduled the final application fake-test pass to Phases 6 and 7, and the
  controlled HTTP/provider test pass to Phase 11 after provider wiring.
- Added the Track Progress and Summary application-to-HTTP flow for the
  frontend's `GET /api/students/:studentId/track-progress` and
  `GET /api/students/:studentId/summary` requests.
- Added route parameter validation, frontend-compatible response mapping for
  dates and summaries, and centralized error mapping for unavailable progress,
  unavailable summaries, generator failures, and invalid requests.
- Added production API composition that connects the Track Progress model to
  MySQL student, progress-record, and summary repositories plus the configured
  external summary generator. Test composition can still inject a model and
  does not open a database connection.
- Added graceful MySQL-pool shutdown to the API entrypoint and a not-configured
  response for non-production containers without infrastructure dependencies.
- Added concurrent-request coalescing keyed by student and progress version so
  overlapping frontend requests share one in-flight summary generation.
- Added HTTP Jest coverage for success envelopes, summary-only responses,
  request metadata propagation, invalid student IDs, and `progressUnavailable`.
- Expanded application Jest coverage for concurrent request coalescing.
- Reran the live MySQL integration suite against the dedicated
  `das7_integration_test` database; migration, schema, repository, and
  transaction checks passed.

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

Current unit/HTTP Jest result: 14 test suites passed and 68 tests passed.
The MySQL integration result is 1 suite passed and 5 tests passed against a
disposable MySQL 8 test database.
The integration suite was run against a disposable MySQL 8 instance with
explicit `MYSQL_TEST_*` settings; no local database files were retained.

The current integration command ran with the dedicated `MYSQL_TEST_*`
configuration and passed. The database-backed Track Progress HTTP end-to-end
scenario remains a separate Phase 6 verification item.

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
| 5 | Implement external generator boundaries | Done |
| 6 | Implement Track Progress and Summary | In progress |
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

## Phase 5 Step Tracking

| Step | Description | Status |
| --- | --- | --- |
| 1 | Define summary-generator request and response contract | Done |
| 2 | Define recommendation-generator request and response contract | Done |
| 3 | Implement diagram-facing generator adapters | Done |
| 4 | Add runtime validation, timeouts, and invocation metadata | Done |
| 5 | Finalize application fake tests with workflow phases | Moved to Phases 6 and 7 |
| 6 | Finalize controlled HTTP/provider tests after real provider wiring | Moved to Phase 11 |

## Phase 6 Step Tracking

| Step | Description | Status |
| --- | --- | --- |
| 1 | Add Track Progress and Summary controllers and routes | Done |
| 2 | Map validated domain results to frontend response envelopes | Done |
| 3 | Map domain and provider failures to public HTTP errors | Done |
| 4 | Compose MySQL repositories and the summary generator for production | Done |
| 5 | Coalesce concurrent requests for one student progress version | Done |
| 6 | Verify the flow with application and HTTP Jest tests | Done |
| 7 | Run database-backed end-to-end verification | Pending |
