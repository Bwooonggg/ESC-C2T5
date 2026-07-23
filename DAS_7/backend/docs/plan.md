# DAS 7 Backend Implementation Plan

**Status:** Paused until [`revision-plan.md`](revision-plan.md) is complete

**Architecture:** [`backend-architecture.md`](backend-architecture.md)

**Testing stack:** Jest, `ts-jest`, and Supertest

## 1. How to Use This Plan

The original implementation completed Phases 0 through 8 against MySQL. The
project architecture has since changed to Supabase and platform-owned identity.

Do not continue with the next feature phase yet.

Execute [`revision-plan.md`](revision-plan.md) from beginning to end first. That
revision will:

- Replace MySQL with Supabase.
- Remove DAS 7-owned credential and session concepts.
- Integrate Supabase JWT verification without implementing Auth flows.
- Align internal routes with the `/api/insights` gateway prefix.
- Replace the two generator-service clients with a provider-neutral LLM
  boundary.
- Revalidate the already implemented DAS 7 workflows.

Once every revision completion gate passes, resume this plan at Phase 9.

## 2. Previously Completed Feature Baseline

These phases describe implemented behavior that the revision must preserve.
Their MySQL-specific infrastructure is not part of the target system.

| Phase | Feature baseline | Status |
| --- | --- | --- |
| 0 | Backend scaffold, TypeScript, Express, and Jest | Completed |
| 1 | Typed configuration and API/worker composition | Completed; revision required |
| 2 | Domain entities, value objects, ports, and errors | Completed; identity revision required |
| 3 | Relational schema and migrations | Completed for MySQL; superseded |
| 4 | Repositories and transactions | Completed for MySQL; superseded |
| 5 | External generator boundaries | Completed; LLM revision required |
| 6 | Track Progress and Summary | Completed; Supabase revalidation required |
| 7 | Recommendations | Completed; Supabase revalidation required |
| 8 | Notification Preferences | Completed; Supabase revalidation required |

## Phase 9: Implement Versioned Data Ingestion

### Goal

Allow other trusted platform components to push normalized DAS 7 data without
creating a runtime dependency on their APIs or databases.

### APIs

Expose service-local versioned routes under `/v1`; Traefik publishes them under
`/api/insights/v1`.

Implement:

- Upsert a parent projection using a canonical platform parent ID and Supabase
  Auth user ID.
- Upsert a student projection using a canonical platform student ID.
- Assign or update a parent-student guardian relationship.
- Add one or more progress records.
- Correct an existing progress record without erasing its audit history.

The exact OpenAPI contract must be committed before controller implementation.

### Application behavior

1. Validate identifiers, dates, skill area, score precision, and required
   provenance.
2. Require a scoped idempotency key for every mutation.
3. Use an atomic Supabase RPC for each multi-table mutation.
4. Write the domain mutation, progress version, audit event, and idempotency
   outcome in one database transaction.
5. Return the stored outcome when a completed idempotency key is replayed.
6. Reject reuse of a key with a different request payload.
7. Do not generate a summary as part of ingestion.

### Authorization boundary

DAS 7 verifies the token and passes trusted claims to Supabase. Staff/system
claim assignment and the RLS policies that allow ingestion are owned by the
platform/authentication team.

### Tests

- Unit tests for validation and application decisions.
- HTTP tests for every route and error envelope.
- Supabase integration tests for atomic writes and rollback.
- Idempotency replay and conflicting-payload tests.
- Progress-version advancement tests.
- Append-only audit tests.
- Authorization contract tests using platform-provided identities.

**Done when:** valid writes are atomic and auditable, retries cannot duplicate
data, progress versions advance correctly, and the platform authorization
contract passes.

## Phase 10: Connect the Online LLM Provider

### Goal

Connect the existing summary and recommendation use cases to one selected
online LLM provider without leaking provider details into the application or
domain layers.

### Implementation

1. Select and pin the provider SDK or implement its HTTPS client.
2. Implement the provider-neutral `LlmClientPort`.
3. Keep summary and recommendation prompt construction in separate adapters.
4. Request structured output and validate every response with Zod.
5. Map provider authentication, rate limits, timeouts, malformed responses,
   refusals, and outages to existing generator errors.
6. Persist provider, model, prompt version, provider request ID, and generation
   time.
7. Send only data required for the generation operation.
8. Keep API keys, prompts, and generated student content out of logs.
9. Retain deterministic fake generators for ordinary tests.

### Tests

- Controlled provider success responses.
- Malformed and incomplete structured output.
- Authentication failure.
- Rate limiting.
- Timeout and abort behavior.
- Retryable and non-retryable errors.
- Summary and recommendation prompt-version metadata.
- Confirmation that sensitive values are redacted.

**Done when:** one configured provider supports both generation workflows and
can be replaced without modifying controllers, application use cases, or
domain entities.

## Phase 11: Implement the Notification Worker and Email Provider

### Goal

Complete the Notify Parent sequence diagram with durable scheduling, fresh
summary generation, replaceable email delivery, and safe recovery from
failures.

### Worker behavior

1. Calculate due work from parent notification preferences.
2. Create or reuse one job for each parent-student schedule occurrence.
3. Atomically claim jobs through the Supabase job-claim RPC.
4. Load the student's progress snapshot.
5. Generate a fresh summary through `SummaryGeneratorPort`.
6. Revalidate the progress version before persisting the summary.
7. Persist the summary, email-notification record, and job linkage atomically.
8. Send through `EmailProviderPort` outside the database transaction.
9. Record sent or failed state.
10. Retry only transient failures with capped backoff.
11. Recover expired leases without running two workers on the same active job.

A parent with multiple children receives one email per child. There is no
public notification-trigger endpoint.

### Scheduling rules

- Use Singapore time for weekly, fortnightly, and monthly preferences.
- Store instants in UTC.
- Keep the original schedule occurrence stable across retries.
- Make terminal delivery transitions idempotent.

### Tests

- Jest fake timers and fixed-clock unit tests.
- Weekly, fortnightly, and monthly due calculations.
- Disabled preferences.
- Multiple children.
- Fresh summary generation.
- Stale progress-version regeneration.
- Provider success and permanent/transient failure.
- Retry backoff.
- Crash recovery and expired leases.
- Concurrent worker claims.
- Duplicate-delivery prevention.

**Done when:** success and failure branches in the Notify Parent diagram pass
end-to-end tests and concurrent workers cannot actively claim the same job.

## Phase 12: Package and Harden DAS 7

### Goal

Produce deployable API and worker processes with safe operational behavior.

### Implementation

1. Create one production image with separate API and worker commands.
2. Listen on configurable `HOST` and `PORT`; use port `8000` in the platform.
3. Expose only the API through Traefik.
4. Add liveness and Supabase-aware readiness.
5. Add request IDs, structured logging, and sensitive-data redaction.
6. Add security headers, request body limits, and gateway-compatible rate
   limiting.
7. Add bounded timeouts for Supabase, LLM, and email operations.
8. Implement graceful API and worker shutdown.
9. Document environment configuration and secret ownership.
10. Document migration deployment, rollback, backup, and restore procedures.
11. Add CI commands for unit, HTTP, Supabase integration, contract, and
    end-to-end suites.

### Tests

- Container starts the API on port `8000`.
- Container starts the worker without exposing a public port.
- Traefik strips `/api/insights` and reaches service-local routes.
- Missing or malformed production configuration fails startup.
- Supabase, LLM, and email outages produce safe observable failures.
- Shutdown stops accepting work and releases resources.
- No CORS middleware or cross-origin allowlist is present.

**Done when:** the API and worker can be deployed independently from the same
image and fail safely during dependency outages and process termination.

## Phase 13: Cross-Team Integration and Final Acceptance

### Goal

Verify DAS 7 against platform-owned interfaces without implementing another
team's responsibilities.

### Platform integration

1. Validate the final Supabase access-token claim contract.
2. Run shared RLS contract tests using parent, staff/system, and worker
   identities.
3. Verify parents can access only students allowed by the platform policy.
4. Verify ingestion callers receive only their approved operations.
5. Verify the worker secret is restricted to the worker runtime.
6. Verify `/api/insights/*` gateway routing.
7. Verify the shared frontend consumes the documented DAS 7 API contract.
8. Record the compatible platform, frontend, and DAS 7 revisions.

If a test fails because a platform claim or RLS policy is missing, report it as
an external integration dependency. Do not add DAS 7 login, password, session,
or role-management code to work around it.

### Final acceptance

- Track Progress and Summary pass end to end.
- Recommendation generation passes end to end.
- Notification Preferences pass end to end.
- Ingestion is atomic, idempotent, and auditable.
- Scheduled notifications pass success, failure, retry, and recovery cases.
- No MySQL code, dependency, migration, or configuration remains.
- No DAS 7 authentication lifecycle or frontend implementation exists.
- No direct DAS 1/DAS 3 API or database dependency exists.
- Secrets and student content are absent from logs and committed fixtures.

**Done when:** all DAS 7 workflows pass through the platform gateway and
Supabase policy boundary using the production-shaped container setup.

## Public API Contract

Public browser and platform clients use:

- `GET /api/insights/health`
- `GET /api/insights/health/ready`
- `GET /api/insights/me`
- `GET /api/insights/students/:studentId/track-progress`
- `GET /api/insights/students/:studentId/summary`
- `POST /api/insights/students/:studentId/recommendations`
- `GET /api/insights/parents/:parentId/preferences`
- `PUT /api/insights/parents/:parentId/preferences`
- `/api/insights/v1/*` for versioned ingestion

Express registers the same routes without `/api/insights`.

Successful responses use:

```json
{
    "ok": true,
    "data": {}
}
```

Failed responses use:

```json
{
    "ok": false,
    "error": "Public error message"
}
```

## Jest Test Organization

- `test/unit/`: domain and application behavior using injected fakes.
- `test/http/`: service-local Express routes, middleware, validation, and
  envelopes.
- `test/integration/supabase/`: migrations, repositories, RPCs, and RLS
  contracts against local Supabase.
- `test/integration/providers/`: LLM and email boundaries.
- `test/contract/`: HTTP, ingestion, token-claim, and provider contracts.
- `test/e2e/`: complete API and worker workflows.
- `test/fixtures/`: fictional and sanitized reusable test data.

Use `.test.ts` filenames. Prefer explicit fakes for business logic, Jest mocks
for narrow technical boundaries, and Jest fake timers for clock-controlled
behavior. Do not introduce Vitest.

## Acceptance Commands

The revision plan will define the final scripts. The completed project must
provide an equivalent command set runnable from `backend/`:

```powershell
npm run typecheck
npm run build
npm test
npm run test:http
npm run test:integration
npm run test:contract
npm run test:e2e
```

Database integration and end-to-end commands require the disposable local
Supabase stack. Ordinary unit and HTTP tests remain database-free.

## Fixed Boundaries

- Supabase Auth is platform-owned.
- DAS 7 verifies incoming Supabase access tokens but does not issue or manage
  them.
- Authorization claim creation and RLS policy design are external
  responsibilities.
- The frontend is external to DAS 7.
- DAS 7 receives data through its ingestion APIs and does not query another
  subsystem.
- The Supabase Data API is the only DAS 7 application runtime database access
  path; the Supabase CLI remains responsible for migrations.
- The notification worker is the only DAS 7 runtime that receives a Supabase
  secret key.
- Summary and recommendation generation share a provider-neutral LLM client.
- Email delivery remains provider-neutral.
- API and worker run as separate processes.
- Public traffic is same-origin through `/api/insights`; no CORS configuration
  is required.
