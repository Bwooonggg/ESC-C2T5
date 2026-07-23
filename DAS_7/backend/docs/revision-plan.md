# DAS 7 Supabase Architecture Revision Plan

**Status:** R1, R2, and R3 complete; R4 next

**Start here:** Complete R1 through R10 before returning to
[`plan.md`](plan.md)

**Target architecture:** [`backend-architecture.md`](backend-architecture.md)

## 1. Revision Goal

Convert the existing DAS 7 backend from its MySQL and locally modeled
authentication assumptions to the approved platform architecture without
discarding the completed DAS 7 workflows.

At the end of this revision:

- Supabase Data API is the only application runtime database access path; the
  Supabase CLI remains responsible for migrations.
- Implementation uses a Supabase-hosted development project. No local Supabase
  database or local Supabase storage is used.
- The production Supabase project is linked only after implementation and the
  dedicated testing phase are complete.
- DAS 7 data lives in a custom PostgreSQL `insight` schema.
- The API uses the caller's verified Supabase access token for database calls.
- The worker uses a server-only Supabase secret key.
- DAS 7 contains no login, signup, password, verification, session, or
  token-issuing implementation.
- Parent and student identities are platform-owned projections.
- Existing Track Progress, Summary, Recommendation, and Notification
  Preferences behavior works on Supabase.
- Express registers service-local routes for the Traefik
  `/api/insights` prefix.
- Summary and recommendation adapters share a provider-neutral LLM client
  boundary.
- MySQL code, dependencies, migrations, settings, and tests are removed.
- New and rewritten permanent test files are deferred to the dedicated testing
  phase in [`plan.md`](plan.md).
- The remaining feature plan can resume at Phase 9.

## 2. Execution Rules

1. Complete phases in order.
2. Keep the project typechecking and building after each implementation phase.
   Run existing tests where they remain applicable.
3. Do not add or substantially rewrite permanent test files during R2 through
   R10. Record required cases in the dedicated testing backlog.
4. Do not delete a MySQL component until its Supabase replacement has passed
   the phase's hosted-development smoke checks and its parity cases are
   recorded for the dedicated testing phase.
5. Do not attempt to migrate existing MySQL data.
6. Do not implement platform-owned Auth flows or authorization policy logic.
7. Do not add frontend code.
8. Do not call or query another DAS subsystem.
9. Use four spaces for indentation.
10. Pin Supabase package versions exactly and commit the lockfile.
11. Use the Supabase CLI through the project package runner; do not depend on a
    globally installed CLI.
12. Use CLI `--help` before relying on a Supabase command or option.
13. Link only the hosted development project during implementation. If the
    linked project contains migrations owned by another project or subsystem,
    stop and obtain an explicit repurposing decision before reconciling history
    or pushing. Do not use production project credentials or references.
14. Preview every remote migration push before applying it. Keep remote checks
    read-only or dry-run until the dedicated project is confirmed.
15. Do not use `supabase start`, local database reset commands, or destructive
    linked-project resets as part of the normal workflow.
16. Keep private environment files and Supabase CLI temporary/link state
    ignored.
17. Update [`progress.md`](progress.md) after each completed revision phase.

## 3. Compatibility Strategy

The revision preserves behavior rather than MySQL implementation details.

Preserve:

- Public response envelopes and existing response data shapes.
- Track Progress and Summary semantics.
- Summary progress-version consistency.
- Recommendation basis-summary relationship.
- Notification Preferences behavior and email normalization.
- Domain validation and error mapping.
- Dependency-injection seams.
- Existing tests as the historical behavioral baseline.

Change:

- Database implementation and schema dialect.
- Identity ownership.
- Internal route prefixes.
- Generator infrastructure configuration.
- Transaction implementation.
- Development and testing environment.

No production dual-read or dual-write mode is required. Supabase becomes the
only runtime database after parity is demonstrated.

## Phase R1: Capture the Baseline and Establish Safety Gates

### Purpose

Create a trustworthy starting point so the revision can distinguish an
existing failure from a migration regression.

### Work

1. Inspect the working tree and preserve unrelated user changes.
2. Record the current Node.js and npm versions.
3. Record the current package dependency tree.
4. Run the complete currently available baseline:

   ```powershell
   npm run typecheck
   npm run build
   npm test
   npm run test:http
   npm run test:integration
   ```

5. If MySQL integration settings are not available, record that as an
   environment limitation and preserve the last known passing result instead
   of modifying tests to hide it.
6. Identify all MySQL-coupled files and imports.
7. Identify all credential, user, session, account-type, login, and
   authorization placeholders.
8. Identify all code and tests that assume Express is mounted at `/api`.
9. Identify all generator configuration and client code that assumes two
   independent service URLs.
10. Create a revision checklist in `progress.md` containing the actual baseline
    results.

### Verification

- The baseline result is recorded.
- A repository search lists every MySQL, local-authentication, `/api` mount, and
  generator-service coupling that must be addressed.
- No implementation behavior has been intentionally changed.

**Done when:** the revision has a reproducible baseline and a complete impact
inventory.

## Phase R2: Add the Hosted Supabase Development Foundation

### Purpose

Connect the backend to a dedicated Supabase-hosted development project using
version-controlled migrations and a project-pinned CLI. Do not start or store a
Supabase database locally.

### Dependencies

Add exact-pinned versions of:

- `@supabase/supabase-js` as a production dependency.
- `supabase` as a development dependency.

Commit the updated package lock. Review any package install scripts through the
existing package-manager approval process.

### Supabase CLI setup

1. Check CLI availability and syntax with:

   ```powershell
   npx supabase --version
   npx supabase --help
   ```

2. Initialize the CLI project configuration with the documented command.
3. Authenticate the CLI and link it to the hosted development project supplied
   by the user.
4. Commit:

   - `supabase/config.toml`
   - `supabase/migrations/`

5. Use imperative migrations. Create new migration files with
   `npx supabase migration new <name>` rather than inventing timestamps.
6. Do not create or commit `supabase/seed.sql` during implementation.
7. Do not commit Supabase `.temp`, `.branches`, project-link state, access
   tokens, database passwords, project references, or environment secrets.
8. Confirm all remote-management command syntax through the installed CLI
   `--help` output.

### Environment boundary

Replace target database settings with:

API:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SCHEMA=insight`

Worker:

- `SUPABASE_URL`
- `SUPABASE_SECRET_KEY`
- `SUPABASE_SCHEMA=insight`

Keep `SUPABASE_SECRET_KEY` out of API composition and API-only examples.

At this phase, MySQL variables may remain temporarily because the application
still uses MySQL. Mark them deprecated and remove them in R9.

The application environment values point to the hosted development project.
Production values remain absent until the final production handoff.

### Scripts

Add package scripts for the project-pinned CLI, including equivalent commands
for:

- Previewing pending migrations for the linked development project.
- Applying migrations to the linked development project.
- Checking linked migration status.
- Generating TypeScript database types from the linked project.

Confirm the exact script arguments against the installed CLI help.

Do not add scripts for `supabase start`, `supabase stop`, local resets, or
linked-project resets.

### Verification

- A clean clone can install dependencies without a global Supabase CLI.
- `npx supabase --version` works.
- The CLI is linked to the hosted development project explicitly designated
  for DAS7, and any legacy migration history has an approved reconciliation.
- The committed Supabase directory contains no secrets, test data, or project
  link state.
- `.env.example` separates publishable API configuration from worker-only
  secret configuration.
- A non-destructive linked-project command can inspect migration status.
- Hosted smoke data uses unique run identifiers and is selectively cleaned up;
  no remote reset or broad delete is used.
- Typecheck and build still pass; existing tests may be run unchanged where
  applicable.

For the selected hosted development project, the eight legacy migration
records from the previous project were marked `reverted` in the migration
history table only. The existing empty legacy tables were not dropped or
modified. Linked migration status is now empty and the linked push dry run is
clean.

**Done when:** the backend can safely target the hosted development project
through validated environment settings and a project-pinned CLI, its migration
history is aligned with the approved DAS7 workflow, and there is no local
Supabase runtime or production-project linkage.

## Phase R3: Create the PostgreSQL `insight` Schema

### Purpose

Replace the MySQL schema design with PostgreSQL migrations that match the new
identity boundary and Data API access model.

### Migration sequence

Create imperative migrations in this logical order:

1. Create the `insight` schema and required extensions.
2. Create parent and student projection tables.
3. Create guardian relationships.
4. Create progress records and progress-version state.
5. Create summaries and recommendations.
6. Create notification preferences and email notifications.
7. Create durable notification jobs.
8. Create idempotency and audit records.
9. Create query-driven indexes.
10. Create atomic RPC functions.
11. Enable RLS and apply explicit Data API grants.

Create each actual timestamped filename with the installed CLI.

### Target tables

Create:

- `insight.parent_profiles`
- `insight.student_profiles`
- `insight.parent_students`
- `insight.progress_records`
- `insight.summaries`
- `insight.recommendations`
- `insight.notification_preferences`
- `insight.email_notifications`
- `insight.notification_jobs`
- `insight.idempotency_records`
- `insight.audit_events`

Do not create:

- A DAS 7 `users` table.
- Password or verification fields.
- Session or refresh-token tables.
- Local role-assignment tables.

### Identity fields

- Store canonical parent and student IDs as UUID-compatible identifiers.
- Store the Supabase Auth user ID on the parent projection.
- Do not duplicate Auth passwords or account verification state.
- Keep notification recipient email in the DAS 7 notification preference.
- Store audit actor subjects as platform identity values rather than a foreign
  key to a local users table.

### Progress and generation fields

- Preserve the current progress-version mechanism.
- Preserve repeated summary snapshots for the same progress version.
- Store source subsystem/client and source-record provenance on ingested
  progress.
- Keep recommendation-to-summary and recommendation-to-student relationships.
- Store provider, model, prompt version, provider request ID, and generation
  timestamp where applicable.

### Database constraints

Translate current domain constraints to PostgreSQL:

- Non-empty IDs and required text.
- Date and timestamp semantics.
- Score range and two-decimal precision.
- Skill-area and notification-frequency allow-lists.
- Normalized recipient email.
- Valid notification/job state combinations.
- Guardian and summary ownership consistency.
- Scoped idempotency uniqueness.
- Append-only audit semantics.

### Indexes

Add only query-driven indexes for:

- Guardian lookups in both directions.
- Ordered student progress.
- Latest student summary.
- Recommendation history and basis lookup.
- Due and leased notification jobs.
- Notification delivery history.
- Audit investigation.
- Idempotency lookup and cleanup.
- Source-system/source-record deduplication.

### Atomic RPC functions

Design narrowly scoped `SECURITY INVOKER` functions for:

- Progress insertion with version advancement, audit, and idempotency.
- Progress correction with version advancement, audit, and idempotency.
- Atomic notification-job claim with lease assignment.
- Any linked job/summary/notification state transition that cannot be safely
  represented as independent Data API calls.

Explicitly revoke default public function execution and grant only the required
roles.

### Data API and RLS

1. Add `insight` to the project's exposed schemas.
2. Add explicit schema, table, sequence, and function grants.
3. Enable RLS on every exposed table.
4. Do not add permissive policies as placeholders.
5. Record the required parent, ingestion-client, and worker operations in the
   platform Auth/RLS contract.
6. Leave protected user operations denied until the external policies are
   supplied.

### Development data and types

- Do not create or commit seed data or permanent test fixtures during the
  implementation phases.
- Create only the minimum temporary development records needed for manual
  smoke checks in the hosted development project.
- Never copy production or real student data into the development project.
- Generate TypeScript database types from the linked development schema.
- Keep generated types in the Supabase infrastructure boundary.

### Verification

Use the exact installed CLI equivalents of the following linked-project
operations, confirming flags with `--help`:

```powershell
npx supabase db push --linked --dry-run
npx supabase db push --linked
npx supabase migration list
npx supabase gen types --lang typescript --linked
```

Also verify:

- All expected tables, constraints, indexes, and functions exist.
- The linked migration history contains every committed migration.
- Tables are not accessible without the intended grants.
- RLS is enabled on every exposed table.
- Database advisors report no unresolved revision-owned issues.
- No local Supabase service or database container is running.
- No linked-project reset is used.

**Done when:** the complete committed migration chain has been previewed and
applied to the hosted development project, its schema and grants are verified,
and generated types match that linked schema.

### R3 implementation checkpoint

R3 is complete. The four CLI-created migrations are applied and aligned with
the linked hosted development project. The `insight` schema, constraints,
indexes, worker RPCs, RLS enablement, explicit grants, and generated TypeScript
types have been verified. RLS policies remain intentionally deferred until the
platform/Auth team supplies the claims and ownership contract in R6. No local
Supabase service, seed data, reset, or production project linkage was used.

## Phase R4: Refactor Identity Ownership and Domain Boundaries

### Purpose

Remove authentication ownership from DAS 7 while preserving the domain
relationships required by the supplied diagrams.

### Domain changes

1. Remove credential and verification state from the DAS 7 domain.
2. Make `Parent` an independent DAS 7 entity/projection rather than a subclass
   of a credential-owning `User`.
3. Remove `AccountType` where it exists only to represent platform roles.
4. Retain parent ID, Auth user ID, contact/display projection fields required
   by DAS 7, and guardian relationships.
5. Retain student, progress, summary, recommendation, preference, and email
   notification invariants.
6. Change audit actor references to a platform subject value.

### Port changes

Remove or supersede DAS 7-owned ports for:

- User credential persistence.
- Session persistence.
- Password hashing.
- Token issuance and session management.

Add narrow platform-integration types:

- Verified access-token claims.
- Immutable request principal.
- Access-token verifier interface if required for dependency injection.

Do not define login, signup, password, or role-management use cases.

### Deferred testing backlog

Record these cases for the dedicated testing phase:

- Parent construction and relationship invariants.
- Removal of credential behavior owned by another subsystem.
- Valid and invalid platform identity projection values.
- Immutable request-principal mapping independently of Express.
- Existing domain invariants affected by the identity refactor.

### Verification

- Domain and application layers have no dependency on Supabase Auth types.
- No domain entity contains a password hash, verification flag, refresh token,
  or locally assigned platform role.
- Typecheck and build pass.
- Existing unchanged tests may be run where they remain applicable.
- Every deferred identity case is recorded without adding new permanent test
  files.

**Done when:** identity is represented only as the projection and trusted
principal DAS 7 needs.

## Phase R5: Implement the Supabase Infrastructure Boundary

### Purpose

Implement Supabase-backed persistence without allowing Data API details to
escape into application use cases.

### Client factories

Implement separate factories for:

1. A request-scoped user client:
   - Uses the publishable key.
   - Receives the verified incoming token through the supported `accessToken`
     option.
   - Disables unnecessary client-side session persistence.
   - Selects the `insight` schema.

2. A worker system client:
   - Uses the server-only secret key.
   - Is constructed only in worker composition.
   - Is never exported through the API container.

The development API and worker use the same factories with hosted development
credentials. A dedicated integration-test client is not added until the
testing phase, and no client may fall back to production credentials.

### Mapping boundary

Implement:

- Runtime row schemas.
- Row-to-domain mappers.
- Domain-to-insert/update mappers.
- PostgreSQL timestamp, date, numeric, nullable, and JSON conversions.
- Mapping from generated database types to stable application/domain types.

Invalid database rows must fail at the infrastructure boundary.

### Repositories

Implement Supabase versions of the repository ports needed by completed
workflows:

- Parent projections and guardian lookup.
- Students.
- Progress records.
- Summaries.
- Recommendations.
- Notification preferences.
- Email notifications.
- Notification jobs.
- Audit events.
- Idempotency records.

Keep deterministic ordering explicit in every list/latest query.

### Transactions

- Do not recreate the MySQL transaction-manager abstraction using a series of
  unrelated Data API calls.
- Route atomic multi-table behavior through the R3 RPC functions.
- Keep LLM and email network calls outside database transactions.

### Readiness

Replace the MySQL readiness check with a bounded Supabase check that confirms
the required service/schema is reachable without exposing protected data.

### Deferred testing backlog

Record these cases for the dedicated testing phase:

- Mapper validation and error handling.
- Repository CRUD and deterministic ordering.
- Latest-summary selection and guardian lookup.
- Notification preference upsert.
- Idempotency lifecycle.
- RPC commit and rollback.
- Concurrent job claiming.
- Request-client and worker-client separation.

### Verification

- Application code imports only repository ports.
- The API dependency graph cannot resolve a secret-key client.
- Typecheck and build pass.
- Narrow smoke operations against the hosted development project confirm the
  required repository and RPC paths without resetting the project.
- Existing repository behavior has a Supabase equivalent.
- Deferred cases are recorded without adding new permanent test files.

**Done when:** all persistence capabilities needed by the already implemented
workflows are available through Supabase adapters.

## Phase R6: Integrate JWT Verification and Gateway-Aligned Routing

### Purpose

Integrate DAS 7 into the platform request boundary without implementing the
platform's authentication lifecycle or authorization policies.

### JWT verification

1. Read the bearer token from the `Authorization` header.
2. Reject missing, malformed, invalid, or expired tokens on protected routes.
3. Verify Supabase-issued access tokens with `supabase.auth.getClaims()`.
4. Validate the required claim shape.
5. Create the immutable request principal.
6. Pass the verified token to the request-scoped Supabase client.
7. Never trust `user_metadata` for authorization.
8. Never log the token.

Do not add:

- Login or signup routes.
- Password handling.
- Refresh-token handling.
- Logout or token revocation.
- DAS 7 role assignment.
- DAS 7 authorization policies that duplicate platform RLS.

### Routing revision

1. Stop mounting the Express API under `/api`.
2. Register service-local routes:

   - `/health`
   - `/health/ready`
   - `/me`
   - `/students/*`
   - `/parents/*`
   - `/v1/*`

3. Document `/api/insights` as the external Traefik prefix.
4. Keep health and readiness public.
5. Protect functional routes with token verification.
6. Keep CORS absent.

### Deferred testing backlog

Record these cases for the dedicated testing phase:

- Public health routes.
- Missing, malformed, invalid, and expired bearer tokens.
- Valid principal mapping.
- Trusted versus user-editable claim handling.
- Token propagation to the request-scoped Supabase client.
- Service-local routes and the public gateway path contract.
- Confirmation that no login/auth router is mounted.

During implementation, perform only the minimum hosted-development smoke calls
needed to confirm valid and invalid token paths.

### External gate

Record but do not silently implement missing platform deliverables:

- Final custom claim names.
- Parent-to-Auth-user mapping.
- Staff/system ingestion claims.
- RLS policy predicates.

**Done when:** DAS 7 verifies platform tokens, creates a trusted principal, and
serves service-local routes compatible with `/api/insights` prefix stripping.

## Phase R7: Restore Completed Workflows on Supabase

### Purpose

Prove that changing infrastructure and identity ownership did not regress the
completed DAS 7 functionality.

### Track Progress and Summary

1. Compose Supabase student, progress, and summary repositories.
2. Load ordered progress and the version marker consistently.
3. Preserve `progressUnavailable`.
4. Preserve summary generation and runtime validation.
5. Preserve stale-version detection and regeneration.
6. Preserve concurrent request coalescing.
7. Persist summary generation metadata.
8. Preserve the existing response data shape.

### Recommendations

1. Load the latest persisted summary through Supabase.
2. Preserve `summaryUnavailable`.
3. Generate from exactly that basis summary.
4. Persist both summary and student relationships.
5. Preserve the existing response data shape and provider error mapping.

### Notification Preferences

1. Read and upsert through Supabase.
2. Preserve email trimming and lowercase normalization.
3. Preserve enabled and frequency validation.
4. Preserve `preferencesUnavailable` if the contract still distinguishes a
   missing preference.
5. Use the verified principal/RLS boundary rather than a local authentication
   module.

### Deferred testing backlog

For each workflow, record:

- Unit/application fake cases.
- Service-local HTTP cases.
- Hosted Supabase repository cases.
- Database-backed end-to-end success.
- Existing public failure branches.
- Response-contract compatibility.
- External-policy contract cases supplied by the platform Auth team.

Do not create or rewrite the permanent test files yet. Use controlled
development records and direct smoke calls to confirm that the composed
workflows can execute against the hosted development project.

### Verification

- Track Progress, Summary, Recommendation, and Notification Preferences can be
  exercised successfully against the hosted development project.
- Public response shapes remain unchanged.
- No production workflow composition uses a MySQL repository.
- Protected workflows use a request-scoped client.
- The full parity scenarios are recorded for the dedicated testing phase.

**Done when:** Phases 6 through 8 of the original feature baseline have
behavioral parity on Supabase.

## Phase R8: Refactor to the Shared LLM Boundary

### Purpose

Prepare the generation infrastructure for one online LLM provider while
keeping summary and recommendation application contracts independent.

### Port design

Retain:

- `SummaryGeneratorPort`
- `RecommendationGeneratorPort`

Add or refine:

- `LlmClientPort`
- Provider-neutral structured completion request/response types
- Provider-neutral error categories

`SummaryGeneratorPort` and `RecommendationGeneratorPort` are peers. Their
adapters share `LlmClientPort`; neither builds on the other.

### Adapter changes

1. Move summary prompt construction into the summary adapter.
2. Move recommendation prompt construction into the recommendation adapter.
3. Give each output its own Zod schema.
4. Centralize LLM transport, credentials, timeout, and provider error mapping.
5. Preserve correlation and idempotency metadata.
6. Add provider/model/prompt-version metadata to generated results.
7. Remove assumptions that summary and recommendation are separate remote
   services.

### Configuration

Replace:

- `SUMMARY_GENERATOR_URL`
- `RECOMMENDATION_GENERATOR_URL`

With:

- `LLM_PROVIDER`
- `LLM_API_BASE_URL`
- `LLM_API_KEY`
- `LLM_MODEL`
- `LLM_TIMEOUT_MS`

The real provider implementation remains Phase 10 in [`plan.md`](plan.md).
During the revision, use a controlled or fake LLM client to prove the
architecture.

### Deferred testing backlog

Record these cases for the dedicated testing phase:

- Summary and recommendation prompt/input mapping.
- Independent structured-output validation.
- Timeout and cancellation.
- Provider-neutral error mapping.
- Correlation metadata.
- Sensitive-data redaction.
- Existing Track Progress and Recommendation fake behavior.

Use only temporary or manual controlled inputs during implementation; do not
add new permanent adapter test files.

**Done when:** both generator adapters operate through one provider-neutral LLM
client seam without selecting the production provider.

## Phase R9: Remove Superseded MySQL and Authentication Infrastructure

### Purpose

Remove the old implementation only after Supabase and workflow parity are
proven.

### Remove MySQL

Remove:

- `mysql2`.
- MySQL configuration and environment variables.
- MySQL pool and connection types.
- MySQL migration runner and entrypoint.
- MySQL transaction manager.
- MySQL row mappers and repositories.
- MySQL SQL migration and seed directories.
- `MYSQL_*` and `MYSQL_TEST_*` examples.
- MySQL-only package scripts.
- MySQL integration Jest configuration and fixtures.

Replace references in README and database documentation with the Supabase
workflow.

### Remove obsolete authentication ownership

Remove DAS 7-owned or deferred artifacts for:

- User credentials.
- Password hashing.
- Verification codes/state.
- Local sessions.
- Token issuance.
- Login, signup, logout, and verification routes/use cases.
- Local account types used as platform roles.
- The old final authentication implementation phase.

Keep:

- JWT verification integration.
- Request principal.
- Platform claim contract.
- RLS contract and deferred testing backlog.

### Remove obsolete generator infrastructure

Remove:

- Separate service URL configuration.
- Client abstractions that exist only to model two different generator
  services.
- Obsolete provider contract wording.

Retain and update the summary and recommendation logical contracts as LLM
prompt/input/output contracts.

### Verification

Search the entire backend for obsolete names and paths. Confirm:

- No runtime or test import references `mysql2`.
- No `MYSQL_*` configuration remains.
- No local password, login, signup, session, or token service remains.
- No internal Express `/api` mount remains.
- No separate summary/recommendation service URL remains.
- Package installation, typecheck, and build pass.
- Existing unchanged tests may be run where they remain applicable.
- Hosted-development smoke checks cover the replaced runtime paths.
- All Supabase integration cases required later are present in the testing
  backlog.

**Done when:** the repository contains only the target infrastructure and
ownership model.

## Phase R10: Complete Revision Verification and Documentation

### Purpose

Prove the revision is reproducible and formally reopen the remaining feature
plan.

### Documentation

Reconcile:

- `backend-architecture.md`
- `database-schema.md`
- `overall-architecture.md`
- `README.md`
- `.env.example`
- API/provider contracts
- `plan.md`
- `progress.md`

The overall documentation must no longer claim that DAS 7:

- Uses direct PostgreSQL or MySQL access.
- Calls DAS 1 or DAS 3 for its progress data.
- Owns login or authorization implementation.
- Mounts a second `/api` prefix internally.
- Uses two separate generator services.

### Revision handoff verification

Run the non-deferred implementation checks from `backend/`:

```powershell
npm run typecheck
npm run build
```

Also:

1. Preview and verify the linked development project's migration history.
2. Regenerate database types from the linked project and confirm no unexpected
   diff.
3. Run database advisors against the development project and address
   revision-owned findings.
4. Verify all exposed tables have RLS enabled.
5. Verify API and worker environment separation.
6. Smoke-check the service-local routes against the hosted development project.
7. Verify external `/api/insights` path configuration.
8. Verify secrets and real user/student data are absent from tracked files.
9. Verify no local Supabase service, seed data, or local database artifact was
   introduced.
10. Confirm the dedicated testing backlog covers every deferred unit, HTTP,
    Supabase, provider, contract, and end-to-end case.
11. Review the working tree and preserve unrelated user changes.

Do not create the permanent Supabase/provider test files in R10. Those files
are created or rewritten after Phases 9 through 12 are implemented.

### Completion update

When every gate passes:

- Mark R1 through R10 done in [`progress.md`](progress.md).
- Record the final typecheck, build, migration, advisor, and smoke-check
  results.
- Change [`plan.md`](plan.md) from paused to active.
- Mark Phase 9 as next.

Do not add completion dates.

**Done when:** the hosted development project reflects the committed Supabase
migrations, the revised runtime paths work in development, all deferred test
cases are recorded, and the project is ready to resume Phase 9.

## 4. Revision Acceptance Checklist

The revision is complete only when all of the following are true:

- [ ] Supabase CLI setup is committed and device-independent.
- [ ] Supabase package versions are pinned and the lockfile is committed.
- [ ] The CLI is linked only to the hosted development project.
- [ ] Every migration push is previewed before being applied.
- [ ] The hosted development project contains the complete committed migration
      history.
- [ ] No local Supabase database, reset workflow, seed file, or production
      project linkage is used.
- [ ] The custom `insight` schema is explicitly exposed and granted.
- [ ] RLS is enabled on every exposed DAS 7 table.
- [ ] Required authorization policies are documented as an external contract.
- [ ] The API uses a publishable key and the caller's verified JWT.
- [ ] Only the worker receives the Supabase secret key.
- [ ] No DAS 7 Auth lifecycle implementation exists.
- [ ] Parent and student records are local platform identity projections.
- [ ] Atomic multi-table work uses reviewed PostgreSQL RPC functions.
- [ ] Track Progress and Summary pass on Supabase.
- [ ] Recommendations pass on Supabase.
- [ ] Notification Preferences pass on Supabase.
- [ ] Service-local Express routes match `/api/insights` prefix stripping.
- [ ] No CORS configuration is present.
- [ ] Summary and recommendation adapters share one LLM client boundary.
- [ ] No production LLM provider has been prematurely coupled to domain or
      application code.
- [ ] No MySQL dependency, code, migration, test environment, or configuration
      remains.
- [ ] No direct dependency on another DAS subsystem exists.
- [ ] Typecheck, build, hosted migration checks, and implementation smoke checks
      pass.
- [ ] All permanent test work is recorded for the dedicated testing phase.
- [ ] Documentation describes the implemented architecture accurately.

## 5. External Blockers Versus DAS 7 Failures

Treat these as external integration blockers when missing:

- Supabase project ownership or access.
- Hosted development project reference and credentials.
- Final access-token custom claim names.
- Parent Auth-user mapping rules.
- Staff/system ingestion identities.
- Approved RLS policies.
- Traefik orchestration changes.
- Production LLM or email provider credentials.

Do not mark the revision complete if an external blocker prevents a required
implementation smoke check. Record the blocker clearly in `progress.md`.

Treat these as DAS 7 revision failures:

- Supabase migrations cannot replay.
- Supabase repositories do not preserve existing behavior.
- Secret-key clients are reachable from API composition.
- JWTs are not verified on protected routes.
- MySQL or local-authentication code remains after R9.
- Internal paths still contain an extra `/api` prefix.
- LLM provider details leak into domain or application code.
- The deferred testing backlog or documentation contradicts the approved
  target architecture.

## 6. Supabase Reference Checks

Before executing a phase involving Supabase behavior, recheck the current
official documentation and changelog because CLI commands, Data API defaults,
and Auth guidance can change.

- Changelog: <https://supabase.com/changelog>
- JWT verification: <https://supabase.com/docs/guides/auth/jwts>
- Custom schemas: <https://supabase.com/docs/guides/api/using-custom-schemas>
- Data API security: <https://supabase.com/docs/guides/api/securing-your-api>
- Row Level Security:
  <https://supabase.com/docs/guides/database/postgres/row-level-security>
- Linked-project CLI workflow:
  <https://supabase.com/docs/guides/local-development/cli-workflows>
- Database migration deployment:
  <https://supabase.com/docs/guides/deployment/database-migrations>
- Current Data API grant-default change:
  <https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically>
