# Backend integration plan

## Goal

Keep DAS1, DAS3, and DAS7 as independent local backends while giving the
centralized frontend consistent routing and authorization behavior.

- DAS1 remains public.
- DAS3 accepts only teachers with valid Supabase JWTs.
- DAS7 accepts only parents with valid Supabase JWTs.
- Docker is used only for the DAS3 backend, PostgreSQL, and Redis.
- DAS7 continues to send real email through Brevo.
- Production hosting is out of scope.

## Settled decisions

These decisions are no longer implementation branches:

- DAS3 runs locally with `langgraph dev` inside its existing container.
- The DAS3 Compose stack keeps PostgreSQL, Redis, and Milvus Lite, but removes the
  old DAS3 frontend container. `langgraph dev` persists its local runtime state
  through the `langgraph-state` named volume; the retained PostgreSQL and Redis
  services are not used by that development runtime.
- The LangGraph container is exposed to the host on port `2024`.
- The root Vite proxy remains the only browser-facing proxy. Traefik is not used.
- Supabase Auth and profile tables are separate from DAS3's local LangGraph state
  volume. PostgreSQL-backed LangGraph deployment requires `langgraph up` and the
  required LangSmith deployment credential, which is out of scope for this local
  `langgraph dev` setup.
- DAS3 and DAS7 verify asymmetric Supabase JWTs through the project JWKS endpoint.
  Legacy HS256 verification is removed rather than duplicated.
- `worksheet.teachers.auth_user_id` and
  `insight.parents.auth_user_id` are required, unique foreign keys to
  `auth.users.id` with delete cascading.
- JWT `sub` is the LangGraph thread owner.
- Both protected backends always require a JWT. DAS7's `AUTH_DEV_SUB` bypass is
  removed, and DAS3 does not add one.
- Test teacher and parent users are created manually in the Supabase Dashboard.
  Email delivery and a provisioning script are not required.
- Mutual exclusivity is a documented manual rule for this local project. The same
  Auth user ID must not be inserted into both profile tables.
- Existing Supabase application data may be reset and reseeded.
- Existing LangGraph threads without owner metadata may be discarded.
- DAS3 does not add a `/me` route. The frontend checks teacher access with a small
  authenticated thread search.

## Parallelism guide

"Parallel" means different contributors can work without waiting for each other.
A single backend integrator may do parallel lanes in any order. "Sequential" means
the later step consumes a schema, interface, or verified behavior from the earlier
step.

| Phase | Work | Execution |
| --- | --- | --- |
| 1 | Shared Supabase foundation and DAS3 container cleanup | Two parallel lanes, sequential steps within each lane |
| 2 | DAS1 verification, DAS3 auth, and DAS7 auth cleanup | Three parallel service lanes |
| 3 | DAS3 profile and thread ownership integration | Sequential inside DAS3 |
| 4 | Service test suites | Parallel by backend |
| 5 | Full local integration test | Sequential after all service suites pass |

## Phase 1: parallel foundations

The database lane and container lane can run in parallel because they edit
different files and services.

### Lane 1A: centralize the shared Supabase migrations

The steps in this lane are sequential.

1. Create the root `db/migrations/` directory.
2. Move the existing DAS7 Supabase migrations from
   `DAS_7/db/migrations/` into the root migration history.
3. Update migration documentation and any script paths that refer to the old
   directory.
4. Add a migration for the `worksheet` schema and `worksheet.teachers`.
5. Add a migration that makes `insight.parents.auth_user_id` required and adds its
   foreign key to `auth.users.id`.
6. Enable RLS on `worksheet.teachers` as defense in depth.
7. Revoke `anon` and `authenticated` access to the teacher table. The frontend
   must not query it through the Data API.
8. Apply the ordered migrations to the approved local/test Supabase project.
9. Run the database security advisors and review their findings.
10. Reset and reseed the DAS7 application data after test Auth users exist.

Recommended teacher table fields:

| Column | Rule |
| --- | --- |
| `teacher_id` | UUID primary key with a generated default |
| `auth_user_id` | UUID, required, unique, foreign key to `auth.users.id` |
| `display_name` | Optional text |
| `created_at` | Timestamp with a generated default |

Both Auth foreign keys use `on delete cascade`. Deleting a Supabase Auth account
therefore deletes its teacher or parent profile. It does not automatically delete
LangGraph threads from DAS3's separate local state volume.

Verification:

- [ ] Migrations apply cleanly from an empty application schema.
- [ ] A teacher and parent can each reference a confirmed Auth user.
- [ ] Null and duplicate Auth IDs are rejected.
- [ ] Deleting a test Auth user removes its profile.
- [ ] Browser publishable credentials cannot read either profile table directly.
- [ ] Real service-role values appear only in backend `.env` files.

### Lane 1B: reduce Docker Compose to DAS3 backend infrastructure

The steps in this lane are sequential.

1. Remove the DAS3 `frontend` service from `DAS_3/docker-compose.yml`.
2. Keep `langgraph-dev`, PostgreSQL, Redis, the model cache, and their persistent
   volumes.
3. Publish LangGraph port `2024` to host port `2024`.
4. Keep the root frontend outside Docker. Its Vite proxy already targets
   `http://localhost:2024`.
5. Load local backend configuration from a normal ignored `.env` file instead of
   the old deployment-specific `.env.shipit` convention.
6. Add Supabase URL, service-role key, and JWKS configuration to the DAS3 container
   environment.
7. Keep Milvus Lite at its existing file path and retain the model-cache volume.
8. Keep PostgreSQL and Redis volumes so threads and runs survive container restarts.

Verification:

- [ ] `docker compose up --build` starts only the DAS3 backend stack and its data
  services.
- [ ] `http://localhost:2024/ok` responds from the host.
- [ ] A LangGraph thread remains available after restarting the stack.
- [ ] The root Vite proxy can reach the container.

## Phase 2: parallel service lanes

Start this phase after both Phase 1 lanes pass. DAS1, DAS3, and DAS7 work can then
run in parallel.

### Lane 2A: DAS1 public contract

Owner: `DAS_1/backend/`.

- [ ] Keep every current screening route public.
- [ ] Confirm that Vite removes `/api/screening` before forwarding and the backend
  continues to mount routes at `/`.
- [ ] Keep or add an integration test that reaches DAS1 through the public prefix.
- [ ] Confirm that no Supabase login is required to complete a screening.
- [ ] Keep future private result searches or staff dashboards out of the public
  router until they have a separate authorization design.
- [ ] Rename any backend-only provider variable that uses a misleading `VITE_`
  prefix when configuration is cleaned up.

Completion check:

- Anonymous screening works through the root Vite proxy.
- Existing DAS1 tests pass.

### Lane 2B: DAS3 JWT authentication

Owner: `DAS_3/`.

- [ ] Add a pinned Supabase Python client or another maintained JWT library to the
  committed dependency file.
- [ ] Read `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from the DAS3 backend
  environment.
- [ ] Verify tokens through the project's asymmetric JWKS. Do not add HS256 secret
  verification.
- [ ] Verify signature, issuer, and expiry, and require a non-empty `sub`.
- [ ] Implement a LangGraph `Auth` handler and reference it from `langgraph.json`.
- [ ] Return `401` for missing, malformed, expired, wrong-issuer, or invalidly
  signed tokens.
- [ ] Define a small teacher repository interface and use a fake implementation in
  unit tests.
- [ ] Return `403` when a valid Supabase user has no teacher profile.
- [ ] Return JWT `sub` as the LangGraph authenticated identity.
- [ ] Do not add a tokenless development bypass.

Completion check with fakes:

- Missing and invalid tokens return `401`.
- A valid token with no teacher returns `403`.
- A valid teacher reaches the protected LangGraph handler.

### Lane 2C: DAS7 authorization cleanup

Owner: `DAS_7/`.

- [ ] Add `ForbiddenError` with a generic `403` response.
- [ ] Keep malformed, expired, wrong-issuer, and invalidly signed JWTs as `401`.
- [ ] Change a valid JWT with no parent profile from `401` to `403`.
- [ ] Remove `AUTH_DEV_SUB` from configuration, `.env.example`, middleware, and
  tests.
- [ ] Remove legacy `SUPABASE_JWT_SECRET` handling and standardize on JWKS.
- [ ] Keep `requireOwnStudent` and `requireOwnParent` returning the same `404` for
  absent and unowned records.
- [ ] Add tests that distinguish invalid-token `401` from wrong-group `403`.
- [ ] Keep the Brevo and fake email adapters unchanged.

Completion check:

- A parent can call `/me`.
- A teacher receives `403` from `/me`.
- Missing or invalid JWTs receive `401`.
- Student enumeration tests still receive indistinguishable `404` responses.

## Phase 3: sequential DAS3 ownership integration

This phase starts after the DAS3 auth handler and teacher table both exist. Complete
the steps in order.

### Step 3.1: connect the teacher repository

- [ ] Replace the fake startup repository with a Supabase-backed lookup of
  `worksheet.teachers.auth_user_id`.
- [ ] Keep the service-role key inside the container and disable browser-style
  session persistence in the server client.
- [ ] Select only the fields needed to confirm teacher membership.
- [ ] Treat Supabase outages as service failures, not as `403 Forbidden`.

### Step 3.2: attach the owner to LangGraph resources

- [ ] Use JWT `sub` as `ctx.user.identity`.
- [ ] Add owner metadata when a thread is created.
- [ ] Filter thread search, read, update, delete, and run operations by owner.
- [ ] Add authorization handlers only for LangGraph resource types DAS3 actually
  uses.
- [ ] Do not place the JWT, Supabase key, or provider keys in graph state.

### Step 3.3: handle existing local data

- [ ] Remove or ignore pre-authentication threads that have no owner metadata.
- [ ] Keep the `langgraph-state` volume for new authenticated threads; PostgreSQL
  and Redis remain retained Compose infrastructure but are unused by `langgraph dev`.
- [ ] Confirm that clarification interrupts and streaming still work after owner
  filters are active.

### Step 3.4: verify real authorization

- [ ] Teacher A can create, read, continue, and stream their own thread.
- [ ] Teacher B cannot search, read, update, delete, or run Teacher A's thread.
- [ ] A parent token receives `403` before graph execution.
- [ ] Invalid and expired JWTs receive `401`.
- [ ] A small authenticated thread search succeeds after teacher login and can be
  used by the frontend as its access check.

## Manual local account setup

No provisioning script or email delivery is required.

For each test account:

1. Create a user manually in the Supabase Dashboard with a unique, syntactically
   valid test email and password.
2. Mark the user as confirmed so no email is sent.
3. Copy the Auth user ID.
4. Insert exactly one matching profile:
   - Teacher: `worksheet.teachers`
   - Parent: `insight.parents`
5. For a parent, provide the existing required `name`, `email`, and
   `mobile_number` fields.
6. Never insert the same Auth user ID into both tables.

Fake email addresses cannot receive password-reset links. Recreate the local test
account if its password is lost.

## Phase 4: parallel service verification

Run the service suites in parallel after Phase 3 passes.

### DAS1

```powershell
npm test --prefix DAS_1
```

### DAS3

```powershell
python -m pytest DAS_3/tests
npm test --prefix DAS_3/frontend
```

Add JWT, wrong-group, and thread-ownership tests to the Python suite. Any test that
uses a real Supabase project must refuse to run unless an approved project
reference is configured.

### DAS7

```powershell
npm test --prefix DAS_7
npm run build --prefix DAS_7
```

Keep real Brevo sending disabled in automated tests.

## Phase 5: sequential full local test

Run this only after all three service suites and the frontend tests pass.

1. Start the DAS3 Docker Compose stack and confirm port `2024`.
2. Start DAS1 on port `4173` and DAS7 on port `4000` directly on the host.
3. Start the root Vite frontend on port `5173`.
4. Complete an anonymous screening.
5. Sign in as a teacher and confirm worksheet access.
6. Sign in as a parent without logging out the teacher and confirm insight access.
7. Send the teacher token to DAS7 and expect `403`.
8. Send the parent token to DAS3 and expect `403`.
9. Confirm that missing and invalid tokens return `401`.
10. Compare the responses for an unowned resource and a nonexistent resource.
11. Restart the DAS3 stack and confirm that an authenticated teacher thread still
    exists.
12. Run a DAS7 notification through the fake email provider. Test Brevo manually
    only when real email delivery is needed.

## Definition of done

- DAS1 remains public.
- DAS3 verifies JWTs through JWKS, checks teacher membership, and scopes threads by
  JWT `sub`.
- DAS7 verifies JWTs through JWKS and applies the agreed `401`, `403`, and `404`
  behavior.
- Test accounts are documented and manually assigned to only one group.
- The root Supabase migration history contains both worksheet and insight schema
  changes.
- Only DAS3 uses Docker. The centralized frontend, DAS1, and DAS7 run on the host.
- Brevo remains available for real DAS7 email.
- Every service suite and the full local test pass.

## References

- [LangGraph custom authentication](https://docs.langchain.com/langsmith/custom-auth)
- [LangGraph resource authorization](https://docs.langchain.com/langsmith/auth)
- [Supabase JWT verification](https://supabase.com/docs/guides/auth/jwts)
- [Supabase user profile tables](https://supabase.com/docs/guides/auth/managing-user-data)
